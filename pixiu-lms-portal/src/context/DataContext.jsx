import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiFetch } from './AuthContext';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);
const collection = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.data) ? payload.data : [];
const text = value => String(value ?? '').trim();
const lower = value => text(value).toLowerCase();
const normalizeDateOnly = value => {
  const raw = text(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return raw;
};

function formatApiError(payload, status) {
  if (typeof payload === 'string' && payload.trim()) return payload.trim();
  if (!payload || typeof payload !== 'object') return `Request failed (${status}).`;
  const headline = payload.detail || payload.error || payload.message;
  const fieldErrors = Object.entries(payload)
    .filter(([key, value]) => !['detail', 'error', 'message'].includes(key) && value != null)
    .flatMap(([key, value]) => {
      const values = Array.isArray(value) ? value : [value];
      return values.map(item => `${key}: ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`);
    });
  if (headline && fieldErrors.length) return `${headline} ${fieldErrors.join(' ')}`;
  if (headline) return String(headline);
  if (fieldErrors.length) return fieldErrors.join(' ');
  return `Request failed (${status}).`;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const method = String(options.method || 'GET').toUpperCase();
  const retryable = method === 'GET' || method === 'HEAD';
  const delays = retryable ? [0, 1200, 3000] : [0];
  let lastError;
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    try {
      const response = await apiFetch(path, { ...options, headers, cache: retryable ? 'no-store' : options.cache });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
      if (response.ok) return payload;
      const error = new Error(formatApiError(payload, response.status));
      if (!retryable || ![502, 503, 504].includes(response.status) || attempt === delays.length - 1) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (!retryable || attempt === delays.length - 1) throw error;
    }
  }
  throw lastError || new Error('Request failed.');
}

async function mapWithConcurrency(items, worker, limit = 4) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try { results[index] = { status: 'fulfilled', value: await worker(items[index], index) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

const requestJSON = (path, method, body) => apiRequest(path, { method, body: JSON.stringify(body) });
function normalizeSchool(row) { const schoolCode = row.school_code || row.school_id || row.code || ''; return { ...row, school_code: schoolCode, school_id: row.school_id || schoolCode, code: row.code || schoolCode }; }
function normalizeTrainer(row) { return { ...row, trainer_id: row.trainer_id || row.id || '' }; }
function normalizeClass(row) { return { ...row, school_class: row.id, school_id: row.school_id || row.school_code || '' }; }
function normalizeStudent(row) { return { ...row, school_id: row.school_id || row.school_code || '', class_id: row.class_id || row.school_class || '' }; }
function normalizeAttendance(row) { return { ...row, status: lower(row.status), session_id: row.session_id || row.session || '', student_id: row.student_id || row.student || '' }; }

export function DataProvider({ children }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [schools, setSchools] = useState([]), [classes, setClasses] = useState([]), [students, setStudents] = useState([]), [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]), [attendance, setAttendance] = useState([]), [leads, setLeads] = useState([]), [content, setContent] = useState([]);
  const [curriculum, setCurriculum] = useState([]), [inventory, setInventory] = useState([]), [billing, setBilling] = useState([]), [comms, setComms] = useState([]);
  const [projects, setProjects] = useState([]), [notifications, setNotifications] = useState([]), [studentReviews, setStudentReviews] = useState([]), [quizzes, setQuizzes] = useState([]), [quizSubmissions, setQuizSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [endpointErrors, setEndpointErrors] = useState({});
  const refreshPromiseRef = useRef(null);
  const refreshTimerRef = useRef(null);

  const refreshAll = useCallback(async () => {
    if (authLoading || !isAuthenticated) return { success: false, error: 'Authentication required' };
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      setLoading(true);
      const endpoints = [
        ['/schools', rows => setSchools(rows.map(normalizeSchool))], ['/classes', rows => setClasses(rows.map(normalizeClass))],
        ['/students', rows => setStudents(rows.map(normalizeStudent))], ['/trainers', rows => setTrainers(rows.map(normalizeTrainer))],
        ['/sessions', rows => setSessions(rows)], ['/attendance', rows => setAttendance(rows.map(normalizeAttendance))], ['/leads', rows => setLeads(rows)],
        ['/content', rows => setContent(rows)], ['/curriculum', rows => setCurriculum(rows)], ['/inventory', rows => setInventory(rows)],
        ['/billing', rows => setBilling(rows)], ['/comms', rows => setComms(rows)], ['/projects', rows => setProjects(rows)],
        ['/notifications', rows => setNotifications(rows)], ['/reviews', rows => setStudentReviews(rows)], ['/quizzes', rows => setQuizzes(rows)],
        ['/quiz-submissions', rows => setQuizSubmissions(rows)],
      ];
      try {
        const results = await mapWithConcurrency(endpoints, ([path]) => apiRequest(path), 4);
        const nextErrors = {};
        results.forEach((result, index) => {
          const [path, setter] = endpoints[index];
          if (result.status === 'fulfilled') setter(collection(result.value));
          else nextErrors[path] = result.reason?.message || `Unable to load ${path.slice(1) || 'data'}.`;
        });
        setEndpointErrors(nextErrors);
        return { success: results.some(result => result.status === 'fulfilled'), failed: results.filter(result => result.status === 'rejected').length, errors: nextErrors };
      } finally {
        setLoading(false);
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }, [authLoading, isAuthenticated]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      refreshAll();
    }, 100);
  }, [refreshAll]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) refreshAll();
    if (!isAuthenticated) setLoading(false);
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, [authLoading, isAuthenticated, refreshAll]);

  const save = async (path, method, body) => {
    try { const data = await requestJSON(path, method, body); scheduleRefresh(); return { success: true, data }; }
    catch (error) { return { success: false, error: error.message }; }
  };
  const remove = async path => {
    try { const data = await apiRequest(path, { method: 'DELETE' }); scheduleRefresh(); return { success: true, data }; }
    catch (error) { return { success: false, error: error.message }; }
  };

  const addSchool = async data => { const schoolCode = text(data?.school_code || data?.school_id || data?.code).toUpperCase(); if (!schoolCode) return { success: false, error: 'School code is required.' }; return save('/schools', 'POST', { ...data, school_code: schoolCode }); };
  const updateSchool = (id, data) => save(`/schools/${encodeURIComponent(id)}`, 'PUT', data);
  const deleteSchool = id => remove(`/schools/${encodeURIComponent(id)}`);
  const resolveClassId = (value, schoolCode = '') => { const raw = text(value); if (!raw) return ''; const exact = classes.find(item => String(item.id) === raw); if (exact) return exact.id; const byName = classes.find(item => (!schoolCode || text(item.school_id || item.school_code).toUpperCase() === schoolCode.toUpperCase()) && text(item.display_name).toUpperCase() === raw.toUpperCase()); return byName?.id || raw; };
  const addClass = data => { const school = text(data?.school || data?.school_id || data?.school_code); return save('/classes', 'POST', { ...data, school: school || data?.school }); };
  const addStudent = data => { const schoolCode = text(data?.school_code || data?.schoolCode || data?.school_id).toUpperCase(); const schoolClass = resolveClassId(data?.school_class || data?.class_id || data?.class, schoolCode); const rollNumber = Number(data?.roll_number ?? data?.roll); if (!schoolClass || !Number.isInteger(rollNumber) || rollNumber <= 0) return Promise.resolve({ success: false, error: 'A valid class and positive roll number are required.' }); return save('/students', 'POST', { school_class: schoolClass, roll_number: rollNumber, name: text(data?.name), date_of_birth: normalizeDateOnly(data?.date_of_birth), gender: data?.gender || '', email: data?.email || '', phone: data?.phone || '', guardian_name: data?.guardian_name || data?.parent || '', guardian_phone: data?.guardian_phone || '', guardian_email: data?.guardian_email || '', address: data?.address || '', current_level: data?.current_level || data?.level || '', status: lower(data?.status || 'active') }); };
  const updateStudent = (id, data) => save(`/students/${encodeURIComponent(id)}`, 'PUT', { ...data, date_of_birth: normalizeDateOnly(data?.date_of_birth) });
  const deleteStudent = id => remove(`/students/${encodeURIComponent(id)}`);
  const getNextRollNumber = (schoolCode, grade, section) => { const school = text(schoolCode).toUpperCase(); const cls = classes.find(item => text(item.school_id || item.school_code).toUpperCase() === school && text(item.grade).toUpperCase() === text(grade).toUpperCase() && text(item.section).toUpperCase() === text(section).toUpperCase()); const cohort = cls ? students.filter(student => String(student.class_id) === String(cls.id)) : []; const maxRoll = Math.max(0, ...cohort.map(student => Number(student.roll_number) || 0)); return String(maxRoll + 1).padStart(2, '0'); };
  const getStudentAttendance = studentId => { const key = text(studentId).toUpperCase().replace(/\s+/g, ''); if (!key) return 0; const rows = attendance.filter(row => text(row.student_id).toUpperCase().replace(/\s+/g, '') === key); if (!rows.length) return 0; const present = rows.filter(row => ['present', 'late'].includes(lower(row.status))).length; return Math.round((present / rows.length) * 100); };
  const getStudentAttendanceRecords = studentId => { const key = text(studentId).toUpperCase().replace(/\s+/g, ''); return key ? attendance.filter(row => text(row.student_id).toUpperCase().replace(/\s+/g, '') === key) : []; };

  const addTrainer = data => save('/trainers', 'POST', data), updateTrainer = (id, data) => save(`/trainers/${encodeURIComponent(id)}`, 'PUT', data), updateTrainerStatus = (id, status) => save(`/trainers/${encodeURIComponent(id)}/status`, 'PUT', { status }), deleteTrainer = id => remove(`/trainers/${encodeURIComponent(id)}`);
  const scheduleSession = data => { const schoolClass = resolveClassId(data?.school_class || data?.class_id || data?.class, data?.school_code || data?.school_id); const trainer = trainers.find(item => String(item.id) === String(data?.trainer || data?.trainer_id))?.id || data?.trainer; return save('/sessions', 'POST', { ...data, school_class: schoolClass, trainer }); };
  const completeSession = (id, body = {}) => save(`/sessions/${encodeURIComponent(id)}/complete`, 'POST', body), unlockSession = id => save(`/sessions/${encodeURIComponent(id)}/unlock`, 'POST', {}), startNewSession = data => scheduleSession(data);
  const markAttendance = (sessionId, studentId, status, note = '') => save('/attendance', 'POST', { session: sessionId, student: studentId, status: lower(status), note });
  const adminUpdateAttendance = (sessionId, studentId, status, note = '') => save('/attendance/admin-override', 'PUT', { session: sessionId, student: studentId, status: lower(status), note });
  const addLead = data => save('/leads', 'POST', data), updateLeadStage = (id, stage) => save(`/leads/${encodeURIComponent(id)}/stage`, 'PUT', { stage }), deleteLead = id => remove(`/leads/${encodeURIComponent(id)}`);
  const convertLeadToSchool = () => ({ success: false, error: 'Lead conversion requires an explicit school code and school setup fields; no identifiers are generated automatically.' });
  const uploadContent = data => save('/content', 'POST', data), deleteContent = id => remove(`/content/${encodeURIComponent(id)}`), addCurriculumPlan = data => save('/curriculum', 'POST', data), updateCurriculumStatus = (id, status) => save(`/curriculum/${encodeURIComponent(id)}/status`, 'PUT', { status });
  const addInventoryKit = data => save('/kits', 'POST', data), updateKitStatus = (id, status) => save(`/kits/${encodeURIComponent(id)}`, 'PATCH', { status }), deleteKit = id => remove(`/kits/${encodeURIComponent(id)}`);
  const createInvoice = data => save('/invoices', 'POST', data);
  const updateInvoiceStatus = async (id, status) => { const action = lower(status) === 'issued' ? 'issue' : lower(status) === 'void' ? 'void' : null; if (!action) return { success: false, error: 'Invoice lifecycle supports only issued or void actions from this control.' }; return save(`/invoices/${encodeURIComponent(id)}/${action}`, 'POST', {}); };
  const confirmPaymentReceipt = (id, amount, paymentMethod = 'other', paymentDate = new Date().toISOString(), transactionReference = '', notes = '') => { const numericAmount = Number(amount); if (!id || !Number.isFinite(numericAmount) || numericAmount <= 0) return Promise.resolve({ success: false, error: 'A positive payment amount is required.' }); return save('/payments/record', 'POST', { invoice: id, amount: numericAmount, method: lower(paymentMethod || 'other'), payment_date: paymentDate || new Date().toISOString(), transaction_reference: text(transactionReference), notes: text(notes) }); };
  const updateBillingInvoice = (id, data) => save(`/invoices/${encodeURIComponent(id)}`, 'PATCH', data);
  const deleteBillingInvoice = () => ({ success: false, error: 'Invoices are retained financial records; use the Void lifecycle instead of delete.' });
  const sendCommsMessage = data => save('/comms', 'POST', data), addProject = data => save('/projects', 'POST', data), deleteProject = id => remove(`/projects/${encodeURIComponent(id)}`);
  const sendBroadcastNotification = data => save('/notifications', 'POST', data);
  const updateNotification = () => ({ success: false, error: 'Notifications are immutable server records; create a new notification instead of editing.' });
  const deleteNotification = () => ({ success: false, error: 'Notifications are immutable server records and cannot be deleted from the portal.' });
  const pushSchoolNotification = ({ target_school_id, title, message, priority = 'normal' }) => sendBroadcastNotification({ target_type: target_school_id ? 'specific_school' : 'universal', target_school_id: target_school_id || '', title, message, severity: priority === 'high' ? 'urgent' : 'info' });
  const saveStudentReview = data => save('/assessments', 'POST', data), deleteStudentReview = id => remove(`/assessments/${encodeURIComponent(id)}`), createQuiz = data => save('/quizzes', 'POST', data), updateQuiz = (id, data) => save(`/quizzes/${encodeURIComponent(id)}`, 'PUT', data), deleteQuiz = id => remove(`/quizzes/${encodeURIComponent(id)}`), submitQuizAttempt = data => save('/quiz-submissions', 'POST', data);
  const allowQuizReattempt = () => ({ success: false, error: 'Quiz reattempt is controlled by the quiz lifecycle and is not exposed as a generic override.' });
  const deleteQuizSubmission = () => ({ success: false, error: 'Quiz attempts are retained for assessment history.' });
  const uploadFile = async file => { if (!file) return { success: false, error: 'No file selected.' }; const form = new FormData(); form.append('file', file); try { const data = await apiRequest('/upload', { method: 'POST', body: form }); scheduleRefresh(); return { success: true, url: data.url, filename: data.filename }; } catch (error) { return { success: false, error: error.message }; } };
  const classKits = {};
  const updateClassKitComponent = () => ({ success: false, error: 'Class kit blueprints are no longer stored in frontend state. Use the database-backed Kit Components workflow.' });
  const addComponentToClassKit = () => ({ success: false, error: 'Class kit components are persisted through the database-backed Kit Components workflow.' });
  const resolveAlertAction = useCallback(async () => ({ success: false, error: 'No operational alert action is connected.' }), []);

  const value = {
    loading, endpointErrors, refreshAll,
    schools, addSchool, updateSchool, deleteSchool,
    classes, addClass,
    students, addStudent, updateStudent, deleteStudent, getNextRollNumber, getStudentAttendance, getStudentAttendanceRecords,
    trainers, addTrainer, updateTrainer, updateTrainerStatus, deleteTrainer,
    sessions, scheduleSession, completeSession, unlockSession, startNewSession,
    attendance, markAttendance, adminUpdateAttendance,
    leads, addLead, updateLeadStage, deleteLead, convertLeadToSchool,
    content, uploadContent, deleteContent, curriculum, addCurriculumPlan, updateCurriculumStatus,
    inventory, addInventoryKit, updateKitStatus, deleteKit, classKits, updateClassKitComponent, addComponentToClassKit,
    billing, createInvoice, updateInvoiceStatus, confirmPaymentReceipt, updateBillingInvoice, deleteBillingInvoice,
    comms, sendCommsMessage, projects, addProject, deleteProject, uploadFile, resolveAlertAction,
    notifications, sendBroadcastNotification, updateNotification, deleteNotification, pushSchoolNotification,
    studentReviews, saveStudentReview, deleteStudentReview,
    quizzes, createQuiz, updateQuiz, deleteQuiz, quizSubmissions, submitQuizAttempt, allowQuizReattempt, deleteQuizSubmission,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside a DataProvider.');
  return context;
}
