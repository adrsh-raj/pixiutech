import { lazy, Suspense, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AiStudioPanel = lazy(() => import('../components/circuit-lab/ai-studio-panel').then((module) => ({ default: module.AiStudioPanel })));

function AiStudioLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6">
      <div className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-slate-900/90 p-8 text-center shadow-2xl shadow-violet-950/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-300">
          <span className="text-2xl animate-pulse">✦</span>
        </div>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">PIXIU AI STUDIO</p>
        <h1 className="mt-2 text-lg font-black">Loading AI Workspace</h1>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Loading the AI authoring interface first. Camera, microphone and model runtimes start only when you use a mode.
        </p>
        <div className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-violet-400" />
        </div>
      </div>
    </div>
  );
}

export default function AIStudio() {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [aiState, setAiState] = useState({
    enabled: false,
    mode: 'objects',
    detectedClass: 'none',
    confidence: 0,
    allDetections: [],
    modelSource: 'none',
    detail: 'AI idle',
  });

  if (loading) return <AiStudioLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (typeof document !== 'undefined') document.title = 'PIXIU AI STUDIO';

  const returnPath = user?.role === 'student'
    ? '/student-portal'
    : user?.role === 'school'
      ? '/school-portal'
      : user?.role === 'trainer'
        ? '/trainers'
        : '/';

  return (
    <Suspense fallback={<AiStudioLoading />}>
      <AiStudioPanel
        isOpen
        onClose={() => navigate(returnPath)}
        aiState={aiState}
        onAiStateChange={setAiState}
        isSimRunning={false}
        runtimeEnabled={false}
        compact={false}
        onGoToSimulation={() => navigate('/simulation')}
      />
    </Suspense>
  );
}
