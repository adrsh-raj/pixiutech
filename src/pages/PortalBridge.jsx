import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'

export default function PortalBridge() {
  const portalUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:5173' 
    : 'https://portal.pixiutech.com';

  return (
    <div className="portal-bridge-page" style={{ minHeight: '75vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', background: '#0A1A33', color: '#fff' }}>
      <div className="shell" style={{ maxWidth: '580px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
        <Reveal>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '3rem 2rem', borderRadius: '24px', backdropFilter: 'blur(10px)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
            
            {/* Logo */}
            <div style={{ display: 'inline-block', background: '#fff', padding: '8px 16px', borderRadius: '12px', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <img src="/img/logo.png" alt="Pixiu Tech" style={{ height: '36px', width: 'auto', display: 'block' }} />
            </div>

            <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 0.75rem 0', color: '#fff' }}>
              Pixiu Tech Portal
            </h1>
            
            <p style={{ fontSize: '1rem', color: '#94a3b8', margin: '0 auto 2rem auto', lineHeight: '1.6' }}>
              Sign in to access student workbooks, instructor lesson plans, live attendance logs, and school operations.
            </p>

            <a 
              href={portalUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn--primary" 
              style={{ width: '100%', fontSize: '1rem', padding: '14px 24px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px', textDecoration: 'none' }}
            >
              Open LMS Portal (portal.pixiutech.com) →
            </a>

            <div style={{ marginTop: '1.5rem' }}>
              <Link to="/" style={{ color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', transition: 'color 0.2s' }}>
                ← Back to Homepage
              </Link>
            </div>

          </div>
        </Reveal>
      </div>
    </div>
  );
}
