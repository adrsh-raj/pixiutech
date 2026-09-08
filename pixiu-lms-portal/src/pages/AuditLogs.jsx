import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, Clock, Download, GraduationCap, KeyRound, RefreshCw, Search, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config/api';

const getToken = () => localStorage.getItem('pixiu_auth_token');

const normalizeLog = log => {
  const created = log.created_at || log.timestamp || log.createdAt;
  let date = log.date || '';
  let time = log.time || '';
  if (created) {
    const parsed = new Date(created);
    if (!Number.isNaN(parsed.getTime())) {
      date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
      time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(parsed);
    }
  }
  const actorUsername = log.actor_username || log.user_id || log.username || '';
  const rawRole = log.role || log.actor_role || (log.actor?.role) || '';
  const role = String(rawRole).toLowerCase() || 'unknown';
  const action = log.event_type || log.action || 'Login';
  const summary = log.summary || '';
  return {
    id: log.id || `${actorUsername}-${created || Math.random()}`,
    user_id: actorUsername,
    name: log.name || log.display_name || log.actor_name || actorUsername || 'Authenticated User',
    school_id: log.school_id || log.school_code || 'Network',
    event_type: String(action).toUpperCase(),
    role,
    status: log.status || 'Verified',
    date,
    time,
    summary,
  };
};

export default function AuditLogs() {
  const { user } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const request = async path => {
    const token = getToken();
    const headers = new Headers();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API_BASE}${path}`, { headers, cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
    if (!response.ok) throw new Error(payload.detail || payload.error || `Request failed (${response.status})`);
    return payload;
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const payload = await request('/logs');
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
      setLogs(rows.map(normalizeLog));
    } catch (error) {
      setLogs([]);
      toast.error(error.message || 'Unable to load audit logs', 'Audit Log Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [user]);

  const handleExportJSON = () => {
    if (!logs.length) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pixiu_audit_logs_${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Audit logs exported as JSON');
  };

  const filteredLogs = useMemo(() => logs.filter(log => {
    const matchRole = filterRole === 'ALL' || log.role === filterRole;
    const query = searchQuery.trim().toLowerCase();
    const fields = [log.user_id, log.name, log.school_id, log.event_type, log.date, log.time, log.summary];
    return matchRole && (!query || fields.some(value => String(value || '').toLowerCase().includes(query)));
  }), [logs, searchQuery, filterRole]);

  const stats = useMemo(() => ({
    studentCount: logs.filter(l => l.role === 'student').length,
    trainerCount: logs.filter(l => l.role === 'trainer').length,
    adminCount: logs.filter(l => ['admin', 'superadmin'].includes(l.role)).length,
    schoolCount: logs.filter(l => l.role === 'school').length,
  }), [logs]);

  const roleClass = role => {
    switch (String(role || '').toLowerCase()) {
      case 'student': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'trainer': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'school': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/20"><ShieldCheck size={24} /></div>
          <div><div className="flex items-center gap-2"><h1 className="text-xl font-extrabold text-slate-800 tracking-tight">System & User Login Audit Logs</h1><span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Server Source</span></div><p className="text-xs text-slate-500 mt-0.5">Live records from the Django/PostgreSQL audit store. Times are displayed in Asia/Kolkata.</p></div>
        </div>
        <div className="flex items-center gap-2"><button onClick={loadLogs} disabled={loading} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><RefreshCw size={14} /> Refresh</button><button onClick={handleExportJSON} disabled={!logs.length} className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"><Download size={14} /> Export JSON</button></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Total Recorded Events', logs.length, UserCheck, 'text-blue-600', 'bg-blue-50'],
          ['Student Sessions', stats.studentCount, GraduationCap, 'text-emerald-600', 'bg-emerald-50'],
          ['Trainer Sessions', stats.trainerCount, Clock, 'text-purple-600', 'bg-purple-50'],
          ['Admin Sessions', stats.adminCount, KeyRound, 'text-blue-600', 'bg-blue-50'],
        ].map(([label, value, Icon, iconText, iconBg]) => <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4"><div className={`w-10 h-10 rounded-xl ${iconBg} ${iconText} flex items-center justify-center shrink-0`}><Icon size={20} /></div><div><p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-slate-800">{value}</p></div></div>)}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-96"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, ID, school, action..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none" /></div>
        <div className="flex items-center gap-2 w-full sm:w-auto"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role:</label><select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"><option value="ALL">All Roles ({logs.length})</option><option value="student">Students ({stats.studentCount})</option><option value="trainer">Trainers ({stats.trainerCount})</option><option value="school">School Partners ({stats.schoolCount})</option><option value="admin">Administrators ({stats.adminCount})</option></select></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]"><tr><th className="py-3.5 px-4">Log ID</th><th className="py-3.5 px-4">Date & Time</th><th className="py-3.5 px-4">Action</th><th className="py-3.5 px-4">User</th><th className="py-3.5 px-4">Role</th><th className="py-3.5 px-4">School</th><th className="py-3.5 px-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100 font-medium">
          {filteredLogs.length ? filteredLogs.map(log => <tr key={log.id} className="hover:bg-slate-50/80"><td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{log.id}</td><td className="py-3.5 px-4 whitespace-nowrap"><div className="font-bold text-slate-800 flex items-center gap-1.5"><Clock size={12} />{log.time || '—'}</div><div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Calendar size={11} />{log.date || '—'}</div></td><td className="py-3.5 px-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">{log.event_type}</span></td><td className="py-3.5 px-4"><div className="font-bold text-slate-800">{log.name}</div><div className="text-[10px] text-blue-600 font-mono">@{log.user_id || '—'}</div></td><td className="py-3.5 px-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${roleClass(log.role)}`}>{log.role}</span></td><td className="py-3.5 px-4"><span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{log.school_id || 'Network'}</span></td><td className="py-3.5 px-4"><span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">● {log.status}</span></td></tr>) : <tr><td colSpan="7" className="py-12 text-center text-slate-400"><div className="flex flex-col items-center gap-2"><AlertCircle size={32} className="text-slate-300"/><p className="font-bold text-slate-600 text-sm">No matching audit events</p><p className="text-xs text-slate-400">{loading ? 'Loading from the server…' : 'No server-side records match this filter.'}</p></div></td></tr>}
        </tbody></table></div>
      </div>
    </div>
  );
}
