import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clipboard, GraduationCap, Plus, Search, Users, WalletCards } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PortalShell from '../components/PortalShell';
import KpiCard from '../components/ui/KpiCard';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';

const text = value => String(value ?? '').trim();
const norm = value => text(value).toUpperCase();
const lower = value => text(value).toLowerCase();
const localDateKey = value => { const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const matchesSchool = (row, school) => {
  const keys = [school?.id, school?.school_id, school?.school_code, school?.code].filter(Boolean).map(norm);
  const values = [row?.school_id, row?.school_code, row?.school].filter(Boolean).map(norm);
  return values.some(value => keys.includes(value));
};
const statusActive = status => !['inactive', 'archived', 'cancelled', 'graduated', 'withdrawn', 'terminated'].includes(lower(status));

function Field({ label, children }) { return <label className="block"><span className="mb-1 block text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</span>{children}</label>; }
function fieldClass() { return 'min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10'; }

export default function SchoolPortal() {
  const { user } = useAuth();
  const { schools = [], classes = [], students = [], trainers = [], attendance = [], notifications = [], refreshAll, loading, addStudent, getNextRollNumber } = useData();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [studentModal, setStudentModal] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [savingStudent, setSavingStudent] = useState(false);
  const [form, setForm] = useState({ school_class: '', roll_number: '', name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '' });

  const activeSchool = useMemo(() => {
    const requested = norm(user?.school_id || user?.school_code);
    if (!requested) return null;
    return schools.find(s => [s.id, s.school_id, s.school_code, s.code].filter(Boolean).map(norm).includes(requested)) || null;
  }, [schools, user?.school_id, user?.school_code]);

  const schoolClasses = useMemo(() => !activeSchool ? [] : classes.filter(item => matchesSchool(item, activeSchool) && statusActive(item.status)), [classes, activeSchool]);
  const classIds = useMemo(() => new Set(schoolClasses.map(item => String(item.id))), [schoolClasses]);
  const schoolStudents = useMemo(() => !activeSchool ? [] : students.filter(item => matchesSchool(item, activeSchool) || classIds.has(String(item.class_id || item.school_class))), [students, activeSchool, classIds]);
  const activeStudents = useMemo(() => schoolStudents.filter(item => statusActive(item.status)), [schoolStudents]);
  const activeTrainers = useMemo(() => !activeSchool ? [] : trainers.filter(item => statusActive(item.status) && text(item.assigned_schools).split(/[,;\s]+/).some(value => [activeSchool.id, activeSchool.school_id, activeSchool.school_code, activeSchool.code].filter(Boolean).map(norm).includes(norm(value)))), [trainers, activeSchool]);
  const sessionIds = useMemo(() => new Set(), []);
  const schoolAttendance = useMemo(() => !activeSchool ? [] : attendance.filter(item => matchesSchool(item, activeSchool) || sessionIds.has(String(item.session_id || item.session))), [attendance, activeSchool, sessionIds]);
  const todayAttendance = schoolAttendance.filter(item => localDateKey(item.date || item.timestamp || item.created_at) === localDateKey(new Date()));
  const attendanceRate = todayAttendance.length ? Math.round((todayAttendance.filter(item => ['present', 'late'].includes(lower(item.status))).length / todayAttendance.length) * 100) : null;
  const unread = notifications.filter(item => !item.read).length;

  const rawTab = params.get('tab') || 'overview';
  const allowedTabs = new Set(['overview', 'students', 'trainers', 'attendance', 'announcements']);
  const tab = allowedTabs.has(rawTab) ? rawTab : 'overview';
  const setTab = value => setParams({ tab: value });
  const visibleStudents = activeStudents.filter(item => !search || [item.name, item.student_id, item.guardian_name, item.class_name].join(' ').toLowerCase().includes(search.toLowerCase()));

  const openStudentModal = () => {
    const firstClass = schoolClasses[0];
    const schoolCode = activeSchool?.school_code || activeSchool?.code || user?.school_code || '';
    const nextRoll = firstClass && schoolCode ? getNextRollNumber(schoolCode, firstClass.grade, firstClass.section) : '';
    setForm({ school_class: firstClass?.id || '', roll_number: nextRoll, name: '', guardian_name: '', guardian_phone: '', guardian_email: '', email: '', phone: '', date_of_birth: '', gender: '', address: '', current_level: '' });
    setStudentModal(true);
  };

  const changeClass = classId => {
    const chosen = schoolClasses.find(item => String(item.id) === String(classId));
    const schoolCode = activeSchool?.school_code || activeSchool?.code || user?.school_code || '';
    const nextRoll = chosen && schoolCode ? getNextRollNumber(schoolCode, chosen.grade, chosen.section) : '';
    setForm(prev => ({ ...prev, school_class: classId, roll_number: nextRoll }));
  };

  const submitStudent = async event => {
    event.preventDefault();
    if (!form.school_class) return toast.error('Select an active class before enrolling the student.');
    setSavingStudent(true);
    const result = await addStudent({ ...form, school_code: activeSchool?.school_code || user?.school_code || '' });
    setSavingStudent(false);
    if (!result?.success) return toast.error(result?.error || 'Student registration failed.');
    const created = result.data || {};
    setStudentModal(false);
    setCredentials({ student_id: created.student_id || '—', username: created.account_username || created.student_id || '—', password: created.initial_password || 'Not returned' });
    toast.success(`${created.name || form.name} enrolled successfully.`, 'Student Registered');
  };

  const copy = async value => { try { await navigator.clipboard.writeText(String(value)); toast.success('Copied to clipboard.'); } catch { toast.error('Clipboard access was unavailable.'); } };

  if (!activeSchool) return <PortalShell role="school" title="School Overview" subtitle="Your school workspace is scoped by the authenticated school account."><ErrorState title="School workspace is not linked" description="This account does not have a valid school scope. No other school's data is shown." onRetry={refreshAll}/></PortalShell>;

  return <PortalShell role="school" title="School Operations" subtitle={activeSchool.name}>
    <div className="space-y-5 pb-10">
      {tab === 'overview' && <>
        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-300">School operations</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{activeSchool.name}</h2><p className="mt-1 text-sm text-slate-300">Students, trainers, attendance, progress reports and billing.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTab('students')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-slate-900"><Users size={14}/> Students</button><Link to="/school-progress-reports" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white"><WalletCards size={14}/> Progress reports</Link></div></div></section>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><KpiCard icon={<Users size={20}/>} label="Students" value={activeStudents.length} color="blue"/><KpiCard icon={<GraduationCap size={20}/>} label="Trainers" value={activeTrainers.length} color="amber"/><KpiCard icon={<CheckCircle2 size={20}/>} label="Attendance today" value={attendanceRate == null ? '—' : `${attendanceRate}%`} color="emerald"/><KpiCard icon={<WalletCards size={20}/>} label="Unread alerts" value={unread} color="violet"/></section>
        <section className="grid gap-4 lg:grid-cols-3"><Link to="/school-progress-reports" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-200"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">Progress</p><h3 className="mt-2 font-black text-slate-900">Generate school & student PDFs</h3><p className="mt-1 text-xs text-slate-500">Create a whole-school progress report or an individual student report.</p><ArrowRight size={15} className="mt-4 text-slate-400"/></Link><Link to="/billing" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-200"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">Finance</p><h3 className="mt-2 font-black text-slate-900">Billing & Contracts</h3><p className="mt-1 text-xs text-slate-500">Review invoices, submit payments and track verification.</p><ArrowRight size={15} className="mt-4 text-slate-400"/></Link><Link to="/notifications" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-200"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600">Communication</p><h3 className="mt-2 font-black text-slate-900">Notifications</h3><p className="mt-1 text-xs text-slate-500">Review invoice, payment and school alerts from the bell.</p><ArrowRight size={15} className="mt-4 text-slate-400"/></Link></section>
      </>}

      {tab === 'students' && <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">School data</p><h2 className="mt-1 text-2xl font-black text-slate-900">Students</h2><p className="mt-1 text-sm text-slate-500">Enroll a student and receive the generated ID and initial password.</p></div><button type="button" onClick={openStudentModal} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700"><Plus size={15}/> Enroll Student</button></div><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10" placeholder="Search student, ID or guardian…"/></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{visibleStudents.length ? visibleStudents.map(student => <div key={student.id || student.student_id} className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-b-0"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">{text(student.name).slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{student.name}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{student.student_id || 'No student ID'} · {student.class_name || 'Class not shown'}</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-500">{student.status}</span></div>) : <EmptyState title="No student records" description="No students match the current search. Enrollment is available from the button above."/>}</div></section>}

      {tab === 'trainers' && <section className="space-y-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">School data</p><h2 className="mt-1 text-2xl font-black text-slate-900">Trainers</h2></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{activeTrainers.length ? activeTrainers.map(trainer => <div key={trainer.id || trainer.trainer_id} className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-b-0"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-xs font-black text-amber-700">{text(trainer.name).slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{trainer.name}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{trainer.trainer_id || 'Trainer ID not shown'}</p></div></div>) : <EmptyState title="No active trainers" description="Trainers assigned to this school will appear here."/>}</div></section>}

      {tab === 'attendance' && <section className="space-y-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">School data</p><h2 className="mt-1 text-2xl font-black text-slate-900">Attendance</h2><p className="mt-1 text-sm text-slate-500">Read-only school attendance records. Trainers submit attendance from their session workflow.</p></div><div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-4"><p className="text-sm font-black text-slate-800">Today</p><p className="text-sm font-black text-slate-700">{attendanceRate == null ? '—' : `${attendanceRate}%`}</p></div>{todayAttendance.length ? todayAttendance.slice(0, 50).map((row, index) => <div key={row.id || `${row.student_id}-${index}`} className="flex items-center justify-between border-b border-slate-100 p-4 last:border-b-0"><div><p className="text-sm font-bold text-slate-800">{row.student_id || row.student || 'Student'}</p><p className="mt-1 text-[10px] text-slate-400">{row.note || 'Recorded attendance'}</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-600">{row.status}</span></div>) : <EmptyState title="No attendance recorded today" description="Attendance will appear after trainers save a session roster."/>}</div></section>}

      {tab === 'announcements' && <section className="space-y-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Communication</p><h2 className="mt-1 text-2xl font-black text-slate-900">Announcements</h2></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{notifications.length ? notifications.map(item => <div key={item.id} className="border-b border-slate-100 p-4 last:border-b-0"><div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 rounded-full ${item.read ? 'bg-slate-200' : 'bg-blue-500'}`}/><div><p className="text-sm font-black text-slate-800">{item.title || 'Notification'}</p><p className="mt-1 text-xs leading-relaxed text-slate-500">{item.message || ''}</p></div></div></div>) : <EmptyState title="No announcements" description="New school notices and finance alerts will appear here."/>}</div></section>}
    </div>

    {studentModal && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">Student onboarding</p><h2 className="mt-1 text-xl font-black text-slate-900">Enroll Student</h2><p className="mt-1 text-xs text-slate-500">The server will generate the permanent Student ID and initial password.</p></div><button type="button" onClick={() => setStudentModal(false)} className="rounded-xl px-3 py-2 text-slate-400 hover:bg-slate-100" aria-label="Close">✕</button></div>{!schoolClasses.length ? <div className="mt-6"><EmptyState title="No active class available" description="A student ID is based on the school's class and roll. Ask the Pixiu Tech administrator to create an active class for this school first."/><button type="button" onClick={() => setStudentModal(false)} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-xs font-black text-white">Close</button></div> : <form onSubmit={submitStudent} className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Full name"><input className={fieldClass()} value={form.name} onChange={e => setForm(v => ({...v,name:e.target.value}))} required/></Field><Field label="Class"><select className={fieldClass()} value={form.school_class} onChange={e => changeClass(e.target.value)} required><option value="">Select class</option>{schoolClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || `${item.grade}${item.section || ''}`}</option>)}</select></Field><Field label="Roll number"><input className={fieldClass()} value={form.roll_number} onChange={e => setForm(v => ({...v,roll_number:e.target.value}))} inputMode="numeric" required/></Field><Field label="Guardian name"><input className={fieldClass()} value={form.guardian_name} onChange={e => setForm(v => ({...v,guardian_name:e.target.value}))}/></Field><Field label="Guardian phone"><input className={fieldClass()} value={form.guardian_phone} onChange={e => setForm(v => ({...v,guardian_phone:e.target.value}))}/></Field><Field label="Guardian email"><input type="email" className={fieldClass()} value={form.guardian_email} onChange={e => setForm(v => ({...v,guardian_email:e.target.value}))}/></Field><Field label="Student email"><input type="email" className={fieldClass()} value={form.email} onChange={e => setForm(v => ({...v,email:e.target.value}))}/></Field><Field label="Phone"><input className={fieldClass()} value={form.phone} onChange={e => setForm(v => ({...v,phone:e.target.value}))}/></Field><Field label="Date of birth"><input type="date" className={fieldClass()} value={form.date_of_birth} onChange={e => setForm(v => ({...v,date_of_birth:e.target.value}))}/></Field><Field label="Gender"><select className={fieldClass()} value={form.gender} onChange={e => setForm(v => ({...v,gender:e.target.value}))}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field><Field label="Current level"><input className={fieldClass()} value={form.current_level} onChange={e => setForm(v => ({...v,current_level:e.target.value}))}/></Field><Field label="Address"><input className={fieldClass()} value={form.address} onChange={e => setForm(v => ({...v,address:e.target.value}))}/></Field><div className="sm:col-span-2 rounded-2xl bg-blue-50 p-4 text-xs text-blue-900"><p className="font-black">ID & password are generated by Django</p><p className="mt-1">The response will show the new Student ID and one-time initial password immediately after enrollment.</p></div><div className="sm:col-span-2 flex justify-end gap-2"><button type="button" onClick={() => setStudentModal(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600">Cancel</button><button disabled={savingStudent} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-50">{savingStudent ? 'Enrolling…' : 'Enroll Student'}</button></div></form>}</div></div>}
    {credentials && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">Enrollment complete</p><h2 className="mt-1 text-2xl font-black text-slate-900">Student credentials</h2><p className="mt-1 text-xs text-slate-500">Save these credentials now. The initial password is only returned at enrollment time.</p></div><div className="mt-5 space-y-3"><Credential label="Student ID" value={credentials.student_id} onCopy={() => copy(credentials.student_id)}/><Credential label="Username" value={credentials.username} onCopy={() => copy(credentials.username)}/><Credential label="Initial password" value={credentials.password} onCopy={() => copy(credentials.password)} secret/></div><button type="button" onClick={() => setCredentials(null)} className="mt-5 w-full rounded-xl bg-slate-900 py-3 text-xs font-black text-white">Done</button></div></div>}
  </PortalShell>;
}

function Credential({ label, value, onCopy, secret = false }) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 truncate font-mono text-sm font-black ${secret ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p></div><button type="button" onClick={onCopy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-black text-slate-600"><Clipboard size={13}/> Copy</button></div></div>; }
