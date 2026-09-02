import { useState, useMemo } from 'react';
import { 
  Building2, Users, Award, BookOpen, Receipt, FileText, 
  CheckCircle2, Clock, Phone, MessageSquare, Search, Filter, 
  Download, ArrowUpRight, ShieldCheck, Sparkles, LogOut, ChevronRight,
  GraduationCap, Calendar, Check, Zap, ArrowRight, Bell, X, Megaphone,
  Box, AlertTriangle, RefreshCw, Send, Printer, IndianRupee, ShieldAlert,
  CheckSquare, Square, Upload, Image as ImageIcon
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { generateStudentTranscriptPDF, generateClassCohortTranscriptPDF } from '../utils/transcriptGenerator';
import KpiCard from '../components/ui/KpiCard';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';

export default function SchoolPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { 
    schools, 
    students, 
    classes, 
    trainers, 
    billing, 
    sessions, 
    attendance, 
    projects, 
    studentReviews, 
    curriculum,
    inventory = [],
    notifications,
    updateInventoryStatus,
    updateBillingInvoice,
    pushSchoolNotification,
    uploadFile
  } = useData();

  // Determine active school (Scoped to school login, or selectable for admin preview)
  const defaultSchoolId = (user && user.school_id && user.school_id !== 'ALL') ? user.school_id : 'ZPS';
  const [selectedSchoolId, setSelectedSchoolId] = useState(defaultSchoolId);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'curriculum' | 'billing' | 'hardware' | 'trainer'
  
  // Payment Submission Modal State (For School claiming payment with UTR / Screenshot)
  const [submittingPaymentInvoice, setSubmittingPaymentInvoice] = useState(null);
  const [paymentFormData, setPaymentFormData] = useState({
    transaction_id: '',
    payment_method: 'NEFT / RTGS Bank Transfer',
    payment_date: new Date().toISOString().split('T')[0],
    proof_url: '',
    notes: ''
  });
  const [selectedProofFile, setSelectedProofFile] = useState(null);
  const [proofFilePreview, setProofFilePreview] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // RMA Modal State
  const [isRmaModalOpen, setIsRmaModalOpen] = useState(false);
  const [rmaData, setRmaData] = useState({
    kit_id: 'KIT-ZPS-01',
    component_name: 'Ultrasonic Sensor HC-SR04',
    issue_description: 'VCC pin broken during breadboard test',
    urgency: 'High'
  });

  // Notification Flyout & Read State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [readNotifIds, setReadNotifIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`pixiu_school_read_${defaultSchoolId}`) || '[]');
    } catch (e) {
      return [];
    }
  });

  const activeSchool = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId) || schools[0] || {
      id: 'ZPS',
      name: 'Zenith Public School',
      code: 'ZPS',
      principal_name: 'Dr. R.K. Mishra',
      principal_phone: '+91 94151 22334',
      lab_room: 'Block B - Innovation Lab 102',
      trainer_id: 'TR-01'
    };
  }, [schools, selectedSchoolId]);

  // Relevant School Announcements from Central Admin
  const schoolNotifications = useMemo(() => {
    if (!notifications || !Array.isArray(notifications)) return [];
    return notifications.filter(n => {
      const aud = n.target_audience || n.target_school_id || n.target_type;
      if (!aud || aud === 'ALL' || aud === 'Universal' || aud === 'All_Students' || aud === 'All_Trainers') return true;
      if (aud === activeSchool.id || aud === activeSchool.code) return true;
      if (n.target_type === 'School' && (n.target_school_id === activeSchool.id || n.target_school_id === activeSchool.code)) return true;
      return false;
    });
  }, [notifications, activeSchool]);

  // Filter students for this school
  const schoolStudents = useMemo(() => {
    return students.filter(s => s.school_id === activeSchool.id || s.school_id === activeSchool.code);
  }, [students, activeSchool]);

  // Assigned Trainer
  const assignedTrainer = useMemo(() => {
    return trainers.find(t => 
      t.assigned_schools === activeSchool.id || 
      t.assigned_schools === activeSchool.code ||
      t.id === activeSchool.trainer_id
    ) || {
      name: activeSchool.id === 'XYZ' ? 'Akash Sharma' : 'Vikas Pandey',
      role: activeSchool.id === 'XYZ' ? 'Senior STEM & Robotics Trainer' : 'Lead STEM & Robotics Trainer',
      phone: activeSchool.id === 'XYZ' ? '+91 94500 77882' : '+91 94500 88991',
      rating: 5.0,
      weekly_days: 2
    };
  }, [trainers, activeSchool]);

  // School Billing
  const schoolBilling = useMemo(() => {
    return billing.filter(b => b.school_id === activeSchool.id || b.school_id === activeSchool.code);
  }, [billing, activeSchool]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return schoolStudents.filter(s => {
      const matchesGrade = selectedGradeFilter === 'ALL' || (s.class_id && s.class_id.includes(selectedGradeFilter)) || s.student_id?.includes(selectedGradeFilter);
      const matchesSearch = !searchQuery || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.assigned_kit_id?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGrade && matchesSearch;
    });
  }, [schoolStudents, selectedGradeFilter, searchQuery]);

  // School Attendance Rate
  const schoolAttendanceRate = useMemo(() => {
    const schoolSessions = sessions.filter(s => s.school_id === activeSchool.id);
    const sessionIds = schoolSessions.map(s => s.id);
    const schoolAttendanceRecords = attendance.filter(a => sessionIds.includes(a.session_id));
    if (schoolAttendanceRecords.length === 0) return 96;
    const presentCount = schoolAttendanceRecords.filter(a => a.status === 'Present').length;
    return Math.round((presentCount / schoolAttendanceRecords.length) * 100);
  }, [sessions, attendance, activeSchool]);

  // Hardware Kits for this school
  const schoolKits = useMemo(() => {
    return inventory.filter(k => k.school_id === activeSchool.id || k.school_id === activeSchool.code);
  }, [inventory, activeSchool]);

  // Helper for student attendance
  const getStudentAttendance = (studentId) => {
    const records = attendance.filter(a => a.student_id === studentId);
    if (!records.length) return 100;
    const present = records.filter(r => r.status === 'Present').length;
    return Math.round((present / records.length) * 100);
  };

  // Payment Confirmation Handlers
  const handleOpenPaymentModal = (inv) => {
    setSubmittingPaymentInvoice(inv);
    setPaymentFormData({
      transaction_id: inv.transaction_id || inv.receipt_no || '',
      payment_method: inv.payment_method || 'NEFT / RTGS Bank Transfer',
      payment_date: inv.paid_date || new Date().toISOString().split('T')[0],
      proof_url: inv.proof_url || '',
      notes: inv.payment_notes || ''
    });
    setSelectedProofFile(null);
    setProofFilePreview(inv.proof_url || '');
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedProofFile(file);
      setProofFilePreview(URL.createObjectURL(file));
    }
  };

  const handlePaymentFormSubmit = async (e) => {
    e.preventDefault();
    if (!submittingPaymentInvoice) return;

    setIsUploadingProof(true);
    let uploadedUrl = paymentFormData.proof_url;

    if (selectedProofFile) {
      const uploadRes = await uploadFile(selectedProofFile);
      if (uploadRes && uploadRes.success) {
        uploadedUrl = uploadRes.url;
      }
    }

    const updatedFields = {
      status: 'Pending Verification',
      school_claimed_payment: true,
      transaction_id: paymentFormData.transaction_id,
      receipt_no: paymentFormData.transaction_id,
      payment_method: paymentFormData.payment_method,
      paid_date: paymentFormData.payment_date,
      proof_url: uploadedUrl,
      payment_notes: paymentFormData.notes,
      claimed_at: new Date().toISOString()
    };

    await updateBillingInvoice(submittingPaymentInvoice.id, updatedFields);

    // Push high-priority notification to Admin
    await pushSchoolNotification({
      target_school_id: 'ALL',
      title: `💰 Payment Proof Submitted: ${activeSchool.name}`,
      message: `${activeSchool.name} submitted payment proof for ${submittingPaymentInvoice.tranche_title || 'Robotics Tranche'} (₹${Number(submittingPaymentInvoice.amount).toLocaleString('en-IN')}) with UTR: ${paymentFormData.transaction_id}. Please match and reconcile.`,
      type: 'payment_claim',
      priority: 'high'
    });

    setIsUploadingProof(false);
    setSubmittingPaymentInvoice(null);
    setSelectedProofFile(null);
    setProofFilePreview('');

    toast.success(
      `Payment proof for ${submittingPaymentInvoice.id} logged! Notification dispatched to Pixiu Finance Admin for matching.`,
      'Payment Submitted'
    );
  };

  const handleUntickPayment = async (inv) => {
    if (inv.status === 'Paid' || inv.is_confirmed === 1) {
      toast.info('This invoice is already verified and reconciled by Pixiu Finance.');
      return;
    }

    await updateBillingInvoice(inv.id, {
      status: 'Pending',
      school_claimed_payment: false,
      transaction_id: '',
      receipt_no: '',
      proof_url: '',
      payment_notes: ''
    });

    toast.info(`Payment submission for ${inv.id} reverted to unpaid.`, 'Claim Reverted');
  };

  const handlePrintInvoice = (inv) => {
    const printWindow = window.open('', '_blank');
    const isPaid = inv.status === 'Paid' || inv.is_confirmed === 1;
    const isPendingVerification = inv.status === 'Pending Verification' || inv.school_claimed_payment;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Official Tax Invoice - ${inv.id}</title>
          <base href="${window.location.origin}/" />
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0A1A33; padding-bottom: 20px; margin-bottom: 25px; }
            .brand { font-size: 24px; font-weight: 900; color: #0A1A33; letter-spacing: -0.5px; }
            .brand span { color: #2563EB; }
            .tagline { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-top: 2px; }
            .invoice-title { font-size: 22px; font-weight: 800; color: #0A1A33; text-align: right; }
            .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 5px; }
            .badge-paid { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
            .badge-pending-verify { background: #eff6ff; color: #1d4ed8; border: 1px solid #93c5fd; }
            .badge-due { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; font-size: 13px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; }
            .card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
            th { background: #0A1A33; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
            .total-row { font-weight: 800; font-size: 15px; background: #f1f5f9; }
            .bank-box { background: #f0fdf4; border: 1px dashed #22c55e; border-radius: 8px; padding: 15px; font-size: 12px; margin-bottom: 25px; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #64748b; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="${window.location.origin}/img/logo.png" alt="Pixiu Tech Logo" style="height: 48px; width: auto; object-contain;" />
              <div>
                <div class="brand">PIXIU <span>TECH LLP</span></div>
                <div class="tagline">Enterprise STEM & Robotics Laboratory Solutions</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Gorakhpur, Uttar Pradesh | contact@pixiutech.com</div>
              </div>
            </div>
            <div>
              <div class="invoice-title">TAX INVOICE</div>
              <div style="font-family: monospace; font-size: 12px; font-weight: bold; color: #64748b; margin-top: 2px;">#${inv.id}</div>
              <div class="badge ${isPaid ? 'badge-paid' : (isPendingVerification ? 'badge-pending-verify' : 'badge-due')}">
                ${isPaid ? 'PAID & RECONCILED' : (isPendingVerification ? 'PAYMENT SUBMITTED (PENDING RECONCILIATION)' : 'PAYMENT DUE')}
              </div>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">Billed To (Institution):</div>
              <p style="margin: 0; font-weight: 800; font-size: 14px; color: #0A1A33;">${activeSchool.name}</p>
              <p style="margin: 4px 0 0; color: #475569;">School Code: <strong>${activeSchool.code || activeSchool.id}</strong></p>
              <p style="margin: 2px 0 0; color: #475569;">Principal: ${activeSchool.principal_name || 'Administration'}</p>
              <p style="margin: 2px 0 0; color: #475569;">Phone: ${activeSchool.principal_phone || 'N/A'}</p>
            </div>
            <div class="card">
              <div class="card-title">Invoice & Transaction Details:</div>
              <p style="margin: 0; color: #475569;">Date Issued: <strong>${inv.date_issued || '2026-08-01'}</strong></p>
              <p style="margin: 4px 0 0; color: #475569;">Due Date: <strong style="color: ${isPaid ? '#15803d' : '#b45309'};">${inv.due_date || '2026-08-15'}</strong></p>
              <p style="margin: 4px 0 0; color: #475569;">Payment Status: <strong>${inv.status}</strong></p>
              ${inv.transaction_id ? `<p style="margin: 4px 0 0; color: #1e40af; font-family: monospace;">Transaction Ref/UTR: <strong>${inv.transaction_id}</strong></p>` : ''}
              ${inv.paid_date ? `<p style="margin: 2px 0 0; color: #15803d;">Payment Date: <strong>${inv.paid_date}</strong></p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${inv.tranche_title || 'Robotics Lab Tranche'}</strong><br/><span style="font-size: 11px; color: #64748b;">Annual Robotics Curriculum, Hardware Kit Maintenance, & Trainer Deployment</span></td>
                <td style="text-align: right; font-weight: 700;">₹${Number(inv.amount).toLocaleString('en-IN')}</td>
              </tr>
              <tr class="total-row">
                <td>Total Net Payable</td>
                <td style="text-align: right; color: #0A1A33;">₹${Number(inv.amount).toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="bank-box">
            <div style="font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 6px;">Bank Wire Transfer Details:</div>
            <div><strong>Beneficiary:</strong> PIXIU TECH LLP</div>
            <div><strong>Account Number:</strong> 5599971440</div>
            <div><strong>Bank & Branch:</strong> Central Bank of India | Gorakhpur Main Branch</div>
            <div><strong>IFSC Code:</strong> CBIN0282573</div>
          </div>

          <div class="footer">
            <p style="margin: 0; font-weight: 600;">This is an official computer-generated tax invoice issued by Pixiu Tech LLP.</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const handleRmaSubmit = (e) => {
    e.preventDefault();
    toast.success(`RMA Ticket lodged for ${rmaData.component_name} (${rmaData.kit_id})! Replacement dispatched within 48h.`, 'RMA Ticket Created');
    setIsRmaModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-xl shadow-md border border-white/20">
              <img src="/img/logo.png" alt="Pixiu Tech Logo" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <span className="font-black tracking-wider text-sm sm:text-base text-white">PIXIU TECH</span>
              <span className="text-[10px] text-pixiu-blue font-bold block uppercase tracking-widest leading-none">
                Principal ERP Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-white truncate max-w-[200px]">{activeSchool.name}</p>
              <p className="text-[10px] text-emerald-400 font-medium">Verified Institutional Partner</p>
            </div>

            <button
              onClick={() => logout()}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Secure Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Institutional Welcome Strip */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-700/80 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold mb-3">
                <Building2 size={13} /> {activeSchool.city || 'Gorakhpur'} Campus
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeSchool.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Autonomous Robotics & STEM Laboratory Console. Track classroom attendance, curriculum progression milestones, and official financial ledgers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setIsRmaModalOpen(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-rose-600/20"
              >
                <AlertTriangle size={15} />
                <span>Report Damaged Kit (RMA)</span>
              </button>

              <button
                onClick={() => setActiveTab('billing')}
                className="px-4 py-2.5 bg-pixiu-blue hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                <Receipt size={15} />
                <span>View Fee Ledger</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            icon={<Users size={22} />}
            label="Enrolled Students"
            value={schoolStudents.length}
            subtext={`${classes.filter(c => c.school_id === activeSchool.id).length || 5} Active Classrooms`}
            color="blue"
          />

          <KpiCard
            icon={<CheckCircle2 size={22} />}
            label="Lab Attendance"
            value={`${schoolAttendanceRate}%`}
            subtext="Consistent High Attendance"
            color="emerald"
          />

          <KpiCard
            icon={<Box size={22} />}
            label="Hardware Lab Kits"
            value={schoolKits.length > 0 ? schoolKits.length : `${schoolStudents.length} Kits`}
            subtext="100% Operational Readiness"
            color="violet"
          />

          <KpiCard
            icon={<IndianRupee size={22} />}
            label="Contract Invoiced"
            value={`₹${schoolBilling.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString('en-IN')}`}
            subtext="Annual STEM Lab Suite"
            color="amber"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 rounded-2xl border border-slate-300/60">
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'students' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={14} /> Student Directory ({schoolStudents.length})
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'billing' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt size={14} /> Official Financial Ledger ({schoolBilling.length})
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'hardware' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Box size={14} /> Lab Hardware & RMA
          </button>

          <button
            onClick={() => setActiveTab('trainer')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'trainer' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap size={14} /> Assigned Faculty
          </button>
        </div>

        {/* TAB 1: STUDENT DIRECTORY */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student by name, roll ID or kit..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-pixiu-blue"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {['ALL', '6', '7', '8', '9', '11'].map(grade => (
                    <button
                      key={grade}
                      onClick={() => setSelectedGradeFilter(grade)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        selectedGradeFilter === grade ? 'bg-pixiu-blue text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {grade === 'ALL' ? 'All Classes' : `Class ${grade}`}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const targetGrade = selectedGradeFilter === 'ALL' ? '6' : selectedGradeFilter;
                    const cohortStudents = selectedGradeFilter === 'ALL'
                      ? schoolStudents
                      : schoolStudents.filter(s => s.class_id?.includes(selectedGradeFilter) || s.student_id?.includes(selectedGradeFilter));

                    generateClassCohortTranscriptPDF({
                      classGrade: targetGrade,
                      classSection: 'A',
                      school: activeSchool,
                      students: cohortStudents,
                      studentReviews,
                      projects,
                      curriculum,
                      getStudentAttendance,
                      userRole: 'school'
                    });
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Download Class Cohort Progress & Laboratory Report PDF"
                >
                  <Download size={13} />
                  <span>Class {selectedGradeFilter === 'ALL' ? 'Cohort' : selectedGradeFilter} Report PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Candidate Roll</th>
                    <th className="pb-3">Full Name</th>
                    <th className="pb-3">Tech Level</th>
                    <th className="pb-3">Assigned Kit</th>
                    <th className="pb-3">Attendance</th>
                    <th className="pb-3 text-right">Official Transcript</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(student => (
                    <tr key={student.student_id} className="hover:bg-slate-50/80">
                      <td className="py-3 font-mono font-bold text-pixiu-blue">{student.student_id}</td>
                      <td className="py-3 font-bold text-slate-900">{student.name}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold text-[10px] border border-blue-200">
                          {student.tech_level || 'Level 0'}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-slate-600">{student.assigned_kit_id || 'KIT-01'}</td>
                      <td className="py-3 font-bold text-emerald-700">{getStudentAttendance(student.student_id)}%</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => generateStudentTranscriptPDF({
                            student,
                            schoolName: activeSchool.name,
                            studentReviews: studentReviews.filter(r => r.student_id === student.student_id),
                            projects: projects.filter(p => p.student_id === student.student_id),
                            attendanceRate: getStudentAttendance(student.student_id)
                          })}
                          className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Download size={12} /> Transcript PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: FINANCIAL LEDGER WITH TICK / UNTICK RECONCILIATION */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Institutional Milestone Financial Ledger</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tick to mark payment done, submit UTR/screenshot proof for instant admin reconciliation.
                  </p>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-right">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Total Milestone Invoiced</span>
                  <span className="text-lg font-black text-emerald-700">
                    ₹{schoolBilling.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {schoolBilling.map(inv => {
                  const isPaid = inv.status === 'Paid' || inv.is_confirmed === 1;
                  const isPendingVerification = inv.status === 'Pending Verification' || inv.school_claimed_payment;

                  return (
                    <div
                      key={inv.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isPaid 
                          ? 'bg-emerald-50/30 border-emerald-200' 
                          : isPendingVerification 
                            ? 'bg-blue-50/30 border-blue-200' 
                            : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Interactive Payment Checkbox / Tick Icon */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isPaid) {
                              toast.info('This invoice is already verified and confirmed by Pixiu Finance Admin.');
                            } else if (isPendingVerification) {
                              handleUntickPayment(inv);
                            } else {
                              handleOpenPaymentModal(inv);
                            }
                          }}
                          className="mt-0.5 text-slate-400 hover:text-pixiu-blue cursor-pointer transition-transform active:scale-90"
                          title={
                            isPaid 
                              ? "Payment Verified & Reconciled" 
                              : isPendingVerification 
                                ? "Click to untick / revoke submission" 
                                : "Click to mark payment done and enter UTR"
                          }
                        >
                          {isPaid ? (
                            <CheckSquare size={24} className="text-emerald-600 fill-emerald-100" />
                          ) : isPendingVerification ? (
                            <CheckSquare size={24} className="text-blue-600 fill-blue-100 animate-pulse" />
                          ) : (
                            <Square size={24} className="text-slate-300 hover:text-emerald-600" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-pixiu-blue">#{inv.id}</span>
                            
                            {isPaid ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={11} /> PAID & RECONCILED
                              </span>
                            ) : isPendingVerification ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                                <Clock size={11} className="animate-spin" /> SUBMITTED (Awaiting Admin Match)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                ⏳ PAYMENT DUE
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-slate-900 text-sm">{inv.tranche_title || 'Robotics Lab Tranche'}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
                            <span>Date Issued: <strong>{inv.date_issued || '2026-08-01'}</strong></span>
                            <span>Due Date: <strong className="text-slate-700">{inv.due_date || '2026-08-15'}</strong></span>
                            {inv.transaction_id && (
                              <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                UTR: {inv.transaction_id}
                              </span>
                            )}
                            {inv.paid_date && (
                              <span className="text-emerald-700 font-bold">
                                Paid on: {inv.paid_date}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-center">
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-900">
                            ₹{Number(inv.amount).toLocaleString('en-IN')}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-medium">Net Amount (INR)</span>
                        </div>

                        {!isPaid && !isPendingVerification && (
                          <button
                            onClick={() => handleOpenPaymentModal(inv)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                          >
                            <CheckSquare size={14} />
                            <span>Mark Paid</span>
                          </button>
                        )}

                        {isPendingVerification && (
                          <button
                            onClick={() => handleUntickPayment(inv)}
                            className="px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200"
                            title="Revert payment submission"
                          >
                            Untick
                          </button>
                        )}

                        <button
                          onClick={() => handlePrintInvoice(inv)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Printer size={14} />
                          <span>Tax Invoice</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Wire Transfer Profile */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 text-xs text-emerald-950 space-y-2">
                <h4 className="font-bold text-emerald-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-emerald-700" />
                  Official Bank Wire Transfer Coordinates:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 pt-1">
                  <div><strong>Beneficiary / Company:</strong> PIXIU TECH LLP</div>
                  <div><strong>Account Number:</strong> 5599971440</div>
                  <div><strong>Bank & Branch:</strong> Central Bank of India (Gorakhpur Main)</div>
                  <div><strong>IFSC Code:</strong> CBIN0282573</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: HARDWARE LAB & RMA */}
        {activeTab === 'hardware' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Robotics Hardware Kits & Component Health</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time component tracking, sensor diagnostics & guaranteed 48-hour RMA replacements.
                </p>
              </div>

              <button
                onClick={() => setIsRmaModalOpen(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-rose-600/20"
              >
                <AlertTriangle size={15} />
                <span>Log Broken Component</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { name: 'Arduino Uno R3 Microcontrollers', total: 25, status: 'Healthy', color: 'emerald' },
                { name: 'Ultrasonic Distance Sensors HC-SR04', total: 25, status: 'Healthy', color: 'emerald' },
                { name: 'Dual H-Bridge Motor Drivers L298N', total: 25, status: 'Healthy', color: 'emerald' },
                { name: 'Solderless Breadboards 830-Point', total: 50, status: 'Healthy', color: 'emerald' },
                { name: 'High-Torque TT Geared DC Motors', total: 50, status: 'Healthy', color: 'emerald' },
                { name: '16x2 I2C Character LCD Displays', total: 25, status: 'Healthy', color: 'emerald' }
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{item.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Inventory Stock: {item.total} Units</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-lg text-[10px]">
                    ✓ 100% Operational
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ASSIGNED TRAINER */}
        {activeTab === 'trainer' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Assigned Robotics Instructor</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Certified robotics trainer deployed to your institution for regular laboratory sessions.
                </p>
              </div>

              <a
                href={`https://wa.me/${assignedTrainer.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(assignedTrainer.name)},%20reaching%20out%20from%20${encodeURIComponent(activeSchool.name)}.`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
              >
                <Phone size={15} />
                <span>Contact Instructor on WhatsApp</span>
              </a>
            </div>

            <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white font-black text-xl flex items-center justify-center shrink-0 shadow-sm">
                {assignedTrainer.name.charAt(0)}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">{assignedTrainer.name}</h3>
                <p className="text-xs font-bold text-pixiu-blue">{assignedTrainer.role}</p>
                <p className="text-xs text-slate-500">Contact: <strong className="font-mono text-slate-800">{assignedTrainer.phone}</strong> • Rating: <strong>{assignedTrainer.rating} / 5.0 ★</strong></p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODAL 1: PAYMENT SUBMISSION MODAL ==================== */}
      <Modal
        isOpen={!!submittingPaymentInvoice}
        onClose={() => setSubmittingPaymentInvoice(null)}
        title={`Confirm Payment Submission - #${submittingPaymentInvoice?.id || ''}`}
        size="md"
      >
        {submittingPaymentInvoice && (
          <form onSubmit={handlePaymentFormSubmit} className="space-y-4 text-xs">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase block">Tranche Details</span>
              <h4 className="font-bold text-emerald-950 text-sm">{submittingPaymentInvoice.tranche_title}</h4>
              <p className="text-base font-black text-emerald-700 mt-0.5">
                ₹{Number(submittingPaymentInvoice.amount).toLocaleString('en-IN')}
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">
                Transaction ID / UTR / Reference Number *
              </label>
              <input
                type="text"
                required
                value={paymentFormData.transaction_id}
                onChange={e => setPaymentFormData({ ...paymentFormData, transaction_id: e.target.value })}
                placeholder="e.g. UTR984719283719 or IMPS/UPI Ref No"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Payment Method *</label>
                <select
                  value={paymentFormData.payment_method}
                  onChange={e => setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-pixiu-blue"
                >
                  <option value="NEFT / RTGS Bank Transfer">NEFT / RTGS Bank Transfer</option>
                  <option value="UPI / Instant QR Payment">UPI / Instant QR Payment</option>
                  <option value="Account Payee Cheque">Account Payee Cheque</option>
                  <option value="Direct Bank Wire">Direct Bank Wire</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 uppercase mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentFormData.payment_date}
                  onChange={e => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:border-pixiu-blue"
                />
              </div>
            </div>

            {/* Optional Screenshot / Payment Proof Upload */}
            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">
                Payment Screenshot / Receipt Proof (Optional)
              </label>
              <div className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-slate-50/60 hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleProofFileChange}
                  className="hidden"
                  id="proof-upload"
                />
                <label htmlFor="proof-upload" className="cursor-pointer block space-y-1">
                  <Upload size={18} className="mx-auto text-slate-400" />
                  <span className="text-[11px] font-bold text-pixiu-blue block">
                    {selectedProofFile ? selectedProofFile.name : "Click to attach payment receipt screenshot"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">PNG, JPG, or PDF up to 5MB</span>
                </label>
              </div>

              {proofFilePreview && (
                <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-36 flex items-center justify-center bg-slate-100">
                  <img src={proofFilePreview} alt="Proof Preview" className="max-h-36 object-contain" />
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-600 uppercase mb-1">Additional Notes / Remarks</label>
              <textarea
                rows="2"
                value={paymentFormData.notes}
                onChange={e => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                placeholder="e.g. Paid via Central Bank corporate netbanking..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSubmittingPaymentInvoice(null)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUploadingProof}
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
              >
                <CheckSquare size={14} />
                <span>{isUploadingProof ? "Uploading Proof..." : "Confirm & Submit Payment Proof"}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ==================== MODAL 2: RMA TICKET MODAL ==================== */}
      <Modal
        isOpen={isRmaModalOpen}
        onClose={() => setIsRmaModalOpen(false)}
        title="Report Damaged Hardware / RMA Dispatch"
        size="sm"
      >
        <form onSubmit={handleRmaSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Kit ID / Classroom</label>
            <select
              value={rmaData.kit_id}
              onChange={e => setRmaData({ ...rmaData, kit_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold bg-white focus:outline-none focus:border-pixiu-blue"
            >
              <option value="KIT-ZPS-01">Class 6A - KIT-01</option>
              <option value="KIT-ZPS-02">Class 7A - KIT-02</option>
              <option value="KIT-ZPS-03">Class 8A - KIT-03</option>
              <option value="KIT-ZPS-04">Class 9A - KIT-04</option>
              <option value="KIT-ZPS-05">Class 11A - KIT-05</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Component Name *</label>
            <input
              type="text"
              value={rmaData.component_name}
              onChange={e => setRmaData({ ...rmaData, component_name: e.target.value })}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-600 uppercase mb-1">Issue Description *</label>
            <textarea
              rows="3"
              value={rmaData.issue_description}
              onChange={e => setRmaData({ ...rmaData, issue_description: e.target.value })}
              required
              placeholder="e.g. Pin burnt or motor gear slipping..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-medium focus:outline-none focus:border-pixiu-blue"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRmaModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <AlertTriangle size={14} />
              <span>Dispatch RMA Ticket</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
