import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import {
  selectStyleFilters,
  toggleStyleFilter,
  fetchEvents,
  selectEventsStatus,
  selectNextEventByVenueName,
} from '../store/appSlice'
import { selectActiveVenues, selectVenuesStatus, fetchVenues } from '../store/venuesSlice'
import StyleFilterRow from '../components/events/StyleFilterRow'
import styles from './MapPage.module.css'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const MAP_ID  = import.meta.env.VITE_GOOGLE_MAP_ID ?? 'DEMO_MAP_ID'

const DEFAULT_CENTER = { lat: 32.0853, lng: 34.7818 } // Tel Aviv
const DEFAULT_ZOOM   = 12

// Night-mode map style matching DanzWay's dark/amber theme
const DARK_MAP_STYLES = [
  { elementType: 'geometry',            stylers: [{ color: '#1a1a24' }] },
  { elementType: 'labels.icon',         stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#12121a' }] },
  { featureType: 'administrative',      elementType: 'geometry',              stylers: [{ color: '#252532' }] },
  { featureType: 'administrative.country',  elementType: 'labels.text.fill',  stylers: [{ color: '#9ca3af' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill',  stylers: [{ color: '#d1d5db' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'road',               elementType: 'geometry',              stylers: [{ color: '#2a2a38' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',       stylers: [{ color: '#12121a' }] },
  { featureType: 'road',               elementType: 'labels.text.fill',      stylers: [{ color: '#9ca3af' }] },
  { featureType: 'road.highway',       elementType: 'geometry',              stylers: [{ color: '#3d3d52' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',       stylers: [{ color: '#1d1d2a' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill',      stylers: [{ color: '#e5e7eb' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'water',             elementType: 'geometry',              stylers: [{ color: '#0a1628' }] },
  { featureType: 'water',             elementType: 'labels.text.fill',      stylers: [{ color: '#4b5563' }] },
]

function normKey(str) {
  return (str ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function getNextEvent(venue, nextEventsByVenue) {
  return (
    nextEventsByVenue[venue.name] ??
    nextEventsByVenue[normKey(venue.name)] ??
    nextEventsByVenue[venue.placeId] ??
    null
  )
}

function getDiff(dateStr) {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d - today) / 86400000)
}

// ─── Individual venue marker pin ─────────────────────────────────────────────
function VenueMarker({ venue, nextEvent, isSelected, onSetRef, onClick }) {
  const [markerRef, marker] = useAdvancedMarkerRef()

  // Stable ref to callback so the effect doesn't re-run when parent re-renders
  const cbRef = useRef(onSetRef)
  cbRef.current = onSetRef
  useEffect(() => {
    cbRef.current(marker)
    return () => cbRef.current(null)
  }, [marker])

  const diff   = getDiff(nextEvent?.date)
  const isLive = diff === 0 || diff === 1

  const pinClass = [
    styles.pin,
    isLive     ? styles.pinLive     : '',
    isSelected ? styles.pinSelected : '',
  ].join(' ')

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: venue.coordinates.lat, lng: venue.coordinates.lng }}
      onClick={onClick}
      zIndex={isSelected ? 100 : isLive ? 50 : 1}
    >
      <div className={pinClass}>
        {venue.logo
          ? <img src={venue.logo} className={styles.pinLogo} alt="" />
          : <span className={styles.pinIcon}>🎵</span>
        }
        {isLive && <span className={styles.pinPulse} />}
      </div>
    </AdvancedMarker>
  )
}

// ─── Cluster wrapper — collects marker refs and feeds them to MarkerClusterer ─
function ClusteredMarkers({ venues, nextEventsByVenue, selectedPlaceId, onMarkerClick }) {
  const map = useMap()
  const clusterer = useRef(null)
  const [markerMap, setMarkerMap] = useState({})

  useEffect(() => {
    if (!map) return
    clusterer.current = new MarkerClusterer({ map })
    return () => clusterer.current?.clearMarkers()
  }, [map])

  useEffect(() => {
    if (!clusterer.current) return
    clusterer.current.clearMarkers()
    clusterer.current.addMarkers(Object.values(markerMap).filter(Boolean))
  }, [markerMap])

  const setMarkerRef = useCallback((marker, placeId) => {
    setMarkerMap((prev) => {
      if (marker && prev[placeId] !== marker) return { ...prev, [placeId]: marker }
      if (!marker && placeId in prev) {
        const next = { ...prev }
        delete next[placeId]
        return next
      }
      return prev
    })
  }, [])

  return venues.map((venue) => {
    const nextEvent = getNextEvent(venue, nextEventsByVenue)
    return (
      <VenueMarker
        key={venue.placeId}
        venue={venue}
        nextEvent={nextEvent}
        isSelected={selectedPlaceId === venue.placeId}
        onSetRef={(m) => setMarkerRef(m, venue.placeId)}
        onClick={() => onMarkerClick(venue, nextEvent)}
      />
    )
  })
}

// ─── User location blue dot ───────────────────────────────────────────────────
function UserLocationMarker({ position }) {
  return (
    <AdvancedMarker position={position} zIndex={200}>
      <div className={styles.userDot}>
        <div className={styles.userDotCore} />
        <div className={styles.userDotRing} />
      </div>
    </AdvancedMarker>
  )
}

// ─── Bottom-sheet venue popup card ───────────────────────────────────────────
function VenuePopup({ venue, nextEvent, onClose }) {
  const diff = getDiff(nextEvent?.date)
  let eventLabel = null
  if (nextEvent?.date) {
    if (diff === 0)      eventLabel = `Tonight · ${nextEvent.time ?? ''}`
    else if (diff === 1) eventLabel = `Tomorrow · ${nextEvent.time ?? ''}`
    else {
      const d = new Date(nextEvent.date)
      eventLabel = `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${nextEvent.time ?? ''}`
    }
  }

  const mapsUrl = venue.coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${venue.coordinates.lat},${venue.coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((venue.name ?? '') + ' ' + (venue.city ?? ''))}`

  return (
    <div className={styles.popup}>
      <button className={styles.popupClose} onClick={onClose} aria-label="Close">✕</button>

      <div className={styles.popupHeader}>
        {venue.logo
          ? <img src={venue.logo} className={styles.popupLogo} alt="" />
          : <div className={styles.popupAvatar}>{(venue.name ?? '').slice(0, 2).toUpperCase()}</div>
        }
        <div className={styles.popupMeta}>
          <div className={styles.popupName}>{venue.name}</div>
          <div className={styles.popupCity}>
            📍 {venue.city}
            {venue.rating && (
              <span className={styles.popupRating}> · ★ {venue.rating.toFixed(1)}</span>
            )}
          </div>
        </div>
      </div>

      {venue.styles?.length > 0 && (
        <div className={styles.popupStyles}>
          {venue.styles.map((s) => (
            <span key={s} className={styles.popupBadge}>{s}</span>
          ))}
        </div>
      )}

      {eventLabel && (
        <div className={styles.popupEvent}>
          <div className={styles.popupEventDot} />
          <div>
            <div className={styles.popupEventTitle}>{nextEvent.title ?? 'Dance Night'}</div>
            <div className={styles.popupEventTime}>{eventLabel}</div>
          </div>
        </div>
      )}

      <div className={styles.popupActions}>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.popupDirBtn}
        >
          📍 Directions
        </a>
        <Link
          to={`/venues/${venue.placeId}`}
          className={styles.popupViewBtn}
          onClick={onClose}
        >
          View Venue →
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function MapPage() {
  const dispatch          = useDispatch()
  const styleFilters      = useSelector(selectStyleFilters)
  const activeVenues      = useSelector(selectActiveVenues)
  const venuesStatus      = useSelector(selectVenuesStatus)
  const eventsStatus      = useSelector(selectEventsStatus)
  const nextEventsByVenue = useSelector(selectNextEventByVenueName)

  const [selected,    setSelected]    = useState(null)  // { venue, nextEvent }
  const [userLocation, setUserLoc]    = useState(null)
  const [mapCenter,   setMapCenter]   = useState(DEFAULT_CENTER)

  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [venuesStatus, dispatch])

  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const loc = { lat: coords.latitude, lng: coords.longitude }
        setUserLoc(loc)
        setMapCenter(loc)
      },
      () => {}
    )
  }, [])

  // Same AND filter logic as CLUBS tab; venues without coordinates are excluded
  const filteredVenues = useMemo(() => {
    let result = activeVenues.filter((v) => v.coordinates)
    if (styleFilters.length > 0) {
      result = result.filter((v) =>
        styleFilters.every((style) =>
          (v.styles ?? []).some((s) => s.toLowerCase() === style.toLowerCase())
        )
      )
    }
    return result
  }, [activeVenues, styleFilters])

  const handleMarkerClick = useCallback((venue, nextEvent) => {
    setSelected({ venue, nextEvent })
  }, [])

  const handleClose = useCallback(() => setSelected(null), [])

  if (!API_KEY) {
    return (
      <div className={styles.errorState}>
        <div className={styles.errorIcon}>🗺️</div>
        <p className={styles.errorTitle}>Map not configured</p>
        <p className={styles.errorText}>
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to your .env.local to enable the map.
        </p>
      </div>
    )
  }

  const isLoading = venuesStatus === 'loading' || venuesStatus === 'idle'
  const countLabel = isLoading
    ? 'Loading venues…'
    : `${filteredVenues.length} verified venue${filteredVenues.length !== 1 ? 's' : ''}`

  return (
    <APIProvider apiKey={API_KEY}>
      <div className={styles.page}>

        {/* ── Full-viewport map ── */}
        <Map
          mapId={MAP_ID}
          defaultCenter={mapCenter}
          defaultZoom={DEFAULT_ZOOM}
          styles={DARK_MAP_STYLES}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={false}
          scaleControl={false}
          className={styles.map}
          onClick={handleClose}
        >
          {userLocation && <UserLocationMarker position={userLocation} />}

          <ClusteredMarkers
            venues={filteredVenues}
            nextEventsByVenue={nextEventsByVenue}
            selectedPlaceId={selected?.venue?.placeId}
            onMarkerClick={handleMarkerClick}
          />
        </Map>

        {/* ── Floating style filter bar ── */}
        <div className={styles.filterBar}>
          <StyleFilterRow
            activeFilters={styleFilters}
            onSelect={(id) => dispatch(toggleStyleFilter(id))}
          />
          <div className={styles.venueCount}>{countLabel}</div>
        </div>

        {/* ── Bottom sheet: selected venue card ── */}
        {selected && (
          <div className={styles.sheet} key={selected.venue.placeId}>
            <VenuePopup
              venue={selected.venue}
              nextEvent={selected.nextEvent}
              onClose={handleClose}
            />
          </div>
        )}

      </div>
    </APIProvider>
  )
}
