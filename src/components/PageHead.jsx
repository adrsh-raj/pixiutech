export default function PageHead({ crumb, title, intro }) {
  return (
    <section className="phead">
      <div className="shell">
        <p className="phead__crumb">{crumb}</p>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
    </section>
  )
}
