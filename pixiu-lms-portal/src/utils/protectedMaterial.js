import { API_BASE } from '../config/api';

const token = () => localStorage.getItem('pixiu_auth_token');

export async function openProtectedMaterial(materialOrUrl) {
  const raw = materialOrUrl && typeof materialOrUrl === 'object'
    ? materialOrUrl
    : { url: materialOrUrl };
  const id = String(raw.id || '').trim();
  const suppliedUrl = String(raw.url || '').trim();

  let endpoint = '';
  let suggestedName = raw.title ? `${String(raw.title).replace(/[^A-Za-z0-9._ -]/g, '')}` : 'learning-material';
  if (id) {
    endpoint = `${API_BASE}/content/${encodeURIComponent(id)}/file`;
    const ext = String(raw.content_type || '').toLowerCase() === 'image' ? '.png' : '.pdf';
    suggestedName += ext;
  } else if (suppliedUrl) {
    const parsed = new URL(suppliedUrl, window.location.origin);
    if (parsed.origin !== window.location.origin && !parsed.protocol.startsWith('http')) {
      throw new Error('Invalid material URL.');
    }
    endpoint = suppliedUrl.startsWith(API_BASE) ? suppliedUrl : suppliedUrl;
    suggestedName += String(parsed.pathname).match(/\.(pdf|png|jpe?g|webp)$/i)?.[0] || '.pdf';
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
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
