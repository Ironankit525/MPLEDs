import React, { useState } from 'react'
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
    { to: '/app/ai-report', label: 'AI Report', icon: 'spark' },
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleShortcutAction = (actionId) => {
    if (actionId === 'add-project') {
      window.location.href = '/app/upload'
    } else if (actionId === 'generate-report') {
      alert('Generating consolidated MPLADS Analytics and Utilization report...')
    } else if (actionId === 'view-alerts') {
      window.location.href = '/app/ai-risk-monitor'
    } else if (actionId === 'download-data') {
      alert('Preparing full CSV/Excel data export of MPLADS project metrics...')
    }
  }

  return (
    <div className={`mplads-app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Dark Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onActionClick={handleShortcutAction}
      />

      <div className="app-frame stack">
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

        {/* Dynamic Page Outlet */}
        <main className="mplads-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
