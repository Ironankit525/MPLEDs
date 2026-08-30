import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'

const NAV_BY_ROLE = {
  submitter: [
    { to: '/contractor/upload', label: 'Upload', icon: 'upload', end: true },
    { to: '/contractor/submissions', label: 'My Submissions', icon: 'history' },
    { to: '/contractor/settings', label: 'Settings', icon: 'settings' },
  ],
  reviewer: [
    { to: '/contractor/queue', label: 'Review Queue', icon: 'inbox', end: true },
    { to: '/contractor/history', label: 'Reviewed', icon: 'history' },
    { to: '/contractor/settings', label: 'Settings', icon: 'settings' },
  ],
  stakeholder: [
    { to: '/contractor/dashboard', label: 'Dashboard', icon: 'shield', end: true },
    { to: '/contractor/reports', label: 'Reports', icon: 'history' },
    { to: '/contractor/settings', label: 'Settings', icon: 'settings' },
  ],
  admin: [
    { to: '/contractor/admin/submissions', label: 'All Submissions', icon: 'inbox', end: true },
    { to: '/contractor/admin/users', label: 'Users', icon: 'users' },
    { to: '/contractor/admin/activity', label: 'Activity', icon: 'history' },
    { to: '/contractor/upload', label: 'Upload', icon: 'upload' },
    { to: '/contractor/settings', label: 'Settings', icon: 'settings' },
  ],
}

export default function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const navItems = NAV_BY_ROLE[user?.role] || []

  return (
    <div className="app-shell">
      <Sidebar navItems={navItems} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className={`scrim${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)} />

      <div className="stack" style={{ overflowY: 'auto', height: '100vh', minWidth: 0 }}>
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={22} />
          </button>
          <div className="brand">
            <span className="brand-mark">MP</span>
            MPLADS Verify
          </div>
          <span style={{ width: 38 }} />
        </div>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
