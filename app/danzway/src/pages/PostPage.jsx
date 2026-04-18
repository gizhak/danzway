import { useTranslation } from 'react-i18next'
import styles from './ComingSoon.module.css'

export default function PostPage() {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <div className={styles.icon}>✏️</div>
      <h2 className={styles.title}>{t('post.title')}</h2>
      <p className={styles.text}>{t('post.subtitle')}</p>
    </div>
  )
}
