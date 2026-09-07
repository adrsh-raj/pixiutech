import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';
import { apiFetch } from './AuthContext';
import { CLASS_KITS } from '../data/classKits';

const DataContext = createContext(null);
const getToken = () => localStorage.getItem('pixiu_auth_token');

function generateStudentPassword(studentId) {
  const normalized = String(studentId || '').trim().replace(/\s+/g, ' ');
  const match = normalized.match(/^([A-Za-z]+)(\d+)([A-Za-z]+)?\s+(\d+)$/);
  if (!match) return '';
  const [, schoolCodeRaw, grade, sectionRaw = '', rollRaw] = match;
  const schoolCode = schoolCodeRaw.toUpperCase();
  const schoolCodeLower = schoolCodeRaw.toLowerCase();
  const section = sectionRaw.toUpperCase();
  const roll = String(parseInt(rollRaw, 10));
  if (!Number.isFinite(Number(roll)) || Number(roll) <= 0) return '';
  return `${schoolCode}${schoolCodeLower}${grade}${section}${roll}@hata`;
}

function splitAssignments(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  const raw = String(value || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(item => String(item).trim()).filter(Boolean);
  } catch {}
  return raw.split(',').map(item => item.trim()).filter(Boolean);
}

function enrichSchools(schoolRows, trainerRows) {
  return schoolRows.map(school => {
    const schoolKeys = [school.id, school.code, school.school_id].filter(Boolean).map(value => String(value).trim());
    const assignedTrainer = trainerRows.find(trainer => splitAssignments(trainer.assigned_schools).some(item => schoolKeys.includes(item)));
    return {
      ...school,
      trainer_id: assignedTrainer?.id || school.trainer_id || '',
      lead_trainer: assignedTrainer?.name || school.lead_trainer || 'Not Assigned'
    };
  });
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const method = String(options.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  const delays = retryable ? [0, 1500, 3500] : [0];
  let lastError;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    try {
      const response = await apiFetch(path, { ...options, headers, cache: retryable ? 'no-store' : options.cache });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (response.ok) return payload;
      const error = new Error(payload.error || payload.detail || `Request failed (${response.status})`);
      if (!retryable || ![502, 503, 504].includes(response.status) || attempt === delays.length - 1) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (!retryable || attempt === delays.length - 1) throw error;
    }
  }
  throw lastError || new Error('Request failed.');
}

const collection = payload => Array.isArray(payload) ? payload : (payload?.data || []);
const cloneClassKits = () => JSON.parse(JSON.stringify(CLASS_KITS));

export function DataProvider({ children }) {
  const [schools, setSchools] = useState([]); const [classes, setClasses] = useState([]); const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]); const [sessions, setSessions] = useState([]); const [attendance, setAttendance] = useState([]);
  const [leads, setLeads] = useState([]); const [content, setContent] = useState([]); const [curriculum, setCurriculum] = useState([]);
  const [inventory, setInventory] = useState([]); const [classKits, setClassKits] = useState(() => cloneClassKits()); const [billing, setBilling] = useState([]);
  const [comms, setComms] = useState([]); const [projects, setProjects] = useState([]); const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]); const [studentReviews, setStudentReviews] = useState([]); const [quizzes, setQuizzes] = useState([]);
  const [quizSubmissions, setQuizSubmissions] = useState([]); const [loading, setLoading] = useState(false);

  const refreshAll = useCallback(async () => {
    if (!getToken()) return { success: false, error: 'Authentication required' };
    setLoading(true);
    const endpoints = [
      ['/schools', setSchools], ['/classes', setClasses], ['/students', setStudents], ['/trainers', setTrainers], ['/sessions', setSessions],
      ['/attendance', setAttendance], ['/leads', setLeads], ['/content', setContent], ['/curriculum', setCurriculum], ['/inventory', setInventory],
      ['/billing', setBilling], ['/comms', setComms], ['/projects', setProjects], ['/notifications', setNotifications],
      ['/reviews', setStudentReviews], ['/quizzes', setQuizzes], ['/quiz-submissions', setQuizSubmissions]
    ];
    try {
      const results = await Promise.allSettled(endpoints.map(([path]) => apiRequest(path)));
      const schoolResult = results[0];
      const trainerResult = results[3];
      const schoolRows = schoolResult?.status === 'fulfilled' ? collection(schoolResult.value) : [];
      const trainerRows = trainerResult?.status === 'fulfilled' ? collection(trainerResult.value) : [];
      if (schoolResult?.status === 'fulfilled') setSchools(enrichSchools(schoolRows, trainerRows));
      results.forEach((result, index) => { if (result.status === 'fulfilled' && index !== 0 && index !== 3) endpoints[index][1](collection(result.value)); });
      if (trainerResult?.status === 'fulfilled') setTrainers(trainerRows);
      return { success: results.some(result => result.status === 'fulfilled'), failed: results.filter(result => result.status === 'rejected').length };
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    refreshAll();
    const onAuthChange = () => { setClassKits(cloneClassKits()); refreshAll(); };
    window.addEventListener('pixiu_auth_state_changed', onAuthChange);
    return () => window.removeEventListener('pixiu_auth_state_changed', onAuthChange);
  }, [refreshAll]);

  const save = async (path, method, body) => {
    try { const data = await apiRequest(path, { method, body: JSON.stringify(body) }); await refreshAll(); return { success: true, data }; }
    catch (e) { return { success: false, error: e.message }; }
  };
  const remove = async path => {
    try { await apiRequest(path, { method: 'DELETE' }); await refreshAll(); return { success: true }; }
    catch (e) { return { success: false, error: e.message }; }
  };

  const syncSchoolTrainer = async (schoolId, trainerId) => {
    try { return await apiRequest(`/schools/${encodeURIComponent(schoolId)}/assign-trainer`, { method: 'POST', body: JSON.stringify({ trainer_id: trainerId || '' }) }); }
    catch (e) { return { success: false, error: e.message }; }
  };
  const addSchool = async data => {
    const result = await save('/schools', 'POST', data);
    if (!result.success) return result;
    const persistedSchoolId = result.data?.id || result.data?.school_id || data?.id || data?.code;
    const assignment = await syncSchoolTrainer(persistedSchoolId, data?.trainer_id);
    if (!assignment.success) return { success: false, error: `School created, but trainer assignment failed: ${assignment.error}` };
    await refreshAll(); return result;
  };
  const updateSchool = async (id, data) => {
    const result = await save(`/schools/${encodeURIComponent(id)}`, 'PUT', data);
    if (!result.success) return result;
    const assignment = await syncSchoolTrainer(id, data?.trainer_id);
    if (!assignment.success) return { success: false, error: `School updated, but trainer assignment failed: ${assignment.error}` };
    await refreshAll(); return result;
  };
  const deleteSchool = id => remove(`/schools/${encodeURIComponent(id)}`);
  const addClass = data => save('/classes', 'POST', data);
  const addStudent = async data => {
    const generatedPassword = generateStudentPassword(data?.student_id);
    if (!generatedPassword) return { success: false, error: 'Student ID must follow the format SCHOOLGRADSECTION roll, e.g. XYZ8A 03.' };
    const result = await save('/students', 'POST', { ...data, password: generatedPassword });
    if (result.success) return { ...result, data: { ...(result.data || {}), temporary_password: result.data?.initial_password || generatedPassword } };
    return result;
  };
  const updateStudent = (id, data) => save(`/students/${encodeURIComponent(id)}`, 'PUT', data); const deleteStudent = id => remove(`/students/${encodeURIComponent(id)}`);
  const getNextRollNumber = (schoolCode, grade, section) => { const cohort = students.filter(s => s.school_id === schoolCode && s.class_id === `CLS-${schoolCode}-${grade}${section || ''}`); if (!cohort.length) return '01'; const maxRoll = Math.max(...cohort.map(s => parseInt(String(s.student_id || '').split(' ').pop(), 10) || 0)); return String(maxRoll + 1).padStart(2, '0'); };
  const getStudentAttendance = studentId => { if (!studentId) return 0; const clean = String(studentId).toUpperCase().replace(/\s+/g, ''); const rows = attendance.filter(a => String(a.student_id || '').toUpperCase().replace(/\s+/g, '') === clean); return rows.length ? Math.round((rows.filter(a => a.status === 'Present').length / rows.length) * 100) : 0; };
  const getStudentAttendanceRecords = studentId => !studentId ? [] : attendance.filter(a => String(a.student_id || '').toUpperCase().replace(/\s+/g, '') === String(studentId).toUpperCase().replace(/\s+/g, ''));
  const addLead = data => save('/leads', 'POST', data); const updateLeadStage = (id, stage) => save(`/leads/${encodeURIComponent(id)}/stage`, 'PUT', { stage }); const deleteLead = id => remove(`/leads/${encodeURIComponent(id)}`);
  const convertLeadToSchool = async lead => { const code = lead.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'SCH'; const result = await addSchool({ id: code, name: lead.name, code, principal: lead.contact_person || 'Principal', contact: lead.phone || '', status: 'Active', contract_start: new Date().toISOString().split('T')[0], renewal_date: '2027-03-31', expected_revenue: lead.expected_value || 100000 }); if (!result.success) return result; return updateLeadStage(lead.id, 'Closed (Won)'); };
  const uploadContent = data => save('/content', 'POST', data); const deleteContent = id => remove(`/content/${encodeURIComponent(id)}`); const addCurriculumPlan = data => save('/curriculum', 'POST', data); const updateCurriculumStatus = (id, status) => save(`/curriculum/${encodeURIComponent(id)}/status`, 'PUT', { status });
  const addInventoryKit = data => save('/inventory', 'POST', data); const updateKitStatus = (id, status, issue_notes = '') => save(`/inventory/${encodeURIComponent(id)}/status`, 'PUT', { status, issue_notes }); const deleteKit = id => remove(`/inventory/${encodeURIComponent(id)}`);
  const createInvoice = data => save('/billing', 'POST', data); const updateInvoiceStatus = (id, status) => save(`/billing/${encodeURIComponent(id)}/status`, 'PUT', { status }); const confirmPaymentReceipt = (id, isConfirmed, paymentMethod, receiptNo) => save(`/billing/${encodeURIComponent(id)}/confirm-payment`, 'PUT', { is_confirmed: isConfirmed, payment_method: paymentMethod, receipt_no: receiptNo }); const updateBillingInvoice = (id, data) => save(`/billing/${encodeURIComponent(id)}`, 'PUT', data); const deleteBillingInvoice = id => remove(`/billing/${encodeURIComponent(id)}`);
  const sendCommsMessage = data => save('/comms', 'POST', data);
  const uploadFile = async file => { if (!file) return { success: false, error: 'No file selected' }; const form = new FormData(); form.append('file', file); try { const data = await apiRequest('/upload', { method: 'POST', body: form }); return { success: true, url: data.url, filename: data.filename }; } catch (e) { return { success: false, error: e.message }; } };
  const addProject = data => save('/projects', 'POST', data); const deleteProject = id => remove(`/projects/${encodeURIComponent(id)}`);
  const sendBroadcastNotification = data => save('/notifications', 'POST', data); const updateNotification = (id, data) => save(`/notifications/${encodeURIComponent(id)}`, 'PUT', data); const deleteNotification = id => remove(`/notifications/${encodeURIComponent(id)}`);
  const pushSchoolNotification = async ({ target_school_id = 'ALL', title, message, type = 'announcement', priority = 'normal' }) => sendBroadcastNotification({ target_type: 'School', target_school_id, title, message, type, severity: priority === 'high' ? 'urgent' : 'info' });
  const addTrainer = data => save('/trainers', 'POST', data); const updateTrainer = (id, data) => save(`/trainers/${encodeURIComponent(id)}`, 'PUT', data); const updateTrainerStatus = (id, status) => save(`/trainers/${encodeURIComponent(id)}/status`, 'PUT', { status }); const deleteTrainer = id => remove(`/trainers/${encodeURIComponent(id)}`);
  const scheduleSession = data => save('/sessions', 'POST', data); const completeSession = (id, meta = {}) => save(`/sessions/${encodeURIComponent(id)}/complete`, 'POST', meta); const unlockSession = id => save(`/sessions/${encodeURIComponent(id)}/unlock`, 'PUT', {}); const startNewSession = data => scheduleSession(data);
  const markAttendance = (sessionId, studentId, status) => { const now = new Date(); return save('/attendance', 'POST', { session_id: sessionId, student_id: studentId, status, date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), day: now.toLocaleDateString('en-US', { weekday: 'long' }), time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), timestamp: now.toISOString() }); };
  const adminUpdateAttendance = (sessionId, studentId, status) => save('/attendance/admin-override', 'PUT', { session_id: sessionId, student_id: studentId, status }); const saveStudentReview = data => save('/reviews', 'POST', data); const deleteStudentReview = id => remove(`/reviews/${encodeURIComponent(id)}`);
  const updateClassKitComponent = (grade, componentId, updatedFields) => { const current = classKits?.[grade]; if (!current) return { success: false, error: 'Class kit blueprint not available.' }; setClassKits(prev => ({ ...prev, [grade]: { ...prev[grade], components: (prev[grade].components || []).map(c => c.id === componentId ? { ...c, ...updatedFields } : c) } })); return { success: true }; };
  const addComponentToClassKit = (grade, newComponent) => { const current = classKits?.[grade]; if (!current) return { success: false, error: 'Class kit blueprint not available.' }; setClassKits(prev => ({ ...prev, [grade]: { ...prev[grade], total_components: (prev[grade].components || []).length + 1, components: [...(prev[grade].components || []), { ...newComponent, id: newComponent.id || `C${grade}-${Date.now()}` }] } })); return { success: true }; };
  const createQuiz = async data => { const result = await save('/quizzes', 'POST', data); return result.success ? { success: true, quiz: result.data?.quiz || result.data } : result; }; const updateQuiz = (id, data) => save(`/quizzes/${encodeURIComponent(id)}`, 'PUT', data); const deleteQuiz = id => remove(`/quizzes/${encodeURIComponent(id)}`); const submitQuizAttempt = data => save('/quiz-submissions', 'POST', data); const allowQuizReattempt = id => save(`/quiz-submissions/${encodeURIComponent(id)}/reattempt`, 'PUT', {}); const deleteQuizSubmission = id => remove(`/quiz-submissions/${encodeURIComponent(id)}`);

  const value = useMemo(() => ({ loading, refreshAll, schools, addSchool, updateSchool, deleteSchool, classes, addClass, students, addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance, getStudentAttendanceRecords, trainers, addTrainer, updateTrainer, updateTrainerStatus, deleteTrainer, sessions, scheduleSession, completeSession, unlockSession, startNewSession, attendance, markAttendance, adminUpdateAttendance, leads, addLead, updateLeadStage, deleteLead, convertLeadToSchool, content, uploadContent, deleteContent, curriculum, addCurriculumPlan, updateCurriculumStatus, inventory, addInventoryKit, updateKitStatus, deleteKit, classKits, updateClassKitComponent, addComponentToClassKit, billing, createInvoice, updateInvoiceStatus, confirmPaymentReceipt, updateBillingInvoice, deleteBillingInvoice, comms, sendCommsMessage, projects, addProject, deleteProject, uploadFile, notifications, sendBroadcastNotification, updateNotification, deleteNotification, pushSchoolNotification, studentReviews, saveStudentReview, deleteStudentReview, quizzes, createQuiz, updateQuiz, deleteQuiz, quizSubmissions, submitQuizAttempt, allowQuizReattempt, deleteQuizSubmission }), [loading, refreshAll, schools, classes, students, trainers, sessions, attendance, leads, content, curriculum, inventory, classKits, billing, comms, projects, notifications, studentReviews, quizzes, quizSubmissions]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export const useData = () => { const context = useContext(DataContext); if (!context) throw new Error('useData must be used inside DataProvider'); return context; };