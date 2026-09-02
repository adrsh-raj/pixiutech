import { useState, useMemo } from 'react';
import { 
  GraduationCap, Plus, Phone, Building2, Star, CheckCircle, Clock, X, Trash2, 
  Play, User, Camera, Check, FileText, Upload, Image as ImageIcon, IndianRupee, 
  Calendar, AlertTriangle, ShieldAlert, Lock, Unlock, Bell, Send, History, 
  CheckSquare, XSquare, ChevronRight, BookOpen, Megaphone, Edit3, Award, MessageSquare, Box
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import LiveSessionRunner from '../components/trainers/LiveSessionRunner';
import TrainerRosterManagement from '../components/trainers/TrainerRosterManagement';
import EvidenceUploadModal from '../components/trainers/EvidenceUploadModal';
import StudentReviewModal, { REVIEW_PRESETS } from '../components/trainers/StudentReviewModal';

const GRADE_UNITS_CONFIG = {
  '6': [
    { unitCode: 'Unit 1', level: 'Level 0', title: 'Introduction to Robotics & Electronics' },
    { unitCode: 'Unit 2', level: 'Level 1', title: 'The Arduino IDE' },
    { unitCode: 'Unit 3', level: 'Level 2', title: 'Basic Project: Traffic Light Signal Controller' },
    { unitCode: 'Unit 4', level: 'Level 3', title: 'Intermediate Project: Automatic Night Lamp' },
    { unitCode: 'Unit 5', level: 'Level 4', title: 'Final Project: Smart Toll Booth' },
    { unitCode: 'Unit 6', level: 'Level 5', title: 'Extra Challenges & Project Log' }
  ],
  '7': [
    { unitCode: 'Unit 1', level: 'Level 0', title: 'Introduction to Analog & Digital Electronics' },
    { unitCode: 'Unit 2', level: 'Level 1', title: 'The Arduino IDE & Serial Monitor' },
    { unitCode: 'Unit 3', level: 'Level 2', title: 'Basic Project: LED Dimmer and Mood Light' },
    { unitCode: 'Unit 4', level: 'Level 3', title: 'Intermediate Project: Temperature & Humidity Monitor' },
    { unitCode: 'Unit 5', level: 'Level 4', title: 'Final Project: Smart Rain Alarm System' },
    { unitCode: 'Unit 6', level: 'Level 5', title: 'Extra Challenges & Project Log' }
  ],
  '8': [
    { unitCode: 'Unit 1', level: 'Level 0', title: 'Introduction to Waves & Distance Measurement' },
    { unitCode: 'Unit 2', level: 'Level 1', title: 'The Arduino IDE & Sensor Libraries' },
    { unitCode: 'Unit 3', level: 'Level 2', title: 'Basic Project: Height Measurement Station' },
    { unitCode: 'Unit 4', level: 'Level 3', title: 'Intermediate Project: Smart Contactless Dustbin' },
    { unitCode: 'Unit 5', level: 'Level 4', title: 'Final Project: Obstacle-Avoiding Robot' },
    { unitCode: 'Unit 6', level: 'Level 5', title: 'Extra Challenges & Project Log' }
  ],
  '9': [
    { unitCode: 'Unit 1', level: 'Level 0', title: 'Introduction to Industrial Sensors & Displays' },
    { unitCode: 'Unit 2', level: 'Level 1', title: 'The Arduino IDE & Memory Architecture' },
    { unitCode: 'Unit 3', level: 'Level 2', title: 'Basic Project: Fire Security Alarm System' },
    { unitCode: 'Unit 4', level: 'Level 3', title: 'Intermediate Project: Smart 16x2 LCD Weather System' },
    { unitCode: 'Unit 5', level: 'Level 4', title: 'Final Project: Line Following Robot' },
    { unitCode: 'Unit 6', level: 'Level 5', title: 'Extra Challenges & Wiring Reference' }
  ],
  '11': [
    { unitCode: 'Unit 1', level: 'Level 0', title: 'Introduction to Engineering Specs & Optics' },
    { unitCode: 'Unit 2', level: 'Level 1', title: 'The Arduino IDE & Advanced Control' },
    { unitCode: 'Unit 3', level: 'Level 2', title: 'Basic Project: Laser Security System' },
    { unitCode: 'Unit 4', level: 'Level 3', title: 'Intermediate Project: Ultrasonic Calibration' },
    { unitCode: 'Unit 5', level: 'Level 4', title: 'Capstone Project: Maze Solver Robot' },
    { unitCode: 'Unit 6', level: 'Level 5', title: 'Engineering Reference & Log' }
  ]
};

export default function Trainers() {
  const { 
    trainers, schools, classes, students, sessions, markAttendance, 
    completeSession, unlockSession, startNewSession, attendance, addTrainer, updateTrainerStatus, 
    deleteTrainer, uploadFile, projects = [], addProject, deleteProject, scheduleSession, 
    adminUpdateAttendance, notifications, curriculum,
    studentReviews = [], saveStudentReview, deleteStudentReview
  } = useData();
  
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || !role;
  const isTrainerRole = role === 'trainer';
  const toast = useToast();

  const isAkash = user?.username === 'akashsharma' || user?.related_id === 'TR-02' || user?.school_id === 'XYZ';
  const trainerSchoolId = isAkash ? 'XYZ' : 'ZPS';

  // Navigation tab: Default to 'session' for field trainer, 'session' or 'trainers' for admin
  const [activeTab, setActiveTab] = useState(isTrainerRole ? 'session' : 'session');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [evidenceSessionData, setEvidenceSessionData] = useState(null);
  const [evidenceRosterData, setEvidenceRosterData] = useState([]);
  const [trainerToDelete, setTrainerToDelete] = useState(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [selectedReviewGrade, setSelectedReviewGrade] = useState('All');

  // Strict isolation: Akash sees ONLY Akash; Vikas sees ONLY Vikas; Admin sees ALL
  const visibleTrainers = useMemo(() => {
    if (isAdmin || user?.school_id === 'ALL') return trainers;
    if (isAkash) return trainers.filter(t => t.id === 'TR-02' || t.name.toLowerCase().includes('akash'));
    return trainers.filter(t => t.id === 'TR-01' || t.name.toLowerCase().includes('vikas'));
  }, [trainers, isAdmin, user, isAkash]);

  const currentTrainer = visibleTrainers[0] || trainers[0];

  const visibleStudents = useMemo(() => {
    if (isAdmin || user?.school_id === 'ALL') return students;
    return students.filter(s => s.school_id === trainerSchoolId || (trainerSchoolId === 'XYZ' ? s.student_id.startsWith('XYZ') : s.student_id.startsWith('ZPS')));
  }, [students, isAdmin, user, trainerSchoolId]);

  const visibleStudentReviews = useMemo(() => {
    return studentReviews.filter(r => {
      const matchesGrade = selectedReviewGrade === 'All' || r.class_grade === selectedReviewGrade;
      if (!matchesGrade) return false;
      if (isAdmin || user?.school_id === 'ALL') return true;
      const rId = (r.student_id || '').toUpperCase();
      return trainerSchoolId === 'XYZ' ? rId.includes('XYZ') : rId.includes('ZPS');
    });
  }, [studentReviews, selectedReviewGrade, isAdmin, user, trainerSchoolId]);

  // Trainer form state (for onboarding)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'Senior Robotics & AI Instructor',
    assigned_schools: ['ZPS'],
    daily_rate: 600,
    weekly_days: 2,
    rating: 5.0,
    status: 'Active'
  });

  // Schedule modal state
  const [scheduleData, setScheduleData] = useState({
    school_id: 'ZPS',
    class_id: 'CLS-ZPS-6A',
    trainer_id: 'TR-01',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    time: '10:30 AM',
    topic: 'Unit 2: Line Follower Sensor Calibration & Motor Tuning',
    notes: 'Please bring line tracking sheets and calibrate IR sensors.',
    notify_trainer: true
  });

  const handleOpenEvidenceModal = (session, roster) => {
    setEvidenceSessionData(session);
    setEvidenceRosterData(roster);
    setIsEvidenceModalOpen(true);
  };

  const handleOpenReviewModal = (existing = null) => {
    setEditingReview(existing);
    setIsReviewModalOpen(true);
  };

  const handleAddTrainerSubmit = async (e) => {
    e.preventDefault();
    await addTrainer({
      name: formData.name,
      phone: formData.phone,
      role: formData.role,
      assigned_schools: formData.assigned_schools.join(', '),
      daily_rate: Number(formData.daily_rate) || 600,
      weekly_days: Number(formData.weekly_days) || 2,
      rating: Number(formData.rating) || 5.0,
      status: formData.status
    });
    toast.success(`Trainer "${formData.name}" onboarded!`, 'Instructor Registered');
    setIsAddModalOpen(false);
    setFormData({
      name: '',
      phone: '',
      role: 'Senior Robotics & AI Instructor',
      assigned_schools: ['ZPS'],
      daily_rate: 600,
      weekly_days: 2,
      rating: 5.0,
      status: 'Active'
    });
  };

  const handleConfirmDelete = async () => {
    if (!trainerToDelete) return;
    if (deleteConfirmationInput.trim().toUpperCase() !== (trainerToDelete.name || '').trim().toUpperCase()) {
      toast.error('Name does not match! Deletion cancelled.');
      return;
    }

    await deleteTrainer(trainerToDelete.id);
    toast.info(`Trainer ${trainerToDelete.name} permanently removed.`, 'Instructor Deleted');
    setTrainerToDelete(null);
    setDeleteConfirmationInput('');
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    const assignedSchool = schools.find(s => s.id === scheduleData.school_id)?.name || 'Zenith Public School';
    await scheduleSession({
      ...scheduleData,
      id: `SES-SCHED-${Date.now()}`,
      school_name: assignedSchool,
      status: 'Scheduled',
      created_at: new Date().toISOString()
    });
    toast.success(`Session scheduled for ${scheduleData.date}! Notification dispatched.`, 'Session Queued');
    setIsScheduleModalOpen(false);
  };

  const visibleEvidenceProjects = useMemo(() => {
    return projects.filter(p => {
      if (isAdmin || user?.school_id === 'ALL') return true;
      return p.school_id === trainerSchoolId || (trainerSchoolId === 'XYZ' ? (p.student_id || '').startsWith('XYZ') : (p.student_id || '').startsWith('ZPS'));
    });
  }, [projects, isAdmin, user, trainerSchoolId]);

  return (
    <div className="pb-12 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {isTrainerRole ? 'Field Trainer Console' : 'Faculty & Classroom Operations'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time classroom session runner, 1-tap attendance, project certification & student unit reviews.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-2xl border border-slate-300/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('session')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'session'
                ? 'bg-pixiu-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play size={14} />
            <span>Live Lab Runner</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reviews'
                ? 'bg-pixiu-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Star size={14} />
            <span>Unit Reviews ({visibleStudentReviews.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'bg-pixiu-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera size={14} />
            <span>Build Photos ({visibleEvidenceProjects.length})</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('trainers')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'trainers'
                  ? 'bg-pixiu-blue text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap size={14} />
              <span>Instructors Roster</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: LIVE SESSION RUNNER */}
      {activeTab === 'session' && (
        <LiveSessionRunner
          sessions={sessions}
          classes={classes}
          students={students}
          attendance={attendance}
          markAttendance={markAttendance}
          completeSession={completeSession}
          unlockSession={unlockSession}
          startNewSession={startNewSession}
          onOpenEvidenceModal={handleOpenEvidenceModal}
          onOpenReviewModal={() => handleOpenReviewModal()}
          currentTrainer={currentTrainer}
          schools={schools}
        />
      )}

      {/* TAB 2: END-OF-UNIT REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">End-of-Unit Student Reviews</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Accredited unit assessments certifying candidate mastery & advancing tech levels.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedReviewGrade}
                onChange={(e) => setSelectedReviewGrade(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
              >
                <option value="All">All Grades</option>
                <option value="6">Class 6A</option>
                <option value="7">Class 7A</option>
                <option value="8">Class 8A</option>
                <option value="9">Class 9A</option>
                <option value="11">Class 11A</option>
              </select>

              <button
                type="button"
                onClick={() => handleOpenReviewModal()}
                className="px-4 py-2 bg-pixiu-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={15} />
                <span>Submit Unit Review</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleStudentReviews.map(review => (
              <div
                key={review.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-pixiu-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                        {review.unit_code} • {review.level || 'Level 0'}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base mt-1.5">{review.student_name}</h3>
                      <p className="text-xs text-slate-500 font-mono">ID: {review.student_id}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-amber-500">{review.score}/10 ★</span>
                      <span className="block text-[10px] font-bold text-slate-400 mt-0.5">{review.date || 'Aug 2026'}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed italic">
                    "{review.review}"
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs mt-4">
                  <span className="text-slate-400 text-[11px]">By: {review.trainer_name || 'Vikas Pandey'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenReviewModal(review)}
                      className="p-1.5 text-slate-400 hover:text-pixiu-blue hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit Review"
                    >
                      <Edit3 size={14} />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => deleteStudentReview(review.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Review"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {visibleStudentReviews.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200">
                No end-of-unit student reviews found for this grade filter. Click "Submit Unit Review" to certify a student.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BUILD PHOTO EVIDENCE */}
      {activeTab === 'evidence' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Certified Hardware Build Photo Evidence</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Instructor verified circuit prototypes and robotics capstones synced directly to student digital lockers.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenEvidenceModal(sessions[0], visibleStudents)}
              className="px-4 py-2 bg-pixiu-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Camera size={15} />
              <span>Upload New Project Photo</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleEvidenceProjects.map(proj => (
              <div
                key={proj.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="aspect-video bg-slate-900 relative overflow-hidden flex items-center justify-center">
                  <img
                    src={proj.evidence_photo || 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&auto=format&fit=crop&q=80'}
                    alt={proj.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-xs text-amber-400 font-bold text-xs px-2.5 py-1 rounded-full border border-amber-400/30">
                    {proj.score || 10}/10 ★
                  </span>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-pixiu-blue bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {proj.unit_code || 'Unit 2'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {proj.student_id}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{proj.title}</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {proj.trainer_notes || 'Breadboard circuit calibrated and verified in active lab.'}
                  </p>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-bold">{proj.student_name}</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => deleteProject(proj.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Remove Evidence"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {visibleEvidenceProjects.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200">
                No certified project photo builds uploaded yet. Click "Upload New Project Photo" to record student evidence.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TRAINERS ROSTER MANAGEMENT (ADMIN VIEW) */}
      {activeTab === 'trainers' && isAdmin && (
        <TrainerRosterManagement
          trainers={visibleTrainers}
          schools={schools}
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
          onRequestDeleteTrainer={(trainer) => setTrainerToDelete(trainer)}
          onToggleTrainerStatus={updateTrainerStatus}
          isAdmin={isAdmin}
        />
      )}

      {/* ==================== MODALS ==================== */}

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        roster={evidenceRosterData.length > 0 ? evidenceRosterData : visibleStudents}
        activeSession={evidenceSessionData}
        onSaveEvidence={addProject}
        uploadFile={uploadFile}
      />

      {/* Student Review Modal */}
      <StudentReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        editingReview={editingReview}
        visibleStudents={visibleStudents}
        gradeUnitsConfig={GRADE_UNITS_CONFIG}
        onSaveReview={saveStudentReview}
        trainerName={user?.name || currentTrainer?.name || 'Vikas Pandey'}
      />

      {/* Onboard Trainer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Onboard & Register Robotics Trainer"
        size="md"
      >
        <form onSubmit={handleAddTrainerSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Trainer Full Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="e.g. Akash Sharma"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Contact Phone *</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="+91 94500 12345"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono focus:outline-none focus:border-pixiu-blue"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Assigned Partner School *</label>
              <select
                value={formData.assigned_schools[0]}
                onChange={(e) => setFormData({ ...formData, assigned_schools: [e.target.value] })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-pixiu-blue"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Daily Stipend Rate (₹)</label>
              <input
                type="number"
                value={formData.daily_rate}
                onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold focus:outline-none focus:border-pixiu-blue"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Weekly Lab Days</label>
              <input
                type="number"
                value={formData.weekly_days}
                onChange={(e) => setFormData({ ...formData, weekly_days: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold focus:outline-none focus:border-pixiu-blue"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
            >
              Save & Register Trainer
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Next Session Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Schedule Classroom Lab & Alert Trainer"
        size="md"
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Target School</label>
              <select
                value={scheduleData.school_id}
                onChange={(e) => setScheduleData({ ...scheduleData, school_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-pixiu-blue"
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Deploy Instructor</label>
              <select
                value={scheduleData.trainer_id}
                onChange={(e) => setScheduleData({ ...scheduleData, trainer_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-pixiu-blue"
              >
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Syllabus Topic *</label>
            <input
              type="text"
              value={scheduleData.topic}
              onChange={(e) => setScheduleData({ ...scheduleData, topic: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Date</label>
              <input
                type="date"
                value={scheduleData.date}
                onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Time Slot</label>
              <input
                type="text"
                value={scheduleData.time}
                onChange={(e) => setScheduleData({ ...scheduleData, time: e.target.value })}
                placeholder="10:30 AM"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <Send size={14} />
              <span>Dispatch Schedule</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Security Confirmation Modal ("Type Name to Confirm Delete") */}
      <Modal
        isOpen={!!trainerToDelete}
        onClose={() => setTrainerToDelete(null)}
        title={
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <ShieldAlert size={18} />
            <span>Confirm Trainer Deletion</span>
          </div>
        }
        size="sm"
      >
        {trainerToDelete && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to permanently delete <strong className="text-slate-900 font-bold">{trainerToDelete.name}</strong> ({trainerToDelete.id}). This will revoke their LMS portal access and clear assigned sessions.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                To confirm, type <span className="font-mono text-rose-600 font-bold select-all">"{trainerToDelete.name}"</span> below:
              </label>
              <input 
                type="text" 
                placeholder={`Type "${trainerToDelete.name}" to confirm`}
                value={deleteConfirmationInput} 
                onChange={e => setDeleteConfirmationInput(e.target.value)} 
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                type="button" 
                onClick={() => setTrainerToDelete(null)} 
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleConfirmDelete}
                disabled={deleteConfirmationInput.trim().toUpperCase() !== (trainerToDelete.name || '').trim().toUpperCase()}
                className={`px-4 py-2 font-bold text-xs rounded-lg transition-all ${
                  deleteConfirmationInput.trim().toUpperCase() === (trainerToDelete.name || '').trim().toUpperCase()
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Permanently Delete Trainer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
