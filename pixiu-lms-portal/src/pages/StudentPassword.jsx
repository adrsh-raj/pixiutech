import { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageHeader from '../components/ui/PageHeader';

export default function StudentPassword() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (newPassword !== confirm) return toast.error('New password and confirmation do not match.');
    setSaving(true);
    const response = await apiFetch('/auth/password/change/', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      const fieldError =
        data.fields?.current_password?.[0] ||
        data.fields?.new_password?.[0] ||
        data.current_password?.[0] ||
        data.new_password?.[0];
      return toast.error(
        fieldError ||
        (typeof data.detail === 'string' && data.detail !== 'Request validation failed.' ? data.detail : null) ||
        data.error ||
        'Unable to change password.'
      );
    }
    setCurrentPassword(''); setNewPassword(''); setConfirm('');
    toast.success('Your permanent password has been saved.');
    window.location.href = '/student-portal';
  };

  return <div className="max-w-xl space-y-5 pb-10">
    <PageHeader eyebrow="Account Security" title="Reset Password" description="Change your student password anytime when you know the current password." actions={<Link to="/student-portal" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700"><ArrowLeft size={14}/> Back</Link>} />
    <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5"><div className="flex gap-3"><span className="w-10 h-10 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0"><ShieldCheck size={19}/></span><div><p className="text-sm font-black text-blue-950">Keep your password private</p><p className="mt-1 text-xs leading-5 text-blue-800">Do not share your permanent password with classmates. Your trainer can only issue a temporary reset PIN.</p></div></div></section>
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Current password</span><input className="w-full min-h-11 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-blue-500" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></label>
      <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">New password</span><input className="w-full min-h-11 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-blue-500" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></label>
      <label><span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Confirm new password</span><input className="w-full min-h-11 rounded-xl border border-slate-200 px-3.5 text-sm font-semibold outline-none focus:border-blue-500" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={8} required /></label>
      <button disabled={saving} className="w-full min-h-11 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-blue-700"><KeyRound size={14}/>{saving ? 'Saving…' : 'Change Password'}</button>
    </form>
  </div>;
}
