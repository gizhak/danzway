import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import EventDetailPage from './pages/EventDetailPage'
import MapPage from './pages/MapPage'
import VenueDiscoveryPage from './pages/admin/VenueDiscoveryPage'
import VenueDetailPage from './pages/VenueDetailPage'
import PartiesPage from './pages/PartiesPage'
import FavoritesPage from './pages/FavoritesPage'
import { useEventsSync } from './hooks/useEventsSync'
import { trackPageView } from './services/analyticsService'

// Post and Profile are disabled until launch — imports kept for future re-activation.
// import ProfilePage from './pages/ProfilePage'
// import PostPage from './pages/PostPage'

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

const PAGE_TITLES = {
  '/':             'Home',
  '/parties':      'Parties',
  '/saved':        'Saved',
  '/map':          'Map',
  '/admin/venues': 'Admin',
}

function PageTracker() {
  const location = useLocation()
  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] ?? location.pathname
    trackPageView(location.pathname, title)
  }, [location.pathname])
  return null
}

export default function App() {
  useEventsSync()
  return (
    <BrowserRouter>
      <PageTracker />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                element={<HomePage />} />
          <Route path="/parties"         element={<PartiesPage />} />
          <Route path="/venues/:placeId" element={<VenueDetailPage />} />
          <Route path="/events/:id"      element={<EventDetailPage />} />
          <Route path="/map"             element={<MapPage />} />
          <Route path="/saved"           element={<FavoritesPage />} />

          {/* Post and Profile: routes redirect to home until features are ready */}
          <Route path="/post"    element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<Navigate to="/" replace />} />
        </Route>

        {/* Admin — standalone, no Layout wrapper (full-screen dashboard) */}
        {IS_ADMIN && (
          <Route path="/admin/venues" element={<VenueDiscoveryPage />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
