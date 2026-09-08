import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, GraduationCap, Loader2, Send, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { deleteTrainerMaterial, listTrainerMaterials, openTrainerMaterial, uploadTrainerMaterial } from '../utils/trainerMaterials';

const LEVELS = ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

export default function TrainerMaterials() {
  const { role, user } = useAuth();
  const { trainers = [], classes = [] } = useData();
  const toast = useToast();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const grades = useMemo(() => [...new Set(classes.map(item => String(item.grade || '').trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b)), [classes]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', class_grade: '', level: 'Level 0', target_trainer_id: 'ALL' });

  useEffect(() => {
    if (!form.class_grade && grades.length) setForm(prev => ({ ...prev, class_grade: grades[0] }));
  }, [form.class_grade, grades]);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTrainerMaterials();
      setMaterials(Array.isArray(rows) ? rows : rows?.data || []);
    } catch (error) {
      toast.error(error.message || 'Unable to load trainer materials.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  const selectedTrainer = useMemo(
    () => trainers.find(trainer => String(trainer.id) === String(form.target_trainer_id)),
    [trainers, form.target_trainer_id]
  );

  const handleSubmit = async event => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!selectedFile) { toast.warning('Please select a PDF to send.'); return; }
    if (selectedFile.type !== 'application/pdf') { toast.warning('Only PDF files are allowed for trainer teaching material.'); return; }
    if (!form.class_grade) { toast.warning('No class grade is available in the database yet. Create a class first.'); return; }

    setUploading(true);
    try {
      await uploadTrainerMaterial({ ...form, file: selectedFile });
      toast.success(form.target_trainer_id === 'ALL' ? `"${form.title}" sent to all active trainers.` : `"${form.title}" sent to ${selectedTrainer?.name || 'the selected trainer'}.`, 'Material Sent');
      setForm({ title: '', description: '', class_grade: grades[0] || '', level: 'Level 0', target_trainer_id: 'ALL' });
      setSelectedFile(null);
      const input = document.getElementById('trainer-material-file');
      if (input) input.value = '';
      await loadMaterials();
    } catch (error) {
      toast.error(error.message || 'Material upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async material => {
    if (!isAdmin || !window.confirm(`Delete "${material.title}" from trainer resources?`)) return;
    try {
      await deleteTrainerMaterial(material.id);
      toast.success('Trainer material deleted.');
      await loadMaterials();
    } catch (error) { toast.error(error.message || 'Unable to delete material.'); }
  };

  const handleOpen = async material => {
    try {
      await openTrainerMaterial(material.id, `${(material.title || 'Trainer-Material').replace(/[^A-Za-z0-9._ -]/g, '')}.pdf`);
    } catch (error) { toast.error(error.message || 'Unable to open PDF.'); }
  };

  return (
    <div className="pb-10 space-y-6">
      <div>
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-slate-800">Trainer Teaching Materials</h1><span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">PDF Library</span></div>
        <p className="text-sm text-slate-500 mt-1">{isAdmin ? 'Send private teaching guides, schematics, worksheets and lesson PDFs to one trainer or all trainers.' : `Materials assigned to ${user?.name || 'you'} appear here.`}</p>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><Send size={18} /></div><div><h2 className="font-bold text-slate-800">Send Material to Trainer</h2><p className="text-xs text-slate-500">Only the selected trainer(s) can open the private PDF.</p></div></div>
          <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="lg:col-span-2"><label className="block font-bold text-slate-500 uppercase mb-1">Material Title *</label><input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} required placeholder="Teaching guide title" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-pixiu-blue font-medium" /></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Send To *</label><select value={form.target_trainer_id} onChange={e => setForm(prev => ({ ...prev, target_trainer_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-pixiu-blue"><option value="ALL">All Active Trainers</option>{trainers.filter(t => String(t.status).toLowerCase() === 'active').map(trainer => <option key={trainer.id} value={trainer.id}>{trainer.name} ({trainer.trainer_id || trainer.id})</option>)}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Class / Grade</label><select value={form.class_grade} onChange={e => setForm(prev => ({ ...prev, class_grade: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-pixiu-blue"><option value="">Select a grade…</option>{grades.map(grade => <option key={grade} value={grade}>Class {grade}</option>)}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">Level</label><select value={form.level} onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-pixiu-blue">{LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</select></div>
            <div><label className="block font-bold text-slate-500 uppercase mb-1">PDF File *</label><input id="trainer-material-file" type="file" accept="application/pdf,.pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} required className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-bold" /><p className="mt-1 text-[10px] text-slate-400">Maximum 20 MB.</p></div>
            <div className="lg:col-span-2"><label className="block font-bold text-slate-500 uppercase mb-1">Instruction / Note</label><textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Add the trainer instruction for this material." className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-pixiu-blue resize-none" /></div>
            <div className="lg:col-span-2 flex justify-end"><button type="submit" disabled={uploading || !grades.length} className="px-4 py-2.5 rounded-xl bg-pixiu-blue hover:bg-blue-600 text-white font-bold flex items-center gap-2 disabled:opacity-60">{uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}{uploading ? 'Uploading & Sending…' : 'Upload & Send PDF'}</button></div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visible Materials</p><p className="text-2xl font-extrabold text-slate-900 mt-1">{materials.length}</p></div><div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PDF Teaching Guides</p><p className="text-2xl font-extrabold text-slate-900 mt-1">{materials.filter(m => String(m.type).toUpperCase() === 'PDF').length}</p></div><div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Access</p><p className="text-sm font-bold text-emerald-700 mt-2">Private & Role Scoped</p></div></div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"><div className="flex items-center gap-2"><BookOpen size={17} className="text-pixiu-blue" /><h2 className="font-bold text-slate-800">{isAdmin ? 'Sent Trainer Materials' : 'My Assigned Materials'}</h2></div><span className="text-[10px] font-bold text-slate-400 uppercase">{materials.length} files</span></div><div className="divide-y divide-slate-100">{loading ? <div className="p-10 flex items-center justify-center text-slate-400 text-sm"><Loader2 size={18} className="animate-spin mr-2" /> Loading materials…</div> : materials.length === 0 ? <div className="p-12 text-center text-slate-400"><FileText size={28} className="mx-auto mb-2 opacity-50" /><p className="font-semibold text-sm">No trainer material assigned yet.</p><p className="text-xs mt-1">{isAdmin ? 'Create a database-backed trainer material record above.' : 'Assigned materials will appear here.'}</p></div> : materials.map(material => <div key={material.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"><div className="flex items-start gap-3 min-w-0"><div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><GraduationCap size={17}/></div><div className="min-w-0"><p className="font-semibold text-sm text-slate-800 truncate">{material.title}</p><p className="text-[11px] text-slate-400 mt-1">Class {material.class_grade || '—'} · {material.level || '—'}{material.target_trainer_name ? ` · ${material.target_trainer_name}` : ''}</p><p className="text-xs text-slate-500 mt-1 line-clamp-2">{material.description || 'No instruction stored.'}</p></div></div><div className="flex gap-2 shrink-0"><button type="button" onClick={() => handleOpen(material)} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-black inline-flex items-center gap-1.5"><BookOpen size={13}/> Open</button>{isAdmin && <button type="button" onClick={() => handleDelete(material)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Delete material"><Trash2 size={15}/></button>}</div></div>)}</div></div>
    </div>
  );
}
