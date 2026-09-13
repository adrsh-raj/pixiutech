import { useMemo, useState } from 'react';
import { BookOpen, Plus, X, Pencil, Eye, EyeOff } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import ErrorState from '../components/ui/ErrorState';

const norm = value => String(value ?? '').trim();
const gradeOf = value => norm(value?.grade ?? value?.class_grade);
const unitNumber = value => { const match = norm(value).match(/\d+/); return match ? Number(match[0]) : 0; };
const unitLabel = value => { const n = unitNumber(value); return n ? `Unit ${n}` : norm(value) || 'Unit'; };
const isActive = value => norm(value || 'active').toLowerCase() !== 'inactive';

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const field = Object.entries(payload || {}).find(([key]) => !['detail', 'error', 'message'].includes(key));
    throw new Error(payload.detail || payload.error || payload.message || (field ? `${field[0]}: ${String(field[1])}` : `Request failed (${response.status})`));
  }
  return payload;
}

export default function Curriculum() {
  const { user } = useAuth();
  const { curriculum = [], classes = [], schools = [], refreshAll } = useData();
  const toast = useToast();
  const canManage = user?.role === 'admin';
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ unit_number: '', topic: '', objectives: '', status: 'published' });

  const activeSchools = useMemo(() => schools.filter(s => isActive(s.status)), [schools]);
  const scopedSchool = useMemo(() => activeSchools.find(s => String(s.id) === String(selectedSchoolId)) || activeSchools[0] || null, [activeSchools, selectedSchoolId]);
  const schoolClasses = useMemo(() => classes.filter(c => isActive(c.status) && scopedSchool && [c.school_id, c.school_code, c.school].some(v => String(v ?? '').toUpperCase() === String(scopedSchool.id ?? '').toUpperCase() || String(v ?? '').toUpperCase() === String(scopedSchool.school_code ?? '').toUpperCase())), [classes, scopedSchool]);
  const selectedClass = useMemo(() => schoolClasses.find(c => String(c.id) === String(selectedClassId)) || schoolClasses[0] || null, [schoolClasses, selectedClassId]);

  const visibleCurriculum = useMemo(() => {
    if (!selectedClass) return [];
    return curriculum.filter(item => {
      const assignments = Array.isArray(item.assigned_classes) ? item.assigned_classes : [];
      return assignments.some(a => String(a.id) === String(selectedClass.id));
    }).sort((a, b) => unitNumber(a.unit_code || a.week) - unitNumber(b.unit_code || b.week) || norm(a.unit_code).localeCompare(norm(b.unit_code)));
  }, [curriculum, selectedClass]);

  const openCreate = () => {
    if (!canManage || !selectedClass) return;
    setError('');
    const used = new Set(visibleCurriculum.map(item => unitNumber(item.unit_code || item.week)).filter(Boolean));
    let next = 1; while (used.has(next)) next += 1;
    setEditing(null);
    setFormData({ unit_number: String(next), topic: '', objectives: '', status: 'published' });
    setIsModalOpen(true);
  };

  const openEdit = item => {
    if (!canManage) return;
    setError(''); setEditing(item);
    setFormData({ unit_number: String(unitNumber(item.unit_code || item.week) || ''), topic: norm(item.topic || item.title), objectives: norm(item.objectives), status: norm(item.status).toLowerCase() === 'published' ? 'published' : 'draft' });
    setIsModalOpen(true);
  };

  const save = async event => {
    event.preventDefault();
    if (!canManage) return setError('Only an administrator can manage curriculum units.');
    if (!scopedSchool || !selectedClass) return setError('Select the school and class first.');
    if (!/^\d+$/.test(String(formData.unit_number).trim())) return setError('Enter a valid unit number.');
    if (!norm(formData.topic) || !norm(formData.objectives)) return setError('Topic and objectives are required.');
    setSaving(true); setError('');
    try {
      const number = Number(formData.unit_number);
      await request(editing?.id ? `/curriculum/${encodeURIComponent(editing.id)}` : '/curriculum', editing?.id ? 'PATCH' : 'POST', {
        school_class: selectedClass.id,
        grade: gradeOf(selectedClass),
        unit_code: `U${number}`,
        title: norm(formData.topic),
        week: unitLabel(number),
        topic: norm(formData.topic),
        objectives: norm(formData.objectives),
        status: formData.status === 'published' ? 'published' : 'draft',
      });
      await refreshAll?.(); setIsModalOpen(false);
      toast.success(`${unitLabel(number)} saved for ${selectedClass.display_name || `${selectedClass.grade}-${selectedClass.section}`}.`, 'Curriculum updated');
    } catch (err) { setError(err.message || 'Unable to save curriculum unit.'); }
    finally { setSaving(false); }
  };

  const togglePublication = async item => {
    if (!canManage) return setError('Only an administrator can publish or unpublish curriculum units.');
    setSaving(true); setError('');
    try {
      const next = norm(item.status).toLowerCase() === 'published' ? 'draft' : 'published';
      await request(`/curriculum/${encodeURIComponent(item.id)}`, 'PATCH', { school_class: selectedClass.id, status: next });
      await refreshAll?.(); toast.success(`${item.title} is now ${next === 'published' ? 'published' : 'draft'}.`, 'Curriculum status updated');
    } catch (err) { setError(err.message || 'Unable to update curriculum status.'); }
    finally { setSaving(false); }
  };

  if (!activeSchools.length) return <div className="space-y-6 pb-10"><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Academic</p><h1 className="text-2xl font-black text-slate-900">Curriculum & Session Plans</h1><div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white"><BookOpen size={36} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-700">No authorised schools</h3><p className="text-sm text-slate-400 mt-1">There are no active schools in this account's current scope.</p></div></div>;

  return <div className="pb-10 space-y-6">
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"><div><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Academic</p><h1 className="text-2xl font-black text-slate-900 mt-1">Curriculum & Session Plans</h1><p className="text-sm text-slate-500 mt-1">Select the real school and class. Curriculum units are assigned to that class; publication controls scheduling availability.</p></div>{canManage && <button type="button" onClick={openCreate} disabled={!selectedClass} className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2.5 rounded-lg font-black flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"><Plus size={18}/> Add Unit</button>}</div>
    {error && <ErrorState title="Curriculum action failed" description={error} onRetry={() => setError('')}/>} 
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><label className="block text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1.5">School *</label><select className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={scopedSchool?.id || ''} onChange={e => { setSelectedSchoolId(e.target.value); setSelectedClassId(''); }}><option value="">Select school</option>{activeSchools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></div><div><label className="block text-[10px] uppercase tracking-wider font-black text-slate-500 mb-1.5">Class *</label><select className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold" value={selectedClass?.id || ''} onChange={e => setSelectedClassId(e.target.value)} disabled={!schoolClasses.length}><option value="">Select class</option>{schoolClasses.map(c => <option key={c.id} value={c.id}>{c.display_name || `${c.grade}-${c.section}`} · Grade {c.grade}</option>)}</select></div></section>
    {!selectedClass ? <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white"><BookOpen size={36} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-700">Select a school and class</h3><p className="text-sm text-slate-400 mt-1">Curriculum is shown only for the selected real class.</p></div> : <><div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-xs text-blue-900"><b>{scopedSchool.name} · {selectedClass.display_name || `${selectedClass.grade}-${selectedClass.section}`}</b> · Grade {gradeOf(selectedClass)} currently has <b>{visibleCurriculum.length}</b> assigned unit{visibleCurriculum.length === 1 ? '' : 's'}.</div><div className="max-w-5xl space-y-4">{visibleCurriculum.map((unit, index) => { const published = norm(unit.status).toLowerCase() === 'published'; return <div key={unit.id || index} className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-col sm:flex-row justify-between gap-3 mb-4"><div className="flex items-center gap-2.5 flex-wrap"><span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-slate-100 text-slate-700">{unitLabel(unit.unit_code || unit.week)}</span><h3 className="text-base sm:text-lg font-bold text-slate-800">{unit.topic || unit.title}</h3><span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{published ? 'Published' : 'Draft'}</span></div>{canManage && <div className="flex gap-2 shrink-0"><button type="button" onClick={() => openEdit(unit)} className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 inline-flex items-center gap-1.5"><Pencil size={14}/> Edit</button><button type="button" onClick={() => togglePublication(unit)} disabled={saving} className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 inline-flex items-center gap-1.5">{published ? <EyeOff size={14}/> : <Eye size={14}/>} {published ? 'Unpublish' : 'Publish'}</button></div>}</div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Learning objectives & practical task</p><div className="text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-wrap">{unit.objectives || '—'}</div></div>; })}{!visibleCurriculum.length && <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white"><BookOpen size={36} className="mx-auto text-slate-300 mb-3"/><h3 className="font-bold text-slate-700">No units assigned to this class</h3>{canManage && <><p className="text-sm text-slate-400 mt-1 mb-4">Create the first unit for this school/class.</p><button type="button" onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">+ Create Unit</button></>}</div>}</div></>}
    {canManage && isModalOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-slate-200"><div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white"><div><h2 className="text-lg font-bold text-slate-800">{editing ? 'Edit Curriculum Unit' : 'Add Curriculum Unit'}</h2><p className="text-xs text-slate-500 mt-1">{scopedSchool.name} · {selectedClass.display_name || `${selectedClass.grade}-${selectedClass.section}`}</p></div><button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400"><X size={20}/></button></div><form onSubmit={save} className="p-6 space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unit Number *</label><input type="number" min="1" step="1" value={formData.unit_number} onChange={e => setFormData(v => ({...v, unit_number:e.target.value}))} disabled={Boolean(editing)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" required/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic *</label><input type="text" value={formData.topic} onChange={e => setFormData(v => ({...v, topic:e.target.value}))} placeholder="Topic" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Learning Objectives & Practical Task *</label><textarea rows="4" value={formData.objectives} onChange={e => setFormData(v => ({...v, objectives:e.target.value}))} placeholder="What students should learn/build" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" required/></div><div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Publication status</label><select value={formData.status} onChange={e => setFormData(v => ({...v, status:e.target.value}))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"><option value="published">Published</option><option value="draft">Draft</option></select></div><div className="flex justify-end gap-3 pt-4 border-t border-slate-100"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 rounded-lg font-medium text-sm">Cancel</button><button type="submit" disabled={saving} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-black text-sm disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Update Unit' : 'Create & Publish'}</button></div></form></div></div>}
  </div>;
}
