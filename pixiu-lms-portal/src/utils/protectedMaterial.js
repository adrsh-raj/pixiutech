import { API_BASE } from '../config/api';

const token = () => localStorage.getItem('pixiu_auth_token');

export async function openProtectedMaterial(materialOrUrl, legacyTitle = '') {
  const raw = materialOrUrl && typeof materialOrUrl === 'object'
    ? materialOrUrl
    : { url: materialOrUrl, title: legacyTitle };
  const id = String(raw.id || '').trim();
  const suppliedUrl = String(raw.url || '').trim();
  const title = String(raw.title || 'Learning Material').trim();
  let endpoint;
  if (id) endpoint = `${API_BASE}/content/${encodeURIComponent(id)}/file`;
  else if (suppliedUrl.startsWith('/content/')) endpoint = `${API_BASE}${suppliedUrl}`;
  else if (suppliedUrl) endpoint = suppliedUrl;
  else throw new Error('Material file is not configured.');

  const authToken = token();
  if (!authToken) throw new Error('Authentication required.');
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${authToken}` }, cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || payload?.detail || `Unable to open material (${response.status})`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) {
    URL.revokeObjectURL(blobUrl);
    throw new Error('Please allow pop-ups to view the material.');
  }
  popup.document.open();
  const safeTitle = title.replace(/[<>]/g, '');
  const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html,body{margin:0;width:100%;height:100%;background:#0b1220}body{display:flex;align-items:center;justify-content:center}iframe,img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;border:0;object-fit:contain;background:#fff}.bar{position:fixed;top:10px;right:10px;z-index:5;padding:7px 10px;border:0;border-radius:8px;background:#1768ff;color:#fff;font:700 12px Arial;cursor:pointer}@media print{.bar{display:none}}</style></head><body><button class="bar" onclick="window.close()">Close</button>${contentType.startsWith('image/') ? `<img src="${blobUrl}" alt="${safeTitle}">` : `<iframe src="${blobUrl}" title="${safeTitle}"></iframe>`}</body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
}
