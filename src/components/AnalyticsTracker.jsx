import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = 'G-LFBYYQ92YK';

function ensureGoogleTag() {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  if (!document.querySelector('script[data-pixiu-ga="true"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    script.dataset.pixiuGa = 'true';
    document.head.appendChild(script);
  }

  if (!window.__pixiuGaConfigured) {
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    window.__pixiuGaConfigured = true;
  }
}

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    ensureGoogleTag();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.origin + location.pathname,
      page_path: location.pathname,
    });
  }, [location.pathname]);

  return null;
}

export { GA_ID };