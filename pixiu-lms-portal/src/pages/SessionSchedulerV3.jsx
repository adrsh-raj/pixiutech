import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Flag, Layers3, Plus, RefreshCw, Users } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const field = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-400';
const normalize = value => text(value).toUpperCase();

async function request(path, method='GET', body) {
  const response = await apiFetch(path, { method, cache: 'no-store', ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || data?.error || data?.message || `Request failed (${response.status})`);
  return data;
}

export default function SessionSchedulerV3() {
  const { user } = useAuth();
  const { schools = [], classes = [], trainers = [], curriculum = [], sessions = [], refreshAll, loading } = useData();
  const admin = ['admin', 'superadmin'].includes(user?.role);
  const trainerRole = user?.role === 'trainer';
  const [technologies, setTechnologies] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [technologyId, setTechnologyId] = useState('');
  const [curriculumId, setCurriculumId] = useState('');
  const [lastSession, setLastSession] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeSchools = useMemo(() => schools.filter(s => lower(s.status || 'active') !== 'inactive'), [schools]);
  const selectedSchool = useMemo(() => activeSchools.find(s => String(s.id) === String(schoolId)) || null, [activeSchools, schoolId]);
  const activeClasses = useMemo(() => classes.filter(c => {
    if (lower(c.status || 'active') === 'inactive') return false;
    if (!selectedSchool) return false;
    const schoolKeys = [selectedSchool.id, selectedSchool.school_id, selectedSchool.school_code, selectedSchool.code].filter(Boolean).map(v => normalize(v));
    const classKeys = [c.school, c.school_id, c.school_code].filter(Boolean).map(v => normalize(v));
    return classKeys.some(key => schoolKeys.includes(key));
  }), [classes, selectedSchool]);
  const activeTrainers = useMemo(() => trainers.filter(t => lower(t.status || 'active') !== 'inactive'), [trainers]);
  const myTrainer = trainerRole ? activeTrainers[0] : null;
  const selectedClass = useMemo(() => activeClasses.find(c => String(c.id) === String(classId)) || null, [activeClasses, classId]);
  const classCurriculum = useMemo(() => curriculum.filter(unit => String(unit.grade || unit.class_grade || '') === String(selectedClass?.grade || '')), [curriculum, selectedClass]);
  const selectedUnit = useMemo(() => classCurriculum.find(u => String(u.id) === String(curriculumId)) || null, [classCurriculum, curriculumId]);
  const visibleSessions = useMemo(() => {
    const ids = new Set(activeClasses.map(c => String(c.id)));
    const trainerKey = String(myTrainer?.id || myTrainer?.trainer_id || user?.trainer_id || user?.id || '');
    return sessions.filter(s => ids.has(String(s.school_class || s.class_id)) && (!trainerRole || String(s.trainer || s.trainer_id) === trainerKey));
  }, [activeClasses, myTrainer, sessions, trainerRole, user]);

  const loadTech = async () => { try { setTechnologies(Array.isArray(await request('/technologies')) ? await request('/technologies') : []); } catch (err) { setError(err.message || 'Unable to load technologies.'); } };
  useEffect(() => { loadTech(); }, []);
  useEffect(() => { if (trainerRole && myTrainer) setTrainerId(String(myTrainer.id)); }, [trainerRole, myTrainer]);
  useEffect(() => { if (!schoolId && activeSchools.length === 1) setSchoolId(String(activeSchools[0].id)); }, [activeSchools, schoolId]);
  useEffect(() => { if (classId && !activeClasses.some(c => String(c.id) === String(classId))) setClassId(''); }, [activeClasses, classId]);
  useEffect(() => { if (curriculumId && !classCurriculum.some(c => String(c.id) === String(curriculumId))) setCurriculumId(''); }, [classCurriculum, curriculumId]);

  const createSession = async e => {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    const effectiveTrainer = trainerRole ? (myTrainer?.id || myTrainer?.trainer_id || user?.trainer_id || user?.id) : trainerId;
    if (!schoolId || !classId || !effectiveTrainer || !technologyId || !curriculumId || !date || !startTime || !text(topic)) { setBusy(false); setError('School, class, trainer, technology, curriculum unit, date, start time and topic are required.'); return; }
    if (endTime && endTime <= startTime) { setBusy(false); setError('End time must be later than start time.'); return; }
    try {
      const created = await request('/sessions', 'POST', { school_class: classId, trainer: effectiveTrainer, technology: technologyId, curriculum_unit: curriculumId, is_last_session_for_unit: lastSession, date, start_time: startTime, end_time: endTime || null, topic: text(topic), notes: text(notes) });
      setSuccess(`${created?.technology_name || 'Technology'} session scheduled${lastSession ? ' as the last session for this unit. Assessment can follow after the session is completed.' : '.'}`);
      setClassId(''); setTechnologyId(''); setCurriculumId(''); setTopic(''); setNotes(''); setLastSession(false); await refreshAll();
    } catch (err) { setError(err.message || 'Unable to schedule session.'); }
    finally { setBusy(false); }
  };

  const changeStatus = async (id, action) => {
    setBusy(true); setError(''); setSuccess('');
    try { await request(`/sessions/${encodeURIComponent(id)}/${action}`, 'POST', {}); await refreshAll(); setSuccess(action === 'start' ? 'Session started.' : 'Session completed. If this was the last session, evaluate the unit after assessments are entered.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Academic Operations</p><h1 className="text-2xl sm:text-3xl font-black">Sessions & Schedule</h1><p className="text-sm text-slate-500 mt-1">Choose technology for every session. The final session flag stays attached to the session record and is editable later.</p></div><button type="button" onClick={()=>{refreshAll();loadTech()}} disabled={loading||busy} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black inline-flex items-center gap-2"><RefreshCw size={14} className={loading||busy?'animate-spin':''}/> Refresh</button></div>
    {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"><div className="flex items-start justify-between mb-5"><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">Create session</p><h2 className="text-xl font-black mt-1">{trainerRole?'Trainer session':'Schedule a session'}</h2></div><CalendarDays size={20} className="text-slate-300"/></div>
      <form onSubmit={createSession} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div><label className="label">School *</label><select className={field} value={schoolId} onChange={e=>{setSchoolId(e.target.value);setClassId('');setTrainerId('');setTechnologyId('');setCurriculumId('')}} required><option value="">Select school</option>{activeSchools.map(s=><option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></div>
        <div><label className="label">Class *</label><select className={field} value={classId} onChange={e=>{setClassId(e.target.value);setCurriculumId('')}} disabled={!schoolId} required><option value="">Select class</option>{activeClasses.map(c=><option key={c.id} value={c.id}>{c.display_name || `${c.grade}${c.section||''}`} · Grade {c.grade}</option>)}</select></div>
        <div><label className="label">Technology *</label><select className={field} value={technologyId} onChange={e=>setTechnologyId(e.target.value)} disabled={!classId} required><option value="">Select technology</option>{technologies.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><p className="text-[9px] text-slate-400 mt-1">Database catalogue; not hardcoded.</p></div>
        <div><label className="label">Curriculum unit *</label><select className={field} value={curriculumId} onChange={e=>setCurriculumId(e.target.value)} disabled={!classId} required><option value="">Select unit</option>{classCurriculum.map(u=><option key={u.id} value={u.id}>{u.unit_code} · {u.title} · {u.level}</option>)}</select></div>
        <div><label className="label">Last session for this unit?</label><select className={field} value={lastSession?'yes':'no'} onChange={e=>setLastSession(e.target.value==='yes')}><option value="no">No — more sessions remain</option><option value="yes">Yes — assessment follows</option></select></div>
        <div><label className="label">Date *</label><input className={field} type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div><div><label className="label">Start time *</label><input className={field} type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} required/></div><div><label className="label">End time</label><input className={field} type="time" value={endTime} onChange={e=>setEndTime(e.target.value)}/></div>
        <div className="xl:col-span-2"><label className="label">Topic *</label><input className={field} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="What was taught?" required/></div><div className="xl:col-span-2"><label className="label">Notes</label><input className={field} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional notes"/></div>
        {lastSession && selectedUnit && <div className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-violet-100 bg-violet-50 p-4"><div className="flex items-center gap-2 text-violet-800 text-xs font-black"><Flag size={14}/> Unit assessment stage</div><p className="mt-1 text-xs text-violet-700">After this session is completed, the system can evaluate this unit for each student using the configured attendance, quiz, practical and trainer-review rules.</p></div>}
        <button disabled={busy} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black inline-flex items-center justify-center gap-2 disabled:opacity-50">{busy?<RefreshCw size={14} className="animate-spin"/>:<Plus size={14}/>} Schedule session</button>
      </form>
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden"><div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-wider font-black text-violet-600">Server-backed register</p><h2 className="text-xl font-black mt-1">Scheduled sessions</h2></div><Users size={18} className="text-slate-300"/></div><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Date','Technology','School / Class','Trainer','Unit / Topic','Last session','Status','Actions'].map(h=><th key={h} className="px-4 py-3 text-left text-[9px] uppercase tracking-wider font-black text-slate-400">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visibleSessions.map(s=>{const st=lower(s.status);return <tr key={s.id}><td className="px-4 py-3 whitespace-nowrap font-semibold">{s.date||'—'}<div className="text-[10px] text-slate-400">{s.start_time||'—'}{s.end_time?` → ${s.end_time}`:''}</div></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 text-violet-700 px-2 py-1 text-[9px] font-black"><Layers3 size={11}/>{s.technology_name||'Unassigned'}</span></td><td className="px-4 py-3"><b>{s.school_name||s.school_code||'—'}</b><div className="text-[10px] text-slate-400">{s.class_name||s.school_class||'—'}</div></td><td className="px-4 py-3">{s.trainer_name||s.trainer_id||'—'}</td><td className="px-4 py-3 min-w-[240px]"><b>{s.topic||'—'}</b><div className="text-[10px] text-slate-400">{s.curriculum_unit_name||s.curriculum_unit||'Curriculum linked'}</div></td><td className="px-4 py-3">{s.is_last_session_for_unit?<span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 text-amber-700 px-2 py-1 text-[9px] font-black"><Flag size={11}/> Yes</span>:<span className="text-slate-400 text-[10px] font-bold">No</span>}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-[9px] uppercase font-black">{st==='completed'?<CheckCircle2 size={11}/>:<Clock3 size={11}/>} {st||'unknown'}</span></td><td className="px-4 py-3">{st==='planned'&&<button disabled={busy} onClick={()=>changeStatus(s.id,'start')} className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[9px] font-black">Start</button>}{st==='in_progress'&&<button disabled={busy} onClick={()=>changeStatus(s.id,'complete')} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black">Complete</button>}</td></tr>})}{!visibleSessions.length&&<tr><td colSpan={8} className="p-10 text-center text-slate-400">No scheduled sessions in your current scope.</td></tr>}</tbody></table></div></section>
    <style>{`.label{display:block;margin-bottom:.35rem;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#64748b}`}</style>
  </div>;
}
