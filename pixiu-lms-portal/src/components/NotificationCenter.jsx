import { Bell, CheckCircle2, X, AlertCircle, Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function NotificationCenter() {
  const { notifications = [], endpointErrors = {}, refreshAll, loadData } = useData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const visible = useMemo(() => (Array.isArray(notifications) ? notifications : []), [notifications]);
  const unread = visible.filter(item => !item.read);
  const loadError = endpointErrors['/notifications'] || '';

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !busy) {
        loadData(['/notifications']).catch(() => {});
      }
    }, 15000);
    return () => window.clearInterval(poll);
  }, [busy, loadData]);

  const markRead = async id => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to mark notification as read.');
      await refreshAll();
    } catch (error) { toast.error(error.message || 'Unable to update notification.'); }
    finally { setBusy(false); }
  };

  const markAllRead = async () => {
    if (!unread.length || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch('/notifications/read-all', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to mark notifications as read.');
      await refreshAll();
    } catch (error) { toast.error(error.message || 'Unable to update notifications.'); }
    finally { setBusy(false); }
  };

  return <div className="relative">
    <button type="button" onClick={() => setOpen(value => !value)} disabled={busy} className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`} aria-expanded={open}>
      <Bell size={16}/>{unread.length > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">{unread.length > 99 ? '99+' : unread.length}</span>}
    </button>
    {open && <>
      <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
      <section className="absolute right-0 top-11 z-50 w-[min(390px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3"><div className="min-w-0"><p className="text-sm font-black text-slate-900">Notifications</p><p className="mt-0.5 text-[10px] text-slate-400">{unread.length ? `${unread.length} unread` : 'You are all caught up'}</p></div><div className="flex shrink-0 items-center gap-2">{unread.length > 0 && <button type="button" onClick={markAllRead} disabled={busy} className="text-[10px] font-black text-blue-600 hover:text-blue-700 disabled:opacity-50">Mark all read</button>}<button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close notifications"><X size={15}/></button></div></header>
        <div className="max-h-[min(65vh,460px)] overflow-y-auto overscroll-contain">
          {loadError ? <div className="p-8 text-center"><AlertCircle className="mx-auto text-red-400" size={25}/><p className="mt-2 text-sm font-bold text-red-700">Unable to load notifications</p><p className="mt-1 text-xs text-slate-500">{loadError}</p><button type="button" onClick={refreshAll} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Try again</button></div> : visible.length === 0 ? <div className="p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={24}/><p className="mt-2 text-sm font-bold text-slate-600">No notifications</p><p className="mt-1 text-xs text-slate-400">New announcements will appear here.</p></div> : <div className="divide-y divide-slate-100">{visible.map(item => <article key={item.id} className={`p-4 ${item.read ? 'bg-white' : 'bg-blue-50/45'}`}><div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? 'bg-slate-200' : 'bg-blue-500'}`}/><div className="min-w-0 flex-1"><p className="break-words text-xs font-black text-slate-800">{item.title || 'Notification'}</p><p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">{item.message || ''}</p><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-400">{item.read ? 'Read' : 'Unread'}</p></div>{!item.read && <button type="button" onClick={() => markRead(item.id)} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[10px] font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50"><Check size={12}/> Mark as read</button>}</div></article>)}</div>}
        </div>
      </section>
    </>}
  </div>;
}
