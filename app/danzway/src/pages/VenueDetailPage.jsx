import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { selectAllVenues, fetchVenues } from '../store/venuesSlice'
import { selectNextEventByVenueName } from '../store/appSlice'
import { getFullVenueDetails } from '../services/googlePlaces'
import Badge from '../components/ui/Badge'
import styles from './VenueDetailPage.module.css'

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

const GENERIC_IMAGE =
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function extractHandle(url = '') {
  if (!url) return null
  if (!url.includes('/')) return url.replace(/^@/, '')
  return url
    .replace(/.*instagram\.com\//, '')
    .replace(/.*facebook\.com\//, '')
    .replace(/\/$/, '')
    .split('?')[0]
}

function extractIgPostCode(postUrl = '') {
  const m = postUrl?.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

export default function VenueDetailPage() {
  const { placeId }       = useParams()
  const dispatch          = useDispatch()
  const venues            = useSelector(selectAllVenues)
  const nextEventsByVenue = useSelector(selectNextEventByVenueName)
  const venue             = venues.find((v) => v.placeId === placeId)
  const [toastMsg,    setToastMsg]    = useState('')
  const [refreshing,  setRefreshing]  = useState(false)

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const details = await getFullVenueDetails(placeId)
      if (!details) { showToast('⚠️ Venue not found on Google'); return }

      // Preserve admin-managed fields — only refresh Google data
      const { active, logo, styles: venueStyles, instagramPostUrl, ...googleData } = details
      await setDoc(
        doc(db, 'venues', placeId),
        { ...googleData, lastRefreshed: serverTimestamp() },
        { merge: true }
      )
      dispatch(fetchVenues())
      showToast('✓ Venue refreshed from Google!')
    } catch (err) {
      console.error('[VenueDetailPage] refresh error:', err)
      showToast('⚠️ Could not refresh venue')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleShare() {
    const shareData = {
      title: venue?.name ?? 'Dance Club',
      text: `${venue?.name} — ${venue?.city ?? ''}`,
      url: window.location.href,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(window.location.href)
      showToast('🔗 Link copied!')
    }
  }

  if (!venue) {
    return (
      <div className={styles.notFound}>
        <p>Venue not found.</p>
        <Link to="/" className={styles.backLink}>← Back to feed</Link>
      </div>
    )
  }

  const {
    name,
    city,
    address,
    logo,
    photos = [],
    styles: danceStyles = [],
    categories = [],
    rating,
    reviewCount,
    phone,
    website,
    instagram,
    facebook,
    instagramPostUrl,
    coordinates,
  } = venue

  // Hero: first Google photo or generic — logo is NEVER stretched here
  const heroImage  = photos[0] ?? GENERIC_IMAGE
  const gallery    = photos.length > 1 ? photos.slice(1, 6) : []

  const mapsUrl = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (city ?? ''))}`

  const mapEmbedUrl = coordinates
    ? `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${coordinates.lat},${coordinates.lng}&zoom=15`
    : `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(name + ' ' + (city ?? ''))}&zoom=15`

  const igHandle   = extractHandle(instagram)
  const fbHandle   = extractHandle(facebook)
  const igPostCode = extractIgPostCode(instagramPostUrl)

  // Try: exact name → normalised name → placeId (covers imported Hebrew names)
  const normName  = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  const nextEvent = nextEventsByVenue[name] ?? nextEventsByVenue[normName] ?? nextEventsByVenue[placeId] ?? null
  let badgeMonth = null, badgeDay = null, badgeLabel = null
  if (nextEvent?.date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const evDate = new Date(nextEvent.date); evDate.setHours(0, 0, 0, 0)
    const diff = Math.round((evDate - today) / 86400000)
    if (diff === 0)      badgeLabel = 'Tonight'
    else if (diff === 1) badgeLabel = 'Tomorrow'
    else {
      badgeMonth = evDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
      badgeDay   = evDate.getDate()
    }
  }

  const categoryLine = categories.slice(0, 2).join(' · ')

  return (
    <div className={styles.page}>

      {/* ── Header: Back + Share ── */}
      <div className={styles.header}>
        <Link to="/" className={styles.back}>
          <span className={styles.backArrow}>←</span>
          <span>Back</span>
        </Link>
        <button className={styles.shareFab} onClick={handleShare} aria-label="Share venue">
          <ShareIcon />
        </button>
      </div>

      {/* ── Hero ── */}
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <img src={heroImage} alt={name} className={styles.heroImg} />
        <div className={styles.heroOverlay} />

        {/* Date badge — top-right */}
        {nextEvent && (
          <div className={styles.dateBadge}>
            {badgeLabel ? (
              <>
                <div className={styles.dateBadgeMonth}>NEXT</div>
                <div className={styles.dateBadgeLabelSmall}>{badgeLabel}</div>
              </>
            ) : (
              <>
                <div className={styles.dateBadgeMonth}>{badgeMonth}</div>
                <div className={styles.dateBadgeDay}>{badgeDay}</div>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Content ── */}
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Logo + name */}
        <div className={styles.titleRow}>
          {logo && <img src={logo} alt={name} className={styles.logoAvatar} />}
          <h1 className={styles.title}>{name}</h1>
        </div>

        {/* Meta rows */}
        <div className={styles.meta}>
          {address && (
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>📍</span>
              <span>{address}</span>
            </div>
          )}
          {phone && (
            <a href={`tel:${phone}`} className={styles.metaRow}>
              <span className={styles.metaIcon}>📞</span>
              <span>{phone}</span>
            </a>
          )}
          {rating && (
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>★</span>
              <span>{rating.toFixed(1)}{reviewCount > 0 ? ` · ${reviewCount.toLocaleString()} reviews` : ''}</span>
            </div>
          )}
          {categoryLine && (
            <div className={styles.metaRow}>
              <span className={styles.metaIcon}>🎵</span>
              <span>{categoryLine}</span>
            </div>
          )}
        </div>

        {/* Dance style badges */}
        {danceStyles.length > 0 && (
          <div className={styles.badges}>
            {danceStyles.map((s) => <Badge key={s} label={s} />)}
          </div>
        )}

        {/* Photo gallery strip */}
        {gallery.length > 0 && (
          <div className={styles.gallery}>
            {gallery.map((url, i) => (
              <img key={i} src={url} alt={`${name} ${i + 2}`} className={styles.galleryPhoto} loading="lazy" />
            ))}
          </div>
        )}

        <div className={styles.divider} />

        {/* Map */}
        {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
          <div className={styles.mapCard}>
            <iframe
              title="venue-map"
              src={mapEmbedUrl}
              className={styles.mapIframe}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
              Open in Google Maps →
            </a>
          </div>
        ) : (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapCardFallback}>
            <div className={styles.mapVisual}><span>📍</span></div>
            <div className={styles.mapInfo}>
              <div className={styles.mapVenue}>{name}</div>
              <div className={styles.mapCity}>{city}</div>
              <div className={styles.mapCta}>View on Google Maps →</div>
            </div>
          </a>
        )}

        {/* Instagram post embed */}
        {igPostCode && (
          <div className={styles.igEmbedWrapper}>
            <iframe
              src={`https://www.instagram.com/p/${igPostCode}/embed/`}
              className={styles.igEmbedFrame}
              frameBorder="0"
              scrolling="no"
              allowTransparency="true"
              title="Instagram post"
            />
          </div>
        )}

        {/* Social buttons */}
        {(igHandle || fbHandle || (instagramPostUrl && !igPostCode)) && (
          <div className={styles.socialRow}>
            {igHandle && (
              <a href={`https://instagram.com/${igHandle}`} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                <span>📸</span> Instagram
              </a>
            )}
            {fbHandle && (
              <a href={`https://facebook.com/${fbHandle}`} target="_blank" rel="noopener noreferrer" className={`${styles.socialBtn} ${styles.socialBtnFb}`}>
                <span>👍</span> Facebook
              </a>
            )}
            {instagramPostUrl && !igPostCode && (
              <a href={instagramPostUrl} target="_blank" rel="noopener noreferrer" className={styles.socialBtn}>
                <span>🎉</span> Special Post
              </a>
            )}
          </div>
        )}

        {/* Website (only if not a social media link) */}
        {website && !website.includes('instagram') && !website.includes('facebook') && (
          <a href={website} target="_blank" rel="noopener noreferrer" className={styles.websiteBtn}>
            🌐 Visit Website
          </a>
        )}

        {/* Admin: Refresh from Google Places */}
        {IS_ADMIN && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={styles.adminRefreshBtn}
          >
            {refreshing ? '⏳ Refreshing…' : '↻ Refresh Venue from Google'}
          </button>
        )}

      </motion.div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key={toastMsg}
            className={styles.toast}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
