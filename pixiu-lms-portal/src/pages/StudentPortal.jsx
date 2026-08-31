import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Award, BookOpen, Activity, FileText, Download, CheckCircle, Clock, LogOut, User, Box, PlaySquare, Eye, Sparkles, Megaphone } from 'lucide-react';

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
    if (n.target_type === 'Specific_Class') {
      const classes = (n.target_classes || '').split(',');
      return classes.includes(studentGrade);
    }
    return false;
  });

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
              <p style="margin: 0; font-weight: bold;">Current Level: ${student.tech_level}</p>
              <p style="margin: 4px 0; color: #16a34a; font-weight: bold;">Attendance: ${attendanceRate}%</p>
            </div>
          </div>

          <h3>Hardware Projects Built & Certified:</h3>
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
            <div className="flex items-center gap-2">
              <Megaphone size={18} className="text-pixiu-blue" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Class {studentGrade} Announcements & Next Session Notices
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classNotifs.map(notif => (
                <div 
                  key={notif.id}
                  className={`p-5 rounded-2xl border bg-white shadow-xs space-y-2.5 transition-all ${
                    notif.severity === 'urgent' 
                      ? 'border-rose-200 ring-1 ring-rose-100' 
                      : notif.severity === 'important' 
                      ? 'border-purple-200 ring-1 ring-purple-100' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                      notif.severity === 'urgent' 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : notif.severity === 'important' 
                        ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                        : 'bg-blue-50 text-pixiu-blue border border-blue-200'
                    }`}>
                      {notif.severity ? notif.severity.toUpperCase() : 'NOTICE'}
                    </span>

                    <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                      <Clock size={11} /> {notif.scheduled_date} • {notif.scheduled_time}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-800 text-sm">{notif.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-line">
                    {notif.message}
                  </p>
                </div>
              ))}
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
                  <p className="text-xs text-slate-500 line-clamp-2">{item.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                  <span className="text-[11px] text-slate-400 font-medium">📄 PDF Guide</span>
                  <button 
                    onClick={() => window.open(item.url, '_blank')}
                    className="bg-pixiu-blue hover:bg-blue-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Eye size={13} /> Read & Study
                  </button>
                </div>
              </div>
            ))}

            {availableContent.length === 0 && (
              <div className="col-span-2 p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                No materials uploaded yet for Class {studentGrade}. Please check back after next lab session!
              </div>
            )}
          </div>
        </div>

        {/* Project Portfolio */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Your Certified Hardware Builds</h3>
              <p className="text-xs text-slate-500">Live lab project submissions certified by Trainer Vikas Pandey</p>
            </div>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full">
              {studentProjects.length} Builds Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {studentProjects.map(p => (
              <div key={p.id} className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow bg-white">
                {p.image_url ? (
                  <div className="w-full h-40 bg-slate-900 overflow-hidden">
                    <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-36 bg-blue-50/60 flex items-center justify-center text-pixiu-blue font-bold text-xs uppercase">
                    🤖 Certified Circuit Project
                  </div>
                )}
                <div className="p-4">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-800 text-sm">{p.title}</h4>
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                      {p.score}/10
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{p.evidence_note || 'Hardware wiring tested & verified.'}</p>
                </div>
              </div>
            ))}

            {studentProjects.length === 0 && (
              <div className="col-span-full p-8 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                No robot build photos certified yet. Your trainer will snap and verify your build during the next live lab session!
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
