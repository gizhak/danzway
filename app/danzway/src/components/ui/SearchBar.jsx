import { useTranslation } from 'react-i18next'
import styles from './SearchBar.module.css'

export default function SearchBar({ value, onChange, placeholder }) {
  const { t } = useTranslation()
  const ph = placeholder ?? t('search.placeholder')

  return (
    <div className={styles.wrapper}>
      <span className={styles.icon}>🔍</span>
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={ph}
        aria-label={t('search.ariaLabel')}
      />
      {value && (
        <button
          className={styles.clearBtn}
          onClick={() => onChange('')}
          aria-label={t('search.clear')}
        >
          ✕
        </button>
      )}
    </div>
  )
}
