import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHead from '../components/PageHead.jsx'
import Reveal from '../components/Reveal.jsx'

async function hashText(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function Login() {
  const [studentId, setStudentId] = useState('')
  const [studentPwd, setStudentPwd] = useState('')
  
  const [teacherId, setTeacherId] = useState('')
  const [teacherPwd, setTeacherPwd] = useState('')
  
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleStudentLogin = async (e) => {
    e.preventDefault()
    const pwdHash = await hashText(studentPwd)
    if (studentId === 'ZPS' && pwdHash === '09e4ad0cc22dc74036adadc2ccefd59e83cb8e17f98adae03c0e9515ec5e773f') {
      localStorage.setItem('hub_authenticated', 'true')
      localStorage.setItem('hub_role', 'student')
      navigate('/hub')
    } else {
      setError('Invalid School ID or Password for Student Access.')
    }
  }

  const handleTeacherLogin = async (e) => {
    e.preventDefault()
    const pwdHash = await hashText(teacherPwd)
    const validHashes = [
      '89170eaf160f4e77ed7d85be58c87c1c47dc82f4b34b7175938be392faa4268b',
      'b0a7e1f40f58c51a0c87445a2b4ac470422feaf295e281e73ed360ee99dc5951'
    ]
    if (teacherId === 'adarshraj' && validHashes.includes(pwdHash)) {
      localStorage.setItem('hub_authenticated', 'true')
      localStorage.setItem('hub_role', 'teacher')
      navigate('/hub')
    } else {
      setError('Invalid Trainer ID or Password.')
    }
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PageHead
        crumb="Resource Hub Login"
        title="Secure Portal Access"
        intro="Select your portal below. Students can access view-only materials, while trainers have access to complete session packs."
      />
      
      <section style={{ padding: '4rem 1rem', flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '900px' }}>
          
          {error && (
            <div style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '1rem', borderRadius: '8px', textAlign: 'center', marginBottom: '3rem', fontWeight: '500' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            
            {/* Student Login Card */}
            <Reveal>
              <form onSubmit={handleStudentLogin} style={{ 
                flex: '1 1 380px', 
                maxWidth: '420px', 
                background: '#fff', 
                padding: '2.5rem', 
                borderRadius: '16px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                border: '1px solid #eaeaea',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#1D6EFF' }}></div>
                
                <h3 style={{ marginBottom: '0.5rem', color: '#0A1A33', fontSize: '1.4rem' }}>Student Access</h3>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '2rem' }}>Log in with your school credentials.</p>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>School ID</label>
                  <input 
                    type="text" 
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. ZPS"
                    style={{ width: '100%', padding: '0.85rem 1rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', transition: 'border-color 0.2s', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = '#1D6EFF'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    required
                  />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                  <input 
                    type="password" 
                    value={studentPwd}
                    onChange={(e) => setStudentPwd(e.target.value)}
                    placeholder="Enter Password"
                    style={{ width: '100%', padding: '0.85rem 1rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', transition: 'border-color 0.2s', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = '#1D6EFF'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    required
                  />
                </div>

                <button type="submit" className="btn btn--primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', borderRadius: '8px' }}>
                  Login to Portal
                </button>
              </form>
            </Reveal>

            {/* Trainer Login Card */}
            <Reveal delay={100}>
              <form onSubmit={handleTeacherLogin} style={{ 
                flex: '1 1 380px', 
                maxWidth: '420px', 
                background: '#fff', 
                padding: '2.5rem', 
                borderRadius: '16px', 
                boxShadow: '0 10px 25px rgba(0,0,0,0.03)',
                border: '1px solid #eaeaea',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#C9A227' }}></div>

                <h3 style={{ marginBottom: '0.5rem', color: '#0A1A33', fontSize: '1.4rem' }}>Trainer Access</h3>
                <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '2rem' }}>Secure login for instructors.</p>
                
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trainer ID</label>
                  <input 
                    type="text" 
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    placeholder="Enter Trainer ID"
                    style={{ width: '100%', padding: '0.85rem 1rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', transition: 'border-color 0.2s', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = '#C9A227'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    required
                  />
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.85rem', color: '#333', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                  <input 
                    type="password" 
                    value={teacherPwd}
                    onChange={(e) => setTeacherPwd(e.target.value)}
                    placeholder="Enter Password"
                    style={{ width: '100%', padding: '0.85rem 1rem', border: '1px solid #ddd', borderRadius: '8px', fontSize: '1rem', transition: 'border-color 0.2s', outline: 'none' }}
                    onFocus={(e) => e.target.style.borderColor = '#C9A227'}
                    onBlur={(e) => e.target.style.borderColor = '#ddd'}
                    required
                  />
                </div>

                <button type="submit" className="btn btn--outline" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', borderRadius: '8px' }}>
                  Login as Trainer
                </button>
              </form>
            </Reveal>

          </div>
        </div>
      </section>
    </div>
  )
}
