import { useMemo, useState } from 'react';
import { Download, FileText, Search } from 'lucide-react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { generateSchoolProgressPDF, generateStudentProgressPDF } from '../utils/progressReportGenerator';

const text = value => String(value ?? '').trim();
const norm = value => text(value).toUpperCase();
const active = value => !['inactive', 'graduated', 'withdrawn'].includes(text(value).toLowerCase());
const matchesSchool = (row, school) => {
  const schoolKeys = [school?.id, school?.school_id, school?.school_code, school?.code].filter(Boolean).map(norm);
  const rowKeys = [row?.school_id, row?.school_code, row?.school].filter(Boolean).map(norm);
  return rowKeys.some(key => schoolKeys.includes(key));
};
const identityKeys = row => [row?.id, row?.student_id, row?.studentId].filter(Boolean).map(norm);
const relatedToStudent = (row, student) => {
  const target = identityKeys(student);
  const source = [...identityKeys(row), ...(row?.student ? [norm(row.student)] : [])];
  return source.some(key => target.includes(key));
};

export default function SchoolProgressReports() {
  const { user } = useAuth();
  const { schools = [], classes = [], students = [], studentReviews = [], projects = [], curriculum = [], getStudentAttendance } = useData();
  const [search, setSearch] = useState('');

  const school = useMemo(() => {
    const key = norm(user?.school_id || user?.school_code);
    return schools.find(item => [item.id, item.school_id, item.school_code, item.code].filter(Boolean).map(norm).includes(key)) || null;
  }, [schools, user?.school_id, user?.school_code]);

  const schoolClasses = useMemo(() => school ? classes.filter(item => matchesSchool(item, school)) : [], [classes, school]);
  const classIds = useMemo(() => new Set(schoolClasses.map(item => String(item.id))), [schoolClasses]);
  const schoolStudents = useMemo(() => school ? students.filter(item => matchesSchool(item, school) || classIds.has(String(item.class_id || item.school_class))) : [], [students, school, classIds]);
  const activeStudents = useMemo(() => schoolStudents.filter(item => active(item.status)), [schoolStudents]);
  const filtered = activeStudents.filter(student => !search || [student.name, student.student_id, student.class_name, student.current_level].join(' ').toLowerCase().includes(search.toLowerCase()));
  const schoolReviews = studentReviews.filter(review => schoolStudents.some(student => relatedToStudent(review, student)));
  const schoolProjects = projects.filter(project => schoolStudents.some(student => relatedToStudent(project, student)));

  if (!school) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-800">This school account is not linked to an active school record.</div>;

  const generateWholeSchool = () => generateSchoolProgressPDF({ school, students: schoolStudents, classes: schoolClasses, getStudentAttendance });
  const generateStudent = async student => {
    const key = student.student_id || student.id;
    try {
      const response = await apiFetch(`/course-completion/student-report/${encodeURIComponent(key)}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || `Unable to load server progress record (${response.status}).`);
      }
      const completion = await response.json();
      generateStudentProgressPDF({
        student,
        school,
        attendanceRate: completion?.attendance?.percentage ?? getStudentAttendance(key),
        studentReviews: studentReviews.filter(review => relatedToStudent(review, student)),
        projects: projects.filter(project => relatedToStudent(project, student)),
        curriculum,
        completion,
      });
    } catch (error) {
      window.alert(error?.message || 'Unable to generate the server-authoritative progress report.');
    }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="School Reports" title="Progress Reports" description="Generate a whole-school progress PDF or an individual student progress PDF." actions={<button type="button" onClick={generateWholeSchool} disabled={!schoolStudents.length} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-40"><Download size={14}/> Generate School PDF</button>} />
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Active students</p><p className="mt-2 text-2xl font-black text-slate-900">{activeStudents.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Active classes</p><p className="mt-2 text-2xl font-black text-slate-900">{schoolClasses.filter(item => active(item.status)).length}</p></div><div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2"><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">School scope</p><p className="mt-2 text-sm font-black text-slate-900">{school.name} <span className="font-mono text-slate-400">({school.school_code})</span></p><p className="mt-1 text-[10px] text-slate-400">{schoolReviews.length} review records · {schoolProjects.length} project records available to this school account.</p></div></section>
    <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-black text-slate-900">Student reports</h2><p className="mt-1 text-sm text-slate-500">Each button opens a populated, print-ready progress report from the server-authoritative LMS record.</p></div><div className="relative w-full sm:w-80"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or ID…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10"/></div></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{filtered.length ? filtered.map(student => <div key={student.id || student.student_id} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">{text(student.name).slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{student.name}</p><p className="mt-1 truncate font-mono text-[10px] text-slate-400">{student.student_id || 'No student ID'} · {student.class_name || 'Class not shown'}</p></div></div><button type="button" onClick={() => generateStudent(student)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50"><FileText size={14}/> Student PDF</button></div>) : <EmptyState title="No students found" description="No active student records match the current search."/>}</div></section>
  </div>;
}
