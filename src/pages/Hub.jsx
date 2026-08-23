import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'
import Plate from '../components/Plate.jsx'
import { GRADES, MATERIALS } from '../data/materials.js'

export default function Hub() {
  const [activeGrade, setActiveGrade] = useState(GRADES[0].id)
  const storedRole = localStorage.getItem('hub_role') || 'student'
  const [role, setRole] = useState(storedRole)
  const navigate = useNavigate()

  useEffect(() => {
    if (localStorage.getItem('hub_authenticated') !== 'true') {
      navigate('/login')
    }
  }, [navigate])

  const activeMaterials = MATERIALS[activeGrade] || []

  if (localStorage.getItem('hub_authenticated') !== 'true') {
    return null // prevent flash before redirect
  }

  return (
    <>
      <PageHead
        crumb="Resource Hub"
        title="Curriculum & Mission Materials"
        intro="Access class-wise study materials, mission bundles, and teacher packs. Filter by grade and role."
      />

      <section className="band">
        <div className="shell split split--wide-right">
          {/* Sidebar */}
          <aside className="hub-sidebar">
            <Reveal>
              {storedRole === 'teacher' && (
                <>
                  <h3 style={{ marginBottom: '1rem' }}>View As</h3>
                  <div className="role-toggle" style={{ display: 'flex', gap: '10px', marginBottom: '2rem' }}>
                    <button 
                      className={`btn ${role === 'teacher' ? 'btn--primary' : 'btn--outline'}`}
                      onClick={() => setRole('teacher')}
                      style={{ flex: 1, padding: '0.5rem' }}
                    >
                      Teacher
                    </button>
                    <button 
                      className={`btn ${role === 'student' ? 'btn--primary' : 'btn--outline'}`}
                      onClick={() => setRole('student')}
                      style={{ flex: 1, padding: '0.5rem' }}
                    >
                      Student
                    </button>
                  </div>
                </>
              )}

              <h3 style={{ marginBottom: '1rem' }}>Select Grade</h3>
              <div className="grade-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {GRADES.map((g) => (
                  <button
                    key={g.id}
                    className={`btn ${activeGrade === g.id ? 'btn--primary' : 'btn--ghost'}`}
                    style={{ textAlign: 'left', padding: '0.75rem 1rem' }}
                    onClick={() => setActiveGrade(g.id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </Reveal>
            
            <Reveal delay={100}>
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#eef4ff', borderRadius: '8px', border: '1px solid #cce0ff', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '0.5rem', color: '#1D6EFF' }}>Order Your Kit</h3>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#555' }}>Get the official robotics kit delivered directly to your home.</p>
                <a href="https://wa.me/917985403186" target="_blank" rel="noreferrer" className="btn btn--primary" style={{ width: '100%', padding: '0.6rem' }}>
                  Buy via WhatsApp
                </a>
              </div>
              <div style={{ marginTop: '2rem' }}>
                <Plate
                  src="/img/stem_curriculum.jpg"
                  alt="Instructor teaching STEM"
                  caption="Empowering teachers with complete session packs."
                />
              </div>
            </Reveal>
          </aside>

          {/* Main Content */}
          <div className="hub-content">
            <Reveal>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 className="h-sect">{GRADES.find(g => g.id === activeGrade)?.name} Materials</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {role === 'teacher' && (
                    <span style={{ fontSize: '0.9rem', color: '#666', background: '#eee', padding: '4px 8px', borderRadius: '4px' }}>
                      Admin: You can add more materials by editing public/materials and materials.js
                    </span>
                  )}
                  <button 
                    className="btn btn--ghost" 
                    onClick={() => {
                      localStorage.removeItem('hub_authenticated');
                      localStorage.removeItem('hub_role');
                      navigate('/login');
                    }}
                    style={{ fontSize: '0.9rem', color: '#cc0000', border: '1px solid #cc0000', padding: '4px 12px' }}
                  >
                    Logout
                  </button>
                </div>
              </div>
              
              <div className="materials-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {activeMaterials.length === 0 ? (
                  <p>No materials uploaded for this grade yet.</p>
                ) : (
                  activeMaterials.map((m) => (
                    <article key={m.id} style={{ border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px' }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{m.title}</h3>
                      <p style={{ color: '#555', marginBottom: '1rem' }}>Type: {m.type.toUpperCase()}</p>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <a href={m.studentUrl} target="_blank" rel="noreferrer" className="btn btn--outline" style={{ fontSize: '0.9rem' }}>
                          View Student Book {role === 'student' && '(Watermarked)'}
                        </a>
                        
                        {role === 'teacher' && (
                          <a href={m.teacherUrl} target="_blank" rel="noreferrer" className="btn btn--primary" style={{ fontSize: '0.9rem' }}>
                            Download Teacher Pack & Keys
                          </a>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
