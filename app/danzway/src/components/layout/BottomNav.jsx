import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

const NAV_ITEMS = [
  { to: '/',       label: 'FEED',    icon: '⊞',  end: true  },
  { to: '/map',    label: 'MAP',     icon: '📍',  end: false },
  { to: '/post',   label: 'POST',    icon: '✏️',  end: false },
  { to: '/profile',label: 'PROFILE', icon: '👤',  end: false },
]

export default function BottomNav() {
  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {NAV_ITEMS.map(({ to, label, icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
          }
        >
          <span className={styles.navIcon}>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
