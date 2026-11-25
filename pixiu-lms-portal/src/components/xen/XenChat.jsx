import { useState, useRef, useEffect } from 'react';
import { Send, Square, RotateCcw, Trash2, Check, Copy, AlertTriangle, ShieldCheck, Sparkles, Terminal, Cpu } from 'lucide-react';
import { createXenRequestLifecycle, streamXenChat, sanitizeClientOutput, fetchXenStatus } from '../../lib/ai/xen/xen-client.js';

import { splitXenResponse } from '../../lib/ai/xen/xen-sanitizer.js';

export function XenChat({ userRole = 'student', isA05Qualified = false }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm 8square, your AI tutor for computational thinking, STEM and programming. I'm powered by Xen. What would you like to explore today?",
      isComplete: true,
      displayAstValid: true,
      tested: false,
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [intent, setIntent] = useState(
    userRole === 'trainer' || userRole === 'student' ? 'TEACHING' : 'TEACHING_REVIEW'
  );
  const [status, setStatus] = useState('idle'); // idle | generating | cancelled | error
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [stickyFormatPreference, setStickyFormatPreference] = useState(null);
  const [workerStatus, setWorkerStatus] = useState({ online: true, activeWorkers: 0, checked: false });
  const [queueInfo, setQueueInfo] = useState({ status: '', queuePosition: 0, workerAvailable: true });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [requests] = useState(createXenRequestLifecycle);
  const messagesEndRef = useRef(null);
  useEffect(() => () => requests.cancel(), [requests]);

  useEffect(() => {
    if (status !== 'generating') {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    let isMounted = true;
    async function checkStatus() {
      const res = await fetchXenStatus();
      if (isMounted && res.success) {
        setWorkerStatus({
          online: Boolean(res.workerOnline),
          activeWorkers: res.activeWorkerCount || 0,
          checked: true,
        });
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status, queueInfo]);

  const buildCleanHistory = (list) => {
    const cleaned = [];
    for (const msg of list.slice(1)) {
      if (msg.isCancelled || msg.partialId) continue;
      if (msg.role === 'user' && cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
        // Replace unanswered user turn cleanly to prevent consecutive user turns
        cleaned[cleaned.length - 1] = { role: 'user', content: msg.content };
      } else {
        cleaned.push({ role: msg.role, content: msg.content });
      }
    }
    return cleaned.slice(-10);
  };

  const handleSend = async (retry = false) => {
    const userText = inputPrompt.trim();
    if (!retry && !userText) return;

    const attempt = requests.begin(retry ? null : {
      prompt: userText,
      intent,
      formatPreference: stickyFormatPreference,
      history: buildCleanHistory(messages),
    });
    if (!attempt) return;
    setInputPrompt('');
    setErrorMessage('');
    setQueueInfo({ status: 'queued', queuePosition: 1, workerAvailable: workerStatus.online });

    setMessages((prev) => {
      const base = prev.filter((m) => !m.isCancelled);
      return retry ? base : [...base, { role: 'user', content: userText }];
    });
    setStatus('generating');

    const partialId = attempt.idempotencyKey;
    const result = await streamXenChat({
      ...attempt,
      onChunk: (_, content) => setMessages(prev => {
        const partial = { role: 'assistant', content, partialId };
        return [...prev.filter(message => message.partialId !== partialId), partial];
      }),
      onStatusUpdate: (info) => setQueueInfo(info),
    });
    requests.finish(result.success);
    setMessages(prev => prev.filter(message => message.partialId !== partialId));

    if (attempt.signal.aborted) {
      setStatus('cancelled');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Generation cancelled by user.',
          isComplete: false,
          isCancelled: true,
        },
      ]);
      return;
    }

    if (!result.success) {
      setStatus('error');
      const traceSuffix = result.error?.requestId ? ` (Ref: ${result.error.requestId})` : '';
      setErrorMessage(`${result.error?.message || 'Failed to communicate with Xen AI.'}${traceSuffix}`);
      return;
    }

    const resp = result.response;
    const cleanOutput = sanitizeClientOutput(resp.text);
    const resolvedFormatMode = result.formatMode || 'DEFAULT_EDUCATIONAL';

    if (resolvedFormatMode === 'CODE_ONLY') {
      setStickyFormatPreference('CODE_ONLY');
    } else if (resolvedFormatMode === 'CODE_AND_EXPLANATION' || resolvedFormatMode === 'OUTPUT_ONLY') {
      setStickyFormatPreference(resolvedFormatMode);
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: cleanOutput,
        isComplete: resp.is_complete,
        completionStatus: resp.completion_status,
        syntaxValid: resp.syntax_valid,
        displayAstValid: resp.display_ast_valid,
        tested: resp.tested,
        formatMode: resolvedFormatMode,
        formatValid: resp.format_valid,
        requestId: result.requestId,
      },
    ]);
    setStatus('idle');
  };

  const handleCancel = () => requests.cancel();

  const handleRetry = () => void handleSend(true);

  const handleClear = () => {
    requests.clear();
    setStickyFormatPreference(null);
    setMessages([
      {
        role: 'assistant',
        content: 'Conversation cleared. How can I help you today?',
        isComplete: true,
        displayAstValid: true,
        tested: false,
      },
    ]);
    setStatus('idle');
    setErrorMessage('');
  };

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderMessageContent = (msg, msgIdx) => {
    const parts = splitXenResponse(msg.content);
    return (
      <div className="space-y-3">
        {parts.map((p, pIdx) => {
          if (p.type === 'text') {
            return (
              <p key={pIdx} className="whitespace-pre-wrap leading-relaxed text-sm">
                {p.content}
              </p>
            );
          }
          const blockKey = `${msgIdx}-${pIdx}`;
          return (
            <div key={pIdx} className="my-2 rounded-xl border border-slate-700 bg-slate-950 overflow-hidden text-xs">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-400">
                <span className="font-mono uppercase font-semibold text-[10px] tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  {p.language}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(p.code, blockKey)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                >
                  {copiedIndex === blockKey ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto font-mono text-cyan-200 bg-slate-950 leading-5">
                <code>{p.code}</code>
              </pre>

              {/* Status and Verification Badges */}
              {/* Suppressed in CODE_ONLY mode to maintain clean code presentation (Part 10) */}
              {msg.formatMode !== 'CODE_ONLY' && (
                <div className="px-3 py-1.5 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px]">
                  {msg.isComplete && msg.displayAstValid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Syntax Valid (AST Verified)
                    </span>
                  ) : !msg.isComplete ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Incomplete Generation (Truncated)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Syntax Error Detected
                    </span>
                  )}

                  <span className="text-slate-500 font-mono">
                    {msg.tested ? 'Runtime Verified' : 'Static Syntax Only'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[700px] w-full max-w-4xl mx-auto rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              8square
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Xen Step-700
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">Role: <span className="text-slate-200 capitalize">{userRole}</span></p>
          </div>
        </div>

        {/* Intent Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="intent-select" className="text-xs text-slate-400">Intent:</label>
          <select
            id="intent-select"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            disabled={status === 'generating'}
            className="text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-200 px-2.5 py-1 focus:outline-none focus:border-cyan-500"
          >
            {userRole === 'trainer' ? (
              <>
                <option value="TEACHING">Teaching Scaffolding</option>
                <option value="LAB_TEACHING">Lab Session Guidance</option>
                {isA05Qualified && <option value="PERSONAL_LEARNING">Personal Learning (A05)</option>}
              </>
            ) : userRole === 'student' ? (
              <>
                <option value="TEACHING">Guided Learning</option>
                <option value="CIRCUIT_TUTORING">Circuit Tutoring</option>
              </>
            ) : (
              <>
                <option value="TEACHING_REVIEW">Teaching Review</option>
                <option value="ADMIN_INSPECTION">Admin Inspection</option>
              </>
            )}
          </select>

          <button
            type="button"
            onClick={handleClear}
            disabled={status === 'generating'}
            title="Clear conversation"
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GPU Worker Vitality Banner */}
      {workerStatus.checked && !workerStatus.online && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/40 border-b border-amber-800/40 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>GPU Worker Offline: Prompts will be queued until a Kaggle GPU worker session is active.</span>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-cyan-600 text-white rounded-br-sm'
                  : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-bl-sm shadow-md'
              }`}
            >
              {renderMessageContent(m, idx)}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 px-1">
              <span>{m.role === 'user' ? 'You' : '8square'}</span>
              {m.requestId && (
                <span className="font-mono text-slate-600">[{m.requestId}]</span>
              )}
            </div>
          </div>
        ))}

        {status === 'generating' && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs py-2 px-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 w-fit">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{queueInfo.message || 'Sending request…'}</span>
            {elapsedSeconds > 0 && (
              <span className="font-mono text-[10px] text-cyan-300/80">({elapsedSeconds}s)</span>
            )}
          </div>
        )}

        {(status === 'error' || status === 'cancelled') && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{status === 'cancelled' ? 'Request cancelled. Retry to check the same request.' : errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1 font-semibold hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <div className="flex items-end gap-2">
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question about Python, Arduino, or algorithms..."
            rows={2}
            maxLength={4000}
            disabled={status === 'generating'}
            className="flex-1 resize-none rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />

          {status === 'generating' ? (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!inputPrompt.trim()}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          )}
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5 px-1">
          Press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[9px]">Shift+Enter</kbd> for newline.
        </p>
      </div>
    </div>
  );
}
