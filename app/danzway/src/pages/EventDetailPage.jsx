import { useState, useEffect } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { selectAllEvents, selectEventsStatus, fetchEvents } from '../store/appSlice'
import { selectSpecialEventsByVenueMap } from '../store/selectors'
import { refreshVenueMetadata } from '../services/googlePlaces'
import { shortMonthDay } from '../i18n/dateUtils'
import Badge from '../components/ui/Badge'
import styles from './EventDetailPage.module.css'

const IS_ADMIN = import.meta.env.VITE_IS_ADMIN === 'true'

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

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.spinnerIcon}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

export default function EventDetailPage() {
  const dispatch      = useDispatch()
  const navigate      = useNavigate()
  const { id }        = useParams()
  const { t, i18n }  = useTranslation()
  const events               = useSelector(selectAllEvents)
  const eventsStatus         = useSelector(selectEventsStatus)
  const specialEventsByVenue = useSelector(selectSpecialEventsByVenueMap)
  const event                = events.find((e) => e.id === id)

  const [toastMsg,   setToastMsg]   = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [lightbox,   setLightbox]   = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Fetch events if store is empty (direct link / page refresh)
  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  if (eventsStatus === 'idle' || eventsStatus === 'loading') {
    return <p className={styles.notFound}>{t('eventDetail.loading')}</p>
  }

  // Recurring virtual events are never in Firestore — redirect to the venue page
  const recurringMatch = id?.match(/^(.+)-rec-\d+-\d{4}-\d{2}-\d{2}$/)
  if (recurringMatch) {
    return <Navigate to={`/venues/${recurringMatch[1]}`} replace />
  }

  if (!event) {
    return <p className={styles.notFound}>{t('eventDetail.notFound')}</p>
  }

  const {
    title,
    date,
    time,
    location,
    venue,
    placeId,
    styles: danceStyles,
    image,
    placePhoto,
    description,
    price,
    currency,
    whatsapp,
    isSpecial,
  } = event

  // If this event's venue has an active festival, show its flyer (only for non-special events)
  const venueSpecialEvent = (!isSpecial && placeId)
    ? (specialEventsByVenue[placeId] ?? null)
    : null

  // Special events: show flyer (image) first. Others: prefer Places photo.
  const heroImage = (isSpecial && image) ? image : (placePhoto || image || null)

  const parsedDate = new Date(date)
  const { month, day } = shortMonthDay(date, i18n.language)

  const locale = i18n.language === 'he' ? 'he-IL' : 'en-US'
  const formattedDate = parsedDate.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const waMessage = encodeURIComponent(
    t('event.waMessage', { title, venue, location, date, time })
  )
  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${venue}, ${location}`)}`

  async function handleShare() {
    const shareData = {
      title,
      text: `${title} — ${formattedDate} at ${venue}, ${location}`,
      url: window.location.href,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled — do nothing
      }
    } else {
      await navigator.clipboard.writeText(window.location.href)
      showToast(t('eventDetail.linkCopied'))
    }
  }

  async function handleRefreshMetadata() {
    setRefreshing(true)
    try {
      // ── Step 1: fetch from Google Places ──
      const { placeId, placePhoto: newPhoto } = await refreshVenueMetadata(event)
      if (!placeId && !newPhoto) {
        showToast(t('eventDetail.notFoundGoogle'))
        return
      }
      // ── Step 2: write to Firestore ──
      try {
        await updateDoc(doc(db, 'events', event.id), { placeId, placePhoto: newPhoto })
        dispatch(fetchEvents())
        showToast(t('eventDetail.photoUpdated'))
      } catch (firestoreErr) {
        console.error('[RefreshMetadata] Firestore write failed:', firestoreErr)
        showToast(t('eventDetail.writeError'))
      }
    } catch (placesErr) {
      console.error('[RefreshMetadata] Places API error:', placesErr)
      showToast(t('eventDetail.fetchError'))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className={styles.page}>

      {/* ── Header row: Back + Share ── */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/festivals')}>
          <span className={styles.backArrow}>{t('eventDetail.backArrow')}</span>
          <span>{t('eventDetail.back')}</span>
        </button>
        <button className={styles.shareFab} onClick={handleShare} aria-label="Share event">
          <ShareIcon />
        </button>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && heroImage && (
        <div className={styles.lightboxBackdrop} onClick={() => setLightbox(false)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>✕</button>
          <img src={heroImage} alt={title} className={styles.lightboxImg} onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── Hero image ── */}
      <motion.div
        className={`${styles.hero} ${isSpecial ? styles.heroSpecial : ''}`}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {heroImage ? (
          <img
            src={heroImage}
            alt={title}
            className={`${styles.heroImg} ${isSpecial ? styles.heroImgClickable : ''}`}
            onClick={isSpecial ? () => setLightbox(true) : undefined}
          />
        ) : (
          <div className={styles.heroPlaceholder}>♪</div>
        )}
        {!isSpecial && <div className={styles.heroOverlay} />}

        {/* Date badge */}
        {!isSpecial && (
          <div className={styles.dateBadge}>
            <div className={styles.dateBadgeMonth}>{month}</div>
            <div className={styles.dateBadgeDay}>{day}</div>
          </div>
        )}
      </motion.div>

      {/* ── Content block ── */}
      <motion.div
        className={styles.content}
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <h1 className={styles.title}>{title}</h1>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <span className={styles.metaIcon}><CalendarIcon /></span>
            <span>{formattedDate} · {time}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaIcon}><LocationIcon /></span>
            <span>{venue}, {location}</span>
          </div>
        </div>

        <div className={styles.badges}>
          {danceStyles.map((s) => (
            <Badge key={s} label={s} />
          ))}
        </div>

        <p className={styles.description}>{description}</p>

        {/* ── Venue festival flyer ── */}
        {venueSpecialEvent?.image && (
          <div className={styles.flyerSection}>
            <div className={styles.flyerLabel}>⭐ {t('venue.detail.specialEvent', 'Special Event')}</div>
            <img
              src={venueSpecialEvent.image}
              alt={venueSpecialEvent.title}
              className={styles.flyerImg}
              onClick={() => navigate('/map', { state: { placeId } })}
            />
            {venueSpecialEvent.title && (
              <div className={styles.flyerTitle}>{venueSpecialEvent.title}</div>
            )}
          </div>
        )}

        <div className={styles.divider} />

        {/* ── Map ── */}
        {import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
          <div className={styles.mapCard}>
            <iframe
              title="venue-map"
              src={
                `https://www.google.com/maps/embed/v1/place` +
                `?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}` +
                `&q=${encodeURIComponent(`${venue}, ${location}`)}` +
                `&zoom=15`
              }
              className={styles.mapIframe}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.mapLink}
            >
              {t('eventDetail.openInMaps')}
            </a>
          </div>
        ) : (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.mapCardFallback}
          >
            <div className={styles.mapVisual}>
              <span className={styles.mapPinIcon}>📍</span>
            </div>
            <div className={styles.mapInfo}>
              <div className={styles.mapVenue}>{venue}</div>
              <div className={styles.mapCity}>{location}</div>
              <div className={styles.mapCta}>{t('eventDetail.viewOnMaps')}</div>
            </div>
          </a>
        )}

        {/* ── Admin: Refresh Metadata — disabled for special events to avoid Google API calls ── */}
        {IS_ADMIN && !isSpecial && (
          <button
            onClick={handleRefreshMetadata}
            disabled={refreshing}
            className={styles.adminRefreshBtn}
            title="Fetch latest venue photo from Google Places and save to Firestore"
          >
            {refreshing ? <SpinnerIcon /> : <RefreshIcon />}
            {refreshing ? t('eventDetail.fetching') : t('eventDetail.refresh')}
          </button>
        )}

        {/* ── Inline WhatsApp CTA (desktop / larger screens) ── */}
        {!isSpecial && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.whatsappBtn} ${styles.whatsappBtnInline}`}
          >
            <span>📱</span>
            {t('eventDetail.whatsappRsvp')}
          </a>
        )}
      </motion.div>

      {/* ── Spacer so fixed CTA doesn't cover content on mobile ── */}
      {!isSpecial && <div className={styles.ctaSpacer} />}

      {/* ── Fixed WhatsApp CTA — mobile conversion anchor ── */}
      {!isSpecial && <div className={styles.ctaBar}>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappBtn}
        >
          <span>📱</span>
          {t('eventDetail.whatsappRsvp')}
        </a>
      </div>}

      {/* ── Toast notification ── */}
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
