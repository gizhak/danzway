import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectIsSaved, selectUid, toggleSave } from '../../store/appSlice'
import { useAttendance } from '../../hooks/useAttendance'
import { selectVenuesByName } from '../../store/venuesSlice'
import { relativeDate, shortMonthDay } from '../../i18n/dateUtils'
import { updateEventSaveCount } from '../../services/saveService'
import Badge from '../ui/Badge'
import DirectionsSheet from '../ui/DirectionsSheet'
import styles from './EventCard.module.css'

const GENERIC_IMAGE = 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'

function PeopleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

function getAvatarInitials(name) {
  return (name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function EventCard({ event }) {
  const dispatch      = useDispatch()
  const { t, i18n }  = useTranslation()
  const lang          = i18n.language

  const {
    id,
    title,
    date,
    time,
    location,
    venue,
    styles: danceStyles = [],
    _venueLogo,
    _venuePhoto,
    image,
    placePhoto,
    description,
    isRecurring = false,
  } = event

  const saved        = useSelector(selectIsSaved(id))
  const uid          = useSelector(selectUid)
  const venuesByName = useSelector(selectVenuesByName)
  const { count, isGoing, toggle } = useAttendance(id, uid)
  const venueData    = venuesByName[venue]

  const isGApi = (u) => u?.includes('places.googleapis.com')
  const resolvedLogo  = isGApi(_venueLogo)  ? null : (_venueLogo  ?? (isGApi(venueData?.logo)  ? null : venueData?.logo)  ?? null)
  const resolvedPhoto = isGApi(_venuePhoto) ? null : (_venuePhoto ?? venueData?.customImageUrl ?? (venueData?.photos ?? []).find(u => !isGApi(u)) ?? (isGApi(placePhoto) ? null : placePhoto) ?? null)
  const heroImage     = resolvedLogo || resolvedPhoto || image || GENERIC_IMAGE
  const coords        = venueData?.coordinates ?? null

  const relDate        = relativeDate(date, t, lang)
  const { month, day, weekday } = shortMonthDay(date, lang)

  const hashtags = danceStyles
    .map((s) => `#${s.toLowerCase().replace(/\s+/g, '')}`)
    .join(' ')

  // Recurring virtual events have no Firestore document — send to venue page instead
  const cardTo = isRecurring
    ? (event.placeId ? `/venues/${event.placeId}` : '/')
    : `/events/${id}`

  const [showDirections, setShowDirections] = useState(false)

  async function handleShare() {
    const url  = isRecurring && event.placeId
      ? `${window.location.origin}/venues/${event.placeId}`
      : `${window.location.origin}/events/${id}`
    const text = t('share.joinMe', { name: title ?? venue })
    if (navigator.share) {
      try { await navigator.share({ title: title ?? venue, text, url }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
    }
  }

  return (
    <article className={styles.card}>

      {/* ── Header row ── */}
      <div className={styles.header}>
        <div className={styles.avatar}>{getAvatarInitials(venue)}</div>
        <div className={styles.headerInfo}>
          {event.placeId
            ? <Link to={`/venues/${event.placeId}`} className={styles.venueNameLink}>
                <div className={styles.venueName}>{venue} · {location}</div>
              </Link>
            : <div className={styles.venueName}>{venue} · {location}</div>
          }
          <div className={styles.venueDate}>
            <span className={styles.relDate}>{relDate}</span>
            <span className={styles.weekdayChip}>{weekday}</span>
            {time && <span className={styles.timeChip}>🕐 {time}</span>}
          </div>
        </div>
        <button className={styles.menuBtn} aria-label={t('event.moreOptions')}>···</button>
      </div>

      {/* ── Image ── */}
      <Link to={cardTo} className={styles.imageLink} aria-label={t('event.viewDetails', { title })}>
        <div className={styles.imageWrapper}>
          <img
            src={heroImage}
            alt={title}
            className={styles.image}
            onError={(e) => { e.currentTarget.src = GENERIC_IMAGE; e.currentTarget.onerror = null }}
          />
          <div className={styles.imageOverlay} />
          <div className={styles.dateBadge}>
            <div className={styles.dateBadgeMonth}>{month}</div>
            <div className={styles.dateBadgeDay}>{day}</div>
          </div>
        </div>
      </Link>

      {/* ── Attendance ── */}
      <div className={styles.attendRow}>
        <span className={styles.attendCount}>
          <PeopleIcon />
          <span>{count}</span>
        </span>
        <motion.button
          className={`${styles.attendBtn} ${isGoing ? styles.attendBtnActive : ''}`}
          onClick={toggle}
          disabled={!uid}
          whileTap={{ scale: 0.9 }}
          animate={isGoing ? { scale: [1, 1.12, 0.95, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          {!isGoing && <PlusIcon />}
          <span>{isGoing
            ? (lang === 'he' ? 'סימנתי שאני בא/ה ✓' : "I'm going ✓")
            : (lang === 'he' ? 'האם את/ה בא/ה?' : 'Are you going?')
          }</span>
        </motion.button>
      </div>

      {/* ── Style badges ── */}
      {danceStyles.length > 0 && (
        <div className={styles.styleBadges}>
          {danceStyles.map((s) => <Badge key={s} label={t(`styles.${s}`, s)} />)}
        </div>
      )}

      {/* ── Description ── */}
      {description && (
        <p className={styles.description}>
          {description}{' '}
          <span className={styles.hashtags}>{hashtags} #danzway</span>
        </p>
      )}

      {/* ── Action buttons ── */}
      <div className={styles.actions}>
        <motion.button
          className={`${styles.actionBtn} ${saved ? styles.actionBtnSaved : ''}`}
          onClick={() => {
            const willSave = !saved
            dispatch(toggleSave(id))
            updateEventSaveCount(id, isRecurring, willSave ? 1 : -1, title ?? venue ?? '')
          }}
          whileTap={{ scale: 0.88 }}
          animate={saved ? { scale: [1, 1.18, 0.95, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {saved ? '♥' : '♡'} {t('event.save')}
        </motion.button>
        <button className={styles.actionBtn} onClick={handleShare}>
          ➤ {t('event.share')}
        </button>
      </div>

      {/* ── Get Directions CTA ── */}
      <button
        className={styles.rsvpBtn}
        onClick={() => setShowDirections(true)}
      >
        <span>📍</span>
        {t('event.getDirections')}
      </button>

      {showDirections && (
        <DirectionsSheet
          coords={coords}
          name={venue}
          onClose={() => setShowDirections(false)}
        />
      )}

    </article>
  )
}
