import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectIsSaved, toggleSave } from '../../store/appSlice'
import { selectVenuesByName } from '../../store/venuesSlice'
import { relativeDate, shortMonthDay } from '../../i18n/dateUtils'
import Badge from '../ui/Badge'
import DirectionsSheet from '../ui/DirectionsSheet'
import styles from './EventCard.module.css'

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
  } = event

  const saved        = useSelector(selectIsSaved(id))
  const venuesByName = useSelector(selectVenuesByName)
  const venueData    = venuesByName[venue]

  const resolvedLogo  = _venueLogo  ?? venueData?.logo            ?? null
  const resolvedPhoto = _venuePhoto ?? venueData?.customImageUrl ?? venueData?.photos?.[0] ?? placePhoto ?? null
  const heroImage     = resolvedLogo || resolvedPhoto || image || null
  const coords        = venueData?.coordinates ?? null

  const relDate        = relativeDate(date, t, lang)
  const { month, day } = shortMonthDay(date, lang)

  const hashtags = danceStyles
    .map((s) => `#${s.toLowerCase().replace(/\s+/g, '')}`)
    .join(' ')

  const [showDirections, setShowDirections] = useState(false)

  async function handleShare() {
    const url  = `${window.location.origin}/events/${id}`
    const text = `${t('share.joinMe', { name: title ?? venue })} ${url}`
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
          <Link to={`/venues/${event.placeId ?? ''}`} className={styles.venueNameLink}>
            <div className={styles.venueName}>{venue} · {location}</div>
          </Link>
          <div className={styles.venueDate}>
            <span className={styles.relDate}>{relDate}</span>
            {time && <span className={styles.timeChip}>🕐 {time}</span>}
          </div>
        </div>
        <button className={styles.menuBtn} aria-label={t('event.moreOptions')}>···</button>
      </div>

      {/* ── Image ── */}
      <Link to={`/events/${id}`} className={styles.imageLink} aria-label={t('event.viewDetails', { title })}>
        <div className={styles.imageWrapper}>
          {heroImage ? (
            <>
              <img
                src={heroImage}
                alt={title}
                className={styles.image}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextSibling?.style && (e.currentTarget.nextSibling.style.display = 'none')
                  const ph = document.createElement('div')
                  ph.className = styles.imagePlaceholder
                  ph.textContent = '♪'
                  e.currentTarget.parentNode.appendChild(ph)
                }}
              />
              <div className={styles.imageOverlay} />
            </>
          ) : (
            <div className={styles.imagePlaceholder}>♪</div>
          )}
          <div className={styles.dateBadge}>
            <div className={styles.dateBadgeMonth}>{month}</div>
            <div className={styles.dateBadgeDay}>{day}</div>
          </div>
        </div>
      </Link>

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
          onClick={() => dispatch(toggleSave(id))}
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
