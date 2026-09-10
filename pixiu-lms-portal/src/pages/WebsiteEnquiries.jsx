import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, Mail, MapPin, Phone, RefreshCw, Search, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
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
    notes: lead.notes || '',
    createdLabel: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : text(created) || '—',
  };
}

const STATUS_LABELS = { new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };

export default function WebsiteEnquiries() {
  const { leads = [], refreshAll, loading } = useData();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const enquiries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter(lead => text(lead.source).toLowerCase() === 'website')
      .map(normalize)
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter(row => !q || [row.school, row.person, row.email, row.phone, row.city, row.notes, row.status].some(value => text(value).toLowerCase().includes(q)));
  }, [leads, query]);

  const newCount = enquiries.filter(item => item.status === 'new').length;

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
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">New / Unworked</p><p className="text-3xl font-black text-amber-600 mt-1">{newCount}</p></div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">CRM Destination</p><p className="text-sm font-black text-emerald-700 mt-2">Live Lead Registry</p></div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="relative max-w-xl"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search school, person, email, phone, city…" className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-blue-400" /></div>
      </div>

      {enquiries.length === 0 ? <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm"><EmptyState icon={<Mail size={22} />} title={query ? 'No matching website enquiries' : 'No website enquiries yet'} description={query ? 'Try a different search term.' : 'New Contact Form submissions will appear here automatically.'} /></div> : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1000px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-black"><tr><th className="px-5 py-3">School / Contact</th><th className="px-5 py-3">Reach</th><th className="px-5 py-3">Location</th><th className="px-5 py-3">Students</th><th className="px-5 py-3">Submitted</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Message</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {enquiries.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50 align-top">
                    <td className="px-5 py-4"><div className="font-black text-slate-800">{item.school}</div><div className="text-slate-500 mt-1">{item.person}</div></td>
                    <td className="px-5 py-4 space-y-1"><a href={`mailto:${item.email}`} className="flex items-center gap-2 text-blue-600 hover:underline"><Mail size={13} /> {item.email || '—'}</a><a href={`tel:${item.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600"><Phone size={13} /> {item.phone || '—'}</a></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 text-slate-600"><MapPin size={13} /> {item.city || '—'}</div></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 font-bold text-slate-700"><Users size={13} /> {item.strength || '—'}</div></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-2 text-slate-600 whitespace-nowrap"><CalendarDays size={13} /> {item.createdLabel}</div></td>
                    <td className="px-5 py-4"><span className={`inline-flex px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${item.status === 'new' ? 'bg-amber-50 text-amber-700 border-amber-200' : item.status === 'won' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{STATUS_LABELS[item.status] || item.status}</span></td>
                    <td className="px-5 py-4 max-w-sm"><p className="text-slate-500 whitespace-pre-line line-clamp-4">{item.notes || 'No message provided.'}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
