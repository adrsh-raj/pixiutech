import { useMemo, useState } from 'react';
import { BookOpen, Edit3, Plus, Search, Users, X, Layers3 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';
import RefreshButton from '../components/ui/RefreshButton';
import EmptyState from '../components/ui/EmptyState';

const text = value => String(value ?? '').trim();
const norm = value => text(value).toUpperCase();
const active = value => text(value || 'active').toLowerCase() !== 'inactive';
const blankForm = { school: '', grade: '', section: '', display_name: '', status: 'active' };

export default function ClassesV2() {
  const { role } = useAuth();
  const { schools = [], classes = [], students = [], addClass, updateClass, deleteClass, refreshAll, loading } = useData();
  const [params, setParams] = useSearchParams();
  const [schoolFilter, setSchoolFilter] = useState(text(params.get('school')));
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  const selectableSchools = useMemo(() => {
    if (role === 'school') return schools.filter(s => active(s.status));
    return schools.filter(s => active(s.status));
  }, [schools, role]);

  const selectedSchool = useMemo(() => {
    const key = text(schoolFilter);
    if (role === 'school') return selectableSchools[0] || null;
    return selectableSchools.find(s => String(s.id) === key || norm(s.school_code || s.code) === norm(key)) || null;
  }, [selectableSchools, schoolFilter, role]);

  const visibleClasses = useMemo(() => {
    const q = text(query).toLowerCase();
    return classes
      .filter(cls => !selectedSchool || norm(cls.school_id || cls.school_code) === norm(selectedSchool.school_code || selectedSchool.code || selectedSchool.id))
      .filter(cls => statusFilter === 'all' || (statusFilter === 'active' ? active(cls.status) : !active(cls.status)))
      .filter(cls => !q || [cls.display_name, cls.grade, cls.section, cls.school_code].join(' ').toLowerCase().includes(q))
      .sort((a, b) => `${String(a.grade).padStart(2, '0')}${a.section}`.localeCompare(`${String(b.grade).padStart(2, '0')}${b.section}`));
  }, [classes, selectedSchool, statusFilter, query]);

  const openCreate = () => {
    if (!selectedSchool) return toast.error('Select a school first.');
    setEditing(null);
    setForm({ ...blankForm, school: selectedSchool.id });
    setModalOpen(true);
  };

  const openEdit = cls => {
    setEditing(cls);
    setForm({ school: cls.school_id || '', grade: cls.grade || '', section: cls.section || '', display_name: cls.display_name || '', status: cls.status || 'active' });
    if (cls.school_id) {
      const match = schools.find(s => norm(s.school_code || s.code) === norm(cls.school_id));
      if (match) setSchoolFilter(String(match.id));
    }
    setModalOpen(true);
  };

  const close = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  };

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    const school = selectedSchool?.id || form.school;
    const grade = norm(form.grade);
    const section = norm(form.section) || 'A';
    if (!school) return toast.error('Select a school.');
    if (!/^\d{1,2}$/.test(grade)) return toast.error('Grade must be a number from 1 to 99.');
    if (!/^[A-Z0-9]{1,5}$/.test(section)) return toast.error('Section must contain 1-5 letters or numbers.');
    setSaving(true);
    try {
      const payload = { school, grade, section, display_name: text(form.display_name), status: active(form.status) ? 'active' : 'inactive' };
      const result = editing?.id ? await updateClass(editing.id, payload) : await addClass(payload);
      if (!result?.success) throw new Error(result?.error || 'Class could not be saved.');
      toast.success(editing ? 'Class updated successfully.' : `${grade}${section} created successfully.`, editing ? 'Class updated' : 'Class created');
      close();
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Class could not be saved.', 'Class save failed');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async cls => {
    if (saving || !active(cls.status)) return;
    const name = cls.display_name || (String(cls.grade) + String(cls.section));
    if (!window.confirm(`Deactivate ${name}? Students and historical records will remain محفوظ.`)) return;
    setSaving(true);
    try {
      const result = await deleteClass(cls.id);
      if (!result?.success) throw new Error(result?.error || 'Class could not be deactivated.');
      toast.success(`${name} is now inactive.`, 'Class deactivated');
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Class could not be deactivated.', 'Class action failed');
    } finally {
      setSaving(false);
    }
  };

  const studentCount = cls => Number(cls.active_student_count ?? students.filter(student => String(student.class_id || student.school_class) === String(cls.id) && active(student.status)).length);

  return (
    <div className="space-y-5 pb-10">
      <PageHeader eyebrow="Academics" title="Classes" description="Create and manage the academic structure for each partner school." actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />
      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_170px_1.2fr_auto]">
        {role !== 'school' ? <label><span className="label">School</span><select value={schoolFilter} onChange={event => { const value = event.target.value; setSchoolFilter(value); setParams(value ? { school: value } : {}); }} className="field"><option value="">Select school</option>{selectableSchools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></label> : <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"><p className="label">School</p><p className="mt-1 text-sm font-black text-slate-800">{selectedSchool?.name || 'Your school'}</p></div>}
        <label><span className="label">Status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field"><option value="active">Active</option><option value="all">All</option><option value="inactive">Inactive</option></select></label>
        <label><span className="label">Search</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} className="field pl-9" placeholder="Grade, section or class…"/></div></label>
        <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700"><Plus size={15}/> Create class</button>
      </section>

      {!selectedSchool ? <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6"><div className="flex items-start gap-3"><Layers3 size={20} className="mt-0.5 text-blue-600"/><div><p className="font-black text-blue-950">Select a school to manage its classes.</p><p className="mt-1 text-sm text-blue-800">For XYZ Academy, select XYZ Academy and create Grade 6 · Section A.</p></div></div></div> : visibleClasses.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10"><EmptyState icon={<BookOpen size={20}/>} title="No classes yet" description="Create the first active class for this school."/></div> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_150px_150px_200px] border-b border-slate-100 bg-slate-50 px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400"><span>Class</span><span>School</span><span>Students</span><span className="text-right">Actions</span></div>
        {visibleClasses.map(cls => { const name = cls.display_name || (String(cls.grade) + String(cls.section)); return <div key={cls.id} className="grid grid-cols-[minmax(0,1fr)_150px_150px_200px] items-center border-b border-slate-100 px-4 py-3 last:border-b-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><BookOpen size={17}/></span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{name}</p><p className="mt-0.5 text-[10px] font-semibold text-slate-400">Grade {cls.grade} · Section {cls.section}</p></div></div><p className="truncate text-xs font-semibold text-slate-600">{cls.school_code || '—'}</p><div className="flex items-center gap-2 text-xs font-black text-slate-700"><Users size={14} className="text-blue-600"/>{studentCount(cls)}</div><div className="flex justify-end gap-2"><span className={active(cls.status) ? 'rounded-lg bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-emerald-700' : 'rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500'}>{cls.status || 'active'}</span><button type="button" onClick={() => openEdit(cls)} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Edit class"><Edit3 size={13}/></button>{active(cls.status) && <button type="button" disabled={saving} onClick={() => void deactivate(cls)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[9px] font-black text-rose-700 disabled:opacity-50">Deactivate</button>}</div></div>; })}</section>}

      {modalOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">{editing ? 'Edit class' : 'Create class'}</p><h2 className="mt-1 text-xl font-black text-slate-900">{editing ? 'Edit academic class' : 'Create academic class'}</h2></div><button type="button" onClick={close} disabled={saving} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div>
        <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="label">School</span><select value={form.school} disabled={Boolean(editing) || role === 'school'} onChange={e => setForm(v => ({ ...v, school: e.target.value }))} className="field" required><option value="">Select school</option>{selectableSchools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school_code})</option>)}</select></label>
          <label><span className="label">Grade</span><input type="number" min="1" max="99" value={form.grade} disabled={Boolean(editing && studentCount(editing) > 0)} onChange={e => setForm(v => ({ ...v, grade: e.target.value }))} className="field" placeholder="6" required/></label>
          <label><span className="label">Section <span className="font-normal text-slate-400">(optional)</span></span><input value={form.section} disabled={Boolean(editing && studentCount(editing) > 0)} onChange={e => setForm(v => ({ ...v, section: e.target.value.toUpperCase() }))} className="field" placeholder="A" maxLength={5}/><span className="mt-1 block text-[10px] font-semibold text-slate-400">Leave blank to automatically create Section A (for example, 6 → 6A).</span></label>
          <label className="sm:col-span-2"><span className="label">Class name <span className="font-normal text-slate-400">(optional)</span></span><input value={form.display_name} onChange={e => setForm(v => ({ ...v, display_name: e.target.value }))} className="field" placeholder="Grade 6 - A" maxLength={30}/></label>
          <label><span className="label">Status</span><select value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))} className="field"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <div className="sm:col-span-2 rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">Student IDs depend on school + grade + section. A blank section is stored as A. Once students are enrolled, grade and section become locked.</div>
          <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={close} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white">{saving ? 'Saving…' : editing ? 'Save changes' : 'Create class'}</button></div>
        </form></div></div>}
      <style>{`.field{width:100%;min-height:44px;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:#fff;outline:none}.field:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.12)}.label{display:block;margin-bottom:6px;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#94a3b8}`}</style>
    </div>
  );
}