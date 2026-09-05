import React from 'react';
import { 
  Award, CheckCircle2, XCircle, Clock, ShieldAlert, 
  Printer, X, ChevronRight, BookOpen, User, Check, AlertCircle
} from 'lucide-react';

export default function QuizResultSheetModal({
  isOpen,
  onClose,
  quiz,
  submission,
  student
}) {
  if (!isOpen || !submission) return null;

  const questions = quiz?.questions || [];
  const answers = typeof submission.answers === 'string' 
    ? JSON.parse(submission.answers || '{}') 
    : (submission.answers || {});

  const percentage = submission.percentage ?? Math.round(((submission.score || 0) / (submission.total_marks || 1)) * 100);
  const isPass = percentage >= 50;

  const formatTime = (secs) => {
    if (!secs) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-6 shrink-0 flex items-center justify-between gap-4 print:bg-white print:text-black">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {quiz?.level || submission.level} • {quiz?.unit_code || 'Assessment'}
              </span>
              <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                isPass 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                  : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
              }`}>
                {isPass ? 'Passed / Accredited' : 'Needs Review'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Official Assessment Result Sheet
            </h2>
            <p className="text-xs text-slate-300">
              {quiz?.title || 'Robotics Lab Examination'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors cursor-pointer"
              title="Print Score Sheet"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Print Sheet</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Sheet Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 bg-slate-50/50">
          {/* Candidate Info Strip */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidate Name</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{submission.student_name || student?.name || 'Student'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Student ID / Roll</p>
              <p className="font-mono font-bold text-blue-600 text-sm mt-0.5">{submission.student_id || student?.student_id}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Class Grade</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">Class {submission.class_grade || student?.grade || '6'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Date</p>
              <p className="font-medium text-slate-700 text-xs mt-0.5">
                {submission.completed_at ? new Date(submission.completed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent'}
              </p>
            </div>
          </div>

          {/* Performance Scorecard */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-4 sm:col-span-2 flex flex-col justify-between shadow-md">
              <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">Aggregate Score</span>
              <div className="my-2">
                <div className="text-3xl sm:text-4xl font-black tracking-tight">
                  {submission.score} <span className="text-lg opacity-70">/ {submission.total_marks}</span>
                </div>
                <p className="text-xs opacity-90 mt-1 font-medium">
                  {percentage}% Accuracy • {percentage >= 80 ? 'Exemplary Mastery' : percentage >= 50 ? 'Proficient' : 'Revision Suggested'}
                </p>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5 mt-1 overflow-hidden">
                <div className="bg-white h-1.5 rounded-full" style={{ width: `${percentage}%` }} />
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-center text-center shadow-xs">
              <div className="text-emerald-600 flex justify-center mb-1">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-xl font-black text-slate-900">{submission.correct_count ?? '-'}</p>
              <p className="text-[11px] font-semibold text-slate-500">Correct Answers</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-center text-center shadow-xs">
              <div className="text-blue-600 flex justify-center mb-1">
                <Clock size={22} />
              </div>
              <p className="text-xl font-black text-slate-900">{formatTime(submission.time_taken_seconds)}</p>
              <p className="text-[11px] font-semibold text-slate-500">Time Taken</p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-center text-center shadow-xs col-span-2 sm:col-span-1">
              <div className={`flex justify-center mb-1 ${submission.violation_count > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                <ShieldAlert size={22} />
              </div>
              <p className="text-xl font-black text-slate-900">{submission.violation_count || 0}</p>
              <p className="text-[11px] font-semibold text-slate-500">Violations Logged</p>
            </div>
          </div>

          {/* Detailed Question Review with Trainer Pedagogical Reasoning */}
          <div className="space-y-4 pt-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen size={18} className="text-blue-600" />
              <span>Detailed Question Analysis & Technical Explanations</span>
            </h3>

            <div className="space-y-4">
              {questions.map((q, idx) => {
                const studentChoice = answers[q.id];
                const isCorrect = String(studentChoice).trim().toUpperCase() === String(q.correct_option).trim().toUpperCase();
                const isUnanswered = studentChoice === undefined || studentChoice === null || studentChoice === '';

                const optA = { key: 'A', text: q.option_a };
                const optB = { key: 'B', text: q.option_b };
                const optC = { key: 'C', text: q.option_c };
                const optD = { key: 'D', text: q.option_d };

                return (
                  <div 
                    key={q.id || idx}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3.5"
                  >
                    {/* Question Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          isCorrect 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : isUnanswered
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-800 leading-snug">
                          {q.question_text}
                        </h4>
                      </div>

                      <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full shrink-0 ${
                        isCorrect 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : isUnanswered
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {isCorrect ? `+${q.points || 2} Pts` : `0 / ${q.points || 2} Pts`}
                      </span>
                    </div>

                    {/* Choices Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[optA, optB, optC, optD].map((opt) => {
                        const isStudentPick = studentChoice === opt.key;
                        const isCorrectAnswer = String(q.correct_option).trim().toUpperCase() === opt.key;

                        let style = 'bg-slate-50 border-slate-200 text-slate-600';
                        if (isCorrectAnswer) {
                          style = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold ring-1 ring-emerald-400/50';
                        } else if (isStudentPick && !isCorrect) {
                          style = 'bg-rose-50 border-rose-300 text-rose-900 font-semibold ring-1 ring-rose-400/50';
                        }

                        return (
                          <div
                            key={opt.key}
                            className={`p-2.5 rounded-xl border flex items-start gap-2 ${style}`}
                          >
                            <span className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                              isCorrectAnswer 
                                ? 'bg-emerald-600 text-white' 
                                : isStudentPick && !isCorrect
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {opt.key}
                            </span>
                            <div className="flex-1">
                              <span>{opt.text}</span>
                              {isStudentPick && (
                                <span className={`block text-[10px] font-bold mt-1 ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isCorrect ? '✓ Your Selection (Correct)' : '✗ Your Selection (Incorrect)'}
                                </span>
                              )}
                              {!isStudentPick && isCorrectAnswer && (
                                <span className="block text-[10px] font-bold text-emerald-700 mt-1">
                                  ★ Correct Answer
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Trainer Explanation & Reasoning Box */}
                    {q.explanation && (
                      <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-100/80 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
                        <div className="font-bold text-blue-900 flex items-center gap-1.5">
                          <span>💡 Trainer's Pedagogical Reasoning:</span>
                        </div>
                        <p className="text-slate-700 leading-relaxed pl-5 font-normal">
                          {q.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">
            Pixiu Robotics Certified Assessment Engine • Confidential Scorecard
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Sheet
          </button>
        </div>
      </div>
    </div>
  );
}
