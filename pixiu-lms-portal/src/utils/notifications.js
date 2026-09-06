/**
 * Unified notification visibility and server persistence utilities.
 * Notification read state is stored only in PostgreSQL via the LMS API.
 */
import { API_BASE } from '../config/api';

const getToken = () => localStorage.getItem('pixiu_auth_token');

const authorizedFetch = (path, options = {}) => {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${API_BASE}${path}`, { ...options, headers, cache: 'no-store' });
};

export const getCanonicalUserKey = (u) => {
  if (!u) return '';
  const raw = u.related_id || u.username || u.id || '';
  return raw.toLowerCase().replace(/\s+/g, '').trim();
};

export const isFinancialNotification = (notif) => {
  if (!notif) return false;
  const type = String(notif.type || '').toLowerCase();
  const title = String(notif.title || '').toLowerCase();
  const message = String(notif.message || '').toLowerCase();
  return (
    type.includes('payment') || type.includes('billing') || type.includes('invoice') ||
    type === 'payment_claim' || type === 'payment_matched' ||
    title.includes('payment') || title.includes('invoice') || title.includes('fee') ||
    title.includes('billing') || title.includes('reconcil') || message.includes('tax invoice') ||
    message.includes('payment proof') || message.includes('reconciled by pixiu') || message.includes('utr:')
  );
};

export const filterNotificationsForUser = (notifications, user) => {
  if (!Array.isArray(notifications) || !user) return [];
  const role = user.role;
  const canonicalId = String(user.related_id || user.id || '').toUpperCase().trim();
  const schoolId = String(user.school_id || user.related_id || '').toUpperCase().trim();

  return notifications.filter(notif => {
    if (notif.status === 'Archived') return false;
    const financial = isFinancialNotification(notif);
    if (role === 'admin' || role === 'superadmin') return true;

    if (role === 'trainer') {
      if (financial) return false;
      if (notif.target_type === 'All_Students' || notif.target_type === 'Specific_Class') return false;
      if (notif.target_type === 'Universal' || notif.target_audience === 'Universal') return true;
      if (notif.target_type === 'All_Trainers' || notif.target_audience === 'All_Trainers') return true;
      if (notif.target_trainer_id) {
        const target = String(notif.target_trainer_id).toUpperCase().trim();
        if (target === 'ALL' || target === canonicalId) return true;
      }
      return false;
    }

    if (role === 'student') {
      if (financial) return false;
      if (notif.target_type === 'All_Trainers' || notif.target_audience === 'All_Trainers') return false;
      if (notif.target_type === 'Universal' || notif.target_audience === 'Universal') return true;
      if (notif.target_type === 'All_Students' || notif.target_audience === 'All_Students') return true;
      if (notif.target_type === 'Specific_Class' || notif.target_classes) {
        const studentGrade = String(user.username || user.related_id || '').match(/(?:ZPS|XYZ)(\d+)/i)?.[1] || '6';
        const targets = String(notif.target_classes || '').split(',').map(c => c.trim());
        return targets.includes(studentGrade) || targets.length >= 5;
      }
      return false;
    }

    if (role === 'school') {
      if (financial) {
        if (notif.type === 'payment_claim' || notif.target_school_id === 'ADMIN' || notif.target_audience === 'ADMIN') return false;
        const targetSchool = String(notif.target_school_id || notif.target_audience || '').toUpperCase().trim();
        return targetSchool === schoolId;
      }
      if (notif.target_type === 'All_Trainers' || (notif.target_trainer_id && notif.target_trainer_id !== 'All')) return false;
      if (notif.target_type === 'Specific_Class') return false;
      if (notif.target_type === 'Universal' || notif.target_audience === 'ALL' || notif.target_audience === 'Universal') return true;
      const targetSchool = String(notif.target_school_id || notif.target_audience || '').toUpperCase().trim();
      return targetSchool === schoolId;
    }
    return false;
  });
};

export const fetchUserReadNotifIds = async (user) => {
  const userKey = getCanonicalUserKey(user);
  if (!userKey) return [];
  try {
    const res = await authorizedFetch(`/notifications/reads/${encodeURIComponent(userKey)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

export const saveUserReadNotifIds = async (idOrIds, user) => {
  const userKey = getCanonicalUserKey(user);
  if (!userKey) return [];
  const incoming = (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(Boolean);
  if (!incoming.length) return fetchUserReadNotifIds(user);
  try {
    const res = await authorizedFetch('/notifications/reads', {
      method: 'POST',
      body: JSON.stringify({ userKey, notificationIds: incoming })
    });
    if (!res.ok) return fetchUserReadNotifIds(user);
  } catch {
    return fetchUserReadNotifIds(user);
  }
  return fetchUserReadNotifIds(user);
};
