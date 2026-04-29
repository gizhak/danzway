import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { selectAllEvents, selectEventsStatus, fetchEvents } from '../store/appSlice'
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

export default function EventDetailPage() {
  const dispatch      = useDispatch()
  const { id }        = useParams()
  const { t, i18n }  = useTranslation()
  const events        = useSelector(selectAllEvents)
  const eventsStatus  = useSelector(selectEventsStatus)
  const event         = events.find((e) => e.id === id)

  const [toastMsg,   setToastMsg]   = useState('')
  const [refreshing, setRefreshing] = useState(false)

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

  if (!event) {
    return <p className={styles.notFound}>{t('eventDetail.notFound')}</p>
  }

  const {
    title,
    date,
    time,
    location,
    venue,
    styles: danceStyles,
    image,
    placePhoto,
    description,
    price,
    currency,
    whatsapp,
  } = event

  // Hero image: prefer real Google Places photo, fall back to manual image, then placeholder
  const heroImage = placePhoto || image || null

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
        <Link to="/" className={styles.back}>
          <span className={styles.backArrow}>{t('eventDetail.backArrow')}</span>
          <span>{t('eventDetail.back')}</span>
        </Link>
        <button className={styles.shareFab} onClick={handleShare} aria-label="Share event">
          <ShareIcon />
        </button>
      </div>

      {/* ── Hero image ── */}
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {heroImage ? (
          <img src={heroImage} alt={title} className={styles.heroImg} />
        ) : (
          <div className={styles.heroPlaceholder}>♪</div>
        )}
        <div className={styles.heroOverlay} />

        {/* Date badge */}
        <div className={styles.dateBadge}>
          <div className={styles.dateBadgeMonth}>{month}</div>
          <div className={styles.dateBadgeDay}>{day}</div>
        </div>
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
            <span className={styles.metaIcon}>📅</span>
            <span>{formattedDate} · {time}</span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaIcon}>📍</span>
            <span>{venue}, {location}</span>
          </div>
        </div>

        <div className={styles.badges}>
          {danceStyles.map((s) => (
            <Badge key={s} label={s} />
          ))}
        </div>

        <p className={styles.description}>{description}</p>

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

        {/* ── Admin: Refresh Metadata ── */}
        {IS_ADMIN && (
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
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.whatsappBtn} ${styles.whatsappBtnInline}`}
        >
          <span>📱</span>
          {t('eventDetail.whatsappRsvp')}
        </a>
      </motion.div>

      {/* ── Spacer so fixed CTA doesn't cover content on mobile ── */}
      <div className={styles.ctaSpacer} />

      {/* ── Fixed WhatsApp CTA — mobile conversion anchor ── */}
      <div className={styles.ctaBar}>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappBtn}
        >
          <span>📱</span>
          {t('eventDetail.whatsappRsvp')}
        </a>
      </div>

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
