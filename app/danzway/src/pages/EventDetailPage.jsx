import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { mockEvents } from '../data/mockEvents'
import Badge from '../components/ui/Badge'
import styles from './EventDetailPage.module.css'

export default function EventDetailPage() {
  const { id } = useParams()
  const event = mockEvents.find((e) => e.id === id)

  if (!event) {
    return <p className={styles.notFound}>Event not found.</p>
  }

  const {
    title,
    date,
    time,
    location,
    venue,
    styles: danceStyles,
    image,
    description,
    price,
    currency,
    whatsapp,
  } = event

  const parsedDate = new Date(date)
  const month = parsedDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day   = parsedDate.getDate()

  const formattedDate = parsedDate.toLocaleDateString('en-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const waMessage = encodeURIComponent(
    `Hi! I'd like to join: ${title} at ${venue}, ${location} on ${date} at ${time}. Price: ${price} ${currency}`
  )
  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp}?text=${waMessage}`
    : `https://wa.me/?text=${waMessage}`

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(`${venue}, ${location}`)}`

  return (
    <div className={styles.page}>

      {/* ── Back button — large thumb-friendly hit area ── */}
      <Link to="/" className={styles.back}>
        <span className={styles.backArrow}>←</span>
        <span>Back</span>
      </Link>

      {/* ── Hero image ── */}
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {image ? (
          <img src={image} alt={title} className={styles.heroImg} />
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

        <div className={styles.priceRow}>
          <span className={styles.priceChip}>{price} {currency}</span>
        </div>

        <div className={styles.divider} />

        {/* ── Map placeholder ── */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mapCard}
        >
          <div className={styles.mapVisual}>
            <span className={styles.mapPinIcon}>📍</span>
          </div>
          <div className={styles.mapInfo}>
            <div className={styles.mapVenue}>{venue}</div>
            <div className={styles.mapCity}>{location}</div>
            <div className={styles.mapCta}>View on Google Maps →</div>
          </div>
        </a>

        {/* ── Inline WhatsApp CTA (desktop / larger screens) ── */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${styles.whatsappBtn} ${styles.whatsappBtnInline}`}
        >
          <span>📱</span>
          WHATSAPP RSVP · {price} {currency}
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
          WHATSAPP RSVP · {price} {currency}
        </a>
      </div>

    </div>
  )
}
