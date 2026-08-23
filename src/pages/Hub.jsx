import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
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
      <PageHead
        crumb="Resource library"
        title="Curriculum & Mission Materials"
        intro="Access class-wise study materials, mission bundles, and teacher packs. Filter by grade and format."
      />

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

              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#eef4ff', borderRadius: '8px', border: '1px solid #cce0ff', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1D6EFF', fontSize: '1.1rem' }}>Order Your Kit</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#555' }}>Get the official robotics kit delivered directly to your home.</p>
                <a href="https://wa.me/917985403186" target="_blank" rel="noreferrer" className="btn btn--primary" style={{ width: '100%', padding: '0.6rem' }}>
                  Buy via WhatsApp
                </a>
              </div>
            </Reveal>
          </aside>

          {/* Main Content Area */}
          <main className="hub-main">
            <Reveal>
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
