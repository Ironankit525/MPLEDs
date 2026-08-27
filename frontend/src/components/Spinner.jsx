export default function Spinner({ label = 'Loading…' }) {
  return (
    <div className="loading-block" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}
