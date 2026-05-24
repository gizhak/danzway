import { useTranslation } from 'react-i18next'
import styles from './WhatsNewModal.module.css'

const WHATS_NEW_VERSION = 'beta2'
const STORAGE_KEY = 'danzway-whats-new-seen'

export function shouldShowWhatsNew() {
  return localStorage.getItem(STORAGE_KEY) !== WHATS_NEW_VERSION
}

export function markWhatsNewSeen() {
  localStorage.setItem(STORAGE_KEY, WHATS_NEW_VERSION)
}

export default function WhatsNewModal({ onClose }) {
  const { t } = useTranslation()

  function handleClose() {
    markWhatsNewSeen()
    onClose()
  }

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.badge}>{t('whatsNew.badge')}</div>
        <h2 className={styles.title}>{t('whatsNew.title')}</h2>
        <ul className={styles.list}>
          {t('whatsNew.items', { returnObjects: true }).map((item, i) => (
            <li key={i} className={styles.item}>
              <span className={styles.check}>✓</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
        <button className={styles.btn} onClick={handleClose}>
          {t('whatsNew.cta')}
        </button>
      </div>
    </div>
  )
}
