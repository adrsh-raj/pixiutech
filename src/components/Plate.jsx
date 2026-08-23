// A framed image. Swap `src` for a real photograph when one is available —
// nothing else needs to change.
export default function Plate({ src, alt, caption }) {
  return (
    <figure style={{ margin: 0 }}>
      <div className="plate">
        <img src={src} alt={alt} loading="lazy" />
      </div>
      {caption && <figcaption className="plate__cap">{caption}</figcaption>}
    </figure>
  )
}
