import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Eye, Plus, Save, Search, ShieldAlert, Timer, Trash2, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const EXAM_SECONDS = 30;
const rows = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : Array.isArray(value?.data) ? value.data : [];
const blankQuestion = () => ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', explanation: '', points: 1 });

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}), cache: 'no-store' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || data.message || `Request failed (${response.status})`);
  return data;
}

export default function QuizHub() {
  const { user } = useAuth();
  const { quizzes = [], classes = [], refreshAll, loading } = useData();
  const canManage = ['admin', 'superadmin', 'trainer'].includes(user?.role);
  const canViewResults = ['admin', 'school', 'trainer'].includes(user?.role);
  const activeClasses = useMemo(() => classes.filter(item => String(item.status || 'active').toLowerCase() !== 'inactive'), [classes]);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
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
    setEditor({ id: null, classId: '', form: { title: '', grade: '', level: '', unit_code: '', duration_minutes: 1, max_attempts: 1, status: 'active' }, questions: [blankQuestion()] });
  };

  const openEdit = quiz => {
    setError('');
    setEditor({
      id: quiz.id,
      classId: quiz.assigned_classes?.[0]?.id || '',
      form: { title: quiz.title || '', grade: quiz.grade || '', level: quiz.level || '', unit_code: quiz.unit_code || '', duration_minutes: quiz.duration_minutes || 1, max_attempts: 1, status: quiz.status || 'active' },
      questions: rows(quiz.questions).map(q => ({ ...blankQuestion(), ...q })),
    });
  };

  const selectClass = classId => setEditor(current => {
    const cls = activeClasses.find(item => String(item.id) === String(classId));
    return { ...current, classId, form: { ...current.form, grade: cls?.grade || '' } };
  });

  const updateQuestion = (index, patch) => setEditor(current => ({ ...current, questions: current.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));

  const saveQuiz = async event => {
    event.preventDefault();
    if (!editor || saving) return;
    if (!editor.classId) return setError('Select the exact class that should receive this quiz.');
    const selectedClass = activeClasses.find(item => String(item.id) === String(editor.classId));
    if (!selectedClass) return setError('Selected class is no longer active.');
    if (String(editor.form.grade).trim() !== String(selectedClass.grade).trim()) return setError('Quiz grade must match the selected class grade.');
    const valid = editor.questions.length > 0 && editor.questions.every(q => q.question_text.trim() && q.option_a.trim() && q.option_b.trim() && q.option_c.trim() && q.option_d.trim());
    if (!valid) return setError('Every question needs question text and all four options.');
    setSaving(true); setError('');
    try {
      const payload = { ...editor.form, grade: String(selectedClass.grade).trim(), max_attempts: 1, duration_minutes: 1 };
      const questionPayloads = editor.questions.map(q => ({ question_text: q.question_text.trim(), option_a: q.option_a.trim(), option_b: q.option_b.trim(), option_c: q.option_c.trim(), option_d: q.option_d.trim(), correct_option: q.correct_option, explanation: q.explanation?.trim() || '', points: Number(q.points || 1) }));
      if (editor.id) {
        await request(`/quizzes/${editor.id}`, 'PATCH', payload);
        for (const question of editor.questions) {
          const body = { quiz: editor.id, question_text: question.question_text.trim(), option_a: question.option_a.trim(), option_b: question.option_b.trim(), option_c: question.option_c.trim(), option_d: question.option_d.trim(), correct_option: question.correct_option, explanation: question.explanation?.trim() || '', points: Number(question.points || 1) };
          if (question.id) await request(`/quiz-questions/${question.id}`, 'PATCH', body); else await request('/quiz-questions', 'POST', body);
        }
        await request('/quiz-assignments', 'POST', { quiz: editor.id, school_class: editor.classId });
      } else {
        await request('/quizzes/create-with-questions', 'POST', { ...payload, school_class: editor.classId, questions: questionPayloads });
      }
      await refreshAll();
      setEditor(null);
    } catch (err) { setError(err.message || 'Quiz creation failed.'); } finally { setSaving(false); }
  };

  const deleteQuestion = async index => {
    const question = editor?.questions[index];
    if (question?.id) { try { await request(`/quiz-questions/${question.id}`, 'DELETE'); } catch (err) { setError(err.message); return; } }
    setEditor(current => ({ ...current, questions: current.questions.filter((_, i) => i !== index) }));
  };

  const startStudentQuiz = async quiz => {
    setError('');
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      if (document.fullscreenElement || !document.documentElement.requestFullscreen) {
        setStudentQuiz(quiz); setAnswers({}); setResult(null);
      } else {
        throw new Error('Full-screen mode is required to start the exam.');
      }
    } catch (err) { setError(err.message || 'Full-screen mode is required.'); }
  };

  const submitStudent = async (forcedViolation = false) => {
    if (!studentQuiz || saving) return;
    setSaving(true); setError('');
    try {
      const timeTaken = Math.min(EXAM_SECONDS, Number(studentQuiz.__elapsed || 0));
      const submitted = await request(`/quizzes/${studentQuiz.id}/single-attempt`, 'POST', { answers, time_taken_seconds: timeTaken, violation_count: forcedViolation ? 1 : 0 });
      setResult(submitted); await refreshAll();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const closeStudentQuiz = async () => {
    setStudentQuiz(null); setResult(null);
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* browser may already have exited */ } }
  };

  const openReview = async quiz => {
    setReviewing(quiz); setSaving(true); setError('');
    try { setAttempts(rows(await request(`/quiz-review?quiz=${encodeURIComponent(quiz.id)}`))); } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="space-y-5 pb-10">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Assessment</p><h1 className="text-2xl font-black text-slate-900 mt-1">{user?.role === 'student' ? 'My Quizzes' : 'Quiz Management'}</h1><p className="text-sm text-slate-500 mt-1">Every quiz belongs to one exact class. Grade is derived from that class and students get one 30-second full-screen attempt.</p></div>{canManage && <div className="flex gap-2"><RefreshButton onRefresh={refreshAll} loading={loading || saving}/><button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Plus size={15}/> New MCQ Quiz</button></div>}</div>
    {error && <ErrorState title="Quiz action failed" description={error} onRetry={() => setError('')}/>} 
    {user?.role === 'student' && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3"><ShieldAlert size={18} className="shrink-0 mt-0.5"/><div><b>Exam rules:</b> Full-screen is mandatory, exactly 30 seconds are allowed, one attempt only, and leaving full-screen/visibility triggers submission with a violation.</div></div>}
    {canViewResults && user?.role !== 'student' && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-900">Quiz marks are visible to authorised trainers, the selected school and administrators. Each viewer only receives results inside their authorised class/school scope.</div>}
    <div className="bg-white border border-slate-200 rounded-2xl p-4"><div className="relative max-w-xl"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className="field pl-9" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by quiz, grade, unit or class"/></div></div>
    {filtered.length === 0 ? <div className="bg-white border border-slate-200 rounded-2xl p-10"><EmptyState icon={<ClipboardCheck size={20}/>} title="No quizzes" description="No quiz records are available in this authorised scope."/></div> : <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{filtered.map(quiz => <article key={quiz.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex items-center justify-between"><span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><ClipboardCheck size={17}/></span><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{quiz.status || 'active'}</span></div><h2 className="font-black text-slate-900 mt-4">{quiz.title}</h2><p className="text-xs text-slate-500 mt-1">{quiz.assigned_classes?.[0]?.name || 'Class'} · Grade {quiz.grade || '—'} · {quiz.level || 'No level'} · {quiz.unit_code || 'No unit'}</p><p className="text-[10px] text-slate-400 mt-3">{rows(quiz.questions).length} MCQs · 30 sec · 1 attempt</p><div className="flex flex-wrap gap-2 mt-4">{user?.role === 'student' ? <button type="button" disabled={String(quiz.status).toLowerCase() !== 'active'} onClick={() => startStudentQuiz(quiz)} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black disabled:opacity-40">Start Exam</button> : <>{canManage && <button type="button" onClick={() => openEdit(quiz)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black">Edit MCQs</button>}{canViewResults && <button type="button" onClick={() => openReview(quiz)} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black inline-flex items-center gap-1"><Eye size={12}/> Results & Answers</button>}</>}</div></article>)}</section>}

    {editor && <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><form onSubmit={saveQuiz} className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"><div className="sticky top-0 z-10 bg-white/95 backdrop-blur p-5 border-b border-slate-100 flex items-center justify-between"><div><h2 className="font-black text-lg text-slate-900">{editor.id ? 'Edit MCQ Quiz' : 'Create MCQ Quiz'}</h2><p className="text-xs text-slate-400 mt-1">Class is required. Grade is read-only from the selected class. Exam time is fixed at 30 seconds.</p></div><button type="button" onClick={() => setEditor(null)} className="p-2 rounded-lg hover:bg-slate-100"><X size={18}/></button></div><div className="p-5 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input className="field" placeholder="Quiz title" value={editor.form.title} onChange={e => setEditor(c => ({...c, form:{...c.form,title:e.target.value}}))} required/><select className="field" value={editor.classId} onChange={e => selectClass(e.target.value)} required><option value="">Select exact class (required)</option>{activeClasses.map(item => <option key={item.id} value={item.id}>{item.display_name || item.id} · Grade {item.grade}</option>)}</select><input className="field bg-slate-50" placeholder="Grade" value={editor.form.grade} readOnly/><input className="field" placeholder="Level" value={editor.form.level} onChange={e => setEditor(c => ({...c,form:{...c.form,level:e.target.value}}))}/><input className="field" placeholder="Unit code" value={editor.form.unit_code} onChange={e => setEditor(c => ({...c,form:{...c.form,unit_code:e.target.value}}))}/><div className="field bg-slate-50 flex items-center gap-2 text-sm font-bold"><Timer size={15}/> 30 seconds · 1 attempt</div></div><div className="flex items-center justify-between"><div><h3 className="font-black text-slate-900">Questions</h3><p className="text-xs text-slate-400">A, B, C and D are always shown.</p></div><button type="button" onClick={() => setEditor(c => ({...c,questions:[...c.questions,blankQuestion()]}))} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-black"><Plus size={13} className="inline mr-1"/> Add MCQ</button></div>{editor.questions.map((q,index)=><div key={q.id||index} className="border border-slate-200 rounded-xl p-4 space-y-3"><div className="flex items-center justify-between"><h4 className="font-bold text-slate-700">Question {index+1}</h4><button type="button" onClick={() => deleteQuestion(index)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"><Trash2 size={14}/></button></div><textarea className="field min-h-20" placeholder="Question" value={q.question_text} onChange={e => updateQuestion(index,{question_text:e.target.value})} required/><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{['a','b','c','d'].map(letter=><input key={letter} className="field" placeholder={`Option ${letter.toUpperCase()}`} value={q[`option_${letter}`]} onChange={e=>updateQuestion(index,{[`option_${letter}`]:e.target.value})} required/>)}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><select className="field" value={q.correct_option} onChange={e=>updateQuestion(index,{correct_option:e.target.value})}><option value="A">Correct option A</option><option value="B">Correct option B</option><option value="C">Correct option C</option><option value="D">Correct option D</option></select><input className="field" type="number" min="1" value={q.points} onChange={e=>updateQuestion(index,{points:e.target.value})} placeholder="Points"/></div><textarea className="field min-h-16" placeholder="Explanation (optional)" value={q.explanation} onChange={e=>updateQuestion(index,{explanation:e.target.value})}/></div>)}<div className="flex justify-end gap-2"><button type="button" onClick={()=>setEditor(null)} className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold">Cancel</button><button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2 disabled:opacity-50">{saving?<Save size={14} className="animate-spin"/>:<Save size={14}/>} {saving?'Saving…':'Save Quiz'}</button></div></div></form></div>}
    {studentQuiz && <StudentQuizModal quiz={studentQuiz} answers={answers} setAnswers={setAnswers} result={result} saving={saving} onSubmit={submitStudent} onClose={closeStudentQuiz}/>} 
    {reviewing && <ReviewModal quiz={reviewing} attempts={attempts} onClose={()=>setReviewing(null)}/>} 
  </div>;
}

function StudentQuizModal({ quiz, answers, setAnswers, result, saving, onSubmit, onClose }) {
  const [remaining, setRemaining] = useState(EXAM_SECONDS);
  const startedRef = useRef(Date.now());
  const submittedRef = useRef(false);
  useEffect(() => {
    if (result) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
      quiz.__elapsed = elapsed;
      const next = Math.max(EXAM_SECONDS - elapsed, 0);
      setRemaining(next);
      if (next <= 0 && !submittedRef.current) { submittedRef.current = true; onSubmit(false); }
    };
    const interval = setInterval(tick, 250);
    const handleExit = () => { if (!document.fullscreenElement && !submittedRef.current) { submittedRef.current = true; onSubmit(true); } };
    const handleVisibility = () => { if (document.visibilityState !== 'visible' && !submittedRef.current) { submittedRef.current = true; onSubmit(true); } };
    document.addEventListener('fullscreenchange', handleExit);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { clearInterval(interval); document.removeEventListener('fullscreenchange', handleExit); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [onSubmit, result, quiz]);
  if (result) return <div className="fixed inset-0 z-[70] bg-slate-950 flex items-center justify-center p-4"><div className="bg-white rounded-3xl w-full max-w-lg p-7 text-center shadow-2xl"><CheckCircle2 size={48} className="mx-auto text-emerald-600"/><h2 className="font-black text-2xl mt-3">Exam submitted</h2><p className="text-sm text-slate-500 mt-2">Score: {result.score ?? 0} / {result.total_marks ?? 0} · {result.percentage ?? 0}%</p><button type="button" onClick={onClose} className="mt-6 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black">Close</button></div></div>;
  return <div className="fixed inset-0 z-[70] bg-slate-950 flex items-stretch justify-center"><form onSubmit={e => { e.preventDefault(); if (!submittedRef.current) { submittedRef.current = true; onSubmit(false); } }} className="w-full h-full bg-white overflow-y-auto"><div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-lg">{quiz.title}</h2><p className="text-xs text-slate-400">Full-screen · one attempt · class {quiz.assigned_classes?.[0]?.name || '—'}</p></div><div className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black ${remaining <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}><Timer size={16}/> {remaining}s</div></div><div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-5">{rows(quiz.questions).map((q,index)=><div key={q.id} className="border border-slate-200 rounded-2xl p-5"><p className="font-bold text-base text-slate-800">{index+1}. {q.question_text}</p><div className="mt-4 grid gap-2">{['a','b','c','d'].map(letter=><label key={letter} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50 cursor-pointer"><input type="radio" name={`q-${q.id}`} checked={answers[q.id]===letter.toUpperCase()} onChange={()=>setAnswers(current=>({...current,[q.id]:letter.toUpperCase()}))}/><span>{q[`option_${letter}`]}</span></label>)}</div></div>)}<button type="submit" disabled={saving} className="w-full py-3.5 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-50">{saving?'Submitting…':'Submit Exam'}</button></div></form></div>;
}

function ReviewModal({ quiz, attempts, onClose }) { return <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center"><div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-black text-lg">{quiz.title} — Results</h2><p className="text-xs text-slate-400">Class-scoped marks and answer records</p></div><button type="button" onClick={onClose} className="p-2"><X size={18}/></button></div>{attempts.length===0?<p className="text-sm text-slate-500">No submitted attempts yet.</p>:<div className="space-y-2">{attempts.map(attempt=><div key={attempt.id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black">{attempt.student_name || attempt.student_id || 'Student'}</p><p className="text-xs text-slate-400">{attempt.student_id || ''} · {attempt.class_name || ''} · {attempt.school_name || ''} · {attempt.time_taken_seconds ?? 0}s · Violations {attempt.violation_count ?? 0}</p></div><div className="text-right"><p className="text-lg font-black text-emerald-700">{attempt.score ?? 0} / {attempt.total_points ?? 0}</p><p className="text-xs font-bold text-slate-500">{attempt.percentage ?? 0}%</p></div></div>)}</div>}</div></div>; }
