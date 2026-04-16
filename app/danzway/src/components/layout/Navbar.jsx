import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <NavLink to="/" className={styles.logo}>
        Danz<span>Way</span>
      </NavLink>

      <nav className={styles.nav}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
          }
        >
          Events
        </NavLink>
      </nav>
    </header>
  )
}
