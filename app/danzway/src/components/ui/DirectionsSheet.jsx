import { useTranslation } from 'react-i18next'
import styles from './DirectionsSheet.module.css'

/**
 * Bottom action sheet asking whether to open Waze or Google Maps.
 * coords: { lat, lng } — if missing, falls back to a text search query.
 */
export default function DirectionsSheet({ coords, name, onClose }) {
  const { t } = useTranslation()

  const wazeUrl = coords
    ? `waze://?ll=${coords.lat},${coords.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(name ?? '')}`

  const gmapsUrl = coords
    ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name ?? '')}`

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true">
        <div className={styles.handle} />
        <p className={styles.title}>{t('directions.title')}</p>
        <a
          href={wazeUrl}
          className={styles.option}
          onClick={onClose}
        >
          <span className={styles.optionIcon}>🗺</span>
          {t('directions.waze')}
        </a>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.option}
          onClick={onClose}
        >
          <span className={styles.optionIcon}>📍</span>
          {t('directions.googleMaps')}
        </a>
        <button className={styles.cancel} onClick={onClose}>
          {t('directions.cancel')}
        </button>
      </div>
    </>
  )
}
