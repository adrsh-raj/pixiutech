import { useMemo } from 'react';
import { BookOpen, CalendarDays, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';
import { useAuth } from '../context/AuthContext';

export default function TrainerClasses() {
  const { user } = useAuth();
  const { classes = [], schools = [], students = [], sessions = [], refreshAll, loading } = useData();

  const trainerKeys = useMemo(() => new Set([user?.id, user?.related_id, user?.username].filter(Boolean).map(String)), [user]);
  const mySessions = useMemo(() => sessions.filter(session => trainerKeys.has(String(session.trainer || session.trainer_id))), [sessions, trainerKeys]);
  const myClassIds = useMemo(() => new Set(mySessions.map(session => String(session.school_class || session.class_id || '')).filter(Boolean)), [mySessions]);
  const myClasses = useMemo(() => classes.filter(item => myClassIds.has(String(item.id))), [classes, myClassIds]);

  const schoolById = useMemo(() => new Map(schools.map(school => [String(school.id), school])), [schools]);
  const studentCount = classId => students.filter(student => String(student.class_id || student.school_class) === String(classId)).length;
  const sessionCount = classId => mySessions.filter(session => String(session.school_class || session.class_id) === String(classId)).length;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Trainer" title="My Classes" description="Classes available through your active school and trainer assignments." actions={<RefreshButton onRefresh={refreshAll} loading={loading} />} />
      {myClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <EmptyState icon={<BookOpen size={20} />} title="No classes assigned" description="Your classes appear here after a school class and trainer assignment exist in the database." />
          <div className="flex justify-center mt-5"><Link to="/sessions" className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">View Sessions</Link></div>
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {myClasses.map(item => {
            const school = schoolById.get(String(item.school_id || item.school));
            return <article key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] uppercase tracking-[0.16em] font-black text-blue-600">{school?.name || 'School record unavailable'}</p><h2 className="text-lg font-black text-slate-900 mt-1">{item.display_name || `Grade ${item.grade} - ${item.section}`}</h2></div>
                <span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase text-slate-600">{item.status || 'active'}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><Users size={15} className="text-blue-600"/><p className="text-2xl font-black text-slate-900 mt-2">{studentCount(item.id)}</p><p className="text-[10px] uppercase font-black text-slate-400">Students</p></div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3"><CalendarDays size={15} className="text-violet-600"/><p className="text-2xl font-black text-slate-900 mt-2">{sessionCount(item.id)}</p><p className="text-[10px] uppercase font-black text-slate-400">Sessions</p></div>
              </div>
            </article>;
          })}
        </section>
      )}
    </div>
  );
}
