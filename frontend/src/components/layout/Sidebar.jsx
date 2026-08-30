import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  IndianRupee,
  ShieldAlert,
  Bell,
  LineChart,
  MapPin,
  Building2,
  CheckSquare,
  FileText,
  DownloadCloud,
  Settings,
  HelpCircle,
  FolderPlus,
  FileSpreadsheet,
  AlertTriangle,
  Download,
  X,
} from 'lucide-react'
import NationalEmblem from './NationalEmblem'

export default function Sidebar({ isOpen, isCollapsed, onClose, onActionClick }) {
  const location = useLocation()

  const mainNav = [
    { to: '/app/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/app/projects/MP-BR-205-412', label: 'Projects', icon: FolderKanban, activeMatch: '/app/projects' },
    { to: '/app/financials', label: 'Financials', icon: IndianRupee },
    { to: '/app/ai-risk-monitor', label: 'AI Risk Monitor', icon: ShieldAlert },
    { to: '/app/alerts', label: 'Alerts & Notifications', icon: Bell, badge: 12, badgeType: 'danger' },
    { to: '/app/analytics', label: 'Analytics & Trends', icon: LineChart },
    { to: '/app/map-view', label: 'Map View', icon: MapPin },
    { to: '/app/agency-performance', label: 'Agency Performance', icon: Building2 },
    { to: '/app/compliance', label: 'Compliance', icon: CheckSquare },
    { to: '/app/reports', label: 'Reports', icon: FileText },
    { to: '/app/data-export', label: 'Data Export', icon: DownloadCloud },
    { to: '/app/settings', label: 'Settings', icon: Settings },
    { to: '/app/help', label: 'Help & Support', icon: HelpCircle },
  ]

  const shortcuts = [
    { id: 'add-project', label: 'Add New Project', icon: FolderPlus },
    { id: 'generate-report', label: 'Generate Report', icon: FileSpreadsheet },
    { id: 'view-alerts', label: 'View AI Alerts', icon: AlertTriangle },
    { id: 'download-data', label: 'Download Data', icon: Download },
  ]

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`mplads-sidebar ${isOpen ? 'is-open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Brand / Logo Header */}
        <div className="sidebar-brand-header">
          <div className="brand-emblem-wrap">
            <NationalEmblem size={34} className="emblem-svg" />
          </div>
          <div className="brand-text-wrap">
            <h1 className="brand-title">MPLADS</h1>
            <p className="brand-subtitle">AI-Powered Monitoring &amp; Analytics Platform</p>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Navigation Scroll Area */}
        <div className="sidebar-nav-scroll">
          <nav className="sidebar-nav-group" aria-label="Main Navigation">
            {mainNav.map((item) => {
              const IconComp = item.icon
              const isItemActive = item.activeMatch
                ? location.pathname.startsWith(item.activeMatch) || location.pathname === item.to
                : location.pathname === item.to

              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={`sidebar-nav-link ${isItemActive ? 'is-active' : ''}`}
                  onClick={onClose}
                >
                  <IconComp size={18} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.badge && (
                    <span className={`nav-badge nav-badge-${item.badgeType || 'default'}`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Quick Shortcuts Section */}
          <div className="sidebar-shortcuts-section">
            <h3 className="shortcuts-heading">Quick Shortcuts</h3>
            <div className="shortcuts-list">
              {shortcuts.map((sc) => {
                const ScIcon = sc.icon
                return (
                  <button
                    key={sc.id}
                    type="button"
                    className="shortcut-btn"
                    onClick={() => {
                      if (onActionClick) onActionClick(sc.id)
                      if (onClose) onClose()
                    }}
                  >
                    <ScIcon size={16} className="shortcut-icon" />
                    <span className="shortcut-label">{sc.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
