import Icon from './Icon'

export default function EmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={40} strokeWidth={1.4} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}
