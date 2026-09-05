/**
 * Pixiu Tech LMS - Unified Notification Security & Persistence Utilities
 * 
 * Strict Role Access Matrix:
 * 1. Admin: Broadcasts, System Alerts, Payment Claims & Reconciliations
 * 2. Trainers: Lab Directives, Hardware & Universal notices. STRICTLY ZERO PAYMENTS/BILLING.
 * 3. Students: Grade Syllabus & Lab Schedules. STRICTLY ZERO PAYMENTS/BILLING.
 * 4. Schools: Own Institutional Notices & Official Verified Fee Receipts. ZERO OTHER SCHOOLS.
 */

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : (import.meta.env?.VITE_API_URL || '/api');

/**
 * Returns a stable, canonical user key regardless of login alias or spacing
 * e.g., 'Akash Sharma' -> 'tr-02', 'admin' -> 'adm-01', 'XYZ6A 01' -> 'xyz6a01'
 */
export const getCanonicalUserKey = (u) => {
  if (!u) return '';
  const raw = u.related_id || u.username || u.id || '';
  return raw.toLowerCase().replace(/\s+/g, '').trim();
};

/**
 * Checks if a notification contains financial, billing, fee, or payment data
 */
export const isFinancialNotification = (notif) => {
  if (!notif) return false;
  const type = (notif.type || '').toLowerCase();
  const title = (notif.title || '').toLowerCase();
  const message = (notif.message || '').toLowerCase();

  return (
    type.includes('payment') ||
    type.includes('billing') ||
    type.includes('invoice') ||
    type === 'payment_claim' ||
    type === 'payment_matched' ||
    title.includes('payment') ||
    title.includes('invoice') ||
    title.includes('fee') ||
    title.includes('billing') ||
    title.includes('reconcil') ||
    message.includes('tax invoice') ||
    message.includes('payment proof') ||
    message.includes('reconciled by pixiu') ||
    message.includes('utr:')
  );
};

/**
 * Filters raw system notifications according to the authenticated user's role and security scope.
 */
export const filterNotificationsForUser = (notifications, user) => {
  if (!Array.isArray(notifications) || !user) return [];

  const role = user.role;
  const canonicalId = (user.related_id || user.id || '').toUpperCase().trim();
  const schoolId = (user.school_id || user.related_id || '').toUpperCase().trim();

  return notifications.filter(notif => {
    if (notif.status === 'Archived') return false;

    const isFinancial = isFinancialNotification(notif);

    // 1. ADMIN & SUPERADMIN: Full Visibility
    if (role === 'admin' || role === 'superadmin') {
      return true;
    }

    // 2. TRAINERS: STRICTLY NO PAYMENTS / BILLING
    if (role === 'trainer') {
      if (isFinancial) return false;

      // Exclude student-specific class announcements
      if (notif.target_type === 'All_Students' || notif.target_type === 'Specific_Class') {
        return false;
      }

      // Universal announcements
      if (notif.target_type === 'Universal' || notif.target_audience === 'Universal') {
        return true;
      }

      // All Trainers broadcast
      if (notif.target_type === 'All_Trainers' || notif.target_audience === 'All_Trainers') {
        return true;
      }

      // Direct trainer assignment (e.g. TR-01 or TR-02)
      if (notif.target_trainer_id) {
        const targetTr = notif.target_trainer_id.toUpperCase().trim();
        if (targetTr === 'ALL' || targetTr === canonicalId) {
          return true;
        }
      }

      return false;
    }

    // 3. STUDENTS: STRICTLY NO PAYMENTS / BILLING
    if (role === 'student') {
      if (isFinancial) return false;

      // Exclude trainer directives
      if (notif.target_type === 'All_Trainers' || notif.target_audience === 'All_Trainers') {
        return false;
      }

      // Universal announcements
      if (notif.target_type === 'Universal' || notif.target_audience === 'Universal') {
        return true;
      }

      // All Students announcements
      if (notif.target_type === 'All_Students' || notif.target_audience === 'All_Students') {
        return true;
      }

      // Class grade matching
      if (notif.target_type === 'Specific_Class' || notif.target_classes) {
        const studentGrade = (user.username || user.related_id || '').match(/(?:ZPS|XYZ)(\d+)/i)?.[1] || '6';
        const targetClasses = (notif.target_classes || '').split(',').map(c => c.trim());
        if (targetClasses.includes(studentGrade) || targetClasses.length >= 5) {
          return true;
        }
      }

      return false;
    }

    // 4. SCHOOL AUTHORITIES
    if (role === 'school') {
      // Payment announcements: School only sees verified reconciliations for ITS OWN school.
      // Payment claims submitted to Admin have target_school_id = 'ADMIN' and should NOT show to schools.
      if (isFinancial) {
        if (notif.type === 'payment_claim' || notif.target_school_id === 'ADMIN' || notif.target_audience === 'ADMIN') {
          return false;
        }
        const targetSchool = (notif.target_school_id || notif.target_audience || '').toUpperCase().trim();
        return targetSchool === schoolId;
      }

      // Exclude student-specific class announcements and trainer directives
      if (notif.target_type === 'All_Trainers' || (notif.target_trainer_id && notif.target_trainer_id !== 'All')) {
        return false;
      }
      if (notif.target_type === 'Specific_Class') {
        return false;
      }

      // Universal or school-wide announcements
      if (notif.target_type === 'Universal' || notif.target_audience === 'ALL' || notif.target_audience === 'Universal') {
        return true;
      }

      const targetSch = (notif.target_school_id || notif.target_audience || '').toUpperCase().trim();
      return targetSch === schoolId;
    }

    return false;
  });
};

/**
 * Fetch read notification IDs from backend SQLite database with local cache fallback
 */
export const fetchUserReadNotifIds = async (user) => {
  const userKey = getCanonicalUserKey(user);
  if (!userKey) return [];

  const localKey = `pixiu_read_notifs_${userKey}`;
  let localIds = [];
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) localIds = JSON.parse(saved);
  } catch (e) {}

  try {
    const res = await fetch(`${API_BASE}/notifications/reads/${userKey}`);
    if (res.ok) {
      const serverIds = await res.json();
      if (Array.isArray(serverIds)) {
        const merged = Array.from(new Set([...localIds, ...serverIds]));
        try {
          localStorage.setItem(localKey, JSON.stringify(merged));
        } catch (e) {}
        return merged;
      }
    }
  } catch (err) {
    // API offline or unreachable, return local cache
  }

  return localIds;
};

/**
 * Persist read notification ID(s) to both local storage and server SQLite database
 */
export const saveUserReadNotifIds = async (idOrIds, user) => {
  const userKey = getCanonicalUserKey(user);
  if (!userKey) return [];

  const localKey = `pixiu_read_notifs_${userKey}`;
  const incoming = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  
  let current = [];
  try {
    const saved = localStorage.getItem(localKey);
    if (saved) current = JSON.parse(saved);
  } catch (e) {}

  const updated = Array.from(new Set([...current, ...incoming]));
  try {
    localStorage.setItem(localKey, JSON.stringify(updated));
  } catch (e) {}

  // Sync with backend API
  try {
    fetch(`${API_BASE}/notifications/reads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userKey, notificationIds: incoming })
    }).catch(() => {});
  } catch (e) {}

  return updated;
};
