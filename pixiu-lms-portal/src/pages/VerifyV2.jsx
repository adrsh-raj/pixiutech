import { useEffect } from 'react';

const PUBLIC_VERIFY_BASE = 'https://pixiutech.com/verify';

export default function VerifyV2() {
  useEffect(() => {
    const query = window.location.search || '';
    window.location.replace(`${PUBLIC_VERIFY_BASE}${query}`);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="mt-4 text-sm font-semibold text-slate-500">
          Opening Pixiu Tech public certificate verification…
        </p>
      </div>
    </div>
  );
}
