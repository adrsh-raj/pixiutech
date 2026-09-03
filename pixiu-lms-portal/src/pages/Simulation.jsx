import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Workbench } from '../components/circuit-lab/workbench';

export default function Simulation() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Virtual Lab is guarded: accessible only through portal authentication
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Workbench />;
}
