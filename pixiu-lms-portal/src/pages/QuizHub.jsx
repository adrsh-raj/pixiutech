import { useMemo, useState } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';

export default function QuizHub() {
  const { quizzes = [], quizSubmissions = [] } = useData();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => quizzes.filter(quiz => `${quiz.title || ''} ${quiz.grade || ''} ${quiz.level || ''} ${quiz.unit_code || ''}`.toLowerCase().includes(query.toLowerCase().trim())), [quizzes, query]);
  return <div className="space-y-5 pb-10">
    <PageHeader eyebrow="Academics" title="Quizzes" description="Canonical quiz records and recorded attempts from the learning database." />
    <section className="bg-white border border-slate-200 rounded-2xl p-4"><div className="relative max-w-xl"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search quizzes" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400"/></div></section>
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Metric label="Quizzes" value={quizzes.length}/><Metric label="Active" value={quizzes.filter(q => String(q.status).toLowerCase() === 'active').length}/><Metric label="Attempts" value={quizSubmissions.length}/></section>
    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{['Quiz','Grade','Level','Status','Attempts'].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide text-slate-400 font-black">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(quiz => <tr key={quiz.id}><td className="px-4 py-4"><p className="font-bold text-slate-800">{quiz.title}</p><p className="text-[10px] text-slate-400">{quiz.unit_code || '—'}</p></td><td className="px-4 py-4">{quiz.grade || '—'}</td><td className="px-4 py-4">{quiz.level || '—'}</td><td className="px-4 py-4"><span className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-black uppercase">{quiz.status || '—'}</span></td><td className="px-4 py-4">{quizSubmissions.filter(attempt => String(attempt.quiz || attempt.quiz_id) === String(quiz.id)).length}</td></tr>)}{!rows.length && <tr><td colSpan={5}><EmptyState icon={<ClipboardCheck size={18}/>} title="No quizzes" description="No canonical quiz records match the current search."/></td></tr>}</tbody></table></div></section>
  </div>;
}
function Metric({ label, value }) { return <div className="bg-white border border-slate-200 rounded-2xl p-4"><p className="text-[9px] uppercase tracking-wide font-black text-slate-400">{label}</p><p className="text-2xl font-black text-slate-900 mt-2">{value}</p></div>; }
