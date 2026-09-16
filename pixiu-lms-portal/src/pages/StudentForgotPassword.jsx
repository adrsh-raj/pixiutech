import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function StudentForgotPassword() {
  return <div className="min-h-screen bg-[#040810] flex items-center justify-center p-4 text-white"><div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0A0F1A] p-7 shadow-2xl"><div className="flex justify-center mb-4"><span className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-300 flex items-center justify-center"><HelpCircle size={26}/></span></div><h1 className="text-xl font-black text-center">Forgot password?</h1><p className="mt-3 text-sm leading-6 text-slate-400 text-center">Please contact your assigned trainer. Your trainer can generate a new temporary 8-digit PIN for your account.</p><p className="mt-3 text-xs leading-5 text-slate-500 text-center">For security, the portal does not reveal or recover your previous password.</p><Link to="/login" className="mt-6 w-full min-h-11 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-blue-700"><ArrowLeft size={14}/> Back to login</Link></div></div>;
}
