import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  ChevronDown,
  Bell,
  User,
  Menu,
  ChevronRight,
  ArrowLeft,
  Check,
} from 'lucide-react'

export default function Header({
  onMenuToggle,
  breadcrumbs = [
    { label: 'Projects', to: '/app/projects' },
    { label: 'Project Details', to: null },
  ],
}) {
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState('2026-27')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const financialYears = ['2026-27', '2025-26', '2024-25', '2023-24']

  return (
    <header className="mplads-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-trigger"
          onClick={onMenuToggle}
          aria-label="Open sidebar navigation"
        >
          <Menu size={20} />
        </button>

        <nav className="header-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/app/projects" className="breadcrumb-back-arrow" aria-label="Go back to projects">
            <ArrowLeft size={16} />
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.label}>
              {idx > 0 && <ChevronRight size={14} className="breadcrumb-sep" />}
              {crumb.to ? (
                <Link to={crumb.to} className="breadcrumb-item breadcrumb-link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumb-item breadcrumb-active" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="header-right">
        {/* Financial Year Selector Dropdown */}
        <div className="dropdown-container">
          <button
            type="button"
            className="fy-selector-btn"
            onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
            aria-expanded={yearDropdownOpen}
          >
            <Calendar size={15} className="fy-icon" />
            <span className="fy-label">
              Financial Year <strong className="fy-val">{selectedYear}</strong>
            </span>
            <ChevronDown size={14} className={`fy-chevron ${yearDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {yearDropdownOpen && (
            <div className="dropdown-panel fy-dropdown-menu">
              <div className="dropdown-title">Select Financial Year</div>
              {financialYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  className={`dropdown-option ${yr === selectedYear ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedYear(yr)
                    setYearDropdownOpen(false)
                  }}
                >
                  <span>FY {yr}</span>
                  {yr === selectedYear && <Check size={14} className="check-icon" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Icon Button */}
        <div className="notification-btn-wrap">
          <button
            type="button"
            className="icon-circle-btn notification-bell-btn"
            aria-label="View notifications (6 new)"
          >
            <Bell size={18} />
            <span className="notification-counter-badge">6</span>
          </button>
        </div>

        {/* User Profile Pill */}
        <div className="user-profile-dropdown-wrap">
          <button
            type="button"
            className="user-profile-pill"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-expanded={userMenuOpen}
          >
            <div className="user-avatar-circle">
              <User size={16} />
            </div>
            <div className="user-info-text">
              <span className="user-name">Admin User</span>
              <span className="user-dept">Ministry of Statistics</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  )
}
