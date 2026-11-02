import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LMS_LOGIN_URL } from '../config/runtime.js'
import '../styles/eight-square-ai.css'

// Dots field: on hover, dots flow into an infinity (∞) shape — the "8" of 8 Square.
function InfinityDots() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const host = canvas.parentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let dots = []
    let w = 0
    let h = 0
    let raf = 0
    let morph = false
    const pointer = { x: -9999, y: -9999 }

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = host.clientWidth
      h = host.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const gap = w < 640 ? 20 : 24
      dots = []
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          dots.push({ hx: x, hy: y, x, y, tx: x, ty: y, inf: false, hue: Math.random() })
        }
      }
      // Assign every 2nd dot a slot on the lemniscate (infinity curve).
      const pick = dots.filter((_, i) => i % 2 === 0)
      const cx = w / 2
      const cy = h / 2
      const a = Math.min(w * 0.36, h * 0.7)
      pick.sort(() => Math.random() - 0.5).forEach((d, i) => {
        const t = (i / pick.length) * Math.PI * 2
        const s = Math.sin(t)
        const k = 1 + s * s
        const jitter = (Math.random() - 0.5) * 10
        d.ix = cx + (a * Math.cos(t)) / k + jitter
        d.iy = cy + (a * s * Math.cos(t)) / k + jitter
        d.inf = true
      })
    }

    const frame = () => {
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        const goInf = morph && d.inf
        d.tx = goInf ? d.ix : d.hx
        d.ty = goInf ? d.iy : d.hy
        const dx = d.x - pointer.x
        const dy = d.y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (!goInf && dist < 90) {
          const f = (90 - dist) / 90
          d.tx += (dx / (dist || 1)) * f * 18
          d.ty += (dy / (dist || 1)) * f * 18
        }
        d.x += (d.tx - d.x) * (goInf ? 0.06 : 0.12)
        d.y += (d.ty - d.y) * (goInf ? 0.06 : 0.12)
        const glow = goInf ? 1 : Math.max(0.18, 1 - dist / 220)
        const r = goInf ? 1.9 : 1.2 + (glow > 0.3 ? glow : 0)
        ctx.fillStyle = goInf
          ? `hsla(${180 + d.hue * 60}, 100%, 65%, 0.95)`
          : `hsla(${200 + d.hue * 30}, 90%, 70%, ${glow * (morph ? 0.25 : 0.7)})`
        ctx.beginPath()
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onEnter = () => { morph = true }
    const onLeave = () => { morph = false; pointer.x = -9999; pointer.y = -9999 }

    build()
    if (reduce) {
      morph = true
      dots.forEach((d) => { if (d.inf) { d.x = d.ix; d.y = d.iy } })
      frame()
      cancelAnimationFrame(raf)
    } else {
      frame()
    }
    window.addEventListener('resize', build)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('touchstart', onEnter, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerenter', onEnter)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('touchstart', onEnter)
    }
  }, [])

  return <canvas ref={canvasRef} className="esq-dots" aria-hidden="true" />
}

function Logo({ className = '' }) {
  return (
    <img className={`esq-logo ${className}`} src="/img/8square-logo.svg" alt="8 Square AI" width="320" height="96" />
  )
}

const LAB_FEATURES = [
  { t: 'Circuit Canvas', d: 'Drag parts, wire live circuits and simulate them right in the browser.' },
  { t: 'Block Coding', d: 'Program boards with Blockly blocks, then step up to real code.' },
  { t: 'Multimeter & Oscilloscope', d: 'Measure voltage, current and waveforms like in a real lab.' },
  { t: 'Serial Monitor & IoT Portal', d: 'See board output and build connected, Wi-Fi style projects.' },
  { t: 'AI Studio', d: 'Teach, try and understand AI models with camera and dataset tools.' },
  { t: 'Circuit Copilot & Doctor', d: 'A tutor chat and a live checker that spots wiring mistakes.' },
  { t: 'Lessons & Templates', d: 'Guided lessons and ready project templates to start fast.' },
  { t: 'XP & Badges', d: 'Students earn XP and badges as they complete builds.' },
]

export default function EightSquareAI() {
  return (
    <div className="esq-page">
      <section className="esq-hero">
        <InfinityDots />
        <div className="shell esq-hero__copy">
          <span className="esq-chip"><span className="esq-chip__pulse" /> Launching soon</span>
          <Logo className="esq-logo--hero" />
          <h1>Infinite ways to <span>learn, build &amp; teach.</span></h1>
          <p className="esq-lede">8 Square is Pixiu Tech&apos;s AI for the Virtual Lab — a learning partner for students and a teaching assistant for trainers.</p>
          <div className="esq-actions">
            <Link className="btn btn--primary btn--lg" to="/virtual-lab">Explore the Virtual Lab <span className="arw">→</span></Link>
            <Link className="btn btn--ghost-light" to="/contact#demo-form">Get early access</Link>
          </div>
          <p className="esq-hint">Hover the dots ∞</p>
        </div>
      </section>

      <section className="esq-band">
        <div className="shell">
          <p className="esq-eyebrow">Who it helps</p>
          <h2 className="esq-h2">One AI. Two sides of the classroom.</h2>
          <div className="esq-split">
            <article className="esq-card">
              <h3>For Students</h3>
              <ul>
                <li>Step-by-step hints while building a circuit — not just answers.</li>
                <li>Explains why an LED didn&apos;t glow or a sensor misread.</li>
                <li>Suggests the next challenge to grow creativity and skill.</li>
                <li>Practise anytime, even without a physical kit.</li>
              </ul>
            </article>
            <article className="esq-card">
              <h3>For Trainers</h3>
              <ul>
                <li>See where each student is stuck at a glance.</li>
                <li>Ready lesson ideas, quizzes and project prompts.</li>
                <li>Less time debugging wiring, more time teaching.</li>
                <li>Track progress through XP, badges and completed builds.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="esq-band esq-band--alt">
        <div className="shell">
          <p className="esq-eyebrow">Inside the Virtual Lab</p>
          <h2 className="esq-h2">Everything 8 Square works with.</h2>
          <div className="esq-grid">
            {LAB_FEATURES.map((f) => (
              <article className="esq-feature" key={f.t}>
                <span className="esq-feature__dot" aria-hidden="true" />
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="esq-band esq-cta">
        <div className="shell esq-cta__inner">
          <Logo />
          <h2 className="esq-h2">Be first in line when 8 Square goes live.</h2>
          <div className="esq-actions">
            <Link className="btn btn--primary btn--lg" to="/contact#demo-form">Talk to Pixiu Tech <span className="arw">→</span></Link>
            <a className="btn btn--ghost-light" href={LMS_LOGIN_URL}>Student Login</a>
          </div>
        </div>
      </section>
    </div>
  )
}
