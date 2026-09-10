import { API_BASE } from '../config/api';

const token = () => localStorage.getItem('pixiu_auth_token');

export async function openProtectedMaterial(materialOrUrl, legacyTitle = '') {
  const raw = materialOrUrl && typeof materialOrUrl === 'object'
    ? materialOrUrl
    : { url: materialOrUrl, title: legacyTitle };
  const id = String(raw.id || '').trim();
  const suppliedUrl = String(raw.url || '').trim();
  const title = String(raw.title || 'Learning-Material').trim();

  let endpoint;
  if (id) {
    endpoint = `${API_BASE}/content/${encodeURIComponent(id)}/file`;
  } else if (suppliedUrl) {
    if (suppliedUrl.startsWith('/content/')) endpoint = `${API_BASE}${suppliedUrl}`;
    else if (suppliedUrl.startsWith('/api/')) endpoint = suppliedUrl;
    else endpoint = suppliedUrl;
  } else {
    throw new Error('Material file is not configured.');
  }

  const authToken = token();
  if (!authToken) throw new Error('Authentication required.');

  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${authToken}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || payload?.detail || `Unable to open material (${response.status})`);
  }

  const blob = await response.blob();
  const extension = response.headers.get('content-type')?.includes('image/') ? '.png' : '.pdf';
  const safeTitle = title.replace(/[^A-Za-z0-9._ -]/g, '') || 'Learning-Material';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  link.download = `${safeTitle}${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
