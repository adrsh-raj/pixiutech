import { lazy, Suspense, Component, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import PortalShell from './components/PortalShell';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { markPerformance, measurePerformance } from './lib/performanceDiagnostics';
import PortalMeta from './components/PortalMeta';

const CHUNK_RECOVERY_KEY = 'pixiu_chunk_recovery_attempted';

function lazyWithChunkRecovery(importer) {
  return lazy(() => importer().then(module => {
    try { sessionStorage.removeItem(CHUNK_RECOVERY_KEY); } catch (e) {}
    return module;
  }).catch(error => {
    const message = String(error?.message || error || '');
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|dynamically imported module/i.test(message);
    if (!isChunkError) throw error;
    let shouldReload = false;
    try { shouldReload = sessionStorage.getItem(CHUNK_RECOVERY_KEY) !== '1'; if (shouldReload) sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1'); } catch (e) { shouldReload = true; }
    if (shouldReload && typeof window !== 'undefined') { const url = new URL(window.location.href); url.searchParams.set('chunk_recovery', String(Date.now())); window.location.replace(url.toString()); return new Promise(() => {}); }
    throw error;
  }));
}

const AdminCommandCenter = lazyWithChunkRecovery(() => import('./pages/AdminCommandCenter'));
const Students = lazyWithChunkRecovery(() => import('./pages/StudentsV2'));
const HardwareKitsV2 = lazyWithChunkRecovery(() => import('./pages/HardwareKitsV2'));
const TrainerOperationsV2 = lazyWithChunkRecovery(() => import('./pages/TrainerOperationsV2'));
const TrainerAssignments = lazyWithChunkRecovery(() => import('./pages/TrainerAssignments'));
const TrainerWorkspace = lazyWithChunkRecovery(() => import('./pages/TrainerWorkspace'));
const TrainerClasses = lazyWithChunkRecovery(() => import('./pages/TrainerClasses'));
const TrainerAttendance = lazyWithChunkRecovery(() => import('./pages/TrainerAttendance'));
const TrainerMaterials = lazyWithChunkRecovery(() => import('./pages/TrainerMaterials'));
const TrainerReviewsV2 = lazyWithChunkRecovery(() => import('./pages/TrainerReviewsV2'));
const TrainerCertificates = lazyWithChunkRecovery(() => import('./pages/TrainerCertificates'));
const StudentClasses = lazyWithChunkRecovery(() => import('./pages/StudentClasses'));
const TrainerCredentials = lazyWithChunkRecovery(() => import('./pages/TrainerCredentials'));
const SchoolCredentials = lazyWithChunkRecovery(() => import('./pages/SchoolCredentials'));
const DataReset = lazyWithChunkRecovery(() => import('./pages/DataReset'));
const Comms = lazyWithChunkRecovery(() => import('./pages/Comms'));
const Leads = lazyWithChunkRecovery(() => import('./pages/Leads'));
const WebsiteEnquiries = lazyWithChunkRecovery(() => import('./pages/WebsiteEnquiries'));
const CareerManagement = lazyWithChunkRecovery(() => import('./pages/CareerManagement'));
const SchoolsV2 = lazyWithChunkRecovery(() => import('./pages/SchoolsV2'));
const Payments = lazyWithChunkRecovery(() => import('./pages/Payments'));
const Notifications = lazyWithChunkRecovery(() => import('./pages/Notifications'));
const ContentHub = lazyWithChunkRecovery(() => import('./pages/ContentHub'));
const Curriculum = lazyWithChunkRecovery(() => import('./pages/Curriculum'));
const Login = lazyWithChunkRecovery(() => import('./pages/Login'));
const VerifyV2 = lazyWithChunkRecovery(() => import('./pages/VerifyV2')); 
const PrivacyPolicy = lazyWithChunkRecovery(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazyWithChunkRecovery(() => import('./pages/TermsAndConditions'));
const StudentPortal = lazyWithChunkRecovery(() => import('./pages/StudentPortal'));
const SchoolPortal = lazyWithChunkRecovery(() => import('./pages/SchoolPortal'));
const AuditLogs = lazyWithChunkRecovery(() => import('./pages/AuditLogs'));
const ClassRankingPage = lazyWithChunkRecovery(() => import('./pages/ClassRankingPage'));
const AttendanceCenter = lazyWithChunkRecovery(() => import('./pages/AttendanceCenter'));
const StudentProgressPage = lazyWithChunkRecovery(() => import('./pages/StudentProgressPage'));
const PerformanceAnalyticsPage = lazyWithChunkRecovery(() => import('./pages/PerformanceAnalyticsPage'));
const SchoolProgressReports = lazyWithChunkRecovery(() => import('./pages/SchoolProgressReports'));
const BillingCenter = lazyWithChunkRecovery(() => import('./pages/BillingCenter'));
const QuizHub = lazyWithChunkRecovery(() => import('./pages/QuizHub'));
const StudentQuizHubV2 = lazyWithChunkRecovery(() => import('./pages/StudentQuizHubV2'));
const ProjectHubV2 = lazyWithChunkRecovery(() => import('./pages/ProjectHubV2'));
const SessionSchedulerV4 = lazyWithChunkRecovery(() => import('./pages/SessionSchedulerV4'));
const CourseCompletionV2 = lazyWithChunkRecovery(() => import('./pages/CourseCompletionV2'));
const Simulation = lazyWithChunkRecovery(() => import('./pages/Simulation'));
const StudentPassword = lazyWithChunkRecovery(() => import('./pages/StudentPassword'));
const StudentPasswordPrompt = lazyWithChunkRecovery(() => import('./pages/StudentPasswordPrompt'));
const StudentForgotPassword = lazyWithChunkRecovery(() => import('./pages/StudentForgotPassword'));
const TrainerStudentPasswordReset = lazyWithChunkRecovery(() => import('./pages/TrainerStudentPasswordReset'));
const StudentCredentialMigration = lazyWithChunkRecovery(() => import('./pages/StudentCredentialMigration'));

class ChunkErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Simulation chunk load error:', error); }
  render() { if (this.state.hasError) return <div className="min-h-screen bg-[#070B14] flex items-center justify-center text-white p-6"><div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center"><h3 className="text-lg font-bold mb-2">Virtual Lab Update</h3><p className="text-sm text-slate-400 mb-5">The latest Virtual Lab build could not be loaded.</p><button type="button" onClick={() => this.setState({ hasError: false })} className="w-full px-5 py-3 bg-blue-600 rounded-xl font-bold">Try again</button></div></div>; return this.props.children; }
}

const LoadingScreen = ({ dark = true }) => <div className={`min-h-screen ${dark ? 'bg-slate-900' : 'bg-slate-50'} flex items-center justify-center`}><div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;
const roleLabel = { admin: 'Pixiu Tech Console', superadmin: 'Pixiu Tech Console', trainer: 'Trainer Workspace', school: 'School Operations', student: 'Student Portal' };
const roleSubtitle = { admin: 'Robotics & AI Operating System', superadmin: 'Robotics & AI Operating System', trainer: 'Teaching workspace', school: 'School workspace', student: 'Learning workspace' };

function RoutePerformance({ children }) {
  const location = useLocation();
  const measuredKeyRef = useRef('');
  useEffect(() => { let firstFrame = 0; let secondFrame = 0; const routeKey = `${location.pathname}`; const navMark = 'dashboard:navigation'; const hasNavStart = typeof performance !== 'undefined' && typeof performance.getEntriesByName === 'function' && performance.getEntriesByName('pixiu:dashboard:navigation').length > 0; if (!hasNavStart) markPerformance(navMark); firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(() => { if (measuredKeyRef.current === routeKey) return; measuredKeyRef.current = routeKey; measurePerformance('dashboard_tti', navMark); }); }); return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); }; }, [location.pathname]);
  return children;
}

const Settings = () => <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"><h2 className="text-xl font-bold text-slate-800 mb-2">System Configuration & Master ID Rules</h2><p className="text-sm text-slate-500 mb-6">Rules and operational controls for the live Django/PostgreSQL system.</p><div className="space-y-4 text-sm"><div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="font-bold text-slate-700">Student ID Auto-Generation Format</p><p className="font-mono text-blue-600 text-xs font-bold mt-1">Managed by Django from the school, class and roll records.</p></div><div className="p-4 bg-slate-50 rounded-xl border border-slate-100"><p className="font-bold text-slate-700">Database & Auth Status</p><p className="text-emerald-600 font-bold text-xs mt-1">Django REST API + PostgreSQL + JWT</p></div><Link to="/trainer-credentials" className="block p-4 bg-blue-50 rounded-xl border border-blue-100"><p className="font-bold text-blue-900">Trainer Login Credentials</p><p className="text-xs text-blue-700 mt-1">Reset trainer portal passwords securely from the admin console.</p></Link><Link to="/school-credentials" className="block p-4 bg-emerald-50 rounded-xl border border-emerald-100"><p className="font-bold text-emerald-900">School Login Credentials</p><p className="text-xs text-emerald-700 mt-1">Set or reset school portal passwords securely.</p></Link><Link to="/student-credentials" className="block p-4 bg-violet-50 rounded-xl border border-violet-100"><p className="font-bold text-violet-900">Student Credential Migration</p><p className="text-xs text-violet-700 mt-1">Replace deterministic student passwords with random temporary PINs and download the credential sheet.</p></Link><Link to="/data-reset" className="block p-4 bg-red-50 rounded-xl border border-red-100"><p className="font-bold text-red-900">Danger Zone — Operational Data Reset</p><p className="text-xs text-red-700 mt-1">Use only the controlled reset workflow; administrator access is preserved.</p></Link></div></div>;

function ProtectedLayout() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; const role = user?.role || 'admin'; return <PortalShell role={role === 'superadmin' ? 'admin' : role} title={roleLabel[role] || 'Pixiu Tech Console'} subtitle={roleSubtitle[role] || 'Pixiu Tech Operating System'}><Suspense fallback={<LoadingScreen />}><RoutePerformance><Outlet /></RoutePerformance></Suspense></PortalShell>; }
function AdminOnly({ children }) { const { user } = useAuth(); return user?.role === 'admin' || user?.role === 'superadmin' ? children : <Navigate to="/" replace />; }
function RoleRoute({ roles, children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (!roles.includes(user?.role)) return <Navigate to="/" replace />; return children; }
function TrainerConsoleRoute() { const { user } = useAuth(); return user?.role === 'trainer' ? <TrainerWorkspace /> : <AdminOnly><TrainerOperationsV2 /></AdminOnly>; }
function AttendanceRoute() { const { user } = useAuth(); return user?.role === 'trainer' ? <TrainerAttendance /> : <AttendanceCenter />; }
function StudentRouteGuard() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role !== 'student') return <Navigate to="/" replace />; return <RoutePerformance><StudentPortal /></RoutePerformance>; }
function SchoolRouteGuard() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (user?.role !== 'school') return <Navigate to="/" replace />; return <RoutePerformance><SchoolPortal /></RoutePerformance>; }
function GuestRouteGuard({ children }) { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (isAuthenticated && user) { const destination = user.role === 'student' ? '/student-portal' : user.role === 'school' ? '/school-portal' : user.role === 'trainer' ? '/trainers' : '/'; return <Navigate to={destination} replace />; } return children; }
function TrainerRoleRoute() { const { isAuthenticated, user, loading } = useAuth(); if (loading) return <LoadingScreen />; if (!isAuthenticated) return <Navigate to="/login" replace />; if (!['trainer', 'admin', 'superadmin'].includes(user?.role)) return <Navigate to="/" replace />; return <ClassRankingPage />; }
function SchoolPerformanceRoute() { return <PerformanceAnalyticsPage role="school" />; }
function SessionsRoute() { const { user } = useAuth(); return user?.role === 'student' ? <StudentClasses /> : <SessionSchedulerV4 />; }
function QuizzesRoute() { const { user } = useAuth(); return user?.role === 'student' ? <StudentQuizHubV2 /> : <QuizHub />; }

export default function App() { return <ToastProvider><AuthProvider><DataProvider><BrowserRouter><AnalyticsTracker /><PortalMeta /><Suspense fallback={<LoadingScreen />}><Routes>
  <Route path="/verify" element={<VerifyV2 />} />
  <Route path="/privacy" element={<PrivacyPolicy />} />
  <Route path="/terms" element={<TermsAndConditions />} />
  <Route path="/login" element={<GuestRouteGuard><Login /></GuestRouteGuard>} />
  <Route path="/student-forgot-password" element={<StudentForgotPassword />} />
  <Route path="/simulation" element={<ChunkErrorBoundary><Simulation /></ChunkErrorBoundary>} />
  <Route path="/student-portal" element={<StudentRouteGuard />} />
  <Route path="/school-portal" element={<SchoolRouteGuard />} />
  <Route path="/" element={<ProtectedLayout />}>
    <Route index element={<AdminOnly><AdminCommandCenter /></AdminOnly>} />
    <Route path="leads" element={<AdminOnly><Leads /></AdminOnly>} />
    <Route path="website-enquiries" element={<AdminOnly><WebsiteEnquiries /></AdminOnly>} />
    <Route path="careers" element={<AdminOnly><CareerManagement /></AdminOnly>} />
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
    <Route path="trainer-student-passwords" element={<RoleRoute roles={['admin','superadmin','trainer']}><TrainerStudentPasswordReset /></RoleRoute>} />
    <Route path="trainer-certificates" element={<RoleRoute roles={['admin','superadmin','trainer']}><TrainerCertificates /></RoleRoute>} />
    <Route path="course-completion" element={<RoleRoute roles={['admin','superadmin','trainer']}><CourseCompletionV2 /></RoleRoute>} />
    <Route path="school-credentials" element={<AdminOnly><SchoolCredentials /></AdminOnly>} />
    <Route path="student-credentials" element={<AdminOnly><StudentCredentialMigration /></AdminOnly>} />
    <Route path="student-password" element={<RoleRoute roles={['student']}><StudentPassword /></RoleRoute>} />
    <Route path="student-password-prompt" element={<RoleRoute roles={['student']}><StudentPasswordPrompt /></RoleRoute>} />
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
</Routes></Suspense></BrowserRouter></DataProvider></AuthProvider></ToastProvider>; }
