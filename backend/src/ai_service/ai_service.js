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

function _formatContextValue(value) {
  if (value === null || value === undefined) return 'N/A';
  if (Array.isArray(value)) return value.length ? value.map(String).join('; ') : 'None';
  if (typeof value === 'object') return Object.entries(value).map(([k, v]) => k + ': ' + v).join('; ');
  return String(value);
}

function _formatReportContext(data) {
  const sections = {
    'Business Overview': {
      business_name: 'Business name',
      last_sale_date: 'Most recent sale date',
      data_gaps: 'Metrics not tracked in this system',
    },
    'Sales & Daily Performance': {
      total_orders: 'Total orders (all time)',
      delivered_orders: 'Delivered orders',
      pending_orders: 'Pending orders',
      returned_orders: 'Returned orders',
      cancelled_orders: 'Cancelled orders',
      return_rate_pct: 'Return rate (%)',
      total_revenue: 'Total revenue (BDT, all time)',
      total_profit: 'Total profit (BDT, all time)',
      total_delivery_cost: 'Total delivery cost (BDT, all time)',
      avg_order_value: 'Average order value (BDT, all time)',
      profit_margin_pct: 'Profit margin (%, all time)',
      net_cash_flow: 'Net cash flow after investments (BDT)',
      today_orders: "Today's orders",
      today_revenue: "Today's revenue / sales (BDT)",
      today_profit: "Today's profit (BDT)",
      last_7_days_orders: 'Orders in the last 7 days',
      last_7_days_revenue: 'Revenue in the last 7 days (BDT)',
      last_7_days_profit: 'Profit in the last 7 days (BDT)',
      top_products: 'Top selling products',
    },
    Customers: {
      unique_customers: 'Unique customers (all time)',
      at_risk_customers: 'At-risk customers (no purchase in 30+ days)',
      top_customers: 'Top customers by spend',
    },
    'Products & Inventory': {
      total_products_in_inventory: 'Products in inventory',
      total_stock_value: 'Inventory stock value (BDT)',
      out_of_stock_products: 'Out-of-stock products',
      low_stock_products: 'Low-stock products',
    },
    'Investments & Capital': {
      total_investment: 'Total investment spend (BDT)',
      investment_by_category: 'Investment breakdown by category',
    },
  };
  const lines = [];
  for (const [sectionName, labels] of Object.entries(sections)) {
    const sectionLines = [];
    for (const [key, label] of Object.entries(labels)) {
      if (key in data) sectionLines.push('- ' + label + ': ' + _formatContextValue(data[key]));
    }
    if (sectionLines.length) {
      lines.push('[' + sectionName + ']');
      lines.push(...sectionLines);
      lines.push('');
    }
  }
  return lines.join('\n').trim();
}

function _formatContextForPrompt(contextData) {
  return _formatReportContext(contextData);
}

function _isBanglaQuestion(question) {
  return /[ঀ-৿]/.test(question || '');
}

function _buildStructuredFallback(businessName, question, contextData) {
  const qLower = (question || '').toLowerCase();
  const todayRev = parseFloat(contextData.today_revenue || 0);
  const todayProfit = parseFloat(contextData.today_profit || 0);
  const todayOrders = parseInt(contextData.today_orders || 0, 10);
  const totalRev = parseFloat(contextData.total_revenue || 0);
  const totalProfit = parseFloat(contextData.total_profit || 0);
  const margin = parseFloat(contextData.profit_margin_pct || 0);
  const atRisk = parseInt(contextData.at_risk_customers || 0, 10);
  const unique = parseInt(contextData.unique_customers || 0, 10);
  const last7Rev = parseFloat(contextData.last_7_days_revenue || 0);
  const last7Orders = parseInt(contextData.last_7_days_orders || 0, 10);
  const avg7Day = last7Rev > 0 ? last7Rev / 7 : 0;
  const todayMargin = todayRev > 0 ? (todayProfit / todayRev * 100) : 0;
  const outOfStock = contextData.out_of_stock_products || 'None';
  const lowStock = contextData.low_stock_products || 'None';
  const bn = _isBanglaQuestion(question);

  let numbers = '';
  if (qLower.includes('profit') || qLower.includes('প্রফিট') || qLower.includes('লাভ')) {
    numbers = bn ? `আজকের মোট প্রফিট **৳${todayProfit.toFixed(2)}**। মোট নেট প্রফিট **৳${totalProfit.toFixed(0)}**।`
                  : `Today's profit is **৳${todayProfit.toFixed(2)}**. All-time net profit is **৳${totalProfit.toFixed(0)}**.`;
  } else if (qLower.includes('revenue') || qLower.includes('রেভিনিউ') || qLower.includes('sales') || qLower.includes('সেলস') || qLower.includes('বিক্রি')) {
    numbers = bn ? `আজকের মোট সেলস (Revenue) **৳${todayRev.toFixed(2)}**। আজকের মোট অর্ডার **${todayOrders}টি** এবং প্রফিট **৳${todayProfit.toFixed(2)}**।`
                  : `Today's revenue is **৳${todayRev.toFixed(2)}** across **${todayOrders}** orders with **৳${todayProfit.toFixed(2)}** profit.`;
  } else if (qLower.includes('average order') || qLower.includes('aov') || qLower.includes('avg order') || qLower.includes('গড় অর্ডার')) {
    const aov = parseFloat(contextData.avg_order_value || 0);
    numbers = bn ? `গড় অর্ডার ভ্যালু (AOV) **৳${aov.toFixed(2)}**।` : `Average order value is **৳${aov.toFixed(2)}**.`;
  } else if (qLower.includes('customer') || qLower.includes('কাস্টমার') || qLower.includes('গ্রাহক')) {
    numbers = bn ? `মোট **${unique}** জন ইউনিক কাস্টমার। **${atRisk}** জন At-risk (৩০+ দিন কেনাকাটা নেই)।`
                  : `You have **${unique}** unique customers; **${atRisk}** are at-risk (no purchase in 30+ days).`;
  } else {
    numbers = bn ? `আজকের সেলস **৳${todayRev.toFixed(2)}**, প্রফিট **৳${todayProfit.toFixed(2)}**, মোট অর্ডার **${todayOrders}টি**। সর্বকালীন রেভিনিউ **৳${totalRev.toFixed(0)}**, প্রফিট **৳${totalProfit.toFixed(0)}**।`
                  : `Today: **৳${todayRev.toFixed(2)}** revenue, **৳${todayProfit.toFixed(2)}** profit, **${todayOrders}** orders. All-time: **৳${totalRev.toFixed(0)}** revenue, **৳${totalProfit.toFixed(0)}** profit.`;
  }

  const why = bn
    ? `আজকের প্রফিট মার্জিন প্রায় **${todayMargin.toFixed(1)}%**, যা সামগ্রিক গড় মার্জিন (**${margin.toFixed(1)}%**) এর ${todayMargin > margin ? 'উচ্চতর' : 'নিম্নতর'}। গত ৭ দিনের গড় দৈনিক রেভিনিউ **৳${avg7Day.toFixed(2)}** (${last7Orders} অর্ডার) — আজকের পারফরম্যান্স ${todayRev >= avg7Day ? 'এর উপরে' : 'এর নিচে'}।`
    : `Today's margin is **${todayMargin.toFixed(1)}%** vs overall **${margin.toFixed(1)}%**. 7-day daily revenue average is **৳${avg7Day.toFixed(2)}** (${last7Orders} orders) — today is ${todayRev >= avg7Day ? 'above' : 'below'} that baseline.`;

  const recommendations = bn
    ? `১. **ইনভেন্টরি অপ্টিমাইজেশন:** Out-of-stock: ${outOfStock}। দ্রুত রিস্টক করুন।\n২. **কাস্টমার রি-এনগেজমেন্ট:** **${atRisk}** জন At-risk কাস্টমার (${unique} জনের মধ্যে) — টার্গেটেড অফার চালু করুন।\n৩. **লো-স্টক অ্যালার্ট:** Low-stock: ${lowStock} — স্টক পূর্ণ করুন।`
    : `1. **Inventory optimization:** Restock out-of-stock items (${outOfStock}).\n2. **Customer re-engagement:** **${atRisk}** of **${unique}** customers are at-risk — launch win-back offers.\n3. **Low-stock alert:** Replenish low-stock items (${lowStock}).`;

  return (
    '**The Numbers**\n' + numbers + '\n\n' +
    '**The \'Why\'**\n' + why + '\n\n' +
    '**Strategic Recommendation**\n' + recommendations
  );
}

function generateInsights(businessName, contextData, { apiKey, reportScope = 'full' } = {}) {
  const context = Object.assign({ business_name: businessName }, contextData || {});
  const totalRevenue = parseFloat(context.total_revenue || 0);
  const totalProfit = parseFloat(context.total_profit || 0);
  const aov = parseFloat(context.avg_order_value || 0);
  const uniqueCustomers = parseInt(context.unique_customers || 0, 10);
  const atRiskCustomers = parseInt(context.at_risk_customers || 0, 10);
  let margin = parseFloat(context.profit_margin_pct || 0);
  if (!margin && totalRevenue > 0) margin = (totalProfit / totalRevenue) * 100;
  context.profit_margin_pct = Math.round(margin * 10) / 10;

  const contextStr = _formatReportContext(context);
  const scopeInstruction = reportScope === 'daily'
    ? "This is a daily email report. Lead with today's performance, then briefly compare it to recent/all-time context where useful."
    : "This is a comprehensive full business report. Use all-time totals for overall health, today's figures for current momentum, and last-7-days data for recent trends. Never describe all-time totals as if they happened today.";

  const prompt = `You are a senior business consultant writing an AI analysis report for ${businessName}.

${scopeInstruction}

Use ONLY the business data below. Do not invent numbers, products, or customers.

Business data:
${contextStr}

Write a genuine strategic analysis with interpretation and recommendations.
Do NOT simply restate each metric in its own sentence.

Include in each language section:
- Overall business health and profit/margin assessment
- Today's performance vs broader totals (when today's data exists)
- Customer retention risk (especially the ${atRiskCustomers} at-risk customers)
- Inventory or operational concerns if relevant
- 2-3 specific, actionable recommendations for growth, profit, or retention

Write 6-8 sentences per language section.
Output only the two sections below. No reasoning, no bullet points, no markdown.

Bangla Section:
English Section:`;

  return callGemma(prompt, 4096, {
    purpose: 'generate_insights',
    timeout: 120000,
    thinkingLevel: 'MINIMAL',
    temperature: 0.65,
    apiKey,
  }).then(result => {
    if (result) return result;
    // Deterministic Bengali/English fallback (only when every provider fails)
    const marginBn = margin > 30 ? 'আপনার প্রফিট মার্জিন চমৎকার — বর্তমান কৌশল বজায় রাখুন।'
                       : margin > 15 ? 'প্রফিট মার্জিন সন্তোষজনক, তবে ডেলিভারি খরচ কমিয়ে আরও বাড়ানো সম্ভব।'
                       : 'প্রফিট মার্জিন কম — মূল্য পুনর্নির্ধারণ বা ডেলিভারি চার্জ পর্যালোচনা করুন।';
    const marginEn = margin > 30 ? 'Your profit margin is excellent — maintain your current strategy.'
                       : margin > 15 ? 'Profit margin is satisfactory, but can be improved by reducing delivery costs.'
                       : 'Profit margin is low — consider repricing or reviewing delivery charges.';
    const riskBn = atRiskCustomers > 0
      ? `⚠️ ${atRiskCustomers} জন কাস্টমার ৩০+ দিন ধরে ক্রয় করেননি — তাদের জন্য বিশেষ অফার চালু করুন।`
      : 'কাস্টমার রিটেনশন ভালো আছে — লয়্যালটি প্রোগ্রাম চালু করে এটি আরও শক্তিশালী করুন।';
    const riskEn = atRiskCustomers > 0
      ? `⚠️ ${atRiskCustomers} customers haven't purchased in 30+ days — send them a special win-back offer.`
      : 'Customer retention is strong — reinforce this by launching a loyalty program.';
    const todayRevenue = context.today_revenue != null ? parseFloat(context.today_revenue) : null;
    const todayProfit = context.today_profit != null ? parseFloat(context.today_profit) : 0;
    const todayOrders = context.today_orders != null ? parseInt(context.today_orders, 10) : 0;

    const revenueLineBn = (todayRevenue != null)
      ? `আজ ${businessName}-এর মোট রেভিনিউ ৳${todayRevenue.toFixed(0)} এবং নেট প্রফিট ৳${todayProfit.toFixed(0)}।`
      : `${businessName}-এর সর্বকালীন মোট রেভিনিউ ৳${totalRevenue.toFixed(0)} এবং নেট প্রফিট ৳${totalProfit.toFixed(0)}।`;
    const revenueLineEn = (todayRevenue != null)
      ? `Today, ${businessName} generated ৳${todayRevenue.toFixed(0)} in revenue with ৳${todayProfit.toFixed(0)} net profit across ${todayOrders} orders.`
      : `All-time, ${businessName} has generated ৳${totalRevenue.toFixed(0)} in revenue with ৳${totalProfit.toFixed(0)} net profit across ${parseInt(context.total_orders || 0, 10)} orders.`;

    return `**Bangla Section:**\n${revenueLineBn} ${marginBn} গড় অর্ডার ভ্যালু ৳${aov.toFixed(0)} — আপ-সেলিং ও বান্ডেল অফার দিয়ে এটি ৳${(aov * 1.2).toFixed(0)}-এ নিয়ে যাওয়ার লক্ষ্য রাখুন। মোট ${uniqueCustomers} জন ইউনিক কাস্টমারের মধ্যে ${atRiskCustomers} জন ঝুঁকিতে আছেন — ${riskBn}\n\n**English Section:**\n${revenueLineEn} ${marginEn} The average order value (AOV) is ৳${aov.toFixed(0)} — aim to increase this to ৳${(aov * 1.2).toFixed(0)} through up-selling and bundle offers. Among ${uniqueCustomers} unique customers, ${atRiskCustomers} are at risk — ${riskEn}`;
  });
}

function generateForecastInsights(businessName, forecastData, { apiKey } = {}) {
  const prompt = `You are a senior supply chain and business strategist for ${businessName}.
I have generated a 14-day demand forecast based on historical sales data.

Forecast Data:
${JSON.stringify(forecastData, null, 2)}

Please provide a concise, strategic analysis of this forecast.
Your analysis must include exactly two sections:

**Bangla Section:**
Write a 3-4 sentence summary in Bengali. Highlight expected revenue trends (e.g. growing or stable) and call out any specific products that are expected to sell well so the business can restock them.

**English Section:**
Write a 3-4 sentence summary in English covering the exact same points (revenue trends and top product restock warnings).`;

  return callGemma(prompt, 4096, { purpose: 'generate_forecast_insights', timeout: 120000, thinkingLevel: 'MINIMAL', temperature: 0.65, apiKey }).then(result => {
    if (result) return result;
    const daily = (forecastData && forecastData.daily_forecast) || [];
    const topProducts = (forecastData && forecastData.top_products_forecast) || [];
    const avgRev = daily.length ? daily.reduce((s, d) => s + (parseFloat(d.predicted_revenue) || 0), 0) / daily.length : 0;
    const totalPredicted = daily.reduce((s, d) => s + (parseFloat(d.predicted_revenue) || 0), 0);
    const names = topProducts.slice(0, 3).map(p => p.product_name).filter(Boolean);
    const namesStrBn = names.length ? names.join(', ') : 'শীর্ষ পণ্যগুলোর';
    const namesStrEn = names.length ? names.join(', ') : 'top products';
    return `**Bangla Section:**\n${businessName}-এর আগামী ১৪ দিনের পূর্বাভাস তৈরি করা হয়েছে। প্রতিদিন গড়ে প্রায় ৳${avgRev.toFixed(0)} রেভিনিউ আশা করা হচ্ছে (মোট ৳${totalPredicted.toFixed(0)})। দয়া করে ${namesStrBn}-এর স্টক চেক করুন যাতে স্টকের ঘাটতি না হয়।\n\n**English Section:**\nA 14-day forecast has been generated for ${businessName}. Expected average daily revenue is ৳${avgRev.toFixed(0)} (Total: ৳${totalPredicted.toFixed(0)}). Please review your stock levels for ${namesStrEn} to avoid stock-outs.`;
  });
}

function generateRestockPlan(businessName, planData, { apiKey } = {}) {
  const prompt = `You are a senior inventory and supply chain advisor for ${businessName}, a retail shop.
I have already computed the restock math from real sales data (30-day velocity, current stock, days of stock left, suggested order quantities). Do NOT recalculate or invent any numbers — use only the data below.

Restock Data:
${JSON.stringify(planData, null, 2)}

Write a practical weekly purchase plan for the shop owner.
Your answer must include exactly two sections:

**Bangla Section:**
Write 3-5 sentences in Bengali. Tell the owner exactly which products to buy this week and roughly how many units (use the suggested_order_qty values), warn about any product that will stock out within a few days, and tell them which products to SKIP buying because they have plenty of stock or are not selling.

**English Section:**
Write 3-5 sentences in English covering the same points: what to buy this week (with quantities), the most urgent stockout risks, and what to skip. If a total budget estimate exists, mention it.`;

  return callGemma(prompt, 4096, { purpose: 'generate_restock_plan', timeout: 120000, thinkingLevel: 'MINIMAL', temperature: 0.6, apiKey }).then(result => {
    if (result) return result;
    const items = (planData && planData.plan) || [];
    const buyItems = items.filter(i => (parseInt(i.suggested_order_qty || 0, 10) > 0)).slice(0, 3);
    const skipItems = items.filter(i => (parseInt(i.suggested_order_qty || 0, 10) === 0)).slice(0, 2);
    const buyBn = buyItems.length ? buyItems.map(i => `${i.name} (${i.suggested_order_qty} পিস)`).join(', ') : 'কিছু নেই';
    const buyEn = buyItems.length ? buyItems.map(i => `${i.name} (${i.suggested_order_qty} units)`).join(', ') : 'nothing';
    const skipEn = skipItems.map(i => i.name).join(', ');
    const totalCost = (planData && planData.totals && planData.totals.total_cost) || 0;
    const skipBnLine = skipItems.length ? ` পর্যাপ্ত স্টক থাকায় ${skipEn} এখন কেনার দরকার নেই।` : '';
    const skipEnLine = skipItems.length ? ` Skip ${skipEn} for now — you have enough stock.` : '';
    return `**Bangla Section:**\nএই সপ্তাহে ${businessName}-এর জন্য রিস্টক পরিকল্পনা তৈরি করা হয়েছে। বিক্রির গতি অনুযায়ী এখন কেনা দরকার: ${buyBn}। আনুমানিক মোট খরচ ৳${totalCost.toFixed(0)}।${skipBnLine}\n\n**English Section:**\nA weekly restock plan has been generated for ${businessName}. Based on your sales velocity, buy now: ${buyEn}. Estimated total purchase budget: ৳${totalCost.toFixed(0)}.${skipEnLine}`;
  });
}

function generatePLSummary(businessName, plData, apiKey) {
  const prompt = `You are a professional financial controller for ${businessName}.\nAnalyze this Profit & Loss statement data:\n- Period: ${plData.period || 'Unknown'}\n- Gross Revenue: ${plData.gross_revenue || 0}\n- Total COGS: ${plData.total_cogs || 0}\n- Delivery Costs: ${plData.delivery_costs || 0}\n- Gross Profit: ${plData.gross_profit || 0}\n- Total Operating Expenses: ${plData.total_opex || 0}\n- Net Profit: ${plData.net_profit || 0}\n\nWrite a single, formal paragraph (3-4 sentences) summarizing the financial performance. Mention the gross margin and net margin if possible. Highlight the biggest takeaway regarding profitability. Do not use bullet points or conversational pleasantries. Write strictly in a professional, executive tone.`;
  return callGemma(prompt, 250, { purpose: 'pl_summary', timeout: 120000, thinkingLevel: 'MINIMAL', temperature: 0.7, apiKey }).then(r => r || 'Profit & Loss data generated successfully. Financial summary unavailable at this time.');
}

function generateMonthlyExecutiveSummary(businessName, monthStr, reportData, apiKey) {
  const prompt = `You are a professional business analyst writing an executive summary for the investors and partners of ${businessName}.\nI have generated the business report for the month of ${monthStr}.\n\nReport Data:\n${JSON.stringify(reportData, null, 2)}\n\nPlease write a concise, formal executive summary (3-5 sentences). Highlight the total revenue, net profit margin, and key performing products. Keep the tone professional, objective, and encouraging.\nDo not use formatting like bold or headers. Just return plain paragraph text.`;
  return callGemma(prompt, 4096, { purpose: 'generate_monthly_executive_summary', timeout: 120000, thinkingLevel: 'MINIMAL', temperature: 0.7, apiKey }).then(r => {
    if (r) return r.replace(/\*\*/g, '').trim();
    const rev = parseFloat(reportData.total_revenue || 0);
    const profit = parseFloat(reportData.net_profit || 0);
    return `In ${monthStr}, ${businessName} recorded a total revenue of ৳${rev.toFixed(0)} and a net profit of ৳${profit.toFixed(0)}. The business maintained a steady operational pace throughout the month, supported by consistent sales across top-performing product categories. We are well-positioned to leverage this momentum going forward.`;
  });
}

function answerQuery(businessName, question, contextData, apiKey) {
  const contextStr = _formatContextForPrompt(contextData || {});
  const q = (question || '').trim();
  const prompt = `You are an elite Business Analyst and Chief Strategy AI for ${businessName}.\nYou power "Ask Anything About Your Sales". Always deliver a structured executive briefing.\n\nDATA (use ONLY these facts — never invent numbers):\n${contextStr}\n\nRULES:\n- Cross-functional: link sales, customers, products/inventory, and investments in every answer.\n- Bold every key metric and BDT amount with ** (example: **৳17,500.00**, **4টি**, **94%**).\n- For today's questions use today's fields; compare against last-7-days averages and all-time margin where relevant.\n- Proactively mention at-risk customers, out-of-stock, and low-stock items when the data supports it.\n- If CLV/CAC/churn are unavailable, note the gap briefly in The 'Why' section.\n\nLANGUAGE:\n- If the question is in Bangla: keep headings in English exactly as below, write all body text in Bangla. You may include English business terms in parentheses (Revenue, At-risk, AOV).\n- If the question is in English: write everything in English.\n\nREQUIRED FORMAT — always output exactly these three sections:\n\n**The Numbers**\n[2-4 sentences answering the question directly. Bold all figures.]\n\n**The 'Why'**\n[One analytical paragraph connecting today's performance to 7-day trends, profit margin vs overall margin (${(contextData && contextData.profit_margin_pct) || 'n/a'}%), inventory, and customer retention.]\n\n**Strategic Recommendation**\n[Exactly 2-3 numbered action items. For Bangla use ১. ২. ৩. Each item starts with a **bold action title** followed by specific advice referencing real data from the dataset.]\n\nUser question: ${q}\n\nAnswer:`;

  return callGemma(prompt, 2048, { purpose: 'answer_query', timeout: 90000, thinkingLevel: 'MINIMAL', temperature: 0.35, apiKey }).then(result => {
    if (result) return result;
    return _buildStructuredFallback(businessName, q, contextData || {});
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
