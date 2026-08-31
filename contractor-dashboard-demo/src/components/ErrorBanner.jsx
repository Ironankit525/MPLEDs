import Icon from './Icon'

export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="alert alert-danger" role="alert">
      <Icon name="alert" size={18} />
      <div className="stack" style={{ gap: 6, flex: 1 }}>
        <span>{message}</span>
        {onRetry && (
          <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={onRetry}>
            <Icon name="refresh" size={14} />
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
