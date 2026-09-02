import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FolderKanban, Settings, LogOut, Box, GraduationCap, MessageSquare, BookOpen, Building, CreditCard, PlaySquare, Megaphone, X } from 'lucide-react';
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
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
        />
      )}

      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-pixiu-dark text-white flex flex-col shadow-2xl md:shadow-xl z-50 md:z-10 h-screen shrink-0 border-r border-slate-800 transition-transform duration-200 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2 py-1 rounded-xl shadow-md border border-white/20 flex items-center justify-center shrink-0">
              <img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wider text-white leading-none">PIXIU TECH</h1>
            </div>
          </div>
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3 sm:p-4">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-pixiu-blue flex items-center justify-center font-bold text-xs text-white shadow-sm shadow-blue-500/30 shrink-0">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate text-white">{user?.name || 'Super Admin'}</p>
              <p className="text-[10px] text-pixiu-blue font-semibold uppercase tracking-wider capitalize">{user?.role || 'Admin'} Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 sm:px-4 mt-1 space-y-5 overflow-y-auto pb-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 px-3">{group.title}</p>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                        isActive 
                          ? 'bg-pixiu-blue text-white shadow-md shadow-blue-900/20 font-semibold' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'
                      }`}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                      <span className="text-xs">{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 sm:p-4 border-t border-slate-800">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 sm:py-2.5 w-full rounded-lg text-slate-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer text-xs font-bold"
            aria-label="Log out of your account"
          >
            <LogOut size={15} />
            <span>Secure Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
