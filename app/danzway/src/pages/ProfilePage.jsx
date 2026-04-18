import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectSavedIds,
  selectAllEvents,
  selectEventsStatus,
  toggleSave,
  fetchEvents,
} from '../store/appSlice'
import styles from './ProfilePage.module.css'

function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function SavedEventRow({ event }) {
  const dispatch = useDispatch()

  return (
    <motion.div
      className={styles.row}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      layout
    >
      <div className={styles.rowLeft}>
        <div className={styles.rowTitle}>{event.title}</div>
        <div className={styles.rowMeta}>
          <span>{formatShortDate(event.date)} · {event.time}</span>
          <span className={styles.rowDot}>·</span>
          <span>{event.venue}, {event.location}</span>
        </div>
        <div className={styles.rowStyles}>
          {(event.styles ?? []).map((s) => (
            <span key={s} className={styles.rowStyleChip}>{s}</span>
          ))}
        </div>
      </div>

      <div className={styles.rowRight}>
        <Link to={`/events/${event.id}`} className={styles.viewBtn}>
          View →
        </Link>
        <button
          className={styles.unsaveBtn}
          onClick={() => dispatch(toggleSave(event.id))}
          aria-label={`Remove ${event.title} from saved`}
        >
          ♥
        </button>
      </div>
    </motion.div>
  )
}

export default function ProfilePage() {
  const dispatch     = useDispatch()
  const savedIds     = useSelector(selectSavedIds)
  const allEvents    = useSelector(selectAllEvents)
  const eventsStatus = useSelector(selectEventsStatus)

  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  const savedEvents = allEvents.filter((e) => savedIds[e.id])
  const count       = savedEvents.length

  return (
    <div className={styles.page}>

      {/* ── Identity header ── */}
      <div className={styles.header}>
        <div className={styles.avatar}>DW</div>
        <div className={styles.identity}>
          <div className={styles.name}>Dance Enthusiast</div>
          <div className={styles.subtitle}>DanzWay Member</div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Saved events section ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <span className={styles.heartIcon}>♥</span>
          Saved Events
        </div>
        {count > 0 && (
          <span className={styles.countChip}>{count}</span>
        )}
      </div>

      {count === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>♡</div>
          <p className={styles.emptyTitle}>Nothing saved yet</p>
          <p className={styles.emptyText}>
            Tap <span className={styles.emptyHint}>♡ INTERESTED</span> on any event to save it here.
          </p>
          <Link to="/" className={styles.browseBtn}>
            Browse Events
          </Link>
        </div>
      ) : (
        <AnimatePresence>
          <div className={styles.list}>
            {savedEvents.map((event) => (
              <SavedEventRow key={event.id} event={event} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
