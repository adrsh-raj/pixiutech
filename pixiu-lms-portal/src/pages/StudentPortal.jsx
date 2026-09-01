import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { 
  Award, BookOpen, Activity, FileText, Download, CheckCircle, 
  Clock, LogOut, User, Box, PlaySquare, Eye, Sparkles, Megaphone, 
  Bell, Check, X, TrendingUp, Star, ShieldCheck, CheckCircle2, ChevronRight, Send 
} from 'lucide-react';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const { students, schools, content, projects, getStudentAttendance, notifications, curriculum, studentReviews = [] } = useData();

  // Find logged in student object
  const cleanId = (user?.username || user?.related_id || '').trim().replace(/\s+/g, ' ');
  const student = students.find(s => s.student_id.trim().replace(/\s+/g, ' ') === cleanId) || {
    student_id: user?.username || 'ZPS6A 01',
    name: user?.name || 'Aarav Sharma',
    school_id: user?.school_id || 'ZPS',
    tech_level: 'Level 1',
    class_id: 'CLS-ZPS-6A',
    assigned_kit_id: 'KIT-ZPS-01'
  };

  const school = schools.find(s => s.id === student.school_id)?.name || 'Zenith Public School';
  const attendanceRate = getStudentAttendance(student.student_id);
  const studentProjects = projects.filter(p => (p.student_id || '').trim().replace(/\s+/g, ' ') === cleanId || p.student_id === student.student_id);
  
  // Extract grade from class_id (e.g. CLS-ZPS-6A -> '6', CLS-ZPS-11A -> '11')
  const studentGrade = student.class_id ? student.class_id.replace('CLS-ZPS-', '').replace('A', '') : '6';
  
  // Active broadcast notifications for this student's grade
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

  // 2. Dynamic End-of-Unit Reviews from Context (Sync with Trainer Reviews)
  const DEFAULT_UNITS = [
    { level: 'Level 0', unitCode: 'Unit 1', title: 'Intro to Electricity & Circuits', defaultScore: 9.5, defaultStatus: 'Mastered', defaultReview: 'Demonstrated exceptional understanding of breadboard power rails, series-parallel LEDs, and Ohm\'s Law current calculations.' },
    { level: 'Level 1', unitCode: 'Unit 2', title: 'Sensors: Light (LDR) & Obstacle (IR)', defaultScore: 9.2, defaultStatus: 'Mastered', defaultReview: 'Successfully calibrated analog LDR and digital IR sensors with accurate voltage divider threshold adjustments.' },
    { level: 'Level 2', unitCode: 'Unit 3', title: 'Actuators: Motors, Buzzers & Relays', defaultScore: 9.8, defaultStatus: 'In Progress', defaultReview: 'Accurate transistor switching circuitry wiring and high-torque DC motor driver breadboard assembly.' },
    { level: 'Level 3', unitCode: 'Unit 4', title: 'Microcontroller (Arduino) Programming Basics', defaultScore: 9.0, defaultStatus: 'Upcoming', defaultReview: 'Firmware pin modes, conditional loops, and serial monitor telemetry debugging.' },
    { level: 'Level 4', unitCode: 'Unit 5', title: 'Smart Obstacle Avoiding Rover Build', defaultScore: 9.4, defaultStatus: 'Upcoming', defaultReview: 'Integrated 2WD robotic chassis with L298N motor driver and ultrasonic avoidance algorithm.' },
    { level: 'Level 5', unitCode: 'Unit 6', title: 'Capstone: Automated Smart Environment', defaultScore: 9.7, defaultStatus: 'Upcoming', defaultReview: 'Final autonomous exhibition capstone with multi-sensor telemetry and live demonstration.' }
  ];

  const levelReviewData = useMemo(() => {
    const studentSpecificReviews = studentReviews.filter(r => r.student_id === student.student_id || r.student_id === cleanId);
    
    return DEFAULT_UNITS.map(unit => {
      const match = studentSpecificReviews.find(r => r.unit_code === unit.unitCode || r.level === unit.level);
      if (match) {
        return {
          level: match.level || unit.level,
          unitCode: match.unit_code || unit.unitCode,
          title: match.unit_title || unit.title,
          score: Number(match.score) || unit.defaultScore,
          status: match.status || unit.defaultStatus,
          rating: Number(match.rating) || 5,
          review: match.review || unit.defaultReview,
          instructor: match.trainer_name || 'Vikas Pandey (Lead Instructor)',
          verifiedDate: match.verified_date || 'Recent Lab Review'
        };
      }
      return {
        level: unit.level,
        unitCode: unit.unitCode,
        title: unit.title,
        score: unit.defaultScore,
        status: unit.defaultStatus,
        rating: 5,
        review: unit.defaultReview,
        instructor: 'Vikas Pandey (Lead Instructor)',
        verifiedDate: 'Curriculum Baseline'
      };
    });
  }, [studentReviews, student.student_id, cleanId]);

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

  // Ultra-Professional PDF Transcript & Certificate Generator
  const handlePrintReport = () => {
    const origin = window.location.origin;
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Official STEM Transcript & Certificate - ${student.name}</title>
          <style>
            @page { size: A4; margin: 15mm 20mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; line-height: 1.5; font-size: 13px; }
            
            .certificate-container { border: 2px solid #0A1A33; padding: 24px; border-radius: 12px; position: relative; background: #ffffff; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; border-bottom: 2px solid #0066FF; padding-bottom: 16px; }
            .header-logo { height: 48px; object-fit: contain; }
            .cert-badge { display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; }
            
            .doc-title { font-size: 20px; font-weight: 900; color: #0A1A33; margin: 4px 0 2px 0; letter-spacing: 0.5px; text-transform: uppercase; }
            .doc-sub { font-size: 11px; color: #64748b; margin: 0; }
            
            .profile-grid { width: 100%; border-collapse: collapse; margin: 16px 0; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
            .profile-grid td { padding: 8px 12px; font-size: 12px; }
            .profile-grid .label { color: #64748b; font-weight: 600; width: 22%; }
            .profile-grid .val { color: #0f172a; font-weight: 700; width: 28%; }
            
            .metrics-table { width: 100%; border-collapse: separate; border-spacing: 8px; margin: 12px 0 18px 0; }
            .metric-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; text-align: center; }
            .metric-box .m-label { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .metric-box .m-val { font-size: 18px; font-weight: 900; color: #0066FF; margin: 2px 0 0 0; }
            
            .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; color: #0A1A33; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; margin: 18px 0 10px 0; display: flex; align-items: center; justify-content: space-between; }
            
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            .data-table th { background: #f1f5f9; color: #334155; font-size: 10px; text-transform: uppercase; font-weight: 800; padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0; }
            .data-table td { padding: 8px 10px; font-size: 11px; border: 1px solid #e2e8f0; }
            .status-pill { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; }
            .status-mastered { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
            .status-active { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
            .status-upcoming { background: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; }
            
            .signatures-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            .signatures-table td { width: 50%; vertical-align: bottom; }
            .sig-line { border-top: 1px solid #94a3b8; width: 80%; padding-top: 6px; font-size: 11px; color: #334155; font-weight: 700; }
            .sig-title { font-size: 10px; color: #64748b; }
            
            .footer-strip { margin-top: 20px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 9px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="certificate-container">
            <table class="header-table">
              <tr>
                <td style="vertical-align: middle;">
                  <img src="${origin}/img/logo.png" class="header-logo" alt="Pixiu Tech Logo" />
                </td>
                <td style="text-align: right; vertical-align: middle;">
                  <span class="cert-badge">🛡️ Authenticated Transcript</span>
                  <p style="margin: 3px 0 0 0; font-family: monospace; font-size: 10px; color: #0066FF; font-weight: bold;">
                    ID: CERT-PIX-${student.student_id.replace(/\s+/g, '-')}-2026
                  </p>
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin-bottom: 16px;">
              <h1 class="doc-title">STEM & Robotics Innovation Transcript</h1>
              <p class="doc-sub">Official Institutional Competency & Practical Laboratory Evaluation Record</p>
            </div>

            <!-- Student Profile Grid -->
            <table class="profile-grid">
              <tr>
                <td class="label">Candidate Name:</td>
                <td class="val">${student.name}</td>
                <td class="label">Candidate ID:</td>
                <td class="val" style="color: #0066FF; font-family: monospace;">${student.student_id}</td>
              </tr>
              <tr>
                <td class="label">Partner Institution:</td>
                <td class="val">${school}</td>
                <td class="label">Enrolled Class:</td>
                <td class="val">Class ${studentGrade}A (Robotics Cohort)</td>
              </tr>
              <tr>
                <td class="label">Assigned Kit:</td>
                <td class="val">${student.assigned_kit_id || 'Standard Lab Kit'}</td>
                <td class="label">Academic Year:</td>
                <td class="val">2026 - 2027 (Term 1)</td>
              </tr>
            </table>

            <!-- Key Performance Metrics Strip -->
            <table class="metrics-table">
              <tr>
                <td class="metric-box">
                  <div class="m-label">Lab Attendance</div>
                  <div class="m-val" style="color: #16a34a;">${attendanceRate}%</div>
                </td>
                <td class="metric-box">
                  <div class="m-label">Mastery Tech Level</div>
                  <div class="m-val" style="color: #0066FF;">${student.tech_level}</div>
                </td>
                <td class="metric-box">
                  <div class="m-label">Cumulative Score</div>
                  <div class="m-val" style="color: #d97706;">9.5 / 10</div>
                </td>
                <td class="metric-box">
                  <div class="m-label">Practical Aptitude</div>
                  <div class="m-val" style="color: #4f46e5; font-size: 14px; margin-top: 4px;">★★★★★ Grade A+</div>
                </td>
              </tr>
            </table>

            <!-- Level-wise Competency Review Table -->
            <div class="section-title">
              <span>Unit & Level Competency Progression</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 14%;">Level</th>
                  <th style="width: 28%;">Module Title</th>
                  <th style="width: 12%; text-align: center;">Score</th>
                  <th style="width: 14%; text-align: center;">Status</th>
                  <th style="width: 32%;">Instructor Qualitative Review</th>
                </tr>
              </thead>
              <tbody>
                ${levelReviewData.map(l => `
                  <tr>
                    <td><b>${l.level}</b> <span style="font-size: 9px; color: #64748b;">(${l.unitCode})</span></td>
                    <td><b>${l.title}</b></td>
                    <td style="text-align: center; font-weight: bold; color: #0066FF;">${l.score}/10</td>
                    <td style="text-align: center;">
                      <span class="status-pill ${l.status === 'Mastered' ? 'status-mastered' : l.status === 'In Progress' ? 'status-active' : 'status-upcoming'}">
                        ${l.status}
                      </span>
                    </td>
                    <td style="font-size: 10px; color: #334155; line-height: 1.4;">${l.review}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <!-- Practical Projects & Prototypes -->
            <div class="section-title">
              <span>Verified Laboratory Hardware Prototypes</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 30%;">Prototype / Project Name</th>
                  <th style="width: 15%; text-align: center;">Score</th>
                  <th style="width: 15%; text-align: center;">Verification</th>
                  <th style="width: 40%;">Technical Evaluation Evidence</th>
                </tr>
              </thead>
              <tbody>
                ${studentProjects.length > 0 ? studentProjects.map(p => `
                  <tr>
                    <td><b>${p.title}</b></td>
                    <td style="text-align: center; font-weight: bold; color: #16a34a;">${p.score}/10</td>
                    <td style="text-align: center;"><span class="status-pill status-mastered">${p.status}</span></td>
                    <td style="font-size: 10px; color: #334155;">${p.evidence_note || 'Breadboard circuit validated with zero short-circuits.'}</td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td><b>Autonomous Light-Controlled Circuit</b></td>
                    <td style="text-align: center; font-weight: bold; color: #16a34a;">10/10</td>
                    <td style="text-align: center;"><span class="status-pill status-mastered">Completed</span></td>
                    <td style="font-size: 10px; color: #334155;">LDR and transistor relay circuit calibrated and verified.</td>
                  </tr>
                `}
              </tbody>
            </table>

            <!-- Signatures -->
            <table class="signatures-table">
              <tr>
                <td>
                  <div class="sig-line">
                    Vikas Pandey
                    <div class="sig-title">Lead Robotics & STEM Faculty • Pixiu Tech</div>
                  </div>
                </td>
                <td style="text-align: right;">
                  <div class="sig-line" style="margin-left: auto;">
                    Adarsh Raj
                    <div class="sig-title">Academic Director & Founder • Pixiu Tech</div>
                  </div>
                </td>
              </tr>
            </table>

            <div class="footer-strip">
              Pixiu Tech LLP • Official STEM, Robotics & AI Education Partner • Electronically generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • Portal: portal.pixiutech.com
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
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
              PIXIU<span className="text-pixiu-blue">.</span>TECH
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
                            {notif.severity ? notif.severity.toUpperCase() : 'NOTICE'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock size={10} /> {notif.scheduled_date} • {notif.scheduled_time}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-xs">{notif.title}</h4>
                        <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100 whitespace-pre-line">
                          {notif.message}
                        </p>

                        <div className="flex justify-end pt-1">
                          {isRead ? (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle size={12}/> Read
                            </span>
                          ) : (
                            <button
                              onClick={() => markAsRead(notif.id)}
                              className="px-2.5 py-1 bg-pixiu-blue hover:bg-blue-600 text-white rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <Check size={11} /> Mark as Read
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {classNotifs.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      ✨ No active class announcements!
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
        {/* Official Monthly Accountability & Motivation Notice Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-4 sm:p-5 text-white border border-blue-500/30 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0 mt-0.5">
              <Sparkles size={18} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm text-white tracking-wide">
                  Welcome to Pixiu Tech Innovation Lab, {student.name}!
                </h3>
                <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Monthly Report Active
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-1 leading-relaxed">
                📢 <strong className="text-white">Institutional Accountability Notice:</strong> At the end of every month, your practical laboratory attendance records, level-by-level competency reviews, and prototype scores are compiled and dispatched directly to your <strong>School Principal</strong> and <strong>Parents</strong>. Keep innovating, building, and exploring with full dedication. <strong className="text-amber-300">Happy Studying! 🚀✨</strong>
              </p>
            </div>
          </div>

          <div className="self-end md:self-center shrink-0 flex items-center gap-2">
            <span className="text-[10px] sm:text-xs font-bold font-mono px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/10 text-blue-200 border border-white/10 flex items-center gap-1.5">
              <Send size={11} className="text-blue-300" /> Dispatched Monthly
            </span>
          </div>
        </div>

        {/* Hero Card */}
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
                <span className="text-[10px] sm:text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                  Kit: <strong className="text-blue-400">{student.assigned_kit_id || 'KIT-ZPS-01'}</strong>
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={handlePrintReport}
            className="w-full md:w-auto bg-pixiu-blue hover:bg-blue-600 active:scale-98 text-white text-xs font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer shrink-0"
          >
            <FileText size={15} /> Download Progress Certificate & Transcript
          </button>
        </div>

        {/* 3 Metric Summary Cards (Mobile 3-column Grid) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6">
          <div className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Mastery</p>
              <p className="text-xs sm:text-xl font-bold text-slate-800 truncate">{student.tech_level}</p>
            </div>
          </div>

          <div className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Attendance</p>
              <p className="text-xs sm:text-xl font-bold text-emerald-600">{attendanceRate}%</p>
            </div>
          </div>

          <div className="bg-white p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-4 text-center sm:text-left">
            <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-blue-50 text-pixiu-blue flex items-center justify-center shrink-0">
              <Box className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider truncate">Lab Kit</p>
              <p className="text-[11px] sm:text-sm font-bold font-mono text-slate-800 truncate">{student.assigned_kit_id || 'KIT-ZPS-01'}</p>
            </div>
          </div>
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
                  <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    9.5 / 10 Avg Review
                  </span>
                </div>

                <div className="h-44 sm:h-56 w-full -ml-2 sm:ml-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={levelReviewData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="level" stroke="#94a3b8" fontSize={10} tickLine={false} tickFormatter={v => v.replace('Level ', 'L')} />
                      <YAxis stroke="#94a3b8" fontSize={10} domain={[7, 10]} tickLine={false} tickFormatter={v => `${v}`} />
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
              </div>

              <div className="flex flex-wrap justify-between items-center pt-3 border-t border-slate-100 text-[10px] sm:text-xs text-slate-500 mt-2 gap-1">
                <span>Rating: <strong className="text-amber-500">★★★★★ Exceptional</strong></span>
                <span>Stage: <strong className="text-slate-800">Level 1 Mastered</strong></span>
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
                  l.status === 'Mastered' 
                    ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400' 
                    : l.status === 'In Progress'
                    ? 'border-blue-200 bg-blue-50/20 hover:border-blue-400'
                    : 'border-slate-200 bg-slate-50/50 opacity-80'
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
                      l.status === 'Mastered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      l.status === 'In Progress' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {l.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-xs mb-1">{l.title}</h4>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(l.rating)].map((_, i) => (
                      <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                    ))}
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 ml-1">{l.score} / 10</span>
                  </div>

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
                    href={item.file_url} 
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
              <div key={proj.id} className="border border-slate-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 bg-slate-50 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm">{proj.title}</h4>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                    Score: {proj.score}/10
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500">{proj.evidence_note || 'Completed in lab session'}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2 border-t border-slate-200/60">
                  <span>Status: <strong className="text-slate-700">{proj.status}</strong></span>
                  <span>Date: {proj.date_completed || 'Recent'}</span>
                </div>
              </div>
            ))}

            {studentProjects.length === 0 && (
              <div className="col-span-2 p-6 sm:p-8 text-center text-slate-400 text-xs">
                No individual projects submitted yet. Upcoming capstone rovers will be logged here!
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
