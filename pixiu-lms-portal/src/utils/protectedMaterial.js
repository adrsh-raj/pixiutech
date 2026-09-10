import { API_BASE } from '../config/api';

const token = () => localStorage.getItem('pixiu_auth_token');

export async function openProtectedMaterial(url, suggestedName = 'Pixiu-Material') {
  const value = String(url || '').trim();
  if (!value) throw new Error('File URL not configured.');

  const parsed = new URL(value, window.location.origin);
  let endpoint = '';
  let filename = suggestedName;

  if (parsed.pathname.startsWith('/materials/')) {
    const legacyFilename = decodeURIComponent(parsed.pathname.slice('/materials/'.length));
    if (!/^[A-Za-z0-9._-]+\.pdf$/i.test(legacyFilename)) throw new Error('Invalid material file.');
    endpoint = `/materials/${encodeURIComponent(legacyFilename)}`;
    filename = legacyFilename;
  } else {
    const match = parsed.pathname.match(/^\/content\/([0-9a-f-]{32,36})\/file$/i);
    if (!match) throw new Error('Invalid protected material URL.');
    endpoint = `/content/${encodeURIComponent(match[1])}/file`;
  }

  const authToken = token();
  if (!authToken) throw new Error('Authentication required.');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${authToken}` },
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
  link.download = filename || 'Pixiu-Material';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
