import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Activity, Terminal, Trash2, Clock, ChevronDown, ChevronUp, SendHorizontal, X } from 'lucide-react';
import { SerialPlotter } from './serial-plotter';

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
  const [activeView, setActiveView] = useState<'monitor' | 'plotter'>('monitor');
  const [inputValue, setInputValue] = useState('');
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [maxPanelHeight, setMaxPanelHeight] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateMaxHeight = () => {
      const nextMax = Math.max(180, Math.min(window.innerHeight - 88, Math.floor(window.innerHeight * 0.82)));
      setMaxPanelHeight(nextMax);
      setPanelHeight((current) => current === null ? null : Math.min(current, nextMax));
    };
    updateMaxHeight();
    window.addEventListener("resize", updateMaxHeight);
    return () => window.removeEventListener("resize", updateMaxHeight);
  }, []);

  const getDefaultPanelHeight = () => (typeof window !== "undefined" && window.innerWidth >= 768 ? 240 : 280);
  const stopResize = () => {
    resizeStartRef.current = null;
    setIsResizing(false);
  };
  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Home") {
      event.preventDefault();
      setPanelHeight(null);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setPanelHeight(maxPanelHeight || Math.floor(window.innerHeight * 0.82));
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const currentHeight = panelHeight ?? getDefaultPanelHeight();
      const direction = event.key === "ArrowUp" ? 1 : -1;
      const maxHeight = maxPanelHeight || Math.floor(window.innerHeight * 0.82);
      setPanelHeight(Math.max(180, Math.min(maxHeight, currentHeight + direction * (event.shiftKey ? 80 : 24))));
    }
  };

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
      ref={panelRef}
      style={isOpen ? { ...(panelHeight !== null ? { height: panelHeight + "px" } : {}), maxHeight: maxPanelHeight ? maxPanelHeight + "px" : undefined } : undefined}
      className={`
        ${!isOpen ? 'hidden md:flex' : 'fixed inset-x-0 bottom-0 md:bottom-[24px] z-50 md:z-40'}
        left-0 right-0 max-h-[82vh] bg-slate-900 border-t border-slate-800 transition-all duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none
        ${isResizing ? '!transition-none' : ''}
        ${isOpen ? 'h-[280px] md:h-[240px] rounded-t-2xl md:rounded-none' : 'h-0 md:h-[36px]'}
      `}
    >
      {isOpen && (
        <div
          role="separator"
          aria-label="Resize Serial Monitor"
          aria-orientation="horizontal"
          aria-valuemin={180}
          aria-valuemax={maxPanelHeight || undefined}
          aria-valuenow={Math.round(panelRef.current?.getBoundingClientRect().height ?? panelHeight ?? getDefaultPanelHeight())}
          tabIndex={0}
          className="group relative z-10 flex h-3 min-h-3 cursor-row-resize touch-none items-center justify-center bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const height = panelRef.current?.getBoundingClientRect().height ?? getDefaultPanelHeight();
            resizeStartRef.current = { startY: event.clientY, startHeight: height };
            setIsResizing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = resizeStartRef.current;
            if (!start) return;
            const maxHeight = maxPanelHeight || Math.floor(window.innerHeight * 0.82);
            setPanelHeight(Math.max(180, Math.min(maxHeight, start.startHeight + start.startY - event.clientY)));
          }}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onLostPointerCapture={stopResize}
          onKeyDown={handleResizeKeyDown}
          title="Drag upward to enlarge; use arrow keys, Home to restore, or End to expand"
        >
          <span className="h-1 w-10 rounded-full bg-slate-600 transition-colors group-hover:bg-cyan-400 group-focus-visible:bg-cyan-400" />
        </div>
      )}

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
                  const defaultHeight = getDefaultPanelHeight();
                  const currentHeight = panelRef.current?.getBoundingClientRect().height ?? panelHeight ?? defaultHeight;
                  const maxHeight = maxPanelHeight || Math.floor(window.innerHeight * 0.82);
                  setPanelHeight(currentHeight >= maxHeight - 32 ? null : maxHeight);
                }}
                className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={panelHeight !== null && panelHeight > getDefaultPanelHeight() ? "Restore default panel height" : "Expand Serial Monitor"}
                aria-label={panelHeight !== null && panelHeight > getDefaultPanelHeight() ? "Restore default Serial Monitor height" : "Expand Serial Monitor"}
              >
                {panelHeight !== null && panelHeight > getDefaultPanelHeight() ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
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

      {/* Instrument views */}
      {isOpen && (
        <div role="tablist" aria-label="Serial tools" className="flex h-8 min-h-8 items-center gap-1 border-b border-slate-800 bg-slate-900 px-2">
          <button type="button" role="tab" aria-selected={activeView === 'monitor'} onClick={() => setActiveView('monitor')} className={`rounded-md px-3 py-1 text-[10px] font-semibold transition ${activeView === 'monitor' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-200'}`}>
            Monitor
          </button>
          <button type="button" role="tab" aria-selected={activeView === 'plotter'} onClick={() => setActiveView('plotter')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[10px] font-semibold transition ${activeView === 'plotter' ? 'bg-cyan-500/15 text-cyan-200' : 'text-slate-500 hover:text-slate-200'}`}>
            <Activity size={12} /> Plotter
          </button>
          {activeView === 'plotter' && <span className="ml-auto text-[9px] text-slate-500">Live numeric output</span>}
        </div>
      )}

      {/* Content */}
      {isOpen && activeView === 'plotter' && (
        <div role="tabpanel" className="min-h-0 flex-1 p-2 sm:p-3">
          <SerialPlotter lines={lines} />
        </div>
      )}

      {isOpen && activeView === 'monitor' && (
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
