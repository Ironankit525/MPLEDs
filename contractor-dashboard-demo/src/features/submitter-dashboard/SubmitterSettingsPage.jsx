import { useAuth } from '../../context/AuthContext'
import Icon from '../../components/Icon'

function formatAccountName(username) {
  const localPart = (username || 'Account').split('@')[0].replace(/\d+$/, '')
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const username = user?.username || '—'
  const accountName = formatAccountName(user?.username)

  return (
    <div className="min-h-screen bg-[#f8fafc] p-5">
      <div className="page-header">
        <div>
          <h1 className="!text-slate-900">Settings</h1>
          <p>Your account details.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm" style={{ maxWidth: 480 }}>
        <div className="flex items-center gap-3 bg-slate-50/80 p-5">
          <span className="user-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>
            {username.slice(0, 2)}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account holder</p>
            <h2 className="mt-0.5 text-base font-bold !text-slate-900">{accountName}</h2>
            <p className="mt-1 break-all text-sm font-medium !text-slate-800">{username}</p>
            <p className="mt-1 text-xs capitalize text-slate-500">{user?.role}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-200 p-5 sm:grid-cols-2">
          <Row label="Agency" value={user?.agency_name || '—'} />
          <Row label="District" value={user?.district || '—'} />
        </div>
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
    <div className="rounded-none border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-bold !text-slate-900">{value}</p>
    </div>
  )
}
