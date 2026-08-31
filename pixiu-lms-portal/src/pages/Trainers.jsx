import { useState } from 'react';
import { 
  GraduationCap, Plus, Phone, Building2, Star, CheckCircle, Clock, X, Trash2, 
  Play, User, Camera, Check, FileText, Upload, Image as ImageIcon, IndianRupee, 
  Calendar, AlertTriangle, ShieldAlert, Lock, Unlock, Bell, Send, History, 
  CheckSquare, XSquare, ChevronRight, BookOpen
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function Trainers() {
  const { 
    trainers, schools, classes, students, sessions, markAttendance, 
    completeSession, attendance, addTrainer, updateTrainerStatus, 
    deleteTrainer, uploadFile, addProject, scheduleSession, 
    adminUpdateAttendance 
  } = useData();
  
  const { role } = useAuth();
  const isAdmin = role === 'admin' || !role; // Default fallback to admin if not specified
  const toast = useToast();
  
  // UI Tabs: 'trainers' | 'history' | 'schedule'
  const [activeTab, setActiveTab] = useState('trainers');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  
  // Security Modal for Deleting Trainer ("Type Name to Confirm")
  const [trainerToDelete, setTrainerToDelete] = useState(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  
  // Project Evidence Upload Modal in Session
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [selectedStudentForEvidence, setSelectedStudentForEvidence] = useState('');
  const [projectTitle, setProjectTitle] = useState('Smart Obstacle Avoidance Robot');
  const [projectScore, setProjectScore] = useState(10);
  const [evidenceNote, setEvidenceNote] = useState('Clean breadboard wiring with ultrasonic sensor.');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Form State for Onboarding Trainer
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: 'Senior Robotics & AI Instructor',
    assigned_schools: ['ZPS'],
    daily_rate: 600,
    weekly_days: 2,
    rating: 5.0,
    status: 'Active'
  });

  // Form State for Scheduling Next Session (Admin Notification)
  const [scheduleData, setScheduleData] = useState({
    school_id: 'ZPS',
    class_id: 'CLS-ZPS-6A',
    trainer_id: 'TR-01',
    date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    time: '10:30 AM',
    topic: 'Unit 2: Line Follower Sensor Calibration & Motor Tuning',
    notes: 'Please bring line tracking sheets and calibrate IR sensors.',
    notify_trainer: true
  });

  const activeTrainersCount = trainers.filter(t => t.status === 'Active').length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addTrainer({
      name: formData.name,
      phone: formData.phone,
      role: formData.role,
      assigned_schools: formData.assigned_schools.join(', '),
      daily_rate: Number(formData.daily_rate) || 600,
      weekly_days: Number(formData.weekly_days) || 2,
      rating: Number(formData.rating) || 5.0,
      status: formData.status
    });
    toast.success(`Trainer "${formData.name}" onboarded! Login credentials generated.`, 'Instructor Registered');
    setIsAddModalOpen(false);
    setFormData({
      name: '',
      phone: '',
      role: 'Senior Robotics & AI Instructor',
      assigned_schools: ['ZPS'],
      daily_rate: 600,
      weekly_days: 2,
      rating: 5.0,
      status: 'Active'
    });
  };

  const handleConfirmDelete = async () => {
    if (!trainerToDelete) return;
    if (deleteConfirmationInput.trim().toUpperCase() !== trainerToDelete.name.trim().toUpperCase()) {
      toast.error('Name does not match! Deletion cancelled.');
      return;
    }

    await deleteTrainer(trainerToDelete.id);
    toast.info(`Trainer ${trainerToDelete.name} permanently removed.`, 'Instructor Deleted');
    setTrainerToDelete(null);
    setDeleteConfirmationInput('');
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    await scheduleSession(scheduleData);
    toast.success(`Session scheduled for ${scheduleData.date}! Notification dispatched to Trainer Vikas Pandey.`, 'Class Scheduled & Notified');
    setIsScheduleModalOpen(false);
  };

  // Session Runner Helpers
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const sessionClass = activeSession ? classes.find(c => c.id === activeSession.class_id) : null;
  const sessionSchool = activeSession ? schools.find(s => s.id === activeSession.school_id) : null;
  const roster = activeSession ? students.filter(s => s.class_id === activeSession.class_id) : [];

  const handleMarkAttendance = async (studentId, status) => {
    if (activeSession && activeSession.is_locked === 1 && !isAdmin) {
      toast.error("This session is locked. Only Admin can edit past attendance records!");
      return;
    }
    const res = await markAttendance(activeSessionId, studentId, status);
    if (res && res.error) {
      toast.error(res.error);
    }
  };

  const getAttendanceStatus = (studentId) => {
    return attendance.find(a => a.session_id === activeSessionId && a.student_id === studentId)?.status;
  };

  const finishSession = () => {
    completeSession(activeSessionId);
    toast.success('Session marked completed and attendance permanently locked!', 'Class Attendance Submitted');
    setActiveSessionId(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleEvidenceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudentForEvidence) {
      toast.warning("Please select a student from the active roster!");
      return;
    }

    setIsUploading(true);
    let imageUrl = '';

    if (selectedFile) {
      const uploadRes = await uploadFile(selectedFile);
      if (uploadRes.success) {
        imageUrl = uploadRes.url;
      }
    }

    await addProject({
      student_id: selectedStudentForEvidence,
      title: projectTitle,
      status: 'Completed',
      score: Number(projectScore) || 10,
      evidence_note: evidenceNote,
      image_url: imageUrl,
      date_completed: new Date().toISOString().split('T')[0]
    });

    setIsUploading(false);
    setIsEvidenceModalOpen(false);
    setSelectedFile(null);
    setFilePreview('');
    toast.success(`Project "${projectTitle}" certified & attached to student portfolio!`, 'Build Evidence Uploaded');
  };

  // If in live session runner view
  if (activeSession) {
    const isLocked = activeSession.is_locked === 1;

    return (
      <div className="max-w-md mx-auto bg-slate-50 min-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-pixiu-dark text-white p-6 relative">
          <button onClick={() => setActiveSessionId(null)} className="absolute top-6 left-4 text-slate-400 hover:text-white cursor-pointer">
            <X size={24} />
          </button>
          <div className="text-center">
            <span className="text-[10px] font-bold tracking-widest text-pixiu-blue uppercase">Classroom Runner & Attendance</span>
            <h2 className="font-bold text-lg text-white mt-1">{sessionSchool ? sessionSchool.name : 'Zenith Public School'}</h2>
            <p className="text-xs text-slate-300 font-medium">{sessionClass ? `Class ${sessionClass.grade} ${sessionClass.section}` : 'General Class'}</p>
            <p className="text-[11px] text-blue-300 mt-1 font-mono">Date: {activeSession.date} • {activeSession.time || '10:00 AM'}</p>
          </div>
        </div>

        {/* Lock Warning Banner */}
        {isLocked && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-[11px] text-amber-800 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Lock size={13}/> Attendance Locked (Past Record)</span>
            {isAdmin && <span className="text-blue-600">Admin Editing Mode</span>}
          </div>
        )}

        <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center shadow-xs">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lesson Topic</p>
            <p className="font-bold text-slate-800 text-sm">{activeSession.topic}</p>
          </div>
          <div className="bg-blue-50 text-pixiu-blue p-2 rounded-lg"><FileText size={18}/></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Student Roster ({roster.length})</p>
            <span className="text-[11px] text-slate-400">Tap to mark status</span>
          </div>
          
          {roster.map(student => {
            const status = getAttendanceStatus(student.student_id);
            return (
              <div key={student.student_id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{student.name}</p>
                    <p className="text-[11px] font-mono text-slate-400">{student.student_id} • {student.assigned_kit_id || 'Kit Assigned'}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleMarkAttendance(student.student_id, 'Present')}
                    disabled={isLocked && !isAdmin}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                      status === 'Present' 
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    } ${isLocked && !isAdmin ? 'cursor-not-allowed opacity-80' : ''}`}
                    title="Mark Present"
                  >
                    <Check size={18}/>
                  </button>
                  <button 
                    onClick={() => handleMarkAttendance(student.student_id, 'Absent')}
                    disabled={isLocked && !isAdmin}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                      status === 'Absent' 
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    } ${isLocked && !isAdmin ? 'cursor-not-allowed opacity-80' : ''}`}
                    title="Mark Absent"
                  >
                    A
                  </button>
                </div>
              </div>
            );
          })}

          {/* Project Build Evidence Upload Button */}
          <div 
            onClick={() => {
              if (roster.length > 0) {
                setSelectedStudentForEvidence(roster[0].student_id);
              }
              setIsEvidenceModalOpen(true);
            }}
            className="bg-white p-4 rounded-xl border-2 border-dashed border-blue-300 hover:border-pixiu-blue bg-blue-50/30 hover:bg-blue-50/60 mt-4 text-center cursor-pointer transition-all shadow-xs"
          >
            <Camera size={22} className="mx-auto text-pixiu-blue mb-1.5" />
            <p className="text-xs font-bold text-pixiu-blue">+ Snap & Upload Robot Build Photo</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Certifies project build to student portfolio</p>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          {!isLocked ? (
            <button 
              onClick={finishSession}
              className="w-full bg-pixiu-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm cursor-pointer transition-colors"
            >
              <Lock size={16} /> Submit & Lock Attendance
            </button>
          ) : (
            <button 
              onClick={() => setActiveSessionId(null)}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              Close Session View
            </button>
          )}
        </div>

        {/* Evidence Upload Modal */}
        {isEvidenceModalOpen && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Camera size={16} className="text-pixiu-blue"/> Upload Robot Build Evidence
                </h3>
                <button onClick={() => setIsEvidenceModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
              </div>

              <form onSubmit={handleEvidenceSubmit} className="p-5 space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Select Student</label>
                  <select 
                    value={selectedStudentForEvidence} 
                    onChange={e => setSelectedStudentForEvidence(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue"
                  >
                    {roster.map(s => <option key={s.student_id} value={s.student_id}>{s.name} ({s.student_id})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Project Name</label>
                  <input 
                    type="text" 
                    value={projectTitle} 
                    onChange={e => setProjectTitle(e.target.value)} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Upload Photo / Snap Camera</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-pixiu-blue hover:file:bg-blue-100 cursor-pointer"
                  />
                  {filePreview && (
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200">
                      <img src={filePreview} alt="Preview" className="w-full h-28 object-cover" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block font-bold text-slate-500 uppercase mb-1">Score (1-10)</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="10" 
                      value={projectScore} 
                      onChange={e => setProjectScore(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue font-bold text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-500 uppercase mb-1">Observation Note</label>
                    <input 
                      type="text" 
                      value={evidenceNote} 
                      onChange={e => setEvidenceNote(e.target.value)}
                      placeholder="e.g. Mastered ultrasonic trigger"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-pixiu-blue"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsEvidenceModalOpen(false)} className="px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer">Cancel</button>
                  <button type="submit" disabled={isUploading} className="px-4 py-2 font-bold text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-xs shadow-md shadow-blue-500/20 cursor-pointer">
                    {isUploading ? 'Uploading...' : 'Save & Attach to Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Trainer Faculty & Academic Operations</h1>
          <p className="text-slate-500">Manage instructor payouts, schedule next classes with alerts, and review attendance records.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button 
              onClick={() => setIsScheduleModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm cursor-pointer text-xs"
            >
              <Bell size={16} /> Schedule Next Class & Notify Trainer
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="bg-pixiu-blue text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-600 transition-colors shadow-sm cursor-pointer text-xs"
            >
              <Plus size={16} /> Add Trainer
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('trainers')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'trainers' ? 'border-b-2 border-pixiu-blue text-pixiu-blue' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap size={17} /> Instructor Roster & Payouts
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 cursor-pointer transition-all ${
            activeTab === 'history' ? 'border-b-2 border-pixiu-blue text-pixiu-blue' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={17} /> Date-wise Attendance Logs ({sessions.length})
        </button>
      </div>

      {activeTab === 'trainers' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><GraduationCap size={24} /></div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Faculty Instructors</p>
                <p className="text-2xl font-bold text-slate-800">{trainers.length}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle size={24} /></div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Active in Field</p>
                <p className="text-2xl font-bold text-emerald-600">{activeTrainersCount}</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600"><Building2 size={24} /></div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Assigned Institution</p>
                <p className="text-xl font-bold text-slate-800">Zenith Public School</p>
              </div>
            </div>
          </div>

          {/* Main Trainers Roster Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {trainers.map(trainer => {
              const assignedCodes = trainer.assigned_schools 
                ? trainer.assigned_schools.split(',').map(s => s.trim()) 
                : ['ZPS'];

              const dailyRate = Number(trainer.daily_rate) || 600;
              const weeklyDays = Number(trainer.weekly_days) || 2;
              const weeklyPayout = dailyRate * weeklyDays;

              return (
                <div key={trainer.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                          {trainer.name.split(' ').map(w => w[0]).join('')}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">{trainer.name}</h3>
                          <p className="text-xs text-pixiu-blue font-semibold">{trainer.role}</p>
                        </div>
                      </div>

                      <button 
                        onClick={() => updateTrainerStatus(trainer.id, trainer.status === 'Active' ? 'On Leave' : 'Active')}
                        className={`text-xs font-bold px-3 py-1 rounded-full cursor-pointer transition-colors ${
                          trainer.status === 'Active' 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                        title="Click to toggle status"
                      >
                        {trainer.status}
                      </button>
                    </div>

                    {/* Salary & Payout Badge */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-3.5 rounded-xl border border-blue-100 mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                          ₹
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900">Salary & Compensation Model</p>
                          <p className="text-xs font-bold text-slate-800 mt-0.5">
                            ₹{dailyRate}/day • {weeklyDays} Days/Week
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Weekly Payout</p>
                        <p className="text-sm font-extrabold text-blue-700">₹{weeklyPayout.toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    <div className="space-y-3 my-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Phone size={13}/> Contact Phone:</span>
                        <span className="font-mono text-xs font-bold text-slate-800">{trainer.phone || 'N/A'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Star size={13} className="text-amber-500 fill-amber-500"/> Trainer Rating:</span>
                        <span className="text-xs font-bold text-slate-800">{trainer.rating || 5.0} / 5.0</span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Assigned Partner School:</span>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-white text-slate-700 border border-slate-200 shadow-2xs">
                            <Building2 size={12} className="text-pixiu-blue"/>
                            Zenith Public School (ZPS)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <button 
                      onClick={() => {
                        const upcomingOrFirst = sessions.find(s => s.status === 'Upcoming' || s.status === 'Planned') || sessions[0];
                        if (upcomingOrFirst) {
                          setActiveSessionId(upcomingOrFirst.id);
                        } else {
                          toast.warning("No active sessions currently scheduled.");
                        }
                      }}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play size={13} fill="white"/> Run Live Session & Attendance
                    </button>

                    {isAdmin && (
                      <button 
                        onClick={() => {
                          setTrainerToDelete(trainer);
                          setDeleteConfirmationInput('');
                        }}
                        className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Remove Trainer"
                      >
                        <Trash2 size={16}/> Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Date-wise Attendance Logs Tab */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Past Classroom Sessions & Attendance Logs</h3>
              <p className="text-xs text-slate-500">Immutable date-wise attendance records (Modifiable only by Super Admin)</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {sessions.map(ses => {
              const sessionAtt = attendance.filter(a => a.session_id === ses.id);
              const presentCount = sessionAtt.filter(a => a.status === 'Present').length;
              const totalCount = sessionAtt.length || 5;
              const isLocked = ses.is_locked === 1;

              return (
                <div key={ses.id} className="p-5 hover:bg-slate-50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-blue-50 text-pixiu-blue px-2.5 py-0.5 rounded-md">
                        {ses.date} • {ses.time || '10:00 AM'}
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {ses.class_id.replace('CLS-ZPS-', 'Class ')}
                      </span>
                      {isLocked ? (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock size={10} /> Locked
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Upcoming / Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-700">{ses.topic}</p>
                    {ses.notes && <p className="text-xs text-slate-400">{ses.notes}</p>}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Attendance Recorded</p>
                      <p className="text-sm font-bold text-emerald-600">{presentCount} / {totalCount} Students Present</p>
                    </div>

                    <button
                      onClick={() => setActiveSessionId(ses.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      View Record <ChevronRight size={14}/>
                    </button>
                  </div>
                </div>
              );
            })}

            {sessions.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs">
                No sessions found in history.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Next Class Modal (Admin Notification) */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Bell size={18} className="text-indigo-600"/> Schedule Next Class & Notify Trainer
                </h3>
                <p className="text-xs text-slate-500">Sets up classroom session & triggers instant notification alert</p>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Assigned Trainer</label>
                  <select 
                    value={scheduleData.trainer_id} 
                    onChange={e => setScheduleData({ ...scheduleData, trainer_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  >
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Target Class</label>
                  <select 
                    value={scheduleData.class_id} 
                    onChange={e => setScheduleData({ ...scheduleData, class_id: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  >
                    {classes.map(c => <option key={c.id} value={c.id}>Class {c.grade}{c.section} (Zenith)</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Session Date *</label>
                  <input 
                    type="date" 
                    value={scheduleData.date} 
                    onChange={e => setScheduleData({ ...scheduleData, date: e.target.value })} 
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase mb-1">Session Time</label>
                  <input 
                    type="text" 
                    value={scheduleData.time} 
                    onChange={e => setScheduleData({ ...scheduleData, time: e.target.value })} 
                    placeholder="10:30 AM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Lesson Topic & Focus *</label>
                <input 
                  type="text" 
                  value={scheduleData.topic} 
                  onChange={e => setScheduleData({ ...scheduleData, topic: e.target.value })} 
                  required
                  placeholder="e.g. Unit 2: Line Follower Sensor Calibration"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Instructor Instructions & Prep Notes</label>
                <textarea 
                  rows="2"
                  value={scheduleData.notes} 
                  onChange={e => setScheduleData({ ...scheduleData, notes: e.target.value })} 
                  placeholder="e.g. Ensure all students bring KIT-ZPS hardware kits..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsScheduleModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={14}/> Dispatch Schedule & Notification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard Trainer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Add & Onboard Robotics Trainer</h2>
                <p className="text-xs text-slate-500">Register instructor, assign schools, and configure salary payout</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trainer Full Name *</label>
                <input 
                  type="text" 
                  placeholder="e.g. Vikas Pandey" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  required 
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone Number *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 9811122233" 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role / Specialization</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Senior Robotics Instructor" 
                    value={formData.role} 
                    onChange={e => setFormData({ ...formData, role: e.target.value })} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-pixiu-blue"
                  />
                </div>
              </div>

              {/* Salary & Payout Configuration */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <IndianRupee size={14} className="text-pixiu-blue" /> Salary & Payout Settings
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Daily Session Rate (₹)</label>
                    <input 
                      type="number" 
                      placeholder="600" 
                      value={formData.daily_rate} 
                      onChange={e => setFormData({ ...formData, daily_rate: e.target.value })} 
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Days Per Week</label>
                    <input 
                      type="number" 
                      placeholder="2" 
                      value={formData.weekly_days} 
                      onChange={e => setFormData({ ...formData, weekly_days: e.target.value })} 
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-pixiu-blue font-bold"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between font-semibold">
                  <span>Calculated Weekly: ₹{(Number(formData.daily_rate) || 0) * (Number(formData.weekly_days) || 0)}</span>
                  <span>Monthly: ₹{(Number(formData.daily_rate) || 0) * (Number(formData.weekly_days) || 0) * 4}</span>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 font-medium text-white bg-pixiu-blue hover:bg-blue-600 rounded-lg text-sm shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Save & Onboard Trainer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Confirmation Modal ("Type Name to Confirm Delete") */}
      {trainerToDelete && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-200 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex justify-between items-center">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <ShieldAlert size={18} />
                <span>Confirm Trainer Deletion</span>
              </div>
              <button onClick={() => setTrainerToDelete(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to permanently delete <strong className="text-slate-900 font-bold">{trainerToDelete.name}</strong> ({trainerToDelete.id}). This will revoke their LMS portal access and clear assigned sessions.
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  To confirm, type <span className="font-mono text-rose-600 font-bold select-all">"{trainerToDelete.name}"</span> below:
                </label>
                <input 
                  type="text" 
                  placeholder={`Type "${trainerToDelete.name}" to confirm`}
                  value={deleteConfirmationInput} 
                  onChange={e => setDeleteConfirmationInput(e.target.value)} 
                  autoFocus
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-rose-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setTrainerToDelete(null)} 
                  className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmationInput.trim().toUpperCase() !== trainerToDelete.name.trim().toUpperCase()}
                  className={`px-4 py-2 font-bold text-xs rounded-lg transition-all ${
                    deleteConfirmationInput.trim().toUpperCase() === trainerToDelete.name.trim().toUpperCase()
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Permanently Delete Trainer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
