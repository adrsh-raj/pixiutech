import { useState, useMemo } from 'react';
import { 
  Play, CheckCircle, Clock, CheckSquare, XSquare, 
  Camera, Star, Award, BookOpen, AlertCircle, Sparkles, Building2, User, ChevronRight, Lock, Unlock
} from 'lucide-react';
import Badge from '../ui/Badge';
import { useToast } from '../../context/ToastContext';

export default function LiveSessionRunner({
  sessions = [],
  classes = [],
  students = [],
  attendance = {},
  markAttendance,
  completeSession,
  unlockSession,
  startNewSession,
  onOpenEvidenceModal,
  onOpenReviewModal,
  currentTrainer,
  schools = []
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

  // Active or selected session for this class
  const activeSession = useMemo(() => {
    return sessions.find(s => s.class_id === selectedClassId) || {
      id: `SES-${selectedClassId}`,
      class_id: selectedClassId,
      school_id: trainerSchoolId,
      unit_code: 'Unit 2',
      class_grade: selectedClassId.split('-')[2]?.[0] || '6',
      topic: 'Robotics Microcontrollers & Sensors Circuitry',
      status: 'In Progress',
      date: new Date().toISOString().split('T')[0],
      duration: '90 Mins'
    };
  }, [sessions, selectedClassId, trainerSchoolId]);

  // Students roster in active class
  const classRoster = useMemo(() => {
    return students.filter(s => s.class_id === selectedClassId || s.school_id === trainerSchoolId);
  }, [students, selectedClassId, trainerSchoolId]);

  // Attendance states for this session
  const currentAttendance = attendance[activeSession.id] || {};

  const handleToggleAttendance = (studentId) => {
    if (activeSession.status === 'Completed') {
      toast.info('Session is marked as completed. Click "Unlock Session" to edit records.');
      return;
    }
    const currentStatus = currentAttendance[studentId] || 'Present';
    const nextStatus = currentStatus === 'Present' ? 'Absent' : 'Present';
    markAttendance(activeSession.id, studentId, nextStatus);
  };

  const handleBulkAttendance = (status) => {
    if (activeSession.status === 'Completed') return;
    classRoster.forEach(s => {
      markAttendance(activeSession.id, s.student_id, status);
    });
    toast.success(`Marked all ${classRoster.length} students as ${status}.`, 'Roster Updated');
  };

  const isCompleted = activeSession.status === 'Completed';
  const presentCount = classRoster.filter(s => (currentAttendance[s.student_id] || 'Present') === 'Present').length;
  const attendancePercentage = classRoster.length > 0 
    ? Math.round((presentCount / classRoster.length) * 100) 
    : 100;

  const currentSchool = schools.find(s => s.id === trainerSchoolId) || {
    name: trainerSchoolId === 'XYZ' ? 'XYZ Academy (Pilot Lab)' : 'Zenith Public School'
  };

  return (
    <div className="space-y-6">
      {/* Live Classroom Scope Header Strip */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 sm:p-6 text-white border border-slate-700/80 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-pixiu-blue px-2.5 py-0.5 bg-blue-500/15 border border-blue-500/30 rounded-md">
                Field Trainer Console
              </span>
              <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Active Lab In Session
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {currentSchool.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
              Topic: <strong className="text-white">{activeSession.topic}</strong>
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
                  toast.success(`Session for ${selectedClassId} marked as completed & certified.`, 'Session Closed');
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
              >
                <CheckCircle size={15} />
                <span>Finish & Sync Session</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Class Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl border border-slate-300/60">
        {relevantClasses.map(c => {
          const isSelected = selectedClassId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setSelectedClassId(c.id)}
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

      {/* Roster & 1-Tap Attendance Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Live Attendance & Candidate Roster ({classRoster.length} Enrolled)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tap individual card to toggle status. Current Attendance: <strong className="text-emerald-700 font-bold">{presentCount}/{classRoster.length} ({attendancePercentage}%)</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isCompleted}
              onClick={() => handleBulkAttendance('Present')}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckSquare size={13} /> All Present
            </button>
            <button
              type="button"
              disabled={isCompleted}
              onClick={() => handleBulkAttendance('Absent')}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <XSquare size={13} /> All Absent
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {classRoster.map(student => {
            const status = currentAttendance[student.student_id] || 'Present';
            const isPresent = status === 'Present';

            return (
              <div
                key={student.student_id}
                onClick={() => handleToggleAttendance(student.student_id)}
                className={`p-4 flex items-center justify-between transition-colors cursor-pointer ${
                  isPresent ? 'hover:bg-slate-50/80' : 'bg-rose-50/30 hover:bg-rose-50/60'
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
                      ID: {student.student_id} • Kit: {student.assigned_kit_id || 'KIT-01'} • Level: {student.tech_level || 'Level 0'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    isPresent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {isPresent ? '✓ Present' : '✗ Absent'}
                  </span>
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
  );
}
