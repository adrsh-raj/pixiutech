import { useState } from 'react';
import { AlertTriangle, ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../context/AuthContext';
import { API_BASE } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RESET_SCOPES = [
  ['all_operational', 'All operational data'],
  ['learning_runtime', 'Learning runtime'],
  ['business', 'Billing & CRM'],
  ['inventory', 'Inventory'],
  ['notifications', 'Notifications'],
];

export default function DataReset() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [scope, setScope] = useState('all_operational');
  const [confirmation, setConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const handleReset = async () => {
    if (confirmation.trim() !== 'RESET PIXIU DATA') {
      toast.warning('Type RESET PIXIU DATA exactly to confirm.', 'Confirmation required');
      return;
    }
    setResetting(true);
    try {
      const phase6Base = API_BASE.replace(/\/api\/v1\/?$/, '/api');
      const accessToken = localStorage.getItem('pixiu_auth_token');
      const response = await fetch(`${phase6Base}/phase6/controlled-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ scope, confirmation: confirmation.trim() }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.detail || `Reset failed (${response.status}).`);
      toast.success('Operational data reset. Administrator accounts and audit history were preserved.', 'Reset complete');
      setConfirmation('');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Application data reset failed.', 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  if (!isAdmin) return <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm"><h1 className="text-lg font-bold text-slate-800">Admin access required</h1><p className="text-sm text-slate-500 mt-2">Only an administrator can reset application data.</p><button onClick={() => navigate('/')} className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-pixiu-blue"><ArrowLeft size={16}/> Back to Console</button></div>;

  return <div className="max-w-3xl space-y-6">
    <div className="flex items-center gap-3"><Link to="/settings" className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><ArrowLeft size={16}/></Link><div><div className="flex items-center gap-2 text-xs text-red-600 font-bold uppercase tracking-wider mb-1"><ShieldCheck size={14}/> Administrator-only action</div><h1 className="text-2xl font-bold text-slate-900">Reset Application Data</h1><p className="text-sm text-slate-500 mt-1">Clear selected operational PostgreSQL data while preserving administrator accounts and immutable audit history.</p></div></div>
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6"><div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 text-red-600"/><div><h2 className="font-extrabold text-red-900">Danger Zone</h2><p className="text-sm text-red-800 mt-1 leading-relaxed">This permanently removes selected operational records. Audit Logs are not resettable and are intentionally excluded.</p></div></div>
      <div className="mt-5"><label className="block text-xs font-extrabold uppercase tracking-wider text-red-800 mb-2">Reset scope</label><select value={scope} onChange={e => setScope(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white font-semibold text-slate-800">{RESET_SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">{['Schools / academic records remain intact','Billing records can be cleared','Sessions & attendance can be cleared','Inventory can be cleared','Notifications can be cleared','Audit logs are preserved'].map(item => <div key={item} className="rounded-lg border border-red-100 bg-white/70 px-3 py-2 text-xs font-semibold text-red-800">{item}</div>)}</div>
      <div className="mt-6 bg-white rounded-xl border border-red-200 p-4"><label className="block text-xs font-extrabold uppercase tracking-wider text-red-800 mb-2">Type RESET PIXIU DATA to confirm</label><input value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="RESET PIXIU DATA" autoComplete="off" className="w-full px-4 py-3 rounded-xl border border-red-200 bg-white font-mono text-sm font-bold text-slate-800 focus:outline-none focus:border-red-400"/><p className="text-[11px] text-slate-500 mt-2">No records are deleted until the exact confirmation text is entered and submitted.</p><button type="button" disabled={resetting || confirmation.trim() !== 'RESET PIXIU DATA'} onClick={handleReset} className={`mt-4 w-full py-3 rounded-xl font-extrabold flex items-center justify-center gap-2 ${resetting || confirmation.trim() !== 'RESET PIXIU DATA' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}><Trash2 size={17}/>{resetting ? 'Resetting…' : 'Reset Application Data'}</button></div>
    </div>
  </div>;
}
