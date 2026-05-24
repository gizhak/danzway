import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import BottomNav from './BottomNav'
import UpdateBanner from './UpdateBanner'
import WhatsNewModal, { shouldShowWhatsNew } from './WhatsNewModal'
import { useVersionCheck } from '../../hooks/useVersionCheck'
import styles from './Layout.module.css'

export default function Layout() {
  const needsUpdate = useVersionCheck()
  const [showWhatsNew, setShowWhatsNew] = useState(() => shouldShowWhatsNew())

  return (
    <div className={styles.layout}>
      <Navbar />
      {needsUpdate && (
        <UpdateBanner onRefresh={() => window.location.reload(true)} />
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      {showWhatsNew && !needsUpdate && (
        <WhatsNewModal onClose={() => setShowWhatsNew(false)} />
      )}
    </div>
  )
}
