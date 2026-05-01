import { useTranslation } from 'react-i18next'
import styles from './DirectionsSheet.module.css'

export default function DirectionsSheet({ coords, name, onClose }) {
  const { t } = useTranslation()

  const wazeUrl = coords
    ? `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(name ?? '')}&navigate=yes`

  const gmapsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name ?? '')}`

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.handle} />
        <p className={styles.title}>{t('directions.title')}</p>

        <a
          href={wazeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.option}
          onClick={onClose}
        >
          <div className={styles.optionText}>
            <span className={styles.optionName}>Waze</span>
            <span className={styles.optionSub}>{t('directions.wazeSubtitle', 'Navigation & live traffic')}</span>
          </div>
          <span className={styles.optionArrow}>›</span>
        </a>

        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.option}
          onClick={onClose}
        >
          <div className={styles.optionText}>
            <span className={styles.optionName}>Google Maps</span>
            <span className={styles.optionSub}>{t('directions.gmapsSubtitle', 'Maps & directions')}</span>
          </div>
          <span className={styles.optionArrow}>›</span>
        </a>

        <button className={styles.cancel} onClick={onClose}>
          {t('directions.cancel')}
        </button>
      </div>
    </>
  )
}
