import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Settings, LogOut, Box, GraduationCap, MessageSquare, BookOpen, Building, CreditCard, PlaySquare, Megaphone, X, Wifi, Cpu, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ mobileOpen = false, setMobileOpen = () => {} }) {
  const location = useLocation();
  const { user, logout, role } = useAuth();

  const isTrainer = role === 'trainer';

  const groups = isTrainer ? [
    {
      title: 'TRAINER ACADEMICS',
      links: [
        { name: 'Live Sessions & Roster', path: '/trainers', icon: GraduationCap },
        { name: 'Student Directory', path: '/students', icon: Users },
        { name: 'Virtual Arduino Lab', path: '/simulation', icon: Cpu },
        { name: 'Content Hub', path: '/content', icon: PlaySquare },
        { name: 'Curriculum Plans', path: '/curriculum', icon: BookOpen },
        { name: 'Hardware Kits', path: '/inventory', icon: Box },
        { name: 'Login & Audit Logs', path: '/logs', icon: ShieldCheck },
      ]
    }
  ] : [
    {
      title: 'MAIN',
      links: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Login & Audit Logs', path: '/logs', icon: ShieldCheck },
      ]
    },
    {
      title: 'BUSINESS & CRM',
      links: [
        { name: 'Sales Pipeline', path: '/leads', icon: FolderKanban },
        { name: 'Partner Schools', path: '/schools', icon: Building },
        { name: 'Billing & Invoices', path: '/billing', icon: CreditCard },
      ]
    },
    {
      title: 'ACADEMICS & LMS',
      links: [
        { name: 'Student Directory', path: '/students', icon: Users },
        { name: 'Virtual Arduino Lab', path: '/simulation', icon: Cpu },
        { name: 'Content Hub', path: '/content', icon: PlaySquare },
        { name: 'Curriculum Plans', path: '/curriculum', icon: BookOpen },
        { name: 'Trainers Roster', path: '/trainers', icon: GraduationCap },
      ]
    },
    {
      title: 'OPERATIONS',
      links: [
        { name: 'Hardware & Kits', path: '/inventory', icon: Box },
        { name: 'Announcements & Comms', path: '/comms', icon: Megaphone },
        { name: 'Login & Audit Logs', path: '/logs', icon: ShieldCheck },
        { name: 'Settings', path: '/settings', icon: Settings },
      ]
    }
  ];

  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'AD';

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
        />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 w-[260px] bg-[#070B14] text-white flex flex-col z-50 md:z-10 h-screen shrink-0 border-r border-slate-800/60 transition-transform duration-200 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2 py-1 rounded-xl shadow-md flex items-center justify-center shrink-0">
              <img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-wider text-white leading-none">PIXIU TECH</h1>
              <span className="text-[9px] text-slate-500 font-semibold tracking-widest uppercase">Robotics OS v2.4</span>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-500 hover:text-white rounded-lg cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="px-4 pt-4 pb-2">
          <div className="bg-slate-900/80 border border-slate-800/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pixiu-blue to-blue-400 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-blue-500/20 shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-white">{user?.name || 'Super Admin'}</p>
              <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">{user?.role || 'Admin'} Console</p>
            </div>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-3 mt-2 space-y-5 overflow-y-auto pb-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.15em] mb-1.5 px-3">{group.title}</p>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-[13px] ${
                        isActive
                          ? 'bg-pixiu-blue/15 text-blue-400 font-semibold border-l-2 border-blue-400 ml-0 pl-2.5'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 font-medium'
                      }`}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                      <span>{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: Network Status + Logout */}
        <div className="px-4 py-3 border-t border-slate-800/60 space-y-2">
          {/* Live Network Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-500 font-medium">Lab Hubs Connected</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer text-xs font-semibold"
            aria-label="Log out of your account"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
