import { useMemo, useState } from 'react';
import { FolderKanban, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function ProjectHub() {
  const { role } = useAuth();
  const { projects = [], students = [], addProject, deleteProject } = useData();
  const toast = useToast();
  const canManage = role === 'admin' || role === 'superadmin' || role === 'trainer';
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student: '', title: '', description: '' });
  const filtered = useMemo(() => projects.filter(item => `${item.title || ''} ${item.student_id || ''} ${item.status || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [projects, query]);

  const submit = async event => {
    event.preventDefault();
    if (!form.student) return toast.error('Select a student.', 'Project save failed');
    const result = await addProject(form);
    if (!result?.success) return toast.error(result?.error || 'Project creation failed.', 'Project save failed');
    toast.success('Project created from the live database.');
    setOpen(false);
    setForm({ student: '', title: '', description: '' });
  };

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Student work</p><h1 className="text-2xl font-black text-slate-900 mt-1">Project Management</h1><p className="text-sm text-slate-500 mt-1">Projects are separate student-work records from quizzes. Trainers can create projects for students in their authorised scope.</p></div>{canManage && <button type="button" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={15}/> New Project</button>}</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Metric label="Total" value={projects.length}/><Metric label="Submitted" value={projects.filter(p => p.status === 'submitted').length}/><Metric label="Completed" value={projects.filter(p => p.status === 'completed').length}/></div>
    <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="relative max-w-xl"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="field pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search project or student"/></div></div>
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{filtered.map(project => <article key={project.id} className="bg-white border border-slate-200 rounded-2xl p-5"><div className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><FolderKanban size={17}/></span><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{project.status}</span></div><h2 className="font-black text-slate-900 mt-4">{project.title}</h2><p className="text-xs text-slate-500 mt-1">Student {project.student_id || '—'}</p><p className="text-xs text-slate-500 mt-3 line-clamp-3">{project.description || 'No project description stored.'}</p><p className="text-[10px] text-slate-400 mt-3">Score: {project.score ?? 'Pending'}{project.trainer_feedback ? ` · ${project.trainer_feedback}` : ''}</p>{role === 'admin' && <button type="button" onClick={async () => { if (!window.confirm(`Delete “${project.title}”?`)) return; const result = await deleteProject(project.id); result?.success ? toast.success('Project deleted.') : toast.error(result?.error || 'Unable to delete project.'); }} className="mt-4 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={15}/></button>}</article>)}{!filtered.length && <div className="col-span-full p-10 text-center border border-dashed border-slate-200 rounded-2xl text-sm text-slate-400">No projects match the current search.</div>}</section>
    {open && <div className="fixed inset-0 bg-slate-950/60 z-50 flex items-center justify-center p-4"><form onSubmit={submit} className="bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-4"><h2 className="font-black text-lg text-slate-900">Create project</h2><p className="text-xs text-slate-500">Select a student from your live authorised roster. Evaluation fields remain server-controlled.</p><select className="field" value={form.student} onChange={e => setForm(v => ({...v,student:e.target.value}))} required><option value="">Select student</option>{students.map(student => <option key={student.id} value={student.id}>{student.name} · {student.student_id}</option>)}</select><input className="field" placeholder="Project title" value={form.title} onChange={e => setForm(v => ({...v,title:e.target.value}))} required/><textarea className="field min-h-28" placeholder="Project description" value={form.description} onChange={e => setForm(v => ({...v,description:e.target.value}))}/><div className="flex justify-end gap-2 pt-3 border-t border-slate-100"><button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" className="px-5 py-2 rounded-xl bg-violet-600 text-white text-xs font-black">Create Project</button></div></form></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.12)}`}</style>
  </div>;
}
function Metric({ label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</p><p className="text-2xl font-black text-slate-900 mt-2">{value}</p></div>; }
