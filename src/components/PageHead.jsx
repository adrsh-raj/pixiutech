import Reveal from './Reveal.jsx'

export default function PageHead({ crumb, title, intro, aside }) {
  return (
    <section className="page-head">
      <div className="shell page-head__grid">
        <Reveal>
          <span className="section-kicker">{crumb}</span>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </Reveal>
        {aside && <Reveal delay={100}><div className="page-head__aside">{aside}</div></Reveal>}
      </div>
    </section>
  )
}
