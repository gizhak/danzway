import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { selectAllEvents } from '../store/appSlice'
import Badge from '../components/ui/Badge'
import styles from './EventDetailPage.module.css'

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

export default function EventDetailPage() {
  const { id }    = useParams()
  const events    = useSelector(selectAllEvents)
  const event     = events.find((e) => e.id === id)
  const [toast, setToast] = useState(false)

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
      setToast(true)
      setTimeout(() => setToast(false), 2200)
    }
  }

  return (
    <div className={styles.page}>

      {/* ── Header row: Back + Share ── */}
      <div className={styles.header}>
        <Link to="/" className={styles.back}>
          <span className={styles.backArrow}>←</span>
          <span>Back</span>
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

      {/* ── "Link copied" toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={styles.toast}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            <span className={styles.toastIcon}>🔗</span>
            Link copied to clipboard
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
