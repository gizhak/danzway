import { useRef, useEffect, useState } from 'react'
import TourOverlay from '../tour/TourOverlay'
import { flushSync } from 'react-dom'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import Navbar from './Navbar'
import Footer from './Footer'
import BottomNav from './BottomNav'
import UpdateBanner from './UpdateBanner'
import WhatsNewModal, { shouldShowWhatsNew } from './WhatsNewModal'
import { useVersionCheck } from '../../hooks/useVersionCheck'

// Pre-rendered adjacent pages during swipe (no lazy load — already eagerly bundled in App.jsx)
import HomePage        from '../../pages/HomePage'
import PartiesPage     from '../../pages/PartiesPage'
import SpecialEventsPage from '../../pages/SpecialEventsPage'
import FavoritesPage   from '../../pages/FavoritesPage'
import MapPage         from '../../pages/MapPage'

import styles from './Layout.module.css'

const TAB_ROUTES = ['/', '/parties', '/festivals', '/saved', '/map']
const TAB_PAGES  = [HomePage, PartiesPage, SpecialEventsPage, FavoritesPage, MapPage]

const DIST_THRESHOLD = 40    // px
const VEL_THRESHOLD  = 0.3   // px/ms

export default function Layout() {
  const { needsUpdate, acceptUpdate } = useVersionCheck()
  const [showWhatsNew, setShowWhatsNew] = useState(() => shouldShowWhatsNew())
  const navigate     = useNavigate()
  const location     = useLocation()
  const mainRef      = useRef(null)
  const dragX        = useMotionValue(0)
  // Derived x positions for the adjacent page (to the left or right of current)
  const leftAdjX     = useTransform(dragX, v => -window.innerWidth + v)
  const rightAdjX    = useTransform(dragX, v =>  window.innerWidth + v)
  // Dim overlay: adjacent page starts dark (0.55) and brightens as it slides into view
  const dimForLeft   = useTransform(dragX, [0, window.innerWidth],  [0.75, 0])
  const dimForRight  = useTransform(dragX, [0, -window.innerWidth], [0.75, 0])
  const navigating   = useRef(false)
  // adjacent: { Page, isLeft } — the page that peeks in during the swipe
  const [adjacent, setAdjacent] = useState(null)

  const g = useRef({ startX: 0, startY: 0, active: false, locked: null, lastX: 0, lastT: 0 })

  const currentTabIdx = TAB_ROUTES.findIndex(r =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r)
  )

  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    function onTouchStart(e) {
      if (navigating.current) return
      const t = e.touches[0]
      g.current = { startX: t.clientX, startY: t.clientY, active: true, locked: null, lastX: t.clientX, lastT: Date.now() }
    }

    function onTouchMove(e) {
      const s = g.current
      if (!s.active || navigating.current) return
      if (location.pathname === '/map') return

      const t  = e.touches[0]
      const dx = t.clientX - s.startX
      const dy = t.clientY - s.startY

      if (s.locked === null) {
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          s.locked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
          if (s.locked === 'h') {
            // Pre-render the adjacent page the moment we know swipe direction
            const isRight = dx >= 0   // swipe right = next tab
            const adjIdx  = isRight ? currentTabIdx + 1 : currentTabIdx - 1
            if (adjIdx >= 0 && adjIdx < TAB_ROUTES.length) {
              setAdjacent({ Page: TAB_PAGES[adjIdx], isLeft: isRight })
              // isLeft=true → adjacent page sits to the LEFT (enters from left when swiping right)
            }
          }
        }
        return
      }
      if (s.locked !== 'h') return

      e.preventDefault()
      s.lastX = t.clientX
      s.lastT = Date.now()
      dragX.set(dx)
    }

    function onTouchEnd(e) {
      const s = g.current
      if (!s.active || s.locked !== 'h') { s.active = false; return }
      s.active = false
      if (location.pathname === '/map') { dragX.set(0); setAdjacent(null); return }

      const t   = e.changedTouches[0]
      const dx  = t.clientX - s.startX
      const dt  = Date.now() - s.lastT
      const vel = dt > 0 ? (t.clientX - s.lastX) / dt : 0

      const isNext = dx >  DIST_THRESHOLD || vel >  VEL_THRESHOLD
      const isPrev = dx < -DIST_THRESHOLD || vel < -VEL_THRESHOLD

      if (isNext || isPrev) {
        const nextIdx = isNext ? currentTabIdx + 1 : currentTabIdx - 1
        if (currentTabIdx !== -1 && nextIdx >= 0 && nextIdx < TAB_ROUTES.length) {
          navigating.current = true
          const exitX = isNext ? window.innerWidth : -window.innerWidth

          animate(dragX, exitX, {
            type: 'tween', duration: 0.2, ease: [0.4, 0, 1, 1],
            onComplete: () => {
              // flushSync forces React to commit the new route to the DOM
              // synchronously, so dragX.set(0) snaps the correct (new) page
              // to center — not the old one.
              flushSync(() => navigate(TAB_ROUTES[nextIdx]))
              dragX.set(0)
              setAdjacent(null)
              navigating.current = false
            },
          })
          return
        }
      }

      // Not enough — spring back, then clear the adjacent page
      animate(dragX, 0, {
        type: 'spring', stiffness: 380, damping: 34,
        onComplete: () => setAdjacent(null),
      })
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [location.pathname, navigate, dragX, currentTabIdx])

  // Reset on BottomNav tap (non-swipe navigation)
  useEffect(() => {
    if (!navigating.current) {
      dragX.set(0)
      setAdjacent(null)
    }
  }, [location.pathname, dragX])

  return (
    <div className={styles.layout}>
      <Navbar />
      {needsUpdate && <UpdateBanner onRefresh={acceptUpdate} />}

      <main ref={mainRef} className={styles.main} style={{ position: 'relative', overflow: 'clip' }}>

        {/* Adjacent page — pre-rendered off-screen, slides in during swipe */}
        {adjacent && (
          <motion.div
            style={{
              position: 'absolute', inset: 0,
              x: adjacent.isLeft ? leftAdjX : rightAdjX,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div className={styles.pageContent}>
              <adjacent.Page />
            </div>
            {/* Dim overlay: hides awkward partial layouts when page is mostly off-screen */}
            <motion.div style={{
              position: 'absolute', inset: 0,
              background: '#000',
              opacity: adjacent.isLeft ? dimForLeft : dimForRight,
              pointerEvents: 'none',
            }} />
          </motion.div>
        )}

        {/* Current page */}
        <motion.div style={{ x: dragX, width: '100%' }}>
          <Outlet />
        </motion.div>

      </main>

      <Footer />
      <BottomNav />
      {showWhatsNew && !needsUpdate && <WhatsNewModal onClose={() => setShowWhatsNew(false)} />}
      <TourOverlay />
    </div>
  )
}
