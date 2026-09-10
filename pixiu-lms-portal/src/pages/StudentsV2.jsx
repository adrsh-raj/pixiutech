import { useMemo, useState } from 'react';
import { Clipboard, Download, Plus, Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

const text = value => String(value ?? '').trim();
const norm = value => text(value).toUpperCase();
const active = value => !['inactive', 'graduated', 'withdrawn', 'terminated', 'archived'].includes(text(value).toLowerCase());
const schoolKeys = school => [school?.id, school?.school_id, school?.school_code, school?.code].filter(Boolean).map(norm);
const rowSchoolKeys = row => [row?.school_id, row?.school_code, row?.school].filter(Boolean).map(norm);
const sameSchool = (row, school) => rowSchoolKeys(row).some(key => schoolKeys(school).includes(key));

const fieldClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10';

export default function StudentsV2() {
  const { role, user } = useAuth();
  const { schools = [], classes = [], students = [], getNextRollNumber, addStudent, getStudentAttendance } = useData();
  const toast = useToast();
  const trainer = role === 'trainer';
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [form, setForm] = useState({ school_class: '', roll_number: '', name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '', status: 'active' });

  const visibleSchools = useMemo(() => {
    if (!trainer) return schools;
    const schoolCode = norm(user?.school_id || user?.school_code);
    return schools.filter(school => schoolKeys(school).includes(schoolCode));
  }, [schools, trainer, user?.school_code, user?.school_id]);

  const effectiveSchoolId = schoolId || (trainer ? visibleSchools[0]?.id : '');
  const selectedSchool = visibleSchools.find(school => String(school.id) === String(effectiveSchoolId)) || null;
  const visibleClasses = useMemo(() => {
    if (!selectedSchool) return trainer ? classes : classes.filter(item => !item.school_id && !item.school_code);
    return classes.filter(item => sameSchool(item, selectedSchool) || [item.school_id, item.school_code, item.school].filter(Boolean).map(norm).some(key => schoolKeys(selectedSchool).includes(key))).filter(item => active(item.status));
  }, [classes, selectedSchool, trainer]);
  const visibleStudents = useMemo(() => {
    const scoped = selectedSchool ? students.filter(student => sameSchool(student, selectedSchool) || visibleClasses.some(cls => String(cls.id) === String(student.class_id || student.school_class))) : trainer ? students : students;
    return scoped.filter(student => classId === 'all' || String(student.class_id || student.school_class) === String(classId)).filter(student => !search || [student.name, student.student_id, student.guardian_name, student.class_name].join(' ').toLowerCase().includes(search.toLowerCase()));
  }, [students, selectedSchool, visibleClasses, classId, search, trainer]);

  const classById = useMemo(() => new Map(visibleClasses.map(item => [String(item.id), item])), [visibleClasses]);

  const openEnroll = () => {
    const firstClass = visibleClasses[0];
    const school = selectedSchool || visibleSchools[0];
    const schoolCode = school?.school_code || school?.code || school?.school_id || user?.school_code || '';
    setForm({ school_class: firstClass?.id || '', roll_number: firstClass && schoolCode ? getNextRollNumber(schoolCode, firstClass.grade, firstClass.section) : '', name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '', status: 'active' });
    setModalOpen(true);
  };

  const chooseClass = classValue => {
    const cls = visibleClasses.find(item => String(item.id) === String(classValue));
    const schoolCode = selectedSchool?.school_code || selectedSchool?.code || selectedSchool?.school_id || user?.school_code || '';
    setForm(previous => ({ ...previous, school_class: classValue, roll_number: cls && schoolCode ? getNextRollNumber(schoolCode, cls.grade, cls.section) : '' }));
  };

  const submit = async event => {
    event.preventDefault();
    if (!form.school_class) return toast.error('Select an active class before enrolling the student.');
    if (!Number.isInteger(Number(form.roll_number)) || Number(form.roll_number) <= 0) return toast.error('Enter a valid positive roll number.');
    setSaving(true);
    const result = await addStudent({ ...form, school_code: selectedSchool?.school_code || selectedSchool?.code || user?.school_code || '' });
    setSaving(false);
    if (!result?.success) return toast.error(result?.error || 'Student registration failed.');
    const created = result.data || {};
    setModalOpen(false);
    setCredentials({ student_id: created.student_id || '—', username: created.account_username || created.student_id || '—', password: created.initial_password || 'Not returned by server' });
    toast.success(`${created.name || form.name} enrolled successfully.`, 'Student Registered');
  };

  const copy = async value => { try { await navigator.clipboard.writeText(String(value)); toast.success('Copied.'); } catch { toast.error('Copy was unavailable.'); } };

  const printStudent = student => generateStudentTranscriptPDF({ student, school: selectedSchool || { name: student.school_name || '—' }, attendanceRate: getStudentAttendance(student.student_id || student.id), studentReviews: [], projects: [], curriculum: [] });

  const selectSchool = value => { setSchoolId(value); setClassId('all'); setSearch(''); };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Academics" title="Student Directory" description={trainer ? 'Students visible through your active school assignments.' : 'Enroll students into a school class and receive their server-generated credentials.'} actions={<button type="button" onClick={openEnroll} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700"><UserPlus size={14}/> Enroll Student</button>} />

    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_1.4fr]">
      {!trainer && <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">School</span><select value={schoolId} onChange={e => selectSchool(e.target.value)} className={fieldClass}><option value="">Select school</option>{visibleSchools.map(school => <option key={school.id} value={school.id}>{school.name} ({school.school_code})</option>)}</select></label>}
      <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Class</span><select value={classId} onChange={e => setClassId(e.target.value)} className={fieldClass} disabled={!selectedSchool}><option value="all">All classes</option>{visibleClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || `${item.grade}${item.section ? ` ${item.section}` : ''}`}</option>)}</select></label>
      <label><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Search</span><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} className={`${fieldClass} pl-9`} placeholder="Student, ID, guardian or class…"/></div></label>
    </section>

    {!selectedSchool && !trainer ? <EmptyState icon={<Users size={20}/>} title="Select a school" description="Choose a partner school first, then its active class roster will appear here."/> : visibleClasses.length === 0 ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-black text-amber-950">No active class is available for this school.</p><p className="mt-1 text-sm text-amber-800">Enrollment requires a class because the server generates the Student ID from school, class and roll number. The Enroll Student button still opens the onboarding form so the missing setup is explicit.</p></section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="grid grid-cols-[minmax(0,1fr)_150px_120px] border-b border-slate-100 bg-slate-50 px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400"><span>Student</span><span>Class</span><span className="text-right">Status</span></div>{visibleStudents.map(student => <div key={student.id || student.student_id} className="grid grid-cols-[minmax(0,1fr)_150px_120px] items-center border-b border-slate-100 px-4 py-3 last:border-b-0"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{student.name}</p><p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{student.student_id || 'No Student ID'} · Roll {String(student.roll_number || '—')}</p></div><p className="truncate text-xs font-semibold text-slate-600">{student.class_name || classById.get(String(student.class_id || student.school_class))?.display_name || '—'}</p><div className="flex justify-end gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{student.status || 'active'}</span><button type="button" onClick={() => printStudent(student)} title="Student progress PDF" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"><Download size={13}/></button></div></div>)}{!visibleStudents.length && <div className="p-10"><EmptyState title="No student records" description="No students match the current school, class or search filters."/></div>}</section>}

    {modalOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Student onboarding</p><h2 className="mt-1 text-xl font-black text-slate-900">Enroll Student</h2><p className="mt-1 text-xs text-slate-500">Django will generate the permanent Student ID and initial password after successful registration.</p></div><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Close">×</button></div>{!selectedSchool && !trainer ? <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Select a school above before enrolling a student.</div> : !visibleClasses.length ? <div className="mt-6"><EmptyState title="No active class available" description="Create an active class for this school first, then return here to assign the student and generate credentials."/><button type="button" onClick={() => setModalOpen(false)} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-xs font-black text-white">Close</button></div> : <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="label">Full name</span><input className={fieldClass} value={form.name} onChange={e => setForm(v => ({...v,name:e.target.value}))} required/></label><label><span className="label">Class</span><select className={fieldClass} value={form.school_class} onChange={e => chooseClass(e.target.value)} required><option value="">Select class</option>{visibleClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || `${item.grade} ${item.section || ''}`}</option>)}</select></label><label><span className="label">Roll number</span><input className={fieldClass} type="number" min="1" step="1" value={form.roll_number} onChange={e => setForm(v => ({...v,roll_number:e.target.value}))} required/></label><label><span className="label">Guardian name</span><input className={fieldClass} value={form.guardian_name} onChange={e => setForm(v => ({...v,guardian_name:e.target.value}))}/></label><label><span className="label">Guardian phone</span><input className={fieldClass} value={form.guardian_phone} onChange={e => setForm(v => ({...v,guardian_phone:e.target.value}))}/></label><label><span className="label">Guardian email</span><input type="email" className={fieldClass} value={form.guardian_email} onChange={e => setForm(v => ({...v,guardian_email:e.target.value}))}/></label><label><span className="label">Student email</span><input type="email" className={fieldClass} value={form.email} onChange={e => setForm(v => ({...v,email:e.target.value}))}/></label><label><span className="label">Phone</span><input className={fieldClass} value={form.phone} onChange={e => setForm(v => ({...v,phone:e.target.value}))}/></label><label><span className="label">Date of birth</span><input type="date" className={fieldClass} value={form.date_of_birth} onChange={e => setForm(v => ({...v,date_of_birth:e.target.value}))}/></label><label><span className="label">Gender</span><select className={fieldClass} value={form.gender} onChange={e => setForm(v => ({...v,gender:e.target.value}))}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label><label><span className="label">Current level</span><input className={fieldClass} value={form.current_level} onChange={e => setForm(v => ({...v,current_level:e.target.value}))}/></label><label><span className="label">Address</span><input className={fieldClass} value={form.address} onChange={e => setForm(v => ({...v,address:e.target.value}))}/></label><div className="sm:col-span-2 rounded-2xl bg-blue-50 p-4 text-xs text-blue-900"><p className="font-black">Generated credentials</p><p className="mt-1">Student ID and initial password appear in a secure result dialog after the server confirms creation.</p></div><div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{saving ? 'Enrolling…' : 'Enroll Student'}</button></div></form>}</div></div>}

    {credentials && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">Enrollment complete</p><h2 className="mt-1 text-2xl font-black text-slate-900">Student login credentials</h2><p className="mt-1 text-xs text-slate-500">Save these credentials now. The initial password is returned only at successful enrollment.</p><div className="mt-5 space-y-3">{[['Student ID', credentials.student_id], ['Username', credentials.username], ['Initial password', credentials.password]].map(([label, value]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate font-mono text-sm font-black text-slate-900">{value}</p></div><button type="button" onClick={() => copy(value)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-black text-slate-600"><Clipboard size={13}/> Copy</button></div>)}</div><button type="button" onClick={() => setCredentials(null)} className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-xs font-black text-white">Done</button></div></div>}
  </div>;
}
