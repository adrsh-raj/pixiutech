import { LMS_BASE_URL } from '../config/runtime.js';

export default function Simulation() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  window.location.replace(`${LMS_BASE_URL}/simulation${search}`);
  return null;
}
