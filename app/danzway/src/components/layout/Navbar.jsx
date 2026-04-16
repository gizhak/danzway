import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Drawer from './Drawer'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className={styles.navbar}>
        <NavLink to="/" className={styles.logo}>
          Danz<span>Way</span>
        </NavLink>

        {/* Desktop nav */}
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

        {/* Hamburger — mobile only */}
        <button
          className={`${styles.hamburger} ${drawerOpen ? styles.open : ''}`}
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
