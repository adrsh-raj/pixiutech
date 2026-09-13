import { apiFetch } from '../context/AuthContext';

export async function openProtectedMaterial(materialOrUrl, legacyTitle = '') {
  const raw = materialOrUrl && typeof materialOrUrl === 'object' ? materialOrUrl : { url: materialOrUrl, title: legacyTitle };
  const id = String(raw.id || '').trim();
  const suppliedUrl = String(raw.url || '').trim();
  const title = String(raw.title || 'Learning Material').trim();
  let path = '';
  if (id) path = `/content/${encodeURIComponent(id)}/file`;
  else if (suppliedUrl.startsWith('/content/')) path = suppliedUrl;
  else if (suppliedUrl) {
    const direct = window.open(suppliedUrl, '_blank', 'noopener,noreferrer');
    if (!direct) throw new Error('Please allow pop-ups to view the material.');
    return;
  } else throw new Error('Material file is not configured.');

  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) throw new Error('Please allow pop-ups to view the material.');
  popup.document.open();
  popup.document.write('<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Arial;background:#0b1220;color:white"><div>Opening learning material…</div></body></html>');
  popup.document.close();
  try {
    const response = await apiFetch(path, { cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || payload?.detail || `Unable to open material (${response.status})`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const safeTitle = title.replace(/[<>]/g, '');
    const contentType = response.headers.get('content-type') || blob.type || 'application/octet-stream';
    popup.document.open();
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html,body{margin:0;width:100%;height:100%;background:#0b1220}body{display:flex;align-items:center;justify-content:center}iframe,img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;border:0;object-fit:contain;background:#fff}.bar{position:fixed;top:10px;right:10px;z-index:5;padding:7px 10px;border:0;border-radius:8px;background:#1768ff;color:#fff;font:700 12px Arial;cursor:pointer}@media print{.bar{display:none}}</style></head><body><button class="bar" onclick="window.close()">Close</button>${contentType.startsWith('image/') ? `<img src="${blobUrl}" alt="${safeTitle}">` : `<iframe src="${blobUrl}" title="${safeTitle}"></iframe>`}</body></html>`);
    popup.document.close();
    popup.focus();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  } catch (error) {
    try { popup.close(); } catch (_) {}
    throw error;
  }
}
