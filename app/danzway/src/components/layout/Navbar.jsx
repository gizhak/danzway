import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import Drawer from './Drawer'
import styles from './Navbar.module.css'

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <header className={styles.navbar}>
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

        {/* Centered logo */}
        <NavLink to="/" className={styles.logo}>
          DanzWay
        </NavLink>

        {/* Dancer icon */}
        <span className={styles.icon} aria-hidden="true">🕺</span>
      </header>

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
