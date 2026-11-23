import { useState, useRef, useEffect } from 'react';
import { Send, Square, RotateCcw, Trash2, Check, Copy, AlertTriangle, ShieldCheck, Sparkles, Terminal, Cpu } from 'lucide-react';
import { createXenRequestLifecycle, sendXenChat, sanitizeClientOutput, fetchXenStatus } from '../../lib/ai/xen/xen-client.js';

export function XenChat({ userRole = 'student', isA05Qualified = false }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am PixiuMind Xen, your specialized STEM and AI programming tutor. How can I assist your learning today?',
      isComplete: true,
      displayAstValid: true,
      tested: false,
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [intent, setIntent] = useState(
    userRole === 'trainer' ? 'TEACHING' : userRole === 'student' ? 'STUDENT_LEARNING' : 'TEACHING_REVIEW'
  );
  const [status, setStatus] = useState('idle'); // idle | generating | cancelled | error
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [workerStatus, setWorkerStatus] = useState({ online: true, activeWorkers: 0, checked: false });
  const [queueInfo, setQueueInfo] = useState({ status: '', queuePosition: 0 });

  const [requests] = useState(createXenRequestLifecycle);
  const messagesEndRef = useRef(null);

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

  const handleSend = async (retry = false) => {
    const userText = inputPrompt.trim();
    if (!retry && !userText) return;

    const attempt = requests.begin(retry ? null : {
      prompt: userText,
      intent,
      history: messages.slice(1).filter((message) => !message.isCancelled).slice(-10)
        .map(({ role, content }) => ({ role, content })),
    });
    if (!attempt) return;
    setInputPrompt('');
    setErrorMessage('');
    setQueueInfo({ status: 'queued', queuePosition: 1 });

    if (!retry) setMessages([...messages, { role: 'user', content: userText }]);
    setStatus('generating');

    const result = await sendXenChat({
      ...attempt,
      onStatusUpdate: (info) => setQueueInfo(info),
    });
    requests.finish(result.success);

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
        requestId: result.requestId,
      },
    ]);
    setStatus('idle');
  };

  const handleCancel = () => requests.cancel();

  const handleRetry = () => void handleSend(true);

  const handleClear = () => {
    requests.clear();
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
    // Client-side defense: Never permit <|im_end|> into the DOM
    const safeContent = sanitizeClientOutput(msg.content);
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(safeContent)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: safeContent.slice(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'python',
        code: match[2],
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < safeContent.length) {
      parts.push({
        type: 'text',
        content: safeContent.slice(lastIndex),
      });
    }

    if (parts.length === 0) {
      parts.push({ type: 'text', content: safeContent });
    }

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
              PixiuMind Xen Tutor
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                Step-700
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
              <span>{m.role === 'user' ? 'You' : 'PixiuMind Xen'}</span>
              {m.requestId && (
                <span className="font-mono text-slate-600">[{m.requestId}]</span>
              )}
            </div>
          </div>
        ))}

        {status === 'generating' && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs py-2 px-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 w-fit">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            {queueInfo.status === 'queued'
              ? `Queued in job queue (position #${queueInfo.queuePosition || 1})... waiting for Kaggle GPU worker.`
              : queueInfo.status === 'claimed' || queueInfo.status === 'running'
              ? 'Processing on Kaggle GPU (Dual Tesla T4)...'
              : 'Generating response with Step-700...'}
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
