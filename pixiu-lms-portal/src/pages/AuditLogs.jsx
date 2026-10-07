import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Clock, Download, LockKeyhole, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function normalizeLog(log) {
  const created = log.created_at || log.timestamp || log.createdAt;
  const parsed = created ? new Date(created) : null;
  const date = parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed) : (log.date || '');
  const time = parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(parsed) : (log.time || '');
  const actorUsername = log.actor_username || log.user_id || log.username || '';
  return {
    id: log.id || `${actorUsername}-${created || 'event'}`,
    user_id: actorUsername,
    name: log.name || log.display_name || log.actor_name || actorUsername || 'Authenticated User',
    school_id: log.school_id || log.school_code || 'Network',
    event_type: String(log.event_type || log.action || 'unknown').toUpperCase(),
    role: String(log.role || log.actor_role || log.actor?.role || 'unknown').toLowerCase(),
    status: log.status || 'Verified', date, time, summary: log.summary || '',
  };
}

export default function AuditLogs() {
  const { user } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadLogs = async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch('/logs', { method: 'GET', cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
      }
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
      setLogs(rows.map(normalizeLog));
    } catch (requestError) {
      setLogs([]); setError(requestError.message || 'Unable to load audit logs.');
      toast.error(requestError.message || 'Unable to load audit logs.', 'Audit Log Error');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(); }, [user]);

  const filteredLogs = useMemo(() => logs.filter(log => {
    const roleMatch = filterRole === 'ALL' || log.role === filterRole;
    const query = searchQuery.trim().toLowerCase();
    return roleMatch && (!query || [log.user_id, log.name, log.school_id, log.event_type, log.date, log.time, log.summary].some(value => String(value || '').toLowerCase().includes(query)));
  }), [logs, searchQuery, filterRole]);

  const stats = useMemo(() => ({
    total: logs.length,
    students: logs.filter(log => log.role === 'student').length,
    trainers: logs.filter(log => log.role === 'trainer').length,
    admins: logs.filter(log => ['admin', 'superadmin'].includes(log.role)).length,
  }), [logs]);


  const openPermanentDelete = log => {
    setDeleteTarget(log);
    setDeletePassword('');
  };

  const closePermanentDelete = () => {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeletePassword('');
  };

  const permanentlyDelete = async () => {
    if (!deleteTarget?.id || !deletePassword) return;
    setDeleteBusy(true);
    try {
      const response = await apiFetch(
        '/logs/' + encodeURIComponent(deleteTarget.id) + '/permanent-delete',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: deletePassword }),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to permanently delete audit log.');
      setLogs(current => current.filter(item => String(item.id) !== String(deleteTarget.id)));
      toast.success('Audit log permanently deleted.');
      setDeleteTarget(null);
      setDeletePassword('');
    } catch (requestError) {
      toast.error(requestError.message || 'Unable to permanently delete audit log.', 'Permanent Delete Failed');
    } finally {
      setDeleteBusy(false);
    }
  };

  const exportJson = () => {
    if (!logs.length) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `pixiu_audit_logs_${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url);
    toast.success('Audit logs exported as JSON');
  };

  return <div className="space-y-6 max-w-7xl mx-auto pb-12">
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center"><ShieldCheck size={24}/></div><div><div className="flex items-center gap-2"><h1 className="text-xl font-extrabold text-slate-800">System & User Audit Logs</h1><span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Server Source</span></div><p className="text-xs text-slate-500 mt-1">Live Django/PostgreSQL audit records. Times use Asia/Kolkata.</p></div></div>
      <div className="flex gap-2"><button type="button" onClick={loadLogs} disabled={loading} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><RefreshCw size={14}/> Refresh</button><button type="button" onClick={exportJson} disabled={!logs.length || loading} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Download size={14}/> Export JSON</button></div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[['Total Events', stats.total], ['Student Events', stats.students], ['Trainer Events', stats.trainers], ['Admin Events', stats.admins]].map(([label, value]) => <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm"><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-slate-800 mt-1">{value}</p></div>)}</div>

    <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search name, ID, school, action..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"/></div><select value={filterRole} onChange={event => setFilterRole(event.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"><option value="ALL">All Roles</option><option value="student">Students</option><option value="trainer">Trainers</option><option value="school">Schools</option><option value="admin">Administrators</option></select></div>

    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]"><tr><th className="py-3 px-4">Log ID</th><th className="py-3 px-4">Date & Time</th><th className="py-3 px-4">Action</th><th className="py-3 px-4">User</th><th className="py-3 px-4">Role</th><th className="py-3 px-4">School</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Admin Action</th></tr></thead><tbody className="divide-y divide-slate-100">
      {loading ? <tr><td colSpan="8" className="py-14 text-center"><RefreshCw className="mx-auto text-slate-300 animate-spin" size={28}/><p className="mt-2 text-sm font-bold text-slate-600">Loading audit events…</p></td></tr> : error ? <tr><td colSpan="8" className="py-14 text-center"><AlertCircle className="mx-auto text-red-400" size={30}/><p className="mt-2 text-sm font-bold text-red-700">Unable to load audit events</p><p className="mt-1 text-xs text-slate-500">{error}</p><button type="button" onClick={loadLogs} className="mt-3 px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold">Try again</button></td></tr> : filteredLogs.length ? filteredLogs.map(log => <tr key={log.id} className="hover:bg-slate-50"><td className="py-3 px-4 font-mono text-slate-400">{log.id}</td><td className="py-3 px-4"><div className="font-bold text-slate-800 flex items-center gap-1"><Clock size={12}/>{log.time || '—'}</div><div className="text-[10px] text-slate-400 flex items-center gap-1"><Calendar size={11}/>{log.date || '—'}</div></td><td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">{log.event_type}</span></td><td className="py-3 px-4"><div className="font-bold text-slate-800">{log.name}</div><div className="text-[10px] text-blue-600 font-mono">@{log.user_id || '—'}</div></td><td className="py-3 px-4 capitalize">{log.role}</td><td className="py-3 px-4 font-mono">{log.school_id}</td><td className="py-3 px-4 text-emerald-600 font-bold">● {log.status}</td><td className="py-3 px-4"><button type="button" onClick={() => openPermanentDelete(log)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-black text-red-700 hover:bg-red-100"><Trash2 size={12}/> Delete permanently</button></td></tr>) : <tr><td colSpan="8" className="py-14 text-center"><AlertCircle className="mx-auto text-slate-300" size={30}/><p className="mt-2 text-sm font-bold text-slate-600">No matching audit events</p><p className="mt-1 text-xs text-slate-400">No server-side records match this filter.</p></td></tr>}
    </tbody></table></div></div>

    {deleteTarget && (
      <div
        className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="permanent-delete-title"
        onMouseDown={event => { if (event.target === event.currentTarget && !deleteBusy) closePermanentDelete(); }}
      >
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700"><LockKeyhole size={20}/></div>
              <div>
                <h2 id="permanent-delete-title" className="text-base font-black text-slate-900">Permanently delete audit log?</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">This removes the selected server audit record permanently. Your current admin password must be reverified.</p>
              </div>
            </div>
            <button type="button" onClick={closePermanentDelete} disabled={deleteBusy} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Close"><X size={16}/></button>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selected record</p>
              <p className="mt-1 truncate text-xs font-mono text-slate-700">{deleteTarget.id}</p>
              <p className="mt-1 text-xs text-slate-600">{deleteTarget.summary || (deleteTarget.event_type + ' · ' + deleteTarget.name)}</p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500">Enter your password to delete permanently</span>
              <input
                type="password"
                value={deletePassword}
                onChange={event => setDeletePassword(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') void permanentlyDelete(); }}
                autoFocus
                autoComplete="current-password"
                placeholder="Current admin password"
                disabled={deleteBusy}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-slate-50"
              />
            </label>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
              Permanent deletion cannot be undone. The password is verified only on the server and is never written to the audit log.
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={closePermanentDelete} disabled={deleteBusy} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void permanentlyDelete()} disabled={!deletePassword || deleteBusy} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 size={14}/>{deleteBusy ? 'Verifying…' : 'Verify & delete permanently'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}
