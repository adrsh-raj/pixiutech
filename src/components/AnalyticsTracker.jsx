import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = 'G-LFBYYQ92YK';
const CONSENT_KEY = 'pixiu_cookie_consent_v1';
const CONSENT_EVENT = 'pixiu-cookie-consent-changed';

const DENIED = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

const GRANTED = {
  ad_storage: 'denied',
  analytics_storage: 'granted',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

function getConsent() {
  if (typeof window === 'undefined') return 'unset';
  try { return window.localStorage.getItem(CONSENT_KEY) || 'unset'; }
  catch (e) { return 'unset'; }
}

function ensureGoogleTag() {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };

  if (!document.querySelector('script[data-pixiu-ga="true"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    script.dataset.pixiuGa = 'true';
    document.head.appendChild(script);
  }

  if (!window.__pixiuGaConfigured) {
    window.gtag('consent', 'default', DENIED);
    window.gtag('consent', 'update', GRANTED);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: false, anonymize_ip: true });
    window.__pixiuGaConfigured = true;
  }
}

export function revokeGoogleTagConsent() {
  if (typeof window === 'undefined') return;
  try { if (typeof window.gtag === 'function') window.gtag('consent', 'update', DENIED); } catch (e) {}
  document.querySelector('script[data-pixiu-ga="true"]')?.remove();
  const cookieNames = ['_ga', '_gid', '_gat', '_gcl_au', `_ga_${GA_ID.replace(/-/g, '_')}`];
  for (const name of cookieNames) {
    document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }
  window.__pixiuGaConfigured = false;
}

export default function AnalyticsTracker() {
  const location = useLocation();
  const [consent, setConsent] = useState(getConsent);

  useEffect(() => {
    const onConsentChange = (event) => setConsent(event.detail?.consent || getConsent());
    window.addEventListener(CONSENT_EVENT, onConsentChange);
    return () => window.removeEventListener(CONSENT_EVENT, onConsentChange);
  }, []);

  useEffect(() => {
    if (consent === 'accepted') ensureGoogleTag();
    else revokeGoogleTagConsent();
  }, [consent]);

  useEffect(() => {
    if (consent !== 'accepted') return;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.origin + location.pathname,
      page_path: location.pathname,
    });
  }, [location.pathname, consent]);

  return null;
}

export { GA_ID, CONSENT_KEY, CONSENT_EVENT, getConsent };