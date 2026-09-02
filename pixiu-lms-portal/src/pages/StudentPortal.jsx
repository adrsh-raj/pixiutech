import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { CLASS_KITS } from '../data/seedData';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';
import { 
  Award, BookOpen, Activity, FileText, Download, CheckCircle, 
  Clock, LogOut, User, Box, PlaySquare, Eye, Sparkles, Megaphone, 
  Bell, Check, X, TrendingUp, Star, ShieldCheck, CheckCircle2, ChevronRight, Send, Trash2,
  Cpu, Maximize2, Zap, Layers, Info, List, LayoutGrid, PackageCheck, MessageCircle, ShoppingBag, PhoneCall
} from 'lucide-react';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Link } from 'react-router-dom';
import Modal from '../components/ui/Modal';

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const { students, schools, content, projects, deleteProject, getStudentAttendance, notifications, curriculum, studentReviews = [], classKits = {}, inventory = [] } = useData();
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isKitDiagramModalOpen, setIsKitDiagramModalOpen] = useState(false);

  // Faculty / Admin live preview support
  const isAdminOrTrainer = user?.role === 'admin' || user?.role === 'trainer';
  const [previewStudentId, setPreviewStudentId] = useState('ZPS6A 01');

  // Resolve active student
  const activeStudentId = isAdminOrTrainer ? previewStudentId : (user?.username || user?.related_id || 'ZPS6A 01');
  const cleanId = (activeStudentId || '').trim().replace(/\s+/g, ' ');

  const student = students.find(s => (s.student_id || '').trim().replace(/\s+/g, ' ') === cleanId) || 
                  students.find(s => s.id === activeStudentId) || 
                  students[0] || {
    student_id: 'ZPS6A 01',
    name: 'Aarav Sharma',
    school_id: 'ZPS',
    tech_level: 'Level 1',
    class_id: 'CLS-ZPS-6A',
    assigned_kit_id: 'KIT-ZPS-01'
  };

  const school = schools.find(s => s.id === student.school_id)?.name || 'Zenith Public School';
  const attendanceRate = getStudentAttendance(student.student_id);
  const studentProjects = projects.filter(p => {
    if (!p || !p.student_id) return false;
    const pid = p.student_id.trim().toLowerCase().replace(/\s+/g, '');
    const currentId = (student.student_id || '').trim().toLowerCase().replace(/\s+/g, '');
    const cleanCurrent = (cleanId || '').trim().toLowerCase().replace(/\s+/g, '');
    return pid === currentId || pid === cleanCurrent || p.student_id === student.student_id;
  });
  
  // Extract grade accurately (e.g. CLS-ZPS-6A -> '6', CLS-XYZ-11A -> '11', XYZ7A 01 -> '7')
  const extractGrade = (s) => {
    if (s?.class_id) {
      const match = s.class_id.match(/CLS-(?:ZPS|XYZ)-(\d+)/i);
      if (match) return match[1];
    }
    if (s?.student_id) {
      const match = s.student_id.match(/(?:ZPS|XYZ)(\d+)/i);
      if (match) return match[1];
    }
    return '6';
  };
  const studentGrade = extractGrade(student);
  const studentKit = (classKits && classKits[studentGrade] && classKits[studentGrade]?.components?.length > 0)
    ? classKits[studentGrade]
    : (CLASS_KITS[studentGrade] || CLASS_KITS['6']);

  const whatsappNumber = '917985403186';
  const whatsappKitUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    `Hello Pixiu Tech Team! 🚀\nI am ${student.name} from Class ${studentGrade}A (Student ID: ${student.student_id}) at ${school}.\nI want to buy/order my personal STEM Robotics Hardware Kit (${studentKit.name || `Class ${studentGrade} Kit`}) at the special subsidized student discount rate (below market price).\nPlease share the discounted kit price and delivery details.`
  )}`;
  const classNotifs = (notifications || []).filter(n => {
    if (n.status === 'Archived') return false;
    if (n.target_type === 'Universal' || n.target_type === 'All_Students') return true;
    if (n.target_type === 'Specific_Class' || n.target_classes) {
      const classes = (n.target_classes || '').split(',').map(c => c.trim());
      return classes.includes(studentGrade.trim()) || classes.length === 5;
    }
    return false;
  });

  // Read / Unread State per student
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`pixiu_read_notifs_${cleanId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);

  const markAsRead = (id) => {
    const updated = Array.from(new Set([...readNotifIds, id]));
    setReadNotifIds(updated);
    try {
      localStorage.setItem(`pixiu_read_notifs_${cleanId}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const markAllAsRead = () => {
    const allIds = classNotifs.map(n => n.id);
    const updated = Array.from(new Set([...readNotifIds, ...allIds]));
    setReadNotifIds(updated);
    try {
      localStorage.setItem(`pixiu_read_notifs_${cleanId}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const unreadCount = classNotifs.filter(n => !readNotifIds.includes(n.id)).length;

  // Filter student watermarked materials for their grade
  const availableContent = content.filter(c => 
    c.target === 'Student' && (c.class_grade === studentGrade || !c.class_grade)
  );

  // 1. Attendance Progression Trend Curve (Graph 1)
  const attendanceTrendData = [
    { session: 'S1 (Aug W1)', attendance: 100, label: 'Session 1: Circuit Foundations' },
    { session: 'S2 (Aug W2)', attendance: 92, label: 'Session 2: Breadboard Logic' },
    { session: 'S3 (Aug W3)', attendance: 96, label: 'Session 3: Sensor Signal Interfacing' },
    { session: 'S4 (Aug W4)', attendance: 95, label: 'Session 4: Motor & Relay Drivers' },
    { session: 'S5 (Sep W1)', attendance: Math.min(100, attendanceRate + 2), label: 'Session 5: Microcontroller Basics' },
    { session: 'S6 (Current)', attendance: attendanceRate, label: 'Session 6: Live Hands-On Lab' },
  ];

  // 2. Dynamic End-of-Unit Reviews from Context (Sync with Trainer Live Reviews)
  const GRADE_UNITS_MAP = {
    '6': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Robotics & Electronics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Traffic Light Signal Controller' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Automatic Night Lamp' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Smart Toll Booth' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '7': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Analog & Digital Electronics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Serial Monitor' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: LED Dimmer and Mood Light' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Temperature & Humidity Monitor' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Smart Rain Alarm System' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '8': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Waves & Distance Measurement' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Sensor Libraries' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Height Measurement Station' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Smart Contactless Dustbin' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Obstacle-Avoiding Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Project Log' }
    ],
    '9': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Industrial Sensors & Displays' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Memory Architecture' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Fire Security Alarm System' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Smart 16x2 LCD Weather System' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Final Project: Line Following Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Extra Challenges & Wiring Reference' }
    ],
    '11': [
      { level: 'Level 0', unitCode: 'Unit 1', title: 'Introduction to Engineering Specs & Optics' },
      { level: 'Level 1', unitCode: 'Unit 2', title: 'The Arduino IDE & Advanced Control' },
      { level: 'Level 2', unitCode: 'Unit 3', title: 'Basic Project: Laser Security System' },
      { level: 'Level 3', unitCode: 'Unit 4', title: 'Intermediate Project: Ultrasonic Calibration' },
      { level: 'Level 4', unitCode: 'Unit 5', title: 'Capstone Project: Maze Solver Robot' },
      { level: 'Level 5', unitCode: 'Unit 6', title: 'Engineering Reference & Log' }
    ]
  };

  const DEFAULT_UNITS = GRADE_UNITS_MAP[studentGrade] || GRADE_UNITS_MAP['6'];

  const levelReviewData = useMemo(() => {
    const studentSpecificReviews = (studentReviews || []).filter(r => {
      const matchId = (r.student_id || '').trim().replace(/\s+/g, ' ') === cleanId || r.student_id === student.student_id;
      const isDummy = ['REV-001', 'REV-002', 'REV-003', 'REV-004'].includes(r.id) ||
        r.verified_date === 'Curriculum Baseline' ||
        r.review?.includes('Demonstrated exceptional understanding') ||
        r.review?.includes('Successfully calibrated analog') ||
        r.review?.includes('Accurate transistor switching') ||
        r.review?.includes('Superb conditional logic') ||
        r.review?.includes('Firmware pin modes') ||
        r.review?.includes('Integrated 2WD robotic chassis') ||
        r.review?.includes('Final autonomous exhibition');
      return matchId && !isDummy;
    });
    
    return DEFAULT_UNITS.map(unit => {
      const match = studentSpecificReviews.find(r => r.unit_code === unit.unitCode || r.level === unit.level);
      if (match) {
        return {
          hasReview: true,
          level: match.level || unit.level,
          unitCode: match.unit_code || unit.unitCode,
          title: match.unit_title || unit.title,
          score: Number(match.score) || 0,
          status: match.status || 'Mastered',
          rating: Number(match.rating) || 5,
          review: match.review || 'Demonstrated strong understanding of the module objectives.',
          instructor: match.trainer_name || 'Vikas Pandey (Lead Instructor)',
          verifiedDate: match.verified_date || 'Recent Lab Review'
        };
      }
      return {
        hasReview: false,
        level: unit.level,
        unitCode: unit.unitCode,
        title: unit.title,
        score: null,
        status: 'Pending Evaluation',
        rating: 0,
        review: 'Unit evaluation pending. Trainer will evaluate competency upon completion of this unit.',
        instructor: 'Vikas Pandey (Faculty)',
        verifiedDate: 'Awaiting Evaluation'
      };
    });
  }, [studentReviews, student.student_id, cleanId]);

  const reviewedLevelsList = useMemo(() => {
    return levelReviewData.filter(l => l.hasReview && l.score !== null);
  }, [levelReviewData]);

  const avgReviewScore = useMemo(() => {
    if (reviewedLevelsList.length === 0) return null;
    const total = reviewedLevelsList.reduce((acc, curr) => acc + curr.score, 0);
    return (total / reviewedLevelsList.length).toFixed(1);
  }, [reviewedLevelsList]);

  // Custom Chart Tooltips
  const CustomAttendanceTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-2.5 sm:p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-pixiu-blue">{label}</p>
          <p className="text-slate-300 mt-0.5 text-[11px]">{payload[0].payload.label}</p>
          <p className="text-emerald-400 font-bold mt-1">Attendance: {payload[0].value}%</p>
        </div>
      );
    }
    return null;
  };

  const CustomReviewTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-2.5 sm:p-3 rounded-xl shadow-xl text-xs border border-slate-700">
          <p className="font-bold text-emerald-400">{label}</p>
          <p className="text-slate-300 mt-0.5 text-[11px]">{payload[0].payload.title}</p>
          <p className="text-amber-400 font-bold mt-1">Review Score: {payload[0].value} / 10 ★</p>
        </div>
      );
    }
    return null;
  };

  const isGraduateCertified = student.status === 'Certified Graduate' || 
                              student.tech_level?.includes('Level 5') || 
                              student.certificate_issued === true;

  // Ultra-Professional PDF Transcript & Certificate Generator
  const handlePrintProgressReport = () => {
    generateStudentTranscriptPDF({
      student,
      school,
      attendanceRate,
      studentReviews,
      projects: studentProjects,
      curriculum,
      isOfficialCertificate: false
    });
    toast.info(`Active Laboratory Progress Report generated for ${student.name}.`, 'Progress Report PDF');
  };

  const handlePrintOfficialCertificate = () => {
    if (!isGraduateCertified) {
      toast.warning('Official QR Certificate is locked! It will be issued one-time upon Level 5 course completion and faculty authorization.', 'Certificate Locked');
      return;
    }
    generateStudentTranscriptPDF({
      student,
      school,
      attendanceRate,
      studentReviews,
      projects: studentProjects,
      curriculum,
      isOfficialCertificate: true
    });
    toast.success(`Official Accredited Graduate Certificate with QR generated for ${student.name}!`, 'Official Certificate Issued');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12 antialiased selection:bg-pixiu-blue selection:text-white">
      {/* Top Navbar */}
      <header className="bg-pixiu-dark text-white px-3.5 sm:px-8 py-2.5 sm:py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="bg-white px-2 py-1 rounded-lg sm:rounded-xl shadow-xs border border-white/20 flex items-center justify-center shrink-0">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-5 sm:h-7 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h1 className="text-sm sm:text-lg font-black tracking-wider text-white truncate">
              PIXIU TECH
            </h1>
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0">
              Class {studentGrade}A
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Notification Bell with Badge & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotifDrawerOpen(!isNotifDrawerOpen)}
              className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer border border-slate-700 flex items-center justify-center"
              title="Class Announcements & Schedule Notices"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Drawer Dropdown (Mobile Viewport Safe) */}
            {isNotifDrawerOpen && (
              <div className="fixed sm:absolute inset-x-3 top-14 sm:inset-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in zoom-in-95 text-slate-800 max-h-[80vh] flex flex-col">
                <div className="p-3.5 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Megaphone size={15} className="text-pixiu-blue shrink-0"/>
                    <h3 className="font-bold text-xs uppercase tracking-wider truncate">
                      Class Announcements ({unreadCount} Unread)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button 
                      onClick={() => setIsNotifDrawerOpen(false)} 
                      className="p-1 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X size={16}/>
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto p-3 space-y-2.5 flex-1">
                  {classNotifs.map(notif => {
                    const isRead = readNotifIds.includes(notif.id);
                    return (
                      <div 
                        key={notif.id}
                        className={`p-3 sm:p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                          isRead 
                            ? 'bg-slate-50 border-slate-200 opacity-75' 
                            : 'bg-blue-50/60 border-blue-200 shadow-xs'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            notif.severity === 'urgent' ? 'bg-rose-100 text-rose-800' :
                            notif.severity === 'important' ? 'bg-purple-100 text-purple-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {notif.severity}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{notif.date}</span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-xs">{notif.title}</h4>
                        <p className="text-slate-600 text-[11px] leading-relaxed whitespace-pre-line">{notif.message}</p>

                        <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                          <span>From: <strong>{notif.sender_name || 'Management'}</strong></span>
                          {!isRead && (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="text-pixiu-blue font-bold hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <Check size={12}/> Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {classNotifs.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No active announcements for Class {studentGrade}A.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-white leading-tight">{student.name}</p>
            <p className="text-[10px] font-mono text-pixiu-blue">{student.student_id}</p>
          </div>
          <button 
            onClick={logout} 
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
            title="Logout"
          >
            <LogOut size={14}/>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-5 sm:pt-8 space-y-4 sm:space-y-6">
        {/* Faculty / Admin Live Preview Switcher */}
        {isAdminOrTrainer && (
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border border-blue-500/40 rounded-2xl p-4 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold text-base shrink-0">
                🛡️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">Faculty & Admin Student Portal Preview</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-300 border border-blue-400/30">
                    Live Role Simulator
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">Switch student cohort to inspect their hardware kits and curriculum view:</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {[
                { grade: '6', id: 'ZPS6A 01', label: 'Class 6 (Aarav)' },
                { grade: '7', id: 'ZPS7A 01', label: 'Class 7 (Devansh)' },
                { grade: '8', id: 'ZPS8A 01', label: 'Class 8 (Siddharth)' },
                { grade: '9', id: 'ZPS9A 01', label: 'Class 9 (Arjun)' },
                { grade: '11', id: 'ZPS11A 01', label: 'Class 11 (Aryan)' }
              ].map(c => (
                <button
                  key={c.grade}
                  onClick={() => setPreviewStudentId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    previewStudentId === c.id 
                      ? 'bg-pixiu-blue text-white shadow-lg ring-2 ring-white/50 scale-105' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
              <a
                href="/"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 shadow-md ml-auto md:ml-2 transition-all flex items-center gap-1"
              >
                ⬅️ Admin Console
              </a>
            </div>
          </div>
        )}

        {/* 1. Student Profile Hero Card (Now First) */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white shadow-xl border border-slate-700/60 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-3.5 sm:gap-5 w-full md:w-auto">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-lg sm:text-2xl shrink-0">
              {student.name.split(' ').map(w => w[0]).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white truncate">{student.name}</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-slate-400 text-[11px] sm:text-xs mt-0.5 truncate">
                ID: <span className="font-mono text-pixiu-blue font-bold">{student.student_id}</span> • School: <span className="text-slate-200 font-semibold">{school}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                <span className="text-[10px] sm:text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md">
                  Class: <strong className="text-white">{studentGrade}A</strong>
                </span>
                <span className="text-[10px] sm:text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-md font-mono">
                  Kit: <strong className="text-blue-400">{student.assigned_kit_id || 'KIT-ZPS-01'}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto shrink-0">
            {/* 1. Progress Report Button: Always accessible for students to view active coursework */}
            <button 
              onClick={handlePrintProgressReport}
              className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 sm:px-4 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition-all cursor-pointer shrink-0"
              title="Download Active Laboratory Progress & Assessment Report (No QR Certificate)"
            >
              <FileText size={15} /> Progress Report
            </button>

            {/* 2. Official Certificate with QR: Unlocked only when course completed & authorized by Trainer */}
            {isGraduateCertified ? (
              <>
                <button 
                  onClick={handlePrintOfficialCertificate}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white text-xs font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer shrink-0"
                  title="Download Official Accredited Graduate Certificate with QR"
                >
                  <Award size={15} /> Official Certificate (with QR)
                </button>
                <Link
                  to={`/verify?id=${encodeURIComponent(student.student_id)}`}
                  className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 border border-emerald-500/30 transition-all shrink-0"
                  title="Public Certificate Verification Registry"
                >
                  <ShieldCheck size={15} /> Verify (QR)
                </Link>
              </>
            ) : (
              <div 
                className="w-full sm:w-auto bg-slate-800/80 text-slate-400 text-[11px] font-bold px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-1.5 border border-slate-700/80 cursor-not-allowed"
                title="Official Certificate with QR is locked. It will be issued one-time upon Level 5 course completion & faculty graduation approval."
              >
                <span className="text-amber-400">🔒</span> Certificate Locked (In-Progress)
              </div>
            )}
          </div>
        </div>

        {/* 2. 3 Metric Summary Cards (Mobile 3-column Grid) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          <div className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Mastery</p>
              <p className="text-xs sm:text-xl font-bold text-slate-800 truncate">{student.tech_level}</p>
            </div>
          </div>

          <div className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Attendance</p>
              <p className="text-xs sm:text-xl font-bold text-emerald-600">{attendanceRate}%</p>
            </div>
          </div>

          <div className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-50 text-pixiu-blue flex items-center justify-center shrink-0">
              <Box className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Lab Kit</p>
              <p className="text-[11px] sm:text-sm font-bold font-mono text-slate-800 truncate">{student.assigned_kit_id || 'KIT-ZPS-01'}</p>
            </div>
          </div>
        </div>

        {/* 3. Clean WhatsApp Your Kit Store Callout (Cheap & Below Market Price) */}
        <div className="bg-white rounded-2xl border border-emerald-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
              <MessageCircle size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                  Want to Practice Robotics at Home?
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  🏷️ Cheap & Below Market Price
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-pixiu-blue border border-blue-200">
                  Student Discount
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Buy your official <strong className="text-slate-700">Class {studentGrade} STEM Robotics Kit</strong> directly via WhatsApp at guaranteed <strong className="text-emerald-700 font-semibold">cheap & below market price</strong> (+91 7985403186).
              </p>
            </div>
          </div>

          <a
            href={whatsappKitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <MessageCircle size={15} />
            Buy at Below Market Price (+91 7985403186) →
          </a>
        </div>

        {/* ==================== 2 INTERACTIVE LINE GRAPHS ==================== */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-pixiu-blue shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider">
              Student Performance & Attendance Analytics
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Graph 1: Attendance Consistency Line Graph */}
            <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3 sm:mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">📈 Lab Attendance Consistency Curve</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500">Session-wise attendance rate throughout academic term</p>
                  </div>
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-blue-50 text-pixiu-blue border border-blue-200 shrink-0">
                    {attendanceRate}% Avg Rate
                  </span>
                </div>

                <div className="h-44 sm:h-56 w-full -ml-2 sm:ml-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="attGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0066FF" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="session" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={v => v.split(' ')[0]} />
                      <YAxis stroke="#94a3b8" fontSize={10} domain={[70, 100]} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<CustomAttendanceTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="attendance" 
                        stroke="#0066FF" 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#attGradient)" 
                        dot={{ r: 3.5, fill: '#0066FF', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 5.5, fill: '#0066FF' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500 mt-2 gap-1">
                <span>Status: <strong className="text-emerald-600">Gold Tier Regular</strong></span>
                <span>Attended: <strong className="text-slate-800">6 of 6 Labs</strong></span>
              </div>
            </div>

            {/* Graph 2: Level Progression & Review Score Line Graph */}
            <div className="bg-white p-3.5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap justify-between items-start gap-2 mb-3 sm:mb-4">
                  <div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">🚀 Level Progression & Review Rating</h4>
                    <p className="text-[10px] sm:text-xs text-slate-500">Instructor evaluation score out of 10 for each level</p>
                  </div>
                  <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold border shrink-0 ${
                    avgReviewScore ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {avgReviewScore ? `${avgReviewScore} / 10 Avg Review` : 'Awaiting Reviews'}
                  </span>
                </div>

                {reviewedLevelsList.length > 0 ? (
                  <div className="h-44 sm:h-56 w-full -ml-2 sm:ml-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reviewedLevelsList} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="level" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={v => v.replace('Level ', 'L')} />
                        <YAxis stroke="#94a3b8" fontSize={10} domain={[0, 10]} tickLine={false} tickFormatter={v => `${v}`} />
                        <Tooltip content={<CustomReviewTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#10B981" 
                          strokeWidth={2.5} 
                          fillOpacity={1} 
                          fill="url(#scoreGradient)" 
                          dot={{ r: 3.5, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 5.5, fill: '#10B981' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-44 sm:h-56 w-full flex flex-col items-center justify-center text-center p-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                    <Star size={26} className="text-amber-400/80 mb-2" />
                    <p className="font-bold text-slate-700 text-xs sm:text-sm">End-of-Unit Reviews Pending</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                      Your progression curve will appear here in real-time as your trainer logs your hands-on lab evaluations.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500 mt-2 gap-1">
                <span>Rating: <strong className={avgReviewScore ? 'text-amber-500' : 'text-slate-500'}>{avgReviewScore ? `★ ${avgReviewScore}/10 Verified` : 'Pending'}</strong></span>
                <span>Stage: <strong className="text-slate-800">{reviewedLevelsList.length} of 6 Evaluated</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== END-OF-LEVEL INSTRUCTOR REVIEWS ==================== */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-8 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="text-sm sm:text-lg font-bold text-slate-800">📝 Instructor Reviews at End of Each Level</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Verified competency feedback and technical milestone validation</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-700 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-slate-200 shrink-0">
              6 Unit Curricula
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {levelReviewData.map(l => (
              <div 
                key={l.level}
                className={`p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 ${
                  l.hasReview 
                    ? (l.status === 'Mastered' ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400' : 'border-blue-200 bg-blue-50/20 hover:border-blue-400')
                    : 'border-slate-200 bg-slate-50/60 opacity-80'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-slate-900 text-white uppercase">
                        {l.level}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {l.unitCode}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold ${
                      l.hasReview
                        ? (l.status === 'Mastered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200')
                        : 'bg-slate-200 text-slate-600'
                    }`}>
                      {l.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-xs mb-1">{l.title}</h4>
                  
                  {l.hasReview ? (
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(l.rating)].map((_, i) => (
                        <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                      ))}
                      <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 ml-1">{l.score} / 10</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mb-2 text-[10px] text-slate-400">
                      <span>☆☆☆☆☆</span>
                      <span className="italic ml-1">Pending Evaluation</span>
                    </div>
                  )}

                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed bg-white p-2.5 sm:p-3 rounded-xl border border-slate-100">
                    💬 "{l.review}"
                  </p>
                </div>

                <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  <span>Faculty: <strong>{l.instructor.split(' ')[0]}</strong></span>
                  <span>{l.verifiedDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Class Announcements & Revision Notice Feed */}
        {classNotifs.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <Megaphone size={16} className="text-pixiu-blue shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider truncate">
                  Class {studentGrade} Notices ({unreadCount} New)
                </h3>
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[11px] sm:text-xs font-bold text-pixiu-blue hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Check size={12} /> Mark All Read
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {classNotifs.map(notif => {
                const isRead = readNotifIds.includes(notif.id);
                return (
                  <div 
                    key={notif.id}
                    className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border bg-white shadow-xs space-y-2.5 sm:space-y-3 transition-all ${
                      isRead ? 'opacity-80 border-slate-200' :
                      notif.severity === 'urgent' 
                        ? 'border-rose-200 ring-2 ring-rose-100' 
                        : notif.severity === 'important' 
                        ? 'border-purple-200 ring-2 ring-purple-100' 
                        : 'border-blue-200 ring-2 ring-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                          notif.severity === 'urgent' 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                            : notif.severity === 'important' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-blue-50 text-pixiu-blue border border-blue-200'
                        }`}>
                          {notif.severity ? notif.severity.toUpperCase() : 'NOTICE'}
                        </span>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={10} /> {notif.scheduled_date} • {notif.scheduled_time}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{notif.title}</h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100 whitespace-pre-line">
                      {notif.message}
                    </p>

                    <div className="flex justify-end pt-1">
                      {isRead ? (
                        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle size={13}/> Read & Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="px-3 py-1.5 bg-pixiu-blue hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Check size={12} /> Mark as Read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Class Study Material & Workbooks (Watermarked Edition) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-8 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="text-sm sm:text-lg font-bold text-slate-800">Class {studentGrade} Robotics Study Materials & Workbooks</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Official student guides with circuit schematics and build walkthroughs</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold bg-blue-50 text-pixiu-blue border border-blue-100 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shrink-0">
              Student Edition
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {availableContent.map(item => (
              <div key={item.id} className="border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-slate-50 hover:bg-white hover:border-pixiu-blue transition-all flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[9px] uppercase">
                      Class {item.class_grade || studentGrade}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[9px]">
                      {item.level}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-0.5">{item.title}</h4>
                  <p className="text-[11px] sm:text-xs text-slate-500">{item.topic || 'Official Curriculum Module'}</p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/60">
                  <span className="text-[10px] font-mono text-slate-400">PDF Guidebook</span>
                  <a 
                    href={item.url || item.file_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-pixiu-blue hover:text-pixiu-blue rounded-lg text-xs font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Download size={13} /> View & Study
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Practical Projects & Lab Portfolio */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-8 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="text-sm sm:text-lg font-bold text-slate-800">My Lab Projects & Submissions</h3>
              <p className="text-[11px] sm:text-xs text-slate-500">Hardware prototypes and software code verified by instructor</p>
            </div>
            <span className="text-[10px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full shrink-0">
              {studentProjects.length} Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {studentProjects.map(proj => (
              <div key={proj.id} className="border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-slate-50 hover:bg-white hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3 shadow-xs">
                <div className="space-y-2.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{proj.title}</h4>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                      Score: {proj.score}/10 ★
                    </span>
                  </div>

                  {proj.image_url && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                      <img 
                        src={proj.image_url} 
                        alt={proj.title} 
                        className="w-full h-44 sm:h-52 object-cover object-center group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <span>📸 Verified Build Photo</span>
                      </div>
                    </div>
                  )}

                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed bg-white/80 p-2.5 rounded-lg border border-slate-200/60">
                    {proj.evidence_note || 'Verified hands-on hardware build completed in robotics lab.'}
                  </p>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2.5 border-t border-slate-200/60 font-mono">
                  <span className="flex items-center gap-1 text-slate-600 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {proj.status || 'Completed'}
                  </span>
                  <span>{proj.date_completed || 'Recent Lab'}</span>
                </div>
              </div>
            ))}

            {studentProjects.length === 0 && (
              <div className="col-span-2 p-6 sm:p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No individual projects submitted yet. Upcoming capstone rovers and certified builds will be logged here!
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ==================== COMPONENT INSPECTION MODAL ==================== */}
      <Modal
        isOpen={!!selectedComponent}
        onClose={() => setSelectedComponent(null)}
        title={selectedComponent ? `${selectedComponent.name} (${selectedComponent.category || 'Hardware'})` : ''}
        size="md"
      >
        {selectedComponent && (
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center max-h-56">
              <img 
                src={selectedComponent.image} 
                alt={selectedComponent.name} 
                className="max-h-56 w-full object-cover"
              />
            </div>

            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Function & Lab Role</h4>
              <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 leading-relaxed font-medium">
                {selectedComponent.role}
              </p>
            </div>

            {selectedComponent.specs && (
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Electrical & Pinout Specifications</h4>
                <p className="text-[11px] text-slate-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100 font-mono leading-relaxed">
                  {selectedComponent.specs}
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setSelectedComponent(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Close Inspection
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==================== MASTER KIT DIAGRAM MODAL ==================== */}
      <Modal
        isOpen={isKitDiagramModalOpen}
        onClose={() => setIsKitDiagramModalOpen(false)}
        title={classKits[studentGrade]?.name || `Class ${studentGrade} Kit Layout`}
        size="lg"
      >
        <div className="p-2 bg-slate-950 flex items-center justify-center rounded-2xl overflow-hidden">
          <img 
            src={classKits[studentGrade]?.overview_image || '/img/kits/class6_p2_img1_1536x1024.jpeg'} 
            alt="Kit Blueprint" 
            className="max-w-full max-h-[70vh] object-contain rounded-xl"
          />
        </div>
      </Modal>
    </div>
  );
}
