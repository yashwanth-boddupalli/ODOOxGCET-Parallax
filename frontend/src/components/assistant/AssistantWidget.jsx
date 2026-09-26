import React, { useEffect, useRef, useState } from 'react';
import { Bot, Database, RotateCcw, Send, Sparkles, Warehouse, X } from 'lucide-react';
import { useWorkspace } from '../../app/useWorkspace';
import { useAuth } from '../../auth/useAuth';
import { askAssistant } from '../../api/assistant';
import { initialsOf } from '../../lib/format';
import { Markdown } from './Markdown';

const SUGGESTIONS = [
  'What’s running low right now?',
  'Summarise today’s receipts and deliveries',
  'Which products sold fastest this month?',
  'How full is each warehouse?',
  'Which deliveries are waiting for stock?',
  'What happened to Steel Rod 12mm this week?',
];

const Typing = () => (
  <div className="ai-msg assistant">
    <div className="ai-avatar bot"><Bot size={15} /></div>
    <div className="ai-bubble typing">
      <span className="ai-dots" aria-hidden="true"><i /><i /><i /></span>
      Checking live data…
    </div>
  </div>
);

export const AssistantWidget = () => {
  const { activeWarehouse, warehouseId } = useWorkspace();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Keep the newest message in view.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const send = async (text) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages.filter((m) => !m.error), { role: 'user', content: question }];
    setMessages([...messages, { role: 'user', content: question }]);
    setInput('');
    setBusy(true);
    try {
      const res = await askAssistant(history, warehouseId);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, steps: res.steps }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  if (!open) {
    return (
      <button className="ai-launcher" onClick={() => setOpen(true)} aria-label="Open StockSense AI assistant">
        <Sparkles size={20} />
        <span>Ask AI</span>
      </button>
    );
  }

  return (
    <section className="ai-panel" role="dialog" aria-label="StockSense AI assistant">
      <header className="ai-header">
        <div className="ai-header-main">
          <div className="ai-header-icon"><Sparkles size={17} /></div>
          <div style={{ minWidth: 0 }}>
            <h3>StockSense AI</h3>
            <span className="ai-scope">
              <Warehouse size={12} /> {activeWarehouse ? activeWarehouse.name : 'All warehouses'} · live data
            </span>
          </div>
        </div>
        <div className="ai-header-actions">
          {messages.length > 0 && (
            <button className="ai-icon-btn" onClick={() => setMessages([])} title="New chat" aria-label="Start a new chat" disabled={busy}>
              <RotateCcw size={15} />
            </button>
          )}
          <button className="ai-icon-btn" onClick={() => setOpen(false)} title="Close" aria-label="Close assistant">
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="ai-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="ai-welcome">
            <div className="ai-welcome-icon"><Bot size={26} /></div>
            <h4>Hi{profile?.fullName ? ` ${profile.fullName.split(' ')[0]}` : ''}, what do you want to know?</h4>
            <p>I read your inventory as it is right now — stock, receipts, deliveries, transfers, the ledger and analytics.</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ai-suggestion" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            {m.role === 'assistant' ? (
              <div className="ai-avatar bot"><Bot size={15} /></div>
            ) : (
              <div className="ai-avatar user">{initialsOf(profile?.fullName)}</div>
            )}
            <div className="ai-bubble-wrap">
              <div className={`ai-bubble ${m.error ? 'error' : ''}`}>
                {m.role === 'assistant' && !m.error ? <Markdown text={m.content} /> : m.content}
              </div>
              {m.steps?.length > 0 && (
                <div className="ai-steps">
                  {m.steps.map((s, j) => (
                    <span key={j} className={`ai-step ${s.ok ? '' : 'failed'}`} title={s.tool}>
                      <Database size={11} /> {s.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <Typing />}
      </div>

      <form
        className="ai-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          placeholder="Ask about stock, orders, warehouses…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={2000}
          aria-label="Your question"
        />
        <button type="submit" className="ai-send" disabled={!input.trim() || busy} aria-label="Send">
          <Send size={16} />
        </button>
      </form>
      <div className="ai-footnote">Read-only · sees only what your account can see · answers can be wrong, check key numbers</div>
    </section>
  );
};
