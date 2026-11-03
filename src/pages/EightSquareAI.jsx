import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LMS_LOGIN_URL } from '../config/runtime.js'
import '../styles/eight-square-ai.css'

const PREVIEW_ANSWER = 'The LED is reversed in this sample build: its cathode is facing the +5 V side. Flip the LED so its anode connects to +5 V through R1 (220 Ω), and its cathode returns to ground. Then run the circuit again and compare.'
const PREVIEW_STEPS = ['Read circuit', 'Check physics', 'Prepare a hint']

function SquareMark({ small = false }) {
  return (
    <span className={small ? 'esq-mark esq-mark--small' : 'esq-mark'} aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
    </span>
  )
}

function CircuitChatPreview() {
  const [phase, setPhase] = useState('reading')
  const [answer, setAnswer] = useState('')
  const [run, setRun] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('done')
      setAnswer(PREVIEW_ANSWER)
      return undefined
    }
    setPhase('reading')
    setAnswer('')
    const timers = []
    timers.push(window.setTimeout(() => setPhase('checking'), 1100))
    timers.push(window.setTimeout(() => setPhase('preparing'), 2250))
    timers.push(window.setTimeout(() => {
      setPhase('typing')
      let index = 0
      const interval = window.setInterval(() => {
        index = Math.min(index + 4, PREVIEW_ANSWER.length)
        setAnswer(PREVIEW_ANSWER.slice(0, index))
        if (index >= PREVIEW_ANSWER.length) {
          window.clearInterval(interval)
          setPhase('done')
        }
      }, 24)
      timers.push(interval)
    }, 3150))
    return () => timers.forEach((timer) => {
      window.clearTimeout(timer)
      window.clearInterval(timer)
    })
  }, [run])

  const stageIndex = phase === 'reading' ? 0 : phase === 'checking' ? 1 : phase === 'done' ? 3 : 2
  const phaseLabel = {
    reading: 'Reading your circuit…',
    checking: 'Checking the physics…',
    preparing: 'Preparing a step-by-step hint…',
    typing: 'Writing the explanation…',
    done: 'Explanation ready',
  }[phase]

  return (
    <section className="esq-demo" aria-label="Guided 8 Square AI preview">
      <header className="esq-demo__top">
        <div className="esq-demo__brand"><SquareMark small /><div><strong>8 Square</strong><span>AI learning guide</span></div></div>
        <span className="esq-demo__badge"><i /> Guided preview</span>
      </header>
      <div className="esq-demo__columns">
        <div className="esq-circuit">
          <div className="esq-demo__section-head"><span>LAB SNAPSHOT</span><strong>LED circuit</strong></div>
          <div className="esq-circuit__board">
            <svg className="esq-circuit__svg" viewBox="0 0 260 150" role="img" aria-labelledby="esq-circuit-title">
              <title id="esq-circuit-title">Sample circuit with a 5 volt supply, a 220 ohm resistor, and an LED</title>
              <path className="esq-circuit__wire" d="M57 60H69M127 60H151M195 60H227V126H57V94" />
              <rect className="esq-circuit__supply" x="13" y="43" width="44" height="52" rx="8" />
              <text className="esq-circuit__label" x="35" y="63" textAnchor="middle">5 V</text>
              <text className="esq-circuit__micro" x="35" y="78" textAnchor="middle">SUPPLY</text>
              <text className="esq-circuit__terminal" x="57" y="52" textAnchor="middle">+</text>
              <text className="esq-circuit__terminal" x="57" y="108" textAnchor="middle">−</text>
              <rect className="esq-circuit__resistor" x="69" y="47" width="58" height="26" rx="6" />
              <text className="esq-circuit__label" x="98" y="64" textAnchor="middle">220 Ω</text>
              <circle className={stageIndex >= 1 ? 'esq-circuit__led-ring is-checked' : 'esq-circuit__led-ring'} cx="173" cy="60" r="18" />
              <circle className={stageIndex >= 1 ? 'esq-circuit__led-core is-checked' : 'esq-circuit__led-core'} cx="173" cy="60" r="7" />
              <text className="esq-circuit__micro" x="173" y="98" textAnchor="middle">LED</text>
              <text className="esq-circuit__ground" x="227" y="140" textAnchor="middle">GND</text>
              <circle className="esq-circuit__node" cx="57" cy="60" r="3" />
              <circle className="esq-circuit__node" cx="227" cy="126" r="3" />
            </svg>
          </div>
          <div className="esq-readouts">
            <div><span>Supply</span><strong>5.0 V</strong></div>
            <div><span>Series resistor</span><strong>220 Ω</strong></div>
            <div className={stageIndex >= 1 ? 'esq-readouts__alert is-active' : 'esq-readouts__alert'}><span>LED polarity</span><strong>Reversed</strong></div>
          </div>
        </div>
        <div className="esq-chat">
          <p className="esq-chat__context">STUDENT QUESTION</p>
          <div className="esq-chat__question">Why isn’t my LED turning on?</div>
          <div className="esq-chat__assistant">
            <div className="esq-chat__assistant-head"><SquareMark small /><strong>8 Square</strong><span>•</span><span>Lab guide</span></div>
            <div className="esq-progress">
              <p className="esq-progress__status" role="status" aria-live="polite">{phaseLabel}</p>
              <div className="esq-progress__steps" aria-hidden="true">
                {PREVIEW_STEPS.map((step, index) => <span className={index < stageIndex ? 'is-complete' : index === stageIndex ? 'is-current' : ''} key={step} />)}
              </div>
            </div>
            <p className="esq-chat__answer">{answer}{phase === 'typing' && <span className="esq-chat__cursor" aria-hidden="true" />}</p>
            {phase === 'done' && <div className="esq-chat__observation"><span /> Observation from this sample: LED polarity is reversed</div>}
          </div>
        </div>
      </div>
      <footer className="esq-demo__footer">
        <span>Guided sample · Request early access to the live experience</span>
        <button type="button" onClick={() => setRun((value) => value + 1)}><span aria-hidden="true">↻</span> Replay preview</button>
      </footer>
    </section>
  )
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
            <Logo className="esq-logo--hero" />
            <span className="esq-chip"><span className="esq-chip__pulse" /> Private preview · Built by Pixiu Tech</span>
            <h1>Build with 8 Square AI.<br /><span>Understand every step.</span></h1>
            <p className="esq-lede">An AI learning companion inside the Pixiu Virtual Lab. Students can explore circuits, ask why something happened, and get step-by-step hints grounded in the build they are working on.</p>
            <div className="esq-actions">
              <Link className="btn btn--primary btn--lg" to="/contact#demo-form">Request early access <span className="arw">→</span></Link>
              <Link className="btn btn--ghost-light" to="/virtual-lab">Explore the Virtual Lab</Link>
            </div>
            <dl className="esq-meta">
              <div><dt>Designed for</dt><dd>Hands-on learning</dd></div>
              <div><dt>Built by</dt><dd>Pixiu Tech</dd></div>
              <div><dt>Access</dt><dd>Private preview</dd></div>
            </dl>
          </div>
          <CircuitChatPreview />
        </div>
      </section>

      <section className="esq-loop">
        <div className="shell">
          <p className="esq-eyebrow">A learning loop that works</p>
          <h2 className="esq-loop__title">From first build to a better next question.</h2>
          <div className="esq-loop__grid">
            <article><span>01</span><h3>Build</h3><p>Start with a lesson or bring a circuit idea into the browser-based Virtual Lab.</p></article>
            <article><span>02</span><h3>Ask 8 Square</h3><p>Ask what happened. Get a hint connected to the circuit and the concept behind it.</p></article>
            <article><span>03</span><h3>Try again</h3><p>Make a change, run the circuit, and see how your next experiment behaves.</p></article>
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
            <p>8 Square has been developed by Pixiu Tech’s engineering and curriculum team, the same people who set up school innovation labs and teach weekly sessions. Its capabilities are shaped by real classroom questions our trainers hear every day.</p>
            <p>It is trained around Pixiu Tech’s Robotics, AI, IoT and electronics curriculum, aligned with CBSE, ICSE and State boards, and integrated with the Pixiu Virtual Lab and Learning Portal, so guidance stays connected to what the student is building.</p>
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
