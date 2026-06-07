import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { selectHasTodaySavedEvent } from '../../store/selectors'
import { auth } from '../../services/firebase'
import { trackFeedbackClick } from '../../services/analyticsService'
import { useTour } from '../tour/TourContext'
import styles from './Navbar.module.css'

const APP_VERSION = 'beta2'

async function checkLatestVersion() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`)
    const { version } = await r.json()
    return version
  } catch {
    return null
  }
}

const PUBLIC_NAV = [
  { to: '/',          key: 'clubs',     end: true  },
  { to: '/parties',   key: 'parties',   end: false },
  { to: '/festivals', key: 'festivals', end: false },
  { to: '/saved',     key: 'saved',     end: false },
  { to: '/map',       key: 'map',       end: false },
]

const ADMIN_NAV = [
  ...PUBLIC_NAV,
  { to: '/admin/venues', key: 'venues', end: false },
]

function useLangToggle() {
  const { i18n } = useTranslation()
  const toggle = () => {
    const next = i18n.language === 'he' ? 'en' : 'he'
    i18n.changeLanguage(next)
    localStorage.setItem('danzway-lang', next)
    document.documentElement.dir  = next === 'he' ? 'rtl' : 'ltr'
    document.documentElement.lang = next
  }
  const label = i18n.language === 'he' ? 'EN' : 'עב'
  return { toggle, label }
}

export default function Navbar() {
  const { toggle, label } = useLangToggle()
  const { t } = useTranslation()
  const location = useLocation()
  const hasTodayEvent = useSelector(selectHasTodaySavedEvent)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [versionStatus, setVersionStatus] = useState(null) // null | 'checking' | 'ok' | 'update'
  const versionPopupRef = useRef(null)
  const navbarRef = useRef(null)

  useEffect(() => {
    const el = navbarRef.current
    if (!el) return
    const update = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty('--navbar-h', `${h}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { startTour } = useTour()
  const isAdmin = auth.currentUser?.email === 'guy.izhak.tech@gmail.com'
  const NAV_ITEMS = isAdmin ? ADMIN_NAV : PUBLIC_NAV

  const onSavedPage = location.pathname === '/saved'
  const pulseSaved  = hasTodayEvent && !onSavedPage

  function handleFeedbackToggle() {
    setFeedbackOpen((v) => !v)
    if (!feedbackOpen) trackFeedbackClick()
  }

  async function handleBadgeDoubleClick() {
    setVersionStatus('checking')
    const latest = await checkLatestVersion()
    setVersionStatus(latest === null ? null : latest === APP_VERSION ? 'ok' : 'update')
    setTimeout(() => setVersionStatus(null), 4000)
  }

  return (
    <header ref={navbarRef} className={styles.navbar}>
      <NavLink to="/" className={styles.logo}>
        DanzWay
        <span
          className={styles.betaBadge}
          onDoubleClick={handleBadgeDoubleClick}
          title="Double-tap to check for updates"
          ref={versionPopupRef}
        >Beta 2</span>
        {versionStatus === 'checking' && (
          <span className={styles.versionPopup}>בודק...</span>
        )}
        {versionStatus === 'ok' && (
          <span className={`${styles.versionPopup} ${styles.versionOk}`}>✓ מעודכן</span>
        )}
        {versionStatus === 'update' && (
          <span
            className={`${styles.versionPopup} ${styles.versionUpdate}`}
            onClick={() => window.location.reload(true)}
          >עדכון זמין — לחץ לרענון</span>
        )}
      </NavLink>

      <div className={styles.feedbackWrap}>
        <button
          className={styles.tourBtn}
          onClick={startTour}
          aria-label={t('tour.start')}
          title={t('tour.start')}
        >?</button>
        <button
          className={styles.feedbackBtn}
          onClick={handleFeedbackToggle}
          aria-label="Feedback"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 1H2a1 1 0 00-1 1v7a1 1 0 001 1h2.5l2 2.5L8.5 10H13a1 1 0 001-1V2a1 1 0 00-1-1z"/>
          </svg>
        </button>

        {feedbackOpen && (
          <>
            <div className={styles.feedbackBackdrop} onClick={() => setFeedbackOpen(false)} />
            <div className={styles.feedbackPopup}>
              <p className={styles.feedbackText}>{t('feedback.text')}</p>
              <a
                href="mailto:guy.izhak.tech@gmail.com"
                className={styles.feedbackEmail}
              >
                guy.izhak.tech@gmail.com
              </a>
            </div>
          </>
        )}
      </div>

      <button
        className={styles.langBtn}
        onClick={toggle}
        aria-label="Switch language"
      >
        {label}
      </button>
    </header>
  )
}
