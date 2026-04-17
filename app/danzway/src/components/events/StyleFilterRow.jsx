import styles from './StyleFilterRow.module.css'

const STYLE_FILTERS = [
  {
    id: 'all',
    label: 'כל הסגנונות',
    img: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'Salsa',
    label: 'סלסה',
    img: 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'Bachata',
    label: "באצ'טה",
    img: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'Kizomba',
    label: 'קיזומבה',
    img: 'https://images.unsplash.com/photo-1545128485-c400e7702796?auto=format&fit=crop&w=200&h=200&q=80',
  },
  {
    id: 'Zouk',
    label: 'זוק',
    img: 'https://images.unsplash.com/photo-1535525153412-5a42439a210d?auto=format&fit=crop&w=200&h=200&q=80',
  },
]

/**
 * activeFilters — string[] of currently selected styles (empty = "all")
 * onSelect     — called with the id of the tapped bubble
 */
export default function StyleFilterRow({ activeFilters = [], onSelect }) {
  const noneSelected = activeFilters.length === 0

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {STYLE_FILTERS.map(({ id, label, img }) => {
          const isActive =
            id === 'all'
              ? noneSelected                    // "all" active when nothing selected
              : activeFilters.includes(id)      // style active when in array

          return (
            <button
              key={id}
              className={`${styles.bubble} ${isActive ? styles.active : ''}`}
              onClick={() => onSelect(id)}
              aria-pressed={isActive}
            >
              <div className={styles.ringWrap}>
                <div className={styles.circle}>
                  <img src={img} alt={label} className={styles.photo} />
                  <div className={styles.vignette} />
                </div>
              </div>
              <span className={styles.label}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
