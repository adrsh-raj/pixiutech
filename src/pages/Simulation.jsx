import { LMS_BASE_URL } from '../config/runtime.js';

export default function Simulation() {
  window.location.replace(`${LMS_BASE_URL}/simulation`);
  return null;
}
