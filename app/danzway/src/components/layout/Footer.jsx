import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        © 2026 <span>DanzWay</span> — Find your next dance event.
      </p>
    </footer>
  )
}
