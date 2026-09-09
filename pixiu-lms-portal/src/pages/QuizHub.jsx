import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Eye, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { apiFetch, useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import RefreshButton from '../components/ui/RefreshButton';

const rows = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const blankQuestion = () => ({
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_option: 'A',
  explanation: '',
  points: 1,
});

async function request(path, method = 'GET', body) {
  const response = await apiFetch(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.detail || data.error || data.message || `Request failed (${response.status})`,
    );
  }
  return data;
}

export default function QuizHub() {
  const { user } = useAuth();
  const { quizzes = [], classes = [], refreshAll, loading } = useData();
  const canManage = ['admin', 'superadmin', 'trainer'].includes(user?.role);

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
    if (!term) return quizzes;
    return quizzes.filter((item) =>
      `${item.title || ''} ${item.grade || ''} ${item.level || ''} ${item.unit_code || ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [quizzes, query]);

  const activeClasses = useMemo(
    () => classes.filter((item) => String(item.status || 'active').toLowerCase() !== 'inactive'),
    [classes],
  );

  const openCreate = () => {
    setError('');
    setEditor({
      id: null,
      form: {
        title: '',
        grade: '',
        level: '',
        unit_code: '',
        duration_minutes: 20,
        max_attempts: 1,
        status: 'active',
      },
      questions: [blankQuestion()],
      classId: '',
    });
  };

  const openEdit = (quiz) => {
    setError('');
    setEditor({
      id: quiz.id,
      form: {
        title: quiz.title || '',
        grade: quiz.grade || '',
        level: quiz.level || '',
        unit_code: quiz.unit_code || '',
        duration_minutes: quiz.duration_minutes || 20,
        max_attempts: 1,
        status: quiz.status || 'active',
      },
      questions: rows(quiz.questions).map((question) => ({
        ...blankQuestion(),
        ...question,
      })),
      classId: '',
    });
  };

  const updateQuestion = (index, patch) => {
    setEditor((current) => ({
      ...current,
      questions: current.questions.map((question, itemIndex) =>
        itemIndex === index ? { ...question, ...patch } : question,
      ),
    }));
  };

  const saveQuiz = async (event) => {
    event.preventDefault();
    if (!editor || saving) return;

    const valid = editor.questions.length > 0 && editor.questions.every(
      (question) =>
        question.question_text.trim() &&
        question.option_a.trim() &&
        question.option_b.trim() &&
        question.option_c.trim() &&
        question.option_d.trim(),
    );

    if (!valid) {
      setError('Every question needs question text and all four MCQ options.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...editor.form,
        grade: String(editor.form.grade).trim(),
        duration_minutes: Number(editor.form.duration_minutes),
        max_attempts: 1,
      };

      const saved = editor.id
        ? await request(`/quizzes/${editor.id}`, 'PATCH', payload)
        : await request('/quizzes', 'POST', payload);

      const quizId = editor.id || saved?.id || saved?.data?.id;
      if (!quizId) throw new Error('Quiz was saved but no quiz ID was returned.');

      for (const question of editor.questions) {
        const questionPayload = {
          quiz: quizId,
          question_text: question.question_text.trim(),
          option_a: question.option_a.trim(),
          option_b: question.option_b.trim(),
          option_c: question.option_c.trim(),
          option_d: question.option_d.trim(),
          correct_option: question.correct_option,
          explanation: question.explanation?.trim() || '',
          points: Number(question.points || 1),
        };

        if (question.id) {
          await request(`/quiz-questions/${question.id}`, 'PATCH', questionPayload);
        } else {
          await request('/quiz-questions', 'POST', questionPayload);
        }
      }

      if (editor.classId) {
        await request('/quiz-assignments', 'POST', {
          quiz: quizId,
          school_class: editor.classId,
          status: 'active',
        });
      }

      await refreshAll();
      setEditor(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (index) => {
    if (!editor) return;
    const question = editor.questions[index];

    if (question?.id) {
      try {
        await request(`/quiz-questions/${question.id}`, 'DELETE');
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    setEditor((current) => ({
      ...current,
      questions: current.questions.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const studentStart = (quiz) => {
    setError('');
    setStudentQuiz(quiz);
    setAnswers({});
    setResult(null);
  };

  const submitStudent = async (event) => {
    event.preventDefault();
    if (!studentQuiz || saving) return;

    setSaving(true);
    setError('');
    try {
      const submitted = await request(`/quizzes/${studentQuiz.id}/single-attempt`, 'POST', {
        answers,
        time_taken_seconds: 0,
        violation_count: 0,
      });
      setResult(submitted);
      await refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openReview = async (quiz) => {
    setReviewing(quiz);
    setSaving(true);
    setError('');
    try {
      const response = await request(`/quiz-review?quiz=${quiz.id}`);
      setAttempts(rows(response));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeAll = () => {
    setEditor(null);
    setStudentQuiz(null);
    setReviewing(null);
    setResult(null);
  };

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-600">Assessment</p>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            {user?.role === 'student' ? 'My Quizzes' : 'Quiz Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.role === 'student'
              ? 'Assigned MCQ quizzes with one server-enforced attempt per quiz.'
              : 'Create editable MCQ quizzes, assign them to live classes, and review student answers.'}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <RefreshButton onRefresh={refreshAll} loading={loading || saving} />
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black inline-flex items-center gap-2"
            >
              <Plus size={15} /> New MCQ Quiz
            </button>
          </div>
        )}
      </div>

      {error && (
        <ErrorState
          title="Quiz action failed"
          description={error}
          onRetry={() => setError('')}
        />
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label="Total quizzes" value={quizzes.length} />
        <Metric
          label="Active"
          value={quizzes.filter((quiz) => String(quiz.status).toLowerCase() === 'active').length}
        />
        <Metric
          label="Questions"
          value={quizzes.reduce((sum, quiz) => sum + rows(quiz.questions).length, 0)}
        />
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="relative max-w-xl">
          <Search size={15} className="absolute left-3 top-3 text-slate-400" />
          <input
            className="field pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search quizzes by title, grade or unit"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10">
          <EmptyState
            icon={<ClipboardCheck size={20} />}
            title="No quizzes"
            description={
              quizzes.length
                ? 'No quiz matches your search.'
                : 'No quiz records are available in your authorised scope.'
            }
          />
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((quiz) => (
            <article
              key={quiz.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ClipboardCheck size={17} />
                </span>
                <span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">
                  {quiz.status || 'active'}
                </span>
              </div>
              <h2 className="font-black text-slate-900 mt-4">{quiz.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Grade {quiz.grade || '—'} · {quiz.level || 'No level'} · {quiz.unit_code || 'No unit'}
              </p>
              <p className="text-[10px] text-slate-400 mt-3">
                {rows(quiz.questions).length} MCQs · {quiz.duration_minutes || 20} min · 1 attempt
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                {user?.role === 'student' ? (
                  <button
                    type="button"
                    disabled={String(quiz.status).toLowerCase() !== 'active'}
                    onClick={() => studentStart(quiz)}
                    className="px-3 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black disabled:opacity-40"
                  >
                    Start quiz
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(quiz)}
                      className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black"
                    >
                      Edit MCQs
                    </button>
                    <button
                      type="button"
                      onClick={() => openReview(quiz)}
                      className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black inline-flex items-center gap-1"
                    >
                      <Eye size={12} /> Answers
                    </button>
                    {user?.role !== 'trainer' && (
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-[10px] font-black"
                        onClick={async () => {
                          try {
                            await request(`/quizzes/${quiz.id}`, 'PATCH', { status: 'closed' });
                            await refreshAll();
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm p-4 flex items-center justify-center">
          <form
            onSubmit={saveQuiz}
            className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
          >
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-black text-lg text-slate-900">
                  {editor.id ? 'Edit MCQ Quiz' : 'Create MCQ Quiz'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">Every quiz is limited to one student attempt.</p>
              </div>
              <button type="button" onClick={() => setEditor(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="field"
                  placeholder="Quiz title"
                  value={editor.form.title}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      form: { ...current.form, title: event.target.value },
                    }))
                  }
                  required
                />
                <select
                  className="field"
                  value={editor.classId}
                  onChange={(event) => setEditor((current) => ({ ...current, classId: event.target.value }))}
                >
                  <option value="">Assign to class (optional)</option>
                  {activeClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name || item.name || item.id} · Grade {item.grade || '—'}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  placeholder="Grade"
                  value={editor.form.grade}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      form: { ...current.form, grade: event.target.value },
                    }))
                  }
                  required
                />
                <input
                  className="field"
                  placeholder="Level"
                  value={editor.form.level}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      form: { ...current.form, level: event.target.value },
                    }))
                  }
                />
                <input
                  className="field"
                  placeholder="Unit code"
                  value={editor.form.unit_code}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      form: { ...current.form, unit_code: event.target.value },
                    }))
                  }
                />
                <input
                  type="number"
                  min="1"
                  className="field"
                  placeholder="Duration (minutes)"
                  value={editor.form.duration_minutes}
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      form: { ...current.form, duration_minutes: event.target.value },
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900">Questions</h3>
                  <p className="text-xs text-slate-400">A, B, C and D are always shown to students.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditor((current) => ({
                      ...current,
                      questions: [...current.questions, blankQuestion()],
                    }))
                  }
                  className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-black"
                >
                  <Plus size={13} className="inline mr-1" /> Add MCQ
                </button>
              </div>

              <div className="space-y-4">
                {editor.questions.map((question, index) => (
                  <div key={question.id || index} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-slate-700">Question {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => deleteQuestion(index)}
                        className="p-1.5 rounded-lg bg-white text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <textarea
                      className="field min-h-20"
                      placeholder="Ask the question…"
                      value={question.question_text}
                      onChange={(event) => updateQuestion(index, { question_text: event.target.value })}
                      required
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {[
                        ['option_a', 'A'],
                        ['option_b', 'B'],
                        ['option_c', 'C'],
                        ['option_d', 'D'],
                      ].map(([field, label]) => (
                        <input
                          key={field}
                          className="field"
                          placeholder={`Option ${label}`}
                          value={question[field]}
                          onChange={(event) => updateQuestion(index, { [field]: event.target.value })}
                          required
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <select
                        className="field"
                        value={question.correct_option}
                        onChange={(event) => updateQuestion(index, { correct_option: event.target.value })}
                      >
                        <option value="A">Correct: A</option>
                        <option value="B">Correct: B</option>
                        <option value="C">Correct: C</option>
                        <option value="D">Correct: D</option>
                      </select>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        className="field"
                        value={question.points}
                        onChange={(event) => updateQuestion(index, { points: event.target.value })}
                      />
                    </div>

                    <input
                      className="field mt-2"
                      placeholder="Explanation (shown in review)"
                      value={question.explanation || ''}
                      onChange={(event) => updateQuestion(index, { explanation: event.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditor(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black"
              >
                <Save size={14} className="inline mr-1" />
                {saving ? 'Saving…' : 'Save Quiz'}
              </button>
            </div>
          </form>
        </div>
      )}

      {studentQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-black text-blue-600">MCQ Quiz · One attempt</p>
                <h2 className="text-xl font-black text-slate-900 mt-1">{studentQuiz.title}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Answer each question and submit once. The server prevents a second attempt.
                </p>
              </div>
              <button type="button" onClick={() => setStudentQuiz(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {result ? (
              <div className="p-10 text-center">
                <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
                <h3 className="text-2xl font-black mt-3">Quiz submitted</h3>
                <p className="text-sm text-slate-500 mt-2">
                  Score: {result.score ?? '—'} / {result.total_points ?? '—'}
                </p>
                <button
                  type="button"
                  onClick={() => setStudentQuiz(null)}
                  className="mt-5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-black"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submitStudent} className="p-5 space-y-4">
                {rows(studentQuiz.questions).map((question, index) => (
                  <fieldset key={question.id} className="rounded-2xl border border-slate-200 p-4">
                    <legend className="px-2 text-sm font-black text-slate-900">
                      {index + 1}. {question.question_text}
                    </legend>
                    <div className="space-y-2 mt-2">
                      {[
                        ['A', question.option_a],
                        ['B', question.option_b],
                        ['C', question.option_c],
                        ['D', question.option_d],
                      ].map(([option, text]) => (
                        <label
                          key={option}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="radio"
                            name={String(question.id)}
                            checked={answers[question.id] === option}
                            onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                            required
                          />
                          <span className="font-black text-slate-700">{option}</span>
                          <span className="text-sm text-slate-700">{text}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-40"
                >
                  {saving ? 'Submitting…' : 'Submit quiz — 1 attempt only'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-black text-lg">Student answers · {reviewing.title}</h2>
                <p className="text-xs text-slate-400 mt-1">Trainer/admin view of server-graded answers.</p>
              </div>
              <button type="button" onClick={() => setReviewing(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {attempts.length === 0 ? (
                <EmptyState title="No attempts yet" description="Students who complete this quiz will appear here." />
              ) : (
                attempts.map((attempt) => (
                  <article key={attempt.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <p className="font-black">{attempt.student_name || 'Student'}</p>
                        <p className="text-[10px] font-mono text-slate-400">{attempt.student_id || '—'}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-slate-100 text-xs font-black">
                        {attempt.score ?? '—'} / {attempt.total_points ?? '—'}
                      </span>
                    </div>

                    <div className="space-y-3 mt-4">
                      {rows(attempt.answers).map((answer) => (
                        <div key={answer.question_id} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-sm font-bold">{answer.question}</p>
                          <p
                            className={`text-xs mt-2 font-semibold ${
                              answer.is_correct ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            Selected: {answer.selected || '—'} · Correct: {answer.correct || '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .field {
          width: 100%;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #334155;
          background: white;
          outline: none;
        }
        .field:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <p className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
    </div>
  );
}
