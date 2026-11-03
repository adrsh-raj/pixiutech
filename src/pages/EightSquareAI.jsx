import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LMS_LOGIN_URL } from '../config/runtime.js'
import '../styles/eight-square-ai.css'

// 8 Square signature visual: a 3D particle ribbon tracing an infinity (∞) loop.
// Particles drift as a loose cloud and lock into a crisp, flowing ∞ on hover.
function InfinityDots() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const host = canvas.parentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const N = window.innerWidth < 700 ? 900 : 1600
    const parts = Array.from({ length: N }, () => ({
      t: Math.random() * Math.PI * 2,
      phi: Math.random() * Math.PI * 2,
      rr: Math.pow(Math.random(), 0.6),
      sp: 0.0016 + Math.random() * 0.0024,
      cx: (Math.random() - 0.5) * 2.4,
      cy: (Math.random() - 0.5) * 1.4,
      cz: (Math.random() - 0.5) * 1.6,
      x: 0, y: 0, z: 0, init: false,
    }))
    let w = 0, h = 0, raf = 0, focus = 0, focusTarget = 0.6
    const rot = { x: -0.35, y: 0, tx: -0.35, ty: 0 }
    let time = 0

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = host.clientWidth; h = host.clientHeight
      canvas.width = w * dpr; canvas.height = h * dpr
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const frame = () => {
      time += 1
      focus += (focusTarget - focus) * 0.04
      rot.x += (rot.tx - rot.x) * 0.05
      rot.y += (rot.ty + Math.sin(time * 0.004) * 0.35 - rot.y) * 0.05
      ctx.clearRect(0, 0, w, h)
      const S = Math.min(w * 0.42, h * 0.62)
      const cyx = Math.cos(rot.y), syx = Math.sin(rot.y)
      const cxr = Math.cos(rot.x), sxr = Math.sin(rot.x)
      const tube = 0.09 + (1 - focus) * 0.12
      for (const p of parts) {
        p.t += p.sp * (0.6 + focus * 1.4)
        const s = Math.sin(p.t), c = Math.cos(p.t), k = 1 + s * s
        // Lemniscate of Bernoulli + gentle depth twist
        let lx = c / k, ly = (s * c) / k, lz = Math.sin(p.t * 2) * 0.12
        const o = p.rr * tube
        lx += Math.cos(p.phi) * o * 0.4
        ly += Math.sin(p.phi) * o
        lz += Math.cos(p.phi + p.t) * o
        // blend between loose cloud and the ∞ form
        const f = focus
        const gx = lx * f + p.cx * 0.6 * (1 - f)
        const gy = ly * f + p.cy * 0.6 * (1 - f)
        const gz = lz * f + p.cz * 0.6 * (1 - f)
        if (!p.init) { p.x = gx; p.y = gy; p.z = gz; p.init = true }
        p.x += (gx - p.x) * 0.08; p.y += (gy - p.y) * 0.08; p.z += (gz - p.z) * 0.08
        // rotate Y then X
        const x1 = p.x * cyx + p.z * syx
        const z1 = -p.x * syx + p.z * cyx
        const y1 = p.y * cxr - z1 * sxr
        const z2 = p.y * sxr + z1 * cxr
        const persp = 2.6 / (2.6 + z2)
        const sx = w / 2 + x1 * S * persp
        const sy = h / 2 + y1 * S * persp
        const depth = Math.min(1, Math.max(0, (1 - z2) / 2))
        const a = (0.3 + depth * 0.7) * (0.5 + f * 0.5)
        const r = (0.7 + depth * 1.3) * persp
        ctx.fillStyle = depth > 0.62
          ? `rgba(236,244,255,${a})`
          : `rgba(110,190,255,${a * 0.85})`
        ctx.fillRect(sx - r / 2, sy - r / 2, r, r)
      }
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e) => {
      const rect = host.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width - 0.5
      const ny = (e.clientY - rect.top) / rect.height - 0.5
      rot.ty = nx * 0.9
      rot.tx = -0.35 + ny * 0.6
    }
    const onEnter = () => { focusTarget = 1 }
    const onLeave = () => { focusTarget = 0.6; rot.tx = -0.35; rot.ty = 0 }

    size()
    if (reduce) { focus = focusTarget = 1; frame(); cancelAnimationFrame(raf) } else frame()
    window.addEventListener('resize', size)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerenter', onEnter)
    host.addEventListener('pointerleave', onLeave)
    host.addEventListener('touchstart', onEnter, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', size)
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
  { t: 'Real-time Circuit Solver', d: 'Every wire you place is solved live using Kirchhoff\u2019s current and voltage laws, so node voltages and branch currents behave like real hardware.' },
  { t: 'Instrument-grade Measurement', d: 'A virtual multimeter and oscilloscope sample signals over time, so students read RMS values, frequency, duty cycle and noise, not just on/off.' },
  { t: 'Embedded Firmware Runtime', d: 'Block code and text code run on a simulated microcontroller with timers, PWM, ADC and interrupts, exposing how firmware actually drives hardware.' },
  { t: 'Sensors, Signals & IoT', d: 'Model analog sensors, debounce inputs, filter noisy readings and push data over a virtual network to a live web dashboard.' },
  { t: 'AI Studio', d: 'Collect a dataset from the camera, train a model, then inspect accuracy, confidence and misclassifications to understand how machines learn.' },
  { t: 'Circuit Doctor', d: 'Continuously checks for shorts, floating inputs, reverse polarity and overcurrent, and explains the physics of why a design fails.' },
  { t: 'Guided Engineering Lessons', d: 'Structured lessons and project templates progress from fundamentals to complete systems such as automation, robotics and smart devices.' },
  { t: 'Progress, XP & Badges', d: 'Every build, measurement and fix is recorded, giving students momentum and trainers a clear picture of mastery.' },
]

const SCIENCE = [
  { q: 'Why does this motor stall at startup?', a: 'Explains stall current, back-EMF and why a driver transistor and flyback diode are needed, then shows the current spike on the oscilloscope.' },
  { q: 'Why is my sensor reading jumping around?', a: 'Walks through ADC resolution, sampling rate and electrical noise, and helps the student design a moving-average or RC filter.' },
  { q: 'How does PWM control brightness or speed?', a: 'Connects duty cycle to average voltage and power, and lets the student measure the waveform to prove it.' },
  { q: 'Why did my AI model confuse two objects?', a: 'Uses the confusion matrix and dataset balance to show bias, overfitting and how better data improves results.' },
]

export default function EightSquareAI() {
  return (
    <div className="esq-page">
      <section className="esq-hero">
        <div className="shell esq-hero__grid">
          <div className="esq-hero__copy">
            <span className="esq-chip"><span className="esq-chip__pulse" /> 8 Square AI · Launching soon</span>
            <h1>Engineering intelligence,<br /><span>built for how students learn.</span></h1>
            <p className="esq-lede">8 Square is an AI model designed and developed in-house by the Pixiu Tech team. Native to the Pixiu Virtual Lab, it reads the live circuit, reasons about the physics behind it and guides every learner, while giving trainers a real-time view of understanding.</p>
            <div className="esq-actions">
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">Request early access <span className="arw">→</span></Link>
              <Link className="btn btn--ghost-light" to="/virtual-lab">Explore the Virtual Lab</Link>
            </div>
            <dl className="esq-meta">
              <div><dt>Model</dt><dd>8 Square · v1</dd></div>
              <div><dt>Built by</dt><dd>Pixiu Tech</dd></div>
              <div><dt>Status</dt><dd>Private preview</dd></div>
            </dl>
          </div>
          <div className="esq-visual">
            <InfinityDots />
            <span className="esq-visual__label">Move your cursor here</span>
          </div>
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
                <li>Socratic, step-by-step guidance that builds reasoning instead of handing out answers.</li>
                <li>Explains the science behind each result: Ohm&apos;s law, power, signals, timing and data.</li>
                <li>Connects classroom theory to real engineering decisions and trade-offs.</li>
                <li>Recommends the next challenge to stretch creativity and problem-solving.</li>
                <li>Practise anytime, anywhere, without waiting for a physical kit.</li>
              </ul>
            </article>
            <article className="esq-card">
              <h3>For Trainers</h3>
              <ul>
                <li>Live view of where each learner is stuck and the concept behind it.</li>
                <li>Auto-generated lesson plans, viva questions and project briefs.</li>
                <li>Common design errors flagged before they waste lab time.</li>
                <li>Mastery reports built from real builds, measurements and fixes.</li>
                <li>More time mentoring, less time debugging wiring.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="esq-band esq-band--alt">
        <div className="shell esq-about">
          <div>
            <p className="esq-eyebrow">Built by Pixiu Tech</p>
            <h2 className="esq-h2">Designed in-house, for Indian classrooms.</h2>
          </div>
          <div className="esq-about__body">
            <p>8 Square has been dedicatedly developed by the Pixiu Tech engineering and curriculum team, the same people who set up school innovation labs and teach weekly sessions on the ground. Every capability comes from real classroom questions our trainers hear every day.</p>
            <p>It is trained around our own Robotics, AI, IoT and electronics curriculum, aligned to CBSE, ICSE and State boards, and tightly integrated with the Pixiu Virtual Lab and Learning Portal, so guidance is always grounded in what the student is actually building.</p>
            <div className="esq-stats">
              <div><strong>In-house</strong><span>Engineering &amp; AI</span></div>
              <div><strong>Curriculum</strong><span>Mapped to boards</span></div>
              <div><strong>Lab-native</strong><span>Sees the live circuit</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="esq-band">
        <div className="shell">
          <p className="esq-eyebrow">The science behind the build</p>
          <h2 className="esq-h2">Questions real engineers ask. Answered with reasoning.</h2>
          <div className="esq-qa">
            {SCIENCE.map((x) => (
              <article className="esq-card" key={x.q}>
                <h3>{x.q}</h3>
                <p>{x.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="esq-band esq-band--alt">
        <div className="shell">
          <p className="esq-eyebrow">Inside the Virtual Lab</p>
          <h2 className="esq-h2">A complete engineering lab, with 8 Square inside.</h2>
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
