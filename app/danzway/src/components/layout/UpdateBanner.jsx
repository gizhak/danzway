import { useTranslation } from 'react-i18next'
import styles from './UpdateBanner.module.css'

export default function UpdateBanner({ onRefresh }) {
  const { t } = useTranslation()
  return (
    <div className={styles.banner}>
      <span>{t('update.message')}</span>
      <button className={styles.btn} onClick={onRefresh}>
        {t('update.action')}
      </button>
    </div>
  )
}
