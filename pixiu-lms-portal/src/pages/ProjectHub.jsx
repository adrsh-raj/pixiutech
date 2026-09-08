import { useMemo, useState } from 'react';
import { FolderKanban, Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

export default function ProjectHub() {
  const { projects = [], students = [] } = useData();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => projects.filter(project => {
    const student = students.find(item => String(item.id) === String(project.student || project.student_id));
    return `${project.title || ''} ${project.status || ''} ${student?.name || ''} ${student?.student_id || ''}`.toLowerCase().includes(query.toLowerCase().trim());
  }), [projects, students, query]);
  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Academics" title="Projects" description="Canonical project records linked to real students and assessment status." />
    <section className="bg-white border border-slate-200 rounded-2xl p-4"><div className="relative max-w-xl"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search project or student" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"/></div></section>
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Metric label="Projects" value={projects.length}/><Metric label="Submitted / Review" value={projects.filter(p => ['submitted','in_review'].includes(String(p.status).toLowerCase())).length}/><Metric label="Completed" value={projects.filter(p => String(p.status).toLowerCase() === 'completed').length}/></section>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Project','Student','Status','Score','Dates'].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(project => { const student = students.find(item => String(item.id) === String(project.student || project.student_id)); return <tr key={project.id}><td className="px-4 py-4"><p className="font-bold text-slate-800">{project.title}</p><p className="text-[10px] text-slate-400 line-clamp-1">{project.description || '—'}</p></td><td className="px-4 py-4"><p className="font-bold">{student?.name || project.student_name || '—'}</p><p className="text-[10px] text-slate-400">{student?.student_id || '—'}</p></td><td className="px-4 py-4"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{project.status || '—'}</span></td><td className="px-4 py-4">{project.score ?? 'Pending'}</td><td className="px-4 py-4 text-xs text-slate-500">{project.submitted_at ? `Submitted ${String(project.submitted_at).slice(0,10)}` : 'Not submitted'}</td></tr>; })}{!rows.length && <tr><td colSpan={5}><EmptyState icon={<FolderKanban size={18}/>} title="No projects" description="No canonical project records match the current search."/></td></tr>}</tbody></table></div></section>
  </div>;
}
function Metric({ label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</p><p className="text-2xl font-black text-slate-900 mt-2">{value}</p></div>; }
