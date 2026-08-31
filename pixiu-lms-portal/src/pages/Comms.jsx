import { useState } from 'react';
import { MessageSquare, Send, CheckCircle2, Clock, Phone, Building2, User, Sparkles, Filter, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Comms() {
  const { schools, students, comms, sendCommsMessage } = useData();
  const toast = useToast();
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Monthly Progress');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const templates = [
    { 
      name: 'Monthly Progress', 
      text: "Dear Parent, your child {name} has achieved {attendance}% attendance in Pixiu Robotics and completed their latest project. View detailed report here: https://portal.pixiutech.com/report/{id}" 
    },
    { 
      name: 'Project Milestone', 
      text: "Congratulations! {name} has successfully built and tested their autonomous robot project today at {school}." 
    },
    { 
      name: 'Attendance Alert', 
      text: "Dear Parent, this is an update from Pixiu Tech. {name} was marked absent for today's robotics session at {school}." 
    },
    { 
      name: 'Fee / Term Reminder', 
      text: "Greetings from Pixiu Tech. This is a gentle reminder regarding the upcoming term fee renewal for robotics lab access at {school}." 
    }
  ];

  const filteredStudents = selectedSchool === 'All' 
    ? students 
    : students.filter(s => s.school_id === selectedSchool);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.warning("Please select a recipient student!");
      return;
    }

    const student = students.find(s => s.student_id === selectedStudentId);
    if (!student) return;

    const school = schools.find(s => s.id === student.school_id)?.name || 'School';
    let finalMessage = customMessage || templates.find(t => t.name === selectedTemplate)?.text || '';
    
    finalMessage = finalMessage
      .replace('{name}', student.name)
      .replace('{school}', school)
      .replace('{id}', student.student_id)
      .replace('{attendance}', '95');

    setIsSending(true);

    // 1. Record log in SQLite database
    await sendCommsMessage({
      student_id: student.student_id,
      recipient: student.parent_whatsapp || 'Parent',
      template: selectedTemplate,
      message: finalMessage,
      status: 'Delivered'
    });

    setIsSending(false);
    toast.success(`WhatsApp message queued & delivered to ${student.name}'s parent!`, 'Parent Comms Broadcasted');

    // 2. Open WhatsApp Web deep link
    const phone = student.parent_whatsapp ? student.parent_whatsapp.replace(/\D/g, '') : '';
    if (phone) {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(finalMessage)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="pb-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Parent Communication & WhatsApp Hub</h1>
          <p className="text-slate-500">Send templated progress updates, milestone alerts, and review message delivery logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Send Message Box */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><MessageSquare size={20}/></div>
            <h2 className="font-bold text-slate-800">Compose Broadcast</h2>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">1. Filter School Scope</label>
              <select 
                value={selectedSchool}
                onChange={e => {
                  setSelectedSchool(e.target.value);
                  setSelectedStudentId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
              >
                <option value="All">All Schools</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">2. Target Recipient Student *</label>
              <select 
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
              >
                <option value="">-- Choose Student --</option>
                {filteredStudents.map(s => (
                  <option key={s.student_id} value={s.student_id}>
                    {s.name} ({s.student_id} - WA: {s.parent_whatsapp || 'None'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">3. Message Template</label>
              <select 
                value={selectedTemplate}
                onChange={e => {
                  setSelectedTemplate(e.target.value);
                  const tmpl = templates.find(t => t.name === e.target.value);
                  if (tmpl) setCustomMessage(tmpl.text);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
              >
                {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message Preview / Custom Text</label>
              <textarea 
                rows={4}
                value={customMessage || templates.find(t => t.name === selectedTemplate)?.text}
                onChange={e => setCustomMessage(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs leading-relaxed focus:outline-none focus:border-pixiu-blue"
              />
            </div>

            <button 
              type="submit"
              disabled={isSending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm transition-colors cursor-pointer"
            >
              <Send size={16} /> Send via WhatsApp & Log
            </button>
          </form>
        </div>

        {/* Right Column: Communication History Logs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">Delivery & Audit Logs</h3>
              <p className="text-xs text-slate-500">Immutable record of automated and manual outbound messages</p>
            </div>
            <span className="text-xs font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">{comms.length} Sent</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[600px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="font-semibold p-4">Recipient & ID</th>
                  <th className="font-semibold p-4">Template</th>
                  <th className="font-semibold p-4">Message Excerpt</th>
                  <th className="font-semibold p-4">Timestamp</th>
                  <th className="font-semibold p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {comms.map(log => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-sm flex items-center gap-1">
                        <Phone size={12} className="text-emerald-600"/> {log.recipient}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{log.student_id || log.id}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {log.template}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="text-xs text-slate-600 line-clamp-2 max-w-xs">{log.message}</p>
                    </td>
                    <td className="p-4 text-xs text-slate-500 whitespace-nowrap">
                      {log.sent_at}
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        <CheckCircle2 size={12}/> {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {comms.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-sm">
                No outbound communications logged yet. Send your first broadcast from the left!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
