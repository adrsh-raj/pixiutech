import { useMemo, useState } from 'react';
import { BookOpen, Plus, Target, CheckCircle2, X, Pencil, Circle } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import ErrorState from '../components/ui/ErrorState';

const norm = value => String(value ?? '').trim();
const gradeOf = value => norm(value?.grade ?? value?.class_grade);
const unitNumber = value => {
  const raw = norm(value);
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 0;
};
const unitLabel = value => {
  const n = unitNumber(value);
  return n ? `Unit ${n}` : norm(value) || 'Unit';
};

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const field = Object.entries(payload || {}).find(([key]) => !['detail', 'error', 'message'].includes(key));
    throw new Error(payload.detail || payload.error || payload.message || (field ? `${field[0]}: ${String(field[1])}` : `Request failed (${response.status})`));
  }
  return payload;
}

export default function Curriculum() {
  const { user } = useAuth();
  const { curriculum = [], classes = [], refreshAll } = useData();
  const toast = useToast();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ unit_number: '', level: '', topic: '', objectives: '', status: 'Upcoming' });

  const activeClasses = useMemo(() => classes.filter(item => String(item.status || 'active').toLowerCase() !== 'inactive'), [classes]);
  const selectedClass = useMemo(() => activeClasses.find(item => String(item.id) === String(selectedClassId)) || activeClasses[0] || null, [activeClasses, selectedClassId]);
  const selectedClassIdSafe = selectedClass?.id || '';

  const visibleCurriculum = useMemo(() => {
    const grade = gradeOf(selectedClass);
    return curriculum
      .filter(item => !grade || gradeOf(item) === grade)
      .sort((a, b) => unitNumber(a.unit_code || a.week) - unitNumber(b.unit_code || b.week) || norm(a.unit_code).localeCompare(norm(b.unit_code)));
  }, [curriculum, selectedClass]);

  const openCreate = () => {
    setError('');
    const used = new Set(visibleCurriculum.map(item => unitNumber(item.unit_code || item.week)).filter(Boolean));
    let next = 1;
    while (used.has(next)) next += 1;
    setEditing(null);
    setFormData({ unit_number: String(next), level: '', topic: '', objectives: '', status: 'Upcoming' });
    setIsModalOpen(true);
  };

  const openEdit = item => {
    setError('');
    setEditing(item);
    setFormData({
      unit_number: String(unitNumber(item.unit_code || item.week) || ''),
      level: norm(item.level),
      topic: norm(item.topic || item.title),
      objectives: norm(item.objectives),
      status: String(item.status).toLowerCase() === 'published' ? 'Completed' : 'Upcoming',
    });
    setIsModalOpen(true);
  };

  const save = async event => {
    event.preventDefault();
    if (!selectedClass || !formData.unit_number || !/^[0-9]+$/.test(String(formData.unit_number).trim())) return setError('Select a class and enter a valid unit number.');
    if (!norm(formData.level) || !norm(formData.topic) || !norm(formData.objectives)) return setError('Level, topic and objectives are required.');
    setSaving(true); setError('');
    try {
      const number = Number(formData.unit_number);
      const payload = {
        grade: gradeOf(selectedClass),
        level: norm(formData.level),
        unit_code: `U${number}`,
        title: norm(formData.topic),
        week: unitLabel(formData.unit_number),
        topic: norm(formData.topic),
        objectives: norm(formData.objectives),
        status: formData.status === 'Completed' ? 'published' : 'draft',
      };
      const saved = await request(editing?.id ? `/curriculum/${encodeURIComponent(editing.id)}` : '/curriculum', editing?.id ? 'PATCH' : 'POST', payload);
      await refreshAll?.();
      setIsModalOpen(false);
      toast.success(`${unitLabel(number)} saved for Grade ${gradeOf(selectedClass)}.`, 'Curriculum updated');
      return saved;
    } catch (err) {
      setError(err.message || 'Unable to save curriculum unit.');
    } finally { setSaving(false); }
  };

  const toggleStatus = async item => {
    setSaving(true); setError('');
    try {
      const next = String(item.status).toLowerCase() === 'published' ? 'draft' : 'published';
      const response = await request(`/curriculum/${encodeURIComponent(item.id)}/status`, 'PUT', { status: next });
      await refreshAll?.();
      toast.success(`${item.title} marked ${next === 'published' ? 'Completed' : 'Upcoming'}.`, 'Curriculum status updated');
      return response;
    } catch (err) { setError(err.message || 'Unable to update curriculum status.'); }
    finally { setSaving(false); }
  };

  if (!activeClasses.length) {
    return <div className="space-y-6 pb-10"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Academic</p><h1 className="text-2xl font-black text-slate-900 mt-1">Curriculum & Session Plans</h1><p className="text-sm text-slate-500 mt-1">Curriculum is driven by the active classes created in your authorised school scope.</p></div><div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white"><BookOpen size={36} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-700">No active classes</h3><p className="text-sm text-slate-400 mt-1">Create an active class first. No classes or units are hardcoded here.</p></div></div>;
  }

  return <div className="pb-10 space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Academic</p><h1 className="text-2xl font-black text-slate-900 mt-1">Curriculum & Session Plans</h1><p className="text-sm text-slate-500 mt-1">Classes come from the live database. Units and levels are created manually and become the single curriculum record used across the portal.</p></div><button type="button" onClick={openCreate} className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg font-black flex items-center justify-center gap-2 shadow-sm"><Plus size={18}/> Add Unit</button></div>

    {error && <ErrorState title="Curriculum action failed" description={error} onRetry={() => setError('')}/>} 

    <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1">
      {activeClasses.map(item => {
        const count = curriculum.filter(unit => gradeOf(unit) === gradeOf(item)).length;
        const active = String(selectedClassIdSafe) === String(item.id);
        return <button key={item.id} type="button" onClick={() => setSelectedClassId(item.id)} className={`px-5 py-3 font-bold text-sm border-b-2 whitespace-nowrap ${active ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><span>{item.display_name || `${item.grade}-${item.section}`}</span><span className="ml-2 text-[10px] text-slate-400">Grade {item.grade} · {count} unit{count === 1 ? '' : 's'}</span></button>;
      })}
    </div>

    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900"><b>Master curriculum:</b> Grade {gradeOf(selectedClass)} currently has <b>{visibleCurriculum.length}</b> manually configured unit{visibleCurriculum.length === 1 ? '' : 's'}. Every unit has its own Level. Updating the unit updates the same canonical curriculum record used by sessions, progress and certificate eligibility.</div>

    <div className="max-w-5xl space-y-4">
      {visibleCurriculum.map((session, index) => {
        const completed = String(session.status).toLowerCase() === 'published';
        return <div key={session.id || index} className={`p-5 sm:p-6 rounded-2xl border transition-all ${completed ? 'border-emerald-200 bg-white shadow-sm' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="flex flex-col sm:flex-row justify-between gap-3 mb-4"><div className="flex items-center gap-2.5 flex-wrap"><span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${completed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{unitLabel(session.unit_code || session.week)}</span><span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700">{session.level || 'No level'}</span><h3 className="text-base sm:text-lg font-bold text-slate-800">{session.topic || session.title}</h3></div><div className="flex gap-2 shrink-0"><button type="button" onClick={() => openEdit(session)} className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 inline-flex items-center gap-1.5"><Pencil size={14}/> Edit</button><button type="button" onClick={() => toggleStatus(session)} disabled={saving} className={`text-xs font-bold px-3 py-1.5 rounded-xl border inline-flex items-center gap-1.5 ${completed ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-300'}`}>{completed ? <CheckCircle2 size={15}/> : <Circle size={14}/>} {completed ? 'Completed' : 'Upcoming'}</button></div></div>
          <div className="pl-1"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><Target size={14}/> Learning Objectives & Practical Task</p><div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">{session.objectives}</div></div>
        </div>;
      })}
      {!visibleCurriculum.length && <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white"><BookOpen size={36} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-700">No units configured for this grade</h3><p className="text-sm text-slate-400 mt-1 mb-4">Create the first unit and choose its Level manually.</p><button type="button" onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Create Unit</button></div>}
    </div>

    {isModalOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200"><div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50"><div><h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Curriculum Unit' : `Add Curriculum Unit · Grade ${gradeOf(selectedClass)}`}</h2><p className="text-xs text-slate-500 mt-1">Unit number and Level are data, not hardcoded UI assumptions.</p></div><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button></div><form onSubmit={save} className="p-6 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Number *</label><input type="number" min="1" step="1" value={formData.unit_number} onChange={e => setFormData(v => ({...v, unit_number: e.target.value}))} disabled={Boolean(editing)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" required/><p className="text-[10px] text-slate-400 mt-1">Example: 1, 2, 3, 6. Any number is allowed.</p></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Level *</label><input type="text" value={formData.level} onChange={e => setFormData(v => ({...v, level: e.target.value}))} placeholder="e.g. Level 0 / Level 1 / Advanced" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required/></div></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic *</label><input type="text" value={formData.topic} onChange={e => setFormData(v => ({...v, topic: e.target.value}))} placeholder="e.g. Sensors & Distance Detection" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Learning Objectives & Practical Task *</label><textarea rows="4" value={formData.objectives} onChange={e => setFormData(v => ({...v, objectives: e.target.value}))} placeholder="What students should learn/build" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label><select value={formData.status} onChange={e => setFormData(v => ({...v, status: e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"><option value="Upcoming">Upcoming</option><option value="Completed">Completed</option></select></div><div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-sm">Cancel</button><button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-black text-sm disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Update Unit' : 'Create Unit'}</button></div></form></div></div>}
  </div>;
}
