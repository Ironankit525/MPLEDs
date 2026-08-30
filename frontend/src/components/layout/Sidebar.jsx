import { NavLink } from 'react-router-dom'
import Icon from '../Icon'
import { useAuth } from '../../context/AuthContext'

/**
 * Reusable role-aware sidebar shell. `navItems` is passed in per role
 * (only the Submitter's set exists today) so the same component can
 * back the Reviewer/Stakeholder/Admin shells later without a rewrite.
 */
export default function Sidebar({ navItems, isOpen, onClose }) {
  const { user, logout } = useAuth()

  return (
    <aside className={`sidebar${isOpen ? ' is-open' : ''}`}>
      <div className="spread">
        <div className="brand">
          <span className="brand-mark">MP</span>
          MPLADS Verify
        </div>
        <button type="button" className="icon-btn" onClick={onClose} style={{ display: isOpen ? undefined : 'none' }}>
          <Icon name="close" size={20} />
          <span className="visually-hidden">Close menu</span>
        </button>
      </div>

      <nav className="nav-list" aria-label="Primary">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
            onClick={onClose}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <span className="user-avatar">{(user?.username || '?').slice(0, 2)}</span>
          <div className="user-meta">
            <div className="name">{user?.username}</div>
            <div className="role">{user?.role}</div>
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-block" onClick={logout}>
          <Icon name="logout" size={16} />
          Log out
        </button>
      </div>
    </aside>
  )
}
