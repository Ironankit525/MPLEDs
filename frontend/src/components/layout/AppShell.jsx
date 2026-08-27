import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'

const NAV_BY_ROLE = {
  submitter: [
    { to: '/app/upload', label: 'Upload', icon: 'upload', end: true },
    { to: '/app/submissions', label: 'My Submissions', icon: 'history' },
    { to: '/app/settings', label: 'Settings', icon: 'settings' },
  ],
  reviewer: [
    { to: '/app/queue', label: 'Review Queue', icon: 'inbox', end: true },
    { to: '/app/history', label: 'Reviewed', icon: 'history' },
    { to: '/app/settings', label: 'Settings', icon: 'settings' },
  ],
  stakeholder: [
    { to: '/app/dashboard', label: 'Dashboard', icon: 'shield', end: true },
    { to: '/app/reports', label: 'Reports', icon: 'history' },
    { to: '/app/settings', label: 'Settings', icon: 'settings' },
  ],
  admin: [
    { to: '/app/admin/submissions', label: 'All Submissions', icon: 'inbox', end: true },
    { to: '/app/admin/users', label: 'Users', icon: 'users' },
    { to: '/app/admin/activity', label: 'Activity', icon: 'history' },
    { to: '/app/upload', label: 'Upload', icon: 'upload' },
    { to: '/app/settings', label: 'Settings', icon: 'settings' },
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

      <div className="stack">
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
