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

const REVIEW_PRESETS = [
  "Demonstrated exceptional understanding of breadboard power rails, series-parallel LEDs, and Ohm's Law current calculations.",
  "Successfully calibrated analog LDR and digital IR sensors with accurate voltage divider threshold adjustments.",
  "Accurate transistor switching circuitry wiring and high-torque DC motor driver breadboard assembly.",
  "Strong grasp of digital pin modes, conditional loops, and serial monitor telemetry debugging.",
  "Excellent hands-on prototype assembly with neat wiring and active problem-solving.",
  "Completed lab objectives with good understanding, needs minor guidance on circuit debugging."
];

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
  const isAdmin = role === 'admin' || !role; // Default fallback to admin if not specified
  const toast = useToast();

  const isAkash = user?.username === 'akashsharma' || user?.related_id === 'TR-02' || user?.school_id === 'XYZ';
  const trainerSchoolId = isAkash ? 'XYZ' : 'ZPS';

  // Strict isolation: Akash sees ONLY Akash; Vikas sees ONLY Vikas; Admin sees ALL
  const visibleTrainers = useMemo(() => {
    if (isAdmin || user?.school_id === 'ALL') {
      return trainers;
    }
    if (isAkash) {
      return trainers.filter(t => t.id === 'TR-02' || t.name.toLowerCase().includes('akash'));
    }
    return trainers.filter(t => t.id === 'TR-01' || t.name.toLowerCase().includes('vikas'));
  }, [trainers, isAdmin, user, isAkash]);

  const activeTrainersCount = visibleTrainers.filter(t => t.status === 'Active').length;

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

  const trainerNotifs = (notifications || []).filter(n => {
    if (n.status === 'Archived') return false;
    return n.target_type === 'All_Trainers' || n.target_type === 'Universal';
  });

  const [readDirectiveIds, setReadDirectiveIds] = useState(() => {
    try {
      const saved = localStorage.getItem('pixiu_read_directives_trainer');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const markDirectiveRead = (id) => {
    const updated = Array.from(new Set([...readDirectiveIds, id]));
    setReadDirectiveIds(updated);
    try {
      localStorage.setItem('pixiu_read_directives_trainer', JSON.stringify(updated));
    } catch (e) {}
    toast.success('Directive acknowledged & marked as read!', 'Acknowledged');
  };
  
  // UI Tabs: 'trainers' | 'reviews' | 'history' | 'schedule'
  const [activeTab, setActiveTab] = useState('trainers');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // Start Next Session Modal State
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [newSessionModalData, setNewSessionModalData] = useState({
    school_id: 'ZPS',
    class_id: 'CLS-ZPS-6A',
    class_grade: '6',
    unit_code: 'Unit 2',
    class_number: 'Class 1',
    topic: 'Unit 2 (Class 1): The Arduino IDE - ',
    notes: 'Hands-on robotics laboratory session.',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  });

  // Security Modal for Deleting Trainer ("Type Name to Confirm")
  const [trainerToDelete, setTrainerToDelete] = useState(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  
  // Project Evidence Upload Modal in Session
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedStudentForEvidence, setSelectedStudentForEvidence] = useState('');
  const [projectTitle, setProjectTitle] = useState('Smart Obstacle Avoidance Robot');
  const [projectScore, setProjectScore] = useState(10);
  const [evidenceNote, setEvidenceNote] = useState('Clean breadboard wiring with ultrasonic sensor.');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [historyClassFilter, setHistoryClassFilter] = useState('All');

  // ==================== END-OF-UNIT STUDENT REVIEWS STATE ====================
  const [selectedReviewGrade, setSelectedReviewGrade] = useState('All');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);

  const [reviewFormData, setReviewFormData] = useState({
    student_id: 'ZPS6A 01',
    class_grade: '6',
    unit_code: 'Unit 1',
    level: 'Level 0',
    unit_title: 'Introduction to Robotics & Electronics',
    score: 9.5,
    rating: 5,
    status: 'Mastered',
    review: REVIEW_PRESETS[0],
    trainer_name: user?.name || 'Vikas Pandey (Lead Instructor)'
  });

  const handleOpenReviewModal = (existingReview = null) => {
    if (existingReview && existingReview.id) {
      setEditingReviewId(existingReview.id);
      setReviewFormData(existingReview);
    } else {
      setEditingReviewId(null);
      const targetStudentId = existingReview?.student_id;
      const targetStudent = targetStudentId ? students.find(s => s.student_id === targetStudentId) : null;
      const filteredStu = students.filter(s => selectedReviewGrade === 'All' || s.class_id.includes(`-${selectedReviewGrade}A`));
      const firstStudent = targetStudent || filteredStu[0] || students[0];
      const grade = firstStudent?.class_id ? firstStudent.class_id.replace('CLS-ZPS-', '').replace('A', '') : (existingReview?.class_grade || '6');
      const unitsList = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
      
      setReviewFormData({
        student_id: firstStudent?.student_id || 'ZPS6A 01',
        class_grade: grade,
        unit_code: unitsList[0].unitCode,
        level: unitsList[0].level,
        unit_title: unitsList[0].title,
        score: 9.5,
        rating: 5,
        status: 'Mastered',
        review: REVIEW_PRESETS[0],
        trainer_name: user?.name || 'Vikas Pandey (Lead Instructor)'
      });
    }
    setIsReviewModalOpen(true);
  };

  const handleSaveReview = (e) => {
    e.preventDefault();
    const studentObj = students.find(s => s.student_id === reviewFormData.student_id);
    const payload = {
      ...reviewFormData,
      id: editingReviewId || `REV-${Date.now().toString().slice(-4)}`,
      student_name: studentObj?.name || 'Student',
      class_grade: studentObj?.class_id ? studentObj.class_id.replace('CLS-ZPS-', '').replace('A', '') : reviewFormData.class_grade
    };
    saveStudentReview(payload);
    toast.success(`Unit review for ${payload.student_name} (${payload.unit_code}) saved successfully!`, 'Review Published');
    setIsReviewModalOpen(false);
  };

  const handleDeleteReview = (id, studentName) => {
    if (window.confirm(`Are you sure you want to remove the review for ${studentName}?`)) {
      deleteStudentReview(id);
      toast.success('Review removed.', 'Deleted');
    }
  };

  // Form State for Onboarding Trainer
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

  // Form State for Scheduling Next Session (Admin Notification)
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

  const handleSubmit = async (e) => {
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
    toast.success(`Trainer "${formData.name}" onboarded! Login credentials generated.`, 'Instructor Registered');
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
    if (deleteConfirmationInput.trim().toUpperCase() !== trainerToDelete.name.trim().toUpperCase()) {
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
    await scheduleSession(scheduleData);
    toast.success(`Session scheduled for ${scheduleData.date}! Notification dispatched to Trainer Vikas Pandey.`, 'Class Scheduled & Notified');
    setIsScheduleModalOpen(false);
  };

  const handleLaunchNewSession = async (e) => {
    e.preventDefault();
    const createdSession = await startNewSession({
      school_id: 'ZPS',
      class_id: newSessionModalData.class_id,
      trainer_id: user?.id || 'TR-01',
      unit_code: newSessionModalData.unit_code,
      class_number: newSessionModalData.class_number,
      date: newSessionModalData.date,
      time: newSessionModalData.time,
      topic: newSessionModalData.topic,
      notes: newSessionModalData.notes || 'Hands-on robotics laboratory session'
    });
    setIsNewSessionModalOpen(false);
    setActiveSessionId(createdSession.id);
    toast.success(`Live session started for ${newSessionModalData.topic}! You can now mark attendance.`, 'Session Active');
  };

  const handleOpenStartSessionModal = (targetClassId = 'CLS-ZPS-6A') => {
    const grade = targetClassId.replace('CLS-ZPS-', '').replace('A', '');
    const gradeUnits = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
    const nextUnit = gradeUnits[1] || gradeUnits[0];

    setNewSessionModalData({
      school_id: 'ZPS',
      class_id: targetClassId,
      class_grade: grade,
      unit_code: nextUnit.unitCode,
      class_number: 'Class 1',
      topic: `${nextUnit.unitCode} (Class 1): ${nextUnit.title} - `,
      notes: `Hands-on robotics laboratory session for ${nextUnit.title}.`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
    setIsNewSessionModalOpen(true);
  };

  // Session Runner Helpers
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const sessionClass = activeSession ? classes.find(c => c.id === activeSession.class_id) : null;
  const sessionSchool = activeSession ? schools.find(s => s.id === activeSession.school_id) : null;
  const roster = activeSession ? students.filter(s => s.class_id === activeSession.class_id) : [];

  const handleMarkAttendance = async (studentId, status) => {
    if (activeSession && activeSession.is_locked === 1 && !isAdmin) {
      toast.error("This session is locked. Only Admin can edit past attendance records!");
      return;
    }
    const res = await markAttendance(activeSessionId, studentId, status);
    if (res && res.error) {
      toast.error(res.error);
    }
  };

  const getAttendanceStatus = (studentId) => {
    return attendance.find(a => a.session_id === activeSessionId && a.student_id === studentId)?.status;
  };

  const finishSession = () => {
    completeSession(activeSessionId);
    toast.success('Session marked completed and attendance permanently locked!', 'Class Attendance Submitted');
    setActiveSessionId(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleEvidenceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentForEvidence) {
      toast.warning("Please select a student from the active roster!");
      return;
    }

    setIsUploading(true);
    let imageUrl = '';

    if (selectedFile) {
      const uploadRes = await uploadFile(selectedFile);
      if (uploadRes && uploadRes.success) {
        imageUrl = uploadRes.url;
      }
    }

    const studentObj = students.find(s => s.student_id === selectedStudentForEvidence) || roster.find(s => s.student_id === selectedStudentForEvidence);
    const targetStudentId = selectedStudentForEvidence.trim();

    await addProject({
      student_id: targetStudentId,
      student_name: studentObj?.name || 'Student',
      title: projectTitle,
      status: 'Completed',
      score: Number(projectScore) || 10,
      evidence_note: evidenceNote,
      image_url: imageUrl,
      date_completed: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    });

    setIsUploading(false);
    setIsEvidenceModalOpen(false);
    setSelectedFile(null);
    setFilePreview('');
    toast.success(`Project photo & evidence for ${studentObj?.name || targetStudentId} certified and saved!`, 'Build Evidence Uploaded');
  };

  const handleMarkAllPresent = async () => {
    if (activeSession && activeSession.is_locked === 1 && !isAdmin) {
      toast.error("This session is locked. Only Admin can edit past attendance records!");
      return;
    }
    for (const student of roster) {
      await markAttendance(activeSessionId, student.student_id, 'Present');
    }
    toast.success(`Marked all ${roster.length} students Present!`, 'Attendance Updated');
  };

  // If in live session runner view
  if (activeSession) {
    const isLocked = activeSession.is_locked === 1;

    return (
      <div className="max-w-lg mx-auto bg-slate-50 min-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-pixiu-dark text-white p-5 relative">
          <button onClick={() => setActiveSessionId(null)} className="absolute top-5 left-4 text-slate-400 hover:text-white cursor-pointer">
            <X size={22} />
          </button>
          <div className="text-center">
            <span className="text-[10px] font-bold tracking-widest text-pixiu-blue uppercase">Classroom Runner & Live Attendance</span>
            <h2 className="font-bold text-base text-white mt-0.5">{sessionSchool ? sessionSchool.name : 'Zenith Public School'}</h2>
            <p className="text-xs text-slate-300 font-medium">{sessionClass ? `Class ${sessionClass.grade} ${sessionClass.section}` : 'General Class'}</p>
            <p className="text-[11px] text-blue-200 mt-0.5 font-mono">
              Live: {new Date().toLocaleDateString('en-US', { weekday: 'long' })}, {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Class Switcher inside Live Runner */}
          <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-center gap-1.5 overflow-x-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Switch Grade:</span>
            {[
              { grade: '6', id: 'CLS-ZPS-6A', label: '6A' },
              { grade: '7', id: 'CLS-ZPS-7A', label: '7A' },
              { grade: '8', id: 'CLS-ZPS-8A', label: '8A' },
              { grade: '9', id: 'CLS-ZPS-9A', label: '9A' },
              { grade: '11', id: 'CLS-ZPS-11A', label: '11A' },
            ].map(cls => {
              const clsSession = sessions.find(s => s.class_id === cls.id);
              const isSelected = activeSession.class_id === cls.id;
              return (
                <button
                  key={cls.id}
                  onClick={() => {
                    if (clsSession) {
                      setActiveSessionId(clsSession.id);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isSelected 
                      ? 'bg-pixiu-blue text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400' 
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  Class {cls.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lock Warning & Action Banner */}
        {isLocked ? (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-xs text-amber-900 font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 font-bold text-[11px] sm:text-xs">
              <Lock size={14} className="text-amber-600 shrink-0"/>
              <span>Attendance Locked (Past Record)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenStartSessionModal(activeSession.class_id)}
                className="px-3 py-1.5 bg-pixiu-blue hover:bg-blue-600 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Plus size={14}/> Start Next Session
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Unlock this session to edit past attendance?")) {
                    unlockSession(activeSessionId);
                    toast.success("Session unlocked! You can now edit attendance.", "Session Unlocked");
                  }
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Unlock to edit past attendance"
              >
                <Unlock size={13}/> Unlock Edit
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-[11px] text-emerald-800 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Play size={12} className="fill-emerald-600 text-emerald-600"/> Live Session Active • Ready for Attendance</span>
            <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded text-[10px]">Active</span>
          </div>
        )}

        <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shadow-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lesson Topic</p>
            <p className="font-bold text-slate-800 text-sm">{activeSession.topic}</p>
          </div>
          <div className="bg-blue-50 text-pixiu-blue p-2 rounded-lg"><FileText size={18}/></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Student Roster ({roster.length})</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllPresent}
                disabled={isLocked && !isAdmin}
                className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-md cursor-pointer transition-colors"
              >
                ✓ Mark All Present
              </button>
            </div>
          </div>
          
          {roster.map(student => {
            const status = getAttendanceStatus(student.student_id);
            return (
              <div key={student.student_id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{student.name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{student.student_id} • {student.assigned_kit_id || 'Kit Assigned'}</p>
                  </div>
                </div>
                
                <div className="flex gap-1.5 items-center">
                  <button 
                    onClick={() => {
                      const grade = sessionClass ? sessionClass.grade : '6';
                      handleOpenReviewModal({
                        student_id: student.student_id,
                        class_grade: grade
                      });
                    }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-amber-500 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer shadow-2xs"
                    title="Submit End-of-Unit Evaluation for this Student"
                  >
                    <Star size={16} className="fill-amber-400 text-amber-500"/>
                  </button>
                  <button 
                    onClick={() => handleMarkAttendance(student.student_id, 'Present')}
                    disabled={isLocked && !isAdmin}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      status === 'Present' 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    } ${isLocked && !isAdmin ? 'cursor-not-allowed opacity-80' : ''}`}
                    title="Mark Present"
                  >
                    <Check size={18}/>
                  </button>
                  <button 
                    onClick={() => handleMarkAttendance(student.student_id, 'Absent')}
                    disabled={isLocked && !isAdmin}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                      status === 'Absent' 
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    } ${isLocked && !isAdmin ? 'cursor-not-allowed opacity-80' : ''}`}
                    title="Mark Absent"
                  >
                    A
                  </button>
                </div>
              </div>
            );
          })}

          {/* Active Class Uploaded Build Photos with Delete */}
          {(() => {
            const classStudentIds = roster.map(s => s.student_id);
            const classProjects = (projects || []).filter(p => classStudentIds.includes(p.student_id));
            if (classProjects.length === 0) return null;

            return (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2 mt-4">
                <div className="flex justify-between items-center">
                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera size={13} className="text-pixiu-blue"/> Certified Builds ({classProjects.length})
                  </p>
                  <span className="text-[10px] text-slate-400 font-medium">Uploaded to Profiles</span>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {classProjects.map(proj => {
                    const studentObj = students.find(s => s.student_id === proj.student_id);
                    return (
                      <div key={proj.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {proj.image_url ? (
                            <img src={proj.image_url} alt="Build" className="w-10 h-10 rounded-md object-cover border border-slate-300 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-md bg-blue-50 text-pixiu-blue flex items-center justify-center font-bold text-xs shrink-0">
                              <Box size={16}/>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-xs truncate">{proj.title}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {studentObj?.name || proj.student_id} • Score: {proj.score}/10 ★
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (window.confirm(`Delete photo build for ${studentObj?.name || proj.student_id}?`)) {
                              deleteProject(proj.id);
                              toast.success('Build photo deleted from student profile.', 'Deleted');
                            }
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                          title="Delete Uploaded Build Photo"
                        >
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Project Build Evidence Upload Button */}
          <div 
            onClick={() => {
              if (roster.length > 0) {
                setSelectedStudentForEvidence(roster[0].student_id);
              } else {
                setSelectedStudentForEvidence('ZPS6A 01');
              }
              setProjectTitle(`${activeSession?.topic || 'Robotics Lab'} - Prototype Build`);
              setIsEvidenceModalOpen(true);
            }}
            className="bg-white p-4 rounded-xl border-2 border-dashed border-blue-300 hover:border-pixiu-blue bg-blue-50/30 hover:bg-blue-50/60 mt-4 text-center cursor-pointer transition-all shadow-xs"
          >
            <Camera size={22} className="mx-auto text-pixiu-blue mb-1.5" />
            <p className="text-xs font-bold text-pixiu-blue">+ Snap & Upload Robot Build Photo</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Certifies project build to student portfolio</p>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          {!isLocked ? (
            <button 
              onClick={finishSession}
              className="w-full bg-pixiu-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm cursor-pointer transition-colors"
            >
              <Lock size={16} /> Submit & Lock Attendance
            </button>
          ) : (
            <button 
              onClick={() => setActiveSessionId(null)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              Close Session View
            </button>
          )}
        </div>

        {/* Evidence Upload Modal */}
        {isEvidenceModalOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Camera size={16} className="text-pixiu-blue"/> Upload Robot Build Evidence
                </h3>
                <button onClick={() => setIsEvidenceModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
              </div>

              <form onSubmit={handleEvidenceSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Select Student</label>
                  <select 
                    value={selectedStudentForEvidence} 
                    onChange={e => setSelectedStudentForEvidence(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue"
                  >
                    {roster.map(s => <option key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Project Name</label>
                  <input 
                    type="text" 
                    value={projectTitle} 
                    onChange={e => setProjectTitle(e.target.value)} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Upload Photo / Snap Camera</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-pixiu-blue hover:file:bg-blue-100 cursor-pointer"
                  />
                  {filePreview && (
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200">
                      <img src={filePreview} alt="Preview" className="w-full h-28 object-cover" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block font-bold text-slate-500 uppercase mb-1">Score (1-10)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={projectScore} 
                      onChange={e => setProjectScore(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue font-bold text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-500 uppercase mb-1">Observation Note</label>
                    <input 
                      type="text" 
                      value={evidenceNote} 
                      onChange={e => setEvidenceNote(e.target.value)}
                      placeholder="e.g. Mastered ultrasonic trigger"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsEvidenceModalOpen(false)} className="px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isUploading} className="px-4 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer">
                    {isUploading ? 'Uploading...' : 'Save & Attach to Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trainer Faculty & Academic Operations</h1>
          <p className="text-slate-500">Manage instructor payouts, schedule next classes with alerts, and review attendance records.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setIsScheduleModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer text-xs"
            >
              <Bell size={16} /> Schedule Next Class & Notify Trainer
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-pixiu-blue text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-xs"
            >
              <Plus size={16} /> Add Trainer
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('trainers')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
            activeTab === 'trainers' ? 'border-b-2 border-pixiu-blue text-pixiu-blue' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap size={17} /> Instructor Roster & Payouts
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
            activeTab === 'reviews' ? 'border-b-2 border-pixiu-blue text-pixiu-blue' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Star size={17} className="text-amber-500 fill-amber-500" /> End-of-Unit Student Reviews ({studentReviews.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
            activeTab === 'history' ? 'border-b-2 border-pixiu-blue text-pixiu-blue' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={17} /> Date-wise Attendance Logs ({sessions.length})
        </button>
      </div>

      {activeTab === 'trainers' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><GraduationCap size={24} /></div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Faculty Instructors</p>
                <p className="text-2xl font-bold text-slate-800">{visibleTrainers.length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle size={24} /></div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Active in Field</p>
                <p className="text-2xl font-bold text-emerald-600">{activeTrainersCount}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><Building2 size={24} /></div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Assigned Institution</p>
                <p className="text-xl font-bold text-slate-800">
                  {visibleTrainers.length === 1 
                    ? (visibleTrainers[0].id === 'TR-02' ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School') 
                    : 'All Partner Schools (ZPS & XYZ)'}
                </p>
              </div>
            </div>
          </div>

          {/* Active Admin Directives for Trainers */}
          {trainerNotifs.length > 0 && (
            <div className="mb-8 space-y-3">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Admin Directives & Next Class Schedule Notices
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trainerNotifs.map(notif => {
                  const isRead = readDirectiveIds.includes(notif.id);
                  return (
                    <div 
                      key={notif.id} 
                      className={`p-5 rounded-2xl border transition-all space-y-3 ${
                        isRead 
                          ? 'border-slate-200 bg-white opacity-80' 
                          : 'border-indigo-200 bg-indigo-50/40 shadow-xs'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider">
                            {notif.template_type === 'kit_prep' ? 'Hardware Prep' : 'Class Notice'}
                          </span>
                          {!isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {notif.scheduled_date} • {notif.scheduled_time}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">{notif.title}</h4>
                      <p className="text-xs text-slate-600 leading-relaxed bg-white p-3.5 rounded-xl border border-indigo-100/60 whitespace-pre-line">
                        {notif.message}
                      </p>

                      <div className="flex justify-end pt-1">
                        {isRead ? (
                          <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle size={14}/> Read & Acknowledged
                          </span>
                        ) : (
                          <button 
                            onClick={() => markDirectiveRead(notif.id)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                          >
                            <Check size={13} /> Mark as Read & Acknowledged
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Trainers Roster Grid (Scoped so Akash only sees Akash, Vikas only sees Vikas, Admin sees all) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {visibleTrainers.map(trainer => {
              const assignedCodes = trainer.assigned_schools 
                ? trainer.assigned_schools.split(',').map(s => s.trim()) 
                : [trainer.id === 'TR-02' ? 'XYZ' : 'ZPS'];

              const primarySchoolCode = assignedCodes[0] || (trainer.id === 'TR-02' ? 'XYZ' : 'ZPS');
              const targetSchool = schools.find(s => s.id === primarySchoolCode || s.code === primarySchoolCode) || {
                name: primarySchoolCode === 'XYZ' ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School',
                code: primarySchoolCode
              };

              const dailyRate = Number(trainer.daily_rate) || 600;
              const weeklyDays = Number(trainer.weekly_days) || 2;
              const weeklyPayout = dailyRate * weeklyDays;

              return (
                <div key={trainer.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {trainer.name.split(' ').map(w => w[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{trainer.name}</h3>
                          <p className="text-xs text-pixiu-blue font-semibold">{trainer.role}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => updateTrainerStatus(trainer.id, trainer.status === 'Active' ? 'On Leave' : 'Active')}
                        className={`text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors ${
                          trainer.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {trainer.status}
                      </button>
                    </div>

                    {/* Salary & Payout Badge */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 rounded-xl border border-blue-100 mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          ₹
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Salary & Compensation Model</p>
                          <p className="text-xs font-bold text-slate-800 mt-0.5">
                            ₹{dailyRate}/day • {weeklyDays} Days/Week
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Weekly Payout</p>
                        <p className="text-sm font-extrabold text-blue-700">₹{weeklyPayout.toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    <div className="space-y-3 my-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Phone size={13}/> Contact Phone:</span>
                        <span className="font-mono text-xs font-bold text-slate-800">{trainer.phone || 'N/A'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Star size={13} className="text-amber-500 fill-amber-500"/> Trainer Rating:</span>
                        <span className="text-xs font-bold text-slate-800">{trainer.rating || 5.0} / 5.0</span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Assigned Partner School:</span>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                            <Building2 size={12} className="text-pixiu-blue"/>
                            {targetSchool.name} ({targetSchool.code})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Take Attendance:</span>
                      {[
                        { grade: '6', id: `CLS-${primarySchoolCode}-6A`, label: 'Class 6A' },
                        { grade: '7', id: `CLS-${primarySchoolCode}-7A`, label: 'Class 7A' },
                        { grade: '8', id: `CLS-${primarySchoolCode}-8A`, label: 'Class 8A' },
                        { grade: '9', id: `CLS-${primarySchoolCode}-9A`, label: 'Class 9A' },
                        { grade: '11', id: `CLS-${primarySchoolCode}-11A`, label: 'Class 11A' },
                      ].map(cls => {
                        const classSessions = sessions.filter(s => s.class_id === cls.id);
                        const activeUnlocked = classSessions.find(s => s.is_locked === 0);
                        const targetSession = activeUnlocked || classSessions[0];
                        return (
                          <button 
                            key={cls.id}
                            onClick={() => {
                              if (targetSession) {
                                setActiveSessionId(targetSession.id);
                              } else {
                                handleOpenStartSessionModal(cls.id);
                              }
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                              activeUnlocked 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' 
                                : 'bg-slate-900 hover:bg-pixiu-blue text-white'
                            }`}
                          >
                            <Play size={11} fill="white"/> {cls.label}
                          </button>
                        );
                      })}
                      <button 
                        onClick={() => handleOpenStartSessionModal(`CLS-${primarySchoolCode}-6A`)}
                        className="bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                      >
                        <Plus size={13}/> Start Next Session
                      </button>
                    </div>

                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setTrainerToDelete(trainer);
                          setDeleteConfirmationInput('');
                        }}
                        className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 self-end sm:self-auto"
                        title="Remove Trainer"
                      >
                        <Trash2 size={16}/> Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Date-wise Attendance Logs Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History size={16} className="text-pixiu-blue"/> Past Classroom Sessions & Date-wise Attendance Logs
              </h3>
              <p className="text-xs text-slate-500">Official syllabus lab classes & attendance records across all grades</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Class Grade Filter */}
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 uppercase mr-1 shrink-0">Filter Grade:</span>
                {[
                  { grade: 'All', label: `All (${sessions.length})` },
                  { grade: '6A', label: `6A (${sessions.filter(s => s.class_id === 'CLS-ZPS-6A').length})` },
                  { grade: '7A', label: `7A (${sessions.filter(s => s.class_id === 'CLS-ZPS-7A').length})` },
                  { grade: '8A', label: `8A (${sessions.filter(s => s.class_id === 'CLS-ZPS-8A').length})` },
                  { grade: '9A', label: `9A (${sessions.filter(s => s.class_id === 'CLS-ZPS-9A').length})` },
                  { grade: '11A', label: `11A (${sessions.filter(s => s.class_id === 'CLS-ZPS-11A').length})` }
                ].map(item => (
                  <button
                    key={item.grade}
                    onClick={() => setHistoryClassFilter(item.grade)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      historyClassFilter === item.grade 
                        ? 'bg-pixiu-blue text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleOpenStartSessionModal('CLS-ZPS-6A')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Plus size={13}/> Start Next Session
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {sessions
              .filter(ses => ses.is_locked === 1 || attendance.some(a => a.session_id === ses.id))
              .filter(ses => {
                if (historyClassFilter === 'All') return true;
                return ses.class_id.includes(historyClassFilter);
              })
              .map(ses => {
                const sessionAtt = attendance.filter(a => a.session_id === ses.id);
                const presentCount = sessionAtt.filter(a => a.status === 'Present').length;
                const totalCount = sessionAtt.length || 5;
                const isUnlocked = ses.is_locked === 0;

                return (
                  <div key={ses.id} className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold bg-blue-50 text-pixiu-blue px-2.5 py-0.5 rounded-md flex items-center gap-1 border border-blue-100">
                          <Calendar size={12} /> {ses.date} • {ses.time}
                        </span>
                        <span className="font-bold text-slate-900 text-xs px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                          {ses.class_id.replace('CLS-ZPS-', 'Class ')}
                        </span>
                        {isUnlocked ? (
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <Play size={10} fill="currentColor" /> Live & Unlocked
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Lock size={10} /> Recorded & Locked
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">{ses.topic}</p>
                      {ses.notes && <p className="text-xs text-slate-500">{ses.notes}</p>}
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Attendance Recorded</p>
                        <p className="text-xs sm:text-sm font-bold text-emerald-600">{presentCount} / {totalCount} Students Present</p>
                      </div>

                      <button
                        onClick={() => setActiveSessionId(ses.id)}
                        className="bg-slate-900 hover:bg-pixiu-blue text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        {isUnlocked ? 'Take Attendance' : 'View Record'} <ChevronRight size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}

            {sessions.filter(ses => ses.is_locked === 1 || attendance.some(a => a.session_id === ses.id)).length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700 text-sm">No Live Attendance Logged Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  When trainers take live class attendance, the live day, date, and exact time will automatically be logged and locked here in real-time.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== END-OF-UNIT STUDENT REVIEWS TAB ==================== */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Star size={18} className="text-amber-500 fill-amber-500" />
                End-of-Unit Student Review & Competency Assessment Engine
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluate each student per curriculum unit out of 10 with verified remarks. Automatically synchronizes with Student Transcript & Portal.
              </p>
            </div>

            <button
              onClick={() => handleOpenReviewModal()}
              className="bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus size={15} /> Submit Student Unit Review
            </button>
          </div>

          {/* Class Grade Filter Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Filter Class:</span>
            {['All', '6', '7', '8', '9', '11'].map(grade => (
              <button
                key={grade}
                onClick={() => setSelectedReviewGrade(grade)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedReviewGrade === grade 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {grade === 'All' ? 'All Classes' : `Class ${grade}A`}
              </button>
            ))}
          </div>

          {/* Student Reviews Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {visibleStudentReviews.map(rev => (
              <div 
                key={rev.id} 
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-blue-50 text-pixiu-blue rounded-md border border-blue-100">
                        {rev.student_id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1">{rev.student_name}</h4>
                      <p className="text-[11px] text-slate-400">Class {rev.class_grade}A Cohort</p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {rev.score} / 10
                      </span>
                      <div className="flex items-center gap-0.5 justify-end mt-1">
                        {[...Array(Number(rev.rating) || 5)].map((_, i) => (
                          <Star key={i} size={11} className="text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700">{rev.level} ({rev.unit_code})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        rev.status === 'Mastered' ? 'bg-emerald-100 text-emerald-800' :
                        rev.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {rev.status}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-600 mb-2">{rev.unit_title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-line italic">
                      "{rev.review}"
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <span>By: <strong className="text-slate-700">{rev.trainer_name}</strong></span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReviewModal(rev)}
                      className="text-pixiu-blue hover:underline font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteReview(rev.id, rev.student_name)}
                        className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
                        title="Delete Review"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {visibleStudentReviews.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <Star size={36} className="mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700 text-sm">No Student Reviews Logged for this Class</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Click "Submit Student Unit Review" above to evaluate a student's competency at the end of a unit.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

  {/* ==================== REVIEW MODAL ==================== */}
  {isReviewModalOpen && (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-amber-400 fill-amber-400"/>
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {editingReviewId ? 'Edit Student Unit Review' : 'Submit End-of-Unit Student Review'}
            </h3>
          </div>
          <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18}/></button>
        </div>

        <form onSubmit={handleSaveReview} className="p-6 space-y-4 text-xs">
          {/* Class & Student Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Select Class Grade</label>
              <select
                value={reviewFormData.class_grade}
                onChange={(e) => {
                  const grade = e.target.value;
                  const studentInGrade = visibleStudents.find(s => s.class_id.includes(`-${grade}A`));
                  const unitsList = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
                  const currentOrFirstUnit = unitsList.find(u => u.unitCode === reviewFormData.unit_code) || unitsList[0];
                  setReviewFormData({
                    ...reviewFormData,
                    class_grade: grade,
                    student_id: studentInGrade ? studentInGrade.student_id : reviewFormData.student_id,
                    unit_code: currentOrFirstUnit.unitCode,
                    level: currentOrFirstUnit.level,
                    unit_title: currentOrFirstUnit.title
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
              >
                <option value="6">Class 6A</option>
                <option value="7">Class 7A</option>
                <option value="8">Class 8A</option>
                <option value="9">Class 9A</option>
                <option value="11">Class 11A</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Select Student</label>
              <select
                value={reviewFormData.student_id}
                onChange={(e) => setReviewFormData({ ...reviewFormData, student_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
              >
                {visibleStudents
                  .filter(s => s.class_id.includes(`-${reviewFormData.class_grade}A`))
                  .map(s => (
                    <option key={s.student_id} value={s.student_id}>
                      {s.student_id} - {s.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Score & Rating */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Competency Score (Out of 10) *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10"
                value={reviewFormData.score}
                onChange={(e) => setReviewFormData({ ...reviewFormData, score: parseFloat(e.target.value) || 0 })}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Status Classification</label>
              <select
                value={reviewFormData.status}
                onChange={(e) => setReviewFormData({ ...reviewFormData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
              >
                <option value="Mastered">Mastered (Distinction)</option>
                <option value="In Progress">In Progress (Active)</option>
                <option value="Needs Practice">Needs Practice</option>
              </select>
            </div>
          </div>

          {/* Qualitative Remarks */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-slate-600 uppercase">Qualitative Instructor Remarks *</label>
              <span className="text-[10px] text-slate-400">Quick Remarks Preset</span>
            </div>

            {/* Quick Remarks Buttons */}
            <div className="flex flex-wrap gap-1 mb-2">
              {REVIEW_PRESETS.slice(0, 3).map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReviewFormData({ ...reviewFormData, review: preset })}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] truncate max-w-xs cursor-pointer"
                  title={preset}
                >
                  {preset.slice(0, 35)}...
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={reviewFormData.review}
              onChange={(e) => setReviewFormData({ ...reviewFormData, review: e.target.value })}
              required
              placeholder="Enter detailed trainer remarks on hands-on practical execution, circuit wiring, and conceptual comprehension..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 font-medium"
            />
          </div>

          {/* Verified Trainer Name */}
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Evaluating Trainer Name</label>
            <input
              type="text"
              value={reviewFormData.trainer_name}
              onChange={(e) => setReviewFormData({ ...reviewFormData, trainer_name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsReviewModalOpen(false)}
              className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
            >
              {editingReviewId ? 'Update Review' : 'Publish Student Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* ==================== SCHEDULE NEXT CLASS MODAL ==================== */}
  {isScheduleModalOpen && (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Bell size={18} className="text-indigo-600"/> Schedule Next Class & Notify Trainer
            </h3>
            <p className="text-xs text-slate-500">Sets up classroom session & triggers instant notification alert</p>
          </div>
          <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
        </div>

            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assigned Trainer</label>
                  <select 
                    value={scheduleData.trainer_id} 
                    onChange={e => setScheduleData({ ...scheduleData, trainer_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  >
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Target Class</label>
                  <select 
                    value={scheduleData.class_id} 
                    onChange={e => setScheduleData({ ...scheduleData, class_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>Class {c.grade}{c.section} (Zenith)</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Session Date *</label>
                  <input 
                    type="date" 
                    value={scheduleData.date} 
                    onChange={e => setScheduleData({ ...scheduleData, date: e.target.value })} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Session Time</label>
                  <input 
                    type="text" 
                    value={scheduleData.time} 
                    onChange={e => setScheduleData({ ...scheduleData, time: e.target.value })} 
                    placeholder="10:30 AM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Lesson Topic & Focus *</label>
                <input 
                  type="text" 
                  value={scheduleData.topic} 
                  onChange={e => setScheduleData({ ...scheduleData, topic: e.target.value })} 
                  required
                  placeholder="e.g. Unit 2: Line Follower Sensor Calibration"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Instructor Instructions & Prep Notes</label>
                <textarea 
                  rows="2"
                  value={scheduleData.notes} 
                  onChange={e => setScheduleData({ ...scheduleData, notes: e.target.value })} 
                  placeholder="e.g. Ensure all students bring KIT-ZPS hardware kits..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsScheduleModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={14}/> Dispatch Schedule & Notification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Trainer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Add & Onboard Robotics Trainer</h2>
                <p className="text-xs text-slate-500">Register instructor, assign schools, and configure salary payout</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trainer Full Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Vikas Pandey" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 9811122233" 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role / Specialization</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior Robotics Instructor" 
                    value={formData.role} 
                    onChange={e => setFormData({ ...formData, role: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              {/* Salary & Payout Configuration */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <IndianRupee size={14} className="text-pixiu-blue" /> Salary & Payout Settings
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Daily Session Rate (₹)</label>
                    <input 
                      type="number" 
                      placeholder="600" 
                      value={formData.daily_rate} 
                      onChange={e => setFormData({ ...formData, daily_rate: e.target.value })} 
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Days Per Week</label>
                    <input 
                      type="number" 
                      placeholder="2" 
                      value={formData.weekly_days} 
                      onChange={e => setFormData({ ...formData, weekly_days: e.target.value })} 
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue font-bold"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between font-semibold">
                  <span>Calculated Weekly: ₹{(Number(formData.daily_rate) || 0) * (Number(formData.weekly_days) || 0)}</span>
                  <span>Monthly: ₹{(Number(formData.daily_rate) || 0) * (Number(formData.weekly_days) || 0) * 4}</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Save & Onboard Trainer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Next Live Session Modal */}
      {isNewSessionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Play size={16} className="text-pixiu-blue fill-pixiu-blue"/> Start Next Live Session
                </h3>
                <p className="text-xs text-slate-500">Launch a new classroom session & take live attendance</p>
              </div>
              <button onClick={() => setIsNewSessionModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18}/>
              </button>
            </div>

            <form onSubmit={handleLaunchNewSession} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Target Class</label>
                  <select
                    value={newSessionModalData.class_id}
                    onChange={(e) => {
                      const classId = e.target.value;
                      const grade = classId.replace(/CLS-(ZPS|XYZ)-/g, '').replace('A', '');
                      const gradeUnits = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
                      const nextUnit = gradeUnits[1] || gradeUnits[0];
                      const isXYZ = classId.includes('XYZ');
                      setNewSessionModalData({
                        ...newSessionModalData,
                        school_id: isXYZ ? 'XYZ' : 'ZPS',
                        class_id: classId,
                        class_grade: grade,
                        unit_code: nextUnit.unitCode,
                        class_number: 'Class 1 of 2',
                        topic: `${nextUnit.unitCode} (Class 1/2): ${nextUnit.title} - Setup & Testing`,
                        notes: `Hands-on robotics lab session for ${nextUnit.title}.`
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                  >
                    {(isAdmin ? [
                      { id: 'CLS-ZPS-6A', label: 'Class 6A (Zenith Public School)' },
                      { id: 'CLS-ZPS-7A', label: 'Class 7A (Zenith Public School)' },
                      { id: 'CLS-ZPS-8A', label: 'Class 8A (Zenith Public School)' },
                      { id: 'CLS-ZPS-9A', label: 'Class 9A (Zenith Public School)' },
                      { id: 'CLS-ZPS-11A', label: 'Class 11A (Zenith Public School)' },
                      { id: 'CLS-XYZ-6A', label: 'Class 6A (XYZ Academy)' },
                      { id: 'CLS-XYZ-7A', label: 'Class 7A (XYZ Academy)' },
                      { id: 'CLS-XYZ-8A', label: 'Class 8A (XYZ Academy)' },
                      { id: 'CLS-XYZ-9A', label: 'Class 9A (XYZ Academy)' },
                      { id: 'CLS-XYZ-11A', label: 'Class 11A (XYZ Academy)' }
                    ] : [
                      { id: `CLS-${trainerSchoolId}-6A`, label: `Class 6A (${trainerSchoolId === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School'})` },
                      { id: `CLS-${trainerSchoolId}-7A`, label: `Class 7A (${trainerSchoolId === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School'})` },
                      { id: `CLS-${trainerSchoolId}-8A`, label: `Class 8A (${trainerSchoolId === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School'})` },
                      { id: `CLS-${trainerSchoolId}-9A`, label: `Class 9A (${trainerSchoolId === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School'})` },
                      { id: `CLS-${trainerSchoolId}-11A`, label: `Class 11A (${trainerSchoolId === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School'})` },
                    ]).map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Session / Class</label>
                  <select
                    value={newSessionModalData.class_number}
                    onChange={(e) => {
                      const classNum = e.target.value;
                      const gradeUnits = GRADE_UNITS_CONFIG[newSessionModalData.class_grade] || GRADE_UNITS_CONFIG['6'];
                      const selectedUnit = gradeUnits.find(u => u.unitCode === newSessionModalData.unit_code) || gradeUnits[0];
                      setNewSessionModalData({
                        ...newSessionModalData,
                        class_number: classNum,
                        topic: `${selectedUnit.unitCode} (${classNum}): ${selectedUnit.title} - `
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                  >
                    <option value="Class 1">Class 1</option>
                    <option value="Class 2">Class 2</option>
                    <option value="Class 3">Class 3</option>
                    <option value="Class 4">Class 4</option>
                    <option value="Class 5">Class 5</option>
                    <option value="Class 6">Class 6</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Curriculum Unit</label>
                <select
                  value={newSessionModalData.unit_code}
                  onChange={(e) => {
                    const unitCode = e.target.value;
                    const gradeUnits = GRADE_UNITS_CONFIG[newSessionModalData.class_grade] || GRADE_UNITS_CONFIG['6'];
                    const selectedUnit = gradeUnits.find(u => u.unitCode === unitCode) || gradeUnits[0];
                    const classNum = newSessionModalData.class_number || 'Class 1';
                    setNewSessionModalData({
                      ...newSessionModalData,
                      unit_code: selectedUnit.unitCode,
                      topic: `${selectedUnit.unitCode} (${classNum}): ${selectedUnit.title} - `,
                      notes: `Hands-on robotics lab session for ${selectedUnit.title}.`
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                >
                  {(GRADE_UNITS_CONFIG[newSessionModalData.class_grade] || GRADE_UNITS_CONFIG['6']).map(u => (
                    <option key={u.unitCode} value={u.unitCode}>
                      {u.unitCode} ({u.level}) - {u.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Specific Lesson Topic & Focus *</label>
                <input
                  type="text"
                  value={newSessionModalData.topic}
                  onChange={(e) => setNewSessionModalData({ ...newSessionModalData, topic: e.target.value })}
                  required
                  placeholder="Type lesson topic / experiment name here..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Session Date *</label>
                  <input
                    type="date"
                    value={newSessionModalData.date}
                    onChange={(e) => setNewSessionModalData({ ...newSessionModalData, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Session Time</label>
                  <input
                    type="text"
                    value={newSessionModalData.time}
                    onChange={(e) => setNewSessionModalData({ ...newSessionModalData, time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                    placeholder="10:00 AM"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Lab / Hardware Prep Notes</label>
                <input
                  type="text"
                  value={newSessionModalData.notes}
                  onChange={(e) => setNewSessionModalData({ ...newSessionModalData, notes: e.target.value })}
                  placeholder="e.g. Bring USB-A cables, Arduino Uno boards, and sensors."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium bg-white text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewSessionModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pixiu-blue hover:bg-blue-600 text-white rounded-xl font-bold cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Play size={14} fill="white"/> Launch & Take Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Confirmation Modal ("Type Name to Confirm Delete") */}
      {trainerToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <ShieldAlert size={18} />
                <span>Confirm Trainer Deletion</span>
              </div>
              <button onClick={() => setTrainerToDelete(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-4">
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
                  disabled={deleteConfirmationInput.trim().toUpperCase() !== trainerToDelete.name.trim().toUpperCase()}
                  className={`px-4 py-2 font-bold text-xs rounded-lg transition-all ${
                    deleteConfirmationInput.trim().toUpperCase() === trainerToDelete.name.trim().toUpperCase()
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Permanently Delete Trainer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
