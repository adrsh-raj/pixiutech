import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Mail, MapPin, Phone, RefreshCw, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';

const text = value => String(value ?? '').trim();

function normalize(lead) {
  const created = lead.created_at || lead.createdAt || '';
  const parsed = created ? new Date(created) : null;
  return {
    ...lead,
    school: lead.organization_name || lead.name || '—',
    person: lead.contact_name || lead.contact_person || '—',
    email: lead.email || '',
    phone: lead.phone || '',
    city: lead.city || (text(lead.notes).match(/^City:\s*(.+)$/m)?.[1] || ''),
    strength: Number(lead.expected_students ?? lead.student_strength ?? 0) || 0,
    status: text(lead.status || lead.stage || 'new').toLowerCase(),
    enquiryType: text(lead.enquiry_type || 'sales').toLowerCase(),
    read: Boolean(lead.read),
    readAt: lead.read_at || null,
    labAttachments: Array.isArray(lead.lab_attachments) ? lead.lab_attachments : [],
    notes: lead.notes || '',
    createdLabel: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : text(created) || '—',
  };
}

const STATUS_LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };
const ENQUIRY_TYPES = { sales: 'Sales', bug: 'Bug', help: 'Help', other: 'Other', philosophy: 'Think / Rethink Philosophy' };

export default function WebsiteEnquiries() {
  const { leads = [], refreshAll, loading } = useData();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [attachmentBusy, setAttachmentBusy] = useState(null);

  const enquiries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter(lead => text(lead.source).toLowerCase() === 'website')
      .map(normalize)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter(row => !q || [row.school, row.person, row.email, row.phone, row.city, row.notes, row.status, row.enquiryType].some(value => text(value).toLowerCase().includes(q)));
  }, [leads, query]);

  const newCount = enquiries.filter(item => item.status === 'new').length;
  const unreadCount = enquiries.filter(item => !item.read).length;

  useEffect(() => () => {
    if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url);
  }, [attachmentPreview]);

  const getAttachmentApiPath = fileUrl => {
    const raw = text(fileUrl);
    if (!raw) return '';
    try {
      const parsed = new URL(raw, window.location.origin);
      const marker = '/api/v1';
      const index = parsed.pathname.indexOf(marker);
      return (index >= 0 ? parsed.pathname.slice(index + marker.length) : parsed.pathname) + parsed.search;
    } catch {
      return raw.startsWith('/api/v1') ? raw.slice('/api/v1'.length) : raw;
    }
  };

  const handleAttachmentPreview = async file => {
    const apiPath = getAttachmentApiPath(file?.url);
    if (!apiPath) return;
    setAttachmentBusy(file.id);
    try {
      const response = await apiFetch(apiPath, { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error('Attachment could not be opened.');
      const blob = await response.blob();
      if (!String(blob.type).startsWith('image/')) throw new Error('The stored attachment is not an image.');
      setAttachmentPreview({ url: URL.createObjectURL(blob), name: file.original_name || 'Lab image' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Attachment could not be opened.');
    } finally {
      setAttachmentBusy(null);
    }
  };

  const closeAttachmentPreview = () => {
    setAttachmentPreview(current => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const handleMarkRead = async item => {
    if (!item?.id || item.read) return;
    try {
      const response = await apiFetch(`/leads/${encodeURIComponent(item.id)}/read`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || 'Unable to mark enquiry as read.');
      await refreshAll();
      toast.success('Enquiry marked as read.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to mark enquiry as read.');
    }
  };

  const handleAttachmentDownload = async file => {
    const apiPath = getAttachmentApiPath(file?.url);
    if (!apiPath) return;
    setAttachmentBusy(`download:${file.id}`);
    try {
      const response = await apiFetch(apiPath + (apiPath.includes('?') ? '&' : '?') + 'download=1', { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error('Image could not be downloaded.');
      const blob = await response.blob();
      if (!String(blob.type).startsWith('image/')) throw new Error('The stored attachment is not an image.');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = text(file.original_name) || 'lab-enquiry-image';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image could not be downloaded.');
    } finally {
      setAttachmentBusy(null);
    }
  };

  const handleRefresh = async () => {
    await refreshAll();
    toast.success('Website enquiries refreshed.');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        eyebrow="BUSINESS INBOX"
        title="Website Enquiries"
        description="Every Contact Form submission from pixiutech.com is captured in the live CRM as a Website lead."
        actions={<div className="flex flex-wrap gap-2"><button type="button" onClick={handleRefresh} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh</button><Link to="/leads" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold"><ExternalLink size={16} /> Sales Pipeline</Link></div>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Total Website Enquiries</p><p className="text-3xl font-black text-slate-900 mt-1">{enquiries.length}</p></div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Unread</p><p className="text-3xl font-black text-amber-600 mt-1">{unreadCount}</p></div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">New / Unworked</p><p className="text-3xl font-black text-blue-600 mt-1">{newCount}</p></div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="relative max-w-xl"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search school, person, email, phone, city…" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-400" /></div>
      </div>

      {enquiries.length === 0 ? <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm"><EmptyState icon={<Mail size={22} />} title={query ? 'No matching website enquiries' : 'No website enquiries yet'} description={query ? 'Try a different search term.' : 'New Contact Form submissions will appear here automatically.'} /></div> : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black"><tr><th className="px-5 py-3">School / Contact</th><th className="px-5 py-3">Reach</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Students</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Message</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {enquiries.map(item => (
                  <tr key={item.id} className={`hover:bg-slate-50 align-top ${item.read ? '' : 'bg-amber-50/30'}`}>
                    <td className="px-5 py-4"><div className="font-black text-slate-800">{item.school}</div><div className="text-slate-500 mt-1">{item.person}</div></td>
                    <td className="px-5 py-4 space-y-1"><a href={`mailto:${item.email}`} className="flex items-center gap-2 text-blue-600 hover:underline"><Mail size={13} /> {item.email || '—'}</a><a href={`tel:${item.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600"><Phone size={13} /> {item.phone || '—'}</a></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 text-slate-600"><MapPin size={13} /> {item.city || '—'}</div></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 font-bold text-slate-700"><Users size={13} /> {item.strength || '—'}</div></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 text-slate-600 whitespace-nowrap"><CalendarDays size={13} /> {item.createdLabel}</div></td>
                    <td className="px-5 py-4">
                      <span className={"inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black uppercase " + (item.enquiryType === "bug" ? "bg-red-50 text-red-700 border-red-200" : item.enquiryType === "help" ? "bg-blue-50 text-blue-700 border-blue-200" : item.enquiryType === "philosophy" ? "bg-violet-50 text-violet-700 border-violet-200" : item.enquiryType === "other" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
                        {ENQUIRY_TYPES[item.enquiryType] || item.enquiryType}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${item.status === 'new' ? 'bg-amber-50 text-amber-700 border-amber-200' : item.status === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{STATUS_LABELS[item.status] || item.status}</span>
                        {!item.read && <button type="button" onClick={() => void handleMarkRead(item)} className="ml-2 inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-100">Mark as read</button>}
                        {item.read && <span className="ml-2 text-[10px] font-bold text-slate-400">Read</span>}
                      </td>
                    <td className="px-5 py-4 max-w-sm"><p className="text-slate-500 whitespace-pre-line line-clamp-4">{item.notes || 'No message provided.'}</p>
                      {item.labAttachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.labAttachments.map(file => (
                            <div key={file.id} className="inline-flex overflow-hidden rounded-lg border border-blue-200 bg-blue-50">
                              <button type="button" onClick={() => void handleAttachmentPreview(file)} disabled={!file.url || attachmentBusy === file.id || attachmentBusy === `download:${file.id}`} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                                <ExternalLink size={11} /> {attachmentBusy === file.id ? 'Opening…' : file.original_name}
                              </button>
                              <button type="button" onClick={() => void handleAttachmentDownload(file)} disabled={!file.url || attachmentBusy === file.id || attachmentBusy === `download:${file.id}`} className="border-l border-blue-200 px-2 py-1 text-[10px] font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50" title="Download image" aria-label={`Download ${file.original_name || 'image'}`}>
                                Download
                              </button>
                            </div>
                          ))}
                        </div>
                      )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {attachmentPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Lab enquiry attachment preview" onMouseDown={event => { if (event.target === event.currentTarget) closeAttachmentPreview(); }}>
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Private Lab attachment</p>
                <p className="truncate text-sm font-bold text-white">{attachmentPreview.name}</p>
              </div>
              <button type="button" onClick={closeAttachmentPreview} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white">Close</button>
            </div>
            <div className="max-h-[78vh] overflow-auto p-3 bg-black/30">
              <img src={attachmentPreview.url} alt={attachmentPreview.name} className="mx-auto max-h-[72vh] max-w-full rounded-xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
