import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Cpu, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PORTAL_NAVIGATION, PORTAL_ROLE_LABELS } from '../config/portalNavigation';
import { withVirtualCyberlabNavigation } from '../config/virtualCyberlabNavigation';

const portalPath = { student: '/student-portal', school: '/school-portal', trainer: '/trainers' };
const CYBERLAB_ROLES = new Set(['admin', 'student', 'trainer']);

export default function PortalSidebar({ role, mobileOpen = false, setMobileOpen = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const configuredGroups = PORTAL_NAVIGATION[role] || [];
  const groups = CYBERLAB_ROLES.has(role)
    ? withVirtualCyberlabNavigation(configuredGroups, Cpu)
    : configuredGroups;
  const roleMeta = PORTAL_ROLE_LABELS[role] || PORTAL_ROLE_LABELS.student;
  const currentTab = searchParams.get('tab') || 'overview';
  const initials = (user?.name || roleMeta.name).split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
  const basePath = portalPath[role] || '/';

  const isActive = link => {
    if (link.key) return location.pathname === basePath && currentTab === link.key;
    if (!link.href || link.href === basePath) return false;
    const linkPath = link.href.split('?')[0];
    return location.pathname === linkPath || (linkPath !== '/' && location.pathname.startsWith(`${linkPath}/`));
  };

  const handleLink = link => {
    setMobileOpen(false);
    if (link.key) navigate(`${basePath}?tab=${encodeURIComponent(link.key)}`);
  };

  return <>
    {mobileOpen && <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 bg-slate-950/75 z-40 md:hidden" />}
    <aside id="portal-sidebar" aria-label={`${roleMeta.name} sidebar`} className={`fixed md:sticky top-0 left-0 h-dvh w-[252px] shrink-0 z-50 md:z-20 transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="h-full bg-[#15201d] border-r border-white/8 text-white flex flex-col shadow-2xl shadow-slate-950/10">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <Link to={`${basePath}?tab=overview`} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 font-black tracking-wide text-sm text-white">
              <span className="grid place-items-center w-8 h-8 rounded-xl bg-teal-700 text-xs">P</span>
              PIXIU TECH
            </Link>
            <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-white/10"><X size={17} /></button>
          </div>
        </div>
        <div className="mx-3 mb-3 p-3 rounded-2xl bg-white/5 border border-white/7 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-[11px] font-bold">{initials}</div>
          <div className="min-w-0"><p className="text-xs font-bold truncate">{user?.name || roleMeta.name}</p><p className="text-[10px] text-slate-400 truncate">{roleMeta.subtitle}</p></div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-5 space-y-5" aria-label={`${roleMeta.name} navigation`}>
          {groups.map(group => <section key={group.title}>
            <p className="px-2.5 mb-1.5 text-[9px] font-extrabold tracking-[0.16em] text-slate-500">{group.title}</p>
            <div className="space-y-1">{group.links.map(link => {
              const Icon = link.icon;
              const active = isActive(link);
              const className = `w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-teal-700/25 text-teal-200' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`;
              const content = <>{Icon && <Icon size={16} className="shrink-0" />}<span className="flex-1 text-left">{link.name}</span>{active && <ChevronRight size={14} />}</>;
              return link.key
                ? <button type="button" key={`${link.name}-${link.key}`} onClick={() => handleLink(link)} className={className} aria-current={active ? 'page' : undefined}>{content}</button>
                : <Link key={`${link.name}-${link.href}`} to={link.href || '#'} onClick={() => handleLink(link)} className={className} aria-current={active ? 'page' : undefined}>{content}</Link>;
            })}</div>
          </section>)}
        </nav>
        <div className="p-3 border-t border-white/7"><button type="button" onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white"><LogOut size={16} />Sign out</button></div>
      </div>
    </aside>
  </>;
}
