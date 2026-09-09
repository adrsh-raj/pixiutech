import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link } from 'react-router-dom';
import PortalShell from './components/PortalShell';
import AdminCommandCenter from './pages/AdminCommandCenter';
import Students from './pages/Students';
import HardwareKitsV2 from './pages/HardwareKitsV2';
import TrainerOperationsV2 from './pages/TrainerOperationsV2';
import TrainerAssignments from './pages/TrainerAssignments';
import TrainerWorkspace from './pages/TrainerWorkspace';
import TrainerClasses from './pages/TrainerClasses';
import TrainerAttendance from './pages/TrainerAttendance';
import TrainerMaterials from './pages/TrainerMaterials';
import TrainerReviews from './pages/TrainerReviews';
import StudentClasses from './pages/StudentClasses';
import TrainerCredentials from './pages/TrainerCredentials';
import SchoolCredentials from './pages/SchoolCredentials';
import DataReset from './pages/DataReset';
import Comms from './pages/Comms';
import Leads from './pages/Leads';
import SchoolsV2 from './pages/SchoolsV2';
import Payments from './pages/Payments';
import Notifications from './pages/Notifications';
import ContentHub from './pages/ContentHub';
import Curriculum from './pages/Curriculum';
import Login from './pages/Login';
import StudentPortal from './pages/StudentPortal';
import SchoolPortal from './pages/SchoolPortal';
import AuditLogs from './pages/AuditLogs';
import ClassRankingPage from './pages/ClassRankingPage';
import AttendanceCenter from './pages/AttendanceCenter';
import StudentProgressPage from './pages/StudentProgressPage';
import PerformanceAnalyticsPage from './pages/PerformanceAnalyticsPage';
import BillingCenter from './pages/BillingCenter';
import QuizHub from './pages/QuizHub';
import ProjectHubV2 from './pages/ProjectHubV2';
import ClassesSessionsCenter from './pages/ClassesSessionsCenter';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

const Simulation = lazy(() => import('./pages/Simulation'));
class ChunkErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Simulation chunk load error:', error); }
  render() {
    if (this.state.hasError) return <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-white p-6"><div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center"><h3 className="text-lg font-bold mb-2">Virtual Lab Update</h3><p className="text-sm text-slate-400 mb-5">The latest Virtual Lab build could not be loaded.</p><button type="button" onClick={() => this.setState({ hasError: false })} className="w-full px-5 py-3 bg-blue-600 rounded-xl font-bold">Try again</button></div></div>;
    return this.props.children;
  }
}
const LoadingScreen = ({ dark = true }) => <div className={`min-h-screen ${dark ? 'bg-slate-900' : 'bg-slate-50'} flex items-center justify-center`}><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
const roleLabel = { admin: 'Pixiu Tech Console', superadmin: 'Pixiu Tech Console', trainer: 'Trainer Workspace', school: 'School Operations', student: 'Student Portal' };
const roleSubtitle = { admin: 'Robotics & AI Operating System', superadmin: 'Robotics & AI Operating System', trainer: 'Teaching workspace', school: 'School workspace', student: 'Learning workspace' };
const Settings = () => <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800 mb-2">System Configuration & Master ID Rules</h2><p className="text-sm text-slate-500 mb-6">Rules and operational controls for the live Django/PostgreSQL system.</p><div className="space-y-4 text-sm"><div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="font-bold text-slate-700">Student ID Auto-Generation Format</p><p className="font-mono text-blue-600 text-xs font-bold mt-1">Managed by Django from the school, class and roll records.</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="font-bold text-slate-700">Database & Auth Status</p><p className="text-emerald-600 font-bold text-xs mt-1">Django REST API + PostgreSQL + JWT</p></div><Link to="/trainer-credentials" className="block p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="font-bold text-blue-900">Trainer Login Credentials</p><p className="text-xs text-blue-700 mt-1">Reset trainer portal passwords securely from the admin console.</p></Link><Link to="/school-credentials" className="block p-4 bg-emerald-50 rounded-xl border border-emerald-100"><p className="font-bold text-emerald-900">School Login Credentials</p><p className="text-xs text-emerald-700 mt-1">Set or reset school portal passwords securely.</p></Link><Link to="/data-reset" className="block p-4 bg-red-50 rounded-xl border border-red-100"><p className="font-bold text-red-900">Danger Zone — Operational Data Reset</p><p className="text-xs text-red-700 mt-1">Use only the controlled reset workflow; administrator access is preserved.</p></Link></div></div>;
function ProtectedLayout() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; const role = user?.role || 'admin'; return <PortalShell role={role === 'superadmin' ? 'admin' : role} title={roleLabel[role] || 'Pixiu Tech Console'} subtitle={roleSubtitle[role] || 'Pixiu Tech Operating System'}><Outlet /></PortalShell>; }
function AdminOnly({ children }) { const { user } = useAuth(); return user?.role === 'admin' || user?.role === 'superadmin' ? children : <Navigate to="/trainers" replace />; }
function RoleRoute({ roles, children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (!roles.includes(user?.role)) return <Navigate to="/" replace />; return children; }
function TrainerConsoleRoute() { const { user } = useAuth(); return user?.role === 'trainer' ? <TrainerWorkspace /> : <AdminOnly><TrainerOperationsV2 /></AdminOnly>; }
function AttendanceRoute() { const { user } = useAuth(); return user?.role === 'trainer' ? <TrainerAttendance /> : <AttendanceCenter />; }
function StudentRouteGuard() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role !== 'student') return <Navigate to="/" replace />; return <StudentPortal />; }
function SchoolRouteGuard() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role !== 'school') return <Navigate to="/" replace />; return <SchoolPortal />; }
function GuestRouteGuard({ children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (isAuthenticated && user) { const destination = user.role === 'student' ? '/student-portal' : user.role === 'school' ? '/school-portal' : user.role === 'trainer' ? '/trainers' : '/'; return <Navigate to={destination} replace />; } return children; }
function StudentRoleRoute() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role !== 'student') return <Navigate to="/" replace />; return <ClassRankingPage />; }
function TrainerRoleRoute() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (!['trainer', 'admin', 'superadmin'].includes(user?.role)) return <Navigate to="/" replace />; return <ClassRankingPage />; }
function SchoolRoleRoute() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role !== 'school') return <Navigate to="/" replace />; return <ClassRankingPage />; }
function TrainerPerformanceRoute() { const { user } = useAuth(); const role = user?.role === 'admin' || user?.role === 'superadmin' ? 'admin' : 'trainer'; return <PerformanceAnalyticsPage role={role} />; }
function SchoolPerformanceRoute() { return <PerformanceAnalyticsPage role="school" />; }
function SessionsRoute() { const { user } = useAuth(); return user?.role === 'student' ? <StudentClasses /> : <ClassesSessionsCenter />; }

export default function App() {
  return <ToastProvider><AuthProvider><DataProvider><BrowserRouter><Routes>
    <Route path="/login" element={<GuestRouteGuard><Login /></GuestRouteGuard>} />
    <Route path="/simulation" element={<ChunkErrorBoundary><Suspense fallback={<LoadingScreen />}><Simulation /></Suspense></ChunkErrorBoundary>} />
    <Route path="/student-portal" element={<StudentRouteGuard />} />
    <Route path="/school-portal" element={<SchoolRouteGuard />} />
    <Route path="/student-ranking" element={<StudentRoleRoute />} />
    <Route path="/school-ranking" element={<SchoolRoleRoute />} />
    <Route path="/trainer-ranking" element={<TrainerRoleRoute />} />
    <Route path="/attendance" element={<RoleRoute roles={['admin', 'superadmin', 'school', 'trainer']}><AttendanceRoute /></RoleRoute>} />
    <Route path="/sessions" element={<RoleRoute roles={['admin', 'superadmin', 'school', 'trainer', 'student']}><SessionsRoute /></RoleRoute>} />
    <Route path="/student-progress" element={<RoleRoute roles={['student']}><StudentProgressPage /></RoleRoute>} />
    <Route path="/trainer-performance" element={<RoleRoute roles={['admin', 'superadmin', 'trainer']}><TrainerPerformanceRoute /></RoleRoute>} />
    <Route path="/school-performance" element={<RoleRoute roles={['admin', 'superadmin', 'school']}><SchoolPerformanceRoute /></RoleRoute>} />
    <Route path="/billing" element={<RoleRoute roles={['admin', 'superadmin', 'school']}><BillingCenter /></RoleRoute>} />
    <Route path="/inventory" element={<RoleRoute roles={['admin', 'superadmin', 'school', 'trainer', 'student']}><HardwareKitsV2 /></RoleRoute>} />
    <Route path="/quizzes" element={<RoleRoute roles={['student', 'trainer', 'admin', 'superadmin']}><QuizHub /></RoleRoute>} />
    <Route path="/projects" element={<RoleRoute roles={['student', 'trainer', 'admin', 'superadmin']}><ProjectHubV2 /></RoleRoute>} />
    <Route path="/trainer-reviews" element={<RoleRoute roles={['trainer', 'admin', 'superadmin']}><TrainerReviews /></RoleRoute>} />
    <Route path="/" element={<ProtectedLayout />}>
      <Route index element={<AdminOnly><AdminCommandCenter /></AdminOnly>} />
      <Route path="leads" element={<AdminOnly><Leads /></AdminOnly>} />
      <Route path="schools" element={<AdminOnly><SchoolsV2 /></AdminOnly>} />
      <Route path="payments" element={<AdminOnly><Payments /></AdminOnly>} />
      <Route path="notifications" element={<RoleRoute roles={['admin', 'superadmin', 'school', 'trainer', 'student']}><Notifications /></RoleRoute>} />
      <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
      <Route path="logs" element={<AdminOnly><AuditLogs /></AdminOnly>} />
      <Route path="students" element={<RoleRoute roles={['admin', 'superadmin', 'trainer']}><Students /></RoleRoute>} />
      <Route path="comms" element={<AdminOnly><Comms /></AdminOnly>} />
      <Route path="trainers" element={<TrainerConsoleRoute />} />
      <Route path="trainer-assignments" element={<AdminOnly><TrainerAssignments /></AdminOnly>} />
      <Route path="trainer-classes" element={<RoleRoute roles={['trainer']}><TrainerClasses /></RoleRoute>} />
      <Route path="trainer-materials" element={<RoleRoute roles={['admin', 'superadmin', 'trainer']}><TrainerMaterials /></RoleRoute>} />
      <Route path="trainer-reviews" element={<RoleRoute roles={['admin', 'superadmin', 'trainer']}><TrainerReviews /></RoleRoute>} />
      <Route path="trainer-credentials" element={<AdminOnly><TrainerCredentials /></AdminOnly>} />
      <Route path="school-credentials" element={<AdminOnly><SchoolCredentials /></AdminOnly>} />
      <Route path="data-reset" element={<AdminOnly><DataReset /></AdminOnly>} />
      <Route path="content" element={<RoleRoute roles={['admin', 'superadmin', 'school', 'trainer', 'student']}><ContentHub /></RoleRoute>} />
      <Route path="curriculum" element={<RoleRoute roles={['admin', 'superadmin', 'school', 'trainer', 'student']}><Curriculum /></RoleRoute>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter></DataProvider></AuthProvider></ToastProvider>;
}
