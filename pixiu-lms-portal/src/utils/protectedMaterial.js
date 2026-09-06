import { API_BASE } from '../config/api';

export async function openProtectedMaterial(url) {
  const value = String(url || '').trim();
  if (!value) throw new Error('File URL not configured.');

  const parsed = new URL(value, window.location.origin);
  if (!parsed.pathname.startsWith('/materials/')) {
    throw new Error('Invalid protected material URL.');
  }

  const filename = decodeURIComponent(parsed.pathname.slice('/materials/'.length));
  if (!/^[A-Za-z0-9._-]+\.pdf$/i.test(filename)) {
    throw new Error('Invalid material file.');
  }

  const token = localStorage.getItem('pixiu_auth_token');
  if (!token) throw new Error('Authentication required.');

  const popup = window.open('', '_blank');
  if (!popup) throw new Error('Please allow pop-ups to view the PDF.');

  try {
    const response = await fetch(`${API_BASE}/materials/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Unable to open material (${response.status})`);
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    popup.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    popup.close();
    throw error;
  }
}
