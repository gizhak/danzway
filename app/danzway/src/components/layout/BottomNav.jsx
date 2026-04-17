import { NavLink } from 'react-router-dom'
import useAppStore from '../../store/useAppStore'
import styles from './BottomNav.module.css'

const NAV_ITEMS = [
  { to: '/',        label: 'FEED',    icon: '⊞', end: true  },
  { to: '/map',     label: 'MAP',     icon: '📍', end: false },
  { to: '/post',    label: 'POST',    icon: '✏️', end: false },
  { to: '/profile', label: 'PROFILE', icon: '👤', end: false },
]

export default function BottomNav() {
  const savedCount = useAppStore((s) => s.savedIds.size)

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
          <span className={styles.iconWrap}>
            <span className={styles.navIcon}>{icon}</span>
            {to === '/profile' && savedCount > 0 && (
              <span className={styles.badge}>
                {savedCount > 9 ? '9+' : savedCount}
              </span>
            )}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
