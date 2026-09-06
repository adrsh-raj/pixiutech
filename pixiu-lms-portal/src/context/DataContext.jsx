import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';

const DataContext = createContext(null);

const getToken = () => localStorage.getItem('pixiu_auth_token');

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const method = String(options.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  const delays = retryable ? [0, 1500, 3500] : [0];
  let lastError;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]));

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        cache: retryable ? 'no-store' : options.cache
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};

      if (response.ok) return payload;

      const error = new Error(payload.error || `Request failed (${response.status})`);
      if (!retryable || ![502, 503, 504].includes(response.status) || attempt === delays.length - 1) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      lastError = error;
      if (!retryable || attempt === delays.length - 1) throw error;
    }
  }

  throw lastError || new Error('Request failed.');
}

const collection = (payload) => Array.isArray(payload) ? payload : (payload?.data || []);

export function DataProvider({ children }) {
  // PostgreSQL/API is the only source of truth. LocalStorage is intentionally
  // limited to the authentication token; application records are not cached.
  const [schools, setSchools] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leads, setLeads] = useState([]);
  const [content, setContent] = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [classKits, setClassKits] = useState({});
  const [billing, setBilling] = useState([]);
  const [comms, setComms] = useState([]);
  const [projects, setProjects] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [studentReviews, setStudentReviews] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!getToken()) return { success: false, error: 'Authentication required' };

    setLoading(true);
    const endpoints = [
      ['/schools', setSchools],
      ['/classes', setClasses],
      ['/students', setStudents],
      ['/trainers', setTrainers],
      ['/sessions', setSessions],
      ['/attendance', setAttendance],
      ['/leads', setLeads],
      ['/content', setContent],
      ['/curriculum', setCurriculum],
      ['/inventory', setInventory],
      ['/billing', setBilling],
      ['/comms', setComms],
      ['/projects', setProjects],
      ['/alerts', setAlerts],
      ['/notifications', setNotifications],
      ['/reviews', setStudentReviews],
      ['/quizzes', setQuizzes],
      ['/quiz-submissions', setQuizSubmissions]
    ];

    try {
      const results = await Promise.allSettled(endpoints.map(([path]) => apiRequest(path)));
      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const [, setter] = endpoints[index];
        setter(collection(result.value));
      });

      return {
        success: results.some(result => result.status === 'fulfilled'),
        failed: results.filter(result => result.status === 'rejected').length
      };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const onAuthChange = () => refreshAll();
    window.addEventListener('pixiu_auth_state_changed', onAuthChange);
    return () => window.removeEventListener('pixiu_auth_state_changed', onAuthChange);
  }, [refreshAll]);

  const commitCollectionChange = (setter, value) => setter(value);

  const addSchool = async (schoolData) => {
    try {
      const data = await apiRequest('/schools', { method: 'POST', body: JSON.stringify(schoolData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateSchool = async (id, updatedData) => {
    try {
      await apiRequest(`/schools/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(updatedData) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteSchool = async (id) => {
    try {
      await apiRequest(`/schools/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const addClass = async (classData) => {
    try {
      const data = await apiRequest('/classes', { method: 'POST', body: JSON.stringify(classData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const addStudent = async (studentData) => {
    try {
      const data = await apiRequest('/students', { method: 'POST', body: JSON.stringify(studentData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateStudent = async (studentId, studentData) => {
    try {
      const data = await apiRequest(`/students/${encodeURIComponent(studentId)}`, { method: 'PUT', body: JSON.stringify(studentData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteStudent = async (studentId) => {
    try {
      await apiRequest(`/students/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const getNextRollNumber = (schoolCode, grade, section) => {
    const cohort = students.filter(s => s.school_id === schoolCode && s.class_id === `CLS-${schoolCode}-${grade}${section || ''}`);
    if (!cohort.length) return '01';
    const maxRoll = Math.max(...cohort.map(s => parseInt(String(s.student_id || '').split(' ').pop(), 10) || 0));
    return String(maxRoll + 1).padStart(2, '0');
  };

  const getStudentAttendance = (studentId) => {
    if (!studentId) return 0;
    const clean = String(studentId).toUpperCase().replace(/\s+/g, '');
    const rows = attendance.filter(a => String(a.student_id || '').toUpperCase().replace(/\s+/g, '') === clean);
    if (!rows.length) return 0;
    return Math.round((rows.filter(a => a.status === 'Present').length / rows.length) * 100);
  };

  const getStudentAttendanceRecords = (studentId) => {
    if (!studentId) return [];
    const clean = String(studentId).toUpperCase().replace(/\s+/g, '');
    return attendance.filter(a => String(a.student_id || '').toUpperCase().replace(/\s+/g, '') === clean);
  };

  const addLead = async (leadData) => {
    try {
      const data = await apiRequest('/leads', { method: 'POST', body: JSON.stringify(leadData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateLeadStage = async (id, stage) => {
    try {
      await apiRequest(`/leads/${encodeURIComponent(id)}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteLead = async (id) => {
    try {
      await apiRequest(`/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const convertLeadToSchool = async (lead) => {
    const code = lead.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'SCH';
    const schoolObj = {
      id: code,
      name: lead.name,
      code,
      principal: lead.contact_person || 'Principal',
      contact: lead.phone || '',
      status: 'Active',
      contract_start: new Date().toISOString().split('T')[0],
      renewal_date: '2027-03-31',
      expected_revenue: lead.expected_value || 100000
    };
    const schoolResult = await addSchool(schoolObj);
    if (!schoolResult.success) return schoolResult;
    const stageResult = await updateLeadStage(lead.id, 'Closed (Won)');
    return stageResult.success ? { success: true } : stageResult;
  };

  const uploadContent = async (contentData) => {
    try {
      const data = await apiRequest('/content', { method: 'POST', body: JSON.stringify(contentData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteContent = async (id) => {
    try {
      await apiRequest(`/content/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const addCurriculumPlan = async (curData) => {
    try {
      const data = await apiRequest('/curriculum', { method: 'POST', body: JSON.stringify(curData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateCurriculumStatus = async (id, status) => {
    try {
      await apiRequest(`/curriculum/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const addInventoryKit = async (kitData) => {
    try {
      const data = await apiRequest('/inventory', { method: 'POST', body: JSON.stringify(kitData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateKitStatus = async (id, status, issue_notes = '') => {
    try {
      await apiRequest(`/inventory/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status, issue_notes }) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteKit = async (id) => {
    try {
      await apiRequest(`/inventory/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const createInvoice = async (invData) => {
    try {
      const data = await apiRequest('/billing', { method: 'POST', body: JSON.stringify(invData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateInvoiceStatus = async (id, status) => {
    try {
      await apiRequest(`/billing/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const confirmPaymentReceipt = async (id, isConfirmed, paymentMethod, receiptNo) => {
    try {
      await apiRequest(`/billing/${encodeURIComponent(id)}/confirm-payment`, {
        method: 'PUT',
        body: JSON.stringify({ is_confirmed: isConfirmed, payment_method: paymentMethod, receipt_no: receiptNo })
      });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateBillingInvoice = async (id, updatedFields) => {
    try {
      await apiRequest(`/billing/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(updatedFields) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteBillingInvoice = async (id) => {
    try {
      await apiRequest(`/billing/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const sendCommsMessage = async (msgData) => {
    try {
      const data = await apiRequest('/comms', { method: 'POST', body: JSON.stringify(msgData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const uploadFile = async (file) => {
    if (!file) return { success: false, error: 'No file selected' };
    const form = new FormData();
    form.append('file', file);
    try {
      const data = await apiRequest('/upload', { method: 'POST', body: form });
      return { success: true, url: data.url, filename: data.filename };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const addProject = async (projectData) => {
    try {
      const data = await apiRequest('/projects', { method: 'POST', body: JSON.stringify(projectData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteProject = async (id) => {
    try {
      await apiRequest(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const resolveAlertAction = async (alertId, actionType, relatedId) => {
    try {
      const data = await apiRequest(`/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body: JSON.stringify({ action_type: actionType, related_id: relatedId }) });
      await refreshAll();
      return { success: true, message: data.message };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const sendBroadcastNotification = async (notifData) => {
    try {
      const data = await apiRequest('/notifications', { method: 'POST', body: JSON.stringify(notifData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateNotification = async (id, updatedData) => {
    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(updatedData) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteNotification = async (id) => {
    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const pushSchoolNotification = async ({ target_school_id = 'ALL', title, message, type = 'announcement', priority = 'normal' }) => (
    sendBroadcastNotification({
      target_type: 'School',
      target_school_id,
      title,
      message,
      type,
      severity: priority === 'high' ? 'urgent' : 'info'
    })
  );

  const addTrainer = async (trainerData) => {
    try {
      const data = await apiRequest('/trainers', { method: 'POST', body: JSON.stringify(trainerData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateTrainer = async (id, trainerData) => {
    try {
      const data = await apiRequest(`/trainers/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(trainerData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateTrainerStatus = async (id, status) => {
    try {
      await apiRequest(`/trainers/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteTrainer = async (id) => {
    try {
      await apiRequest(`/trainers/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const scheduleSession = async (sessionData) => {
    try {
      const data = await apiRequest('/sessions', { method: 'POST', body: JSON.stringify(sessionData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const completeSession = async (sessionId, meta = {}) => {
    try {
      await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/complete`, { method: 'POST', body: JSON.stringify(meta) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const unlockSession = async (sessionId) => {
    try {
      await apiRequest(`/sessions/${encodeURIComponent(sessionId)}/unlock`, { method: 'PUT' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const startNewSession = async (sessionData) => scheduleSession(sessionData);

  const markAttendance = async (sessionId, studentId, status) => {
    try {
      const now = new Date();
      const payload = {
        session_id: sessionId,
        student_id: studentId,
        status,
        date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        day: now.toLocaleDateString('en-US', { weekday: 'long' }),
        time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString()
      };
      await apiRequest('/attendance', { method: 'POST', body: JSON.stringify(payload) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const adminUpdateAttendance = async (sessionId, studentId, status) => {
    try {
      await apiRequest('/attendance/admin-override', { method: 'PUT', body: JSON.stringify({ session_id: sessionId, student_id: studentId, status }) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const saveStudentReview = async (reviewData) => {
    try {
      const data = await apiRequest('/reviews', { method: 'POST', body: JSON.stringify(reviewData) });
      await refreshAll();
      return { success: true, data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteStudentReview = async (id) => {
    try {
      await apiRequest(`/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateClassKitComponent = (grade, componentId, updatedFields) => {
    const current = classKits?.[grade];
    if (!current) return { success: false, error: 'Class kit is not loaded from the server yet.' };
    const next = {
      ...classKits,
      [grade]: {
        ...current,
        components: (current.components || []).map(component => component.id === componentId ? { ...component, ...updatedFields } : component)
      }
    };
    commitCollectionChange(setClassKits, next);
    return { success: true };
  };

  const addComponentToClassKit = (grade, newComponent) => {
    const current = classKits?.[grade];
    if (!current) return { success: false, error: 'Class kit is not loaded from the server yet.' };
    const nextComponents = [...(current.components || []), { ...newComponent, id: newComponent.id || `C${grade}-${Date.now()}` }];
    const next = { ...classKits, [grade]: { ...current, total_components: nextComponents.length, components: nextComponents } };
    commitCollectionChange(setClassKits, next);
    return { success: true };
  };

  const createQuiz = async (quizData) => {
    try {
      const data = await apiRequest('/quizzes', { method: 'POST', body: JSON.stringify(quizData) });
      await refreshAll();
      return { success: true, quiz: data?.quiz || data };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const updateQuiz = async (id, quizData) => {
    try {
      await apiRequest(`/quizzes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(quizData) });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteQuiz = async (id) => {
    try {
      await apiRequest(`/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const submitQuizAttempt = async (attemptData) => {
    try {
      const data = await apiRequest('/quiz-submissions', { method: 'POST', body: JSON.stringify(attemptData) });
      await refreshAll();
      return data;
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  const allowQuizReattempt = async (submissionId) => {
    try {
      await apiRequest(`/quiz-submissions/${encodeURIComponent(submissionId)}/reattempt`, { method: 'PUT' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const deleteQuizSubmission = async (submissionId) => {
    try {
      await apiRequest(`/quiz-submissions/${encodeURIComponent(submissionId)}`, { method: 'DELETE' });
      await refreshAll();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  };

  const value = useMemo(() => ({
    loading, refreshAll,
    schools, addSchool, updateSchool, deleteSchool,
    classes, addClass,
    students, addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance, getStudentAttendanceRecords,
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
    studentReviews, saveStudentReview, deleteStudentReview,
    quizzes, createQuiz, updateQuiz, deleteQuiz,
    quizSubmissions, submitQuizAttempt, allowQuizReattempt, deleteQuizSubmission
  }), [
    loading, schools, classes, students, trainers, sessions, attendance, leads, content, curriculum,
    inventory, classKits, billing, comms, projects, alerts, notifications, studentReviews, quizzes, quizSubmissions,
    refreshAll
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside DataProvider');
  return context;
};
