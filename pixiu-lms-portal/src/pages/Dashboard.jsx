import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Trophy, Activity, Building2, BookOpen, Plus, Bell, AlertCircle, Zap, ShieldCheck, Sparkles, X, Box, IndianRupee } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/ui/Modal';
import KpiCard from '../components/ui/KpiCard';

export default function Dashboard() {
  const { schools, classes, students, inventory, billing, leads, alerts, resolveAlertAction, addSchool, addClass } = useData();
  const toast = useToast();
  const [selectedSchool, setSelectedSchool] = useState('All');
  const [actionLoading, setActionLoading] = useState(null);
  
  // Modals
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const handleExecuteAction = async (alertItem) => {
    setActionLoading(alertItem.id);
    const res = await resolveAlertAction(alertItem.id, alertItem.action_type, alertItem.related_id);
    setActionLoading(null);
    if (res.success) {
      toast.success(res.message, 'Operational Trigger Executed');
    } else {
      toast.error(res.error || 'Failed to execute trigger');
    }
  };

  const filteredAlerts = selectedSchool === 'All' 
    ? alerts 
    : alerts.filter(a => a.message.includes(selectedSchool) || a.related_id === selectedSchool || a.title.includes(selectedSchool));

  const [schoolFormData, setSchoolFormData] = useState({
    name: '',
    code: '',
    principal: '',
    contact: '',
    expected_revenue: 150000
  });

  const [classFormData, setClassFormData] = useState({
    school_id: 'ZPS',
    grade: '6',
    section: 'A'
  });

  const recentLogs = useMemo(() => {
    try {
      const raw = localStorage.getItem('pixiu_admin_logs');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch (e) {
      return [];
    }
  }, []);

  // Calculate live dynamic metrics from real database state
  const stats = useMemo(() => {
    const relevantStudents = selectedSchool === 'All' 
      ? students 
      : students.filter(s => s.school_id === selectedSchool);

    const relevantClasses = selectedSchool === 'All' 
      ? classes 
      : classes.filter(c => c.school_id === selectedSchool);

    const relevantRevenue = selectedSchool === 'All'
      ? billing.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)
      : billing.filter(b => b.school_id === selectedSchool).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return {
      studentsCount: relevantStudents.length,
      classesCount: relevantClasses.length,
      schoolsCount: selectedSchool === 'All' ? schools.length : 1,
      totalRevenue: relevantRevenue
    };
  }, [schools, classes, students, billing, selectedSchool]);

  // Dynamic Level Distribution from real student data
  const performanceData = useMemo(() => {
    const activeStudents = selectedSchool === 'All' 
      ? students 
      : students.filter(s => s.school_id === selectedSchool);

    return [
      { level: 'Level 0 (Beginner)', students: activeStudents.filter(s => (s.tech_level || '').includes('Level 0')).length },
      { level: 'Level 1 (Foundation)', students: activeStudents.filter(s => (s.tech_level || '').includes('Level 1')).length },
      { level: 'Level 2 (Applied)', students: activeStudents.filter(s => (s.tech_level || '').includes('Level 2')).length },
      { level: 'Level 3 (Intermediate)', students: activeStudents.filter(s => (s.tech_level || '').includes('Level 3')).length },
      { level: 'Level 4 (Advanced)', students: activeStudents.filter(s => (s.tech_level || '').includes('Level 4')).length },
      { level: 'Level 5 (Graduates)', students: activeStudents.filter(s => (s.tech_level || '').includes('Level 5') || s.status === 'Certified Graduate' || s.status === 'Completed').length },
    ];
  }, [students, selectedSchool]);

  // Hardware Health Data from real inventory
  const hardwareData = useMemo(() => {
    const activeKits = selectedSchool === 'All'
      ? inventory
      : inventory.filter(k => k.school_id === selectedSchool);

    return [
      { name: 'Healthy', value: Math.max(1, activeKits.filter(k => k.status === 'Healthy').length), color: '#10B981' },
      { name: 'In Repair', value: activeKits.filter(k => k.status === 'In Repair').length, color: '#F59E0B' },
      { name: 'Damaged', value: activeKits.filter(k => k.status === 'Damaged').length, color: '#EF4444' },
    ];
  }, [inventory, selectedSchool]);

  const handleSchoolSubmit = async (e) => {
    e.preventDefault();
    const code = schoolFormData.code.toUpperCase().trim();
    await addSchool({
      id: code,
      name: schoolFormData.name,
      code: code,
      principal: schoolFormData.principal,
      contact: schoolFormData.contact,
      status: 'Active',
      contract_start: new Date().toISOString().split('T')[0],
      renewal_date: '2027-03-31',
      expected_revenue: Number(schoolFormData.expected_revenue) || 0
    });
    setIsSchoolModalOpen(false);
  };

  const handleClassSubmit = async (e) => {
    e.preventDefault();
    await addClass({
      school_id: classFormData.school_id,
      grade: classFormData.grade,
      section: classFormData.section.toUpperCase()
    });
    setIsClassModalOpen(false);
  };

  const attendanceGraph = [
    { name: 'Mon', attendance: 92 },
    { name: 'Tue', attendance: 95 },
    { name: 'Wed', attendance: 88 },
    { name: 'Thu', attendance: 94 },
    { name: 'Fri', attendance: 96 },
    { name: 'Sat', attendance: 98 },
  ];

  // Pixiu Intelligence Visibility State
  const [showIntelligence, setShowIntelligence] = useState(true);

  return (
    <div className="pb-10 bg-grid-tech min-h-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Command Center</h1>
          <p className="text-sm text-slate-500">Network-wide robotics ERP & LMS operations console.</p>
        </div>
        
        <div className="flex flex-wrap gap-2.5">
          <Link 
            to="/logs"
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-xs text-sm cursor-pointer hover:shadow-sm"
          >
            <ShieldCheck size={16} className="text-blue-600" /> Login & Audit Logs
          </Link>
          <button 
            onClick={() => setIsClassModalOpen(true)}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-xs text-sm cursor-pointer hover:shadow-sm"
          >
            <Plus size={16} /> New Class
          </button>
          <button 
            onClick={() => setIsSchoolModalOpen(true)}
            className="bg-pixiu-blue text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-blue-600 transition-all shadow-md shadow-blue-500/15 text-sm cursor-pointer"
          >
            <Plus size={16} /> Onboard School
          </button>
        </div>
      </div>

      {/* PIXIU INTELLIGENCE AUTOMATION ENGINE (WITH HIDE/SHOW TOGGLE) */}
      {showIntelligence ? (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 mb-8 shadow-xl border border-slate-700/80 relative overflow-hidden animate-in fade-in zoom-in-95">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none select-none">
            <Sparkles size={140} className="text-blue-400 pointer-events-none" />
          </div>
          
          <div className="flex items-center justify-between mb-4 relative z-20">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/20 p-2 rounded-xl border border-blue-500/30">
                <Sparkles size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">Pixiu Operational Intelligence & Automations</h2>
                <p className="text-xs text-slate-400">Live operational bottleneck detector & 1-click task dispatcher</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 relative z-30">
              <span className="text-xs font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full">
                {filteredAlerts.length} Active Triggers
              </span>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowIntelligence(false);
                }}
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-600 px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Hide this widget"
              >
                <X size={14} /> Hide Widget
              </button>
            </div>
          </div>

          <div className="space-y-3 relative z-10">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border text-xs ${
                alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/20 text-red-100' :
                alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' :
                'bg-blue-500/10 border-blue-500/20 text-blue-100'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {alert.severity === 'critical' ? <AlertCircle size={16} className="text-red-400"/> :
                     alert.severity === 'warning' ? <AlertCircle size={16} className="text-amber-400"/> :
                     <Zap size={16} className="text-blue-400"/>}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{alert.title}</p>
                    <p className="opacity-90 mt-0.5 leading-relaxed">{alert.message}</p>
                  </div>
                </div>

                {alert.action_label && (
                  <button 
                    onClick={() => handleExecuteAction(alert)}
                    disabled={actionLoading === alert.id}
                    className={`shrink-0 font-bold px-4 py-2 rounded-lg transition-all cursor-pointer shadow-md text-xs flex items-center gap-1.5 whitespace-nowrap ${
                      alert.severity === 'critical' ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20' :
                      alert.severity === 'warning' ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20' :
                      'bg-pixiu-blue hover:bg-blue-500 text-white shadow-blue-500/20'
                    }`}
                  >
                    {actionLoading === alert.id ? (
                      'Dispatching...'
                    ) : (
                      <><Sparkles size={13}/> {alert.action_label}</>
                    )}
                  </button>
                )}
              </div>
            ))}

            {filteredAlerts.length === 0 && (
              <div className="p-4 text-center text-slate-400 text-xs font-medium bg-slate-950/40 rounded-xl border border-slate-800">
                ✨ All systems smooth. No hardware failures, contract bottlenecks, or pending alerts in this scope!
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Hidden Mini Bar */
        <div className="bg-white border border-slate-200 rounded-xl p-3 mb-6 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
            <Sparkles size={15} className="text-pixiu-blue" />
            <span>Pixiu Operational Intelligence is currently collapsed.</span>
          </div>
          <button 
            onClick={() => setShowIntelligence(true)}
            className="text-xs font-bold text-pixiu-blue hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <Sparkles size={12}/> Show Automations ({filteredAlerts.length})
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4 mb-8">
        <Building2 size={18} className="text-pixiu-blue" />
        <div className="flex flex-col flex-1 max-w-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Scope Filter</span>
          <select 
            className="bg-transparent focus:outline-none cursor-pointer text-sm font-semibold text-slate-700 w-full"
            value={selectedSchool}
            onChange={e => setSelectedSchool(e.target.value)}
          >
            <option value="All">All Partner Schools (Network-wide)</option>
            {(schools || []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard icon={<Users size={22} />} label="Enrolled Learners" value={stats.studentsCount} color="blue" />
        <KpiCard icon={<Building2 size={22} />} label="Partner Schools" value={stats.schoolsCount} color="emerald" />
        <KpiCard icon={<BookOpen size={22} />} label="Active Classrooms" value={stats.classesCount} color="violet" />
        <KpiCard icon={<IndianRupee size={22} />} label="Invoiced Volume" value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`} color="amber" />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Rolling Attendance Trend (%)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceGraph}>
                <defs>
                  <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D6EFF" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1D6EFF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" domain={[60, 100]} tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600 }} />
                <Area type="monotone" dataKey="attendance" stroke="#1D6EFF" fill="url(#attendanceFill)" strokeWidth={2.5} dot={{ r: 3, fill: '#1D6EFF', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#1D6EFF', strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-4">Hardware Kits Condition</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={hardwareData} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                  {hardwareData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-xs font-semibold mt-2">
            {hardwareData.map(h => (
              <div key={h.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: h.color }}></span>
                <span className="text-slate-600">{h.name} ({h.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Level Distribution */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-800 text-sm mb-4">Students by Robotics Tech Level</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performanceData}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1D6EFF" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="level" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600 }} />
              <Bar dataKey="students" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Onboard School Modal */}
      <Modal isOpen={isSchoolModalOpen} onClose={() => setIsSchoolModalOpen(false)} title="Quick Onboard School">
        <form onSubmit={handleSchoolSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">School Name *</label>
            <input 
              type="text" 
              placeholder="e.g. DPS International" 
              value={schoolFormData.name} 
              onChange={e => {
                const name = e.target.value;
                const code = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4);
                setSchoolFormData({ ...schoolFormData, name, code: schoolFormData.code || code });
              }} 
              required 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-pixiu-blue uppercase mb-1">School Code *</label>
              <input 
                type="text" 
                placeholder="e.g. DPSI" 
                value={schoolFormData.code} 
                onChange={e => setSchoolFormData({ ...schoolFormData, code: e.target.value.toUpperCase() })} 
                required 
                maxLength={5}
                className="w-full px-3 py-2 border border-blue-300 bg-blue-50/50 font-mono font-bold text-pixiu-blue rounded-lg text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
              <input 
                type="text" 
                placeholder="e.g. 9876543210" 
                value={schoolFormData.contact} 
                onChange={e => setSchoolFormData({ ...schoolFormData, contact: e.target.value })} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setIsSchoolModalOpen(false)} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md">Save & Onboard</button>
          </div>
        </form>
      </Modal>

      {/* User & Student Login Audit Logs */}
      <div className="mt-8 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-500" />
            User & Student Login Audit Logs (Recent Activity)
          </h2>
          <Link 
            to="/logs" 
            className="text-xs font-bold text-pixiu-blue hover:text-blue-700 flex items-center gap-1 hover:underline"
          >
            Open Full Logs Console ➡️
          </Link>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-3 text-slate-500 font-bold uppercase">Date & Time</th>
                <th className="p-3 text-slate-500 font-bold uppercase">Action</th>
                <th className="p-3 text-slate-500 font-bold uppercase">User & Identity</th>
                <th className="p-3 text-slate-500 font-bold uppercase">Role</th>
                <th className="p-3 text-slate-500 font-bold uppercase">School / Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLogs.length > 0 ? (
                recentLogs.map(log => {
                  const badgeColor = 
                    log.role === 'student' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    log.role === 'trainer' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    log.role === 'school' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-blue-50 text-blue-700 border-blue-200';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-700 whitespace-nowrap">{log.date} • {log.time}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                          log.event_type === 'Logout' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {log.event_type || 'Login'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-900">
                        {log.name} <span className="text-slate-400 font-mono">(@{log.user_id})</span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-500 text-[11px]">
                        {log.school_id || 'Network'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="p-6 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <ShieldCheck size={20} className="text-blue-400" />
                      <p className="font-semibold text-xs text-slate-700">Audit Logging Active</p>
                      <p className="text-[11px] text-slate-400">Click &quot;Open Full Logs Console&quot; above to view live audit records or export reports.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Class Modal */}
      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title="Add New Classroom">
        <form onSubmit={handleClassSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Target School *</label>
            <select 
              value={classFormData.school_id} 
              onChange={e => setClassFormData({ ...classFormData, school_id: e.target.value })} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue bg-white"
            >
              {(schools || []).map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Grade / Class *</label>
              <input 
                type="text" 
                placeholder="e.g. 6" 
                value={classFormData.grade} 
                onChange={e => setClassFormData({ ...classFormData, grade: e.target.value })} 
                required 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Section</label>
              <input 
                type="text" 
                placeholder="e.g. A" 
                value={classFormData.section} 
                onChange={e => setClassFormData({ ...classFormData, section: e.target.value.toUpperCase() })} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md">Create Classroom</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
