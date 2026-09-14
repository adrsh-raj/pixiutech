import { useEffect, useMemo, useState } from 'react';
import { KeyRound, ShieldCheck, RefreshCw, Eye, EyeOff, ArrowLeft, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function SchoolCredentials() {
  const { user } = useAuth();
  const toast = useToast();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [forms, setForms] = useState({});
  const [visible, setVisible] = useState({});
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/schools', { cache: 'no-store' });
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload.error || payload.detail || payload.message || 'Unable to load schools.');
      const rows = Array.isArray(payload) ? payload : payload.data || payload.results || [];
      setSchools(rows);
      setForms(prev => rows.reduce((acc, school) => ({ ...acc, [school.id]: prev[school.id] || '' }), {}));
    } catch (error) {
      toast.error(error.message, 'Could not load schools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
  }, []);

  const rows = useMemo(() => schools.filter(s => s?.id || s?.code), [schools]);

  const resetPassword = async school => {
    const password = forms[school.id] || '';
    if (password.length < 8) {
      toast.warning('Use a password with at least 8 characters.', 'Password too short');
      return;
    }

    setSavingId(school.id);
    try {
      const response = await apiFetch(`/schools/${encodeURIComponent(school.id)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.detail || payload.message || 'Unable to save school password.');
      setForms(prev => ({ ...prev, [school.id]: '' }));
      setVisible(prev => ({ ...prev, [school.id]: false }));
      toast.success(`${school.name} can now sign in using the school ID and new password.`, 'School password saved');
    } catch (error) {
      toast.error(error.message, 'Password save failed');
    } finally {
      setSavingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-xl bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Admin access required</h1>
        <p className="text-sm text-slate-500 mt-2">Only an administrator can manage school passwords.</p>
        <Link to="/schools" className="inline-flex items-center gap-2 mt-5 text-sm font-bold text-pixiu-blue"><ArrowLeft size={16} /> Back to Schools</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
            <ShieldCheck size={14} className="text-emerald-600" /> Admin-only credential management
          </div>
          <h1 className="text-2xl font-bold text-slate-900">School Login Credentials</h1>
          <p className="text-sm text-slate-500 mt-1">Set or reset a school's portal password at any time. Existing passwords are never displayed.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={loadSchools} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50">
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/schools" className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800">
            <ArrowLeft size={14} /> Schools
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">Loading schools...</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">No schools are registered yet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {rows.map(school => {
            const schoolId = school.code || school.id;
            const password = forms[school.id] || '';
            return (
              <div key={school.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-pixiu-blue"><Building2 size={19} /></div>
                    <div>
                      <h2 className="font-extrabold text-slate-900">{school.name}</h2>
                      <p className="text-xs text-slate-500 mt-0.5">School portal credentials</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${school.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {school.status || 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">School ID / Username</div>
                    <div className="font-mono font-bold text-slate-800 mt-1">{schoolId}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Login Portal</div>
                    <div className="font-semibold text-slate-700 mt-1">School</div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Set / Reset Password</label>
                  <div className="relative">
                    <input
                      type={visible[school.id] ? 'text' : 'password'}
                      value={password}
                      onChange={e => setForms(prev => ({ ...prev, [school.id]: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      className="w-full px-3 py-2.5 pr-11 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-pixiu-blue"
                    />
                    <button type="button" onClick={() => setVisible(prev => ({ ...prev, [school.id]: !prev[school.id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label={visible[school.id] ? 'Hide password' : 'Show password'}>
                      {visible[school.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">The password is hashed server-side. Admin can reset it whenever the school forgets it.</p>
                </div>

                <button
                  type="button"
                  disabled={savingId === school.id || password.length < 8}
                  onClick={() => resetPassword(school)}
                  className={`mt-4 w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${savingId === school.id || password.length < 8 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-pixiu-blue hover:bg-blue-600 text-white'}`}
                >
                  <KeyRound size={16} />
                  {savingId === school.id ? 'Saving...' : 'Save School Password'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
