import { useEffect, useMemo, useState } from 'react';
import { KeyRound, ShieldCheck, RefreshCw, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function TrainerCredentials() {
  const { user } = useAuth();
  const toast = useToast();
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [forms, setForms] = useState({});
  const [visible, setVisible] = useState({});
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const loadTrainers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/trainers', { cache: 'no-store' });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload.error || payload.detail || payload.message || 'Unable to load trainers.');
      const rows = Array.isArray(payload) ? payload : payload.results || payload.data || [];
      setTrainers(rows);
      setForms(prev => rows.reduce((acc, trainer) => ({ ...acc, [trainer.id]: prev[trainer.id] || '' }), {}));
    } catch (error) {
      toast.error(error.message, 'Could not load trainers');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTrainers(); }, []);
  const rows = useMemo(() => trainers.filter(t => t?.id), [trainers]);

  const resetPassword = async trainer => {
    const password = forms[trainer.id] || '';
    if (password.length < 12) { toast.warning('Use a password with at least 12 characters.', 'Password too short'); return; }
    setSavingId(trainer.id);
    try {
      const response = await apiFetch(`/trainers/${encodeURIComponent(trainer.id)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.detail || payload.message || 'Unable to reset password.');
      setForms(prev => ({ ...prev, [trainer.id]: '' }));
      setVisible(prev => ({ ...prev, [trainer.id]: false }));
      toast.success(`${trainer.name} can now sign in with the new password.`, 'Password reset');
    } catch (error) { toast.error(error.message, 'Password reset failed'); }
    finally { setSavingId(null); }
  };

  if (!isAdmin) return <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"><h1 className="text-lg font-bold text-slate-800">Admin access required</h1><p className="text-sm text-slate-500 mt-2">Only an administrator can reset trainer passwords.</p><Link to="/trainers" className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-pixiu-blue"><ArrowLeft size={16} /> Back to Trainers</Link></div>;

  return <div className="max-w-5xl space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider mb-1"><ShieldCheck size={14} className="text-emerald-600" /> Admin-only credential management</div><h1 className="text-2xl font-bold text-slate-900">Trainer Login Credentials</h1><p className="text-sm text-slate-500 mt-1">Reset a trainer's portal password without exposing the existing password.</p></div><div className="flex items-center gap-2"><button type="button" onClick={loadTrainers} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"><RefreshCw size={14} /> Refresh</button><Link to="/trainers" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"><ArrowLeft size={14} /> Trainers</Link></div></div>
    {loading ? <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">Loading trainers...</div> : rows.length === 0 ? <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">No trainers are registered yet.</div> : <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{rows.map(trainer => {
      const username = trainer.trainer_id || trainer.account_username || '';
      const password = forms[trainer.id] || '';
      return <div key={trainer.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"><div className="flex items-start justify-between gap-3 mb-5"><div><h2 className="font-extrabold text-slate-900">{trainer.name}</h2><p className="text-xs text-pixiu-blue font-semibold mt-0.5">{trainer.role || 'Trainer / Faculty'}</p></div><span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">{trainer.status || 'unknown'}</span></div><div className="grid grid-cols-2 gap-3 mb-4"><div className="bg-slate-50 rounded-xl border border-slate-100 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login Username</div><div className="font-mono font-bold text-slate-800 mt-1 break-all">{username || 'Not assigned'}</div></div><div className="bg-slate-50 rounded-xl border border-slate-100 p-3"><div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Database Record ID</div><div className="font-mono text-xs text-slate-500 mt-1 break-all">{trainer.id}</div></div></div><div className="border-t border-slate-100 pt-4"><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Set New Password</label><div className="relative"><input type={visible[trainer.id] ? 'text' : 'password'} value={password} onChange={e => setForms(prev => ({ ...prev, [trainer.id]: e.target.value }))} placeholder="Minimum 12 characters" minLength={12} className="w-full px-3 py-2.5 pr-11 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-pixiu-blue"/><button type="button" onClick={() => setVisible(prev => ({ ...prev, [trainer.id]: !prev[trainer.id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={visible[trainer.id] ? 'Hide password' : 'Show password'}>{visible[trainer.id] ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><p className="text-[10px] text-slate-400 mt-1.5">Password is hashed server-side; the old password is never displayed.</p></div><button type="button" disabled={savingId === trainer.id || password.length < 12} onClick={() => resetPassword(trainer)} className={`mt-4 w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${savingId === trainer.id || password.length < 12 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-pixiu-blue hover:bg-blue-600 text-white'}`}><KeyRound size={16} />{savingId === trainer.id ? 'Resetting...' : 'Reset & Save Password'}</button></div>;
    })}</div>}
  </div>;
}
