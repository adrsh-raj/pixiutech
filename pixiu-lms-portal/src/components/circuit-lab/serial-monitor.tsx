import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Terminal, Trash2, Clock, ChevronDown, ChevronUp, SendHorizontal, X } from 'lucide-react';

export interface SerialLine {
  text: string;
  timestamp: number;
  type: 'output' | 'input' | 'system';
}

interface Props {
  lines: SerialLine[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  onSend: (text: string) => void;
}

export const SerialMonitor: React.FC<Props> = ({
  lines,
  isOpen,
  onToggle,
  onClear,
  onSend,
}) => {
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, isOpen]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${date.toLocaleTimeString([], { hour12: false })}.${ms}`;
  };

  return (
    <div
      className={`
        ${!isOpen ? 'hidden md:flex' : 'fixed inset-x-0 bottom-0 md:bottom-[24px] z-50 md:z-40'}
        left-0 right-0 bg-slate-900 border-t border-slate-800 transition-all duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none
        ${isOpen ? 'h-[280px] md:h-[240px] rounded-t-2xl md:rounded-none' : 'h-0 md:h-[36px]'}
      `}
    >
      {/* Header */}
      <div
        className="h-[36px] min-h-[36px] bg-slate-800/80 border-b border-slate-700/50 flex items-center justify-between px-4 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold tracking-wide">Serial Monitor</span>
          {isOpen && (
            <span className="text-xs text-slate-500 ml-4 font-mono">9600 baud</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {isOpen && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTimestamps(!showTimestamps);
                }}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  showTimestamps ? 'bg-slate-700 text-slate-200' : 'hover:bg-slate-700/50 text-slate-400'
                }`}
                title="Toggle timestamps"
              >
                <Clock size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Clear output"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            title={isOpen ? "Close Serial Monitor" : "Open Serial Monitor"}
          >
            {isOpen ? <X size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <>
          {/* Scrollable log area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-2 font-mono text-[13px] leading-relaxed bg-slate-950"
          >
            {lines.length === 0 ? (
              <div className="text-slate-600 italic text-center mt-4">Waiting for serial data...</div>
            ) : (
              lines.map((line, idx) => (
                <div key={idx} className="flex gap-3 hover:bg-slate-900/50 px-2 py-0.5 rounded">
                  {showTimestamps && (
                    <span className="text-slate-500 select-none shrink-0">
                      [{formatTimestamp(line.timestamp)}]
                    </span>
                  )}
                  <span
                    className={`break-all ${
                      line.type === 'output'
                        ? 'text-emerald-400'
                        : line.type === 'input'
                        ? 'text-cyan-400'
                        : 'text-amber-400' // system
                    }`}
                  >
                    {line.text}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Input area */}
          <div className="h-[44px] min-h-[44px] bg-slate-900 border-t border-slate-800 p-2 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type to send..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1 text-sm font-mono text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-slate-300 rounded-md transition-colors flex items-center justify-center"
            >
              <SendHorizontal size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
