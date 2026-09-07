import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PORTAL_NAVIGATION, PORTAL_ROLE_LABELS } from '../config/portalNavigation';

export default function PortalSidebar({ role, mobileOpen = false, setMobileOpen = () => {} }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groups = PORTAL_NAVIGATION[role] || [];
  const roleMeta = PORTAL_ROLE_LABELS[role] || PORTAL_ROLE_LABELS.student;
  const RoleIcon = roleMeta.icon;
  const currentTab = searchParams.get('tab') || 'overview';
  const initials = (user?.name || roleMeta.name)
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isActive = (link) => {
    if (link.key) return location.pathname === '/student-portal' && currentTab === link.key;
    return location.pathname === link.href || (link.href !== '/' && location.pathname.startsWith(`${link.href}/`));
  };

  const handleLink = (link) => {
    setMobileOpen(false);
    if (link.key) {
      navigate(`/student-portal?tab=${encodeURIComponent(link.key)}`);
    }
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside className={`fixed md:sticky top-0 left-0 h-dvh w-[252px] shrink-0 z-50 md:z-20 transform transition-transform duration-200 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-full bg-[#07101f] border-r border-white/8 text-white flex flex-col shadow-2xl shadow-slate-950/10">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <Link to={role === 'student' ? '/student-portal?tab=overview' : '/trainers'} onClick={() => setMobileOpen(false)} className="flex items-center gap-3 min-w-0 group">
                <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-black/10 shrink-0">
                  <img src="/img/logo.png" alt="Pixiu Tech" className="h-7 w-auto object-contain" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-black tracking-[0.16em] text-white">PIXIU TECH</span>
                  <span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500 mt-0.5">{roleMeta.subtitle}</span>
                </span>
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="md:hidden p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/6" aria-label="Close navigation"><X size={17} /></button>
            </div>
          </div>

          <div className="mx-3 mb-3 p-3 rounded-2xl bg-white/5 border border-white/7 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-[11px] font-black shadow-lg shadow-blue-500/15">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{user?.name || roleMeta.name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{user?.username || `${roleMeta.name} account`}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.08)]" title="Online" />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-5 space-y-5" aria-label={`${roleMeta.name} navigation`}>
            {groups.map(group => (
              <section key={group.title}>
                <p className="px-2.5 mb-1.5 text-[9px] font-extrabold tracking-[0.16em] text-slate-600">{group.title}</p>
                <div className="space-y-1">
                  {group.links.map(link => {
                    const Icon = link.icon;
                    const active = isActive(link);
                    const className = `group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all ${active ? 'bg-blue-500/12 text-blue-300 ring-1 ring-inset ring-blue-400/15' : 'text-slate-400 hover:text-white hover:bg-white/5'}`;
                    const content = <><span className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? 'bg-blue-500/15 text-blue-300' : 'bg-white/[0.035] text-slate-500 group-hover:text-slate-300'}`}><Icon size={15} strokeWidth={active ? 2.3 : 1.9} /></span><span className="truncate flex-1 text-left">{link.name}</span>{active && <ChevronRight size={13} className="text-blue-300" />}</>;
                    return link.key ? (
                      <button type="button" key={link.name} onClick={() => handleLink(link)} className={className}>{content}</button>
                    ) : (
                      <Link key={link.name} to={link.href} onClick={() => setMobileOpen(false)} className={className}>{content}</Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="p-3 border-t border-white/7">
            <button type="button" onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-300 hover:bg-rose-500/8 transition-colors">
              <span className="w-7 h-7 rounded-lg bg-white/[0.035] flex items-center justify-center"><LogOut size={14} /></span>
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
