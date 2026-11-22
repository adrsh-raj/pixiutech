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

  if (typeof document !== 'undefined') document.title = 'PIXIU Xen AI Tutor';

  const userRole = user?.role || 'student';
  const isA05 = Boolean(user?.is_a05_qualified || user?.trainer_profile?.xen_identity?.is_a05_qualified);

  return (
    <div className="min-h-screen bg-slate-950 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            PixiuMind Xen Workspace
          </h1>
          <p className="text-xs text-slate-400">
            Powered by frozen Step-700 checkpoint (LoRA adapter + Qwen3-14B base)
          </p>
        </div>
      </div>
      <XenChat userRole={userRole} isA05Qualified={isA05} />
    </div>
  );
}
