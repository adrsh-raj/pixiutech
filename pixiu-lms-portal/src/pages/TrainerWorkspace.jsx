import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, CheckCircle2, ChevronRight, Clock3, Cpu, Lock, Play, Save, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';
import { useToast } from '../context/ToastContext';

const today = () => new Date().toISOString().slice(0, 10);
const norm = value => String(value ?? '').trim().toLowerCase();

async function request(path, method='GET', body) {
  const options = { method, cache: method === 'GET' ? 'no-store' : undefined };
  if (body !== undefined) { options.body = JSON.stringify(body); options.headers = { 'Content-Type': 'application/json' }; }
  const response = await apiFetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || 'Request failed.');
  return payload;
}

export default function TrainerWorkspace() {
  const { user } = useAuth();
  const { trainers=[], sessions=[], students=[], refreshAll, loading } = useData();
  const toast = useToast();
  const [activeId, setActiveId] = useState('');
  const [attendance, setAttendance] = useState({});
  const [activities, setActivities] = useState([]);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityType, setActivityType] = useState('lesson');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const trainer = useMemo(() => {
    const key = String(user?.related_id || user?.username || user?.id || '').toUpperCase();
    return trainers.find(t => [t.id, t.trainer_id, t.account_username].some(v => String(v || '').toUpperCase() === key));
  }, [trainers, user]);
  const trainerSessions = useMemo(() => {
    const keys = new Set([trainer?.id, trainer?.trainer_id, user?.related_id, user?.username, user?.id].filter(Boolean).map(v => String(v).toUpperCase()));
    return sessions.filter(s => keys.has(String(s.trainer_id || s.trainer || '').toUpperCase()) && norm(s.status) !== 'cancelled');
  }, [sessions, trainer, user]);
  const todaySessions = trainerSessions.filter(s => String(s.date || '').slice(0,10) === today() && norm(s.status) !== 'completed');
  const activeSession = trainerSessions.find(s => String(s.id) === String(activeId)) || null;
  const roster = useMemo(() => activeSession ? students.filter(st => String(st.class_id || '') === String(activeSession.class_id || activeSession.school_class || '')) : [], [activeSession, students]);

  const loadSession = async session => {
    setActiveId(session.id); setError('');
    try {
      const [attendanceRows, activityRows] = await Promise.all([request(`/attendance?session=${encodeURIComponent(session.id)}`), request('/session-activities')]);
      const map = {};
      (Array.isArray(attendanceRows) ? attendanceRows : attendanceRows?.data || []).forEach(row => { map[String(row.student)] = norm(row.status); map[String(row.student_id)] = norm(row.status); });
      setAttendance(map);
      const allActivities = Array.isArray(activityRows) ? activityRows : activityRows?.data || [];
      setActivities(allActivities.filter(a => String(a.session) === String(session.id)));
    } catch (e) { setError(e.message); }
  };

  useEffect(() => { if (activeSession) loadSession(activeSession); }, [activeId]);

  const start = async () => {
    if (!activeSession) return;
    setBusy(true); setError('');
    try { await request(`/sessions/${activeSession.id}/start`, 'POST', {}); await refreshAll(); await loadSession({ ...activeSession, status: 'in_progress' }); toast.success('Session started.'); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const saveAttendance = async () => {
    if (!activeSession) return;
    if (!roster.length) throw new Error('No active students are linked to this class.');
    const entries = roster.map(st => ({ student: st.id, status: attendance[String(st.id)] || attendance[String(st.student_id)] || 'absent' }));
    await request('/attendance/bulk', 'POST', { session: activeSession.id, entries });
    await refreshAll();
  };

  const addActivity = async e => {
    e.preventDefault();
    if (!activeSession || !activityTitle.trim()) return;
    setBusy(true); setError('');
    try { await request('/session-activities', 'POST', { session: activeSession.id, title: activityTitle.trim(), activity_type: activityType }); setActivityTitle(''); const rows=await request('/session-activities'); const all=Array.isArray(rows)?rows:rows?.data||[]; setActivities(all.filter(a=>String(a.session)===String(activeSession.id))); }
    catch(e){ setError(e.message); } finally { setBusy(false); }
  };

  const finish = async () => {
    if (!activeSession) return;
    setBusy(true); setError('');
    try { await saveAttendance(); await request(`/sessions/${activeSession.id}/complete`, 'POST', {}); await refreshAll(); toast.success('Attendance saved and session locked.'); setActiveId(''); }
    catch(e){ setError(e.message); } finally { setBusy(false); }
  };

  if (activeSession) {
    const sessionStatus = norm(activeSession.status);
    return <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Live classroom" title={activeSession.topic || 'Class session'} description={`${activeSession.class_name || activeSession.class_id} · ${activeSession.date} · ${activeSession.start_time || 'Time not set'}`} actions={<RefreshButton onRefresh={() => loadSession(activeSession)} loading={busy || loading}/>} />
      {error && <ErrorState title="Classroom action failed" description={error} />}
      <section className="bg-slate-950 text-white rounded-3xl p-5 sm:p-7"><div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.18em] text-blue-300 font-black">Session status</p><p className="text-2xl font-black mt-1 capitalize">{sessionStatus.replace('_',' ')}</p><p className="text-xs text-slate-400 mt-2">Trainer: {trainer?.name || user?.name || 'Trainer'} · {roster.length} active students</p></div><Link to="/simulation" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-xs font-black"><Cpu size={14}/> Virtual Arduino Lab</Link></div></section>
      {sessionStatus === 'planned' && <section className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center justify-between gap-3"><div><h2 className="font-black text-slate-900">Ready to start?</h2><p className="text-xs text-slate-500 mt-1">Starting the session moves it to In progress and opens attendance/activity controls.</p></div><button disabled={busy} onClick={start} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50"><Play size={14}/> Start session</button></section>}
      {sessionStatus === 'in_progress' && <>
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b border-slate-100"><div className="flex items-center gap-2"><Users size={16} className="text-blue-600"/><h2 className="font-black text-slate-900">Attendance</h2></div><p className="text-xs text-slate-400 mt-1">Every active student must have one status before saving.</p></div><div className="divide-y divide-slate-100">{roster.map(st=>{const current=attendance[String(st.id)]||attendance[String(st.student_id)]||''; return <div key={st.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{st.name}</p><p className="text-[10px] font-mono text-slate-400">{st.student_id} · Roll {st.roll_number}</p></div><div className="flex flex-wrap gap-1.5">{['present','late','absent','excused'].map(option=><button key={option} disabled={busy} onClick={()=>setAttendance(prev=>({...prev,[String(st.id)]:option}))} className={`px-3 py-1.5 rounded-lg text-[11px] font-black capitalize ${current===option?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'} disabled:opacity-50`}>{option}</button>)}</div></div>)}{!roster.length && <EmptyState title="Roster is empty" description="This session class has no active student records."/>}</div><div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end"><button disabled={busy || !roster.length} onClick={async()=>{setBusy(true);try{await saveAttendance();toast.success('Attendance saved.')}catch(e){setError(e.message)}finally{setBusy(false)}}} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-50"><Save size={14}/> Save attendance</button></div></section>
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b border-slate-100 flex items-center gap-2"><Activity size={16} className="text-violet-600"/><div><h2 className="font-black text-slate-900">Activities</h2><p className="text-xs text-slate-400 mt-1">Record what happened in the classroom; activities become part of the session history.</p></div></div><form onSubmit={addActivity} className="p-4 flex flex-col sm:flex-row gap-2 border-b border-slate-100"><input value={activityTitle} onChange={e=>setActivityTitle(e.target.value)} placeholder="Activity, lesson or lab task" className="field flex-1"/><select value={activityType} onChange={e=>setActivityType(e.target.value)} className="field sm:w-44"><option value="lesson">Lesson</option><option value="lab">Lab</option><option value="project">Project</option><option value="quiz">Quiz</option><option value="review">Review</option></select><button disabled={busy} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black disabled:opacity-50">Add activity</button></form><div className="divide-y divide-slate-100">{activities.map(a=><div key={a.id} className="p-4 flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">{a.title}</p><p className="text-[10px] uppercase font-black tracking-wide text-slate-400 mt-1">{a.activity_type}</p></div>{a.completed_at?<span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={14}/> Completed</span>:<span className="inline-flex items-center gap-1 text-xs font-bold text-slate-400"><Clock3 size={14}/> Recorded</span>}</div>)}{!activities.length&&<EmptyState title="No activities recorded yet" description="Add the lesson, lab or project activity completed in this session."/>}</div></section>
        <button disabled={busy || !roster.length} onClick={finish} className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black disabled:opacity-50"><Lock size={15} className="inline mr-2"/>Complete & lock session</button>
      </>}
      {sessionStatus === 'completed' && <section className="bg-white rounded-2xl border border-emerald-200 p-6 text-center"><CheckCircle2 size={28} className="mx-auto text-emerald-600"/><h2 className="font-black text-slate-900 mt-3">Session locked</h2><p className="text-sm text-slate-500 mt-1">This session is complete. Attendance and activities are retained as historical records.</p></section>}
      <button type="button" onClick={()=>setActiveId('')} className="text-xs font-bold text-slate-500 hover:text-slate-900">← Back to today’s sessions</button>
      <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}`}</style>
    </div>;
  }

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Trainer" title="Teaching Workspace" description="Today’s schedule, live classroom controls, attendance and session activity history." actions={<RefreshButton onRefresh={refreshAll} loading={loading}/>} />
    {error && <ErrorState title="Workspace error" description={error}/>} 
    <section className="grid grid-cols-2 xl:grid-cols-4 gap-3"><div className="stat"><CalendarDays size={17}/><span>Today’s classes</span><strong>{todaySessions.length}</strong></div><div className="stat"><Users size={17}/><span>My students</span><strong>{students.length}</strong></div><div className="stat"><Play size={17}/><span>In progress</span><strong>{trainerSessions.filter(s=>norm(s.status)==='in_progress').length}</strong></div><div className="stat"><CheckCircle2 size={17}/><span>Completed sessions</span><strong>{trainerSessions.filter(s=>norm(s.status)==='completed').length}</strong></div></section>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black text-slate-900">Today’s sessions</h2><p className="text-xs text-slate-400 mt-1">Open a scheduled class to start the classroom workflow.</p></div><div className="divide-y divide-slate-100">{todaySessions.map(s=><button key={s.id} type="button" onClick={()=>loadSession(s)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Play size={16}/></div><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800 truncate">{s.topic || 'Class session'}</p><p className="text-[11px] text-slate-400 mt-1">{s.class_name || s.class_id} · {s.start_time || 'Time not set'} · {norm(s.status).replace('_',' ')}</p></div><ChevronRight size={16} className="text-slate-300"/></button>)}{!todaySessions.length&&<EmptyState title="No classes scheduled today" description="Your assigned sessions will appear here when a school schedules them."/>}</div></section>
    <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h3 className="font-black text-blue-950">Classroom tools</h3><p className="text-xs text-blue-900/70 mt-1">Open the Virtual Arduino Lab or teaching materials without leaving the trainer workspace.</p></div><div className="flex flex-wrap gap-2"><Link to="/simulation" className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-1.5"><Cpu size={14}/> Virtual Lab</Link><Link to="/trainer-materials" className="px-3 py-2 rounded-xl bg-white border border-blue-200 text-blue-700 text-xs font-black">Teaching materials</Link></div></section>
    <style>{`.stat{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:14px}.stat svg{color:#64748b}.stat span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800;margin-top:9px}.stat strong{display:block;font-size:25px;line-height:1.1;color:#0f172a;margin-top:4px}`}</style>
  </div>;
}
