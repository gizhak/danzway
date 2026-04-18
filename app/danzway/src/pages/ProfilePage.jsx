import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  selectSavedIds,
  selectAllEvents,
  selectEventsStatus,
  toggleSave,
  fetchEvents,
} from '../store/appSlice'
import { profileDate } from '../i18n/dateUtils'
import styles from './ProfilePage.module.css'

function SavedEventRow({ event }) {
  const dispatch    = useDispatch()
  const { t, i18n } = useTranslation()

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
          <span>{profileDate(event.date, i18n.language)} · {event.time}</span>
          <span className={styles.rowDot}>·</span>
          <span>{event.venue}, {event.location}</span>
        </div>
        <div className={styles.rowStyles}>
          {(event.styles ?? []).map((s) => (
            <span key={s} className={styles.rowStyleChip}>{t(`styles.${s}`, s)}</span>
          ))}
        </div>
      </div>

      <div className={styles.rowRight}>
        <Link to={`/events/${event.id}`} className={styles.viewBtn}>
          {t('profile.viewEvent')}
        </Link>
        <button
          className={styles.unsaveBtn}
          onClick={() => dispatch(toggleSave(event.id))}
          aria-label={t('profile.removeEvent', { title: event.title })}
        >
          ♥
        </button>
      </div>
    </motion.div>
  )
}

export default function ProfilePage() {
  const dispatch     = useDispatch()
  const { t }        = useTranslation()
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
          <div className={styles.name}>{t('profile.name')}</div>
          <div className={styles.subtitle}>{t('profile.subtitle')}</div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* ── Saved events section ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <span className={styles.heartIcon}>♥</span>
          {t('profile.saved')}
        </div>
        {count > 0 && (
          <span className={styles.countChip}>{count}</span>
        )}
      </div>

      {count === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>♡</div>
          <p className={styles.emptyTitle}>{t('profile.empty.title')}</p>
          <p className={styles.emptyText}>
            {t('profile.empty.text')}
          </p>
          <Link to="/" className={styles.browseBtn}>
            {t('profile.empty.browse')}
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
