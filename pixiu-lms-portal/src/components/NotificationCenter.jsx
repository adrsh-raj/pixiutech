import { Bell, CheckCircle2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { filterNotificationsForUser, fetchUserReadNotifIds, saveUserReadNotifIds } from '../utils/notifications';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export default function NotificationCenter() {
  const { user } = useAuth();
  const { notifications = [] } = useData();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState([]);

  const visible = useMemo(() => filterNotificationsForUser(notifications, user), [notifications, user]);
  const unread = visible.filter(item => !readIds.includes(item.id));

  useEffect(() => {
    let active = true;
    if (!user) return undefined;
    fetchUserReadNotifIds(user).then(ids => {
      if (active) setReadIds(Array.isArray(ids) ? ids : []);
    });
    return () => { active = false; };
  }, [user]);

  const markAllRead = async () => {
    const ids = unread.map(item => item.id).filter(Boolean);
    if (!ids.length) return;
    const updated = await saveUserReadNotifIds(ids, user);
    setReadIds(updated);
  };

  const markRead = async (id) => {
    if (!id || readIds.includes(id)) return;
    const updated = await saveUserReadNotifIds(id, user);
    setReadIds(updated);
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(value => !value)} className="relative w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 flex items-center justify-center" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`} aria-expanded={open}>
        <Bell size={16} />
        {unread.length > 0 && <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">{unread.length > 99 ? '99+' : unread.length}</span>}
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
          <section className="absolute right-0 top-11 z-50 w-[min(370px,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <header className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0"><p className="text-sm font-black text-slate-900">Notifications</p><p className="text-[10px] text-slate-400 mt-0.5">{unread.length ? `${unread.length} unread` : 'You're all caught up'}</p></div>
              {unread.length > 0 && <button type="button" onClick={markAllRead} className="shrink-0 text-[10px] font-bold text-blue-600 hover:text-blue-700">Mark all read</button>}
              <button type="button" onClick={() => setOpen(false)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close notifications"><X size={15} /></button>
            </header>
            <div className="max-h-[min(65vh,430px)] overflow-y-auto overscroll-contain">
              {visible.length === 0 ? (
                <div className="p-8 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={24}/><p className="mt-2 text-sm font-bold text-slate-600">No notifications</p><p className="mt-1 text-xs text-slate-400">New announcements will appear here.</p></div>
              ) : (
                <div className="divide-y divide-slate-100">{visible.map(item => { const isRead = readIds.includes(item.id); return <button type="button" key={item.id} onClick={() => markRead(item.id)} className={`w-full p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:bg-blue-50 ${isRead ? 'bg-white' : 'bg-blue-50/45'}`}><div className="flex items-start gap-3"><span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isRead ? 'bg-slate-200' : 'bg-blue-500'}`} /><div className="min-w-0 flex-1"><p className="text-xs font-black text-slate-800 break-words">{item.title || 'Notification'}</p><p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words">{item.message || ''}</p></div></div></button>; })}</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
