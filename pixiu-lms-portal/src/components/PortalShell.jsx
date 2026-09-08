import { Menu, Sparkles, RefreshCw } from 'lucide-react';
import PortalSidebar from './PortalSidebar';
import { PORTAL_ROLE_LABELS } from '../config/portalNavigation';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useState } from 'react';

export default function PortalShell({ role, title, subtitle, children }) {
  const { user } = useAuth();
  const { refreshAll, loading } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleMeta = PORTAL_ROLE_LABELS[role] || PORTAL_ROLE_LABELS.student;

  return (
    <div className="min-h-dvh bg-[#f5f7fb] text-slate-900 flex font-sans">
      <PortalSidebar role={role} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 h-[68px] bg-white/90 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-7 lg:px-9">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => setMobileOpen(true)} className="md:hidden w-9 h-9 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex items-center justify-center" aria-label="Open navigation"><Menu size={17} /></button>
            <div className="min-w-0">
              <p className="hidden sm:flex items-center gap-1.5 text-[9px] font-extrabold tracking-[0.16em] uppercase text-blue-600"><Sparkles size={11} /> {roleMeta.name} workspace</p>
              <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">{title || roleMeta.name}</h1>
              {subtitle && <p className="text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => refreshAll()} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] sm:text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50" title="Refresh live data" aria-label="Refresh live data">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/><span className="hidden sm:inline">{loading ? 'Refreshing' : 'Refresh'}</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> Live
            </div>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">{(user?.name || roleMeta.name).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</div>
              <div className="max-w-36"><p className="text-xs font-bold truncate">{user?.name || roleMeta.name}</p><p className="text-[9px] uppercase tracking-wider text-slate-400">{role}</p></div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-7 sm:py-7 lg:px-9">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}