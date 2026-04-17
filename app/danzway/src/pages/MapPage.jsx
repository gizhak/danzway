import styles from './ComingSoon.module.css'

export default function MapPage() {
  return (
    <div className={styles.page}>
      <div className={styles.icon}>🗺️</div>
      <h2 className={styles.title}>Map View</h2>
      <p className={styles.text}>Coming soon — find events near you on an interactive map.</p>
    </div>
  )
}
