import { useMemo, useState } from 'react';
import { ExternalLink, FileImage, FolderKanban, Plus, Send, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const list = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const norm = value => String(value ?? '').trim().toLowerCase();

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    ...(body instanceof FormData ? { body } : body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    cache: method === 'GET' ? 'no-store' : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.error || payload.message || `Request failed (${response.status})`);
  return payload;
}

export default function ProjectHubV2() {
  const { user } = useAuth();
  const { projects = [], students = [], refreshAll, loading } = useData();
  const canCreate = ['admin', 'superadmin', 'trainer', 'student'].includes(user?.role);
  const canDelete = ['admin', 'superadmin'].includes(user?.role);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const visibleStudents = useMemo(() => students.filter(s => norm(s.status || 'active') !== 'inactive'), [students]);
  const filteredProjects = useMemo(() => projects.filter(project => `${project.title || ''} ${project.student_id || ''} ${project.status || ''}`.toLowerCase().includes(search.trim().toLowerCase())), [projects, search]);

  const openCreate = () => setEditor({ id: null, student: user?.role === 'student' ? user?.related_id : '', title: '', description: '' });
  const openEdit = project => setEditor({ id: project.id, student: project.student || '', title: project.title || '', description: project.description || '' });

  const openEvidence = async project => {
    setSelected(project); setEvidence([]); setError('');
    try { setEvidence(list(await request(`/project-evidence?project=${encodeURIComponent(project.id)}`))); }
    catch (err) { setError(err.message); }
  };

  const saveProject = async event => {
    event.preventDefault();
    if (!editor || busy) return;
    if (user?.role !== 'student' && !editor.student) return setError('Select an authorised student.');
    if (!editor.title.trim()) return setError('Project title is required.');
    setBusy(true); setError('');
    try {
      const payload = { title: editor.title.trim(), description: editor.description.trim() };
      if (user?.role !== 'student') payload.student = editor.student;
      const saved = editor.id ? await request(`/projects/${encodeURIComponent(editor.id)}`, 'PATCH', payload) : await request('/projects', 'POST', payload);
      await refreshAll(); setEditor(null);
      const savedProject = saved?.data || saved;
      if (savedProject?.id) setSelected(savedProject);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const uploadEvidence = async event => {
    event.preventDefault();
    if (!selected || !file || busy) return;
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.append('project', selected.id); body.append('file', file); body.append('title', file.name); body.append('note', note.trim());
      await request('/project-evidence', 'POST', body);
      setFile(null); setNote('');
      setEvidence(list(await request(`/project-evidence?project=${encodeURIComponent(selected.id)}`)));
      await refreshAll();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const submitProject = async project => {
    setBusy(true); setError('');
    try { await request(`/projects/${encodeURIComponent(project.id)}/submit`, 'POST', {}); await refreshAll(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const deleteProject = async project => {
    if (!canDelete) return;
    setBusy(true); setError('');
    try { await request(`/projects/${encodeURIComponent(project.id)}`, 'DELETE'); await refreshAll(); setSelected(null); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Student Work" title={user?.role === 'student' ? 'My Projects' : 'Projects'} description="Live project records and evidence are stored through the Django API." actions={<div className="flex gap-2"><RefreshButton onRefresh={refreshAll} loading={loading || busy}/>{canCreate && <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={14}/> New Project</button>}</div>} />
    {error && <ErrorState title="Project action failed" description={error} onRetry={() => setError('')} />}
    <div className="bg-white border border-slate-200 rounded-2xl p-4"><input className="field max-w-xl" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by project, student or status"/></div>
    {filteredProjects.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<FolderKanban size={20}/>} title="No projects" description={projects.length ? 'No projects match your search.' : 'No database project records are available in your authorised scope.'}/></div> : <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredProjects.map(project => <article key={project.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><FolderKanban size={17}/></span><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{project.status || 'draft'}</span></div><h2 className="font-black text-slate-900 mt-4">{project.title}</h2><p className="text-xs text-slate-500 mt-1">{project.student_id || 'Student record'}</p><p className="text-xs text-slate-500 mt-3 line-clamp-3">{project.description || 'No description recorded.'}</p><p className="text-[10px] text-slate-400 mt-3">Score: {project.score ?? 'Pending'}</p><div className="flex flex-wrap gap-2 mt-4"><button type="button" onClick={() => openEvidence(project)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black inline-flex items-center gap-1"><FileImage size={12}/> Evidence</button>{user?.role === 'student' && ['draft','returned'].includes(norm(project.status)) && <button type="button" disabled={busy} onClick={() => submitProject(project)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black inline-flex items-center gap-1"><Send size={12}/> Submit</button>}{(user?.role === 'student' || ['admin','superadmin','trainer'].includes(user?.role)) && project.status !== 'submitted' && <button type="button" onClick={() => openEdit(project)} className="px-3 py-2 rounded-lg bg-violet-50 text-violet-700 text-[10px] font-black">Edit</button>}{canDelete && <button type="button" disabled={busy} onClick={() => deleteProject(project)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black"><Trash2 size={12}/></button>}</div></article>)}</section>}

    {editor && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={saveProject} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="p-5 border-b border-slate-100 flex justify-between"><div><h2 className="text-lg font-black">{editor.id ? 'Edit project' : 'Create project'}</h2><p className="text-xs text-slate-400 mt-1">Changes are saved to the live project record.</p></div><button type="button" onClick={() => setEditor(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-3">{user?.role !== 'student' && <select className="field" value={editor.student} onChange={e => setEditor(v => ({...v, student:e.target.value}))} required><option value="">Select student</option>{visibleStudents.map(s => <option key={s.id} value={s.id}>{s.name} · {s.student_id}</option>)}</select>}<input className="field" value={editor.title} onChange={e => setEditor(v => ({...v,title:e.target.value}))} placeholder="Project title" required/><textarea className="field min-h-28" value={editor.description} onChange={e => setEditor(v => ({...v,description:e.target.value}))} placeholder="Describe what was built and learned."/></div><div className="p-5 border-t border-slate-100 flex justify-end gap-2"><button type="button" onClick={() => setEditor(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black">{busy ? 'Saving…' : 'Save project'}</button></div></form></div>}

    {selected && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"><div className="p-5 border-b border-slate-100 flex justify-between"><div><h2 className="font-black text-lg">{selected.title}</h2><p className="text-xs text-slate-400 mt-1">{selected.student_id || 'Student'} · Evidence</p></div><button type="button" onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-5">{evidence.length ? <div className="grid sm:grid-cols-2 gap-3">{evidence.map(item => <a key={item.id} href={item.file || item.external_url || '#'} target="_blank" rel="noreferrer" className="border border-slate-200 rounded-xl p-4 hover:bg-slate-50 flex items-center gap-3"><FileImage size={17} className="text-violet-600"/><span className="min-w-0 flex-1"><b className="block text-sm truncate">{item.title || 'Evidence file'}</b><small className="block text-[10px] text-slate-400 mt-1">{item.note || ''}</small></span><ExternalLink size={13}/></a>)}</div> : <EmptyState icon={<FileImage size={20}/>} title="No evidence yet" description="Upload a photo, PDF or supporting file for this project."/>}{(user?.role === 'student' || user?.role === 'admin' || user?.role === 'superadmin') && <form onSubmit={uploadEvidence} className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-3"><div className="flex items-center gap-2"><Upload size={16} className="text-violet-600"/><h3 className="font-black">Upload evidence</h3></div><input type="file" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.zip" onChange={e => setFile(e.target.files?.[0] || null)} required className="w-full text-xs"/><input className="field" value={note} onChange={e => setNote(e.target.value)} placeholder="What does this evidence show?"/><button disabled={!file || busy} className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black">{busy ? 'Uploading…' : 'Upload evidence'}</button></form>}</div></div></div>}
    <style>{`.field{width:100%;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:600;color:#334155;background:white;outline:none}.field:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.12)}`}</style>
  </div>;
}
