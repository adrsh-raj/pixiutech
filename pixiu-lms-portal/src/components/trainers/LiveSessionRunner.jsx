import { useState, useMemo } from 'react';
import { 
  Play, CheckCircle, Clock, CheckSquare, XSquare, 
  Camera, Star, Award, BookOpen, AlertCircle, Sparkles, Building2, User, ChevronRight, Lock, Unlock,
  Calendar, History, Eye, ArrowLeft
} from 'lucide-react';
import Badge from '../ui/Badge';
import { useToast } from '../../context/ToastContext';

export default function LiveSessionRunner({
  sessions = [],
  classes = [],
  students = [],
  attendance = [],
  markAttendance,
  completeSession,
  unlockSession,
  startNewSession,
  onOpenEvidenceModal,
  onOpenReviewModal,
  currentTrainer,
  schools = [],
  isAdmin = false
}) {
  const toast = useToast();

  // Primary active school based on trainer
  const trainerSchoolId = currentTrainer?.assigned_schools?.includes('XYZ') || currentTrainer?.id === 'TR-02' 
    ? 'XYZ' 
    : 'ZPS';

  const relevantClasses = useMemo(() => {
    return classes.filter(c => c.school_id === trainerSchoolId || !c.school_id);
  }, [classes, trainerSchoolId]);

  const [selectedClassId, setSelectedClassId] = useState(relevantClasses[0]?.id || `CLS-${trainerSchoolId}-6A`);
  const [activeSessionIdOverride, setActiveSessionIdOverride] = useState(null);
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'history'
  const [historyGradeFilter, setHistoryGradeFilter] = useState('All');

  // Relevant sessions for current school
  const schoolSessions = useMemo(() => {
    return sessions.filter(s => s.school_id === trainerSchoolId || !s.school_id);
  }, [sessions, trainerSchoolId]);

  // Active session determination
  const activeSession = useMemo(() => {
    if (activeSessionIdOverride) {
      const found = schoolSessions.find(s => s.id === activeSessionIdOverride);
      if (found) return found;
    }
    return schoolSessions.find(s => s.class_id === selectedClassId) || {
      id: `SES-${selectedClassId}`,
      class_id: selectedClassId,
      school_id: trainerSchoolId,
      unit_code: 'Unit 2',
      class_grade: selectedClassId.split('-')[2]?.[0] || '6',
      topic: 'Robotics Microcontrollers & Sensor Calibration',
      status: 'In Progress',
      is_locked: 0,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      duration: '90 Mins'
    };
  }, [schoolSessions, activeSessionIdOverride, selectedClassId, trainerSchoolId]);

  // Students roster in active class
  const classRoster = useMemo(() => {
    const targetClass = activeSession.class_id || selectedClassId;
    return students.filter(s => s.class_id === targetClass || s.school_id === trainerSchoolId);
  }, [students, activeSession, selectedClassId, trainerSchoolId]);

  // Helper to get status of single student for active session
  const getStudentStatus = (studentId) => {
    if (Array.isArray(attendance)) {
      const record = attendance.find(a => a.session_id === activeSession.id && a.student_id === studentId);
      return record?.status || 'Present';
    } else if (attendance && typeof attendance === 'object') {
      const sessionMap = attendance[activeSession.id] || {};
      return sessionMap[studentId] || 'Present';
    }
    return 'Present';
  };

  // Helper to mark single student
  const handleSingleStudentAttendance = async (studentId, status) => {
    if (activeSession.is_locked === 1 && !isAdmin) {
      toast.info('This past session is locked. Unlock the session to modify attendance.');
      return;
    }
    await markAttendance(activeSession.id, studentId, status);
    toast.success(`Marked ${studentId} as ${status}`, 'Attendance Updated');
  };

  // Bulk attendance
  const handleBulkAttendance = async (status) => {
    if (activeSession.is_locked === 1 && !isAdmin) {
      toast.info('This past session is locked. Unlock the session to modify attendance.');
      return;
    }
    for (const s of classRoster) {
      await markAttendance(activeSession.id, s.student_id, status);
    }
    toast.success(`Marked all ${classRoster.length} students as ${status}.`, 'Roster Updated');
  };

  const isCompleted = activeSession.status === 'Completed' || activeSession.is_locked === 1;
  const presentCount = classRoster.filter(s => getStudentStatus(s.student_id) === 'Present').length;
  const attendancePercentage = classRoster.length > 0 
    ? Math.round((presentCount / classRoster.length) * 100) 
    : 100;

  const currentSchool = schools.find(s => s.id === trainerSchoolId) || {
    name: trainerSchoolId === 'XYZ' ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School'
  };

  // Filtered past session logs
  const pastSessionsList = useMemo(() => {
    return schoolSessions.filter(s => {
      if (historyGradeFilter === 'All') return true;
      return s.class_id?.includes(`-${historyGradeFilter}A`) || s.class_grade === historyGradeFilter;
    });
  }, [schoolSessions, historyGradeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Controls: Live Runner Mode vs Historical Logs Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 self-start">
          <button
            type="button"
            onClick={() => {
              setViewMode('live');
              setActiveSessionIdOverride(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'live'
                ? 'bg-pixiu-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play size={14} />
            <span>Live Classroom Runner</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'history'
                ? 'bg-pixiu-blue text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={14} />
            <span>Attendance History Logs ({schoolSessions.length})</span>
          </button>
        </div>

        {viewMode === 'live' && (
          <div className="text-right">
            <span className="text-[11px] font-mono text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs font-bold inline-flex items-center gap-1.5">
              <Clock size={13} className="text-pixiu-blue" />
              {new Date().toLocaleDateString('en-US', { weekday: 'short' })}, {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* ==================== VIEW 1: LIVE CLASSROOM RUNNER ==================== */}
      {viewMode === 'live' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-700/80 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-pixiu-blue px-2.5 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded-md">
                    Live Classroom Lab
                  </span>
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    {activeSession.is_locked ? 'Past Certified Session' : 'Active Lab In Session'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {currentSchool.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Class: <strong className="text-white">{activeSession.class_id}</strong> • Topic: <strong className="text-white">{activeSession.topic}</strong>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-1">
                  Session Date: {activeSession.date || 'Today'} • Time: {activeSession.time || '10:30 AM'} • Instructor: {currentTrainer?.name || 'Vikas Pandey'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenEvidenceModal(activeSession, classRoster)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/30"
                >
                  <Camera size={15} />
                  <span>Certify Robot Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenReviewModal()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-600/30"
                >
                  <Star size={15} />
                  <span>Unit Review</span>
                </button>

                {isCompleted ? (
                  <button
                    type="button"
                    onClick={() => unlockSession(activeSession.id)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Unlock size={15} />
                    <span>Unlock Log</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      completeSession(activeSession.id);
                      toast.success(`Session for ${activeSession.class_id} completed & locked!`, 'Session Locked');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <CheckCircle size={15} />
                    <span>Lock & Sync Attendance</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Class Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl border border-slate-300/60">
            {relevantClasses.map(c => {
              const isSelected = selectedClassId === c.id && !activeSessionIdOverride;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedClassId(c.id);
                    setActiveSessionIdOverride(null);
                  }}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <BookOpen size={14} className={isSelected ? 'text-pixiu-blue' : 'text-slate-400'} />
                  <span>Class {c.grade}{c.section}</span>
                </button>
              );
            })}
          </div>

          {/* Roster Table with Explicit Single Student P/A Buttons */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Candidate Roster & Individual Attendance ({classRoster.length} Candidates)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click individual <strong className="text-emerald-700 font-bold">"Present"</strong> or <strong className="text-rose-700 font-bold">"Absent"</strong> button for each student. Summary: <strong className="text-emerald-700 font-bold">{presentCount}/{classRoster.length} Present ({attendancePercentage}%)</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkAttendance('Present')}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckSquare size={13} /> Mark All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAttendance('Absent')}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <XSquare size={13} /> Mark All Absent
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {classRoster.map(student => {
                const status = getStudentStatus(student.student_id);
                const isPresent = status === 'Present';

                return (
                  <div
                    key={student.student_id}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      isPresent ? 'bg-white hover:bg-slate-50/80' : 'bg-rose-50/30 hover:bg-rose-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        isPresent 
                          ? 'bg-blue-50 text-pixiu-blue border border-blue-200' 
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}>
                        {student.name.split(' ').map(w => w[0]).join('')}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{student.name}</h4>
                        <p className="text-xs text-slate-500 font-mono">
                          ID: <span className="font-bold text-slate-700">{student.student_id}</span> • Kit: {student.assigned_kit_id || 'KIT-01'} • Level: {student.tech_level || 'Level 0'}
                        </p>
                      </div>
                    </div>

                    {/* Single Student Present / Absent Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleSingleStudentAttendance(student.student_id, 'Present')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40'
                            : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
                        }`}
                      >
                        <Check size={13} />
                        <span>Present (P)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSingleStudentAttendance(student.student_id, 'Absent')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          !isPresent
                            ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/40'
                            : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                        }`}
                      >
                        <XSquare size={13} />
                        <span>Absent (A)</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {classRoster.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No students enrolled in this section.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VIEW 2: ATTENDANCE HISTORY LOGS ==================== */}
      {viewMode === 'history' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Historical Classroom Attendance Logs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived session logs with verified dates, timestamps, syllabus topics, and lock status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Filter Grade:</span>
              <select
                value={historyGradeFilter}
                onChange={(e) => setHistoryGradeFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
              >
                <option value="All">All Grades</option>
                <option value="6">Class 6A</option>
                <option value="7">Class 7A</option>
                <option value="8">Class 8A</option>
                <option value="9">Class 9A</option>
                <option value="11">Class 11A</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {pastSessionsList.map(session => {
              const sessionClassStudents = students.filter(s => s.class_id === session.class_id || s.school_id === session.school_id);
              const sessionPresentCount = sessionClassStudents.filter(s => {
                if (Array.isArray(attendance)) {
                  return attendance.some(a => a.session_id === session.id && a.student_id === s.student_id && a.status === 'Present');
                }
                return true;
              }).length;

              const isLocked = session.is_locked === 1 || session.status === 'Completed';

              return (
                <div
                  key={session.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-pixiu-blue bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                          {session.class_id || 'Class 6A'} • {session.unit_code || 'Unit 2'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1.5">{session.topic || 'Robotics Hands-on Session'}</h3>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        isLocked ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isLocked ? '🔒 Locked' : '🟢 Open'}
                      </span>
                    </div>

                    <div className="space-y-1.5 py-2.5 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1"><Calendar size={12} /> Date:</span>
                        <span className="font-bold text-slate-800">{session.date || '2026-08-20'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1"><Clock size={12} /> Time Slot:</span>
                        <span className="font-mono text-slate-700">{session.time || '10:30 AM'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1"><Users size={12} /> Attendance:</span>
                        <span className="font-bold text-emerald-700">{sessionPresentCount || sessionClassStudents.length}/{sessionClassStudents.length} Present</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSessionIdOverride(session.id);
                        setSelectedClassId(session.class_id || `CLS-${trainerSchoolId}-6A`);
                        setViewMode('live');
                      }}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Eye size={13} />
                      <span>Inspect & Edit Roster Log</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {pastSessionsList.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200">
                No archived session attendance logs found for this filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
