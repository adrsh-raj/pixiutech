import { useEffect, useMemo, useState } from 'react';
import { BookOpen, CalendarDays, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import RefreshButton from '../components/ui/RefreshButton';

const asList = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const keys = (...values) => values.filter(Boolean).map(value => String(value).trim()).filter(Boolean);

export default function TrainerClasses() {
  const { user } = useAuth();
  const { classes = [], schools = [], students = [], sessions = [], refreshAll, loading } = useData();
  const [assignments, setAssignments] = useState([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingAssignments(true);
      setAssignmentError('');
      try {
        const response = await apiFetch('/trainer-school-assignments', { cache: 'no-store' });
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.detail || payload.error || `Unable to load trainer assignments (${response.status}).`);
        if (!cancelled) setAssignments(asList(payload));
      } catch (error) {
        if (!cancelled) setAssignmentError(error.message);
      } finally {
        if (!cancelled) setLoadingAssignments(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const trainerKeys = useMemo(() => new Set(keys(user?.id, user?.related_id, user?.username)), [user]);
  const activeAssignments = useMemo(() => assignments.filter(item => {
    const status = String(item.status || 'active').toLowerCase();
    const trainerKey = keys(item.trainer, item.trainer_id);
    return status === 'active' && trainerKey.some(key => trainerKeys.has(key));
  }), [assignments, trainerKeys]);

  const schoolKeys = useMemo(() => new Set(activeAssignments.flatMap(item => keys(item.school, item.school_id, item.school_code))), [activeAssignments]);

  const myClasses = useMemo(() => classes.filter(item => {
    if (String(item.status || 'active').toLowerCase() === 'inactive') return false;
    return keys(item.school_id, item.school_code, item.school).some(key => schoolKeys.has(key));
  }), [classes, schoolKeys]);

  const schoolByKey = useMemo(() => {
    const map = new Map();
    schools.forEach(school => keys(school.id, school.school_id, school.school_code, school.code).forEach(key => map.set(key, school)));
    return map;
  }, [schools]);

  const studentCount = classId => students.filter(student => String(student.class_id || student.school_class) === String(classId)).length;
  const sessionCount = classId => sessions.filter(session => {
    const sessionTrainer = keys(session.trainer, session.trainer_id);
    return sessionTrainer.some(key => trainerKeys.has(key)) && String(session.school_class || session.class_id) === String(classId);
  }).length;

  const reload = async () => {
    await Promise.all([refreshAll(), (async () => {
      try {
        const response = await apiFetch('/trainer-school-assignments', { cache: 'no-store' });
        const payload = await response.json().catch(() => []);
        if (!response.ok) throw new Error(payload.detail || payload.error || `Unable to load trainer assignments (${response.status}).`);
        setAssignments(asList(payload));
        setAssignmentError('');
      } catch (error) { setAssignmentError(error.message); }
    })()]);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Trainer" title="My Classes" description="Classes available through your active trainer-school assignments." actions={<RefreshButton onRefresh={reload} loading={loading || loadingAssignments} />} />
      {assignmentError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">Unable to load trainer assignments: {assignmentError}</div>}
      {!loadingAssignments && !assignmentError && myClasses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12">
          <EmptyState icon={<BookOpen size={20} />} title="No classes assigned" description="No active classes are currently available through your active trainer-school assignments." />
          <div className="flex justify-center mt-5"><Link to="/sessions" className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Open Sessions</Link></div>
        </div>
      ) : loadingAssignments ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-slate-400">Loading authorised classes…</div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {myClasses.map(item => {
            const school = schoolByKey.get(String(item.school_id || item.school_code || item.school));
            return <article key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] uppercase tracking-[0.16em] font-black text-blue-600">{school?.name || item.school_code || item.school_id || 'Authorised school'}</p><h2 className="text-lg font-black text-slate-900 mt-1">{item.display_name || `${item.grade}${item.section ? `-${item.section}` : ''}`}</h2></div>
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
