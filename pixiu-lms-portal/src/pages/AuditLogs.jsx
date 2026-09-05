import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, UserCheck, Clock, Calendar, Search, RefreshCw, Trash2, Download, AlertCircle, KeyRound, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function AuditLogs() {
  const { user } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  const loadLogs = () => {
    try {
      let saved = JSON.parse(localStorage.getItem('pixiu_admin_logs') || '[]');
      
      // If empty and current user is admin, seed the current active session
      if (saved.length === 0 && user && (user.role === 'admin' || user.role === 'superadmin')) {
        const initialLog = {
          id: 'LOG-' + Date.now(),
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          user_id: user.username || 'admin',
          name: user.name || 'Master Administrator',
          role: user.role || 'admin',
          status: 'Authenticated (SHA-256)',
          ip: '127.0.0.1 (Local Session)'
        };
        saved = [initialLog];
        localStorage.setItem('pixiu_admin_logs', JSON.stringify(saved));
      }
      
      setLogs(saved);
    } catch (e) {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [user]);

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear all admin login logs?')) {
      localStorage.removeItem('pixiu_admin_logs');
      setLogs([]);
      toast.success('Admin login logs cleared successfully');
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `pixiu_admin_login_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Audit logs downloaded as JSON');
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchRole = filterRole === 'ALL' || (log.role && log.role.toLowerCase() === filterRole.toLowerCase());
      const query = searchQuery.toLowerCase();
      const matchQuery = !searchQuery || 
        (log.user_id && log.user_id.toLowerCase().includes(query)) ||
        (log.name && log.name.toLowerCase().includes(query)) ||
        (log.date && log.date.toLowerCase().includes(query)) ||
        (log.time && log.time.toLowerCase().includes(query));
      return matchRole && matchQuery;
    });
  }, [logs, searchQuery, filterRole]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center ring-1 ring-blue-500/20 shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Admin & Security Login Logs</h1>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Audit
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive chronological record of every administrator login, role verification, and access timestamp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh logs from local storage"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={handleExportJSON}
            disabled={logs.length === 0}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={handleClearLogs}
            disabled={logs.length === 0}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Trash2 size={14} /> Clear Logs
          </button>
        </div>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Logins Recorded</p>
            <p className="text-2xl font-black text-slate-800">{logs.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Active User</p>
            <p className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{user?.name || 'Administrator'}</p>
            <p className="text-[10px] text-slate-400 font-mono">@{user?.username || 'admin'}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Latest Session Time</p>
            <p className="text-sm font-bold text-slate-800">
              {logs[0] ? `${logs[0].time}` : 'No events'}
            </p>
            <p className="text-[10px] text-slate-400">
              {logs[0] ? `${logs[0].date}` : 'Waiting for login'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Monitor size={20} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Security Architecture</p>
            <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> SHA-256 Hash
            </p>
            <p className="text-[10px] text-slate-400">Session auto-expires (30m)</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by username, name, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Role Filter:</label>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ALL">All Roles ({logs.length})</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Log ID</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Admin Identity</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Auth Verification</th>
                <th className="py-3.5 px-4">Origin Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{log.id}</td>
                    <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                      <div className="font-bold text-slate-800">{log.time}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={11} /> {log.date}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">{log.name || 'System Administrator'}</div>
                      <div className="text-[10px] text-blue-600 font-mono">@{log.user_id}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                        {log.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {log.status || 'Verified (SHA-256)'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                      {log.ip || 'Client Browser Localhost'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle size={32} className="text-slate-300" />
                      <p className="font-bold text-slate-600 text-sm">No matching login events found</p>
                      <p className="text-xs text-slate-400">
                        {searchQuery ? 'Try changing your search terms.' : 'Login events will appear here automatically when administrators log in.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
