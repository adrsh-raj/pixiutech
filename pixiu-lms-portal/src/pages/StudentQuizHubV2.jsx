import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Clock3, Download, Eye, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import QuizExamEngine from '../components/quiz/QuizExamEngine';

const rows = value => Array.isArray(value) ? value : Array.isArray(value?.results) ? value.results : Array.isArray(value?.data) ? value.data : [];
const text = value => String(value ?? '').trim();

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, { method, cache: 'no-store', ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fields = data?.fields && typeof data.fields === 'object' ? data.fields : {};
    const fieldMessage = Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' ');
    throw new Error(data?.detail || data?.error || data?.message || fieldMessage || `Request failed (${response.status})`);
  }
  return data;
}

function ResultModal({ result, onClose }) {
  if (!result) return null;
  const answers = rows(result.answers);
  const percentage = Number(result.percentage || 0);
  const download = async kind => {
    const response = await apiFetch(`/quiz-results/${encodeURIComponent(result.id)}/pdf?kind=${kind}`, { method: 'GET', cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to generate ${kind === 'key' ? 'answer key' : 'answers'} PDF (${response.status}).`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pixiu-${kind === 'key' ? 'answer-key' : 'my-answers'}-${result.student_id || 'student'}.pdf`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };
  return <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center">
    <div className="w-full max-w-4xl max-h-[94vh] overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 flex flex-col">
      <header className="p-5 sm:p-6 border-b border-slate-100 bg-slate-950 text-white flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><img src="/img/logo.png" alt="Pixiu Tech" className="w-11 h-11 rounded-xl object-contain bg-white p-1" onError={e => { e.currentTarget.style.display = 'none'; }} /><div><p className="text-[10px] uppercase tracking-[.2em] text-blue-300 font-black">Pixiu Tech Assessment</p><h2 className="text-xl font-black mt-1">{result.quiz_title || 'Quiz Result'}</h2><p className="text-xs text-slate-300 mt-1">{result.student_name} · {result.student_id}</p></div></div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20"><X size={18}/></button>
      </header>
      <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-slate-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-white border border-slate-200 p-4"><p className="text-[9px] uppercase font-black text-slate-400">Score</p><p className="text-2xl font-black text-slate-900 mt-1">{result.score} / {result.total_marks}</p><p className="text-xs font-bold text-emerald-600 mt-1">{percentage}%</p></div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4"><p className="text-[9px] uppercase font-black text-slate-400">Correct</p><p className="text-2xl font-black text-emerald-700 mt-1">{result.correct_answers}</p></div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4"><p className="text-[9px] uppercase font-black text-slate-400">Questions</p><p className="text-2xl font-black text-slate-900 mt-1">{result.total_questions}</p></div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4"><p className="text-[9px] uppercase font-black text-slate-400">Attempt</p><p className="text-2xl font-black text-blue-700 mt-1">#{result.attempt_number}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => download('answers').catch(err => window.alert(err.message))} className="px-3.5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"><Download size={14}/> Download My Answers PDF</button>
          <button type="button" onClick={() => download('key').catch(err => window.alert(err.message))} className="px-3.5 py-2.5 rounded-xl bg-violet-600 text-white text-xs font-black inline-flex items-center gap-2"><Download size={14}/> Download Real Answer Key PDF</button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-black text-slate-900">Question-by-question review</h3><span className="text-[10px] font-bold text-slate-400">Server-evaluated</span></div>
          {answers.map((item, index) => <article key={item.question_id || index} className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">{index + 1}</span><div><p className="font-bold text-slate-900">{item.question}</p><p className="text-[10px] text-slate-400 mt-1">{item.points} mark{Number(item.points) === 1 ? '' : 's'}</p></div></div><span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${item.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{item.is_correct ? 'Correct' : 'Incorrect'}</span></div>
            <div className="grid md:grid-cols-2 gap-3 mt-4"><div className="rounded-xl bg-blue-50 border border-blue-100 p-3"><p className="text-[9px] uppercase font-black text-blue-700">Your answer</p><p className="text-sm font-bold text-slate-800 mt-1">{item.selected ? `${item.selected}. ${item.options?.[item.selected] || ''}` : 'Not answered'}</p></div><div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3"><p className="text-[9px] uppercase font-black text-emerald-700">Real answer</p><p className="text-sm font-bold text-slate-800 mt-1">{item.correct}. {item.options?.[item.correct] || ''}</p></div></div>
            {item.explanation && <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600"><b>Explanation:</b> {item.explanation}</div>}
          </article>)}
        </div>
      </div>
      <footer className="p-4 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between gap-3"><span className="text-[10px] text-slate-400 font-semibold inline-flex items-center gap-1.5"><ShieldCheck size={13}/> Pixiu Tech server-verified result</span><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black">Close</button></footer>
    </div>
  </div>;
}

export default function StudentQuizHubV2() {
  const { quizzes = [], students = [], refreshAll, loading } = useData();
  const student = students[0] || null;
  const [attempts, setAttempts] = useState([]);
  const [exam, setExam] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadAttempts = async () => {
    setBusy(true); setError('');
    try { setAttempts(rows(await request('/quiz-submissions'))); } catch (err) { setError(err.message || 'Unable to load quiz attempts.'); } finally { setBusy(false); }
  };
  useEffect(() => { loadAttempts(); }, []);

  const attemptedByQuiz = useMemo(() => new Map(attempts.filter(a => text(a.status).toLowerCase() === 'completed').map(a => [String(a.quiz), a])), [attempts]);

  const startQuiz = async quiz => {
    if (!student) { setError('Student profile is not available for this account.'); return; }
    setBusy(true); setError('');
    try {
      const started = await request(`/quizzes/${encodeURIComponent(quiz.id)}/start`, 'POST', {});
      setExam({ ...quiz, duration_minutes: Math.max(1, Math.ceil(Number(started.duration_seconds || quiz.duration_seconds || 60) / 60)), __attemptId: started.attempt_id, __startedAt: started.started_at, __duration: started.duration_seconds });
    } catch (err) { setError(err.message || 'Unable to start quiz.'); } finally { setBusy(false); }
  };

  const submitQuiz = async payload => {
    if (!exam) return;
    setBusy(true); setError('');
    try {
      const response = await request(`/quizzes/${encodeURIComponent(exam.id)}/single-attempt`, 'POST', { attempt_id: exam.__attemptId, answers: payload.answers, time_taken_seconds: payload.time_taken_seconds, violation_count: payload.violation_count });
      setResult(response);
      setExam(null);
      setAttempts(prev => [response, ...prev.filter(a => String(a.id) !== String(response.id))]);
      await refreshAll();
    } catch (err) { setError(err.message || 'Quiz submission failed.'); }
    finally { setBusy(false); }
  };

  const viewResult = async attempt => {
    setBusy(true); setError('');
    try { setResult(await request(`/quiz-results/${encodeURIComponent(attempt.id)}`)); } catch (err) { setError(err.message || 'Unable to load result.'); } finally { setBusy(false); }
  };

  if (exam) return <QuizExamEngine quiz={exam} student={student} onSubmit={submitQuiz} onCancel={() => setExam(null)} />;

  return <div className="space-y-6 pb-10">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[.2em] font-black text-blue-600">Assessment</p><h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">My Quizzes</h1><p className="text-sm text-slate-500 mt-1">Attempted quizzes remain locked, with your server-recorded score and downloadable result documents.</p></div><button type="button" onClick={loadAttempts} disabled={busy || loading} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-black inline-flex items-center gap-2"><RefreshCw size={14} className={busy ? 'animate-spin' : ''}/> Refresh</button></div>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}
    {!quizzes.length ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-400">No quizzes are assigned to your class yet.</div> : <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{quizzes.map(quiz => {
      const attempt = attemptedByQuiz.get(String(quiz.id));
      return <article key={quiz.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><ClipboardCheck size={18}/></div>{attempt ? <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase inline-flex items-center gap-1"><CheckCircle2 size={11}/> Attempted</span> : <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-black uppercase">Available</span>}</div>
        <h2 className="font-black text-slate-900 mt-4">{quiz.title}</h2><p className="text-xs text-slate-500 mt-1">Grade {quiz.grade || '—'} · {quiz.level || '—'} · {quiz.unit_code || '—'}</p><p className="text-[10px] text-slate-400 mt-3">{rows(quiz.questions).length} questions · <Clock3 size={10} className="inline"/> {quiz.duration_seconds || 60}s</p>
        {attempt && <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 p-4"><p className="text-[9px] uppercase font-black text-emerald-700">Final score</p><p className="text-3xl font-black text-emerald-900 mt-1">{attempt.score} <span className="text-base text-emerald-600">/ {attempt.total_marks}</span></p><p className="text-xs font-bold text-emerald-700 mt-1">{attempt.percentage}% · {attempt.correct_count} correct</p></div>}
        <div className="flex flex-wrap gap-2 mt-4">{attempt ? <><button type="button" onClick={() => viewResult(attempt)} disabled={busy} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black inline-flex items-center gap-1.5"><Eye size={12}/> View result</button><button type="button" onClick={() => viewResult(attempt)} disabled={busy} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black inline-flex items-center gap-1.5"><Download size={12}/> PDFs</button></> : <button type="button" onClick={() => startQuiz(quiz)} disabled={busy || text(quiz.status).toLowerCase() !== 'active'} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-[10px] font-black disabled:opacity-40">Start exam</button>}</div>
      </article>;
    })}</section>}
    {result && <ResultModal result={result} onClose={() => setResult(null)} />}
  </div>;
}
