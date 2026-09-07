import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Download, FileText, GraduationCap, Loader2, Send, Trash2, UploadCloud } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { deleteTrainerMaterial, listTrainerMaterials, openTrainerMaterial, uploadTrainerMaterial } from '../utils/trainerMaterials';

const GRADES = ['6', '7', '8', '9', '11'];
const LEVELS = ['Level 0', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

export default function TrainerMaterials() {
  const { role, user } = useAuth();
  const { trainers = [] } = useData();
  const toast = useToast();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_grade: '6',
    level: 'Level 0',
    target_trainer_id: 'ALL'
  });

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
    if (!selectedFile) {
      toast.warning('Please select a PDF to send.');
      return;
    }
    if (selectedFile.type !== 'application/pdf') {
      toast.warning('Only PDF files are allowed for trainer teaching material.');
      return;
    }

    setUploading(true);
    try {
      await uploadTrainerMaterial({ ...form, file: selectedFile });
      toast.success(
        form.target_trainer_id === 'ALL'
          ? `"${form.title}" sent to all active trainers.`
          : `"${form.title}" sent to ${selectedTrainer?.name || 'the selected trainer'}.`,
        'Material Sent'
      );
      setForm({ title: '', description: '', class_grade: '6', level: 'Level 0', target_trainer_id: 'ALL' });
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
    } catch (error) {
      toast.error(error.message || 'Unable to delete material.');
    }
  };

  const handleOpen = async material => {
    try {
      await openTrainerMaterial(material.id, `${(material.title || 'Trainer-Material').replace(/[^A-Za-z0-9._ -]/g, '')}.pdf`);
    } catch (error) {
      toast.error(error.message || 'Unable to open PDF.');
    }
  };

  return (
    <div className="pb-10 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-800">Trainer Teaching Materials</h1>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">PDF Library</span>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin ? 'Send private teaching guides, schematics, worksheets and lesson PDFs to one trainer or all trainers.' : `Materials assigned to ${user?.name || 'you'} appear here.`}
        </p>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><Send size={18} /></div>
            <div>
              <h2 className="font-bold text-slate-800">Send Material to Trainer</h2>
              <p className="text-xs text-slate-500">Only the selected trainer(s) can open the private PDF.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-500 uppercase mb-1">Material Title *</label>
              <input value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} required placeholder="Class 8 — Obstacle Avoiding Robot Teaching Guide" className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-pixiu-blue font-medium" />
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase mb-1">Send To *</label>
              <select value={form.target_trainer_id} onChange={e => setForm(prev => ({ ...prev, target_trainer_id: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-pixiu-blue">
                <option value="ALL">All Active Trainers</option>
                {trainers.filter(t => t.status !== 'Inactive').map(trainer => <option key={trainer.id} value={trainer.id}>{trainer.name} ({trainer.id})</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase mb-1">Class / Grade</label>
              <select value={form.class_grade} onChange={e => setForm(prev => ({ ...prev, class_grade: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-pixiu-blue">
                {GRADES.map(grade => <option key={grade} value={grade}>Class {grade}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase mb-1">Level</label>
              <select value={form.level} onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-pixiu-blue">
                {LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase mb-1">PDF File *</label>
              <input id="trainer-material-file" type="file" accept="application/pdf,.pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} required className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-bold" />
              <p className="mt-1 text-[10px] text-slate-400">Maximum 20 MB.</p>
            </div>
            <div className="lg:col-span-2">
              <label className="block font-bold text-slate-500 uppercase mb-1">Instruction / Note</label>
              <textarea value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Read before Class 8 Unit 5. Cover the motor calibration section first." className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-pixiu-blue resize-none" />
            </div>
            <div className="lg:col-span-2 flex justify-end">
              <button type="submit" disabled={uploading} className="px-4 py-2.5 rounded-xl bg-pixiu-blue hover:bg-blue-600 text-white font-bold flex items-center gap-2 disabled:opacity-60">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {uploading ? 'Uploading & Sending…' : 'Upload & Send PDF'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visible Materials</p><p className="text-2xl font-extrabold text-slate-900 mt-1">{materials.length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PDF Teaching Guides</p><p className="text-2xl font-extrabold text-slate-900 mt-1">{materials.filter(m => String(m.type).toUpperCase() === 'PDF').length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Access</p><p className="text-sm font-bold text-emerald-700 mt-2">Private & Role Scoped</p></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2"><BookOpen size={17} className="text-pixiu-blue" /><h2 className="font-bold text-slate-800">{isAdmin ? 'Sent Trainer Materials' : 'My Assigned Materials'}</h2></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">{materials.length} files</span>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-10 flex items-center justify-center text-slate-400 text-sm"><Loader2 size={18} className="animate-spin mr-2" /> Loading materials…</div>
          ) : materials.length === 0 ? (
            <div className="p-12 text-center text-slate-400"><FileText size={28} className="mx-auto mb-2 opacity-50" /><p className="font-semibold text-sm">No trainer material assigned yet.</p><p className="text-xs mt-1">Admin can send a PDF from the panel above.</p></div>
          ) : materials.map(material => (
            <div key={material.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><FileText size={18} /></div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{material.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{material.description || 'Trainer teaching material.'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-bold text-slate-400">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100">Class {material.class_grade || '—'}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100">{material.level || '—'}</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">{material.target_trainer_id === 'ALL' ? 'All Trainers' : material.target_trainer_id}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleOpen(material)} className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5"><Download size={14} /> Open PDF</button>
                {isAdmin && <button onClick={() => handleDelete(material)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Delete material"><Trash2 size={15} /></button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
