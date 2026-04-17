import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import { selectIsSaved, toggleSave } from '../../store/appSlice'
import Badge from '../ui/Badge'
import styles from './EventCard.module.css'

function getRelativeDate(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(dateStr)
  event.setHours(0, 0, 0, 0)
  const diff = Math.round((event - today) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Tonight'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7)
    return event.toLocaleDateString('en-US', { weekday: 'long' })
  return event.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getAvatarInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function EventCard({ event }) {
  const dispatch = useDispatch()

  const {
    id,
    title,
    date,
    time,
    location,
    venue,
    styles: danceStyles,
    image,
    price,
    currency,
    description,
    whatsapp,
  } = event

  const saved = useSelector(selectIsSaved(id))

  const relDate = getRelativeDate(date)
  const parsedDate = new Date(date)
  const month = parsedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day   = parsedDate.getDate()

  const hashtags = danceStyles
    .map((s) => `#${s.toLowerCase().replace(/\s+/g, '')}`)
    .join(' ')

  const waMessage = encodeURIComponent(`Hi! I'm interested in: ${title} — ${venue}, ${location} on ${date} at ${time}`)
  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`

  return (
    <article className={styles.card}>

      {/* ── Header row ── */}
      <div className={styles.header}>
        <div className={styles.avatar}>{getAvatarInitials(venue)}</div>
        <div className={styles.headerInfo}>
          <Link to={`/events/${id}`} className={styles.venueNameLink}>
            <div className={styles.venueName}>{venue} · {location}</div>
          </Link>
          <div className={styles.venueDate}>{relDate} · {time}</div>
        </div>
        <button className={styles.menuBtn} aria-label="More options">···</button>
      </div>

      {/* ── Image (tapping navigates to detail) ── */}
      <Link to={`/events/${id}`} className={styles.imageLink} aria-label={`View details for ${title}`}>
        <div className={styles.imageWrapper}>
          {image ? (
            <>
              <img src={image} alt={title} className={styles.image} />
              <div className={styles.imageOverlay} />
            </>
          ) : (
            <div className={styles.imagePlaceholder}>♪</div>
          )}

          {/* Date badge */}
          <div className={styles.dateBadge}>
            <div className={styles.dateBadgeMonth}>{month}</div>
            <div className={styles.dateBadgeDay}>{day}</div>
          </div>
        </div>
      </Link>

      {/* ── Style badges ── */}
      <div className={styles.styleBadges}>
        {danceStyles.map((s) => <Badge key={s} label={s} />)}
      </div>

      {/* ── Description + hashtags ── */}
      <p className={styles.description}>
        {description}{' '}
        <span className={styles.hashtags}>{hashtags} #danzway</span>
      </p>

      {/* ── Action buttons ── */}
      <div className={styles.actions}>
        <motion.button
          className={`${styles.actionBtn} ${saved ? styles.actionBtnSaved : ''}`}
          onClick={() => dispatch(toggleSave(id))}
          whileTap={{ scale: 0.88 }}
          animate={saved ? { scale: [1, 1.18, 0.95, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {saved ? '♥' : '♡'} INTERESTED
        </motion.button>
        <button className={styles.actionBtn}>➤ SHARE</button>
      </div>

      {/* ── WhatsApp RSVP ── */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.rsvpBtn}
      >
        <span>📱</span>
        WHATSAPP RSVP · {price} {currency}
      </a>

    </article>
  )
}
