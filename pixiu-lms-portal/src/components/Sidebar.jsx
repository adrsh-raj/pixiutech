import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Settings, LogOut, Box, GraduationCap, MessageSquare, BookOpen, Building, CreditCard, PlaySquare, Megaphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { user, logout, role } = useAuth();

  const isTrainer = role === 'trainer';

  const groups = isTrainer ? [
    {
      title: 'TRAINER ACADEMICS',
      links: [
        { name: 'Live Sessions & Roster', path: '/trainers', icon: GraduationCap },
        { name: 'Content Hub', path: '/content', icon: PlaySquare },
        { name: 'Curriculum Plans', path: '/curriculum', icon: BookOpen },
        { name: 'Hardware Kits', path: '/inventory', icon: Box },
      ]
    }
  ] : [
    {
      title: 'MAIN',
      links: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
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
        { name: 'Settings', path: '/settings', icon: Settings },
      ]
    }
  ];

  const initials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'AD';

  return (
    <aside className="w-64 bg-pixiu-dark text-white flex flex-col shadow-xl z-10 relative h-screen shrink-0 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50">
        <div className="bg-white px-2.5 py-1.5 rounded-xl shadow-md border border-white/20 flex items-center justify-center shrink-0">
          <img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-8 w-auto object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-wider text-white leading-none">PIXIU<span className="text-pixiu-blue">.</span>TECH</h1>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-pixiu-blue flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-blue-500/30">
            {initials}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold truncate text-white">{user?.name || 'Super Admin'}</p>
            <p className="text-[10px] text-pixiu-blue font-semibold uppercase tracking-wider capitalize">{user?.role || 'Admin'} Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 mt-2 space-y-6 overflow-y-auto pb-6">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-3">{group.title}</p>
            <div className="space-y-1">
              {group.links.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-pixiu-blue text-white shadow-md shadow-blue-900/20 font-semibold' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'
                    }`}
                  >
                    <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-xs">{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-slate-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer text-xs font-bold"
        >
          <LogOut size={16} />
          <span>Secure Logout</span>
        </button>
      </div>
    </aside>
  );
}
