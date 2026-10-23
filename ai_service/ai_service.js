/**
 * ai_service.js — Gemma 4 integration for myShop AI (Node/Express)
 * Matches backend/ai_service.py behavior: multi-provider dropdown,
 * structured prompts, deterministic Bengali/English fallbacks.
 */

const https = require('https');
const http = require('http');

// Config from environment (same names as Python)
const GEMMA_API_URL = (process.env.GEMMA_API_URL || '').trim().replace(/^["']|["']$/g, '');
const GEMMA_API_KEY = (process.env.GEMMA_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const GEMMA_MODEL = (process.env.GEMMA_MODEL || 'gemma-4-31b-it').trim() || 'gemma-4-31b-it';

const GOOGLE_AI_STUDIO_KEY = (process.env.GOOGLE_AI_STUDIO_KEY || GEMMA_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const HF_API_KEY = (process.env.HUGGINGFACE_API_KEY || '').trim().replace(/^["']|["']$/g, '');

const GOOGLE_AI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const HF_INFERENCE_BASE = 'https://router.huggingface.co/hf-inference/models/google';

const GEMMA4_MODELS = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'];
const DEFAULT_TIMEOUT = 90000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF = 1500;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function truncate(text, limit = 1200) {
  if (!text || text.length <= limit) return text;
  return text.slice(0, limit) + '… [truncated ' + (text.length - limit) + ' chars]';
}

function logStage(stage, purpose, fields) {
  const pairs = Object.entries(fields || {}).map(([k, v]) => k + '=' + (typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v)));
  console.log('[gemma:' + purpose + ':' + stage + '] ' + pairs.join(' | '));
}

function parseGoogleResponse(data, purpose, model) {
  const meta = {
    model,
    candidate_count: 0,
    part_count: 0,
    thought_part_count: 0,
    answer_part_count: 0,
    finish_reason: null,
    block_reason: null,
    usage: data && data.usageMetadata ? data.usageMetadata : null,
  };

  const candidates = (data && data.candidates) || [];
  meta.candidate_count = candidates.length;
  if (!candidates.length) {
    const promptFeedback = (data && data.promptFeedback) || {};
    meta.block_reason = promptFeedback.blockReason || null;
    logStage('parse', purpose, { model, result: 'no_candidates', meta });
    return { text: null, meta };
  }

  const candidate = candidates[0] || {};
  meta.finish_reason = candidate.finishReason || null;

  const content = candidate.content || {};
  const parts = content.parts || [];
  meta.part_count = parts.length;

  const thoughtTexts = [];
  const answerTexts = [];
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const text = typeof part.text === 'string' ? part.text.trim() : '';
    if (!text) continue;
    if (part.thought === true) {
      meta.thought_part_count++;
      thoughtTexts.push(text);
    } else {
      meta.answer_part_count++;
      answerTexts.push(text);
    }
  }

  const answerText = answerTexts.join('\n').trim();
  const thoughtText = thoughtTexts.join('\n').trim();

  logStage('parse', purpose, { model, result: answerText ? 'answer_only' : (thoughtText ? 'thought_only_no_answer' : 'empty_parts'), answer_len: answerText.length, thought_parts: meta.thought_part_count });
  return { text: answerText || null, meta };
}

function modelAttemptOrder(preferred) {
  const ordered = [];
  for (const m of [preferred, GEMMA_MODEL, ...GEMMA4_MODELS]) {
    if (m && !ordered.includes(m)) ordered.push(m);
  }
  return ordered;
}

function buildGenerationConfig(maxTokens, temperature = 0.4, thinkingLevel = 'MINIMAL') {
  return {
    maxOutputTokens: maxTokens,
    temperature,
    thinkingConfig: { thinkingLevel },
  };
}

// Simple https POST helper returning parsed JSON
function postJson(urlStr, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: timeoutMs || DEFAULT_TIMEOUT,
    };
    const reqLib = url.protocol === 'https:' ? https : http;
    const req = reqLib.request(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null, text: data });
        } catch {
          resolve({ status: res.statusCode, body: null, text: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('timeout')));
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function callCustom(prompt, maxTokens, purpose) {
  if (!GEMMA_API_URL || !GEMMA_API_KEY) {
    logStage('custom_skip', purpose, { reason: 'missing_url_or_key' });
    return null;
  }
  const url = GEMMA_API_URL.replace(/\/$/, '');
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: buildGenerationConfig(maxTokens),
  };
  logStage('custom_request', purpose, { url: truncate(url, 200), max_tokens: maxTokens, prompt_len: prompt.length });
  try {
    const res = await postJson(url, payload, { Authorization: 'Bearer ' + GEMMA_API_KEY }, DEFAULT_TIMEOUT);
    logStage('custom_response', purpose, { status: res.status, body: truncate(res.text, 300) });
    if (res.status !== 200) return null;
    if (res.body && res.body.candidates) {
      const parsed = parseGoogleResponse(res.body, purpose, 'custom-endpoint');
      return parsed.text;
    }
    if (Array.isArray(res.body) && res.body.length) {
      const generated = (res.body[0].generated_text || '').replace(prompt, '').trim();
      return generated || null;
    }
  } catch (e) {
    console.warn('[gemma:' + purpose + ':custom_error] ' + e.message);
  }
  return null;
}

async function callGoogleStudio(prompt, maxTokens, { purpose, apiKey, timeout, thinkingLevel, temperature } = {}) {
  const key = (apiKey || GOOGLE_AI_STUDIO_KEY || '').trim();
  if (!key) {
    logStage('studio_skip', purpose, { reason: 'missing_api_key' });
    return null;
  }
  const models = modelAttemptOrder(GEMMA_MODEL);
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: buildGenerationConfig(maxTokens, temperature || 0.4, thinkingLevel || 'MINIMAL'),
  };
  logStage('studio_request', purpose, { models, max_tokens: maxTokens, thinking_level: thinkingLevel || 'MINIMAL', prompt_preview: truncate(prompt, 400) });

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      const url = GOOGLE_AI_BASE + '/' + model + ':generateContent?key=' + key;
      logStage('studio_attempt', purpose, { model, attempt, url: truncate(url, 180) });
      try {
        const res = await postJson(url, payload, {}, timeout || DEFAULT_TIMEOUT);
        logStage('studio_response', purpose, { model, attempt, status: res.status, body: truncate(res.text, 300) });
        if (res.status === 404) break;
        if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_BACKOFF * attempt));
          continue;
        }
        if (res.status !== 200) break;
        if (res.body) {
          const parsed = parseGoogleResponse(res.body, purpose, model);
          if (parsed.text) {
            logStage('studio_success', purpose, { model, result: 'answer_only', answer_len: parsed.text.length });
            return parsed.text;
          }
          // Thought-only / empty — retry with doubled tokens if budget allows
          if (!parsed.text && parsed.meta.thought_part_count > 0 && maxTokens < 8192) {
            const boosted = Math.min(maxTokens * 2, 8192);
            const boostedPayload = {
              ...payload,
              generationConfig: buildGenerationConfig(boosted, temperature || 0.4, 'MINIMAL'),
            };
            try {
              const retryRes = await postJson(url, boostedPayload, {}, timeout || DEFAULT_TIMEOUT);
              if (retryRes.status === 200 && retryRes.body) {
                const retryParsed = parseGoogleResponse(retryRes.body, purpose, model);
                if (retryParsed.text) return retryParsed.text;
              }
            } catch {}
          }
          // Retry with MINIMAL if not already
          if ((thinkingLevel || 'MINIMAL') !== 'MINIMAL') {
            const minimalPayload = {
              ...payload,
              generationConfig: buildGenerationConfig(maxTokens, temperature || 0.4, 'MINIMAL'),
            };
            try {
              const retryRes = await postJson(url, minimalPayload, {}, timeout || DEFAULT_TIMEOUT);
              if (retryRes.status === 200 && retryRes.body) {
                const retryParsed = parseGoogleResponse(retryRes.body, purpose, model);
                if (retryParsed.text) return retryParsed.text;
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn('[gemma:' + purpose + ':studio_error] model=' + model + ' error=' + e.message);
        break;
      }
      break; // try next model
    }
  }
  logStage('studio_exhausted', purpose, { result: 'all_models_failed' });
  return null;
}

async function callHuggingFace(prompt, maxTokens, purpose) {
  if (!HF_API_KEY) {
    logStage('hf_skip', purpose, { reason: 'missing_api_key' });
    return null;
  }
  for (const slug of ['gemma-2-9b-it', 'gemma-7b-it']) {
    const url = HF_INFERENCE_BASE + '/' + slug;
    const payload = {
      inputs: prompt,
      parameters: { max_new_tokens: maxTokens, temperature: 0.4, return_full_text: false },
    };
    logStage('hf_request', purpose, { model: slug, url });
    try {
      const res = await postJson(url, payload, { Authorization: 'Bearer ' + HF_API_KEY }, 60000);
      logStage('hf_response', purpose, { model: slug, status: res.status, body: truncate(res.text, 300) });
      if (res.status === 200 && res.body) {
        if (Array.isArray(res.body) && res.body.length) {
          const text = (res.body[0].generated_text || '').trim();
          if (text) return text;
        }
        if (typeof res.body === 'object' && res.body.generated_text) {
          const text = res.body.generated_text.trim();
          if (text) return text;
        }
      }
      if (res.status === 503) continue;
    } catch (e) {
      console.warn('[gemma:' + purpose + ':hf_error] ' + e.message);
    }
  }
  return null;
}

async function callGemma(prompt, maxTokens = 1024, { purpose = 'generic', timeout = DEFAULT_TIMEOUT, thinkingLevel = 'MINIMAL', temperature = 0.4, apiKey } = {}) {
  logStage('call_start', purpose, { max_tokens: maxTokens, timeout, thinking_level: thinkingLevel, prompt_len: prompt.length });

  let result = await callCustom(prompt, maxTokens, purpose);
  if (result) {
    logStage('call_done', purpose, { provider: 'custom', answer_len: result.length });
    return result;
  }

  result = await callGoogleStudio(prompt, maxTokens, { purpose, apiKey, timeout, thinkingLevel, temperature });
  if (result) {
    logStage('call_done', purpose, { provider: 'google_ai_studio', answer_len: result.length });
    return result;
  }

  result = await callHuggingFace(prompt, maxTokens, purpose);
  if (result) {
    logStage('call_done', purpose, { provider: 'huggingface', answer_len: result.length });
    return result;
  }

  console.warn('[gemma:' + purpose + ':call_failed] All AI providers unavailable.');
  return null;
}

const { buildQueryPrompt, _buildStructuredFallback, _formatContextForPrompt, _isBanglaQuestion } = require('./prompts');
function answerQuery(businessName, question, contextData, apiKey) {
  const prompt = buildQueryPrompt(businessName, question, contextData);
  return callGemma(prompt, 2048, { purpose: 'answer_query', timeout: 90000, thinkingLevel: 'MINIMAL', temperature: 0.35, apiKey }).then(result => {
    if (result) return result;
    return _buildStructuredFallback(businessName, question || '', contextData || {});
  });
}

function generateWinbackMessages(businessName, campaign, targetCustomers, apiKey) {
  if (!targetCustomers || !targetCustomers.length) return { campaign_brief: 'No at-risk customers found.', messages: [], at_risk_count: 0, combined_lifetime_spend: 0 };
  const custData = targetCustomers.map(c => {
    const fav = c.favorite_category || 'products';
    const days = c.days_since_last_order || (campaign && campaign.inactive_days) || 30;
    return `Name: ${c.name || 'Customer'} | Phone: ${c.phone || ''} | Spend: ${c.total_revenue || 0} | Inactive: ${days} days | Fav Category: ${fav}`;
  }).join('\n');
  const combinedSpend = targetCustomers.reduce((s, c) => s + (parseFloat(c.total_revenue) || 0), 0);
  const discount = (campaign && campaign.discount_percent) || 10;
  const lang = (campaign && campaign.language) || 'bn';
  const note = (campaign && campaign.custom_note) || '';
  const limit = (campaign && campaign.limit) || 50;

  const prompt = `You are an elite Marketing AI for ${businessName}.\nGenerate a win-back campaign for the following at-risk customers.\n\nCAMPAIGN DETAILS:\n- Offer: ${discount}% off\n- Language: ${lang === 'bn' ? 'Bangla' : 'English'}\n- Custom Note from Owner: ${note}\n\nCUSTOMERS (MAX ${limit}):\n${custData}\n\nOUTPUT STRICT JSON ONLY:\n{\n  "campaign_brief": "Short 2 sentence marketing brief explaining the angle of this campaign.",\n  "messages": [\n    {\n      "phone": "customer phone",\n      "name": "customer name",\n      "days_inactive": 0,\n      "message": "The personalized WhatsApp message. Include the custom note, the discount, and mention their favorite category."\n    }\n  ]\n}\n\nEnsure output is valid JSON without markdown wrapping.`;

  return callGemma(prompt, 8192, { purpose: 'winback_preview', timeout: 120000, temperature: 0.7, apiKey }).then(result => {
    try {
      if (!result) throw new Error('Empty response from Gemma');
      let cleaned = result;
      if (cleaned.includes('```json')) cleaned = cleaned.split('```json')[1].split('```')[0].trim();
      else if (cleaned.includes('```')) cleaned = cleaned.split('```')[1].split('```')[0].trim();
      const data = JSON.parse(cleaned);
      const messages = (data.messages || []).map(msg => {
        const phone = (msg.phone || '').trim();
        const encoded = encodeURIComponent(msg.message || '');
        const fullPhone = phone.startsWith('+88') ? phone : '+88' + (phone.replace(/^0/, '') || phone);
        return { ...msg, whatsapp_url: 'https://wa.me/' + fullPhone + '?text=' + encoded };
      });
      return { ...data, messages, at_risk_count: targetCustomers.length, combined_lifetime_spend: combinedSpend };
    } catch (e) {
      console.error('Failed to parse winback JSON:', e);
      return { campaign_brief: 'Failed to generate campaign with AI due to invalid formatting.', messages: [], at_risk_count: targetCustomers.length, combined_lifetime_spend: combinedSpend };
    }
  });
}

module.exports = {
  callGemma,
  generateInsights,
  generateForecastInsights,
  generateRestockPlan,
  generatePLSummary,
  generateMonthlyExecutiveSummary,
  answerQuery,
  generateWinbackMessages,
};
