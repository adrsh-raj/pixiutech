import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Clock, ShieldAlert, AlertTriangle, CheckCircle2, 
  ChevronLeft, ChevronRight, Send, WifiOff, Wifi,
  Maximize2, HelpCircle, AlertCircle
} from 'lucide-react';

export default function QuizExamEngine({
  quiz,
  student,
  onSubmit,
  onCancel
}) {
  const questions = quiz?.questions || [];
  const totalQuestions = questions.length;
  const initialDuration = (quiz?.duration_minutes || 10) * 60;

  // Local storage draft key
  const storageKey = `pixiu_quiz_active_${quiz?.id}_${student?.student_id}`;

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [timeLeft, setTimeLeft] = useState(initialDuration);
  const [violationCount, setViolationCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineSeconds, setOfflineSeconds] = useState(60);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const violationCountRef = useRef(0);
  const isTerminatedRef = useRef(false);
  const containerRef = useRef(null);

  // Fullscreen helper
  const enterFullscreen = useCallback(() => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } catch (e) {}
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    } catch (e) {}
  }, []);

  // Request fullscreen on mount
  useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  // Handle final submission
  const handleFinalSubmit = useCallback(async (status = 'Completed') => {
    if (isTerminatedRef.current) return;
    isTerminatedRef.current = true;
    setIsSubmitting(true);

    const timeSpent = initialDuration - timeLeft;
    try {
      await onSubmit({
        quiz_id: quiz.id,
        student_id: student.student_id,
        student_name: student.name,
        class_grade: quiz.class_grade || student.grade || '6',
        level: quiz.level,
        answers,
        time_taken_seconds: Math.max(0, timeSpent),
        violation_count: violationCountRef.current,
        status
      });
    } finally {
      exitFullscreen();
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {}
    }
  }, [initialDuration, timeLeft, onSubmit, quiz, student, answers, storageKey, exitFullscreen]);

  // Anti-cheat handler
  const handleViolation = useCallback(() => {
    if (isTerminatedRef.current) return;

    violationCountRef.current += 1;
    setViolationCount(violationCountRef.current);

    if (violationCountRef.current === 1) {
      setShowWarningModal(true);
    } else if (violationCountRef.current >= 2) {
      setShowWarningModal(false);
      alert('⚠️ ANTI-CHEAT LOCKOUT (Strike 2 of 2):\n\nMultiple tab-switches or window minimizations were detected. Your exam has been automatically terminated and submitted for Trainer review.');
      handleFinalSubmit('Terminated_Violation');
    }
  }, [handleFinalSubmit]);

  // Listen for Visibility and Fullscreen changes
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && !isTerminatedRef.current) {
        handleViolation();
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && !isTerminatedRef.current) {
        handleViolation();
      }
    };

    const handleWindowBlur = () => {
      if (!isTerminatedRef.current) {
        handleViolation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [handleViolation]);

  // Main countdown timer
  useEffect(() => {
    if (isTerminatedRef.current) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('⏱️ Time has expired! Your exam will now be submitted automatically.');
          handleFinalSubmit('Submitted_Time_Expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleFinalSubmit]);

  // Offline / Online handler with 60-second grace countdown
  useEffect(() => {
    let offlineInterval = null;

    const onOffline = () => {
      setIsOffline(true);
      setOfflineSeconds(60);
    };

    const onOnline = () => {
      setIsOffline(false);
      setOfflineSeconds(60);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      if (offlineInterval) clearInterval(offlineInterval);
    };
  }, []);

  useEffect(() => {
    if (!isOffline || isTerminatedRef.current) return;

    const interval = setInterval(() => {
      setOfflineSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          alert('⚠️ Network Offline Timeout: Connection could not be restored within 60 seconds. Your answers were saved locally and the quiz is submitted.');
          handleFinalSubmit('Submitted_Offline_Timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOffline, handleFinalSubmit]);

  // Answer selection
  const handleSelectOption = (questionId, optionLetter) => {
    const updated = { ...answers, [questionId]: optionLetter };
    setAnswers(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {}
  };

  // Format MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQ = questions[currentIndex] || {};
  const currentAnswer = answers[currentQ.id];
  const answeredCount = Object.keys(answers).length;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const options = [
    { key: 'A', text: currentQ.option_a },
    { key: 'B', text: currentQ.option_b },
    { key: 'C', text: currentQ.option_c },
    { key: 'D', text: currentQ.option_d }
  ];

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col select-none overflow-hidden"
    >
      {/* 60-Second Offline Recovery Banner */}
      {isOffline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-bold shadow-lg animate-pulse z-30">
          <div className="flex items-center gap-2">
            <WifiOff size={18} />
            <span>Internet Disconnected! Answers safely saved in local memory. Reconnecting...</span>
          </div>
          <div className="bg-slate-900 text-amber-400 px-3 py-1 rounded-full text-xs font-mono">
            Auto-submits in: {offlineSeconds}s
          </div>
        </div>
      )}

      {/* Top Proctoring Bar */}
      <header className="bg-slate-950/90 border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shrink-0">
        {/* Left info */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 text-blue-400 px-2.5 py-1 rounded-lg border border-blue-500/30 text-xs font-bold">
            {quiz.level}
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
              {quiz.title}
            </h1>
            <p className="text-[11px] text-slate-400">
              Candidate: <span className="text-slate-200 font-semibold">{student?.name}</span> ({student?.student_id})
            </p>
          </div>
        </div>

        {/* Right info: Timer & Anti-Cheat badge */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Anti-cheat badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${
            violationCount === 0 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
          }`}>
            <ShieldAlert size={14} />
            <span>Anti-Cheat: {violationCount}/2 Strikes</span>
          </div>

          {/* Timer Clock */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm sm:text-base font-extrabold border ${
            timeLeft <= 60 
              ? 'bg-rose-600/20 text-rose-400 border-rose-500 animate-pulse' 
              : 'bg-slate-800 text-cyan-400 border-slate-700'
          }`}>
            <Clock size={16} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
      </header>

      {/* Progress Line */}
      <div className="w-full bg-slate-800 h-1">
        <div 
          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {/* Main Question Surface */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-3xl bg-slate-950/60 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xs space-y-6">
          {/* Question Metadata Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
              {currentQ.points || 2} Marks
            </span>
          </div>

          {/* Question Prompt */}
          <div className="text-base sm:text-lg font-semibold text-white leading-relaxed">
            {currentQ.question_text}
          </div>

          {/* 4 Choices (A, B, C, D) */}
          <div className="space-y-3 pt-2">
            {options.map((opt) => {
              const isSelected = currentAnswer === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleSelectOption(currentQ.id, opt.key)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-150 flex items-start gap-3.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                    isSelected 
                      ? 'bg-blue-500 text-white shadow-sm' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {opt.key}
                  </div>
                  <span className="text-sm leading-relaxed mt-0.5">{opt.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Bottom Navigation & Question Switcher Bar */}
      <footer className="bg-slate-950/90 border-t border-slate-800 px-4 sm:px-8 py-3.5 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Question quick dots */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? 'ring-2 ring-blue-400 bg-blue-600 text-white'
                    : isAnswered
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          {isLastQuestion ? (
            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Send size={14} />
              <span>Submit & Finish Exam</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </footer>

      {/* Strike 1 Anti-Cheat Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/40 rounded-full flex items-center justify-center mx-auto text-rose-500 animate-bounce">
              <AlertTriangle size={30} />
            </div>
            <h3 className="text-xl font-black text-rose-400">
              Anti-Cheat Warning (Strike 1 of 2)
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              You left the exam window or switched tabs. This violation has been logged to your proctoring audit log.
            </p>
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 font-bold">
              ⚠️ A second violation will terminate and submit your paper immediately with zero re-attempts.
            </div>
            <button
              type="button"
              onClick={() => {
                setShowWarningModal(false);
                enterFullscreen();
              }}
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-600/30"
            >
              Resume Exam in Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Confirm Submission Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto">
              <HelpCircle size={26} />
            </div>
            <h3 className="text-lg font-black text-white">
              Ready to Submit Your Exam?
            </h3>
            <p className="text-xs text-slate-300">
              You have answered <span className="text-emerald-400 font-bold">{answeredCount}</span> of <span className="font-bold">{totalQuestions}</span> questions.
              {answeredCount < totalQuestions && (
                <span className="block mt-1 text-amber-400 font-semibold">
                  ⚠️ Warning: You still have {totalQuestions - answeredCount} unanswered questions!
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                Review Answers
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleFinalSubmit('Completed')}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/30"
              >
                {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
