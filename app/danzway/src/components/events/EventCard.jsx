import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectIsSaved, toggleSave } from '../../store/appSlice'
import { selectVenuesByName } from '../../store/venuesSlice'
import { relativeDate, shortMonthDay } from '../../i18n/dateUtils'
import Badge from '../ui/Badge'
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
    price,
    currency,
    description,
    whatsapp,
  } = event

  const saved        = useSelector(selectIsSaved(id))
  const venuesByName = useSelector(selectVenuesByName)

  const venueData    = venuesByName[venue]
  const resolvedLogo  = _venueLogo  ?? venueData?.logo            ?? null
  const resolvedPhoto = _venuePhoto ?? venueData?.customImageUrl ?? venueData?.photos?.[0] ?? placePhoto ?? null
  const heroImage     = resolvedLogo || resolvedPhoto || image || null

  const relDate          = relativeDate(date, t, lang)
  const { month, day }   = shortMonthDay(date, lang)

  const hashtags = danceStyles
    .map((s) => `#${s.toLowerCase().replace(/\s+/g, '')}`)
    .join(' ')

  const waMessage = encodeURIComponent(
    t('event.waMessage', { title, venue, location, date, time })
  )
  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`

  return (
    <article className={styles.card}>

      {/* ── Header row: avatar + venue + DATE/TIME ── */}
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

      {/* ── Image (tapping navigates to detail) ── */}
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

          {/* Date badge — pinned top-end (right in LTR, left in RTL) */}
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

      {/* ── Description + hashtags ── */}
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
          {saved ? '♥' : '♡'} {t('event.interested')}
        </motion.button>
        <button className={styles.actionBtn}>➤ {t('event.share')}</button>
      </div>

      {/* ── WhatsApp RSVP ── */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.rsvpBtn}
      >
        <span>📱</span>
        {t('event.whatsappRsvp')}
      </a>

    </article>
  )
}
