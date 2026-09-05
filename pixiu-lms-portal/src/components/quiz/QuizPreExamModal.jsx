import React from 'react';
import { 
  ShieldAlert, Clock, AlertTriangle, CheckCircle2, 
  Maximize2, X, Award, WifiOff, FileText, ChevronRight 
} from 'lucide-react';

export default function QuizPreExamModal({
  isOpen,
  onClose,
  quiz,
  student,
  onStartExam
}) {
  if (!isOpen || !quiz) return null;

  const totalQuestions = quiz.questions?.length || 5;
  const duration = quiz.duration_minutes || 10;
  const totalMarks = quiz.total_marks || (totalQuestions * 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-6 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold mb-3">
            <Award size={14} />
            <span>{quiz.level} • {quiz.unit_code} Assessment</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1">
            {quiz.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Proctored Lab MCQ Examination • Pixiu Robotics OS
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700 text-sm">
          {/* Student Verification Strip */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidate Name</p>
              <p className="font-bold text-slate-900 text-base">{student?.name || 'Verified Student'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Roll Number / ID</p>
              <p className="font-mono font-bold text-blue-600 text-sm">{student?.student_id || 'STU-ID'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Class & Grade</p>
              <p className="font-bold text-slate-800 text-sm">Class {quiz.class_grade || student?.grade || '6'}</p>
            </div>
          </div>

          {/* Exam Spec Pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-blue-600 mb-1">
                <Clock size={20} />
              </div>
              <p className="text-lg font-black text-slate-900">{duration} Mins</p>
              <p className="text-[11px] font-semibold text-slate-500">Time Limit</p>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-emerald-600 mb-1">
                <FileText size={20} />
              </div>
              <p className="text-lg font-black text-slate-900">{totalQuestions}</p>
              <p className="text-[11px] font-semibold text-slate-500">MCQ Questions</p>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center text-amber-600 mb-1">
                <Award size={20} />
              </div>
              <p className="text-lg font-black text-slate-900">{totalMarks} Pts</p>
              <p className="text-[11px] font-semibold text-slate-500">Total Marks</p>
            </div>
          </div>

          {/* Proctored Rules & Instructions */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldAlert size={18} className="text-rose-600" />
              Proctored Exam Rules & Anti-Cheat Protocols
            </h4>

            <div className="space-y-2.5 bg-rose-50/40 border border-rose-100 rounded-xl p-4 text-xs leading-relaxed text-slate-700">
              <div className="flex items-start gap-2.5">
                <Maximize2 size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Mandatory Fullscreen:</strong> The exam will automatically launch in full-screen mode. Do not exit full-screen until you submit.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">2-Strike Anti-Cheat Protection:</strong> Switching tabs, opening other apps, or minimizing the window will trigger an instant Strike 1 warning. A second violation will <span className="text-rose-600 font-bold">immediately lock and auto-submit</span> your paper.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <WifiOff size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Network Failure Safe-guard:</strong> Answers are securely saved locally on every selection. If internet disconnects, you have a 60-second grace window to reconnect without losing progress.
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">Single Attempt Policy:</strong> Each student may only attempt this assessment once. Re-attempts require manual clearance from your robotics Trainer.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors"
          >
            Cancel & Back
          </button>

          <button
            type="button"
            onClick={onStartExam}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
          >
            <Maximize2 size={16} />
            <span>Enter Fullscreen & Start Exam</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
