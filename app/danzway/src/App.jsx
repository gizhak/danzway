import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import EventDetailPage from './pages/EventDetailPage'
import ProfilePage from './pages/ProfilePage'
import MapPage from './pages/MapPage'
import PostPage from './pages/PostPage'
import VenueDiscoveryPage from './pages/admin/VenueDiscoveryPage'
import VenueDetailPage from './pages/VenueDetailPage'

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"                 element={<HomePage />} />
          <Route path="/venues/:placeId"  element={<VenueDetailPage />} />
          <Route path="/events/:id"       element={<EventDetailPage />} />
          <Route path="/profile"          element={<ProfilePage />} />
          <Route path="/map"              element={<MapPage />} />
          <Route path="/post"             element={<PostPage />} />
          {IS_ADMIN && (
            <Route path="/admin/venues" element={<VenueDiscoveryPage />} />
          )}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
