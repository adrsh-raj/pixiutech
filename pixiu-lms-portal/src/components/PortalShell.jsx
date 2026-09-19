import { Menu, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import PortalSidebar from './PortalSidebar';
import NotificationCenter from './NotificationCenter';
import { PORTAL_ROLE_LABELS } from '../config/portalNavigation';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import RefreshButton from './ui/RefreshButton';
import Breadcrumbs from './ui/Breadcrumbs';
import PortalFooter from './PortalFooter';

export default function PortalShell({ role, title, subtitle, children }) {
  const { user } = useAuth();
  const { refreshAll, loading } = useData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const roleMeta = PORTAL_ROLE_LABELS[role] || PORTAL_ROLE_LABELS.student;

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const crumbs = useMemo(() => [
    { label: roleMeta.name, current: false },
    { label: title || roleMeta.name, current: true },
  ], [roleMeta.name, title]);

  const handleRefresh = async () => {
    const result = await refreshAll();
    if (result?.success === false) throw new Error(result.error || 'Refresh failed');
    return result;
  };

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-[#f3f1ea] text-slate-900 flex font-sans">
      <a href="#portal-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-white">Skip to content</a>
      <PortalSidebar role={role} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="min-w-0 flex-1 flex flex-col w-full">
        <header className="sticky top-0 z-30 min-h-[62px] sm:min-h-[68px] bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 px-3 sm:px-6 lg:px-9 py-2.5">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <button type="button" onClick={() => setMobileOpen((value) => !value)} className="md:hidden w-9 h-9 shrink-0 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 flex items-center justify-center" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="portal-sidebar"><Menu size={17} aria-hidden="true" /></button>
            <div className="min-w-0">
              <p className="hidden sm:flex items-center gap-1.5 text-[9px] font-semibold tracking-[0.16em] uppercase text-[#27786D]">{roleMeta.name} workspace</p>
              <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">{title || roleMeta.name}</h1>
              {subtitle && <p className="hidden md:block text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <RefreshButton onRefresh={handleRefresh} loading={loading} />
            <NotificationCenter />
            <div className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold ${online ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`} title={online ? 'Network connection available' : 'Network connection unavailable'}>
              {online ? <Wifi size={12} aria-hidden="true" /> : <WifiOff size={12} aria-hidden="true" />}
              <span>{online ? 'Online' : 'Offline'}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 max-w-44 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">{(user?.name || roleMeta.name).split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0"><p className="text-xs font-bold truncate">{user?.name || roleMeta.name}</p><p className="text-[9px] uppercase tracking-wider text-slate-400 truncate">{role}</p></div>
            </div>
          </div>
        </header>
        <main id="portal-main" className="flex-1 min-w-0 w-full overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-9 lg:py-7">
          <div className="max-w-[1400px] mx-auto w-full min-w-0">
            <div className="mb-4 sm:mb-5 overflow-x-auto"><Breadcrumbs items={crumbs} /></div>
            {children}
          </div>
        </main>
        <PortalFooter />
      </div>
    </div>
  );
}
