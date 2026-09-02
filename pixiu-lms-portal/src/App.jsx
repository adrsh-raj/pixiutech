import { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
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
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { LogOut, Bell, Zap, AlertCircle, AlertTriangle, ShieldCheck, Sparkles, X, Menu } from 'lucide-react';

const Settings = () => (
  <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
    <h2 className="text-xl font-bold text-slate-800 mb-2">System Configuration & Master ID Rules</h2>
    <p className="text-sm text-slate-500 mb-6">Manage global ID prefix formats, academic years, and communication keys.</p>
    
    <div className="space-y-4 text-sm">
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <label className="block font-bold text-slate-700 mb-1">Student ID Auto-Generation Format</label>
        <p className="font-mono text-pixiu-blue text-xs font-bold">[SchoolCode][Grade][Section] [RollNo]</p>
        <p className="text-xs text-slate-500 mt-1">Example: Zenith Public School, Class 6 Section A ➡️ <span className="font-mono font-bold">ZPS6A 01</span></p>
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <label className="block font-bold text-slate-700 mb-1">Active Academic Year</label>
        <p className="font-medium text-slate-800">2026 - 2027 (Term 1 Active)</p>
      </div>

      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
        <label className="block font-bold text-slate-700 mb-1">Database & Auth Status</label>
        <p className="text-emerald-600 font-bold flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          SQLite + BCrypt Hash Auth Active
        </p>
      </div>
    </div>
  </div>
);

// Protected Layout for Admin & Trainers
function ProtectedLayout() {
  const { isAuthenticated, user, logout, loading } = useAuth();
  const { alerts, resolveAlertAction, notifications } = useData();
  const toast = useToast();
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeBellTab, setActiveBellTab] = useState('announcements'); // 'announcements' | 'system'
  const [actionLoading, setActionLoading] = useState(null);

  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`pixiu_read_notifs_${user?.username || 'admin'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const markAsRead = (id) => {
    const updated = Array.from(new Set([...readNotifIds, id]));
    setReadNotifIds(updated);
    try {
      localStorage.setItem(`pixiu_read_notifs_${user?.username || 'admin'}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const markAllAsRead = () => {
    const allIds = (notifications || []).map(n => n.id);
    const updated = Array.from(new Set([...readNotifIds, ...allIds]));
    setReadNotifIds(updated);
    try {
      localStorage.setItem(`pixiu_read_notifs_${user?.username || 'admin'}`, JSON.stringify(updated));
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If student logs into admin routes, redirect to student space
  if (user?.role === 'student') {
    return <Navigate to="/student-portal" replace />;
  }

  const handleExecuteAction = async (alertItem) => {
    setActionLoading(alertItem.id);
    const res = await resolveAlertAction(alertItem.id, alertItem.action_type, alertItem.related_id);
    setActionLoading(null);
    if (res.success) {
      toast.success(res.message, 'Operational Action Executed');
    } else {
      toast.error(res.error || 'Failed to execute action');
    }
  };

  const visibleAlerts = alerts.filter(a => {
    if (user?.role !== 'admin' && (a.type === 'billing_due' || a.action_type === 'view_billing' || a.type === 'billing')) {
      return false;
    }
    return true;
  });

  const unreadAnnouncementsCount = (notifications || []).filter(n => !readNotifIds.includes(n.id) && n.status !== 'Archived').length;
  const totalUnreadCount = unreadAnnouncementsCount + (visibleAlerts ? visibleAlerts.length : 0);

  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased selection:bg-blue-500 selection:text-white overflow-hidden">
      <Sidebar mobileOpen={mobileSidebarOpen} setMobileOpen={setMobileSidebarOpen} />
      <div className="flex-1 overflow-auto relative flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-3.5 sm:px-8 py-2.5 sm:py-3.5 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight truncate">Pixiu Tech Console</h2>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider truncate">Multi-Tenant Operating System</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Live Operational & Announcements Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
                title="Announcements & System Alerts"
              >
                <Bell size={17} />
                {totalUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                    {totalUnreadCount}
                  </span>
                )}
              </button>

              {/* Alerts Dropdown Drawer (Mobile Viewport Safe) */}
              {isAlertsOpen && (
                <div className="fixed sm:absolute inset-x-3 top-14 sm:inset-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
                  <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div>
                      <h3 className="font-bold text-xs uppercase tracking-wider">Notifications & Alerts</h3>
                      <p className="text-[10px] text-slate-400">{unreadAnnouncementsCount} unread notices</p>
                    </div>
                    <button onClick={() => setIsAlertsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16}/></button>
                  </div>

                  {/* Bell Tabs Switcher */}
                  <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold shrink-0">
                    <button
                      onClick={() => setActiveBellTab('announcements')}
                      className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeBellTab === 'announcements' 
                          ? 'bg-white text-pixiu-blue shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📢 Broadcasts ({unreadAnnouncementsCount})
                    </button>
                    <button
                      onClick={() => setActiveBellTab('system')}
                      className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                        activeBellTab === 'system' 
                          ? 'bg-white text-amber-600 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ⚡ System ({visibleAlerts.length})
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-3 space-y-2.5">
                    {activeBellTab === 'announcements' && (
                      <div className="space-y-2.5">
                        {unreadAnnouncementsCount > 0 && (
                          <div className="flex justify-end px-1">
                            <button
                              onClick={markAllAsRead}
                              className="text-[10px] font-bold text-pixiu-blue hover:underline cursor-pointer"
                            >
                              ✓ Mark all as read
                            </button>
                          </div>
                        )}

                        {notifications.map(notif => {
                          const isRead = readNotifIds.includes(notif.id);
                          return (
                            <div 
                              key={notif.id}
                              className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                                isRead 
                                  ? 'bg-slate-50 border-slate-200 opacity-75' 
                                  : 'bg-blue-50/60 border-blue-200 shadow-xs'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  notif.severity === 'urgent' ? 'bg-rose-100 text-rose-800' :
                                  notif.severity === 'important' ? 'bg-purple-100 text-purple-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {notif.severity ? notif.severity.toUpperCase() : 'NOTICE'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {notif.scheduled_date} • {notif.scheduled_time}
                                </span>
                              </div>

                              <h4 className="font-bold text-slate-900 text-xs">{notif.title}</h4>
                              <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 whitespace-pre-line">
                                {notif.message}
                              </p>

                              <div className="flex justify-end pt-1">
                                {isRead ? (
                                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                                    <ShieldCheck size={12}/> Read
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => markAsRead(notif.id)}
                                    className="px-2.5 py-1 bg-pixiu-blue hover:bg-blue-600 text-white rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-xs"
                                  >
                                    ✓ Mark as Read
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {notifications.length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-xs font-medium">
                            No announcements published yet.
                          </div>
                        )}
                      </div>
                    )}

                    {activeBellTab === 'system' && (
                      <div className="space-y-2.5">
                        {visibleAlerts.map(alertItem => (
                          <div key={alertItem.id} className={`p-3.5 rounded-xl border text-xs ${
                            alertItem.severity === 'critical' ? 'bg-red-50/70 border-red-200 text-red-950' :
                            alertItem.severity === 'warning' ? 'bg-amber-50/70 border-amber-200 text-amber-950' :
                            'bg-blue-50/70 border-blue-200 text-blue-950'
                          }`}>
                            <div className="flex items-start gap-2 mb-1.5">
                              {alertItem.severity === 'critical' ? <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5"/> :
                               alertItem.severity === 'warning' ? <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5"/> :
                               <ShieldCheck size={15} className="text-blue-500 shrink-0 mt-0.5"/>}
                              <div>
                                <p className="font-bold">{alertItem.title}</p>
                                <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{alertItem.message}</p>
                              </div>
                            </div>

                            {alertItem.action_label && (
                              <button
                                onClick={() => handleExecuteAction(alertItem)}
                                disabled={actionLoading === alertItem.id}
                                className={`w-full mt-2 py-1.5 px-3 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                                  alertItem.severity === 'critical' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                  alertItem.severity === 'warning' ? 'bg-amber-600 hover:bg-amber-700 text-white' :
                                  'bg-pixiu-blue hover:bg-blue-600 text-white'
                                }`}
                              >
                                {actionLoading === alertItem.id ? (
                                  'Executing...'
                                ) : (
                                  <><Sparkles size={12}/> {alertItem.action_label}</>
                                )}
                              </button>
                            )}
                          </div>
                        ))}

                        {visibleAlerts.length === 0 && (
                          <div className="p-8 text-center text-slate-400 text-xs font-medium">
                            All systems operational. No critical bottlenecks or alerts!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Authenticated
            </span>
            <button 
              onClick={logout} 
              className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut size={16}/>
            </button>
          </div>
        </header>
        <main className="p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Admin Route Guard Component
function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/trainers" replace />;
  }
  return children;
}

// Student Route Guard
function StudentRouteGuard() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <StudentPortal />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Student Protected Portal (Student Role Only) */}
              <Route path="/student-portal" element={<StudentRouteGuard />} />

              {/* Protected Enterprise Routes (Admin & Trainers) */}
              <Route path="/" element={<ProtectedLayout />}>
                {/* Default Index Route: Admin sees Dashboard, Trainer redirected to Live Classrooms */}
                <Route index element={
                  <AdminOnly>
                    <Dashboard />
                  </AdminOnly>
                } />
                
                {/* BUSINESS & CRM (Admin Only) */}
                <Route path="leads" element={<AdminOnly><Leads /></AdminOnly>} />
                <Route path="schools" element={<AdminOnly><Schools /></AdminOnly>} />
                <Route path="billing" element={<AdminOnly><Billing /></AdminOnly>} />
                <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
                <Route path="students" element={<AdminOnly><Students /></AdminOnly>} />
                <Route path="comms" element={<AdminOnly><Comms /></AdminOnly>} />

                {/* ACADEMICS & OPERATIONS (Shared Trainer & Admin) */}
                <Route path="trainers" element={<Trainers />} />
                <Route path="content" element={<ContentHub />} />
                <Route path="curriculum" element={<Curriculum />} />
                <Route path="inventory" element={<Inventory />} />
              </Route>

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
