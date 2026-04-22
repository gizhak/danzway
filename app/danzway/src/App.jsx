import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import EventDetailPage from './pages/EventDetailPage'
import MapPage from './pages/MapPage'
import VenueDiscoveryPage from './pages/admin/VenueDiscoveryPage'
import VenueDetailPage from './pages/VenueDetailPage'
import PartiesPage from './pages/PartiesPage'
import { useEventsSync } from './hooks/useEventsSync'

// Post and Profile are disabled until launch — imports kept for future re-activation.
// import ProfilePage from './pages/ProfilePage'
// import PostPage from './pages/PostPage'

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

export default function App() {
  useEventsSync()
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                element={<HomePage />} />
          <Route path="/parties"         element={<PartiesPage />} />
          <Route path="/venues/:placeId" element={<VenueDetailPage />} />
          <Route path="/events/:id"      element={<EventDetailPage />} />
          <Route path="/map"             element={<MapPage />} />

          {/* Post and Profile: routes redirect to home until features are ready */}
          <Route path="/post"    element={<Navigate to="/" replace />} />
          <Route path="/profile" element={<Navigate to="/" replace />} />

          {/* Admin only — guarded both by env flag and by route presence */}
          {IS_ADMIN && (
            <Route path="/admin/venues" element={<VenueDiscoveryPage />} />
          )}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
