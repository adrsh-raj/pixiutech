import { useState, useMemo } from 'react';
import { 
  Building2, Users, Award, BookOpen, Receipt, FileText, 
  CheckCircle2, Clock, Phone, MessageSquare, Search, Filter, 
  Download, ArrowUpRight, ShieldCheck, Sparkles, LogOut, ChevronRight
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { generateStudentTranscriptPDF } from '../utils/transcriptGenerator';

export default function SchoolPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { 
    schools, 
    students, 
    classes, 
    trainers, 
    billing, 
    sessions, 
    attendance, 
    projects, 
    studentReviews, 
    curriculum 
  } = useData();

  // Determine active school (Scoped to school login, or selectable for admin preview)
  const defaultSchoolId = (user && user.school_id && user.school_id !== 'ALL') ? user.school_id : 'ZPS';
  const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'curriculum' | 'billing' | 'trainer'

  const activeSchool = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId) || schools[0] || {
      id: 'ZPS',
      name: 'Zenith Public School',
      code: 'ZPS',
      principal_name: 'Dr. R.K. Mishra',
      principal_phone: '+91 94151 22334',
      lab_room: 'Block B - Innovation Lab 102',
      trainer_id: 'TR-01'
    };
  }, [schools, selectedSchoolId]);

  // Filter students for this school
  const schoolStudents = useMemo(() => {
    return students.filter(s => s.school_id === activeSchool.id || s.school_id === activeSchool.code);
  }, [students, activeSchool]);

  // Assigned Trainer
  const assignedTrainer = useMemo(() => {
    return trainers.find(t => 
      t.assigned_schools === activeSchool.id || 
      t.assigned_schools === activeSchool.code ||
      t.id === activeSchool.trainer_id
    ) || {
      name: activeSchool.id === 'XYZ' ? 'Akash Sharma' : 'Vikas Pandey',
      role: activeSchool.id === 'XYZ' ? 'Senior STEM & Robotics Trainer' : 'Lead STEM & Robotics Trainer',
      phone: activeSchool.id === 'XYZ' ? '+91 94500 77882' : '+91 94500 88991',
      rating: 5.0,
      weekly_days: 2
    };
  }, [trainers, activeSchool]);

  // School Billing
  const schoolBilling = useMemo(() => {
    return billing.filter(b => b.school_id === activeSchool.id || b.school_id === activeSchool.code);
  }, [billing, activeSchool]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return schoolStudents.filter(s => {
      const matchesGrade = selectedGradeFilter === 'ALL' || (s.class_id && s.class_id.includes(selectedGradeFilter)) || s.student_id?.includes(selectedGradeFilter);
      const matchesSearch = !searchQuery || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.assigned_kit_id?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGrade && matchesSearch;
    });
  }, [schoolStudents, selectedGradeFilter, searchQuery]);

  // School Attendance Rate
  const schoolAttendanceRate = useMemo(() => {
    const schoolSessions = sessions.filter(s => s.school_id === activeSchool.id);
    const sessionIds = schoolSessions.map(s => s.id);
    const schoolAttendanceRecords = attendance.filter(a => sessionIds.includes(a.session_id));
    if (schoolAttendanceRecords.length === 0) return 96;
    const presentCount = schoolAttendanceRecords.filter(a => a.status === 'Present').length;
    return Math.round((presentCount / schoolAttendanceRecords.length) * 100);
  }, [sessions, attendance, activeSchool]);

  // Helper for student attendance
  const getStudentAttendance = (studentId) => {
    const records = attendance.filter(a => a.student_id === studentId);
    if (!records.length) return 100;
    const present = records.filter(r => r.status === 'Present').length;
    return Math.round((present / records.length) * 100);
  };

  const handlePrintStudentPDF = (e, student) => {
    e.stopPropagation();
    const attendanceRate = getStudentAttendance(student.student_id);
    generateStudentTranscriptPDF({
      student,
      school: activeSchool,
      attendanceRate,
      studentReviews,
      projects,
      curriculum
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-pixiu-blue selection:text-white pb-20">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="bg-white px-2.5 py-1 rounded-lg border border-white/20 shadow-sm flex items-center">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-6 w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider text-pixiu-blue uppercase">Partner Portal</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 font-bold rounded-full border border-emerald-500/20">
                Institutional Access
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight">
              {activeSchool.name}
            </h1>
          </div>
        </div>

        {/* Right Actions / School Switcher for Testing */}
        <div className="flex items-center gap-3">
          {/* School Switcher (Visible if Super Admin or multi-school test) */}
          {(!user || user.role === 'admin' || user.school_id === 'ALL') && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Switch:</span>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="ZPS" className="bg-slate-900 text-white">Zenith Public School</option>
                <option value="XYZ" className="bg-slate-900 text-white">XYZ Academy (Pilot Lab)</option>
              </select>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Institutional Hero Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-pixiu-blue" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Institutional STEM & Robotics Center
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeSchool.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Empowering students with hands-on electronics, robotics prototyping, and embedded systems under the Pixiu Tech Institutional Excellence Program.
              </p>
              
              <div className="flex flex-wrap gap-4 mt-4 text-xs font-medium text-slate-300">
                <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span>Principal: <b>{activeSchool.principal_name}</b></span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Building2 size={14} className="text-pixiu-blue" />
                  <span>Lab: <b>{activeSchool.lab_room}</b></span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Phone size={14} className="text-indigo-400" />
                  <span>Contact: <b>{activeSchool.principal_phone}</b></span>
                </div>
              </div>
            </div>

            {/* Quick Summary Pill */}
            <div className="shrink-0 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-inner">
              <div className="w-12 h-12 rounded-xl bg-pixiu-blue/10 border border-pixiu-blue/30 flex items-center justify-center text-pixiu-blue">
                <Sparkles size={24} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Academic Session</div>
                <div className="text-lg font-black text-white">2026 - 2027</div>
                <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={12} /> Live Term in Progress
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Key Performance Metric Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Students</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{schoolStudents.length}</div>
            <div className="text-[11px] text-slate-400 mt-1">Enrolled across 5 active grades</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Trainer</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Award size={16} />
              </div>
            </div>
            <div className="text-xl font-bold text-white truncate">{assignedTrainer.name}</div>
            <div className="text-[11px] text-indigo-400 font-medium mt-1 truncate">{assignedTrainer.role}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Lab Attendance Rate</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{schoolAttendanceRate}%</div>
            <div className="text-[11px] text-slate-400 mt-1">Institutional practical attendance</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fee & Invoices</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Receipt size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">
              ₹{(schoolBilling.reduce((acc, b) => acc + (b.amount || 0), 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-400 font-medium mt-1">
              {schoolBilling.filter(b => b.status === 'Paid').length} Paid / {schoolBilling.length} Total Invoices
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 gap-2 sm:gap-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'students' 
                ? 'bg-pixiu-blue text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900'
            }`}
          >
            <Users size={15} /> Student Directory & Transcripts ({schoolStudents.length})
          </button>

          <button
            onClick={() => setActiveTab('trainer')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'trainer' 
                ? 'bg-pixiu-blue text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900'
            }`}
          >
            <Award size={15} /> Assigned Faculty Profile
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'curriculum' 
                ? 'bg-pixiu-blue text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900'
            }`}
          >
            <BookOpen size={15} /> Syllabus & Practical Modules
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'billing' 
                ? 'bg-pixiu-blue text-white shadow-md' 
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/50 hover:bg-slate-900'
            }`}
          >
            <Receipt size={15} /> Billing & Invoices ({schoolBilling.length})
          </button>
        </div>

        {/* TAB 1: STUDENT DIRECTORY */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900 p-3.5 rounded-2xl border border-slate-800">
              {/* Class Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', '6', '7', '8', '9', '11'].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGradeFilter(grade)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                      selectedGradeFilter === grade 
                        ? 'bg-slate-800 text-white border border-slate-700' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {grade === 'ALL' ? 'All Classes' : `Class ${grade}`}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[240px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student name, ID, or kit..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pixiu-blue"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold text-[11px]">
                      <th className="py-3.5 px-4">Student & ID</th>
                      <th className="py-3.5 px-4">Assigned Kit</th>
                      <th className="py-3.5 px-4">Parent Contact</th>
                      <th className="py-3.5 px-4">Attendance</th>
                      <th className="py-3.5 px-4">Mastery Level</th>
                      <th className="py-3.5 px-4 text-right">Official Transcript</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStudents.map((student) => {
                      const att = getStudentAttendance(student.student_id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white text-sm">{student.name}</div>
                            <div className="text-[11px] text-pixiu-blue font-mono font-semibold">{student.student_id}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] rounded-lg font-bold">
                              📦 {student.assigned_kit_id || 'KIT-01'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-300 font-medium">{student.parent_name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{student.parent_phone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              att >= 90 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}>
                              {att}% Present
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-indigo-400">{student.tech_level || 'Level 0'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => handlePrintStudentPDF(e, student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pixiu-blue hover:bg-blue-600 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                            >
                              <Download size={13} />
                              <span>Download PDF</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-500 text-sm">
                          No students found matching your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ASSIGNED TRAINER PROFILE */}
        {activeTab === 'trainer' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-800">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-pixiu-blue to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-blue-500/20">
                {assignedTrainer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    Active Faculty In-Charge
                  </span>
                  <span className="text-xs font-bold text-amber-400">★ {assignedTrainer.rating} Institutional Rating</span>
                </div>
                <h3 className="text-2xl font-black text-white mt-1">{assignedTrainer.name}</h3>
                <p className="text-sm text-slate-400">{assignedTrainer.role} • Pixiu Tech Academic Team</p>
                <div className="flex flex-wrap gap-3 mt-3">
                  <a
                    href={`tel:${assignedTrainer.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Phone size={13} /> {assignedTrainer.phone}
                  </a>
                  <a
                    href={`https://wa.me/${assignedTrainer.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(assignedTrainer.name)},%20reaching%20out%20from%20${encodeURIComponent(activeSchool.name)}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <MessageSquare size={13} /> WhatsApp Faculty
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Schedule</div>
                <div className="text-base font-bold text-white mt-1">{assignedTrainer.weekly_days || 2} Days / Week</div>
                <div className="text-xs text-slate-400 mt-0.5">Laboratory Batches & Practical Sprints</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Lab Room</div>
                <div className="text-base font-bold text-white mt-1">{activeSchool.lab_room}</div>
                <div className="text-xs text-slate-400 mt-0.5">Dedicated STEM & Hardware Suite</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Faculty Accreditation</div>
                <div className="text-base font-bold text-emerald-400 mt-1">Verified STEM Instructor</div>
                <div className="text-xs text-slate-400 mt-0.5">Certified Embedded & Robotics Engineer</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CURRICULUM & SYLLABUS */}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-black text-white mb-2">Institutional Syllabus Progression</h3>
              <p className="text-xs text-slate-400 mb-6">
                Modular progression aligned with National Education Policy (NEP 2020) & Atal Tinkering Lab standards.
              </p>

              <div className="space-y-3">
                {[
                  { unit: 'Unit 1 (Level 0)', title: 'Foundations of Electronics & Robotics', status: 'Completed (Taught)', sessions: '2/2 Sessions' },
                  { unit: 'Unit 2 (Level 1)', title: 'The Arduino IDE & Serial Telemetry', status: 'In Progress (Active)', sessions: '1/2 Sessions' },
                  { unit: 'Unit 3 (Level 2)', title: 'Sensor Logic & Analog/Digital Circuits', status: 'Upcoming (Untaught)', sessions: '0/2 Sessions' },
                  { unit: 'Unit 4 (Level 3)', title: 'Actuators, Transistor Switches & Relays', status: 'Upcoming (Untaught)', sessions: '0/2 Sessions' },
                  { unit: 'Unit 5 (Level 4)', title: 'Autonomous Microcontroller Projects', status: 'Upcoming (Untaught)', sessions: '0/2 Sessions' },
                  { unit: 'Unit 6 (Level 5)', title: 'Capstone Exhibition & Project Certification', status: 'Upcoming (Untaught)', sessions: '0/2 Sessions' },
                ].map((mod, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        mod.status.includes('Completed') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        mod.status.includes('In Progress') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-white text-xs sm:text-sm">{mod.title}</div>
                        <div className="text-[11px] text-slate-400">{mod.unit}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        mod.status.includes('Completed') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        mod.status.includes('In Progress') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {mod.status}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{mod.sessions}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BILLING & INVOICES */}
        {activeTab === 'billing' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-slate-800">
              <h3 className="text-lg font-black text-white">Institutional Billing & Invoices</h3>
              <p className="text-xs text-slate-400 mt-1">Official contractual milestone billing records for {activeSchool.name}.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-bold text-[11px]">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Milestone Tranche</th>
                    <th className="py-3.5 px-4">Issued Date</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {schoolBilling.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-pixiu-blue">{inv.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{inv.tranche_title}</div>
                        <div className="text-[11px] text-slate-400 max-w-md truncate">{inv.description}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">{inv.invoice_date || inv.date_issued}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">{inv.due_date}</td>
                      <td className="py-3.5 px-4 font-bold text-white text-sm">₹{inv.amount?.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          inv.status === 'Paid' 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {schoolBilling.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500 text-sm">
                        No billing invoices generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
