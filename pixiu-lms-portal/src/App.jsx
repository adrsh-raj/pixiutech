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
import { LogOut, Bell, Zap, AlertCircle, AlertTriangle, ShieldCheck, Sparkles, X } from 'lucide-react';

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
  const { alerts, resolveAlertAction } = useData();
  const toast = useToast();
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

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

  return (
    <div className="flex h-screen bg-slate-50 font-sans antialiased selection:bg-blue-500 selection:text-white">
      <Sidebar />
      <div className="flex-1 overflow-auto relative flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-3.5 flex justify-between items-center sticky top-0 z-20">
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">Pixiu Tech Enterprise Console</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Multi-Tenant Operating System</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Live Operational Alerts Bell */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertsOpen(!isAlertsOpen)}
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                title="Operational Alerts & Actions"
              >
                <Bell size={18} />
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
                )}
              </button>

              {/* Alerts Dropdown Drawer */}
              {isAlertsOpen && (
                <div className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 animate-in fade-in zoom-in-95">
                  <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Zap size={16} className="text-amber-400"/>
                      <h3 className="font-bold text-xs uppercase tracking-wider">Live System Alerts ({alerts.length})</h3>
                    </div>
                    <button onClick={() => setIsAlertsOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16}/></button>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-3 space-y-2.5">
                    {alerts.map(alertItem => (
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

                    {alerts.length === 0 && (
                      <div className="p-8 text-center text-slate-400 text-xs font-medium">
                        All systems operational. No critical bottlenecks or alerts!
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

// Student Route Guard
function StudentRouteGuard() {
  const { isAuthenticated, loading } = useAuth();

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

              {/* Student Protected Portal */}
              <Route path="/student-portal" element={<StudentRouteGuard />} />

              {/* Protected Enterprise Routes (Admin & Trainers) */}
              <Route path="/" element={<ProtectedLayout />}>
                <Route index element={<Dashboard />} />
                
                {/* BUSINESS & CRM */}
                <Route path="leads" element={<Leads />} />
                <Route path="schools" element={<Schools />} />
                <Route path="billing" element={<Billing />} />

                {/* ACADEMICS & LMS */}
                <Route path="students" element={<Students />} />
                <Route path="content" element={<ContentHub />} />
                <Route path="curriculum" element={<Curriculum />} />
                <Route path="trainers" element={<Trainers />} />

                {/* OPERATIONS */}
                <Route path="inventory" element={<Inventory />} />
                <Route path="comms" element={<Comms />} />
                <Route path="settings" element={<Settings />} />
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
