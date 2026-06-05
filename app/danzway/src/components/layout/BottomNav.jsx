import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { selectHasTodaySavedEvent, selectHasAnySaved } from '../../store/selectors'
import styles from './BottomNav.module.css'
import { auth } from '../../services/firebase'

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

function IconVenues() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}

function IconParties() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  )
}

function IconSpecials() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

function IconSaved({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function IconMap() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
      <line x1="8" y1="2" x2="8" y2="18"/>
      <line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  )
}

function IconAdmin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="1"/>
      <path d="M16 21V7a4 4 0 0 0-8 0v14"/>
    </svg>
  )
}

const PUBLIC_NAV = [
  { to: '/',          key: 'clubs',     Icon: IconVenues,   end: true  },
  { to: '/parties',   key: 'parties',   Icon: IconParties,  end: false },
  { to: '/festivals', key: 'festivals', Icon: IconSpecials, end: false },
  { to: '/saved',     key: 'saved',     Icon: IconSaved,    end: false },
  { to: '/map',       key: 'map',       Icon: IconMap,      end: false },
]

const ADMIN_NAV = [
  ...PUBLIC_NAV,
  { to: '/admin/venues', key: 'venues', Icon: IconAdmin, end: false },
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
      {NAV_ITEMS.map(({ to, key, Icon, end }) => {
        const isSaved = key === 'saved'
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            data-tour={`tab-${key}`}
            className={({ isActive }) =>
              isActive ? `${styles.navItem} ${styles.active}` : styles.navItem
            }
          >
            <span className={styles.pill}>
              <span className={styles.iconWrap}>
                <span className={[
                  styles.navIcon,
                  isSaved && pulseSaved          ? styles.heartPulse   : '',
                  isSaved && filledHeart && !pulseSaved ? styles.heartFilled : '',
                ].filter(Boolean).join(' ')}>
                  {isSaved ? <IconSaved filled={filledHeart} /> : <Icon />}
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
