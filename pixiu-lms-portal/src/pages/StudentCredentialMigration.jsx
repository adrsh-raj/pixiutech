import { useMemo, useState } from 'react';
import { Download, FileText, KeyRound, ShieldAlert, Loader2 } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';

async function downloadExport(batchId, format, rows, schoolCode, className) {
  const response = await apiFetch(`/students/credentials/migrate/${batchId}/${format}`, {
    method: 'POST',
    body: JSON.stringify({ rows, school_code: schoolCode, class_name: className }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Unable to generate ${format.toUpperCase()}.`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = format === 'pdf' ? 'pixiu-student-credentials.pdf' : 'pixiu-student-credentials.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function StudentCredentialMigration() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [rows, setRows] = useState([]);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });
  const [schoolCode, setSchoolCode] = useState('');
  const [className, setClassName] = useState('');
  const [exporting, setExporting] = useState('');

  const schools = useMemo(() => [...new Set(rows.map(row => row.school_code))].sort(), [rows]);
  const classes = useMemo(() => [...new Set(rows.filter(row => !schoolCode || row.school_code === schoolCode).map(row => row.class_name))].sort(), [rows, schoolCode]);
  const filteredCount = useMemo(() => rows.filter(row => (!schoolCode || row.school_code === schoolCode) && (!className || row.class_name === className)).length, [rows, schoolCode, className]);

  const migrate = async () => {
    if (!window.confirm('This will replace the password for every active student with a fresh random 8-digit temporary PIN. Continue?')) return;
    setBusy(true);
    setRows([]);
    setSchoolCode('');
    setClassName('');
    setProgress({ processed: 0, total: 0 });
    try {
      const startResponse = await apiFetch('/students/credentials/migrate', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'RESET_ALL_STUDENT_CREDENTIALS' }),
      });
      const startData = await startResponse.json().catch(() => ({}));
      if (!startResponse.ok) throw new Error(startData.detail || 'Unable to start credential migration.');
      setBatchId(startData.batch_id);
      setProgress({ processed: 0, total: startData.total_count });

      let complete = false;
      let allRows = [];
      while (!complete) {
        const stepResponse = await apiFetch(`/students/credentials/migrate/${startData.batch_id}/process`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        const stepData = await stepResponse.json().catch(() => ({}));
        if (!stepResponse.ok) throw new Error(stepData.detail || 'Credential migration failed.');
        allRows = allRows.concat(stepData.rows || []);
        setRows([...allRows]);
        setProgress({ processed: stepData.processed_count, total: stepData.total_count });
        complete = Boolean(stepData.complete);
      }
      toast.success(`Generated temporary PINs for ${allRows.length} active students.`);
    } catch (error) {
      toast.error(error.message || 'Credential migration failed.');
    } finally {
      setBusy(false);
    }
  };

  const exportFile = async format => {
    setExporting(format);
    try {
      await downloadExport(batchId, format, rows, schoolCode, className);
      toast.success(`${format.toUpperCase()} downloaded.`);
    } catch (error) {
      toast.error(error.message || `Unable to download ${format.toUpperCase()}.`);
    } finally {
      setExporting('');
    }
  };

  const resetClassForSchool = value => { setSchoolCode(value); setClassName(''); };

  return <div className="max-w-4xl space-y-5 pb-10">
    <PageHeader eyebrow="System / Student Security" title="Student Credential Migration" description="Replace deterministic student passwords with cryptographically random 8-digit temporary PINs, with progress-safe batch processing." />
    <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 flex gap-3"><ShieldAlert size={20} className="shrink-0 text-rose-600"/><div><p className="font-black text-rose-950">Admin-only security operation</p><p className="mt-1 text-xs leading-5 text-rose-800">Every active student's current password will be invalidated. Keep credential exports private and distribute each PIN only to its named student.</p></div></section>

    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><KeyRound size={20}/></span><div><h2 className="text-lg font-black text-slate-900">Generate student temporary PINs</h2><p className="mt-1 text-xs text-slate-500">Processed in small secure batches so a large student roster does not keep one request open for minutes.</p></div></div>
      {busy && <div className="mt-6"><div className="flex items-center justify-between text-xs font-bold text-slate-600"><span>Generating credentials…</span><span>{progress.processed} / {progress.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress.total ? (progress.processed / progress.total) * 100 : 0}%` }} /></div></div>}
      <button disabled={busy} onClick={migrate} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50">{busy ? <Loader2 size={15} className="animate-spin"/> : <KeyRound size={15}/>} {busy ? `Generating ${progress.processed}/${progress.total}…` : 'Reset all active students & generate PINs'}</button>
    </section>

    {rows.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-col gap-1"><h2 className="text-lg font-black text-slate-900">Credential exports</h2><p className="text-xs text-slate-500">{rows.length} PINs generated. Filter by school and class before downloading.</p></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2"><label className="text-xs font-black text-slate-600">School<select value={schoolCode} onChange={e=>resetClassForSchool(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-500"><option value="">All schools</option>{schools.map(value=><option key={value} value={value}>{value}</option>)}</select></label><label className="text-xs font-black text-slate-600">Class<select value={className} onChange={e=>setClassName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-blue-500"><option value="">All classes</option>{classes.map(value=><option key={value} value={value}>{value}</option>)}</select></label></div>
      <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-slate-800">{filteredCount} students selected</p><p className="mt-1 text-xs text-slate-500">PDF is grouped school-wise and class-wise.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={!!exporting} onClick={()=>exportFile('pdf')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-50">{exporting==='pdf'?<Loader2 size={14} className="animate-spin"/>:<FileText size={14}/>} Download PDF</button><button type="button" disabled={!!exporting} onClick={()=>exportFile('csv')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-800 disabled:opacity-50">{exporting==='csv'?<Loader2 size={14} className="animate-spin"/>:<Download size={14}/>} Download CSV</button></div></div>
      <div className="overflow-auto rounded-2xl border border-slate-200"><table className="min-w-full text-left text-xs"><thead className="bg-slate-900 text-white"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">School</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Username</th><th className="px-3 py-2">Temporary PIN</th></tr></thead><tbody>{rows.filter(row => (!schoolCode || row.school_code === schoolCode) && (!className || row.class_name === className)).map(row=><tr key={`${row.student_id}-${row.temporary_pin}`} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-slate-800">{row.name}</td><td className="px-3 py-2 text-slate-600">{row.school_code}</td><td className="px-3 py-2 text-slate-600">{row.class_name}</td><td className="px-3 py-2 font-mono text-slate-600">{row.username}</td><td className="px-3 py-2 font-mono font-black tracking-widest text-slate-900">{row.temporary_pin}</td></tr>)}</tbody></table></div>
    </section>}
  </div>;
}
