import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import { selectIsSaved, toggleSave, selectNextEventByVenueName } from '../../store/appSlice'
import Badge from '../ui/Badge'
import styles from './VenueCard.module.css'

// Generic fallback for venues with no photo
const GENERIC_IMAGE =
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'

function getAvatarInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default function VenueCard({ venue }) {
  const dispatch = useDispatch()

  const {
    placeId,
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
    coordinates,
  } = venue

  const saved              = useSelector(selectIsSaved(placeId))
  const nextEventsByVenue  = useSelector(selectNextEventByVenueName)
  const nextEvent          = nextEventsByVenue[name] ?? null

  // Image priority: first Google photo → generic nightclub image
  // Logo is ONLY used in the circular avatar header, never stretched as hero
  const heroImage = photos[0] ?? GENERIC_IMAGE

  const mapsUrl = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (city ?? ''))}`

  const categoryLine = categories.slice(0, 2).join(' · ')
  const hashtags = danceStyles
    .map((s) => `#${s.toLowerCase().replace(/\s+/g, '')}`)
    .join(' ')

  // Date badge values from the next upcoming event
  let badgeMonth = null
  let badgeDay   = null
  let badgeLabel = null   // "Tonight" / "Tomorrow" / null
  if (nextEvent?.date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const evDate = new Date(nextEvent.date); evDate.setHours(0, 0, 0, 0)
    const diff = Math.round((evDate - today) / 86400000)
    if (diff === 0) { badgeLabel = 'Tonight' }
    else if (diff === 1) { badgeLabel = 'Tomorrow' }
    else {
      badgeMonth = evDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
      badgeDay   = evDate.getDate()
    }
  }

  return (
    <article className={styles.card}>

      {/* ── Header row ── */}
      <div className={styles.header}>
        {logo ? (
          <img src={logo} alt={name} className={styles.avatarImg} />
        ) : (
          <div className={styles.avatar}>{getAvatarInitials(name)}</div>
        )}
        <div className={styles.headerInfo}>
          <Link to={`/venues/${placeId}`} className={styles.nameLink}>
            <div className={styles.venueName}>{name}</div>
          </Link>
          <div className={styles.venueMeta}>
            {city && <span>📍 {city}</span>}
            {categoryLine && <span> · {categoryLine}</span>}
            {rating && (
              <span className={styles.ratingInline}> · ★ {rating.toFixed(1)}</span>
            )}
          </div>
        </div>
        <button className={styles.menuBtn} aria-label="More options">···</button>
      </div>

      {/* ── Image ── */}
      <Link to={`/venues/${placeId}`} className={styles.imageLink} aria-label={`View ${name}`}>
        <div className={styles.imageWrapper}>
          <img src={heroImage} alt={name} className={styles.image} />
          <div className={styles.imageOverlay} />

          {/* Next-event date badge — top-right, same style as EventCard */}
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
        </div>
      </Link>

      {/* ── Dance style badges ── */}
      {danceStyles.length > 0 && (
        <div className={styles.styleBadges}>
          {danceStyles.map((s) => <Badge key={s} label={s} />)}
        </div>
      )}

      {/* ── Info line + hashtags ── */}
      <p className={styles.description}>
        {address && <span>{address} </span>}
        {hashtags && <span className={styles.hashtags}>{hashtags} #danzway</span>}
      </p>

      {/* ── Action buttons ── */}
      <div className={styles.actions}>
        <motion.button
          className={`${styles.actionBtn} ${saved ? styles.actionBtnSaved : ''}`}
          onClick={() => dispatch(toggleSave(placeId))}
          whileTap={{ scale: 0.88 }}
          animate={saved ? { scale: [1, 1.18, 0.95, 1] } : { scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {saved ? '♥' : '♡'} SAVE
        </motion.button>
        <button className={styles.actionBtn}>➤ SHARE</button>
      </div>

      {/* ── Directions CTA ── */}
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.directionsBtn}
      >
        <span>📍</span>
        GET DIRECTIONS
        {phone && <span className={styles.directionsSep}>·</span>}
        {phone && <span className={styles.directionsPhone}>{phone}</span>}
      </a>

    </article>
  )
}
