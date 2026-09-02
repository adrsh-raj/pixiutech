import { useState } from 'react';
import { 
  Bell, Send, CheckCircle2, Phone, Sparkles, Filter, X, 
  Calendar, Clock, Edit3, Trash2, Megaphone, Users, BookOpen, 
  Layers, AlertTriangle, Info, Check, MessageSquare 
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';

export default function Comms() {
  const { 
    schools, students, trainers, comms, sendCommsMessage, 
    notifications, sendBroadcastNotification, updateNotification, deleteNotification 
  } = useData();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('broadcast'); // 'broadcast' | 'whatsapp'
  const [isSending, setIsSending] = useState(false);

  // Broadcast Form State
  const [broadcastTarget, setBroadcastTarget] = useState('All_Students'); // 'All_Students' | 'Specific_Class' | 'All_Trainers' | 'Universal'
  const [selectedClasses, setSelectedClasses] = useState(['6', '7', '8', '9', '11']);
  const [scheduledDate, setScheduledDate] = useState('Wednesday, 02 Sep 2026');
  const [scheduledTime, setScheduledTime] = useState('10:00 AM');
  const [severity, setSeverity] = useState('info'); // 'info' | 'important' | 'urgent'
  const [title, setTitle] = useState('📢 Next Robotics Lab Class Scheduled');
  const [message, setMessage] = useState(
    'Dear Students & Faculty, the upcoming practical robotics session for Classes 6, 7, 8, 9, 11 will be held on Wednesday, 02 Sep 2026 at 10:00 AM. Please ensure all student workbooks are brought to class.'
  );

  // Edit Modal State
  const [editingNotif, setEditingNotif] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    message: '',
    target_type: 'All_Students',
    target_classes: '6,7,8,9,11',
    scheduled_date: '',
    scheduled_time: '',
    severity: 'info'
  });

  // WhatsApp Tab State
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Monthly Progress');
  const [customMessage, setCustomMessage] = useState('');

  const waTemplates = [
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

  // Broadcast Quick Templates
  const broadcastTemplates = [
    {
      id: 'next_class',
      name: '🚀 Next Class Schedule',
      target: 'All_Students',
      classes: ['6', '7', '8', '9', '11'],
      title: '📢 Next Robotics Lab Class Scheduled',
      message: 'Dear Students & Faculty, the next hands-on robotics session for Classes {classes} is scheduled for {date} at {time}. Topic: "Sensor Interfacing & Lab Build". Please bring your robotics kits and workbooks.',
      severity: 'info'
    },
    {
      id: 'revision_viva',
      name: '📝 Revision & Lab Viva Notice',
      target: 'All_Students',
      classes: ['6', '7', '8', '9', '11'],
      title: '📝 Unit 1 & 2 Revision & Circuit Viva Notice',
      message: 'Attention Classes {classes}: Comprehensive revision and hardware circuit viva will be conducted on {date} at {time}. Please review all guidebooks and schematics in the Student Portal.',
      severity: 'important'
    },
    {
      id: 'trainer_prep',
      name: '🛠️ Trainer Hardware Prep Directive',
      target: 'All_Trainers',
      classes: ['6', '7', '8', '9', '11'],
      title: '🛠️ Faculty Directive: Prepare Level 1 Unit 2 Lab Kits',
      message: 'Trainer Vikas Pandey: Please inspect, test, and calibrate all sensor kits (LDR, IR, Ultrasonic) for Classes {classes} before the session on {date} at {time}.',
      severity: 'urgent'
    },
    {
      id: 'universal_notice',
      name: '🌐 Universal School Announcement',
      target: 'Universal',
      classes: ['6', '7', '8', '9', '11'],
      title: '🌟 Upcoming Robotics Innovation Exhibition',
      message: 'Announcement for all students, parents and instructors: Pixiu Robotics Lab Annual Project Exhibition will be hosted at Zenith Public School. Students must finalize their capstone rover projects.',
      severity: 'important'
    }
  ];

  const handleApplyTemplate = (tmpl) => {
    setBroadcastTarget(tmpl.target);
    setSelectedClasses(tmpl.classes);
    setSeverity(tmpl.severity);
    setTitle(tmpl.title);

    const classStr = tmpl.classes.length === 5 ? '6, 7, 8, 9, 11' : tmpl.classes.join(', ');
    const filledMsg = tmpl.message
      .replace('{classes}', classStr)
      .replace('{date}', scheduledDate)
      .replace('{time}', scheduledTime);

    setMessage(filledMsg);
    toast.info(`Loaded template: "${tmpl.name}"! You can now edit any text or dates.`, 'Template Applied');
  };

  const handleToggleClass = (grade) => {
    if (selectedClasses.includes(grade)) {
      if (selectedClasses.length === 1) {
        toast.warning('At least one class must be selected for broadcast!');
        return;
      }
      setSelectedClasses(selectedClasses.filter(c => c !== grade));
    } else {
      setSelectedClasses([...selectedClasses, grade].sort((a, b) => parseInt(a) - parseInt(b)));
    }
  };

  const handleSelectAllClasses = () => {
    if (selectedClasses.length === 5) {
      setSelectedClasses(['6']);
    } else {
      setSelectedClasses(['6', '7', '8', '9', '11']);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.warning('Please enter both announcement title and message!');
      return;
    }

    setIsSending(true);
    const classesStr = broadcastTarget === 'Specific_Class' || broadcastTarget === 'All_Students' 
      ? selectedClasses.join(',') 
      : '6,7,8,9,11';

    const res = await sendBroadcastNotification({
      target_type: broadcastTarget,
      target_classes: classesStr,
      target_trainer_id: broadcastTarget === 'All_Trainers' ? 'All' : 'All',
      title: title.trim(),
      message: message.trim(),
      template_type: 'custom',
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      severity
    });

    setIsSending(false);
    if (res && res.success) {
      toast.success('Broadcast notification published to Student & Trainer portals!', 'Announcement Live');
    }
  };

  const handleOpenEdit = (notif) => {
    setEditingNotif(notif);
    setEditFormData({
      title: notif.title,
      message: notif.message,
      target_type: notif.target_type || 'All_Students',
      target_classes: notif.target_classes || '6,7,8,9,11',
      scheduled_date: notif.scheduled_date || 'Upcoming',
      scheduled_time: notif.scheduled_time || '10:00 AM',
      severity: notif.severity || 'info'
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingNotif) return;

    await updateNotification(editingNotif.id, editFormData);
    toast.success(`Updated announcement "${editFormData.title}"!`, 'Notification Edited');
    setEditingNotif(null);
  };

  const handleDeleteNotif = async (id, notifTitle) => {
    if (confirm(`Are you sure you want to revoke and delete "${notifTitle}"?`)) {
      await deleteNotification(id);
      toast.info(`Deleted announcement: "${notifTitle}"`);
    }
  };

  // WhatsApp Tab logic
  const filteredStudents = selectedSchool === 'All' 
    ? students 
    : students.filter(s => s.school_id === selectedSchool);

  const handleSendWA = async (e) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.warning("Please select a recipient student!");
      return;
    }

    const student = students.find(s => s.student_id === selectedStudentId);
    if (!student) return;

    const school = schools.find(s => s.id === student.school_id)?.name || 'School';
    let finalMessage = customMessage || waTemplates.find(t => t.name === selectedTemplate)?.text || '';
    
    finalMessage = finalMessage
      .replace('{name}', student.name)
      .replace('{school}', school)
      .replace('{id}', student.student_id)
      .replace('{attendance}', '95');

    setIsSending(true);
    await sendCommsMessage({
      student_id: student.student_id,
      recipient: student.parent_whatsapp || 'Parent',
      template: selectedTemplate,
      message: finalMessage,
      status: 'Delivered'
    });

    setIsSending(false);
    toast.success(`WhatsApp message queued & logged for ${student.name}!`, 'Parent Message Sent');

    const phone = student.parent_whatsapp ? student.parent_whatsapp.replace(/\D/g, '') : '';
    if (phone) {
      const url = `https://wa.me/${phone}?text=${encodeURIComponent(finalMessage)}`;
      window.open(url, '_blank');
    }
  };

  return (
    <div className="pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-pixiu-blue">
              <Megaphone size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Admin Broadcast & Announcement Hub</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Broadcast live notifications to Classes 6, 7, 8, 9, 11 and Trainers with editable templates.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'broadcast' 
                ? 'bg-white text-pixiu-blue shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Megaphone size={14} /> Class & Trainer Broadcasts ({notifications.length})
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'whatsapp' 
                ? 'bg-white text-emerald-600 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare size={14} /> Parent WhatsApp (1-on-1)
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: BROADCAST ANNOUNCEMENTS ==================== */}
      {activeTab === 'broadcast' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Preset Quick Templates */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-amber-500" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quick Fill & Editable Broadcast Templates</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {broadcastTemplates.map(tmpl => (
                <button
                  key={tmpl.id}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-pixiu-blue bg-slate-50 hover:bg-blue-50/40 transition-all cursor-pointer group"
                >
                  <p className="font-bold text-xs text-slate-800 group-hover:text-pixiu-blue mb-1">{tmpl.name}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{tmpl.title}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Form: Compose Broadcast (5 cols) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Send size={16} className="text-pixiu-blue" /> Compose Live Announcement
                </h2>
                <span className="text-[10px] font-bold bg-blue-50 text-pixiu-blue px-2 py-0.5 rounded-md">
                  100% Editable
                </span>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
                {/* Target Audience Selector */}
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1.5">1. Target Audience</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastTarget('All_Students')}
                      className={`p-2.5 rounded-xl font-bold border text-left flex items-center gap-2 cursor-pointer transition-all ${
                        broadcastTarget === 'All_Students' 
                          ? 'bg-blue-50 text-pixiu-blue border-blue-300 ring-2 ring-blue-100' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Users size={14} /> All Classes (6, 7, 8, 9, 11)
                    </button>

                    <button
                      type="button"
                      onClick={() => setBroadcastTarget('Specific_Class')}
                      className={`p-2.5 rounded-xl font-bold border text-left flex items-center gap-2 cursor-pointer transition-all ${
                        broadcastTarget === 'Specific_Class' 
                          ? 'bg-blue-50 text-pixiu-blue border-blue-300 ring-2 ring-blue-100' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Layers size={14} /> Specific Class(es)
                    </button>

                    <button
                      type="button"
                      onClick={() => setBroadcastTarget('All_Trainers')}
                      className={`p-2.5 rounded-xl font-bold border text-left flex items-center gap-2 cursor-pointer transition-all ${
                        broadcastTarget === 'All_Trainers' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 ring-2 ring-indigo-100' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <BookOpen size={14} /> All Trainers & Faculty
                    </button>

                    <button
                      type="button"
                      onClick={() => setBroadcastTarget('Universal')}
                      className={`p-2.5 rounded-xl font-bold border text-left flex items-center gap-2 cursor-pointer transition-all ${
                        broadcastTarget === 'Universal' 
                          ? 'bg-purple-50 text-purple-700 border-purple-300 ring-2 ring-purple-100' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Bell size={14} /> Universal (Everyone)
                    </button>
                  </div>
                </div>

                {/* Multi-Class Checklist (If student target) */}
                {(broadcastTarget === 'All_Students' || broadcastTarget === 'Specific_Class') && (
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-600">Select Grades to Broadcast:</span>
                      <button 
                        type="button" 
                        onClick={handleSelectAllClasses}
                        className="text-[11px] font-bold text-pixiu-blue hover:underline cursor-pointer"
                      >
                        {selectedClasses.length === 5 ? 'Deselect All' : 'Select All (5 Classes)'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['6', '7', '8', '9', '11'].map(grade => {
                        const isSelected = selectedClasses.includes(grade);
                        return (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => handleToggleClass(grade)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isSelected 
                                ? 'bg-slate-900 text-white shadow-xs' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {isSelected && <Check size={12} />} Class {grade}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Scheduled Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Scheduled Day & Date</label>
                    <input 
                      type="text" 
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      placeholder="e.g. Wednesday, 02 Sep 2026"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-500 uppercase mb-1">Scheduled Time</label>
                    <input 
                      type="text" 
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                      placeholder="e.g. 10:00 AM"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                    />
                  </div>
                </div>

                {/* Priority / Severity */}
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Notice Priority Level</label>
                  <select 
                    value={severity}
                    onChange={e => setSeverity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                  >
                    <option value="info">🔵 Information (Normal Class Update)</option>
                    <option value="important">🟣 Important (Revision, Viva & Schedule)</option>
                    <option value="urgent">🔴 Urgent (Hardware Directive / Mandatory)</option>
                  </select>
                </div>

                {/* Announcement Title */}
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Announcement Title *</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. 📢 Next Robotics Lab Class Scheduled"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Message Body *</label>
                  <textarea 
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                    placeholder="Type announcement details, syllabus revisions, or trainer instructions..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 leading-relaxed focus:outline-none focus:border-pixiu-blue"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSending}
                  className="w-full bg-pixiu-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                >
                  <Send size={16} /> Publish Live Broadcast Notification
                </button>
              </form>
            </div>

            {/* Right Column: Published Broadcasts Feed & History (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Active Broadcasts & Announcements Feed</h3>
                  <p className="text-xs text-slate-500">Live announcements displayed on Student & Trainer Dashboards</p>
                </div>
                <span className="text-xs font-bold bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
                  {notifications.length} Active
                </span>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[750px]">
                {notifications.map(notif => {
                  const targetClasses = notif.target_classes ? notif.target_classes.split(',') : [];
                  const isAll = targetClasses.length === 5 || notif.target_type === 'All_Students' || notif.target_type === 'Universal';

                  return (
                    <div 
                      key={notif.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Audience Badge */}
                          {notif.target_type === 'All_Trainers' ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                              <BookOpen size={11} /> Faculty & Trainers
                            </span>
                          ) : notif.target_type === 'Universal' ? (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <Bell size={11} /> Universal Broadcast
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-pixiu-blue border border-blue-200 flex items-center gap-1">
                              <Users size={11} /> {isAll ? 'All Classes (6, 7, 8, 9, 11)' : `Classes: ${notif.target_classes}`}
                            </span>
                          )}

                          {/* Severity Pill */}
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            notif.severity === 'urgent' 
                              ? 'bg-rose-50 text-rose-700 border-rose-200' 
                              : notif.severity === 'important' 
                              ? 'bg-purple-50 text-purple-700 border-purple-200' 
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {notif.severity ? notif.severity.toUpperCase() : 'INFO'}
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock size={11} /> {notif.scheduled_date} • {notif.scheduled_time}
                          </span>
                        </div>

                        {/* Action Buttons: Edit & Delete */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            onClick={() => handleOpenEdit(notif)}
                            className="p-1.5 text-slate-500 hover:text-pixiu-blue hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Notification"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteNotif(notif.id, notif.title)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Revoke / Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-800 text-sm mb-1.5">{notif.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                          {notif.message}
                        </p>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                        <span>ID: {notif.id}</span>
                        <span>Published: {notif.created_at || 'Recently'}</span>
                      </div>
                    </div>
                  );
                })}

                {notifications.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <Megaphone size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No Active Announcements</p>
                    <p className="text-xs text-slate-400 mt-1">Compose a broadcast on the left to send live notices to students and trainers.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PARENT WHATSAPP MESSENGER ==================== */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-150">
          {/* Left Column: Send Message Box */}
          <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600"><MessageSquare size={20}/></div>
              <h2 className="font-bold text-slate-800 text-sm">Compose Parent Direct WhatsApp</h2>
            </div>

            <form onSubmit={handleSendWA} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">1. Filter School Scope</label>
                <select 
                  value={selectedSchool}
                  onChange={e => {
                    setSelectedSchool(e.target.value);
                    setSelectedStudentId('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue bg-white"
                >
                  <option value="All">All Schools</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">2. Target Recipient Student *</label>
                <select 
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue bg-white"
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
                <label className="block font-bold text-slate-500 uppercase mb-1">3. Message Template</label>
                <select 
                  value={selectedTemplate}
                  onChange={e => {
                    setSelectedTemplate(e.target.value);
                    const tmpl = waTemplates.find(t => t.name === e.target.value);
                    if (tmpl) setCustomMessage(tmpl.text);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-pixiu-blue bg-white"
                >
                  {waTemplates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Message Preview / Custom Text</label>
                <textarea 
                  rows={4}
                  value={customMessage || waTemplates.find(t => t.name === selectedTemplate)?.text}
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
                <h3 className="font-bold text-slate-800 text-sm">Delivery & Audit Logs</h3>
                <p className="text-xs text-slate-500">Immutable record of outbound parent communications</p>
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
                  No outbound communications logged yet. Send your first WhatsApp message from the left!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== EDIT NOTIFICATION MODAL ==================== */}
      {editingNotif && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Edit Broadcast Announcement</h3>
                <p className="text-xs text-slate-500">Update title, message, date or target audience</p>
              </div>
              <button 
                onClick={() => setEditingNotif(null)} 
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Target Audience</label>
                <select
                  value={editFormData.target_type}
                  onChange={e => setEditFormData({ ...editFormData, target_type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white focus:outline-none focus:border-pixiu-blue"
                >
                  <option value="All_Students">All Classes (6, 7, 8, 9, 11)</option>
                  <option value="Specific_Class">Specific Class</option>
                  <option value="All_Trainers">All Trainers & Faculty</option>
                  <option value="Universal">Universal (Everyone)</option>
                </select>
              </div>

              {editFormData.target_type === 'Specific_Class' && (
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Target Classes (comma separated)</label>
                  <input 
                    type="text" 
                    value={editFormData.target_classes}
                    onChange={e => setEditFormData({ ...editFormData, target_classes: e.target.value })}
                    placeholder="e.g. 6, 7, 8"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Scheduled Day & Date</label>
                  <input 
                    type="text" 
                    value={editFormData.scheduled_date}
                    onChange={e => setEditFormData({ ...editFormData, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Scheduled Time</label>
                  <input 
                    type="text" 
                    value={editFormData.scheduled_time}
                    onChange={e => setEditFormData({ ...editFormData, scheduled_time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Notice Priority</label>
                <select 
                  value={editFormData.severity}
                  onChange={e => setEditFormData({ ...editFormData, severity: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white focus:outline-none focus:border-pixiu-blue"
                >
                  <option value="info">🔵 Info</option>
                  <option value="important">🟣 Important</option>
                  <option value="urgent">🔴 Urgent</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Title *</label>
                <input 
                  type="text" 
                  value={editFormData.title}
                  onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Message Body *</label>
                <textarea 
                  rows={4}
                  value={editFormData.message}
                  onChange={e => setEditFormData({ ...editFormData, message: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 leading-relaxed focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingNotif(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-pixiu-blue hover:bg-blue-600 text-white rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
