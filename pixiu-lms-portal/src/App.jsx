import { useEffect, useMemo, useState, lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Inventory from './pages/Inventory';
import Trainers from './pages/Trainers';
import Comms from './pages/Comms';
import Leads from './pages/Leads';
import Schools from './pages/Schools';
import Billing from './pages/Billing';
import ContentHub from './pages/ContentHub';
import Curriculum from './pages/Curriculum';
import Login from './pages/Login';
import StudentPortal from './pages/StudentPortal';
import SchoolPortal from './pages/SchoolPortal';
import Verify from './pages/Verify';
import AuditLogs from './pages/AuditLogs';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { LogOut, Bell, ShieldCheck } from 'lucide-react';
import { filterNotificationsForUser, fetchUserReadNotifIds, saveUserReadNotifIds, getCanonicalUserKey } from './utils/notifications';

const Simulation = lazy(() => import('./pages/Simulation'));

class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Simulation chunk load error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-white p-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center">
            <h3 className="text-lg font-bold mb-2">Virtual Lab Update</h3>
            <p className="text-sm text-slate-400 mb-5">The latest Virtual Lab build could not be loaded.</p>
            <button onClick={() => window.location.reload()} className="w-full px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold">
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Settings = () => (
  <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
    <h2 className="text-xl font-bold text-slate-800 mb-2">System Configuration & Master ID Rules</h2>
    <p className="text-sm text-slate-500 mb-6">Manage global ID prefix formats, academic years, and communication keys.</p>
    <div className="space-y-4 text-sm">
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="font-bold text-slate-700">Student ID Auto-Generation Format</p>
        <p className="font-mono text-pixiu-blue text-xs font-bold mt-1">[SchoolCode][Grade][Section] [RollNo]</p>
      </div>
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="font-bold text-slate-700">Active Academic Year</p>
        <p className="font-medium text-slate-800 mt-1">2026 - 2027 (Term 1 Active)</p>
      </div>
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <p className="font-bold text-slate-700">Database & Auth Status</p>
        <p className="text-emerald-600 font-bold text-xs mt-1">Server API + BCrypt/JWT Authentication</p>
      </div>
    </div>
  </div>
);

function ProtectedLayout() {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const { alerts, notifications } = useData();
  const toast = useToast();
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState([]);

  const visibleNotifications = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user]);
  const visibleAlerts = useMemo(() => alerts.filter(a => {
    if (user?.role !== 'admin' && (a.type === 'billing_due' || a.action_type === 'view_billing' || a.type === 'billing')) return false;
    return true;
  }), [alerts, user]);

  useEffect(() => {
    if (!user) return;
    fetchUserReadNotifIds(user).then(ids => setReadNotifIds(Array.isArray(ids) ? ids : []));
  }, [user]);

  const unreadCount = visibleNotifications.filter(n => !readNotifIds.includes(n.id)).length;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'student') return <Navigate to="/student-portal" replace />;
  if (user?.role === 'school') return <Navigate to="/school-portal" replace />;

  const markRead = async (id) => {
    const updated = await saveUserReadNotifIds(id, user);
    setReadNotifIds(updated);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex justify-between items-center sticky top-0 z-20">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800">Pixiu Tech Console</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">Robotics & AI Operating System</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && <Link to="/logs" title="Security Logs" className="p-2 rounded-xl border border-slate-200 text-blue-600 hover:bg-blue-50"><ShieldCheck size={17} /></Link>}
            <div className="relative">
              <button onClick={() => setShowNotifications(v => !v)} title="Notifications" className="relative p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100">
                <Bell size={17} />
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-30">
                  <div className="px-4 py-3 bg-slate-900 text-white font-bold text-xs">Notifications</div>
                  <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                    {visibleNotifications.map(notif => {
                      const isRead = readNotifIds.includes(notif.id);
                      return <button key={notif.id} onClick={() => !isRead && markRead(notif.id)} className={`w-full text-left p-3 rounded-xl border ${isRead ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="text-xs font-bold text-slate-800">{notif.title}</div>
                        <div className="text-[11px] text-slate-600 mt-1">{notif.message}</div>
                      </button>;
                    })}
                    {visibleNotifications.length === 0 && <div className="p-6 text-center text-xs text-slate-400">No announcements published yet.</div>}
                  </div>
                </div>
              )}
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Live Authenticated</span>
            <button onClick={logout} title="Logout" className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"><LogOut size={17} /></button>
          </div>
        </header>
        <main className="p-4 sm:p-8 flex-1"><Outlet /></main>
      </div>
    </div>
  );
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/trainers" replace />;
}

function StudentRouteGuard() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'student') return <Navigate to="/" replace />;
  return <StudentPortal />;
}

function SchoolRouteGuard() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!['school', 'admin'].includes(user?.role)) return <Navigate to="/" replace />;
  return <SchoolPortal />;
}

function GuestRouteGuard({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#040810] flex items-center justify-center"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
  if (isAuthenticated && user) {
    const destination = user.role === 'student' ? '/student-portal' : user.role === 'school' ? '/school-portal' : user.role === 'trainer' ? '/trainers' : '/';
    return <Navigate to={destination} replace />;
  }
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<GuestRouteGuard><Login /></GuestRouteGuard>} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/simulation" element={<ChunkErrorBoundary><Suspense fallback={<div className="min-h-screen bg-[#070B14] flex items-center justify-center text-white"><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>}><Simulation /></Suspense></ChunkErrorBoundary>} />
              <Route path="/student-portal" element={<StudentRouteGuard />} />
              <Route path="/school-portal" element={<SchoolRouteGuard />} />
              <Route path="/" element={<ProtectedLayout />}>
                <Route index element={<AdminOnly><Dashboard /></AdminOnly>} />
                <Route path="leads" element={<AdminOnly><Leads /></AdminOnly>} />
                <Route path="schools" element={<AdminOnly><Schools /></AdminOnly>} />
                <Route path="billing" element={<AdminOnly><Billing /></AdminOnly>} />
                <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
                <Route path="logs" element={<AdminOnly><AuditLogs /></AdminOnly>} />
                <Route path="students" element={<Students />} />
                <Route path="comms" element={<AdminOnly><Comms /></AdminOnly>} />
                <Route path="trainers" element={<Trainers />} />
                <Route path="content" element={<ContentHub />} />
                <Route path="curriculum" element={<Curriculum />} />
                <Route path="inventory" element={<Inventory />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
