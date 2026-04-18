import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

  return (
    <header className={styles.navbar}>
      <NavLink to="/" className={styles.logo}>
        DanzWay
      </NavLink>

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
