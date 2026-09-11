import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Eye, Plus, Save, Search, ShieldAlert, Timer, Trash2, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const rows = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : Array.isArray(value?.data) ? value.data : [];
const blankQuestion = () => ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '', points: 1 });
const fieldClass = 'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400';
const textareaClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 resize-y';

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const field = Object.entries(data || {}).find(([key]) => !['detail', 'error', 'message'].includes(key));
    const fieldText = field ? `${field[0]}: ${Array.isArray(field[1]) ? field[1].join(', ') : String(field[1])}` : '';
    throw new Error(data.detail || data.error || data.message || fieldText || `Request failed (${response.status})`);
  }
  return data;
}

const formatDuration = seconds => {
  const s = Number(seconds || 0);
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60); const rem = s % 60;
  return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
};

export default function QuizHub() {
  const { user } = useAuth();
  const { quizzes = [], classes = [], curriculum = [], refreshAll, loading } = useData();
  const canCreate = ['admin', 'superadmin', 'trainer'].includes(user?.role);
  const canViewResults = ['admin', 'school', 'trainer'].includes(user?.role);
  const activeClasses = useMemo(() => classes.filter(item => String(item.status || 'active').toLowerCase() !== 'inactive'), [classes]);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  const [preStartQuiz, setPreStartQuiz] = useState(null);
  const [studentQuiz, setStudentQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return !term ? quizzes : quizzes.filter(item => `${item.title || ''} ${item.grade || ''} ${item.level || ''} ${item.unit_code || ''} ${(item.assigned_classes || []).map(c => c.name).join(' ')}`.toLowerCase().includes(term));
  }, [quizzes, query]);

  const openCreate = () => {
    setError('');
    setEditor({ id: null, classId: '', form: { title: '', grade: '', level: '', unit_code: '', duration_seconds: 30 }, questions: [blankQuestion()] });
  };

  const openEdit = quiz => {
    setError('');
    setEditor({
      id: quiz.id,
      classId: quiz.assigned_classes?.[0]?.id || '',
      form: { title: quiz.title || '', grade: quiz.grade || '', level: quiz.level || '', unit_code: quiz.unit_code || '', duration_seconds: Number(quiz.duration_seconds || 30) },
      questions: rows(quiz.questions).map(q => ({ ...blankQuestion(), ...q })),
    });
  };

  const unitsForClass = useMemo(() => {
    if (!editor?.classId) return [];
    const cls = activeClasses.find(item => String(item.id) === String(editor.classId));
    return curriculum.filter(item => String(item.grade ?? item.class_grade) === String(cls?.grade ?? ''));
  }, [activeClasses, curriculum, editor?.classId]);

  const selectClass = classId => setEditor(current => {
    const cls = activeClasses.find(item => String(item.id) === String(classId));
    const firstUnit = curriculum.find(item => String(item.grade ?? item.class_grade) === String(cls?.grade ?? ''));
    return { ...current, classId, form: { ...current.form, grade: cls?.grade || '', level: current.id ? current.form.level : (firstUnit?.level || ''), unit_code: current.id ? current.form.unit_code : (firstUnit?.unit_code || '') } };
  });

  const selectUnit = unitCode => setEditor(current => {
    const unit = unitsForClass.find(item => String(item.unit_code) === String(unitCode));
    return { ...current, form: { ...current.form, unit_code: unitCode, level: unit?.level || current.form.level } };
  });

  const updateQuestion = (index, patch) => setEditor(current => ({ ...current, questions: current.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));

  const saveQuiz = async event => {
    event.preventDefault();
    if (!editor || saving) return;
    const selectedClass = activeClasses.find(item => String(item.id) === String(editor.classId));
    if (!selectedClass) return setError('Select the exact active class that should receive this quiz.');
    if (!editor.form.title.trim()) return setError('Quiz title is required.');
    const duration = Number(editor.form.duration_seconds);
    if (!Number.isFinite(duration) || duration < 10 || duration > 14400) return setError('Exam timer must be between 10 seconds and 4 hours.');
    if (!editor.questions.length || !editor.questions.every(q => q.question_text.trim() && q.option_a.trim() && q.option_b.trim() && q.option_c.trim() && q.option_d.trim())) return setError('Every question needs question text and all four options.');

    setSaving(true); setError('');
    try {
      const payload = { title: editor.form.title.trim(), grade: String(selectedClass.grade).trim(), level: String(editor.form.level || '').trim(), unit_code: String(editor.form.unit_code || '').trim(), status: 'active', max_attempts: 1, duration_seconds: duration, duration_minutes: Math.max(1, Math.ceil(duration / 60)) };
      const questionPayloads = editor.questions.map(q => ({ question_text: q.question_text.trim(), option_a: q.option_a.trim(), option_b: q.option_b.trim(), option_c: q.option_c.trim(), option_d: q.option_d.trim(), correct_option: q.correct_option, explanation: q.explanation?.trim() || '', points: Number(q.points || 1) }));
      if (editor.id) {
        await request(`/quizzes/${encodeURIComponent(editor.id)}`, 'PATCH', payload);
        for (const question of editor.questions) {
          const body = { quiz: editor.id, question_text: question.question_text.trim(), option_a: question.option_a.trim(), option_b: question.option_b.trim(), option_c: question.option_c.trim(), option_d: question.option_d.trim(), correct_option: question.correct_option, explanation: question.explanation?.trim() || '', points: Number(question.points || 1) };
          if (question.id) await request(`/quiz-questions/${encodeURIComponent(question.id)}`, 'PATCH', body);
          else await request('/quiz-questions', 'POST', body);
        }
        await request('/quiz-assignments', 'POST', { quiz: editor.id, school_class: editor.classId });
      } else {
        await request('/quizzes/create-with-questions', 'POST', { ...payload, school_class: editor.classId, questions: questionPayloads });
      }
      await refreshAll(); setEditor(null);
    } catch (err) { setError(err.message || 'Quiz save failed.'); } finally { setSaving(false); }
  };

  const deleteQuestion = async index => {
    const question = editor?.questions[index];
    if (question?.id) {
      try { await request(`/quiz-questions/${encodeURIComponent(question.id)}`, 'DELETE'); } catch (err) { setError(err.message); return; }
    }
    setEditor(current => ({ ...current, questions: current.questions.filter((_, i) => i !== index) }));
  };

  const beginExam = async () => {
    if (!preStartQuiz || saving) return;
    setSaving(true); setError('');
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) throw new Error('This browser does not support full-screen exams.');
        await document.documentElement.requestFullscreen();
      }
      const started = await request(`/quizzes/${encodeURIComponent(preStartQuiz.id)}/start`, 'POST', {});
      setPreStartQuiz(null); setStudentQuiz({ ...preStartQuiz, __startedAt: started.started_at, __attemptId: started.attempt_id, __durationSeconds: started.duration_seconds || Number(preStartQuiz.duration_seconds || 30) }); setAnswers({}); setResult(null);
    } catch (err) {
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* no-op */ }
      setError(err.message || 'Unable to start the exam.');
    } finally { setSaving(false); }
  };

  const submitStudent = async (forcedViolation = false, violations = 0) => {
    if (!studentQuiz || saving) return;
    setSaving(true); setError('');
    try {
      const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(studentQuiz.__startedAt)) / 1000));
      const submitted = await request(`/quizzes/${encodeURIComponent(studentQuiz.id)}/single-attempt`, 'POST', { answers, time_taken_seconds: Math.min(studentQuiz.__durationSeconds || 30, elapsed), violation_count: Math.max(violations, forcedViolation ? 1 : 0), attempt_id: studentQuiz.__attemptId });
      setResult(submitted); await refreshAll();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const closeStudentQuiz = async () => {
    setStudentQuiz(null); setResult(null); setPreStartQuiz(null);
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* no-op */ } }
  };

  const openReview = async quiz => {
    setReviewing(quiz); setSaving(true); setError('');
    try { setAttempts(rows(await request(`/quiz-review?quiz=${encodeURIComponent(quiz.id)}`))); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const grantReattempt = async attempt => {
    if (user?.role !== 'trainer') return;
    setSaving(true); setError('');
    try { await request(`/quizzes/${encodeURIComponent(attempt.quiz)}/reattempt`, 'POST', { student: attempt.student }); setAttempts(rows(await request(`/quiz-review?quiz=${encodeURIComponent(attempt.quiz)}`))); await refreshAll(); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return <div className="space-y-5 pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Assessment</p><h1 className="text-2xl font-black text-slate-900 mt-1">{user?.role === 'student' ? 'My Quizzes' : 'Quiz Management'}</h1><p className="text-sm text-slate-500 mt-1">One exact class, one active attempt at a time, trainer-controlled exam timer and protected exam mode.</p></div>{canCreate&&<div className="flex gap-2"><RefreshButton onRefresh={refreshAll} loading={loading||saving}/><button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={15}/> New MCQ Quiz</button></div>}</div>
    {error&&<ErrorState title="Quiz action failed" description={error} onRetry={()=>setError('')}/>} 
    {user?.role==='student'&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3"><ShieldAlert size={18} className="shrink-0 mt-0.5"/><div><b>Secure exam mode:</b> Full-screen is required. The timer is server-controlled. One active/completed attempt is allowed unless your trainer grants a reattempt. Leaving full-screen or switching away gives one warning; the next violation submits the exam.</div></div>}
    {canViewResults&&<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-900">Results and detailed answers are available only to authorised trainers, the selected school and administrators. Trainer-created quizzes and their results are visible in the administrator portal through the same scoped API.</div>}
    <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="relative max-w-xl"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className={`${fieldClass} pl-9`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by quiz, grade, unit or class"/></div></div>
    {filtered.length===0?<div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<ClipboardCheck size={20}/>} title="No quizzes" description="No quiz records are available in this authorised scope."/></div>:<section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(quiz=><article key={quiz.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><ClipboardCheck size={17}/></span><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{quiz.status||'active'}</span></div><h2 className="font-black text-slate-900 mt-4">{quiz.title}</h2><p className="text-xs text-slate-500 mt-1">{quiz.assigned_classes?.[0]?.name||'Class'} · Grade {quiz.grade||'—'} · {quiz.level||'No level'} · {quiz.unit_code||'No unit'}</p><p className="text-[10px] text-slate-400 mt-3">{rows(quiz.questions).length} MCQs · {formatDuration(quiz.duration_seconds||30)} · 1 attempt</p><div className="flex flex-wrap gap-2 mt-4">{user?.role==='student'?<button type="button" disabled={String(quiz.status).toLowerCase()!=='active'} onClick={()=>{setError('');setPreStartQuiz(quiz)}} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black disabled:opacity-40">Start Exam</button>:<>{canCreate&&<button type="button" onClick={()=>openEdit(quiz)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black">Edit Quiz</button>}{canViewResults&&<button type="button" onClick={()=>openReview(quiz)} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black inline-flex items-center gap-1"><Eye size={12}/> Results & Answers</button>}</>}</div></article>)}</section>}

    {editor&&<div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"><form onSubmit={saveQuiz} className="w-full max-w-5xl max-h-[94vh] overflow-hidden bg-white rounded-3xl shadow-2xl flex flex-col"><div className="shrink-0 px-5 sm:px-7 py-5 border-b border-slate-100 flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-600">Assessment Builder</p><h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{editor.id?'Edit MCQ Quiz':'Create MCQ Quiz'}</h2><p className="text-xs text-slate-500 mt-1">Select one exact class. Grade follows the class. Timer is set by the trainer.</p></div><button type="button" onClick={()=>setEditor(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"><X size={20}/></button></div><div className="overflow-y-auto p-5 sm:p-7 space-y-6"><section className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><label className="block text-[10px] uppercase tracking-wider font-black text-slate-500 mb-2">Quiz title *</label><input className={fieldClass} placeholder="e.g. Sensors & Distance — Quiz 1" value={editor.form.title} onChange={e=>setEditor(c=>({...c,form:{...c.form,title:e.target.value}}))} required/></div><div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4"><label className="block text-[10px] uppercase tracking-wider font-black text-blue-700 mb-2">Exact class *</label><select className={fieldClass} value={editor.classId} onChange={e=>selectClass(e.target.value)} required><option value="">Select exact class</option>{activeClasses.map(item=><option key={item.id} value={item.id}>{item.display_name||item.id} · Grade {item.grade}</option>)}</select></div><div><label className="block text-[10px] uppercase tracking-wider font-black text-slate-500 mb-2">Grade</label><input className={`${fieldClass} bg-slate-50 text-slate-500`} value={editor.form.grade} readOnly/></div><div><label className="block text-[10px] uppercase tracking-wider font-black text-slate-500 mb-2">Curriculum unit</label><select className={fieldClass} value={editor.form.unit_code} onChange={e=>selectUnit(e.target.value)} disabled={!editor.classId}><option value="">Select unit (optional)</option>{unitsForClass.map(item=><option key={item.id} value={item.unit_code}>{item.unit_code} · {item.level||'No level'} · {item.topic||item.title}</option>)}</select></div><div><label className="block text-[10px] uppercase tracking-wider font-black text-slate-500 mb-2">Level</label><input className={fieldClass} placeholder="Level 1" value={editor.form.level} onChange={e=>setEditor(c=>({...c,form:{...c.form,level:e.target.value}}))}/></div><div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"><label className="block text-[10px] uppercase tracking-wider font-black text-violet-700 mb-2">Exam timer (seconds) *</label><div className="flex gap-2"><input className={fieldClass} type="number" min="10" max="14400" value={editor.form.duration_seconds} onChange={e=>setEditor(c=>({...c,form:{...c.form,duration_seconds:e.target.value}}))}/><select className={`${fieldClass} max-w-[130px]`} value="" onChange={e=>e.target.value&&setEditor(c=>({...c,form:{...c.form,duration_seconds:Number(e.target.value)}}))}><option value="">Preset</option><option value="30">30 sec</option><option value="60">1 min</option><option value="300">5 min</option><option value="600">10 min</option><option value="1800">30 min</option></select></div><p className="text-[10px] text-slate-500 mt-2">Students receive exactly one attempt. Only the trainer can reopen a student for another attempt.</p></div></section><section className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-slate-900 text-lg">Questions</h3><p className="text-xs text-slate-500 mt-1">Correct answers and explanations stay hidden from students until submission.</p></div><button type="button" onClick={()=>setEditor(c=>({...c,questions:[...c.questions,blankQuestion()]}))} className="px-3.5 py-2.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-black inline-flex items-center gap-1.5"><Plus size={14}/> Add MCQ</button></div>{editor.questions.map((q,index)=><div key={q.id||index} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5 space-y-4"><div className="flex items-center justify-between"><div><span className="text-[10px] uppercase tracking-wider font-black text-blue-600">Question {index+1}</span><p className="text-xs text-slate-400 mt-0.5">Question, A-D options, correct answer, marks and explanation.</p></div><button type="button" onClick={()=>deleteQuestion(index)} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={15}/></button></div><textarea className={`${textareaClass} min-h-24`} placeholder="Question text" value={q.question_text} onChange={e=>updateQuestion(index,{question_text:e.target.value})} required/><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{['a','b','c','d'].map(letter=><div key={letter}><label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Option {letter.toUpperCase()}</label><input className={fieldClass} placeholder={`Answer ${letter.toUpperCase()}`} value={q[`option_${letter}`]} onChange={e=>updateQuestion(index,{[`option_${letter}`]:e.target.value})} required/></div>)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Correct option</label><select className={fieldClass} value={q.correct_option} onChange={e=>updateQuestion(index,{correct_option:e.target.value})}><option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option></select></div><div><label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5">Marks</label><input className={fieldClass} type="number" min="1" value={q.points} onChange={e=>updateQuestion(index,{points:e.target.value})}/></div></div><textarea className={`${textareaClass} min-h-20`} placeholder="Explanation shown after submission" value={q.explanation} onChange={e=>updateQuestion(index,{explanation:e.target.value})}/></div>)}</section></div><div className="shrink-0 px-5 sm:px-7 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-between gap-3 bg-slate-50/70"><p className="text-[11px] text-slate-500 self-center">Exact class · server timer · one attempt</p><div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditor(null)} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2 disabled:opacity-50">{saving?<Save size={14} className="animate-spin"/>:<Save size={14}/>} {saving?'Saving…':editor.id?'Update Quiz':'Create Quiz'}</button></div></div></form></div>}
    {preStartQuiz&&<div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-7"><div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><ShieldAlert size={24}/></div><h2 className="text-2xl font-black text-slate-900 mt-5">Ready to start?</h2><p className="text-sm text-slate-500 mt-2">{preStartQuiz.title} · {preStartQuiz.assigned_classes?.[0]?.name||'Your class'}</p><div className="mt-5 space-y-2 text-sm text-slate-700"><div>• Full-screen is mandatory.</div><div>• Timer: <b>{formatDuration(preStartQuiz.duration_seconds||30)}</b>.</div><div>• One attempt only unless your trainer grants a reattempt.</div><div>• First full-screen/tab violation gives one warning; the second submits immediately.</div><div>• Copy, paste, right-click and common developer/print shortcuts are blocked in the exam.</div></div><div className="flex justify-end gap-2 mt-7"><button type="button" onClick={()=>setPreStartQuiz(null)} className="px-4 py-2.5 rounded-xl bg-slate-100 text-sm font-bold">Cancel</button><button type="button" onClick={beginExam} disabled={saving} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-50">{saving?'Starting…':'Enter Full Screen & Start'}</button></div></div></div>}
    {studentQuiz&&<StudentQuizModal quiz={studentQuiz} answers={answers} setAnswers={setAnswers} result={result} saving={saving} onSubmit={submitStudent} onClose={closeStudentQuiz}/>} 
    {reviewing&&<ReviewModal quiz={reviewing} attempts={attempts} trainer={user?.role==='trainer'} saving={saving} onGrant={grantReattempt} onClose={()=>setReviewing(null)}/>} 
  </div>;
}

function StudentQuizModal({ quiz, answers, setAnswers, result, saving, onSubmit, onClose }) {
  const duration = Number(quiz.__durationSeconds || quiz.duration_seconds || 30);
  const [remaining, setRemaining] = useState(duration);
  const [warning, setWarning] = useState('');
  const startedRef = useRef(quiz.__startedAt ? Date.parse(quiz.__startedAt) : Date.now());
  const violationRef = useRef(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (result) return undefined;
    const submitOnViolation = reason => {
      if (submittedRef.current) return;
      violationRef.current += 1;
      if (violationRef.current === 1) {
        setWarning(`${reason}. This is your final warning. A second security violation will immediately submit the exam.`);
        try { window.focus(); } catch { /* no-op */ }
        return;
      }
      submittedRef.current = true;
      onSubmit(true, violationRef.current);
    };
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedRef.current) / 1000));
      const next = Math.max(duration - elapsed, 0); setRemaining(next);
      if (next <= 0 && !submittedRef.current) { submittedRef.current = true; onSubmit(false, violationRef.current); }
    };
    const handleExit = () => { if (!document.fullscreenElement) submitOnViolation('Full-screen mode was exited'); };
    const handleVisibility = () => { if (document.visibilityState !== 'visible') submitOnViolation('The exam window was hidden or you switched away'); };
    const prevent = event => { event.preventDefault(); };
    const handleKey = event => {
      const key = String(event.key || '').toLowerCase(); const mod = event.ctrlKey || event.metaKey;
      if (key === 'f12' || key === 'printscreen' || key === 'contextmenu' || (mod && ['c','x','v','p','s','u'].includes(key)) || (mod && event.shiftKey && ['i','j','c'].includes(key)) || (event.altKey && key === 'arrowleft')) event.preventDefault();
    };
    document.addEventListener('fullscreenchange', handleExit); document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('contextmenu', prevent); document.addEventListener('copy', prevent); document.addEventListener('cut', prevent); document.addEventListener('paste', prevent); document.addEventListener('selectstart', prevent); document.addEventListener('dragstart', prevent); document.addEventListener('keydown', handleKey);
    const interval = window.setInterval(tick, 200); tick();
    return () => { window.clearInterval(interval); document.removeEventListener('fullscreenchange', handleExit); document.removeEventListener('visibilitychange', handleVisibility); document.removeEventListener('contextmenu', prevent); document.removeEventListener('copy', prevent); document.removeEventListener('cut', prevent); document.removeEventListener('paste', prevent); document.removeEventListener('selectstart', prevent); document.removeEventListener('dragstart', prevent); document.removeEventListener('keydown', handleKey); };
  }, [duration, onSubmit, result]);

  if (result) return <div className="fixed inset-0 z-[80] bg-slate-950 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl"><div className="text-center"><CheckCircle2 size={48} className="mx-auto text-emerald-600"/><p className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-600 mt-4">Assessment complete</p><h2 className="font-black text-2xl text-slate-900 mt-1">Exam submitted</h2><p className="text-sm text-slate-500 mt-2">Score: <b>{result.score ?? 0} / {result.total_marks ?? 0}</b> · <b>{result.percentage ?? 0}%</b> · Time {result.time_taken_seconds ?? 0}s</p></div><div className="mt-6 space-y-3"><h3 className="font-black text-slate-900">Detailed answers</h3>{(result.answers||[]).map((item,index)=><div key={item.question_id||index} className="rounded-2xl border border-slate-200 p-4"><p className="text-sm font-bold text-slate-900">{index+1}. {item.question}</p><div className="grid gap-2 mt-3">{Object.entries(item.options||{}).map(([letter,text])=><div key={letter} className={`rounded-xl border px-3 py-2 text-sm ${letter===item.correct?'border-emerald-300 bg-emerald-50':letter===item.selected?'border-rose-300 bg-rose-50':'border-slate-200'}`}><b>{letter}.</b> {text}{letter===item.correct&&<span className="ml-2 text-emerald-700 text-xs font-black">Correct</span>}{letter===item.selected&&letter!==item.correct&&<span className="ml-2 text-rose-700 text-xs font-black">Your answer</span>}</div>)}</div><p className="text-xs mt-3"><b>Your answer:</b> {item.selected||'Not answered'} · <b>Correct:</b> {item.correct}</p>{item.explanation&&<p className="text-xs text-slate-600 mt-2"><b>Explanation:</b> {item.explanation}</p>}</div>)}</div><button type="button" onClick={onClose} className="mt-6 w-full px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-black">Close</button></div></div>;

  return <div className="fixed inset-0 z-[80] bg-slate-950 flex items-stretch justify-center select-none"><form onContextMenu={e=>e.preventDefault()} onCopy={e=>e.preventDefault()} onCut={e=>e.preventDefault()} onPaste={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()} onSubmit={e=>{e.preventDefault();if(!submittedRef.current){submittedRef.current=true;onSubmit(false,violationRef.current);}}} className="w-full h-full bg-slate-50 overflow-y-auto"><div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-7 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[0.18em] font-black text-blue-600">Protected Exam</p><h2 className="font-black text-lg text-slate-900">{quiz.title}</h2><p className="text-xs text-slate-400 mt-0.5">{quiz.assigned_classes?.[0]?.name||'Class'} · 1 attempt · {formatDuration(duration)}</p></div><div className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-black ${remaining<=5?'bg-rose-100 text-rose-700':'bg-blue-100 text-blue-700'}`}><Timer size={16}/> {remaining}s</div></div>{warning&&<div className="sticky top-[73px] z-10 mx-4 sm:mx-7 mt-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-xs font-bold flex items-start gap-3"><ShieldAlert size={17} className="shrink-0"/><div>{warning}<button type="button" onClick={()=>setWarning('')} className="block mt-2 underline">Dismiss warning</button></div></div>}<div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-4">{rows(quiz.questions).map((q,index)=><div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm"><div className="text-[10px] uppercase tracking-wider font-black text-blue-600">Question {index+1}</div><p className="font-bold text-base text-slate-900 mt-2">{q.question_text}</p><div className="mt-4 grid gap-2">{['a','b','c','d'].map(letter=><label key={letter} className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm cursor-pointer transition ${answers[q.id]===letter.toUpperCase()?'border-blue-500 bg-blue-50':'border-slate-200 bg-white hover:bg-slate-50'}`}><input type="radio" name={`q-${q.id}`} checked={answers[q.id]===letter.toUpperCase()} onChange={()=>setAnswers(current=>({...current,[q.id]:letter.toUpperCase()}))} className="mt-0.5"/><span>{q[`option_${letter}`]}</span></label>)}</div></div>)}<button type="submit" disabled={saving} className="w-full py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-black disabled:opacity-50">{saving?'Submitting…':'Submit Exam'}</button></div></form></div>;
}

function ReviewModal({ quiz, attempts, trainer, saving, onGrant, onClose }) { return <div className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-white rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-5 sm:p-6"><div className="flex items-center justify-between mb-5"><div><p className="text-[10px] uppercase tracking-widest font-black text-emerald-600">Results & answers</p><h2 className="font-black text-xl text-slate-900 mt-1">{quiz.title}</h2><p className="text-xs text-slate-400 mt-1">Class-scoped student submissions</p></div><button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X size={18}/></button></div>{attempts.length===0?<p className="text-sm text-slate-500">No submitted attempts yet.</p>:<div className="space-y-4">{attempts.map(attempt=><div key={attempt.id} className={`rounded-2xl border p-4 ${attempt.status==='invalidated'?'border-amber-200 bg-amber-50':'border-slate-200 bg-white'}`}><div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3"><div><p className="font-black text-slate-900">{attempt.student_name||attempt.student_id}</p><p className="text-[10px] text-slate-400">{attempt.student_id} · {attempt.class_name||'—'} · Attempt #{attempt.attempt_number}</p></div><div className="flex flex-wrap gap-3 items-center text-xs"><span className="font-black">{attempt.score??0}/{attempt.total_points??0}</span><span className="font-black text-emerald-700">{attempt.percentage??0}%</span><span>{attempt.time_taken_seconds??0}s</span><span>{attempt.violation_count??0} violations</span>{trainer&&attempt.status!=='invalidated'&&<button type="button" disabled={saving} onClick={()=>onGrant(attempt)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black">Grant reattempt</button>}</div></div>{attempt.status==='invalidated'?<p className="text-xs text-amber-800 mt-3">This attempt was invalidated by the trainer and is no longer the student's active attempt.</p>:<div className="mt-4 grid gap-3">{(attempt.answers||[]).map((item,index)=><div key={item.question_id||index} className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold">{index+1}. {item.question}</p><p className="text-xs mt-2"><b>Student:</b> {item.selected||'Not answered'} · <b>Correct:</b> {item.correct} · <b>{item.is_correct?'Correct':'Incorrect'}</b></p>{item.explanation&&<p className="text-[11px] text-slate-500 mt-1"><b>Explanation:</b> {item.explanation}</p>}</div>)}</div>}</div>)}</div>}</div></div>; }
