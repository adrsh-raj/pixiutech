import { useState, useEffect } from 'react';
import { Star, Check, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';

export const REVIEW_PRESETS = [
  "Demonstrated exceptional understanding of breadboard power rails, series-parallel LEDs, and Ohm's Law current calculations.",
  "Successfully calibrated analog LDR and digital IR sensors with accurate voltage divider threshold adjustments.",
  "Accurate transistor switching circuitry wiring and high-torque DC motor driver breadboard assembly.",
  "Strong grasp of digital pin modes, conditional loops, and serial monitor telemetry debugging.",
  "Excellent hands-on prototype assembly with neat wiring and active problem-solving.",
  "Completed lab objectives with good understanding, needs minor guidance on circuit debugging."
];

export default function StudentReviewModal({
  isOpen,
  onClose,
  editingReview,
  visibleStudents = [],
  gradeUnitsConfig = {},
  onSaveReview,
  trainerName = 'Lead STEM Instructor'
}) {
  const toast = useToast();

  const [formData, setFormData] = useState({
    student_id: visibleStudents[0]?.student_id || 'ZPS6A 01',
    class_grade: '6',
    unit_code: 'Unit 1',
    level: 'Level 0',
    unit_title: 'Introduction to Robotics & Electronics',
    score: 9.5,
    rating: 5,
    status: 'Mastered',
    review: REVIEW_PRESETS[0],
    trainer_name: trainerName
  });

  useEffect(() => {
    if (editingReview) {
      setFormData({
        ...editingReview,
        trainer_name: editingReview.trainer_name || trainerName
      });
    } else if (visibleStudents.length > 0) {
      const defaultStudent = visibleStudents[0];
      const grade = defaultStudent.class_id?.includes('-') 
        ? defaultStudent.class_id.split('-')[2]?.[0] || '6' 
        : '6';
      const unitsList = gradeUnitsConfig[grade] || gradeUnitsConfig['6'] || [];
      const firstUnit = unitsList[0] || { unitCode: 'Unit 1', level: 'Level 0', title: 'Introduction to Robotics & Electronics' };

      setFormData(prev => ({
        ...prev,
        student_id: defaultStudent.student_id,
        class_grade: grade,
        unit_code: firstUnit.unitCode,
        level: firstUnit.level,
        unit_title: firstUnit.title,
        trainer_name: trainerName
      }));
    }
  }, [editingReview, isOpen, trainerName]);

  const handleGradeChange = (grade) => {
    const studentInGrade = visibleStudents.find(s => s.class_id?.includes(`-${grade}A`));
    const unitsList = gradeUnitsConfig[grade] || gradeUnitsConfig['6'] || [];
    const currentOrFirstUnit = unitsList.find(u => u.unitCode === formData.unit_code) || unitsList[0];

    setFormData({
      ...formData,
      class_grade: grade,
      student_id: studentInGrade ? studentInGrade.student_id : formData.student_id,
      unit_code: currentOrFirstUnit.unitCode,
      level: currentOrFirstUnit.level,
      unit_title: currentOrFirstUnit.title
    });
  };

  const handleUnitChange = (unitCode) => {
    const unitsList = gradeUnitsConfig[formData.class_grade] || gradeUnitsConfig['6'] || [];
    const targetUnit = unitsList.find(u => u.unitCode === unitCode) || unitsList[0];

    setFormData({
      ...formData,
      unit_code: targetUnit.unitCode,
      level: targetUnit.level,
      unit_title: targetUnit.title
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const studentObj = visibleStudents.find(s => s.student_id === formData.student_id);

    const reviewPayload = {
      ...formData,
      id: editingReview ? editingReview.id : `REV-${Date.now()}`,
      student_name: studentObj?.name || 'Student',
      school_id: studentObj?.school_id || 'ZPS',
      score: Number(formData.score),
      rating: Number(formData.rating),
      date: new Date().toISOString().split('T')[0]
    };

    await onSaveReview(reviewPayload);
    toast.success(`Unit review certified for ${studentObj?.name || formData.student_id}!`, 'Evaluation Saved');
    onClose();
  };

  const filteredStudents = visibleStudents.filter(s => 
    s.class_id?.includes(`-${formData.class_grade}A`) || !s.class_id
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Star size={18} className="text-amber-400 fill-amber-400" />
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            {editingReview ? 'Edit Candidate Unit Evaluation' : 'Submit End-of-Unit Student Review'}
          </span>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Class Grade</label>
            <select
              value={formData.class_grade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
            >
              <option value="6">Class 6A</option>
              <option value="7">Class 7A</option>
              <option value="8">Class 8A</option>
              <option value="9">Class 9A</option>
              <option value="11">Class 11A</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Candidate Student</label>
            <select
              value={formData.student_id}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
            >
              {filteredStudents.map(s => (
                <option key={s.student_id} value={s.student_id}>
                  {s.student_id} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Curriculum Unit</label>
            <select
              value={formData.unit_code}
              onChange={(e) => handleUnitChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
            >
              {(gradeUnitsConfig[formData.class_grade] || []).map(u => (
                <option key={u.unitCode} value={u.unitCode}>
                  {u.unitCode}: {u.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Tech Level Awarded</label>
            <input
              type="text"
              readOnly
              value={formData.level}
              className="w-full px-3 py-2 border border-blue-200 bg-blue-50/50 rounded-xl font-bold text-pixiu-blue cursor-not-allowed"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Score (out of 10)</label>
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={formData.score}
              onChange={(e) => setFormData({ ...formData, score: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-pixiu-blue"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Rating (Stars)</label>
            <select
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
            >
              <option value="5">5 ★★★★★</option>
              <option value="4">4 ★★★★☆</option>
              <option value="3">3 ★★★☆☆</option>
              <option value="2">2 ★★☆☆☆</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Mastery Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
            >
              <option value="Mastered">Mastered (Pass)</option>
              <option value="Needs Practice">Needs Practice</option>
              <option value="Incomplete">Incomplete</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block font-bold text-slate-600 uppercase">Instructor Assessment Notes</label>
            <span className="text-[10px] text-pixiu-blue font-bold flex items-center gap-1">
              <Sparkles size={11} /> Quick Feedback Presets
            </span>
          </div>
          
          <div className="flex flex-wrap gap-1.5 mb-2">
            {REVIEW_PRESETS.slice(0, 3).map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setFormData({ ...formData, review: preset })}
                className="text-[10px] font-medium bg-slate-100 hover:bg-blue-50 hover:text-pixiu-blue text-slate-700 px-2 py-1 rounded-md border border-slate-200 transition-colors text-left"
              >
                Preset {idx + 1}
              </button>
            ))}
          </div>

          <textarea
            rows="3"
            value={formData.review}
            onChange={(e) => setFormData({ ...formData, review: e.target.value })}
            required
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
            className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>{editingReview ? 'Update Assessment' : 'Certify & Save Assessment'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
