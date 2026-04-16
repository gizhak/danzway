import styles from './StyleFilterRow.module.css'

const STYLE_FILTERS = [
  { id: 'all',               label: 'All',      emoji: '✨' },
  { id: 'Salsa',             label: 'Salsa',    emoji: '💃' },
  { id: 'Bachata',           label: 'Bachata',  emoji: '🌹' },
  { id: 'Kizomba',           label: 'Kizomba',  emoji: '🎶' },
  { id: 'Zouk',              label: 'Zouk',     emoji: '🌊' },
  { id: 'West Coast Swing',  label: 'WCS',      emoji: '🎵' },
  { id: 'Semba',             label: 'Semba',    emoji: '🥁' },
  { id: 'Lambada',           label: 'Lambada',  emoji: '🔥' },
]

export default function StyleFilterRow({ active = 'all', onSelect }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        {STYLE_FILTERS.map(({ id, label, emoji }) => (
          <button
            key={id}
            className={`${styles.bubble} ${active === id ? styles.active : ''}`}
            onClick={() => onSelect(id)}
            aria-pressed={active === id}
          >
            <div className={styles.circle}>
              <span>{emoji}</span>
            </div>
            <span className={styles.label}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
