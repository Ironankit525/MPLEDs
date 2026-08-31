import { useAuth } from '../context/AuthContext'
import Icon from '../components/Icon'

export default function SettingsPage() {
  const { user, logout } = useAuth()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Your account details.</p>
        </div>
      </div>

      <div className="card card-padded stack" style={{ gap: 16, maxWidth: 480 }}>
        <div className="cluster" style={{ gap: 14 }}>
          <span className="user-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
            {(user?.username || '?').slice(0, 2)}
          </span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{user?.username}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>
        </div>

        <hr className="divider" style={{ margin: 0 }} />

        <Row label="Agency" value={user?.agency_name || '—'} />
        <Row label="District" value={user?.district || '—'} />
      </div>

      <button type="button" className="btn btn-secondary" style={{ marginTop: 20 }} onClick={logout}>
        <Icon name="logout" size={16} />
        Log out
      </button>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="spread">
      <span style={{ fontSize: 14, color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{value}</span>
    </div>
  )
}
