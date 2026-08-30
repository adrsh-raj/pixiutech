import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import { GRADES, MATERIALS } from '../data/materials.js'

export default function Hub() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeFormat, setActiveFormat] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('hub_authenticated') !== 'true') {
      navigate('/login')
    }
  }, [navigate])

  if (localStorage.getItem('hub_authenticated') !== 'true') {
    return null
  }

  const role = localStorage.getItem('hub_role') || 'student'

  // Filter materials
  let filtered = MATERIALS
  if (activeCategory !== 'all') {
    filtered = filtered.filter(m => m.classId === activeCategory)
  }
  if (activeFormat !== 'all') {
    filtered = filtered.filter(m => m.format === activeFormat)
  }

  // Count generators
  const getCatCount = (catId) => catId === 'all' ? MATERIALS.length : MATERIALS.filter(m => m.classId === catId).length
  const getFormatCount = (fmtId) => fmtId === 'all' ? MATERIALS.length : MATERIALS.filter(m => m.format === fmtId).length

  return (
    <div className="hub-page">
      <div style={{ background: '#0A1A33', color: '#fff', padding: '2.5rem 0 2rem' }}>
        <div className="shell">
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', fontWeight: '600' }}>Resource Portal</h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: role === 'student' ? '#25D366' : '#C9A227' }}></span>
            <span style={{ fontSize: '0.9rem', color: '#e2e8f0' }}>Logged in as <strong>{role === 'student' ? 'Student' : 'Trainer'}</strong></span>
          </div>
        </div>
      </div>

      <section className="band" style={{ paddingTop: '2rem' }}>
        <div className="shell hub-container">
          {/* Sidebar Navigation */}
          <aside className="hub-sidebar">
            <Reveal>
              <div className="hub-menu-label">Filter by Class</div>
              <div className="hub-menu-group">
                <div className={`hub-menu-item ${activeCategory === 'all' ? 'active' : ''}`} onClick={() => setActiveCategory('all')}>
                  <span>Everything</span>
                  <span className="hub-menu-count">{getCatCount('all')}</span>
                </div>
                {GRADES.map(g => (
                  <div key={g.id} className={`hub-menu-item ${activeCategory === g.id ? 'active' : ''}`} onClick={() => setActiveCategory(g.id)}>
                    <span>{g.name}</span>
                    <span className="hub-menu-count">{getCatCount(g.id)}</span>
                  </div>
                ))}
              </div>

              <div className="hub-menu-label">Filter by Format</div>
              <div className="hub-menu-group">
                <div className={`hub-menu-item ${activeFormat === 'all' ? 'active' : ''}`} onClick={() => setActiveFormat('all')}>
                  <span>All formats</span>
                  <span className="hub-menu-count">{getFormatCount('all')}</span>
                </div>
                <div className={`hub-menu-item ${activeFormat === 'book' ? 'active' : ''}`} onClick={() => setActiveFormat('book')}>
                  <span>Student book</span>
                  <span className="hub-menu-count">{getFormatCount('book')}</span>
                </div>
                <div className={`hub-menu-item ${activeFormat === 'code' ? 'active' : ''}`} onClick={() => setActiveFormat('code')}>
                  <span>Arduino code</span>
                  <span className="hub-menu-count">{getFormatCount('code')}</span>
                </div>
              </div>

              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#e0f7e9', borderRadius: '12px', border: '1px solid #a7dfb8', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '0.25rem', color: '#25D366', fontSize: '1.1rem' }}>🛒 Order Your Kit</h3>
                <p style={{ fontSize: '0.8rem', fontWeight: '600', color: '#1a7a3a', marginBottom: '0.75rem' }}>At the most affordable price — built for students!</p>
                <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: '#555' }}>Get the official Pixiu robotics kit delivered directly to your home. Everything you need to build, code, and innovate.</p>
                <a href="https://wa.me/917985403186?text=Hi%2C%20I%20want%20to%20order%20a%20student%20robotics%20kit" target="_blank" rel="noreferrer" className="btn btn--primary" style={{ width: '100%', padding: '0.6rem', background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  Order on WhatsApp
                </a>
              </div>
            </Reveal>
          </aside>

          {/* Main Content Area */}
          <main className="hub-main">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
              <button 
                className="btn btn--outline" 
                onClick={() => {
                  localStorage.removeItem('hub_authenticated');
                  localStorage.removeItem('hub_role');
                  navigate('/login');
                }}
                style={{ fontSize: '0.9rem', color: '#cc0000', borderColor: '#cc0000', padding: '6px 16px' }}
              >
                Logout
              </button>
            </div>
            
            <Reveal>

              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#fff', borderRadius: '12px', border: '1px solid #ddd' }}>
                  <h3 style={{ color: '#0A1A33', marginBottom: '0.5rem' }}>No materials found</h3>
                  <p style={{ color: '#666' }}>Try adjusting your filters on the left.</p>
                </div>
              ) : (
                GRADES.map(grade => {
                  const gradeMaterials = filtered.filter(m => m.classId === grade.id)
                  if (gradeMaterials.length === 0) return null

                  return (
                    <div key={grade.id}>
                      <h2 className="hub-class-header">
                        {grade.name} <span>{grade.desc}</span>
                      </h2>

                      {gradeMaterials.map(m => (
                        <article className="hub-card" key={m.id}>
                          <div className={`hub-card-icon ${m.format}`}>
                            {m.format.toUpperCase()}
                          </div>
                          
                          <div className="hub-card-body">
                            <h3 className="hub-card-title">{m.title}</h3>
                            <div className="hub-card-meta">{m.meta}</div>
                            <div className="hub-card-desc">{m.desc}</div>
                          </div>

                          <div className="hub-card-actions">
                            {!m.uploaded ? (
                              <span className="hub-pill-missing">file not uploaded yet</span>
                            ) : (
                              <>
                                <a href={m.url} target="_blank" rel="noreferrer" className="btn btn--outline" style={{ padding: '8px 16px' }}>
                                  Open
                                </a>
                                <a href={m.url} target="_blank" rel="noreferrer" download className="btn btn--primary" style={{ padding: '8px 16px' }}>
                                  Download
                                </a>
                              </>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                })
              )}
            </Reveal>
          </main>
        </div>
      </section>
    </div>
  )
}
