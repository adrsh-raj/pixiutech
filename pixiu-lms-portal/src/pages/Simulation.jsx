import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Workbench = lazy(() => import('../components/circuit-lab/workbench').then((module) => ({ default: module.Workbench })));

function CyberLabLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white p-6">
      <div className="w-full max-w-md rounded-3xl border border-violet-400/20 bg-slate-900/90 p-8 text-center shadow-2xl shadow-violet-950/30">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-300">
          <span className="text-2xl animate-pulse">✦</span>
        </div>
        <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">PIXIU CYBERLAB</p>
        <h1 className="mt-2 text-lg font-black">Loading Virtual Arduino Lab</h1>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Preparing the circuit studio, Blockly workspace and simulator. AI models stay unloaded until you use AI.
        </p>
        <div className="mx-auto mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-violet-400" />
        </div>
      </div>
    </div>
  );
}

export default function Simulation() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) return <CyberLabLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (typeof document !== 'undefined') document.title = 'PIXIU CYBERLAB';

  return (
    <Suspense fallback={<CyberLabLoading />}>
      <Workbench userRole={user?.role} />
    </Suspense>
  );
}
