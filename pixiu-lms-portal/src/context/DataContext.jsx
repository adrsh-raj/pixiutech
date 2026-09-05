import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  SEED_SCHOOLS, SEED_CLASSES, SEED_STUDENTS, SEED_TRAINERS, 
  SEED_BILLING, SEED_SESSIONS, SEED_ATTENDANCE, SEED_INVENTORY, 
  SEED_ALERTS, SEED_CURRICULUM, SEED_CONTENT, SEED_NOTIFICATIONS,
  SEED_STUDENT_REVIEWS, SEED_PROJECTS, CLASS_KITS
} from '../data/seedData';

const DataContext = createContext();

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_URL || '/api');

const API_URL = API_BASE;

const safeGetItem = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw === 'null' || raw === 'undefined') return fallback;
    return JSON.parse(raw) || fallback;
  } catch (e) {
    return fallback;
  }
};

const safeFetch = async (url) => {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const contentType = r.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
};

export function DataProvider({ children }) {
  const [schools, setSchools] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_schools', null);
      if (!saved || saved.length < 2) {
        localStorage.setItem('pixiu_schools', JSON.stringify(SEED_SCHOOLS));
        return SEED_SCHOOLS;
      }
      const cleanSaved = saved.filter(s => s.id !== 'ABC' && s.code !== 'ABC');
      const seedIds = new Set(SEED_SCHOOLS.map(s => s.id));
      const custom = cleanSaved.filter(s => !seedIds.has(s.id));
      const merged = [...SEED_SCHOOLS, ...custom];
      localStorage.setItem('pixiu_schools', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return SEED_SCHOOLS;
    }
  });

  const [classes, setClasses] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_classes', null);
      if (!saved || saved.length < 10) {
        localStorage.setItem('pixiu_classes', JSON.stringify(SEED_CLASSES));
        return SEED_CLASSES;
      }
      const cleanSaved = saved.filter(c => c.school_id !== 'ABC' && c.id !== 'CLS-ABC-6A');
      const seedIds = new Set(SEED_CLASSES.map(c => c.id));
      const custom = cleanSaved.filter(c => !seedIds.has(c.id));
      const merged = [...SEED_CLASSES, ...custom];
      localStorage.setItem('pixiu_classes', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return SEED_CLASSES;
    }
  });

  const [students, setStudents] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_students', null);
      if (!saved || saved.length < 25) {
        localStorage.setItem('pixiu_students', JSON.stringify(SEED_STUDENTS));
        return SEED_STUDENTS;
      }
      const cleanSaved = saved.filter(s => s.school_id !== 'ABC' && s.id !== 'STU-ABC-601' && !s.student_id?.startsWith('ABC'));
      const seedIds = new Set(SEED_STUDENTS.map(s => s.id || s.student_id));
      const custom = cleanSaved.filter(s => !seedIds.has(s.id) && !seedIds.has(s.student_id));
      const merged = [...SEED_STUDENTS, ...custom];
      localStorage.setItem('pixiu_students', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return SEED_STUDENTS;
    }
  });

  const [trainers, setTrainers] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_trainers', null);
      if (!saved || saved.length < 2) {
        localStorage.setItem('pixiu_trainers', JSON.stringify(SEED_TRAINERS));
        return SEED_TRAINERS;
      }
      const seedIds = new Set(SEED_TRAINERS.map(t => t.id));
      const custom = saved.filter(t => !seedIds.has(t.id));
      const merged = [...SEED_TRAINERS, ...custom];
      localStorage.setItem('pixiu_trainers', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return SEED_TRAINERS;
    }
  });
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_sessions', null);
      if (!saved || saved.length < 10) {
        localStorage.setItem('pixiu_sessions', JSON.stringify(SEED_SESSIONS));
        return SEED_SESSIONS;
      }
      const cleanSaved = saved.filter(s => s.school_id !== 'ABC' && !s.id?.startsWith('SES-ABC'));
      const seedIds = SEED_SESSIONS.map(s => s.id);
      const custom = cleanSaved.filter(s => !seedIds.includes(s.id));
      const merged = [...custom, ...SEED_SESSIONS];
      localStorage.setItem('pixiu_sessions', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return SEED_SESSIONS;
    }
  });

  const [attendance, setAttendance] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_attendance', null);
      if (!saved || saved.length < 20) {
        localStorage.setItem('pixiu_attendance', JSON.stringify(SEED_ATTENDANCE));
        return SEED_ATTENDANCE;
      }
      const cleanSaved = saved.filter(a => !a.session_id?.startsWith('SES-ABC') && !a.student_id?.startsWith('ABC'));
      const seedSessionIds = SEED_SESSIONS.map(s => s.id);
      const custom = cleanSaved.filter(a => !seedSessionIds.includes(a.session_id));
      const merged = [...custom, ...SEED_ATTENDANCE];
      localStorage.setItem('pixiu_attendance', JSON.stringify(merged));
      return merged;
    } catch (e) {
      return SEED_ATTENDANCE;
    }
  });
  const [leads, setLeads] = useState(() => safeGetItem('pixiu_leads', []));
  const [content, setContent] = useState(() => {
    try { localStorage.setItem('pixiu_content', JSON.stringify(SEED_CONTENT)); } catch (e) {}
    return SEED_CONTENT;
  });
  const [curriculum, setCurriculum] = useState(() => {
    try { localStorage.setItem('pixiu_curriculum', JSON.stringify(SEED_CURRICULUM)); } catch (e) {}
    return SEED_CURRICULUM;
  });
  const [inventory, setInventory] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_inventory', null);
      if (!saved || saved.length < 10) {
        localStorage.setItem('pixiu_inventory', JSON.stringify(SEED_INVENTORY));
        return SEED_INVENTORY;
      }
      return saved;
    } catch (e) {
      return SEED_INVENTORY;
    }
  });
  const [classKits, setClassKits] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_class_kits', null);
      if (!saved || !saved['6'] || !saved['11'] || !saved['6']?.components || saved['6']?.components?.length < 12) {
        localStorage.setItem('pixiu_class_kits', JSON.stringify(CLASS_KITS));
        return CLASS_KITS;
      }
      return saved;
    } catch (e) {
      return CLASS_KITS;
    }
  });
  const [billing, setBilling] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_billing', null);
      if (!saved || saved.length < 3 || saved.some(b => b.amount === 45000)) {
        localStorage.setItem('pixiu_billing', JSON.stringify(SEED_BILLING));
        return SEED_BILLING;
      }
      return saved;
    } catch (e) {
      return SEED_BILLING;
    }
  });
  const [comms, setComms] = useState(() => safeGetItem('pixiu_comms', []));
  const [projects, setProjects] = useState(() => {
    try {
      const saved = safeGetItem('pixiu_projects', null);
      if (!saved || !Array.isArray(saved)) return SEED_PROJECTS;
      const userCreated = saved.filter(p => !p.id?.startsWith('PRJ-XYZ-') && !p.id?.startsWith('PRJ-ZPS-'));
      localStorage.setItem('pixiu_projects', JSON.stringify(userCreated));
      return userCreated;
    } catch (e) {
      return SEED_PROJECTS;
    }
  });
  const [alerts, setAlerts] = useState(() => safeGetItem('pixiu_alerts', SEED_ALERTS));
  const [notifications, setNotifications] = useState(() => safeGetItem('pixiu_notifications', SEED_NOTIFICATIONS));
  const [studentReviews, setStudentReviews] = useState(() => {
    try {
      const raw = safeGetItem('pixiu_student_reviews', null);
      if (!raw || !Array.isArray(raw)) return SEED_STUDENT_REVIEWS;
      const cleanReviews = raw.filter(r => 
        r && 
        r.student_id !== 'ABC6A 01' && 
        !r.student_id?.startsWith('ABC') && 
        r.verified_date !== 'Curriculum Baseline'
      );
      localStorage.setItem('pixiu_student_reviews', JSON.stringify(cleanReviews));
      return cleanReviews;
    } catch (e) {
      return SEED_STUDENT_REVIEWS;
    }
  });
  const [loading, setLoading] = useState(false);

  // Cross-tab / Cross-window Real-time Sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'pixiu_notifications') {
        try {
          const fresh = JSON.parse(e.newValue || '[]');
          if (fresh && fresh.length > 0) setNotifications(fresh);
        } catch (err) {}
      }
      if (e.key === 'pixiu_student_reviews') {
        try {
          const fresh = JSON.parse(e.newValue || '[]');
          if (fresh && fresh.length > 0) setStudentReviews(fresh);
        } catch (err) {}
      }
      if (e.key === 'pixiu_projects') {
        try {
          const fresh = JSON.parse(e.newValue || '[]');
          if (fresh) setProjects(fresh);
        } catch (err) {}
      }
      if (e.key === 'pixiu_attendance') {
        try {
          const fresh = JSON.parse(e.newValue || '[]');
          if (fresh && fresh.length > 0) setAttendance(fresh);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // --- REFRESH ALL TABLES FROM BACKEND IF AVAILABLE ---
  const refreshAll = useCallback(async () => {
    try {
      const [
        schRes, clsRes, stuRes, trRes, sesRes, attRes, 
        ldRes, cntRes, curRes, invRes, bilRes, comRes, prjRes, altRes, notifRes, revRes
      ] = await Promise.all([
        safeFetch(`${API_BASE}/schools`),
        safeFetch(`${API_BASE}/classes`),
        safeFetch(`${API_BASE}/students`),
        safeFetch(`${API_BASE}/trainers`),
        safeFetch(`${API_BASE}/sessions`),
        safeFetch(`${API_BASE}/attendance`),
        safeFetch(`${API_BASE}/leads`),
        safeFetch(`${API_BASE}/content`),
        safeFetch(`${API_BASE}/curriculum`),
        safeFetch(`${API_BASE}/inventory`),
        safeFetch(`${API_BASE}/billing`),
        safeFetch(`${API_BASE}/comms`),
        safeFetch(`${API_BASE}/projects`),
        safeFetch(`${API_BASE}/alerts`),
        safeFetch(`${API_BASE}/notifications`),
        safeFetch(`${API_BASE}/reviews`),
      ]);

      if (schRes && schRes.length > 0) setSchools(schRes);
      if (clsRes && clsRes.length > 0) setClasses(clsRes);
      if (stuRes && stuRes.length > 0) setStudents(stuRes);
      if (trRes && trRes.length > 0) setTrainers(trRes);
      if (sesRes && sesRes.length > 0) setSessions(sesRes);
      if (attRes && attRes.length > 0) setAttendance(attRes);
      if (ldRes) setLeads(ldRes);
      if (cntRes && cntRes.length > 0) setContent(cntRes);
      if (curRes && curRes.length > 0) setCurriculum(curRes);
      if (invRes && invRes.length > 0) setInventory(invRes);
      if (bilRes && bilRes.length > 0) setBilling(bilRes);
      if (comRes && comRes.length > 0) setComms(comRes);
      if (prjRes && prjRes.length > 0) setProjects(prjRes);
      if (altRes && altRes.length > 0) setAlerts(altRes);
      if (notifRes && notifRes.length > 0) setNotifications(notifRes);
      if (revRes && revRes.length > 0) setStudentReviews(revRes);
    } catch (err) {
      console.warn("Backend API unavailable, using offline seed state.");
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ==================== ACTIONS ====================

  // 1. Schools
  const addSchool = async (schoolData) => {
    try {
      const res = await fetch(`${API_URL}/schools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schoolData)
      });
      const data = await res.json();
      if (res.ok) {
        setSchools(prev => [...prev, data]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const updateSchool = async (id, updatedData) => {
    try {
      await fetch(`${API_URL}/schools/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
    } catch (e) {
      console.error(e);
    }
    setSchools(prev => {
      const updated = prev.map(s => (s.id === id || s.code === id) ? { ...s, ...updatedData } : s);
      try { localStorage.setItem('pixiu_schools', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  const deleteSchool = async (id) => {
    try {
      await fetch(`${API_URL}/schools/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    setSchools(prev => {
      const updated = prev.filter(s => s.id !== id);
      try { localStorage.setItem('pixiu_schools', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  // 2. Classes
  const addClass = async (classData) => {
    try {
      const res = await fetch(`${API_URL}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classData)
      });
      const data = await res.json();
      if (res.ok) {
        setClasses(prev => [...prev, data]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Students
  const addStudent = async (studentData) => {
    try {
      const res = await fetch(`${API_URL}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => [...prev, studentData]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateStudent = async (studentId, studentData) => {
    try {
      const res = await fetch(`${API_URL}/students/${encodeURIComponent(studentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });
      const data = await res.json();
      if (res.ok) {
        setStudents(prev => prev.map(s => s.student_id === studentId ? { ...s, ...studentData } : s));
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteStudent = async (studentId) => {
    try {
      await fetch(`${API_URL}/students/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
      setStudents(prev => prev.filter(s => s.student_id !== studentId));
    } catch (e) {
      console.error(e);
    }
  };

  // 4. Leads & Conversion
  const addLead = async (leadData) => {
    try {
      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData)
      });
      const data = await res.json();
      if (res.ok) {
        setLeads(prev => [data, ...prev]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateLeadStage = async (id, stage) => {
    try {
      await fetch(`${API_URL}/leads/${id}/stage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, stage } : l));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteLead = async (id) => {
    try {
      await fetch(`${API_URL}/leads/${id}`, { method: 'DELETE' });
      setLeads(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // 1-Click Convert Lead to Partner School (Blueprint 4.1)
  const convertLeadToSchool = async (lead) => {
    const code = lead.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'SCH';
    const schoolObj = {
      id: code,
      name: lead.name,
      code: code,
      principal: lead.contact_person || 'Principal',
      contact: lead.phone || '',
      status: 'Active',
      contract_start: new Date().toISOString().split('T')[0],
      renewal_date: '2027-03-31',
      expected_revenue: lead.expected_value || 100000
    };

    await addSchool(schoolObj);
    await updateLeadStage(lead.id, 'Closed (Won)');
    await refreshAll();
  };

  // 5. Content Hub
  const uploadContent = async (contentData) => {
    try {
      const res = await fetch(`${API_URL}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData)
      });
      const data = await res.json();
      if (res.ok) {
        setContent(prev => [data, ...prev]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteContent = async (id) => {
    try {
      await fetch(`${API_URL}/content/${id}`, { method: 'DELETE' });
      setContent(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // 6. Curriculum
  const addCurriculumPlan = async (curData) => {
    try {
      const res = await fetch(`${API_BASE}/curriculum`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(curData)
      });
      const data = await res.json();
      if (res.ok) {
        setCurriculum(prev => [...prev, data]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateCurriculumStatus = async (id, status) => {
    try {
      fetch(`${API_BASE}/curriculum/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      }).catch(() => {});
    } catch (e) {
      console.error(e);
    }
    setCurriculum(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, status } : c);
      localStorage.setItem('pixiu_curriculum', JSON.stringify(updated));
      return updated;
    });
    return { success: true };
  };

  // 7. Inventory & Hardware RMA
  const addInventoryKit = async (kitData) => {
    try {
      const res = await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kitData)
      });
      const data = await res.json();
      if (res.ok) {
        setInventory(prev => [...prev, data]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateKitStatus = async (id, status, issue_notes = '') => {
    try {
      await fetch(`${API_URL}/inventory/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, issue_notes })
      });
      setInventory(prev => prev.map(k => k.id === id ? { ...k, status, issue_notes } : k));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteKit = async (id) => {
    try {
      await fetch(`${API_URL}/inventory/${id}`, { method: 'DELETE' });
      setInventory(prev => prev.filter(k => k.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // 8. Billing & Invoices
  const createInvoice = async (invData) => {
    let savedItem = null;
    try {
      const res = await fetch(`${API_URL}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invData)
      });
      if (res.ok) {
        savedItem = await res.json();
      }
    } catch (e) {}

    if (!savedItem) {
      savedItem = {
        ...invData,
        id: invData.id || `INV-${invData.school_id || 'GEN'}-${Date.now().toString().slice(-4)}`,
        status: invData.status || 'Pending',
        is_confirmed: invData.status === 'Paid' ? 1 : 0,
        date_issued: invData.date_issued || new Date().toISOString().split('T')[0],
        invoice_date: invData.date_issued || new Date().toISOString().split('T')[0],
        due_date: invData.due_date || new Date().toISOString().split('T')[0],
        amount: Number(invData.amount) || 0
      };
    }

    setBilling(prev => {
      const updated = [savedItem, ...prev.filter(b => b.id !== savedItem.id)];
      try { localStorage.setItem('pixiu_billing', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    return { success: true, data: savedItem };
  };

  const updateInvoiceStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/billing/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {}

    const today = new Date().toISOString().split('T')[0];
    setBilling(prev => {
      const updated = prev.map(b => b.id === id ? { 
        ...b, 
        status, 
        is_confirmed: status === 'Paid' ? 1 : 0,
        paid_date: status === 'Paid' ? (b.paid_date || today) : null
      } : b);
      try { localStorage.setItem('pixiu_billing', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  const confirmPaymentReceipt = async (id, isConfirmed, paymentMethod, receiptNo) => {
    try {
      await fetch(`${API_URL}/billing/${id}/confirm-payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_confirmed: isConfirmed, payment_method: paymentMethod, receipt_no: receiptNo })
      });
    } catch (e) {}

    const today = new Date().toISOString().split('T')[0];
    setBilling(prev => {
      const updated = prev.map(b => b.id === id ? { 
        ...b, 
        is_confirmed: isConfirmed ? 1 : 0, 
        status: isConfirmed ? 'Paid' : 'Pending', 
        paid_date: isConfirmed ? (b.paid_date || today) : null, 
        receipt_no: receiptNo || b.receipt_no || `REC-${Date.now().toString().slice(-4)}`,
        payment_method: paymentMethod || b.payment_method || 'Bank Transfer (NEFT)'
      } : b);
      try { localStorage.setItem('pixiu_billing', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  const updateBillingInvoice = async (id, updatedFields) => {
    try {
      await fetch(`${API_URL}/billing/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
    } catch (e) {
      console.error(e);
    }

    setBilling(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, ...updatedFields } : b);
      try { localStorage.setItem('pixiu_billing', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  const deleteBillingInvoice = async (id) => {
    try {
      await fetch(`${API_URL}/billing/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }

    setBilling(prev => {
      const updated = prev.filter(b => b.id !== id);
      try { localStorage.setItem('pixiu_billing', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  const pushSchoolNotification = async ({ target_school_id = 'ALL', title, message, type = 'announcement', priority = 'normal' }) => {
    const newNotif = {
      id: `NOTIF-${Date.now().toString().slice(-4)}`,
      title,
      message,
      type,
      target_audience: target_school_id,
      priority,
      created_at: new Date().toISOString().split('T')[0],
      sender_name: 'Pixiu Central Administration'
    };

    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      try { localStorage.setItem('pixiu_notifications', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true, notification: newNotif };
  };

  // 9. Trainers & Sessions
  const addTrainer = async (trainerData) => {
    try {
      const res = await fetch(`${API_URL}/trainers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainerData)
      });
      const data = await res.json();
      if (res.ok) {
        setTrainers(prev => [...prev, data]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateTrainer = async (id, trainerData) => {
    try {
      const res = await fetch(`${API_URL}/trainers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainerData)
      });
      const data = await res.json();
      if (res.ok) {
        setTrainers(prev => prev.map(t => t.id === id ? { ...t, ...trainerData } : t));
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateTrainerStatus = async (id, status) => {
    try {
      const res = await fetch(`${API_URL}/trainers/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setTrainers(prev => prev.map(t => t.id === id ? { ...t, status } : t));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTrainer = async (id) => {
    try {
      await fetch(`${API_URL}/trainers/${id}`, { method: 'DELETE' });
      setTrainers(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const scheduleSession = async (sessionData) => {
    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });
      const data = await res.json();
      if (res.ok) {
        setSessions(prev => [data, ...prev]);
        await refreshAll();
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markAttendance = async (sessionId, studentId, status) => {
    const now = new Date();
    const liveDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const liveDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const liveTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const timestamp = `${liveDay}, ${liveDate} • ${liveTime}`;

    setAttendance(prev => {
      const filtered = prev.filter(a => !(a.session_id === sessionId && a.student_id === studentId));
      const updated = [...filtered, { session_id: sessionId, student_id: studentId, status, date: liveDate, day: liveDay, time: liveTime, timestamp }];
      try {
        localStorage.setItem('pixiu_attendance', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await fetch(`${API_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, student_id: studentId, status, date: liveDate, day: liveDay, time: liveTime, timestamp })
      });
    } catch (e) {}

    return { success: true };
  };

  const adminUpdateAttendance = async (sessionId, studentId, status) => {
    setAttendance(prev => {
      const updated = prev.map(a => (a.session_id === sessionId && a.student_id === studentId) ? { ...a, status } : a);
      try {
        localStorage.setItem('pixiu_attendance', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    try {
      await fetch(`${API_URL}/attendance/admin-override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, student_id: studentId, status })
      });
    } catch (e) {}
    return { success: true };
  };

  const completeSession = async (sessionId) => {
    const now = new Date();
    const liveDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const liveDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const liveTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = `${liveDay}, ${liveDate}`;

    try {
      await fetch(`${API_URL}/sessions/${sessionId}/complete`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: formattedDate, time: liveTime, day: liveDay })
      });
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, status: 'Completed', is_locked: 1, date: formattedDate, time: liveTime, day: liveDay } : s);
        try { localStorage.setItem('pixiu_sessions', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
      await refreshAll();
    } catch (e) {
      console.error(e);
      setSessions(prev => {
        const updated = prev.map(s => s.id === sessionId ? { ...s, status: 'Completed', is_locked: 1, date: formattedDate, time: liveTime, day: liveDay } : s);
        try { localStorage.setItem('pixiu_sessions', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }
  };

  const unlockSession = async (sessionId) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === sessionId ? { ...s, is_locked: 0 } : s);
      try { localStorage.setItem('pixiu_sessions', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    try {
      await fetch(`${API_URL}/sessions/${sessionId}/admin-unlock`, { method: 'PUT' });
    } catch (e) {}
    return { success: true };
  };

  const startNewSession = async (sessionData) => {
    const now = new Date();
    const liveDate = now.toISOString().split('T')[0];
    const liveTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const newSession = {
      id: `SES-${Date.now().toString().slice(-4)}`,
      school_id: sessionData.school_id || 'ZPS',
      class_id: sessionData.class_id,
      trainer_id: sessionData.trainer_id || 'TR-01',
      date: sessionData.date || liveDate,
      time: sessionData.time || liveTime,
      topic: sessionData.topic || 'Next Robotics Lab Session',
      is_locked: 0,
      notes: sessionData.notes || 'Live Hands-on Lab Session'
    };
    setSessions(prev => {
      const updated = [newSession, ...prev];
      try { localStorage.setItem('pixiu_sessions', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    try {
      await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession)
      });
    } catch (e) {}
    return newSession;
  };

  // 10. Parent Communications
  const sendCommsMessage = async (msgData) => {
    try {
      const res = await fetch(`${API_URL}/comms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData)
      });
      const data = await res.json();
      if (res.ok) {
        setComms(prev => [data, ...prev]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 11. Projects & Evidence Upload
  const uploadFile = async (file) => {
    if (!file) return { success: false, error: 'No file selected' };

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ success: true, url: reader.result, filename: file.name });
      };
      reader.onerror = (err) => {
        resolve({ success: false, error: err?.message || 'Failed to process image file' });
      };
      reader.readAsDataURL(file);
    });
  };

  const addProject = async (prjData) => {
    const newPrj = {
      id: prjData.id || `PRJ-${Date.now().toString().slice(-6)}`,
      ...prjData,
      created_at: new Date().toISOString()
    };

    setProjects(prev => {
      const updated = [newPrj, ...prev.filter(p => p.id !== newPrj.id)];
      try { localStorage.setItem('pixiu_projects', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    try {
      fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrj)
      }).catch(() => {});
    } catch (e) {}

    return { success: true, data: newPrj };
  };

  const deleteProject = async (id) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id);
      try { localStorage.setItem('pixiu_projects', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    try {
      fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' }).catch(() => {});
    } catch (e) {}
  };

  // 12. Operational Automation & Alert Resolution
  const resolveAlertAction = async (alertId, actionType, relatedId) => {
    try {
      const res = await fetch(`${API_URL}/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: actionType, related_id: relatedId })
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh all tables to reflect changes
        await refreshAll();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  // 15. Broadcast Notifications & Class Announcements
  const sendBroadcastNotification = async (notifData) => {
    let savedItem = null;
    try {
      const res = await fetch(`${API_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifData)
      });
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        savedItem = await res.json();
      }
    } catch (e) {
      console.warn("Backend unavailable, saving locally:", e);
    }

    if (!savedItem) {
      savedItem = {
        ...notifData,
        id: `NOTIF-${Date.now().toString().slice(-4)}`,
        status: 'Active',
        created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
      };
    }

    setNotifications(prev => {
      const updated = [savedItem, ...prev.filter(n => n.id !== savedItem.id)];
      try { localStorage.setItem('pixiu_notifications', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    return { success: true, data: savedItem };
  };

  const updateNotification = async (id, updatedData) => {
    try {
      await fetch(`${API_URL}/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
    } catch (e) {}

    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...updatedData, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) } : n);
      try { localStorage.setItem('pixiu_notifications', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    return { success: true };
  };

  const deleteNotification = async (id) => {
    try {
      await fetch(`${API_URL}/notifications/${id}`, { method: 'DELETE' });
    } catch (e) {}

    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      try { localStorage.setItem('pixiu_notifications', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    return { success: true };
  };

  // 16. End-of-Unit Student Reviews by Trainers
  const saveStudentReview = async (reviewData) => {
    const studentId = (reviewData.student_id || '').trim().replace(/\s+/g, ' ');
    const studentName = reviewData.student_name || '';
    const cleanStudentId = studentId.toUpperCase().replace(/\s+/g, '');
    const reviewId = reviewData.id || `REV-${Date.now().toString().slice(-4)}`;

    const fullReview = {
      ...reviewData,
      id: reviewId,
      student_id: studentId,
      student_name: studentName,
      verified_date: reviewData.verified_date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      updated_at: new Date().toISOString()
    };

    setStudentReviews(prev => {
      // Filter out existing review for the same student and unit/level
      const filtered = prev.filter(r => {
        if (!r || !r.student_id) return false;
        const rCleanId = r.student_id.toUpperCase().replace(/\s+/g, '');
        if (rCleanId !== cleanStudentId) return true;

        const isSameUnit = r.unit_code && fullReview.unit_code &&
          r.unit_code.toLowerCase().replace(/\s+/g, '') === fullReview.unit_code.toLowerCase().replace(/\s+/g, '');
        const isSameLevel = r.level && fullReview.level &&
          r.level.toLowerCase().replace(/\s+/g, '') === fullReview.level.toLowerCase().replace(/\s+/g, '');

        return !(isSameUnit || isSameLevel);
      });

      const updated = [fullReview, ...filtered];
      try {
        localStorage.setItem('pixiu_student_reviews', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('pixiu_student_reviews_updated', { detail: updated }));
      } catch (e) {}
      return updated;
    });

    try {
      await fetch(`${API_URL}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullReview)
      });
    } catch (e) {
      console.error("Backend review save error:", e);
    }

    return { success: true, data: fullReview };
  };

  const deleteStudentReview = async (id) => {
    setStudentReviews(prev => {
      const updated = prev.filter(r => r.id !== id);
      try { localStorage.setItem('pixiu_student_reviews', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });

    try {
      await fetch(`${API_URL}/reviews/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Backend review delete error:", e);
    }

    return { success: true };
  };

  // 17. Class-Specific Hardware Kit Blueprints (Admin Control)
  const updateClassKitComponent = (grade, componentId, updatedFields) => {
    setClassKits(prev => {
      const currentKit = prev[grade];
      if (!currentKit) return prev;
      const updatedComponents = currentKit.components.map(c => c.id === componentId ? { ...c, ...updatedFields } : c);
      const updated = {
        ...prev,
        [grade]: {
          ...currentKit,
          components: updatedComponents
        }
      };
      try { localStorage.setItem('pixiu_class_kits', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  const addComponentToClassKit = (grade, newComponent) => {
    setClassKits(prev => {
      const currentKit = prev[grade];
      if (!currentKit) return prev;
      const componentId = `C${grade}-${Date.now().toString().slice(-4)}`;
      const updatedComponents = [...currentKit.components, { ...newComponent, id: componentId }];
      const updated = {
        ...prev,
        [grade]: {
          ...currentKit,
          total_components: updatedComponents.length,
          components: updatedComponents
        }
      };
      try { localStorage.setItem('pixiu_class_kits', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    return { success: true };
  };

  // Utilities
  const getNextRollNumber = (schoolCode, grade, section) => {
    const cohort = students.filter(s => s.school_id === schoolCode && s.class_id === `CLS-${schoolCode}-${grade}${section || ''}`);
    if (cohort.length === 0) return '01';
    const maxRoll = Math.max(...cohort.map(s => parseInt(s.student_id.split(' ').pop()) || 0));
    return (maxRoll + 1).toString().padStart(2, '0');
  };

  const getStudentAttendance = (studentId) => {
    const studentRecords = attendance.filter(a => a.student_id === studentId);
    if (studentRecords.length === 0) return 92; // Default baseline if newly enrolled
    const present = studentRecords.filter(a => a.status === 'Present').length;
    return Math.round((present / studentRecords.length) * 100);
  };

  const value = {
    loading, refreshAll,
    schools, addSchool, updateSchool, deleteSchool,
    classes, addClass,
    students, addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance,
    trainers, addTrainer, updateTrainer, updateTrainerStatus, deleteTrainer,
    sessions, scheduleSession, completeSession, unlockSession, startNewSession,
    attendance, markAttendance, adminUpdateAttendance,
    leads, addLead, updateLeadStage, deleteLead, convertLeadToSchool,
    content, uploadContent, deleteContent,
    curriculum, addCurriculumPlan, updateCurriculumStatus,
    inventory, addInventoryKit, updateKitStatus, deleteKit,
    classKits, updateClassKitComponent, addComponentToClassKit,
    billing, createInvoice, updateInvoiceStatus, confirmPaymentReceipt, updateBillingInvoice, deleteBillingInvoice,
    comms, sendCommsMessage,
    projects, addProject, deleteProject, uploadFile,
    alerts, resolveAlertAction,
    notifications, sendBroadcastNotification, updateNotification, deleteNotification, pushSchoolNotification,
    studentReviews, saveStudentReview, deleteStudentReview
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
