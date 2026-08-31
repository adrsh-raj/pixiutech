import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  SEED_SCHOOLS, SEED_CLASSES, SEED_STUDENTS, SEED_TRAINERS, 
  SEED_BILLING, SEED_SESSIONS, SEED_ATTENDANCE, SEED_INVENTORY, 
  SEED_ALERTS, SEED_CURRICULUM, SEED_CONTENT 
} from '../data/seedData';

const DataContext = createContext();

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_URL || '/api');

export function DataProvider({ children }) {
  const [schools, setSchools] = useState(() => JSON.parse(localStorage.getItem('pixiu_schools') || 'null') || SEED_SCHOOLS);
  const [classes, setClasses] = useState(() => JSON.parse(localStorage.getItem('pixiu_classes') || 'null') || SEED_CLASSES);
  const [students, setStudents] = useState(() => JSON.parse(localStorage.getItem('pixiu_students') || 'null') || SEED_STUDENTS);
  const [trainers, setTrainers] = useState(() => JSON.parse(localStorage.getItem('pixiu_trainers') || 'null') || SEED_TRAINERS);
  const [sessions, setSessions] = useState(() => JSON.parse(localStorage.getItem('pixiu_sessions') || 'null') || SEED_SESSIONS);
  const [attendance, setAttendance] = useState(() => JSON.parse(localStorage.getItem('pixiu_attendance') || 'null') || SEED_ATTENDANCE);
  const [leads, setLeads] = useState(() => JSON.parse(localStorage.getItem('pixiu_leads') || '[]'));
  const [content, setContent] = useState(() => JSON.parse(localStorage.getItem('pixiu_content') || 'null') || SEED_CONTENT);
  const [curriculum, setCurriculum] = useState(() => JSON.parse(localStorage.getItem('pixiu_curriculum') || 'null') || SEED_CURRICULUM);
  const [inventory, setInventory] = useState(() => JSON.parse(localStorage.getItem('pixiu_inventory') || 'null') || SEED_INVENTORY);
  const [billing, setBilling] = useState(() => JSON.parse(localStorage.getItem('pixiu_billing') || 'null') || SEED_BILLING);
  const [comms, setComms] = useState(() => JSON.parse(localStorage.getItem('pixiu_comms') || '[]'));
  const [projects, setProjects] = useState(() => JSON.parse(localStorage.getItem('pixiu_projects') || '[]'));
  const [alerts, setAlerts] = useState(() => JSON.parse(localStorage.getItem('pixiu_alerts') || 'null') || SEED_ALERTS);
  const [loading, setLoading] = useState(false);

  // --- REFRESH ALL TABLES FROM BACKEND IF AVAILABLE ---
  const refreshAll = useCallback(async () => {
    try {
      const [
        schRes, clsRes, stuRes, trRes, sesRes, attRes, 
        ldRes, cntRes, curRes, invRes, bilRes, comRes, prjRes, altRes
      ] = await Promise.all([
        fetch(`${API_BASE}/schools`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/classes`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/students`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/trainers`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/sessions`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/attendance`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/leads`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/content`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/curriculum`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/inventory`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/billing`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/comms`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/projects`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/alerts`).then(r => r.ok ? r.json() : null).catch(() => null),
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
      if (comRes) setComms(comRes);
      if (prjRes) setProjects(prjRes);
      if (altRes && altRes.length > 0) setAlerts(altRes);
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

  const deleteSchool = async (id) => {
    try {
      await fetch(`${API_URL}/schools/${id}`, { method: 'DELETE' });
      setSchools(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      console.error(e);
    }
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
    try {
      const res = await fetch(`${API_URL}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invData)
      });
      const data = await res.json();
      if (res.ok) {
        setBilling(prev => [data, ...prev]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const updateInvoiceStatus = async (id, status) => {
    try {
      await fetch(`${API_URL}/billing/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const today = new Date().toISOString().split('T')[0];
      setBilling(prev => prev.map(b => b.id === id ? { 
        ...b, 
        status, 
        is_confirmed: status === 'Paid' ? 1 : 0,
        paid_date: status === 'Paid' ? today : null
      } : b));
    } catch (e) {
      console.error(e);
    }
  };

  const confirmPaymentReceipt = async (id, isConfirmed, paymentMethod, receiptNo) => {
    try {
      const res = await fetch(`${API_URL}/billing/${id}/confirm-payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_confirmed: isConfirmed, payment_method: paymentMethod, receipt_no: receiptNo })
      });
      const data = await res.json();
      if (res.ok) {
        setBilling(prev => prev.map(b => b.id === id ? { 
          ...b, 
          is_confirmed: data.is_confirmed, 
          status: data.status, 
          paid_date: data.paid_date, 
          receipt_no: data.receipt_no,
          payment_method: paymentMethod || b.payment_method
        } : b));
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
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

    try {
      const res = await fetch(`${API_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, student_id: studentId, status, date: liveDate, day: liveDay, time: liveTime, timestamp })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error };
      }
      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.session_id === sessionId && a.student_id === studentId));
        return [...filtered, { session_id: sessionId, student_id: studentId, status, date: liveDate, day: liveDay, time: liveTime, timestamp }];
      });
      return { success: true };
    } catch (e) {
      console.error(e);
      setAttendance(prev => {
        const filtered = prev.filter(a => !(a.session_id === sessionId && a.student_id === studentId));
        return [...filtered, { session_id: sessionId, student_id: studentId, status, date: liveDate, day: liveDay, time: liveTime, timestamp }];
      });
      return { success: true };
    }
  };

  const adminUpdateAttendance = async (sessionId, studentId, status) => {
    try {
      const res = await fetch(`${API_URL}/attendance/admin-override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, student_id: studentId, status })
      });
      if (res.ok) {
        setAttendance(prev => prev.map(a => (a.session_id === sessionId && a.student_id === studentId) ? { ...a, status } : a));
        return { success: true };
      }
    } catch (e) {
      console.error(e);
    }
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
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'Completed', is_locked: 1, date: formattedDate, time: liveTime, day: liveDay } : s));
      await refreshAll();
    } catch (e) {
      console.error(e);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'Completed', is_locked: 1, date: formattedDate, time: liveTime, day: liveDay } : s));
    }
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
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        return { success: true, url: data.url, filename: data.filename };
      }
      return { success: false, error: data.error };
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    }
  };

  const addProject = async (prjData) => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prjData)
      });
      const data = await res.json();
      if (res.ok) {
        setProjects(prev => [data, ...prev]);
        return { success: true, data };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteProject = async (id) => {
    try {
      await fetch(`${API_URL}/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    }
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
    schools, addSchool, deleteSchool,
    classes, addClass,
    students, addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance,
    trainers, addTrainer, updateTrainer, updateTrainerStatus, deleteTrainer,
    sessions, scheduleSession, completeSession,
    attendance, markAttendance, adminUpdateAttendance,
    leads, addLead, updateLeadStage, deleteLead, convertLeadToSchool,
    content, uploadContent, deleteContent,
    curriculum, addCurriculumPlan, updateCurriculumStatus,
    inventory, addInventoryKit, updateKitStatus, deleteKit,
    billing, createInvoice, updateInvoiceStatus, confirmPaymentReceipt,
    comms, sendCommsMessage,
    projects, addProject, deleteProject, uploadFile,
    alerts, resolveAlertAction
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
