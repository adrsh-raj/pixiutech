import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Database, RefreshCw, ShieldCheck, TriangleAlert, RotateCcw, CheckCircle2 } from 'lucide-react';

const DJANGO_API_BASE = String(import.meta.env.VITE_DJANGO_API_URL || '').trim().replace(/\/$/, '');

async function djangoRequest(path, options = {}) {
  if (!DJANGO_API_BASE) throw new Error('VITE_DJANGO_API_URL is not configured for the Django Phase 6 APIs.');
  const token = localStorage.getItem('pixiu_auth_token');
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${DJANGO_API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Django API request failed (${response.status})`);
  return payload;
}

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;

export default function Phase6() {
  const [tab, setTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [resetScope, setResetScope] = useState('learning_runtime');
  const [confirmation, setConfirmation] = useState('');
  const [dryRun, setDryRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async nextTab => {
    setLoading(true); setError('');
    try {
      if (nextTab === 'dashboard') setSummary(await djangoRequest('/phase6/dashboard/summary/'));
      if (nextTab === 'reports') setReports(await djangoRequest('/phase6/reports/overview/'));
      if (nextTab === 'integrity') setIntegrity(await djangoRequest('/phase6/integrity-audit/'));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load('dashboard'); }, []);

  const cards = useMemo(() => summary ? [
    ['Schools', summary.academics.schools], ['Active Trainers', summary.academics.active_trainers], ['Students', summary.academics.students], ['Sessions', summary.learning.sessions],
    ['Invoiced', money(summary.finance.invoiced)], ['Collected', money(summary.finance.collected)], ['Inventory Items', summary.inventory.items], ['Open Leads', summary.crm.open_leads]
  ] : [], [summary]);

  const reset = async isDryRun => {
    setLoading(true); setError(''); setDryRun(null);
    try {
      const result = await djangoRequest('/phase6/controlled-reset/', { method: 'POST', body: JSON.stringify({ scope: resetScope, confirmation, dry_run: isDryRun }) });
      setDryRun(result);
      if (!isDryRun) { setConfirmation(''); await load('dashboard'); }
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return <div className="pb-10">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Phase 6 — Django Operations</h1><p className="text-sm text-slate-500 mt-1">Canonical Django PostgreSQL dashboard, analytics, integrity checks and controlled reset.</p></div>
      <button onClick={() => load(tab)} disabled={loading} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>
    </div>

    {!DJANGO_API_BASE && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Django API not configured.</b> Set <code className="font-mono">VITE_DJANGO_API_URL</code> in the portal deployment. The existing Express LMS API remains untouched.</div>}
    {error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex gap-2"><TriangleAlert size={16} className="shrink-0 mt-0.5"/>{error}</div>}

    <div className="flex gap-2 border-b border-slate-200 mb-6 overflow-x-auto">
      {[['dashboard','Dashboard',Activity],['reports','Reports / Analytics',BarChart3],['integrity','Data Integrity',ShieldCheck],['reset','Controlled Reset',RotateCcw]].map(([key,label,Icon]) => <button key={key} onClick={() => { setTab(key); if (key !== 'reset') load(key); }} className={`px-3 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 ${tab === key ? 'border-pixiu-blue text-pixiu-blue' : 'border-transparent text-slate-500'}`}><Icon size={14} className="inline mr-1.5"/>{label}</button>)}
    </div>

    {tab === 'dashboard' && summary && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">{cards.map(([label,value]) => <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p><p className="text-xl font-extrabold text-slate-900 mt-1">{value}</p></div>)}</div>
      <div className="grid lg:grid-cols-3 gap-5"><div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5"><h3 className="font-bold text-slate-800 text-sm mb-4">Finance & Operations</h3><div className="space-y-3 text-xs">{[['Attendance rate', `${summary.learning.attendance_rate ?? '—'}%`],['Pending payments',money(summary.finance.pending_payments)],['Overdue invoices',summary.finance.overdue_invoices],['Active custody',summary.inventory.active_custody],['Won leads',summary.crm.won_leads]].map(([a,b]) => <div key={a} className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">{a}</span><b className="text-slate-900">{b}</b></div>)}</div></div><div className="bg-slate-900 text-white rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Integrity</p><p className="text-2xl font-extrabold mt-1">Run separately</p><p className="text-xs text-slate-400 mt-2">Dashboard stays lightweight. Full data-integrity checks are isolated to the integrity tab/endpoint.</p><button onClick={() => { setTab('integrity'); load('integrity'); }} className="mt-5 px-3 py-2 rounded-lg bg-white text-slate-900 text-xs font-bold">Run Audit</button></div></div>
    </>}

    {tab === 'reports' && reports && <div className="space-y-5"><div className="bg-white border border-slate-200 rounded-2xl p-5 overflow-x-auto"><h3 className="font-bold text-slate-800 text-sm mb-4">12-Month Finance</h3><table className="w-full text-xs"><thead><tr className="text-left text-slate-400 border-b"><th className="pb-2">Month</th><th className="pb-2">Invoiced</th><th className="pb-2">Collected</th></tr></thead><tbody>{reports.monthly_finance.map(row => <tr key={row.label} className="border-b border-slate-100"><td className="py-2 font-bold">{row.label}</td><td>{money(row.invoiced)}</td><td>{money(row.collected)}</td></tr>)}</tbody></table></div><div className="grid lg:grid-cols-3 gap-5">{[['Students by Grade',reports.students_by_grade,(r)=>`Class ${r.grade}: ${r.total}`],['Lead Funnel',reports.lead_funnel,(r)=>`${r.status}: ${r.total}`],['Trainer Load',reports.trainer_load,(r)=>`${r.trainer_id} — ${r.session_count} sessions`]].map(([title,rows,format]) => <div key={title} className="bg-white border border-slate-200 rounded-2xl p-5"><h3 className="font-bold text-slate-800 text-sm mb-3">{title}</h3><div className="space-y-2 text-xs">{rows.map((r,i)=><div key={i} className="flex justify-between gap-3"><span className="text-slate-600">{format(r).split(':')[0]}</span><b>{format(r).split(':').slice(1).join(':')}</b></div>)}</div></div>)}</div></div>}

    {tab === 'integrity' && integrity && <div className="space-y-4"><div className={`rounded-2xl p-5 border ${integrity.error_count ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}><div className="flex items-center gap-2 font-bold text-sm">{integrity.error_count ? <TriangleAlert size={18}/> : <CheckCircle2 size={18}/>} {integrity.status} — {integrity.error_count} errors / {integrity.warning_count} warnings</div><p className="text-xs mt-1 text-slate-600">Checked: {new Date(integrity.checked_at).toLocaleString('en-IN')}</p></div>{integrity.findings.map(f => <div key={f.code} className="bg-white border border-slate-200 rounded-xl p-4"><div className="flex justify-between gap-3"><div><p className="font-bold text-slate-800 text-sm">{f.code}</p><p className="text-xs text-slate-500 mt-1">{f.message}</p></div><span className={`h-fit px-2 py-1 rounded-md text-[10px] font-bold ${f.count ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{f.count}</span></div>{f.samples?.length > 0 && <pre className="mt-3 p-3 rounded-lg bg-slate-50 text-[10px] overflow-auto">{JSON.stringify(f.samples,null,2)}</pre>}</div>)}</div>}

    {tab === 'reset' && <div className="max-w-2xl bg-white border border-rose-200 rounded-2xl p-6"><div className="flex items-center gap-2 text-rose-700"><Database size={18}/><h3 className="font-extrabold">Controlled Data Reset</h3></div><p className="text-xs text-slate-500 mt-2">This never deletes accounts, academic master data, or audit logs. Start with Dry Run.</p><select value={resetScope} onChange={e=>setResetScope(e.target.value)} className="w-full mt-5 border border-slate-300 rounded-xl px-3 py-2 text-sm"><option value="learning_runtime">Learning runtime</option><option value="business">Business / CRM</option><option value="inventory">Inventory</option><option value="notifications">Notifications</option><option value="all_operational">All operational scopes</option></select><input value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder="Type RESET PIXIU DATA" className="w-full mt-3 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono"/><div className="flex gap-2 mt-4"><button onClick={()=>reset(true)} disabled={loading || confirmation !== 'RESET PIXIU DATA'} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">Dry Run</button><button onClick={()=>reset(false)} disabled={loading || confirmation !== 'RESET PIXIU DATA'} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold">Execute Reset</button></div>{dryRun && <pre className="mt-5 p-4 rounded-xl bg-slate-950 text-slate-200 text-[10px] overflow-auto">{JSON.stringify(dryRun,null,2)}</pre>}</div>}
  </div>;
}
