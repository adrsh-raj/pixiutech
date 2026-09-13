import { apiFetch } from '../context/AuthContext';

async function request(path, options = {}) {
  const response = await apiFetch(path, { ...options, cache: options.method ? undefined : 'no-store' });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json().catch(() => ({})) : null;
  if (!response.ok) throw new Error(payload?.detail || payload?.error || payload?.message || `Request failed (${response.status})`);
  return payload;
}

export function listTrainerMaterials() {
  return request('/trainer-materials');
}

export function uploadTrainerMaterial({ title, description, class_grade, level, target_trainer_id, file }) {
  const form = new FormData();
  form.append('title', title || '');
  form.append('description', description || '');
  form.append('class_grade', class_grade || '');
  form.append('level', level || '');
  form.append('target_trainer_id', target_trainer_id || 'ALL');
  form.append('file', file);
  return request('/trainer-materials', { method: 'POST', body: form });
}

export function deleteTrainerMaterial(id) {
  return request(`/trainer-materials/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function openTrainerMaterial(id, suggestedName = 'Trainer-Material.pdf') {
  const response = await apiFetch(`/trainer-materials/${encodeURIComponent(id)}/file`, { cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail || payload?.error || payload?.message || `Unable to open material (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
