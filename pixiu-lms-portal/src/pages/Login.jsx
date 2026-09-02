import { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, ArrowRight, GraduationCap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRoleTab, setSelectedRoleTab] = useState('student'); // 'student' | 'trainer' | 'school'

  const [idleNotice, setIdleNotice] = useState(() => {
    try {
      const msg = sessionStorage.getItem('pixiu_idle_logout_msg');
      if (msg) {
        sessionStorage.removeItem('pixiu_idle_logout_msg');
        return msg;
      }
    } catch (e) {}
    return '';
  });

  const handleRolePreset = (role) => {
    setSelectedRoleTab(role);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(username, password, selectedRoleTab);
    setLoading(false);

    if (res.success) {
      toast.success(`Welcome back, ${res.user.name || res.user.username}!`, 'Authenticated');
      if (res.user.role === 'student') {
        navigate('/student-portal');
      } else if (res.user.role === 'school') {
        navigate('/school-portal');
      } else if (res.user.role === 'trainer') {
        navigate('/trainers');
      } else {
        navigate('/');
      }
    } else {
      setError(res.error || 'Invalid credentials');
      toast.error(res.error || 'Invalid credentials.', 'Login Failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-pixiu-blue selection:text-white relative overflow-hidden">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="inline-block bg-white px-3.5 py-1.5 rounded-xl shadow-md border border-white/20 mb-3">
            <img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-8 sm:h-9 w-auto object-contain" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">PIXIU TECH</h1>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Sign in to your learning & management portal</p>
        </div>

        {/* Clean 3 Role Selector Tabs: Student, Trainer/Faculty, School Portal */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => handleRolePreset('student')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedRoleTab === 'student' 
                ? 'bg-pixiu-blue text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap size={14} /> Student
          </button>
          
          <button
            type="button"
            onClick={() => handleRolePreset('trainer')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedRoleTab === 'trainer' 
                ? 'bg-pixiu-blue text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User size={14} /> Trainer / Faculty
          </button>

          <button
            type="button"
            onClick={() => handleRolePreset('school')}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              selectedRoleTab === 'school' 
                ? 'bg-pixiu-blue text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={14} /> School
          </button>
        </div>

        {/* Inactivity Auto-Logout Notification */}
        {idleNotice && (
          <div className="mb-4 p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-medium flex items-center gap-2.5">
            <Lock size={16} className="shrink-0 text-amber-400" />
            <span>{idleNotice}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              {selectedRoleTab === 'student' ? 'Student ID' : selectedRoleTab === 'school' ? 'School ID' : 'Trainer / Admin ID'}
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={
                  selectedRoleTab === 'student' 
                    ? 'Enter Student Roll ID' 
                    : selectedRoleTab === 'school'
                    ? 'Enter School Partner ID'
                    : 'Enter Username / ID'
                }
                autoCapitalize="none"
                autoCorrect="off"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-pixiu-blue transition-colors font-medium placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-pixiu-blue transition-colors font-medium placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pixiu-blue hover:bg-blue-600 active:scale-98 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                Sign In <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
