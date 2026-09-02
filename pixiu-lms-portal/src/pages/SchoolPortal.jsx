import { useState, useMemo } from 'react';
import { 
  Building2, Users, Award, BookOpen, Receipt, FileText, 
  CheckCircle2, Clock, Phone, MessageSquare, Search, Filter, 
  Download, ArrowUpRight, ShieldCheck, Sparkles, LogOut, ChevronRight,
  GraduationCap, Calendar, Check, Zap, ArrowRight
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
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
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      {/* Header - Identical to Admin Console Header */}
      <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs flex items-center">
              <img src="/img/logo.png" alt="Pixiu Tech" className="h-6 w-auto object-contain" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-pixiu-blue block leading-none">School Partner Portal</span>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight mt-0.5">
                {activeSchool.name}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin Live Switcher */}
          {(!user || user.role === 'admin' || user.school_id === 'ALL') && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs">
              <Building2 size={14} className="text-pixiu-blue" />
              <span className="text-[11px] font-bold text-slate-500 uppercase">Scope:</span>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ZPS">Zenith Public School</option>
                <option value="XYZ">XYZ Academy (Pilot Lab)</option>
              </select>
            </div>
          )}

          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Institutional Live
          </span>

          <button 
            onClick={handleLogout} 
            className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Logout"
          >
            <LogOut size={16}/>
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Institutional Intelligence Banner (Exact Dark Slate Style from Admin Dashboard) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 text-white shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-pixiu-blue/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-pixiu-blue px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                  Institutional STEM & Robotics Center
                </span>
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active Partner School
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeSchool.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Empowering students with hands-on robotics prototyping, sensor circuits, and embedded programming under the Pixiu Tech Institutional Excellence Suite.
              </p>

              <div className="flex flex-wrap gap-3 mt-4 text-xs">
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span className="text-slate-300">Principal: <b className="text-white">{activeSchool.principal_name}</b></span>
                </div>
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                  <Building2 size={14} className="text-pixiu-blue" />
                  <span className="text-slate-300">Lab: <b className="text-white">{activeSchool.lab_room}</b></span>
                </div>
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                  <Phone size={14} className="text-indigo-400" />
                  <span className="text-slate-300">Phone: <b className="text-white font-mono">{activeSchool.principal_phone}</b></span>
                </div>
              </div>
            </div>

            {/* Session Pill */}
            <div className="shrink-0 bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex items-center gap-4 shadow-inner">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-pixiu-blue">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Academic Session</div>
                <div className="text-lg font-black text-white">2026 - 2027</div>
                <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  <Check size={12} /> Term 1 In-Progress
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards (Exact Admin Style: Pure White, Slate-200 Border, Pastel Icons) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Users size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Enrolled Students</p>
              <p className="text-2xl font-bold text-slate-800">{schoolStudents.length}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">5 active grades</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Award size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Assigned Trainer</p>
              <p className="text-lg font-bold text-slate-800 truncate">{assignedTrainer.name}</p>
              <p className="text-[11px] text-indigo-600 font-bold mt-0.5 truncate">{assignedTrainer.role}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Lab Attendance</p>
              <p className="text-2xl font-bold text-emerald-600">{schoolAttendanceRate}%</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Practical lab average</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Receipt size={22} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Fee & Invoices</p>
              <p className="text-2xl font-bold text-slate-800">₹{(schoolBilling.reduce((acc, b) => acc + (b.amount || 0), 0)).toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-amber-600 font-bold mt-0.5">
                {schoolBilling.filter(b => b.status === 'Paid').length} Paid / {schoolBilling.length} Total
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation (Exact Admin Style: Pill Tabs) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'students' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users size={14} /> Student Directory & Transcripts ({schoolStudents.length})
          </button>

          <button
            onClick={() => setActiveTab('trainer')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'trainer' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Award size={14} /> Assigned Faculty Profile
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'curriculum' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen size={14} /> Syllabus & Practical Modules
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'billing' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Receipt size={14} /> Invoices & Ledger ({schoolBilling.length})
          </button>
        </div>

        {/* TAB 1: STUDENT DIRECTORY */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            {/* Filter and Search Bar (Exact Admin Students.jsx Style) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              {/* Class Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
                {['ALL', '6', '7', '8', '9', '11'].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGradeFilter(grade)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedGradeFilter === grade 
                        ? 'bg-pixiu-blue text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {grade === 'ALL' ? 'All Grades' : `Class ${grade}`}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student, ID, or kit..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-pixiu-blue focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            {/* Students Table (Exact Admin Students.jsx Table Style) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                      <th className="py-3.5 px-4">Student & Canonical ID</th>
                      <th className="py-3.5 px-4">Assigned Hardware Kit</th>
                      <th className="py-3.5 px-4">Parent Details</th>
                      <th className="py-3.5 px-4">Lab Attendance</th>
                      <th className="py-3.5 px-4">Mastery Level</th>
                      <th className="py-3.5 px-4 text-right">Official Transcript</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const att = getStudentAttendance(student.student_id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 text-sm">{student.name}</div>
                            <div className="text-[11px] text-pixiu-blue font-mono font-bold mt-0.5">{student.student_id}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-[11px] rounded-lg font-bold border border-slate-200">
                              📦 {student.assigned_kit_id || 'KIT-01'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-700 font-medium">{student.parent_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{student.parent_phone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              att >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {att}% Attendance
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-indigo-600">{student.tech_level || 'Level 0'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => handlePrintStudentPDF(e, student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pixiu-blue hover:bg-blue-600 active:scale-95 text-white font-bold rounded-lg text-xs transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
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
                        <td colSpan="6" className="py-12 text-center text-slate-400 text-xs font-medium">
                          No students found matching the selected filters.
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
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-pixiu-blue to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-md shadow-blue-500/20">
                {assignedTrainer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 px-2.5 py-0.5 bg-emerald-100 rounded-full">
                    Active Faculty In-Charge
                  </span>
                  <span className="text-xs font-bold text-amber-500">★ {assignedTrainer.rating} Faculty Rating</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{assignedTrainer.name}</h3>
                <p className="text-xs sm:text-sm text-slate-500">{assignedTrainer.role} • Pixiu Tech Academic Faculty</p>
                
                <div className="flex flex-wrap gap-2.5 mt-3">
                  <a
                    href={`tel:${assignedTrainer.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                  >
                    <Phone size={13} className="text-pixiu-blue" /> {assignedTrainer.phone}
                  </a>
                  <a
                    href={`https://wa.me/${assignedTrainer.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(assignedTrainer.name)},%20reaching%20out%20from%20${encodeURIComponent(activeSchool.name)}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs shadow-emerald-600/20"
                  >
                    <MessageSquare size={13} /> WhatsApp Faculty
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Weekly Schedule</div>
                <div className="text-base font-bold text-slate-800 mt-1">{assignedTrainer.weekly_days || 2} Days / Week</div>
                <div className="text-xs text-slate-500 mt-0.5">Laboratory Batches & Practical Sprints</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned Lab Room</div>
                <div className="text-base font-bold text-slate-800 mt-1">{activeSchool.lab_room}</div>
                <div className="text-xs text-slate-500 mt-0.5">Dedicated STEM & Hardware Suite</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Faculty Accreditation</div>
                <div className="text-base font-bold text-emerald-600 mt-1">Verified STEM Instructor</div>
                <div className="text-xs text-slate-500 mt-0.5">Certified Embedded & Robotics Engineer</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CURRICULUM & SYLLABUS */}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-800 mb-1">Institutional Syllabus Progression</h3>
              <p className="text-xs text-slate-500 mb-6">
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
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        mod.status.includes('Completed') ? 'bg-emerald-100 text-emerald-800' :
                        mod.status.includes('In Progress') ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-xs sm:text-sm">{mod.title}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{mod.unit}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        mod.status.includes('Completed') ? 'bg-emerald-100 text-emerald-800' :
                        mod.status.includes('In Progress') ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {mod.status}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{mod.sessions}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BILLING & INVOICES */}
        {activeTab === 'billing' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Institutional Billing & Invoices</h3>
              <p className="text-xs text-slate-500 mt-1">Official contractual milestone billing records for {activeSchool.name}.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Milestone Tranche</th>
                    <th className="py-3.5 px-4">Issued Date</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schoolBilling.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-pixiu-blue">{inv.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">{inv.tranche_title}</div>
                        <div className="text-[11px] text-slate-500 max-w-md truncate">{inv.description}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{inv.invoice_date || inv.date_issued}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{inv.due_date}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800 text-sm">₹{inv.amount?.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          inv.status === 'Paid' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {schoolBilling.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400 text-xs font-medium">
                        No billing invoices generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
