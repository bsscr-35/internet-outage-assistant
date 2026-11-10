import { NavLink } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Gauge,
  LifeBuoy,
  LogIn,
  LogOut,
  MapPinned,
  Network,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  X,
} from 'lucide-react'

const navigation = [
  { label: 'Dashboard', path: '/', icon: Gauge },
  { label: 'Outages', path: '/outages', icon: BellRing },
  { label: 'Report outage', path: '/report', icon: PlusCircle },
  { label: 'Locations', path: '/locations', icon: MapPinned },
  { label: 'Network Components', path: '/components', icon: Network },
  { label: 'Impact Analysis', path: '/impacts', icon: Activity },
  { label: 'Recovery Management', path: '/recovery', icon: LifeBuoy },
  { label: 'Recovery Logs', path: '/recovery-logs', icon: ScrollText },
  { label: 'Service Verification', path: '/verification', icon: ShieldCheck },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
]

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose, user, onSignOut }) {
  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="sidebar-backdrop"
          onClick={onClose}
          type="button"
        />
      )}
      <aside
        className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
      >
        <div className="brand">
          <button
            aria-label="Close navigation"
            className="icon-button mobile-close"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="nav-section-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
              end={path === '/'}
              key={path}
              onClick={onClose}
              title={collapsed ? label : undefined}
              to={path}
            >
              <Icon className="nav-icon" size={18} strokeWidth={1.8} />
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-account">
          {user ? (
            <>
              <span className="sidebar-account-name" title={user.email}>{user.userName}</span>
              <button className="sidebar-account-button" onClick={onSignOut} type="button">
                <LogOut size={14} /> <span>Sign out</span>
              </button>
            </>
          ) : (
            <NavLink className="sidebar-account-button" onClick={onClose} to="/login">
              <LogIn size={14} /> <span>Sign in</span>
            </NavLink>
          )}
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-status">
          <div className="sidebar-status-copy">
            <span>Live operations data</span>
            <small>Live database records</small>
          </div>
        </div>
        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="collapse-button"
          onClick={onToggle}
          type="button"
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          <span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
        </button>
      </aside>
    </>
  )
}
