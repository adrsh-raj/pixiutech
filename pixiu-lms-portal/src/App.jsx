import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link } from 'react-router-dom';
import PortalShell from './components/PortalShell';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Keep the application shell small. Feature pages are loaded only when their
// route is visited so the browser does not download the entire LMS at startup.
const AdminCommandCenter = lazy(() => import('./pages/AdminCommandCenter'));
const Students = lazy(() => import('./pages/StudentsV2'));
const HardwareKitsV2 = lazy(() => import('./pages/HardwareKitsV2'));
const TrainerOperationsV2 = lazy(() => import('./pages/TrainerOperationsV2'));
const TrainerAssignments = lazy(() => import('./pages/TrainerAssignments'));
const TrainerWorkspace = lazy(() => import('./pages/TrainerWorkspace'));
const TrainerClasses = lazy(() => import('./pages/TrainerClasses'));
const TrainerAttendance = lazy(() => import('./pages/TrainerAttendance'));
const TrainerMaterials = lazy(() => import('./pages/TrainerMaterials'));
const TrainerReviewsV2 = lazy(() => import('./pages/TrainerReviewsV2'));
const TrainerCertificates = lazy(() => import('./pages/TrainerCertificates'));
const StudentClasses = lazy(() => import('./pages/StudentClasses'));
const TrainerCredentials = lazy(() => import('./pages/TrainerCredentials'));
const SchoolCredentials = lazy(() => import('./pages/SchoolCredentials'));
const DataReset = lazy(() => import('./pages/DataReset'));
const Comms = lazy(() => import('./pages/Comms'));
const Leads = lazy(() => import('./pages/Leads'));
const WebsiteEnquiries = lazy(() => import('./pages/WebsiteEnquiries'));
const SchoolsV2 = lazy(() => import('./pages/SchoolsV2'));
const Payments = lazy(() => import('./pages/Payments'));
const Notifications = lazy(() => import('./pages/Notifications'));
const ContentHub = lazy(() => import('./pages/ContentHub'));
const Curriculum = lazy(() => import('./pages/Curriculum'));
const Login = lazy(() => import('./pages/Login'));
const VerifyV2 = lazy(() => import('./pages/VerifyV2'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const SchoolPortal = lazy(() => import('./pages/SchoolPortal'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const ClassRankingPage = lazy(() => import('./pages/ClassRankingPage'));
const AttendanceCenter = lazy(() => import('./pages/AttendanceCenter'));
const StudentProgressPage = lazy(() => import('./pages/StudentProgressPage'));
const PerformanceAnalyticsPage = lazy(() => import('./pages/PerformanceAnalyticsPage'));
const SchoolProgressReports = lazy(() => import('./pages/SchoolProgressReports'));
const BillingCenter = lazy(() => import('./pages/BillingCenter'));
const QuizHub = lazy(() => import('./pages/QuizHub'));
const StudentQuizHubV2 = lazy(() => import('./pages/StudentQuizHubV2'));
const ProjectHubV2 = lazy(() => import('./pages/ProjectHubV2'));
const SessionSchedulerV4 = lazy(() => import('./pages/SessionSchedulerV4'));
const CourseCompletionV2 = lazy(() => import('./pages/CourseCompletionV2'));
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
      return <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-white p-6"><div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center"><h3 className="text-lg font-bold mb-2">Virtual Lab Update</h3><p className="text-sm text-slate-400 mb-5">The latest Virtual Lab build could not be loaded.</p><button type="button" onClick={() => this.setState({ hasError: false })} className="w-full px-5 py-3 bg-blue-600 rounded-xl font-bold">Try again</button></div></div>;
    }
    return this.props.children;
  }
}

const LoadingScreen = ({ dark = true }) => <div className={`min-h-screen ${dark ? 'bg-slate-900' : 'bg-slate-50'} flex items-center justify-center`}><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
const roleLabel = { admin: 'Pixiu Tech Console', superadmin: 'Pixiu Tech Console', trainer: 'Trainer Workspace', school: 'School Operations', student: 'Student Portal' };
const roleSubtitle = { admin: 'Robotics & AI Operating System', superadmin: 'Robotics & AI Operating System', trainer: 'Teaching workspace', school: 'School workspace', student: 'Learning workspace' };

const Settings = () => <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800 mb-2">System Configuration & Master ID Rules</h2><p className="text-sm text-slate-500 mb-6">Rules and operational controls for the live Django/PostgreSQL system.</p><div className="space-y-4 text-sm"><div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="font-bold text-slate-700">Student ID Auto-Generation Format</p><p className="font-mono text-blue-600 text-xs font-bold mt-1">Managed by Django from the school, class and roll records.</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="font-bold text-slate-700">Database & Auth Status</p><p className="text-emerald-600 font-bold text-xs mt-1">Django REST API + PostgreSQL + JWT</p></div><Link to="/trainer-credentials" className="block p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="font-bold text-blue-900">Trainer Login Credentials</p><p className="text-xs text-blue-700 mt-1">Reset trainer portal passwords securely from the admin console.</p></Link><Link to="/school-credentials" className="block p-4 bg-emerald-50 rounded-xl border border-emerald-100"><p className="font-bold text-emerald-900">School Login Credentials</p><p className="text-xs text-emerald-700 mt-1">Set or reset school portal passwords securely.</p></Link><Link to="/data-reset" className="block p-4 bg-red-50 rounded-xl border border-red-100"><p className="font-bold text-red-900">Danger Zone — Operational Data Reset</p><p className="text-xs text-red-700 mt-1">Use only the controlled reset workflow; administrator access is preserved.</p></Link></div></div>;

function ProtectedLayout() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  const role = user?.role || 'admin';
  return <PortalShell role={role === 'superadmin' ? 'admin' : role} title={roleLabel[role] || 'Pixiu Tech Console'} subtitle={roleSubtitle[role] || 'Pixiu Tech Operating System'}><Suspense fallback={<LoadingScreen />}><Outlet /></Suspense></PortalShell>;
}
function AdminOnly({ children }) {
  const { user } = useAuth();
  return user?.role === 'admin' || user?.role === 'superadmin' ? children : <Navigate to="/" replace />;
}
function RoleRoute({ roles, children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}
function TrainerConsoleRoute() {
  const { user } = useAuth();
  return user?.role === 'trainer' ? <TrainerWorkspace /> : <AdminOnly><TrainerOperationsV2 /></AdminOnly>;
}
function AttendanceRoute() {
  const { user } = useAuth();
  return user?.role === 'trainer' ? <TrainerAttendance /> : <AttendanceCenter />;
}
function StudentRouteGuard() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'student') return <Navigate to="/" replace />;
  return <StudentPortal />;
}
function SchoolRouteGuard() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'school') return <Navigate to="/" replace />;
  return <SchoolPortal />;
}
function GuestRouteGuard({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (isAuthenticated && user) {
    const destination = user.role === 'student' ? '/student-portal' : user.role === 'school' ? '/school-portal' : user.role === 'trainer' ? '/trainers' : '/';
    return <Navigate to={destination} replace />;
  }
  return children;
}
function TrainerRoleRoute() {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!['trainer', 'admin', 'superadmin'].includes(user?.role)) return <Navigate to="/" replace />;
  return <ClassRankingPage />;
}
function SchoolPerformanceRoute() {
  return <PerformanceAnalyticsPage role="school" />;
}
function SessionsRoute() {
  const { user } = useAuth();
  return user?.role === 'student' ? <StudentClasses /> : <SessionSchedulerV4 />;
}
function QuizzesRoute() {
  const { user } = useAuth();
  return user?.role === 'student' ? <StudentQuizHubV2 /> : <QuizHub />;
}

export default function App() {
  return <ToastProvider><AuthProvider><DataProvider><BrowserRouter><Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/verify" element={<VerifyV2 />} />
    <Route path="/login" element={<GuestRouteGuard><Login /></GuestRouteGuard>} />
    <Route path="/simulation" element={<ChunkErrorBoundary><Simulation /></ChunkErrorBoundary>} />
    <Route path="/student-portal" element={<StudentRouteGuard />} />
    <Route path="/school-portal" element={<SchoolRouteGuard />} />
    <Route path="/" element={<ProtectedLayout />}>
      <Route index element={<AdminOnly><AdminCommandCenter /></AdminOnly>} />
      <Route path="leads" element={<AdminOnly><Leads /></AdminOnly>} />
      <Route path="website-enquiries" element={<AdminOnly><WebsiteEnquiries /></AdminOnly>} />
      <Route path="schools" element={<AdminOnly><SchoolsV2 /></AdminOnly>} />
      <Route path="payments" element={<AdminOnly><Payments /></AdminOnly>} />
      <Route path="notifications" element={<RoleRoute roles={['admin','superadmin','school','trainer','student']}><Notifications /></RoleRoute>} />
      <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
      <Route path="logs" element={<AdminOnly><AuditLogs /></AdminOnly>} />
      <Route path="students" element={<RoleRoute roles={['admin','superadmin','trainer']}><Students /></RoleRoute>} />
      <Route path="comms" element={<AdminOnly><Comms /></AdminOnly>} />
      <Route path="trainers" element={<TrainerConsoleRoute />} />
      <Route path="trainer-assignments" element={<AdminOnly><TrainerAssignments /></AdminOnly>} />
      <Route path="trainer-classes" element={<RoleRoute roles={['trainer']}><TrainerClasses /></RoleRoute>} />
      <Route path="trainer-materials" element={<RoleRoute roles={['admin','superadmin','trainer']}><TrainerMaterials /></RoleRoute>} />
      <Route path="trainer-credentials" element={<AdminOnly><TrainerCredentials /></AdminOnly>} />
      <Route path="trainer-certificates" element={<RoleRoute roles={['admin','superadmin','trainer']}><TrainerCertificates /></RoleRoute>} />
      <Route path="course-completion" element={<RoleRoute roles={['admin','superadmin','trainer']}><CourseCompletionV2 /></RoleRoute>} />
      <Route path="school-credentials" element={<AdminOnly><SchoolCredentials /></AdminOnly>} />
      <Route path="data-reset" element={<AdminOnly><DataReset /></AdminOnly>} />
      <Route path="content" element={<RoleRoute roles={['admin','superadmin','trainer','student']}><ContentHub /></RoleRoute>} />
      <Route path="curriculum" element={<RoleRoute roles={['admin','superadmin','trainer','student']}><Curriculum /></RoleRoute>} />
      <Route path="attendance" element={<RoleRoute roles={['admin','superadmin','school','trainer']}><AttendanceRoute /></RoleRoute>} />
      <Route path="sessions" element={<RoleRoute roles={['admin','superadmin','trainer','student']}><SessionsRoute /></RoleRoute>} />
      <Route path="student-progress" element={<RoleRoute roles={['student']}><StudentProgressPage /></RoleRoute>} />
      <Route path="trainer-performance" element={<RoleRoute roles={['admin','superadmin','trainer']}><PerformanceAnalyticsPage role="trainer" /></RoleRoute>} />
      <Route path="school-performance" element={<RoleRoute roles={['admin','superadmin','school']}><SchoolPerformanceRoute /></RoleRoute>} />
      <Route path="school-progress-reports" element={<RoleRoute roles={['school']}><SchoolProgressReports /></RoleRoute>} />
      <Route path="school-ranking" element={<RoleRoute roles={['school']}><Navigate to="/school-progress-reports" replace /></RoleRoute>} />
      <Route path="trainer-ranking" element={<TrainerRoleRoute />} />
      <Route path="billing" element={<RoleRoute roles={['admin','superadmin','school']}><BillingCenter /></RoleRoute>} />
      <Route path="inventory" element={<RoleRoute roles={['admin','superadmin','school','trainer','student']}><HardwareKitsV2 /></RoleRoute>} />
      <Route path="quizzes" element={<RoleRoute roles={['student','trainer','admin','superadmin']}><QuizzesRoute /></RoleRoute>} />
      <Route path="projects" element={<RoleRoute roles={['student','trainer','admin','superadmin']}><ProjectHubV2 /></RoleRoute>} />
      <Route path="trainer-reviews" element={<RoleRoute roles={['trainer','admin','superadmin']}><TrainerReviewsV2 /></RoleRoute>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></BrowserRouter></DataProvider></AuthProvider></ToastProvider>;
}
