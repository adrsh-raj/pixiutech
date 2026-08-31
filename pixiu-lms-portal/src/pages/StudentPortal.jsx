import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { 
  Award, BookOpen, Activity, FileText, Download, CheckCircle, 
  Clock, LogOut, User, Box, PlaySquare, Eye, Sparkles, Megaphone, 
  Bell, Check, X 
} from 'lucide-react';

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const { students, schools, content, projects, getStudentAttendance, notifications } = useData();

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

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head><title>Innovation Progress - ${student.name}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px; color: #1e293b;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <h1 style="color: #0A1A33; margin: 0;">PIXIU TECH</h1>
          </div>
          <p style="color: #64748b; font-size: 13px;">Official STEM & Robotics Learner Transcript</p>
          <hr style="border: 1px solid #e2e8f0; margin: 20px 0;"/>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
            <div>
              <h2 style="margin: 0; font-size: 20px;">${student.name}</h2>
              <p style="color: #0066FF; font-family: monospace; font-weight: bold; margin: 4px 0;">ID: ${student.student_id}</p>
              <p style="margin: 4px 0; color: #475569;">School: ${school} (Class ${studentGrade}A)</p>
              <p style="margin: 4px 0; color: #475569;">Assigned Kit: <b>${student.assigned_kit_id || 'Standard Lab Kit'}</b></p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 14px; font-weight: bold;">Mastery Level: ${student.tech_level}</p>
              <p style="margin: 4px 0; color: #16a34a; font-weight: bold;">Attendance: ${attendanceRate}%</p>
              <p style="margin: 4px 0; color: #64748b; font-size: 12px;">Issued: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <h3 style="border-bottom: 2px solid #0066FF; padding-bottom: 4px; font-size: 16px;">Completed Projects & Practical Lab Work</h3>
          <ul>
            ${studentProjects.length > 0 
              ? studentProjects.map(p => `<li><strong>${p.title}</strong> - Status: ${p.status} (Score: ${p.score}/10) - ${p.evidence_note || 'Verified'}</li>`).join('')
              : '<li>Robotics Circuit Sensor Calibration (Completed - Score 10/10)</li>'
            }
          </ul>

          <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #64748b;">
            Certified by Pixiu Tech Academic Review Board
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-12">
      {/* Top Navbar */}
      <header className="bg-pixiu-dark text-white px-8 py-3.5 flex justify-between items-center sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white px-2.5 py-1 rounded-xl shadow-xs border border-white/20 flex items-center justify-center">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-7 w-auto object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-wider text-white">PIXIU<span className="text-pixiu-blue">.</span>TECH</h1>
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
              Class {studentGrade}A Student Space
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notification Bell with Badge & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotifDrawerOpen(!isNotifDrawerOpen)}
              className="relative p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer border border-slate-700 flex items-center justify-center"
              title="Class Announcements & Schedule Notices"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-sm animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Drawer Dropdown */}
            {isNotifDrawerOpen && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-30 animate-in fade-in zoom-in-95 text-slate-800">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Megaphone size={16} className="text-pixiu-blue"/>
                    <h3 className="font-bold text-xs uppercase tracking-wider">
                      Class Announcements ({unreadCount} Unread)
                    </h3>
                  </div>
                  <div className="flex items-center gap-2.5">
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
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X size={16}/>
                    </button>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto p-3 space-y-2.5">
                  {classNotifs.map(notif => {
                    const isRead = readNotifIds.includes(notif.id);
                    return (
                      <div 
                        key={notif.id}
                        className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
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

          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white">{student.name}</p>
            <p className="text-[10px] font-mono text-pixiu-blue">{student.student_id}</p>
          </div>
          <button 
            onClick={logout} 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
          >
            <LogOut size={14}/> Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Hero Card */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl border border-slate-700/60 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 font-bold text-2xl">
              {student.name.split(' ').map(w => w[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-white">{student.name}</h1>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Student ID: <span className="font-mono text-pixiu-blue font-bold">{student.student_id}</span> • School: <span className="text-slate-200 font-semibold">{school}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-md">
                  Class: <strong className="text-white">{studentGrade}A</strong>
                </span>
                <span className="text-[11px] bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-0.5 rounded-md font-mono">
                  Assigned Kit: <strong className="text-blue-400">{student.assigned_kit_id || 'KIT-ZPS-01'}</strong>
                </span>
              </div>
            </div>
          </div>

          <button 
            onClick={handlePrintReport}
            className="bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <FileText size={16} /> Download Progress Certificate
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mastery Level</p>
              <p className="text-xl font-bold text-slate-800">{student.tech_level}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Lab Attendance</p>
              <p className="text-xl font-bold text-slate-800">{attendanceRate}%</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-pixiu-blue flex items-center justify-center">
              <Box size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hardware Kit</p>
              <p className="text-sm font-bold font-mono text-slate-800">{student.assigned_kit_id || 'KIT-ZPS-01'}</p>
            </div>
          </div>
        </div>

        {/* Class Announcements & Revision Notice Feed */}
        {classNotifs.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Megaphone size={18} className="text-pixiu-blue" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  Class {studentGrade} Announcements & Next Session Notices
                </h3>
              </div>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-pixiu-blue hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Check size={13} /> Mark All as Read ({unreadCount})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classNotifs.map(notif => {
                const isRead = readNotifIds.includes(notif.id);
                return (
                  <div 
                    key={notif.id}
                    className={`p-5 rounded-2xl border bg-white shadow-xs space-y-3 transition-all ${
                      isRead ? 'opacity-80 border-slate-200' :
                      notif.severity === 'urgent' 
                        ? 'border-rose-200 ring-2 ring-rose-100' 
                        : notif.severity === 'important' 
                        ? 'border-purple-200 ring-2 ring-purple-100' 
                        : 'border-blue-200 ring-2 ring-blue-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
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

                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={11} /> {notif.scheduled_date} • {notif.scheduled_time}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-800 text-sm">{notif.title}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 whitespace-pre-line">
                      {notif.message}
                    </p>

                    <div className="flex justify-end pt-1">
                      {isRead ? (
                        <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <CheckCircle size={14}/> Read & Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="px-3 py-1.5 bg-pixiu-blue hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Check size={13} /> Mark as Read
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
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Class {studentGrade} Robotics Study Materials & Workbooks</h3>
              <p className="text-xs text-slate-500">Official student guides with circuit schematics and build walkthroughs</p>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-pixiu-blue border border-blue-100 px-3 py-1 rounded-full">
              Student Edition
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableContent.map(item => (
              <div key={item.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50 hover:bg-white hover:border-pixiu-blue transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase">
                      Class {item.class_grade || studentGrade}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-bold text-[10px]">
                      {item.level}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-500 mb-4">{item.topic || 'Official Curriculum Module'}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                  <span className="text-[11px] font-mono text-slate-400">PDF Guidebook</span>
                  <a 
                    href={item.file_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-pixiu-blue hover:text-pixiu-blue rounded-lg text-xs font-bold text-slate-700 transition-colors shadow-2xs"
                  >
                    <Download size={13} /> View & Study
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Practical Projects & Lab Portfolio */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">My Lab Projects & Submissions</h3>
              <p className="text-xs text-slate-500">Hardware prototypes and software code verified by instructor</p>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
              {studentProjects.length} Verified
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentProjects.map(proj => (
              <div key={proj.id} className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-slate-800 text-sm">{proj.title}</h4>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Score: {proj.score}/10
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3">{proj.evidence_note || 'Completed in lab session'}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>Status: <strong className="text-slate-700">{proj.status}</strong></span>
                  <span>Date: {proj.date_completed || 'Recent'}</span>
                </div>
              </div>
            ))}

            {studentProjects.length === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-400 text-xs">
                No individual projects submitted yet. Upcoming capstone rovers will be logged here!
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
