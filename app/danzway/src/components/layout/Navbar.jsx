// NOTE: Hamburger + Drawer are built and ready in Drawer.jsx / Navbar.module.css
// — wired back in when the side-menu feature is needed.
import { NavLink } from 'react-router-dom'
import styles from './Navbar.module.css'

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      {/* Centered logo */}
      <NavLink to="/" className={styles.logo}>
        DanzWay
      </NavLink>

      {/* Dancer icon */}
      <span className={styles.icon} aria-hidden="true">🕺</span>
    </header>
  )
}
