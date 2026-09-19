// Layout wrapper kept for API compatibility. Marketing pages should remain stable and readable
// without forcing visitors to wait for content to fade in while scrolling.
export default function Reveal({ children, className = '', ...rest }) {
  return <div className={className} {...rest}>{children}</div>
}
