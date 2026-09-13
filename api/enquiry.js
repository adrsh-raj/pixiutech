const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const attempts = new Map();

function clean(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return /^https:\/\/(www\.)?pixiutech\.com$/i.test(origin);
}

function checkRateLimit(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter(timestamp => now - timestamp < RATE_WINDOW_MS);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length <= RATE_LIMIT;
}

function getLmsEnquiryEndpoint() {
  const explicit = process.env.LMS_ENQUIRY_ENDPOINT?.trim();
  if (explicit) return explicit;
  const base = (process.env.VITE_API_URL?.trim() || 'https://pixiu-django-api.onrender.com/api/v1').replace(/\/+$/, '');
  return `${base}/public/enquiries`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: 'Origin not allowed.' });

  const forwarded = req.headers['x-forwarded-for'];
  const ip = clean(Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0], 100) || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'Too many enquiries from this connection. Please try again later.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const school = clean(body.school, 160);
  const person = clean(body.person, 120);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 160);
  const city = clean(body.city, 100);
  const strength = clean(body.strength, 80);
  const message = clean(body.message, 4000);
  const honeypot = clean(body.website, 120);

  if (honeypot) return res.status(400).json({ error: 'Unable to process this enquiry.' });
  if (!school || !person || !phone || !email) return res.status(400).json({ error: 'School name, contact person, phone and email are required.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Please provide a valid email address.' });

  try {
    const delivery = await fetch(getLmsEnquiryEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Pixiu-Website-Source': 'pixiutech.com' },
      body: JSON.stringify({ school, person, phone, email, city, strength, message, website: '' })
    });
    const payload = await delivery.json().catch(() => ({}));
    if (!delivery.ok) {
      console.error(`Enquiry delivery failed with status ${delivery.status}.`);
      return res.status(502).json({ error: payload.error || 'We could not deliver your enquiry right now. Please try again.' });
    }
    return res.status(200).json({ success: true, lead_id: payload.lead_id || null });
  } catch (error) {
    console.error('Enquiry delivery error:', error.message);
    return res.status(502).json({ error: 'We could not deliver your enquiry right now. Please try again.' });
  }
}
