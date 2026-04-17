import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import EventDetailPage from './pages/EventDetailPage'
import ProfilePage from './pages/ProfilePage'
import MapPage from './pages/MapPage'
import PostPage from './pages/PostPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"           element={<HomePage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/profile"    element={<ProfilePage />} />
          <Route path="/map"        element={<MapPage />} />
          <Route path="/post"       element={<PostPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
