import { Link } from 'react-router-dom'
import { LMS_LOGIN_URL } from '../config/runtime.js'
import '../styles/virtual-lab-ai.css'

function CircuitArtwork() {
  return (
    <div className="vlai-art">
      <div className="vlai-art__halo vlai-art__halo--one" />
      <div className="vlai-art__halo vlai-art__halo--two" />
      <svg className="vlai-circuit" viewBox="0 0 620 480" fill="none" role="img" aria-labelledby="vlai-circuit-title">
        <title id="vlai-circuit-title">Circuit paths flowing into an AI learning node</title>
        <path className="vlai-trace vlai-trace--slow" d="M24 102H182L242 162H308" />
        <path className="vlai-trace" d="M24 240H160L210 190H308" />
        <path className="vlai-trace vlai-trace--slow" d="M24 378H178L236 320H308" />
        <path className="vlai-trace" d="M596 102H438L378 162H312" />
        <path className="vlai-trace vlai-trace--slow" d="M596 240H460L410 190H312" />
        <path className="vlai-trace" d="M596 378H442L384 320H312" />
        <path className="vlai-trace vlai-trace--dim" d="M310 24V126M310 354V456" />
        <circle className="vlai-node vlai-node--blue" cx="24" cy="102" r="6" />
        <circle className="vlai-node vlai-node--blue" cx="24" cy="240" r="6" />
        <circle className="vlai-node vlai-node--blue" cx="24" cy="378" r="6" />
        <circle className="vlai-node vlai-node--mint" cx="596" cy="102" r="6" />
        <circle className="vlai-node vlai-node--mint" cx="596" cy="240" r="6" />
        <circle className="vlai-node vlai-node--mint" cx="596" cy="378" r="6" />
        <circle className="vlai-node vlai-node--blue" cx="310" cy="24" r="6" />
        <circle className="vlai-node vlai-node--mint" cx="310" cy="456" r="6" />
        <circle className="vlai-core-ring" cx="310" cy="240" r="112" />
        <circle className="vlai-core-ring vlai-core-ring--inner" cx="310" cy="240" r="87" />
        <circle className="vlai-core" cx="310" cy="240" r="68" />
        <path className="vlai-chip" d="M285 218h50v44h-50zM298 206v12m24-12v12m-24 44v12m24-12v12m-49-44h12m50 0h12m-74 20h12m50 0h12" />
        <circle className="vlai-chip-light" cx="310" cy="240" r="6" />
        <circle className="vlai-particle" cx="184" cy="162" r="4" />
        <circle className="vlai-particle vlai-particle--delay" cx="436" cy="320" r="4" />
      </svg>
      <div className="vlai-ai-pill"><span className="vlai-ai-pill__spark">✦</span><span>AI learning support</span><span className="vlai-ai-pill__live">LIVE</span></div>
      <div className="vlai-art-caption"><span className="vlai-art-caption__dot" /> Learn by building, wherever you are</div>
    </div>
  )
}

export default function VirtualLabAI() {
  return (
    <div className="vlai-page">
      <section className="vlai-hero">
        <div className="vlai-hero__grid" aria-hidden="true" />
        <div className="shell vlai-hero__layout">
          <div className="vlai-hero__copy">
            <p className="vlai-kicker"><span /> PIXIU TECH · DIGITAL PRACTICALS</p>
            <h1>Build it.<br /><span>Test it.</span><br />Understand it.</h1>
            <p className="vlai-hero__intro">A virtual lab for students to practise circuits and design projects online—with AI learning support built in.</p>
            <p className="vlai-hero__support">Keep learning moving, even when physical hardware is not in reach.</p>
            <div className="vlai-hero__actions">
              <a className="btn btn--primary btn--lg" href={LMS_LOGIN_URL}>Go to Student Login <span className="arw">→</span></a>
              <Link className="btn btn--ghost-light" to="/contact#demo-form">For Schools</Link>
            </div>
            <div className="vlai-hero__note"><span className="vlai-note-check">✓</span> Browser-based practice <span className="vlai-note-divider" /> No kit needed for every practice session</div>
          </div>
          <CircuitArtwork />
        </div>
        <a className="vlai-scroll-cue" href="#what-it-is"><span /> Scroll to explore</a>
      </section>

      <section className="vlai-intro band" id="what-it-is">
        <div className="shell vlai-intro__layout">
          <div>
            <p className="eyebrow">A practical learning space</p>
            <h2 className="h-sect">Real skills can start on screen.</h2>
          </div>
          <div className="vlai-intro__body">
            <p className="lede">The Virtual Lab gives students an online space to build and test circuit ideas for practical learning. They can practise without needing physical hardware for every activity.</p>
            <p className="vlai-intro__ai"><span className="vlai-ai-star">✦</span><span><strong>AI is part of the learning system.</strong> It can explain concepts, offer hints, and help students reason through circuit problems as they learn.</span></p>
          </div>
        </div>
      </section>

      <section className="vlai-flow band band--gray" aria-labelledby="vlai-flow-title">
        <div className="shell">
          <p className="eyebrow">Learn through practice</p>
          <h2 className="h-sect" id="vlai-flow-title">From first idea to confident understanding.</h2>
          <div className="vlai-flow__steps">
            <article className="vlai-step">
              <span className="vlai-step__number">01</span>
              <span className="vlai-step__icon vlai-step__icon--blue" aria-hidden="true">⌘</span>
              <h3>Build</h3>
              <p>Bring a circuit or project idea to life in the online lab.</p>
            </article>
            <div className="vlai-flow__connector" aria-hidden="true"><span /></div>
            <article className="vlai-step">
              <span className="vlai-step__number">02</span>
              <span className="vlai-step__icon vlai-step__icon--mint" aria-hidden="true">↗</span>
              <h3>Experiment</h3>
              <p>Try changes, see what happens, and practise at your own pace.</p>
            </article>
            <div className="vlai-flow__connector" aria-hidden="true"><span /></div>
            <article className="vlai-step">
              <span className="vlai-step__number">03</span>
              <span className="vlai-step__icon vlai-step__icon--violet" aria-hidden="true">✦</span>
              <h3>Understand</h3>
              <p>Use AI explanations and hints to make sense of each result.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="vlai-cta band on-dark gridfield">
        <div className="shell vlai-cta__inner">
          <div>
            <p className="eyebrow">Learning without limits</p>
            <h2 className="h-sect">Bring virtual practical learning to your students.</h2>
            <p className="lede">Ask us how the Virtual Lab and AI learning support can fit your school programme.</p>
          </div>
          <Link className="btn btn--primary btn--lg" to="/contact#demo-form">Talk to Pixiu Tech <span className="arw">→</span></Link>
        </div>
      </section>
    </div>
  )
}
