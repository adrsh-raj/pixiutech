import { useState } from 'react';
import { Download, KeyRound, ShieldAlert } from 'lucide-react';
import { apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';

export default function StudentCredentialMigration() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const migrate = async () => {
    if (!window.confirm('This will reset the temporary PIN for every active student with a login account and download a new credential sheet. Continue?')) return;
    setBusy(true);
    const response = await apiFetch('/students/credentials/migrate', { method: 'POST', body: JSON.stringify({ confirm: 'RESET_ALL_STUDENT_CREDENTIALS' }) });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      const data = contentType.includes('json') ? await response.json().catch(() => ({})) : {};
      setBusy(false); toast.error(data.detail || 'Credential migration failed.'); return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pixiu-student-temporary-pins.csv'; anchor.click(); URL.revokeObjectURL(url);
    setBusy(false); toast.success('Student temporary PIN sheet downloaded.');
  };

  return <div className="max-w-3xl space-y-5 pb-10"><PageHeader eyebrow="System / Student Security" title="Student Credential Migration" description="Replace all active student deterministic passwords with cryptographically random 8-digit temporary PINs." />
    <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 flex gap-3"><ShieldAlert size={20} className="shrink-0 text-rose-600"/><div><p className="font-black text-rose-950">Admin-only security operation</p><p className="mt-1 text-xs leading-5 text-rose-800">The migration invalidates the students' old passwords and creates a fresh PIN for each active student. Keep the downloaded sheet private and give each student only their own PIN.</p></div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><span className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><KeyRound size={20}/></span><div><h2 className="text-lg font-black text-slate-900">Generate student PIN sheet</h2><p className="mt-1 text-xs text-slate-500">CSV contains student ID, name, class, username and the newly generated temporary PIN.</p></div></div><button disabled={busy} onClick={migrate} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"><Download size={15}/>{busy?'Generating…':'Reset all active students & download sheet'}</button></section>
  </div>;
}
