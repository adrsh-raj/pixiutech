import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { XenChat } from '../components/xen/XenChat';

export default function XenTutor() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-400" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (typeof document !== 'undefined') document.title = '8square AI Workspace';

  const userRole = user?.role || 'student';
  const isA05 = Boolean(user?.is_a05_qualified || user?.trainer_profile?.xen_identity?.is_a05_qualified);

  if (!['admin', 'superadmin', 'trainer', 'student'].includes(userRole)) {
    const title = userRole === 'school' ? 'School Access Restricted' : 'Role Access Restricted';
    const description = userRole === 'school'
      ? 'School accounts are not included in the 8square pilot. Student tester, Trainer and Admin accounts are admitted only when explicitly allowlisted by the portal team.'
      : 'This account role is not included in the 8square pilot.';
    const errorPolicy = userRole === 'school' ? 'HTTP 403 SCHOOL_ACCESS_DISABLED' : 'HTTP 403 ROLE_ACCESS_DISABLED';

    return (
      <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl bg-slate-900/90 border border-amber-500/30 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
            <span className="text-2xl font-bold">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            {description}
          </p>
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-400">
            Error Policy: <code className="text-amber-400 font-mono">{errorPolicy}</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            8square AI Workspace
          </h1>
          <p className="text-xs text-slate-400">
            Powered by frozen Xen Step-700 checkpoint (LoRA adapter + Qwen3-14B base)
          </p>
        </div>
      </div>
      <XenChat userRole={userRole} isA05Qualified={isA05} />
    </div>
  );
}
