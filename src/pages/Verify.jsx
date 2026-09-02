import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id') || searchParams.get('cert') || '';

  useEffect(() => {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const portalBase = isLocal ? 'http://localhost:5173' : 'https://portal.pixiutech.com';
    const targetUrl = id ? `${portalBase}/verify?id=${encodeURIComponent(id)}` : `${portalBase}/verify`;
    window.location.replace(targetUrl);
  }, [id]);

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A1A33', color: '#fff', textAlign: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: '480px', padding: '2.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ width: '48px', height: '48px', margin: '0 auto 1.5rem auto', border: '3px solid #0066FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Authenticating Credential...</h2>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Redirecting to Pixiu Tech Central Credential Registry...</p>
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
