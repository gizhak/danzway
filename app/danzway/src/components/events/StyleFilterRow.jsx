import { useTranslation } from 'react-i18next'
import styles from './StyleFilterRow.module.css'

const STYLE_FILTERS = [
  {
    id:  'all',
    img: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id:  'Salsa',
    img: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id:  'Bachata',
    img: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id:  'Kizomba',
    img: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id:  'Zouk',
    img: 'https://images.unsplash.com/photo-1535525153412-5a42439a210d?auto=format&fit=crop&w=200&h=200&q=80',
  },
]

/**
 * activeFilters — string[] of currently selected styles (empty = "all")
 * onSelect     — called with the id of the tapped bubble
 */
export default function StyleFilterRow({ activeFilters = [], onSelect }) {
  const { t } = useTranslation()
  const noneSelected = activeFilters.length === 0

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {STYLE_FILTERS.map(({ id, img }) => {
          const isActive =
            id === 'all'
              ? noneSelected
              : activeFilters.includes(id)

          return (
            <button
              key={id}
              className={`${styles.bubble} ${isActive ? styles.active : ''}`}
              onClick={() => onSelect(id)}
              aria-pressed={isActive}
            >
              <div className={styles.ringWrap}>
                <div className={styles.circle}>
                  <img src={img} alt={t(`styles.${id}`)} className={styles.photo} />
                  <div className={styles.vignette} />
                </div>
              </div>
              <span className={styles.label}>{t(`styles.${id}`)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
