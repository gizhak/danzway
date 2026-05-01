import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { trackFeedbackClick } from '../../services/analyticsService'
import styles from './Navbar.module.css'

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
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  function handleFeedbackToggle() {
    setFeedbackOpen((v) => !v)
    if (!feedbackOpen) trackFeedbackClick()
  }

  return (
    <header className={styles.navbar}>
      <NavLink to="/" className={styles.logo}>
        DanzWay
        <span className={styles.betaBadge}>Beta</span>
      </NavLink>

      <div className={styles.feedbackWrap}>
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
              <p className={styles.feedbackText}>שאלות או בעיות? צרו קשר:</p>
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
