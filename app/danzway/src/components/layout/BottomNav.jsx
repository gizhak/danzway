import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { selectHasTodaySavedEvent, selectHasAnySaved } from '../../store/selectors'
import styles from './BottomNav.module.css'

import { auth } from "../../services/firebase";

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

// Post and Profile are hidden until launch — routes remain registered but tabs are not shown.
// Re-add them to NAV_ITEMS when the features are ready.
const PUBLIC_NAV = [
  { to: '/', key: 'clubs', icon: '⊞', end: true },
  { to: '/parties', key: 'parties', icon: '🎉', end: false },
  { to: '/saved', key: 'saved', icon: '♥', end: false },
  { to: '/map', key: 'map', icon: '📍', end: false },
]

const ADMIN_NAV = [
  ...PUBLIC_NAV,
  { to: '/admin/venues', key: 'venues', icon: '🏛', end: false },
]

export default function BottomNav() {
  const { t } = useTranslation()
  const location = useLocation()
  const hasTodayEvent = useSelector(selectHasTodaySavedEvent)
  const hasAnySaved   = useSelector(selectHasAnySaved)

  const currentUser = auth.currentUser
  const isAdmin = currentUser?.email === 'guy.izhak.tech@gmail.com'
  const NAV_ITEMS = isAdmin ? ADMIN_NAV : PUBLIC_NAV

  const onSavedPage = location.pathname === '/saved'
  const pulseSaved  = hasTodayEvent && !onSavedPage
  const filledHeart = hasAnySaved

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      {NAV_ITEMS.map(({ to, key, icon, end }) => {
        const isSaved = key === 'saved'
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
            }
          >
            <span className={styles.pill}>
              <span className={styles.iconWrap}>
                <span className={[
                  styles.navIcon,
                  isSaved && pulseSaved  ? styles.heartPulse   : '',
                  isSaved && filledHeart && !pulseSaved ? styles.heartFilled : '',
                ].filter(Boolean).join(' ')}>
                  {isSaved ? (filledHeart ? '♥' : '♡') : icon}
                </span>
              </span>
              <span className={styles.label}>{t(`nav.${key}`)}</span>
            </span>
          </NavLink>
        )
      })}
    </nav>
  )
}
