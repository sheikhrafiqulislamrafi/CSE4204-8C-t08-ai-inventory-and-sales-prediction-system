import { useState, useRef, useEffect } from 'react';
import {
  BrainCircuit,
  Send,
  Trash2,
  Bot,
  User,
  Sparkles,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

const EXAMPLE_QUESTIONS = [
  "What is today's total profit?",
  "What is my average order value?",
  "How many total orders do I have?",
  "আজকের মোট সেলস কত?",
  "How many at-risk customers do I have?",
];

function renderAiMessage(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function Insights({ user, onLogout }) {

  const [insights, setInsights] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');


  const [chat, setChat] = useState([]);
  const [question, setQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, chatLoading]);

  async function generateInsights() {
    setInsightsLoading(true);
    setInsightsError('');
    setInsights('');
    try {
      const data = await api.ai.insights();
      setInsights(data.insights || '');
    } catch (err) {
      setInsightsError(err.message);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function sendQuestion(overrideQuestion) {
    const text = (overrideQuestion ?? question).trim();
    if (!text || chatLoading) return;
    setQuestion('');
    setChatLoading(true);
    setChat((prev) => [...prev, { role: 'user', text }]);
    try {
      const data = await api.ai.query(text);
      setChat((prev) => [
        ...prev,
        { role: 'ai', text: data.answer || 'No response received.' },
      ]);
    } catch (err) {
      setChat((prev) => [
        ...prev,
        { role: 'ai', text: `Error: ${err.message}`, isError: true },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuestion();
    }
  }

  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area">
        {}
        <div className="page-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <BrainCircuit size={28} color="#8b5cf6" />
            AI Business Intelligence
          </h1>
          <p>Powered by Gemma 4 — Analyze your sales data in Bengali &amp; English</p>
        </div>

        {}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="section-title">
            <Sparkles size={18} color="#8b5cf6" />
            Generate Full Report
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Let Gemma 4 analyze all your sales data and generate a comprehensive business performance
            report including Bengali insights.
          </p>

          <button
            className="btn btn-purple"
            onClick={generateInsights}
            disabled={insightsLoading}
            style={{ marginBottom: insights || insightsError ? '1.5rem' : 0 }}
          >
            {insightsLoading ? (
              <span className="loading-dots">
                <BrainCircuit size={16} />
                &nbsp;Gemma 4 is analyzing your data<span>.</span><span>.</span><span>.</span>
              </span>
            ) : (
              <><BrainCircuit size={16} /> Generate Full Report</>
            )}
          </button>

          {insightsError && (
            <div className="error-message">{insightsError}</div>
          )}

          {insights && (
            <div
              style={{
                borderLeft: '3px solid #8b5cf6',
                paddingLeft: '1.25rem',
              }}
            >
              <p
                style={{
                  color: '#c084fc',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '0.875rem',
                }}
              >
                AI Analysis Report
              </p>
              <p
                style={{
                  color: '#e2e8f0',
                  lineHeight: 1.9,
                  whiteSpace: 'pre-line',
                  fontSize: '0.95rem',
                }}
              >
                {insights}
              </p>
            </div>
          )}
        </div>

        {}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          {}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div className="section-title" style={{ marginBottom: 0 }}>
              <Bot size={18} color="#60a5fa" />
              Ask Anything About Your Sales
            </div>
            {chat.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setChat([])}>
                <Trash2 size={14} /> Clear Chat
              </button>
            )}
          </div>

          {chat.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Ask any question about your business data in plain language. Try the examples below or
              type your own question.
            </p>
          )}

          {}
          {chat.length > 0 && (
            <div className="chat-container" style={{ marginBottom: '1rem' }}>
              {chat.map((msg, i) => (
                <div key={i} className={`chat-message ${msg.role}`}>
                  {msg.role === 'ai' && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(139,92,246,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Bot size={16} color="#c084fc" />
                    </div>
                  )}
                  <div
                    className={`chat-bubble ${msg.role}`}
                    style={
                      msg.isError
                        ? { color: '#f87171' }
                        : msg.role === 'ai'
                          ? { whiteSpace: 'pre-line', lineHeight: 1.85 }
                          : {}
                    }
                  >
                    {msg.role === 'ai' && !msg.isError ? renderAiMessage(msg.text) : msg.text}
                  </div>
                  {msg.role === 'user' && (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(59,130,246,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <User size={16} color="#60a5fa" />
                    </div>
                  )}
                </div>
              ))}

              {}
              {chatLoading && (
                <div className="chat-message ai">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(139,92,246,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} color="#c084fc" />
                  </div>
                  <div className="chat-bubble ai">
                    <span className="loading-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {}
          <div className="chat-input-row">
            <input
              className="form-input chat-input"
              placeholder="e.g., What was today's profit? Which customer spent the most?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatLoading}
            />
            <button
              className="btn btn-primary"
              onClick={() => sendQuestion()}
              disabled={!question.trim() || chatLoading}
              style={{ padding: '0.625rem 1rem', flexShrink: 0 }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>

        {}
        <div>
          <div className="section-title">
            <Sparkles size={18} color="#fbbf24" />
            Example Questions — Click to Ask
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
            }}
          >
            {EXAMPLE_QUESTIONS.map((q, i) => (
              <button
                key={i}
                className="glass-card"
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  padding: '1.25rem',
                  background: 'var(--glass-bg)',
                  border: 'var(--glass-border)',
                  transition: 'all 0.2s',
                  width: '100%',
                }}
                onClick={() => sendQuestion(q)}
                disabled={chatLoading}
              >
                <p
                  style={{
                    color: '#60a5fa',
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.5rem',
                  }}
                >
                  Quick Question
                </p>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {q}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
