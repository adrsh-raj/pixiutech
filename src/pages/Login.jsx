import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'

export default function Login() {
  const [studentId, setStudentId] = useState('')
  const [studentPwd, setStudentPwd] = useState('')
  
  const [teacherId, setTeacherId] = useState('')
  const [teacherPwd, setTeacherPwd] = useState('')
  
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleStudentLogin = (e) => {
    e.preventDefault()
    if (studentId === 'ZPS' && studentPwd === 'ZPSzenith@hata') {
      localStorage.setItem('hub_authenticated', 'true')
      localStorage.setItem('hub_role', 'student')
      navigate('/hub')
    } else {
      setError('Invalid School ID or Password for Student Access.')
    }
  }

  const handleTeacherLogin = (e) => {
    e.preventDefault()
    if (teacherId === 'adarshraj' && (teacherPwd === 'Adarsg@123' || teacherPwd === '[Adarsg@123]')) {
      localStorage.setItem('hub_authenticated', 'true')
      localStorage.setItem('hub_role', 'teacher')
      navigate('/hub')
    } else {
      setError('Invalid Trainer ID or Password.')
    }
  }

  return (
    <>
      <PageHead
        crumb="Resource Hub Login"
        title="Secure Portal Access"
        intro="Select your portal below. Students can access view-only materials, while trainers have access to complete session packs."
      />
      
      <section className="band">
        <div className="shell">
          {error && (
            <div style={{ background: '#ffebee', color: '#cc0000', padding: '1rem', borderRadius: '4px', textAlign: 'center', marginBottom: '2rem', fontWeight: 'bold' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            
            {/* Student Login Card */}
            <Reveal>
              <form onSubmit={handleStudentLogin} style={{ flex: '1 1 350px', maxWidth: '400px', background: '#f5f5f5', padding: '2rem', borderRadius: '8px', borderTop: '4px solid #1D6EFF' }}>
                <h3 style={{ marginBottom: '1.5rem', color: '#0A1A33' }}>Student Access</h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>School ID</label>
                  <input 
                    type="text" 
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="Enter School ID"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password</label>
                  <input 
                    type="password" 
                    value={studentPwd}
                    onChange={(e) => setStudentPwd(e.target.value)}
                    placeholder="Enter Password"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    required
                  />
                </div>

                <button type="submit" className="btn btn--primary" style={{ width: '100%' }}>
                  Login as Student
                </button>
              </form>
            </Reveal>

            {/* Trainer Login Card */}
            <Reveal delay={100}>
              <form onSubmit={handleTeacherLogin} style={{ flex: '1 1 350px', maxWidth: '400px', background: '#f5f5f5', padding: '2rem', borderRadius: '8px', borderTop: '4px solid #C9A227' }}>
                <h3 style={{ marginBottom: '1.5rem', color: '#0A1A33' }}>Trainer Access</h3>
                
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Trainer ID</label>
                  <input 
                    type="text" 
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    placeholder="Enter Trainer ID"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password</label>
                  <input 
                    type="password" 
                    value={teacherPwd}
                    onChange={(e) => setTeacherPwd(e.target.value)}
                    placeholder="Enter Password"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    required
                  />
                </div>

                <button type="submit" className="btn btn--outline" style={{ width: '100%' }}>
                  Login as Trainer
                </button>
              </form>
            </Reveal>

          </div>
        </div>
      </section>
    </>
  )
}
