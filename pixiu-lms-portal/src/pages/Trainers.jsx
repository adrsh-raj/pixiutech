import { useState, useMemo } from 'react';
import { 
  GraduationCap, Plus, Phone, Building2, Star, CheckCircle, Clock, X, Trash2, 
  Play, User, Users, Camera, Check, FileText, Upload, Image as ImageIcon, IndianRupee, 
  Calendar, AlertTriangle, ShieldAlert, Lock, Unlock, Bell, Send, History, 
  CheckSquare, XSquare, ChevronRight, BookOpen, Megaphone, Edit3, Award, Box, Download, Cpu, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import { generateClassCohortTranscriptPDF, generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

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
    studentReviews = [], saveStudentReview, deleteStudentReview,
    updateStudent, pushSchoolNotification, getStudentAttendance
  } = useData();
  
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || !role; // Default fallback to admin if not specified
  const toast = useToast();

  const isAkash = user?.username === 'akashsharma' || user?.related_id === 'TR-02' || user?.school_id === 'XYZ';
  const trainerSchoolId = isAkash ? 'XYZ' : 'ZPS';

  // ==================== ALL REACT STATE HOOKS (DECLARED FIRST) ====================
  const [activeTab, setActiveTab] = useState(isAdmin ? 'trainers' : 'students');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // End-of-Unit Student Reviews State
  const [selectedReviewGrade, setSelectedReviewGrade] = useState('All');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [historyClassFilter, setHistoryClassFilter] = useState('All');

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

  const [readDirectiveIds, setReadDirectiveIds] = useState(() => {
    try {
      const saved = localStorage.getItem('pixiu_read_directives_trainer');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

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

  // ==================== COMPUTED / MEMOIZED DATA ====================
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

  const filteredEnrolledStudents = useMemo(() => {
    return visibleStudents.filter(s => {
      if (studentGradeFilter !== 'All') {
        const gradeStr = studentGradeFilter.replace('Class ', '').replace('A', '');
        const gradeMatch = s.class_id?.includes(`-${gradeStr}A`) || s.student_id?.includes(gradeStr);
        if (!gradeMatch) return false;
      }
      if (studentSearchTerm.trim()) {
        const q = studentSearchTerm.toLowerCase().trim();
        const matchesName = s.name?.toLowerCase().includes(q);
        const matchesId = s.student_id?.toLowerCase().includes(q);
        const matchesKit = s.assigned_kit_id?.toLowerCase().includes(q);
        const matchesClass = s.class_id?.toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesKit && !matchesClass) return false;
      }
      return true;
    });
  }, [visibleStudents, studentGradeFilter, studentSearchTerm]);

  const handleDownloadTranscript = (student, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const schoolName = schools.find(s => s.id === student.school_id)?.name || (student.school_id === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School');
    const studentProjects = projects.filter(p => p.student_id === student.student_id);
    const attendancePercentage = getStudentAttendance ? getStudentAttendance(student.student_id) : 100;

    generateStudentTranscriptPDF({
      student,
      school: schoolName,
      attendanceRate: attendancePercentage,
      studentReviews: studentReviews || [],
      projects: studentProjects,
      curriculum: curriculum || []
    });
    toast.success(`Generated official PDF transcript for ${student.name}!`, 'Transcript Exported');
  };

  const handleStartAttendanceForStudent = (student, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const targetClassId = student.class_id;
    const classSessions = sessions.filter(s => s.class_id === targetClassId);
    const activeUnlocked = classSessions.find(s => s.is_locked === 0);
    const targetSession = activeUnlocked || classSessions[0];
    if (targetSession) {
      setActiveSessionId(targetSession.id);
      toast.info(`Opened attendance session for Class ${student.class_id?.split('-').pop() || ''}!`, 'Classroom Attendance');
    } else {
      handleOpenStartSessionModal(targetClassId);
    }
  };

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

  const markDirectiveRead = (id) => {
    const updated = Array.from(new Set([...readDirectiveIds, id]));
    setReadDirectiveIds(updated);
    try {
      localStorage.setItem('pixiu_read_directives_trainer', JSON.stringify(updated));
    } catch (e) {}
    toast.success('Directive acknowledged & marked as read!', 'Acknowledged');
  };

  // Auto-synchronize modal student to valid student in visible list
  useEffect(() => {
    if (isReviewModalOpen) {
      if (reviewFormData.student_id === 'ABC6A 01') {
        handleSelectModalStudent('XYZ6A 01');
        return;
      }
      const gradeStudents = visibleStudents.filter(
        s => (s.class_id?.includes(`-${reviewFormData.class_grade}A`) || s.student_id?.includes(reviewFormData.class_grade)) && s.student_id !== 'ABC6A 01'
      );
      if (gradeStudents.length > 0 && !gradeStudents.some(s => s.student_id === reviewFormData.student_id)) {
        handleSelectModalStudent(gradeStudents[0].student_id);
      }
    }
  }, [isReviewModalOpen, reviewFormData.class_grade, reviewFormData.student_id, visibleStudents]);

  const handleOpenReviewModal = (existingReviewOrStudent = null, targetUnitCode = null) => {
    let studentId;
    let grade;
    let existingReview = null;

    if (existingReviewOrStudent && existingReviewOrStudent.id) {
      existingReview = existingReviewOrStudent;
      studentId = existingReview.student_id;
      grade = existingReview.class_grade || '6';
    } else if (existingReviewOrStudent && existingReviewOrStudent.student_id) {
      studentId = existingReviewOrStudent.student_id;
      const stu = visibleStudents.find(s => s.student_id === studentId) || students.find(s => s.student_id === studentId);
      grade = stu?.class_id ? (stu.class_id.match(/\d+/)?.[0] || '6') : (existingReviewOrStudent.class_grade || '6');
    } else {
      const filteredStu = visibleStudents.filter(s => (selectedReviewGrade === 'All' || s.class_id?.includes(`-${selectedReviewGrade}A`)) && s.student_id !== 'ABC6A 01');
      const firstStudent = filteredStu[0] || visibleStudents.find(s => s.student_id !== 'ABC6A 01') || visibleStudents[0];
      studentId = firstStudent?.student_id || (trainerSchoolId === 'XYZ' ? 'XYZ6A 01' : 'ZPS6A 01');
      const stu = visibleStudents.find(s => s.student_id === studentId) || students.find(s => s.student_id === studentId);
      grade = stu?.class_id ? (stu.class_id.match(/\d+/)?.[0] || '6') : '6';
    }

    // Safety guard: ensure ABC6A 01 is remapped to XYZ6A 01
    if (studentId === 'ABC6A 01') {
      studentId = 'XYZ6A 01';
      grade = '6';
    }

    // Safety guard: ensure studentId belongs to visibleStudents
    const matchedInVisible = visibleStudents.find(s => s.student_id === studentId);
    if (!matchedInVisible && visibleStudents.length > 0) {
      const validFallback = visibleStudents.find(s => s.student_id !== 'ABC6A 01') || visibleStudents[0];
      studentId = validFallback.student_id;
      grade = validFallback?.class_id ? (validFallback.class_id.match(/\d+/)?.[0] || '6') : '6';
    }

    const unitsList = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
    const sReviews = (studentReviews || []).filter(r => {
      if (!r) return false;
      const rId = (r.student_id || '').toUpperCase().replace(/\s+/g, '');
      const sId = (studentId || '').toUpperCase().replace(/\s+/g, '');
      const isManish = sId === 'XYZ6A01';
      return rId === sId || (isManish && (rId === 'ABC6A01' || r.student_name === 'Manish Rawat'));
    });

    // Determine target unit
    let unitToSelect;
    if (existingReview) {
      unitToSelect = unitsList.find(u => u.unitCode === existingReview.unit_code) || unitsList[0];
    } else if (targetUnitCode) {
      unitToSelect = unitsList.find(u => u.unitCode === targetUnitCode) || unitsList[0];
    } else {
      const pendingUnit = unitsList.find(u => !sReviews.some(r => r.unit_code === u.unitCode));
      unitToSelect = pendingUnit || unitsList[0];
    }

    const unitReview = existingReview || sReviews.find(r => r.unit_code === unitToSelect.unitCode);

    if (unitReview) {
      setEditingReviewId(unitReview.id);
      const rating = Number(unitReview.rating) || Math.round((Number(unitReview.score) || 10) / 2);
      const clampedRating = Math.max(1, Math.min(5, rating));
      setReviewFormData({
        ...unitReview,
        student_id: studentId,
        class_grade: grade,
        unit_code: unitToSelect.unitCode,
        level: unitToSelect.level,
        unit_title: unitToSelect.title,
        rating: clampedRating,
        score: clampedRating * 2, // Formula: 1★=2, 5★=10
        status: unitReview.status || 'Mastered',
        review: unitReview.review || REVIEW_PRESETS[0],
        trainer_name: unitReview.trainer_name || user?.name || (isAkash ? 'Akash Sharma (Senior Robotics Faculty)' : 'Vikas Pandey (Lead Instructor)'),
        issue_graduation_certificate: false
      });
    } else {
      setEditingReviewId(null);
      const unitIdx = unitsList.findIndex(u => u.unitCode === unitToSelect.unitCode);
      const defaultPreset = REVIEW_PRESETS[unitIdx >= 0 ? unitIdx % REVIEW_PRESETS.length : 0];
      setReviewFormData({
        student_id: studentId,
        class_grade: grade,
        unit_code: unitToSelect.unitCode,
        level: unitToSelect.level,
        unit_title: unitToSelect.title,
        rating: 5,
        score: 10, // 5★ = 10 pts
        status: 'Mastered',
        review: defaultPreset,
        trainer_name: user?.name || (isAkash ? 'Akash Sharma (Senior Robotics Faculty)' : 'Vikas Pandey (Lead Instructor)'),
        issue_graduation_certificate: false
      });
    }
    setIsReviewModalOpen(true);
  };

  const handleSelectModalUnit = (targetUnit) => {
    const sReviews = (studentReviews || []).filter(r => r.student_id === reviewFormData.student_id);
    const existingForUnit = sReviews.find(r => r.unit_code === targetUnit.unitCode);

    if (existingForUnit) {
      setEditingReviewId(existingForUnit.id);
      const rating = Number(existingForUnit.rating) || Math.round((Number(existingForUnit.score) || 10) / 2);
      const clampedRating = Math.max(1, Math.min(5, rating));
      setReviewFormData(prev => ({
        ...prev,
        ...existingForUnit,
        unit_code: targetUnit.unitCode,
        level: targetUnit.level,
        unit_title: targetUnit.title,
        rating: clampedRating,
        score: clampedRating * 2,
        status: existingForUnit.status || 'Mastered',
        review: existingForUnit.review || REVIEW_PRESETS[0]
      }));
    } else {
      setEditingReviewId(null);
      const unitsList = GRADE_UNITS_CONFIG[reviewFormData.class_grade] || GRADE_UNITS_CONFIG['6'];
      const unitIdx = unitsList.findIndex(u => u.unitCode === targetUnit.unitCode);
      setReviewFormData(prev => ({
        ...prev,
        unit_code: targetUnit.unitCode,
        level: targetUnit.level,
        unit_title: targetUnit.title,
        rating: 5,
        score: 10,
        status: 'Mastered',
        review: REVIEW_PRESETS[unitIdx >= 0 ? unitIdx % REVIEW_PRESETS.length : 0]
      }));
    }
  };

  const handleSelectModalStudent = (targetStudentId) => {
    let normalizedTargetId = targetStudentId;
    if (normalizedTargetId === 'ABC6A 01') normalizedTargetId = 'XYZ6A 01';

    const targetStudent = students.find(s => s.student_id === normalizedTargetId) || { name: 'Manish Rawat', class_id: 'CLS-XYZ-6A', school_id: 'XYZ', student_id: 'XYZ6A 01' };
    const grade = targetStudent?.class_id ? (targetStudent.class_id.match(/\d+/)?.[0] || '6') : reviewFormData.class_grade;
    const unitsList = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
    const sReviews = (studentReviews || []).filter(r => {
      if (!r) return false;
      const rId = (r.student_id || '').toUpperCase().replace(/\s+/g, '');
      const sId = (normalizedTargetId || '').toUpperCase().replace(/\s+/g, '');
      const isManish = sId === 'XYZ6A01';
      return rId === sId || (isManish && (rId === 'ABC6A01' || r.student_name === 'Manish Rawat'));
    });

    const pendingUnit = unitsList.find(u => !sReviews.some(r => r.unit_code === u.unitCode)) || unitsList[0];
    const existingForUnit = sReviews.find(r => r.unit_code === pendingUnit.unitCode);

    if (existingForUnit) {
      setEditingReviewId(existingForUnit.id);
      const rating = Number(existingForUnit.rating) || Math.round((Number(existingForUnit.score) || 10) / 2);
      const clampedRating = Math.max(1, Math.min(5, rating));
      setReviewFormData(prev => ({
        ...prev,
        ...existingForUnit,
        student_id: normalizedTargetId,
        student_name: targetStudent?.name || 'Student',
        class_grade: grade,
        unit_code: pendingUnit.unitCode,
        level: pendingUnit.level,
        unit_title: pendingUnit.title,
        rating: clampedRating,
        score: clampedRating * 2,
        status: existingForUnit.status || 'Mastered',
        review: existingForUnit.review || REVIEW_PRESETS[0]
      }));
    } else {
      setEditingReviewId(null);
      const unitIdx = unitsList.findIndex(u => u.unitCode === pendingUnit.unitCode);
      setReviewFormData(prev => ({
        ...prev,
        student_id: normalizedTargetId,
        student_name: targetStudent?.name || 'Student',
        class_grade: grade,
        unit_code: pendingUnit.unitCode,
        level: pendingUnit.level,
        unit_title: pendingUnit.title,
        rating: 5,
        score: 10,
        status: 'Mastered',
        review: REVIEW_PRESETS[unitIdx >= 0 ? unitIdx % REVIEW_PRESETS.length : 0],
        issue_graduation_certificate: false
      }));
    }
  };

  const handleRatingChange = (newRating) => {
    const clampedRating = Math.max(1, Math.min(5, newRating));
    const newScore = clampedRating * 2; // Strict formula: 1★=2, 2★=4, 3★=6, 4★=8, 5★=10
    const newStatus = clampedRating === 5 ? 'Mastered' : clampedRating >= 4 ? 'Mastered' : clampedRating >= 3 ? 'In Progress' : 'Needs Practice';
    setReviewFormData(prev => ({
      ...prev,
      rating: clampedRating,
      score: newScore,
      status: newStatus
    }));
  };

  const handleSaveReview = async (e) => {
    e.preventDefault();
    let targetStudentId = (reviewFormData.student_id === 'ABC6A 01' || reviewFormData.student_name === 'Manish Rawat')
      ? 'XYZ6A 01'
      : (reviewFormData.student_id || 'XYZ6A 01');

    const studentObj = students.find(s => s.student_id === targetStudentId) || { name: 'Manish Rawat', class_id: 'CLS-XYZ-6A', school_id: 'XYZ', student_id: 'XYZ6A 01' };
    const clampedRating = Math.max(1, Math.min(5, Number(reviewFormData.rating) || 5));
    const computedScore = clampedRating * 2; // Strict formula: 1★=2, 5★=10

    const payload = {
      ...reviewFormData,
      student_id: targetStudentId,
      id: editingReviewId || `REV-${Date.now().toString().slice(-4)}`,
      student_name: studentObj?.name || 'Manish Rawat',
      class_grade: studentObj?.class_id ? (studentObj.class_id.match(/\d+/)?.[0] || '6') : reviewFormData.class_grade,
      rating: clampedRating,
      score: computedScore
    };
    saveStudentReview(payload);

    // If Trainer chose to authorize & issue graduation certificate
    if (reviewFormData.issue_graduation_certificate && studentObj) {
      await updateStudent(studentObj.id || studentObj.student_id, {
        status: 'Certified Graduate',
        tech_level: 'Level 5 (Certified Graduate)',
        certificate_issued: true,
        certificate_issued_at: new Date().toISOString()
      });
      await pushSchoolNotification({
        target_school_id: studentObj.school_id,
        title: `🎓 Graduation Certificate Issued: ${studentObj.name}`,
        message: `Official Accredited STEM Robotics Certificate with QR Verification has been authorized and issued to ${studentObj.name} (${studentObj.student_id}) by Trainer ${reviewFormData.trainer_name}.`,
        type: 'certificate_issued',
        priority: 'high'
      });
      toast.success(`Official Accredited Certificate with QR unlocked for ${studentObj.name}! One-time credential issued.`, 'Graduate Certified');
    } else {
      toast.success(`Unit review for ${payload.student_name} (${payload.unit_code}) saved! Score: ${computedScore}/10 (${clampedRating}★).`, 'Review Published');
    }
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
            {(() => {
              const liveSchoolCode = sessionSchool?.code || sessionSchool?.id || activeSession?.school_id || trainerSchoolId || 'ZPS';
              return [
                { grade: '6', id: `CLS-${liveSchoolCode}-6A`, label: '6A' },
                { grade: '7', id: `CLS-${liveSchoolCode}-7A`, label: '7A' },
                { grade: '8', id: `CLS-${liveSchoolCode}-8A`, label: '8A' },
                { grade: '9', id: `CLS-${liveSchoolCode}-9A`, label: '9A' },
                { grade: '11', id: `CLS-${liveSchoolCode}-11A`, label: '11A' },
              ].map(cls => {
                const clsSession = sessions.find(s => s.class_id === cls.id);
                const isSelected = activeSession.class_id === cls.id;
                return (
                  <button
                    key={cls.id}
                    onClick={() => {
                      if (clsSession) {
                        setActiveSessionId(clsSession.id);
                      } else {
                        handleOpenStartSessionModal(cls.id);
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
              });
            })()}
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
          <div className="flex items-center gap-2">
            <Link
              to="/simulation"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="Launch Virtual Arduino Workbench for Classroom Smart-Board Projection"
            >
              <Cpu size={14} /> ⚡ Virtual Arduino Demo
            </Link>
            <div className="bg-blue-50 text-pixiu-blue p-2 rounded-lg"><FileText size={18}/></div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Student Roster ({roster.length})</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const grade = sessionClass ? sessionClass.grade : '6';
                  generateClassCohortTranscriptPDF({
                    classGrade: grade,
                    classSection: sessionClass ? sessionClass.section : 'A',
                    school: sessionSchool || 'Zenith Public School',
                    students: roster,
                    studentReviews,
                    projects,
                    curriculum,
                    getStudentAttendance: (id) => {
                      const records = (attendance || []).filter(a => a.student_id === id);
                      if (!records.length) return 100;
                      const present = records.filter(r => r.status === 'Present').length;
                      return Math.round((present / records.length) * 100);
                    },
                    userRole: 'trainer'
                  });
                }}
                className="text-[11px] font-bold text-pixiu-blue bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-md cursor-pointer transition-colors inline-flex items-center gap-1"
                title="Download whole class cohort progress & assessment report PDF"
              >
                <Download size={12} /> Class Report PDF
              </button>

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
        <Modal
          isOpen={isEvidenceModalOpen}
          onClose={() => setIsEvidenceModalOpen(false)}
          title={<span className="flex items-center gap-2"><Camera size={16} className="text-pixiu-blue"/> Upload Robot Build Evidence</span>}
          size="sm"
        >
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
        </Modal>
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
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 ${
            activeTab === 'students' ? 'border-b-2 border-pixiu-blue text-pixiu-blue' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={17} /> Enrolled Students ({visibleStudents.length})
        </button>
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

      {activeTab === 'students' && (
        <>
          {/* Student Directory KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-pixiu-blue shrink-0">
                <Users size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Enrolled</p>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{visibleStudents.length} Learners</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Active In Lab</p>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {visibleStudents.filter(s => s.status === 'Active' || !s.status).length} Active
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Award size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Certified Graduates</p>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {visibleStudents.filter(s => s.status?.includes('Certified') || s.tech_level?.includes('Certified')).length} Certified
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                <Box size={22} />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Kits Assigned</p>
                <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  {visibleStudents.filter(s => s.assigned_kit_id && s.assigned_kit_id !== 'Unassigned').length} Kits
                </p>
              </div>
            </div>
          </div>

          {/* Search, Filter & Cohort Export Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Grade Filter:</span>
              {['All', '6', '7', '8', '9', '11'].map(grade => {
                const count = grade === 'All' 
                  ? visibleStudents.length 
                  : visibleStudents.filter(s => s.class_id?.includes(`-${grade}A`) || s.student_id?.includes(grade)).length;
                const isSelected = studentGradeFilter === grade;
                return (
                  <button
                    key={grade}
                    onClick={() => setStudentGradeFilter(grade)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-pixiu-blue text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {grade === 'All' ? 'All Grades' : `Class ${grade}A`} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search name, ID, kit..."
                  value={studentSearchTerm}
                  onChange={e => setStudentSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pixiu-blue focus:bg-white transition-all"
                />
                {studentSearchTerm && (
                  <button 
                    onClick={() => setStudentSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Download Cohort PDF for Selected Grade */}
              <button
                type="button"
                onClick={() => {
                  const targetGrade = studentGradeFilter === 'All' ? '6' : studentGradeFilter;
                  const cohortStudents = visibleStudents.filter(s => s.class_id?.includes(`-${targetGrade}A`) || s.student_id?.includes(targetGrade));
                  const schoolObj = schools.find(s => s.id === (cohortStudents[0]?.school_id || trainerSchoolId)) || { name: trainerSchoolId === 'XYZ' ? 'XYZ Academy' : 'Zenith Public School' };
                  generateClassCohortTranscriptPDF({
                    classGrade: targetGrade,
                    classSection: 'A',
                    school: schoolObj,
                    students: cohortStudents.length > 0 ? cohortStudents : visibleStudents,
                    studentReviews,
                    projects,
                    curriculum,
                    getStudentAttendance: (id) => getStudentAttendance ? getStudentAttendance(id) : 100,
                    userRole: 'trainer'
                  });
                  toast.success(`Generated Cohort Transcript PDF for Class ${targetGrade}A!`, 'Class Cohort Report');
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                title="Download consolidated PDF report for this class"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Cohort PDF</span>
              </button>
            </div>
          </div>

          {/* Students Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
            {filteredEnrolledStudents.map(student => {
              const attRate = getStudentAttendance ? getStudentAttendance(student.student_id) : 100;
              const cleanGrade = student.class_id ? student.class_id.split('-').pop() : '6A';
              const gradeNum = cleanGrade.replace('A', '') || '6';
              const unitsList = GRADE_UNITS_CONFIG[gradeNum] || GRADE_UNITS_CONFIG['6'];
              const sReviews = (studentReviews || []).filter(r => r.student_id === student.student_id);
              const sTotalScore = sReviews.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
              const sCompletedUnits = sReviews.length;
              const isAll6Completed = sCompletedUnits >= 6;
              const isQRCertified = isAll6Completed && (student.status === 'Certified Graduate' || student.certificate_issued === true);

              return (
                <div 
                  key={student.student_id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Bar Accent */}
                  <div className={`h-1.5 w-full ${isQRCertified ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : isAll6Completed ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-pixiu-blue to-blue-400'}`} />

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Header: Avatar, Name, ID & Status Badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0 ${
                            isQRCertified 
                              ? 'bg-gradient-to-br from-emerald-500 to-teal-600' 
                              : isAll6Completed
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600'
                              : 'bg-gradient-to-br from-pixiu-blue to-indigo-600'
                          }`}>
                            {student.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-sm group-hover:text-pixiu-blue transition-colors">
                              {student.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[10px] font-bold text-pixiu-blue bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                {student.student_id}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                Class {cleanGrade}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                          isQRCertified 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : isAll6Completed
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isQRCertified ? '✓ QR Certified' : isAll6Completed ? '6/6 Evaluated' : `${sCompletedUnits}/6 Evaluated`}
                        </span>
                      </div>

                      {/* Hardware Kit & Tech Level */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 mb-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                            <Box size={13} className="text-slate-500" /> Kit Assigned:
                          </span>
                          <span className="font-mono font-bold text-slate-800 text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200">
                            {student.assigned_kit_id || 'KIT-001'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                            <Award size={13} className="text-slate-500" /> Syllabus Level:
                          </span>
                          <span className="font-semibold text-slate-700 text-[11px]">
                            {student.tech_level || 'Level 0'}
                          </span>
                        </div>

                        {/* Attendance Bar */}
                        <div className="pt-1.5 border-t border-slate-200/60">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Attendance:</span>
                            <span className={`font-mono text-[11px] font-bold ${attRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {attRate}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${attRate >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, Math.max(0, attRate))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 6-Level Review Progression & Cumulative Score */}
                      <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-100 mb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Star size={13} className="text-amber-500 fill-amber-500" />
                            Cumulative Score:
                          </span>
                          <span className="font-mono font-extrabold text-xs text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                            🏆 {sTotalScore} / 60 pts
                            <span className="text-slate-400 font-normal ml-1">({Math.round((sTotalScore / 60) * 100)}%)</span>
                          </span>
                        </div>

                        {/* 6 Units Mini Indicators */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1.5">
                            <span>Level Reviews ({sCompletedUnits}/6 Units):</span>
                            {isAll6Completed ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                                <CheckCircle size={11} /> 6/6 Done • QR Unlocked
                              </span>
                            ) : (
                              <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                                <Lock size={11} /> QR Locked ({sCompletedUnits}/6)
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                            {unitsList.map((unit, uIdx) => {
                              const rev = sReviews.find(r => r.unit_code === unit.unitCode);
                              const isDone = !!rev;
                              return (
                                <button
                                  key={unit.unitCode}
                                  type="button"
                                  onClick={() => handleOpenReviewModal({ student_id: student.student_id, class_grade: gradeNum }, unit.unitCode)}
                                  className={`p-1 rounded text-center transition-all cursor-pointer border ${
                                    isDone
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400'
                                      : 'bg-white border-slate-200 text-slate-400 hover:border-pixiu-blue hover:text-pixiu-blue'
                                  }`}
                                  title={`${unit.unitCode} (${unit.level}): ${unit.title} - ${isDone ? `Score: ${rev.score}/10 (${rev.rating}★)` : 'Click to evaluate'}`}
                                >
                                  <span className="block text-[9px] font-mono font-bold leading-none">U{uIdx + 1}</span>
                                  <span className="block text-[9px] font-bold leading-none mt-0.5">
                                    {isDone ? `${rev.score}` : '—'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Parent Contact Details */}
                      {student.parent_name && (
                        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 mb-3">
                          <span className="truncate">Parent: <strong className="text-slate-700 font-semibold">{student.parent_name}</strong></span>
                          {student.parent_phone && (
                            <span className="font-mono text-slate-600 shrink-0">{student.parent_phone}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5">
                      {/* Take Class Attendance */}
                      <button
                        onClick={(e) => handleStartAttendanceForStudent(student, e)}
                        className="flex-1 bg-pixiu-blue hover:bg-blue-600 text-white font-bold py-1.5 px-2.5 rounded-lg text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                        title={`Take attendance for Class ${cleanGrade}`}
                      >
                        <Play size={12} fill="white" />
                        <span>Attendance</span>
                      </button>

                      {/* Review Button */}
                      <button
                        onClick={() => handleOpenReviewModal({ student_id: student.student_id, class_grade: gradeNum })}
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Give End-of-Unit Review & Grading"
                      >
                        <Star size={14} className="text-amber-500 fill-amber-500" />
                        <span className="hidden sm:inline">Review</span>
                      </button>

                      {/* PDF Transcript Button */}
                      <button
                        onClick={(e) => handleDownloadTranscript(student, e)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                        title="Download Student Progress Transcript PDF"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredEnrolledStudents.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto mb-8 shadow-xs">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Users size={24} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-1">No Enrolled Students Found</h4>
              <p className="text-xs text-slate-500 mb-4">No students matched the active search or grade filter.</p>
              <button
                onClick={() => { setStudentSearchTerm(''); setStudentGradeFilter('All'); }}
                className="text-xs font-bold text-pixiu-blue hover:underline cursor-pointer"
              >
                Reset Search & Filters
              </button>
            </div>
          )}
        </>
      )}

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
  <Modal
    isOpen={isReviewModalOpen}
    onClose={() => setIsReviewModalOpen(false)}
    title={
      <div className="flex items-center gap-2">
        <Star size={18} className="text-amber-500 fill-amber-500"/>
        <div>
          <span className="text-sm font-bold text-slate-900 block leading-tight">
            {editingReviewId ? 'Edit Level-Wise Evaluation' : 'Submit Level-Wise Student Evaluation'}
          </span>
          <span className="text-[11px] text-slate-500 font-normal">
            6 Units Curriculum Assessment (Score = Rating × 2, Sum / 60)
          </span>
        </div>
      </div>
    }
    size="lg"
  >
        {(() => {
          const gradeStudents = visibleStudents.filter(
            s => (s.class_id?.includes(`-${reviewFormData.class_grade}A`) || s.student_id?.includes(reviewFormData.class_grade)) && s.student_id !== 'ABC6A 01'
          );
          const rawActiveId = gradeStudents.some(s => s.student_id === reviewFormData.student_id)
            ? reviewFormData.student_id
            : (gradeStudents[0]?.student_id || reviewFormData.student_id);
          const activeStudentId = (rawActiveId === 'ABC6A 01') ? 'XYZ6A 01' : rawActiveId;

          const currentStu = visibleStudents.find(s => s.student_id === activeStudentId) || students.find(s => s.student_id === activeStudentId) || { name: 'Manish Rawat', student_id: 'XYZ6A 01' };
          const modalUnits = GRADE_UNITS_CONFIG[reviewFormData.class_grade] || GRADE_UNITS_CONFIG['6'];
          const currentStuReviews = (studentReviews || []).filter(r => {
            if (!r) return false;
            const rId = (r.student_id || '').toUpperCase().replace(/\s+/g, '');
            const aId = (activeStudentId || '').toUpperCase().replace(/\s+/g, '');
            const isManish = aId === 'XYZ6A01';
            return rId === aId || (isManish && (rId === 'ABC6A01' || r.student_name === 'Manish Rawat'));
          });
          const otherReviews = currentStuReviews.filter(r => r.unit_code !== reviewFormData.unit_code);
          const currentRating = Number(reviewFormData.rating) || 5;
          const currentScore = currentRating * 2; // Strict: 1★ = 2, 5★ = 10
          const prospectiveTotalScore = otherReviews.reduce((sum, r) => sum + (Number(r.score) || 0), 0) + currentScore;
          const prospectiveCompletedCount = otherReviews.length + 1;
          const isAll6LevelsComplete = prospectiveCompletedCount >= 6;

          return (
            <form onSubmit={handleSaveReview} className="p-6 space-y-5 text-xs">
              {/* Class & Student Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 uppercase mb-1">Select Class Grade</label>
                  <select
                    value={reviewFormData.class_grade}
                    onChange={(e) => {
                      const grade = e.target.value;
                      const studentInGrade = visibleStudents.find(s => s.class_id?.includes(`-${grade}A`));
                      if (studentInGrade) {
                        handleSelectModalStudent(studentInGrade.student_id);
                      } else {
                        const unitsList = GRADE_UNITS_CONFIG[grade] || GRADE_UNITS_CONFIG['6'];
                        setReviewFormData(prev => ({
                          ...prev,
                          class_grade: grade,
                          unit_code: unitsList[0].unitCode,
                          level: unitsList[0].level,
                          unit_title: unitsList[0].title
                        }));
                      }
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
                    value={activeStudentId}
                    onChange={(e) => handleSelectModalStudent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                  >
                    {gradeStudents.map(s => (
                      <option key={s.student_id} value={s.student_id}>
                        {s.student_id} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cumulative Score & Progress Summary Banner */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 rounded-xl shadow-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Candidate Evaluation Status</span>
                    <h4 className="text-sm font-extrabold text-white">
                      {currentStu?.name || 'Selected Student'} <span className="font-mono text-pixiu-cyan text-xs font-normal">({activeStudentId})</span>
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Prospective Cumulative Score</span>
                    <span className="text-sm font-black text-amber-400">
                      🏆 {prospectiveTotalScore} / 60 pts <span className="text-xs text-slate-300 font-normal">({Math.round((prospectiveTotalScore / 60) * 100)}%)</span>
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center text-[10.5px] text-slate-300 mb-1">
                    <span>Curriculum Progression: <strong>{prospectiveCompletedCount} of 6 Units</strong> Evaluated</span>
                    {isAll6LevelsComplete ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle size={12} /> All 6 Units Complete • QR Unlocked
                      </span>
                    ) : (
                      <span className="text-amber-400 font-medium flex items-center gap-1">
                        <Lock size={12} /> {6 - prospectiveCompletedCount} Units Remaining for QR
                      </span>
                    )}
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${isAll6LevelsComplete ? 'bg-emerald-500' : 'bg-pixiu-blue'}`}
                      style={{ width: `${Math.min(100, (prospectiveCompletedCount / 6) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 6-Level Unit Selector Pills */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-2">
                  Select Unit / Level to Review (Level 0 to Level 5):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {modalUnits.map((u, idx) => {
                    const existingRev = currentStuReviews.find(r => r.unit_code === u.unitCode);
                    const isSelected = reviewFormData.unit_code === u.unitCode;
                    const isDone = !!existingRev;

                    return (
                      <button
                        key={u.unitCode}
                        type="button"
                        onClick={() => handleSelectModalUnit(u)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/90 border-pixiu-blue ring-2 ring-blue-500/20 shadow-xs'
                            : isDone
                            ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected ? 'bg-pixiu-blue text-white' : isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.unitCode} ({u.level})
                          </span>
                          {isDone ? (
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                              <CheckCircle size={10} /> {existingRev.score} pts
                            </span>
                          ) : (
                            <span className="text-[9.5px] font-medium text-slate-400">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-slate-800 mt-1 truncate" title={u.title}>
                          {u.title}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Unit Banner */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Currently Evaluating</span>
                  <p className="font-bold text-slate-800 text-xs mt-0.5">
                    {reviewFormData.unit_code} ({reviewFormData.level}): {reviewFormData.unit_title}
                  </p>
                </div>
                {editingReviewId && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                    Editing Existing Record
                  </span>
                )}
              </div>

              {/* Interactive 5-Star Rating Control (Score = Rating * 2) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-700 uppercase">
                    Competency Rating & Score *
                  </label>
                  <span className="px-2 py-0.5 bg-blue-50 text-pixiu-blue border border-blue-200 rounded font-bold text-[10px]">
                    ⚡ Formula: Score = Rating × 2 (Max 10)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  {/* Interactive 5 Stars */}
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((starNum) => {
                      const isFilled = starNum <= currentRating;
                      return (
                        <button
                          key={starNum}
                          type="button"
                          onClick={() => handleRatingChange(starNum)}
                          className="p-1 hover:scale-110 active:scale-95 transition-transform cursor-pointer focus:outline-none"
                          title={`Give ${starNum} Star${starNum > 1 ? 's' : ''} = ${starNum * 2} Points`}
                        >
                          <Star
                            size={28}
                            className={`${
                              isFilled
                                ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                                : 'text-slate-300 hover:text-amber-200'
                            } transition-colors`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Large Score Readout */}
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Assigned Score</span>
                      <span className="text-base font-extrabold text-amber-900">
                        {currentScore} / 10 pts
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Rating</span>
                      <span className="text-base font-extrabold text-slate-800">
                        {currentRating} ★
                      </span>
                    </div>
                  </div>
                </div>

                {/* Star Legend */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>1★ = 2 pts (Needs Practice)</span>
                  <span>2★ = 4 pts</span>
                  <span>3★ = 6 pts (In Progress)</span>
                  <span>4★ = 8 pts</span>
                  <span className="text-emerald-600 font-semibold">5★ = 10 pts (Mastered)</span>
                </div>
              </div>

              {/* Status Classification */}
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Status Classification</label>
                <select
                  value={reviewFormData.status}
                  onChange={(e) => setReviewFormData({ ...reviewFormData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white text-slate-800"
                >
                  <option value="Mastered">Mastered (Distinction - 8 to 10 pts)</option>
                  <option value="In Progress">In Progress (Satisfactory - 6 pts)</option>
                  <option value="Needs Practice">Needs Practice (2 to 4 pts)</option>
                </select>
              </div>

              {/* Qualitative Remarks */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-600 uppercase">Qualitative Instructor Remarks *</label>
                  <span className="text-[10px] text-slate-400">Quick Remarks Presets:</span>
                </div>

                {/* Quick Remarks Buttons */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {REVIEW_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReviewFormData({ ...reviewFormData, review: preset })}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] truncate max-w-xs cursor-pointer"
                      title={preset}
                    >
                      {preset.slice(0, 32)}...
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

              {/* ==================== STRICT GATED QR GRADUATION CERTIFICATE ==================== */}
              {isAll6LevelsComplete ? (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewFormData.issue_graduation_certificate || false}
                      onChange={(e) => setReviewFormData({ ...reviewFormData, issue_graduation_certificate: e.target.checked })}
                      className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                        🎓 Authorize & Issue Official Graduate Certificate (with QR)
                      </span>
                      <p className="text-[10.5px] text-emerald-800 mt-0.5 leading-tight">
                        All 6 Curriculum Units have been evaluated for this candidate. Checking this box permanently unlocks the official 1-time accredited certificate with public QR verification registry.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl flex items-start gap-2.5 text-slate-600">
                  <Lock size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-700 text-xs block">
                      🔒 Official Accredited Certificate with QR Locked
                    </span>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 leading-tight">
                      All 6 curriculum levels (Level 0 to Level 5) must be evaluated and completed before issuing official graduate credentials. (Currently {prospectiveCompletedCount} / 6 units evaluated).
                    </p>
                  </div>
                </div>
              )}

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
                  {editingReviewId ? 'Update Level Review' : 'Save & Publish Level Review'}
                </button>
              </div>
            </form>
          );
        })()}
  </Modal>

  {/* ==================== SCHEDULE NEXT CLASS MODAL ==================== */}
  <Modal
    isOpen={isScheduleModalOpen}
    onClose={() => setIsScheduleModalOpen(false)}
    title={
      <div>
        <span className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Bell size={18} className="text-indigo-600"/> Schedule Next Class & Notify Trainer
        </span>
        <p className="text-xs text-slate-500 font-normal mt-1">Sets up classroom session & triggers instant notification alert</p>
      </div>
    }
    size="md"
  >
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
  </Modal>

      {/* Onboard Trainer Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={
          <div>
            <span className="text-lg font-bold text-slate-800 block">Add & Onboard Robotics Trainer</span>
            <span className="text-xs text-slate-500 font-normal mt-1 block">Register instructor, assign schools, and configure salary payout</span>
          </div>
        }
        size="md"
      >
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
      </Modal>

      {/* Start Next Live Session Modal */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title={
          <div>
            <span className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Play size={16} className="text-pixiu-blue fill-pixiu-blue"/> Start Next Live Session
            </span>
            <p className="text-xs text-slate-500 font-normal mt-1">Launch a new classroom session & take live attendance</p>
          </div>
        }
        size="sm"
      >
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
