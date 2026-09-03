import React, { useState, useEffect } from 'react';
import { Cpu, Cable, ZoomIn, Circle, Save } from 'lucide-react';

interface Props {
  partCount: number;
  wireCount: number;
  zoom: number;
  running: boolean;
  runTime: number; // seconds since simulation started
  totalCurrentMa: number;
  lastSaved: string | null; // ISO timestamp or null
}

export const StatusBar: React.FC<Props> = ({
  partCount,
  wireCount,
  zoom,
  running,
  runTime,
  totalCurrentMa,
  lastSaved,
}) => {
  const [timeAgo, setTimeAgo] = useState<string>('Not saved');

  useEffect(() => {
    if (!lastSaved) {
      setTimeAgo('Not saved');
      return;
    }

    const updateTimeAgo = () => {
      const now = Date.now();
      const savedAt = new Date(lastSaved).getTime();
      const secondsAgo = Math.floor((now - savedAt) / 1000);

      if (secondsAgo < 60) {
        setTimeAgo(`Saved ${secondsAgo}s ago`);
      } else if (secondsAgo < 3600) {
        setTimeAgo(`Saved ${Math.floor(secondsAgo / 60)}m ago`);
      } else {
        setTimeAgo(`Saved ${Math.floor(secondsAgo / 3600)}h ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, [lastSaved]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getCurrentColor = (current: number) => {
    if (current > 500) return 'text-red-400';
    if (current > 100) return 'text-yellow-400';
    return 'text-slate-400';
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-[24px] bg-slate-900/95 backdrop-blur border-t border-slate-700/50 flex items-center justify-between px-3 text-[11px] font-mono text-slate-400 z-50 select-none">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5" title="Component count">
          <Cpu size={12} className="text-slate-500" />
          <span>{partCount} parts</span>
        </div>
        <div className="flex items-center gap-1.5" title="Wire count">
          <Cable size={12} className="text-slate-500" />
          <span>{wireCount} wires</span>
        </div>
        <div className="flex items-center gap-1.5" title="Zoom level">
          <ZoomIn size={12} className="text-slate-500" />
          <span>{Math.round(zoom)}%</span>
        </div>
      </div>

      {/* Center section */}
      <div className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-1.5 bg-slate-950/50 px-2 py-0.5 rounded-full border border-slate-800">
          <Circle
            size={8}
            className={`${running ? 'text-emerald-400 fill-emerald-400/50' : 'text-slate-500 fill-slate-500/50'}`}
          />
          <span className={running ? 'text-emerald-400' : 'text-slate-500'}>
            {running ? `Simulating ${formatTime(runTime)}` : 'Ready'}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 border-l border-slate-700/50 pl-6">
          <span className="text-slate-500">Current:</span>
          <span className={`${getCurrentColor(totalCurrentMa)} font-semibold`}>
            {totalCurrentMa.toFixed(1)} mA
          </span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5" title="Save status">
          <Save size={12} className="text-slate-500" />
          <span>{timeAgo}</span>
        </div>
        <div className="border-l border-slate-700/50 h-3"></div>
        <div className="text-slate-500">
          <span>Ctrl+Z Undo</span>
        </div>
      </div>
    </div>
  );
};
