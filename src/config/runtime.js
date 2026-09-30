const configuredLmsUrl = import.meta.env.VITE_LMS_URL?.trim();

function getProductionLmsUrl() {
  if (configuredLmsUrl) return configuredLmsUrl.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.replace(/^www\./, '');
    if (hostname === 'pixiutech.com') {
      return `${window.location.protocol}//portal.${hostname}`;
    }
  }

  return 'https://portal.pixiutech.com';
}

export const LMS_BASE_URL = getProductionLmsUrl();
export const LMS_LOGIN_URL = new URL('/login', `${LMS_BASE_URL}/`).toString();
