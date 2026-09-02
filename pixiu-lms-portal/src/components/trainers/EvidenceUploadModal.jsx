import { useState } from 'react';
import { Camera, Upload, Star, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';

export default function EvidenceUploadModal({
  isOpen,
  onClose,
  roster = [],
  activeSession,
  onSaveEvidence,
  uploadFile
}) {
  const toast = useToast();
  const [selectedStudent, setSelectedStudent] = useState(roster[0]?.student_id || '');
  const [projectTitle, setProjectTitle] = useState('Smart Obstacle Avoidance Robot');
  const [projectScore, setProjectScore] = useState(10);
  const [evidenceNote, setEvidenceNote] = useState('Clean breadboard wiring and sensor calibration.');
  const [filePreview, setFilePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be under 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetStudentId = selectedStudent || roster[0]?.student_id;
    if (!targetStudentId) {
      toast.error('Please select a student from the class roster.');
      return;
    }

    const studentObj = roster.find(s => s.student_id === targetStudentId);

    setIsUploading(true);
    let uploadedPhotoUrl = filePreview;

    if (!uploadedPhotoUrl) {
      uploadedPhotoUrl = 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80';
    }

    const newEvidence = {
      id: `PROJ-${Date.now()}`,
      student_id: targetStudentId,
      student_name: studentObj?.name || 'Student',
      school_id: studentObj?.school_id || activeSession?.school_id || 'ZPS',
      title: projectTitle,
      score: Number(projectScore),
      evidence_photo: uploadedPhotoUrl,
      trainer_notes: evidenceNote,
      session_id: activeSession?.id || 'LIVE-SESSION',
      unit_code: activeSession?.unit_code || 'Unit 2',
      created_at: new Date().toISOString()
    };

    await onSaveEvidence(newEvidence);
    setIsUploading(false);
    toast.success(`Project photo & evidence certified for ${studentObj?.name || targetStudentId}!`, 'Evidence Saved');
    setFilePreview('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Camera size={18} className="text-pixiu-blue" />
          <span>Upload Robot Build & Hardware Evidence</span>
        </div>
      }
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-bold text-slate-600 uppercase mb-1">Select Candidate</label>
          <select
            value={selectedStudent || roster[0]?.student_id || ''}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
          >
            {roster.map(s => (
              <option key={s.student_id} value={s.student_id}>
                {s.name} ({s.student_id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-bold text-slate-600 uppercase mb-1">Project Milestone Title *</label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            required
            placeholder="e.g. Ultrasonic Radar or Smart Traffic Controller"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Rubric Score (1-10)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={projectScore}
                onChange={(e) => setProjectScore(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-pixiu-blue"
              />
              <Star size={16} className="text-amber-500 fill-amber-500 shrink-0" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Upload Photo</label>
            <label className="flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-slate-300 hover:border-pixiu-blue rounded-xl bg-slate-50 cursor-pointer font-bold text-slate-600 hover:text-pixiu-blue transition-colors">
              <Upload size={14} />
              <span>{filePreview ? 'Change Photo' : 'Attach Photo'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {filePreview && (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-900 flex items-center justify-center">
            <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}

        <div>
          <label className="block font-bold text-slate-600 uppercase mb-1">Instructor Certification Notes</label>
          <textarea
            rows="2"
            value={evidenceNote}
            onChange={(e) => setEvidenceNote(e.target.value)}
            placeholder="e.g. Tested pin voltages, verified serial output, and confirmed stable chassis alignment."
            className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading}
            className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>{isUploading ? 'Certifying...' : 'Certify & Save'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
