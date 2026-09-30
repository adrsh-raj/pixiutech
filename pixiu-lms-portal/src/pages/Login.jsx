import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, User, ArrowRight, GraduationCap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Link, useNavigate } from 'react-router-dom';
import { markPerformance, measurePerformance } from '../lib/performanceDiagnostics';
import PortalFooter from '../components/PortalFooter';

const TAB_TO_ROLE = { student: 'student', school: 'school', trainer: 'trainer' };
const TURNSTILE_SITE_KEY = import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '0x4AAAAAAExglu7cgD5W2LoK';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function Login() {
  const { login, isAuthenticated, user, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRoleTab, setSelectedRoleTab] = useState('student');
  const [idleNotice, setIdleNotice] = useState(() => {
    try { const msg = sessionStorage.getItem('pixiu_idle_logout_msg'); if (msg) { sessionStorage.removeItem('pixiu_idle_logout_msg'); return msg; } } catch (e) {}
    return '';
  });

  useEffect(() => {
    let cancelled = false; let retryTimer = null;
    const renderWidget = () => {
      if (cancelled || !window.turnstile || !turnstileContainerRef.current || turnstileWidgetRef.current !== null) return;
      try {
        turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, { sitekey: TURNSTILE_SITE_KEY, action: 'login', theme: 'dark', callback: token => setTurnstileToken(token), 'expired-callback': () => setTurnstileToken(''), 'timeout-callback': () => setTurnstileToken(''), 'error-callback': () => setTurnstileToken('') });
        setTurnstileReady(true);
      } catch { turnstileWidgetRef.current = null; setTurnstileReady(false); if (!cancelled) retryTimer = window.setTimeout(renderWidget, 500); }
    };
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (window.turnstile) renderWidget();
    else { const script = existing || document.createElement('script'); script.src = TURNSTILE_SCRIPT_SRC; script.async = true; script.defer = true; script.addEventListener('load', renderWidget); if (!existing) document.head.appendChild(script); const poll = () => { if (cancelled || turnstileWidgetRef.current !== null) return; if (window.turnstile) renderWidget(); else retryTimer = window.setTimeout(poll, 250); }; poll(); }
    return () => { cancelled = true; if (retryTimer) window.clearTimeout(retryTimer); };
  }, []);

  const resetTurnstile = () => {
    setTurnstileToken(''); if (!window.turnstile || !turnstileContainerRef.current) return; const currentWidget = turnstileWidgetRef.current;
    if (currentWidget !== null) { try { window.turnstile.reset(currentWidget); return; } catch { turnstileWidgetRef.current = null; } }
    try { turnstileContainerRef.current.replaceChildren(); turnstileWidgetRef.current = window.turnstile.render(turnstileContainerRef.current, { sitekey: TURNSTILE_SITE_KEY, action: 'login', theme: 'dark', callback: token => setTurnstileToken(token), 'expired-callback': () => setTurnstileToken(''), 'timeout-callback': () => setTurnstileToken(''), 'error-callback': () => setTurnstileToken('') }); setTurnstileReady(true); } catch { turnstileWidgetRef.current = null; setTurnstileReady(false); }
  };

  const handleRolePreset = role => { setSelectedRoleTab(role); setError(''); };
  const handleUsernameChange = val => {
    setUsername(val); const upper = val.trim().toUpperCase();
    if (upper.startsWith('XYZ') || upper.startsWith(['ZP', 'S'].join('')) || upper.startsWith('STU')) setSelectedRoleTab('student');
    else if (upper.startsWith('SCH') || upper.includes('SCHOOL')) setSelectedRoleTab('school');
    else if (upper === 'ADARSHRAJ' || upper.startsWith('TR-') || upper.startsWith('TRN') || upper.includes('TRAINER') || upper.includes('FACULTY')) setSelectedRoleTab('trainer');
  };

  const handleSubmit = async e => {
    e.preventDefault(); setError('');
    if (!turnstileToken) { setError(turnstileReady ? 'Please complete the security check.' : 'Security check is still loading. Please wait a moment.'); return; }
    setLoading(true); markPerformance('login:e2e:start');
    const cleanUsername = username.trim(); const expectedRole = selectedRoleTab === 'trainer' && cleanUsername.toLowerCase() === 'adarshraj' ? 'admin' : TAB_TO_ROLE[selectedRoleTab];
    const res = await login(cleanUsername, password, expectedRole, turnstileToken); setLoading(false);
    if (res.success) {
      measurePerformance('login_api_e2e', 'login:e2e:start'); markPerformance('login:authenticated');
      toast.success(`Welcome back, ${res.user.name || res.user.username}!`, 'Authenticated');
      if (res.user.role === 'student') { try { sessionStorage.removeItem('pixiu_student_pin_notice_dismissed'); } catch (e) {} }
      const dest = res.user.role === 'student' ? (res.user.must_change_password ? '/student-password-prompt' : '/student-portal') : res.user.role === 'school' ? '/school-portal' : (res.user.role === 'admin' || res.user.role === 'superadmin') ? '/' : '/trainers';
      markPerformance('dashboard:navigation'); navigate(dest, { replace: true }); requestAnimationFrame(() => requestAnimationFrame(() => measurePerformance('dashboard_tti', 'dashboard:navigation')));
    } else {
      markPerformance('login:failed'); setError(res.error || 'Invalid credentials'); toast.error(res.error || 'Invalid credentials.', 'Login Failed'); resetTurnstile();
    }
  };

  if (authLoading || (isAuthenticated && user)) return <div className="min-h-screen bg-[#0D1212] flex items-center justify-center text-white"><div className="w-8 h-8 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div></div>;

  return <div className="min-h-screen bg-[#101917] flex flex-col selection:bg-pixiu-blue selection:text-white relative overflow-hidden"><div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[#B8D4D0]/8 rounded-full blur-3xl pointer-events-none"></div><div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-[#236F69]/10 rounded-full blur-3xl pointer-events-none"></div><div className="absolute inset-0 bg-grid-tech opacity-[0.03] pointer-events-none"></div><main className="relative z-10 flex flex-1 w-full items-center justify-center p-4"><div className="w-full max-w-md bg-[#0F1715] border border-slate-800/60 rounded-2xl p-6 sm:p-8 shadow-2xl">
    <div className="text-center mb-6"><div className="inline-block bg-white px-3.5 py-1.5 rounded-xl shadow-md border border-white/20 mb-3"><img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-8 sm:h-9 w-auto object-contain" /></div><h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-wide">PIXIU TECH</h1><p className="text-[11px] text-slate-500 font-medium mt-0.5">Robotics & AI Learning Management System</p></div>
    <div className="grid grid-cols-3 gap-1 p-1 bg-[#101917] rounded-xl border border-slate-800/60 mb-5"><button type="button" onClick={() => handleRolePreset('student')} className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${selectedRoleTab === 'student' ? 'bg-pixiu-blue text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><GraduationCap size={14} /> Student</button><button type="button" onClick={() => handleRolePreset('trainer')} className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${selectedRoleTab === 'trainer' ? 'bg-pixiu-blue text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><User size={14} /> Trainer / Faculty</button><button type="button" onClick={() => handleRolePreset('school')} className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${selectedRoleTab === 'school' ? 'bg-pixiu-blue text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><ShieldCheck size={14} /> School</button></div>
    {idleNotice && <div className="mb-4 p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-medium flex items-center gap-2.5"><Lock size={16} className="shrink-0 text-amber-400" /><span>{idleNotice}</span></div>}
    {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2"><AlertCircle size={15} className="shrink-0" /><span>{error}</span></div>}
    <form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">{selectedRoleTab === 'student' ? 'Student ID' : selectedRoleTab === 'school' ? 'School ID' : 'Trainer / Admin ID'}</label><div className="relative"><User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" value={username} onChange={e => handleUsernameChange(e.target.value)} placeholder={selectedRoleTab === 'student' ? 'Enter Student Roll ID' : selectedRoleTab === 'school' ? 'Enter School Partner ID' : 'Enter Username / ID'} autoCapitalize="none" autoCorrect="off" required className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-600 transition-colors font-medium placeholder:text-slate-600" /></div></div>
    <div><label htmlFor="login-password" className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">Password / PIN</label><div className="relative"><Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password or PIN" required className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-pixiu-blue transition-colors font-medium placeholder:text-slate-600" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 px-2 py-2 min-h-[76px] flex items-center justify-center overflow-hidden"><div ref={turnstileContainerRef} aria-label="Cloudflare security check" /></div>
    <button type="submit" disabled={loading || !turnstileToken} className="w-full bg-pixiu-blue hover:bg-teal-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2 text-xs sm:text-sm transition-all cursor-pointer mt-2">{loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>Sign In</span><ArrowRight size={15} /></>}</button>
    <div className="pt-2 text-center"><Link to="/privacy" className="text-[11px] font-semibold text-slate-500 hover:text-slate-300">Privacy Policy</Link><span className="px-2 text-slate-700">·</span><Link to="/terms" className="text-[11px] font-semibold text-slate-500 hover:text-slate-300">Terms &amp; Conditions</Link></div>
    {selectedRoleTab === 'student' && <div className="pt-1 text-center"><Link to="/student-forgot-password" className="text-xs font-bold text-teal-500 hover:text-teal-400">Forgot password?</Link></div>}
  </form>
  </div></main><div className="relative z-10 w-full"><PortalFooter /></div></div>;
}
