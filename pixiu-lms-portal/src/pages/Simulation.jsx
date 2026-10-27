import { lazy, Suspense, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Sparkles, KeyRound, ShieldAlert, ArrowRight } from 'lucide-react';

const Workbench = lazy(() => import('../components/circuit-lab/workbench').then((module) => ({ default: module.Workbench })));

const STORAGE_ACCESS_TOKEN_KEY = 'pixiu_lab_access_token';

// Authorized unique tokens for exclusive Virtual Lab access
const AUTHORIZED_ACCESS_TOKENS = new Set([
  'pxlab_sec_ai_9d7f42c18e9a6b30f5d7',
  'pixiu_cyberlab_ai_9d7f42c18e9a6b30f5d7',
  'pixiu-ai-lab-98e3b27c104f',
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIRTUAL_LAB_ACCESS_KEY) || '',
].filter(Boolean));

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

function CyberLabAccessRestricted({ onUnlock }) {
  const [manualKey, setManualKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = manualKey.trim();
    if (!clean) {
      setErrorMsg('Please enter an access key.');
      return;
    }
    if (AUTHORIZED_ACCESS_TOKENS.has(clean)) {
      onUnlock(clean);
    } else {
      setErrorMsg('Invalid access key. Please verify your link or key.');
    }
  };

  return (
    <div className="min-h-screen bg-[#070c18] flex items-center justify-center text-white p-6">
      <div className="w-full max-w-lg rounded-3xl border border-amber-500/30 bg-slate-950/90 p-8 md:p-10 text-center shadow-2xl shadow-amber-950/40 relative overflow-hidden backdrop-blur-2xl ring-1 ring-amber-500/20">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-slate-900 text-amber-400 shadow-xl shadow-amber-950/50 mb-6">
          <Lock size={32} />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          Restricted Environment
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white">
          PIXIU CYBERLAB
        </h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
          The Virtual Arduino Lab with Pixiu AI is currently restricted. Access is granted exclusively via an authorized unique direct link.
        </p>

        <div className="mt-6 p-4 rounded-2xl border border-slate-800 bg-slate-900/60 text-left text-xs space-y-2">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <ShieldAlert size={15} className="text-amber-400 shrink-0" />
            <span>Private Access Policy Active</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal pl-6">
            Direct navigation is disabled. If you have been issued a unique access link or access key, you can enter it below to unlock the lab.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={manualKey}
                onChange={(e) => {
                  setManualKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter authorized access key..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 text-xs font-black shadow-lg shadow-cyan-900/30 hover:brightness-110 transition cursor-pointer shrink-0"
            >
              <span>Unlock Lab</span>
              <ArrowRight size={14} />
            </button>
          </div>
          {errorMsg && (
            <p className="text-[11px] text-rose-400 font-medium">{errorMsg}</p>
          )}
        </form>

        <div className="mt-8 pt-4 border-t border-slate-900 flex items-center justify-center gap-4 text-xs">
          <a
            href="/"
            className="text-slate-400 hover:text-white transition font-medium"
          >
            ← Return to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Simulation() {
  const { isAuthenticated, loading, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [authorized, setAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Set document title
  if (typeof document !== 'undefined') {
    document.title = 'PIXIU CYBERLAB';
  }

  useEffect(() => {
    // 1. Check URL query parameters for access tokens
    const queryKey = (
      searchParams.get('access') ||
      searchParams.get('token') ||
      searchParams.get('key') ||
      searchParams.get('secret') ||
      searchParams.get('access_key') ||
      ''
    ).trim();

    if (queryKey && AUTHORIZED_ACCESS_TOKENS.has(queryKey)) {
      try {
        sessionStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, queryKey);
      } catch {}
      setAuthorized(true);
      setCheckingAuth(false);
      return;
    }

    // 2. Check stored session token
    let storedKey = '';
    try {
      storedKey = (sessionStorage.getItem(STORAGE_ACCESS_TOKEN_KEY) || '').trim();
    } catch {}

    if (storedKey && AUTHORIZED_ACCESS_TOKENS.has(storedKey)) {
      setAuthorized(true);
      setCheckingAuth(false);
      return;
    }

    // 3. Admin / Superadmin override (for CI automated testing and administrative access)
    if (user?.role === 'admin' || user?.role === 'superadmin') {
      setAuthorized(true);
      setCheckingAuth(false);
      return;
    }

    // If still loading auth context, wait
    if (!loading) {
      setCheckingAuth(false);
    }
  }, [searchParams, user, loading]);

  const handleManualUnlock = (validKey) => {
    try {
      sessionStorage.setItem(STORAGE_ACCESS_TOKEN_KEY, validKey);
    } catch {}
    setAuthorized(true);
  };

  if (loading || checkingAuth) {
    return <CyberLabLoading />;
  }

  // If not authorized via secret key or admin role, display the restricted access gate
  if (!authorized) {
    return <CyberLabAccessRestricted onUnlock={handleManualUnlock} />;
  }

  // Authorized: grant direct workbench access (guest or authenticated)
  const userRole = user?.role || 'student';
  const pixiuId = user?.pixiu_id || user?.related_id || (user?.role === 'admin' ? user?.display_name : '') || 'AI-LAB-GUEST';
  const accountId = user?.id || 'guest-ai-lab';

  return (
    <Suspense fallback={<CyberLabLoading />}>
      <Workbench
        userRole={userRole}
        pixiuId={pixiuId}
        accountId={accountId}
      />
    </Suspense>
  );
}
