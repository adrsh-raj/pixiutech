import { useMemo } from 'react';
import { CalendarDays, Clock3, School, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';
import ErrorState from '../components/ui/ErrorState';

const norm = value => String(value ?? '').trim().toLowerCase();

export default function StudentClasses() {
  const { user } = useAuth();
  const { students = [], classes = [], sessions = [], refreshAll, loading, endpointErrors = {} } = useData();
  const student = useMemo(() => students.find(item => String(item.id) === String(user?.related_id) || String(item.student_id || '').toUpperCase() === String(user?.username || '').toUpperCase()), [students, user]);
  const classId = String(student?.school_class || student?.class_id || '');
  const myClass = useMemo(() => classes.find(item => String(item.id) === classId), [classes, classId]);
  const mySessions = useMemo(() => sessions.filter(item => String(item.school_class || item.class_id) === classId && norm(item.status) !== 'cancelled').sort((a,b) => `${a.date || ''}${a.start_time || ''}`.localeCompare(`${b.date || ''}${b.start_time || ''}`)), [sessions, classId]);
  const rosterCount = students.filter(item => String(item.school_class || item.class_id) === classId && norm(item.status) !== 'inactive').length;
  const error = endpointErrors['/classes'] || endpointErrors['/sessions'] || '';

  if (!student) return <div className="space-y-5"><PageHeader eyebrow="Student" title="My Classes" description="Your classes and sessions from the live academic database."/><ErrorState title="Student record unavailable" description="The authenticated account is not linked to a student record. No other student's data is shown." onRetry={refreshAll}/></div>;
  return <div className="space-y-5 pb-10"><PageHeader eyebrow="Student" title="My Classes" description="Your class, roster size and scheduled sessions from the Django API." actions={<RefreshButton onRefresh={refreshAll} loading={loading}/>} />{error && <ErrorState title="Class data could not be fully loaded" description={error} onRetry={refreshAll}/>}<section className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4"><div className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><School size={20}/></span><div><p className="text-[10px] uppercase tracking-wider font-black text-blue-600">My class</p><h2 className="text-xl font-black text-slate-900 mt-1">{myClass?.display_name || student.class_name || 'Class not found'}</h2><p className="text-xs text-slate-400 mt-1">Grade {myClass?.grade || '—'} {myClass?.section || ''}</p></div></div></div><div className="bg-slate-950 text-white rounded-2xl p-5"><Users size={18} className="text-blue-300"/><p className="text-2xl font-black mt-3">{rosterCount}</p><p className="text-xs text-slate-400">Active classmates</p></div></section><section className="bg-white border border-slate-200 rounded-2xl overflow-hidden"><div className="p-5 border-b border-slate-100"><h2 className="font-black">Scheduled sessions</h2><p className="text-xs text-slate-400 mt-1">Your class session schedule. Attendance is managed from the Attendance page.</p></div><div className="divide-y divide-slate-100">{mySessions.map(session => <article key={session.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="font-black text-slate-900">{session.topic || 'Scheduled class'}</p><p className="text-xs text-slate-500 mt-1">{session.trainer_name || session.trainer_id || 'Trainer'} · {session.status || 'scheduled'}</p></div><div className="flex items-center gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays size={14}/>{session.date || '—'}</span><span className="inline-flex items-center gap-1"><Clock3 size={14}/>{session.start_time || '—'}</span></div></article>)}{!mySessions.length && <EmptyState icon={<CalendarDays size={19}/>} title="No sessions scheduled" description="No sessions are currently assigned to your class."/>}</div></section></div>;
}
