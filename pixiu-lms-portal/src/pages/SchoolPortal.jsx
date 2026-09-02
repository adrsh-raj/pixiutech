import { useState, useMemo } from 'react';
import { 
  Building2, Users, Award, BookOpen, Receipt, FileText, 
  CheckCircle2, Clock, Phone, MessageSquare, Search, Filter, 
  Download, ArrowUpRight, ShieldCheck, Sparkles, LogOut, ChevronRight,
  GraduationCap, Calendar, Check
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
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-600 selection:text-white pb-20 font-sans">
      {/* Top Header Bar - Clean White & Subtle Border */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-xs flex items-center">
            <img src="/img/logo.png" alt="Pixiu Tech" className="h-6 w-auto object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black tracking-wider text-blue-600 uppercase">School Partner Portal</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full border border-emerald-200">
                Institutional Access
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">
              {activeSchool.name}
            </h1>
          </div>
        </div>

        {/* Right Actions / Switcher */}
        <div className="flex items-center gap-3">
          {(!user || user.role === 'admin' || user.school_id === 'ALL') && (
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
              <span className="text-[10px] text-slate-500 font-bold uppercase">Switch School:</span>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer"
              >
                <option value="ZPS">Zenith Public School</option>
                <option value="XYZ">XYZ Academy (Pilot Lab)</option>
              </select>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Shell */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        
        {/* Soft Modern Institutional Hero Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/90 via-indigo-50/50 to-white border border-blue-200/70 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-blue-600" />
                <span className="text-[11px] font-black uppercase tracking-widest text-blue-700">
                  Institutional STEM & Robotics Center
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {activeSchool.name}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Empowering students with hands-on electronics, robotics prototyping, and embedded systems under the Pixiu Tech Institutional Excellence Program.
              </p>
              
              <div className="flex flex-wrap gap-2.5 mt-4 text-xs font-medium text-slate-700">
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Principal: <b className="text-slate-900">{activeSchool.principal_name}</b></span>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <Building2 size={14} className="text-blue-600" />
                  <span>Lab Room: <b className="text-slate-900">{activeSchool.lab_room}</b></span>
                </div>
                <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                  <Phone size={14} className="text-indigo-600" />
                  <span>Direct: <b className="text-slate-900 font-mono">{activeSchool.principal_phone}</b></span>
                </div>
              </div>
            </div>

            {/* Academic Session Card */}
            <div className="shrink-0 bg-white border border-blue-100 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Academic Session</div>
                <div className="text-base sm:text-lg font-black text-slate-900">2026 - 2027</div>
                <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 size={12} /> Term 1 Live In-Progress
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Clean Metric Cards (Soft Light Theme) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Enrolled Students</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{schoolStudents.length}</div>
            <div className="text-[11px] text-slate-500 mt-1">Across 5 academic classes</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assigned Faculty</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Award size={16} />
              </div>
            </div>
            <div className="text-lg font-black text-slate-900 truncate">{assignedTrainer.name}</div>
            <div className="text-[11px] text-indigo-600 font-semibold mt-1 truncate">{assignedTrainer.role}</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Lab Attendance</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{schoolAttendanceRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">Hands-on practical rate</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Fee & Invoices</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Receipt size={16} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              ₹{(schoolBilling.reduce((acc, b) => acc + (b.amount || 0), 0)).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-600 font-semibold mt-1">
              {schoolBilling.filter(b => b.status === 'Paid').length} Paid / {schoolBilling.length} Total Invoices
            </div>
          </div>
        </div>

        {/* Clean Segmented Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-1.5 sm:gap-3 overflow-x-auto pb-0">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'students' 
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70'
            }`}
          >
            <Users size={15} /> Student Directory & Transcripts ({schoolStudents.length})
          </button>

          <button
            onClick={() => setActiveTab('trainer')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'trainer' 
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70'
            }`}
          >
            <Award size={15} /> Assigned Faculty Profile
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'curriculum' 
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70'
            }`}
          >
            <BookOpen size={15} /> Syllabus & Practical Modules
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 border-b-2 ${
              activeTab === 'billing' 
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/70'
            }`}
          >
            <Receipt size={15} /> Billing & Invoices ({schoolBilling.length})
          </button>
        </div>

        {/* TAB 1: STUDENT DIRECTORY */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              {/* Grade Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {['ALL', '6', '7', '8', '9', '11'].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGradeFilter(grade)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                      selectedGradeFilter === grade 
                        ? 'bg-slate-900 text-white shadow-2xs' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {grade === 'ALL' ? 'All Classes' : `Class ${grade}`}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[260px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student, ID, or kit..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Students Table */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                      <th className="py-3.5 px-4">Student & ID</th>
                      <th className="py-3.5 px-4">Assigned Hardware Kit</th>
                      <th className="py-3.5 px-4">Parent Contact</th>
                      <th className="py-3.5 px-4">Lab Attendance</th>
                      <th className="py-3.5 px-4">Mastery Level</th>
                      <th className="py-3.5 px-4 text-right">Official Transcript</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.map((student) => {
                      const att = getStudentAttendance(student.student_id);
                      return (
                        <tr key={student.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">{student.name}</div>
                            <div className="text-[11px] text-blue-600 font-mono font-bold">{student.student_id}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px] rounded-lg font-bold">
                              📦 {student.assigned_kit_id || 'KIT-01'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-slate-700 font-semibold">{student.parent_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{student.parent_phone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              att >= 90 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {att}% Present
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-indigo-700">{student.tech_level || 'Level 0'}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => handlePrintStudentPDF(e, student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-xs shadow-blue-500/20 cursor-pointer"
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
                        <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
                          No students found matching your search.
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-md shadow-blue-500/20">
                {assignedTrainer.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
                    Active Faculty In-Charge
                  </span>
                  <span className="text-xs font-bold text-amber-500">★ {assignedTrainer.rating} Institutional Rating</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{assignedTrainer.name}</h3>
                <p className="text-sm text-slate-500 font-medium">{assignedTrainer.role} • Pixiu Tech Academic Team</p>
                
                <div className="flex flex-wrap gap-2.5 mt-3">
                  <a
                    href={`tel:${assignedTrainer.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Phone size={13} className="text-blue-600" /> {assignedTrainer.phone}
                  </a>
                  <a
                    href={`https://wa.me/${assignedTrainer.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(assignedTrainer.name)},%20reaching%20out%20from%20${encodeURIComponent(activeSchool.name)}.`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs shadow-emerald-600/20"
                  >
                    <MessageSquare size={13} /> WhatsApp Faculty
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Weekly Schedule</div>
                <div className="text-base font-bold text-slate-900 mt-1">{assignedTrainer.weekly_days || 2} Days / Week</div>
                <div className="text-xs text-slate-500 mt-0.5">Laboratory Batches & Practical Sprints</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned Lab Room</div>
                <div className="text-base font-bold text-slate-900 mt-1">{activeSchool.lab_room}</div>
                <div className="text-xs text-slate-500 mt-0.5">Dedicated STEM & Hardware Suite</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Faculty Accreditation</div>
                <div className="text-base font-bold text-emerald-600 mt-1">Verified STEM Instructor</div>
                <div className="text-xs text-slate-500 mt-0.5">Certified Embedded & Robotics Engineer</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CURRICULUM & SYLLABUS */}
        {activeTab === 'curriculum' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
              <h3 className="text-lg font-black text-slate-900 mb-1">Institutional Syllabus Progression</h3>
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
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{mod.title}</div>
                        <div className="text-[11px] text-slate-500 font-medium">{mod.unit}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        mod.status.includes('Completed') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        mod.status.includes('In Progress') ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
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
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-900">Institutional Billing & Invoices</h3>
              <p className="text-xs text-slate-500 mt-1">Official contractual milestone billing records for {activeSchool.name}.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
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
                    <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-600">{inv.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{inv.tranche_title}</div>
                        <div className="text-[11px] text-slate-500 max-w-md truncate">{inv.description}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{inv.invoice_date || inv.date_issued}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">{inv.due_date}</td>
                      <td className="py-3.5 px-4 font-black text-slate-900 text-sm">₹{inv.amount?.toLocaleString('en-IN')}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          inv.status === 'Paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {schoolBilling.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-400 text-xs">
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
