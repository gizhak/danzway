import styles from './ComingSoon.module.css'

export default function PostPage() {
  return (
    <div className={styles.page}>
      <div className={styles.icon}>✏️</div>
      <h2 className={styles.title}>Post an Event</h2>
      <p className={styles.text}>Coming soon — list your dance event and reach the community.</p>
    </div>
  )
}
