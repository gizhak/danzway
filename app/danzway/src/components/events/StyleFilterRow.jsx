import styles from './StyleFilterRow.module.css'

// Unsplash dance photos — swap `img` for your own asset path when ready
// e.g.: img: '/assets/filters/salsa.jpg'
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

export default function StyleFilterRow({ active = 'all', onSelect }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {STYLE_FILTERS.map(({ id, label, img }) => (
          <button
            key={id}
            className={`${styles.bubble} ${active === id ? styles.active : ''}`}
            onClick={() => onSelect(id)}
            aria-pressed={active === id}
          >
            <div className={styles.ringWrap}>
              <div className={styles.circle}>
                <img src={img} alt={label} className={styles.photo} />
                {/* Subtle inner dark vignette so the edges blend into background */}
                <div className={styles.vignette} />
              </div>
            </div>
            <span className={styles.label}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
