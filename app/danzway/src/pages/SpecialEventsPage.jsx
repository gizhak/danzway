import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { fetchEvents, selectEventsStatus } from '../store/appSlice'
import { fetchVenues, selectVenuesStatus } from '../store/venuesSlice'
import { selectActiveSpecialEvents } from '../store/selectors'
import EventCard from '../components/events/EventCard'
import SearchBar from '../components/ui/SearchBar'
import SubmitEventModal from '../components/ui/SubmitEventModal'
import styles from './SpecialEventsPage.module.css'

export default function SpecialEventsPage() {
  const [query,       setQuery]      = useState('')
  const [submitOpen,  setSubmitOpen] = useState(false)
  const dispatch           = useDispatch()
  const { t }              = useTranslation()
  const events             = useSelector(selectActiveSpecialEvents)
  const eventsStatus       = useSelector(selectEventsStatus)
  const venuesStatus       = useSelector(selectVenuesStatus)

  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [venuesStatus, dispatch])

  const filtered = useMemo(() => {
    if (!query.trim()) return events
    const q = query.toLowerCase()
    return events.filter(
      ({ title, venue, location, styles: danceStyles = [] }) =>
        title?.toLowerCase().includes(q) ||
        venue?.toLowerCase().includes(q) ||
        location?.toLowerCase().includes(q) ||
        danceStyles.some((s) => s.toLowerCase().includes(q))
    )
  }, [events, query])

  const isLoading = eventsStatus === 'loading' || venuesStatus === 'loading'

  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroStarRow}>⭐</div>
        <h1 className={styles.heroTitle}>
          {t('festivals.hero.title')}{' '}
          <span className={styles.heroTitleGradient}>{t('festivals.hero.highlight')}</span>
        </h1>
        <p className={styles.heroSubtitle}>{t('festivals.hero.subtitle')}</p>
      </section>

      {/* ── Search + submit row ── */}
      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <button className={styles.submitTrigger} onClick={() => setSubmitOpen(true)}>
        {t('submitEvent.trigger')}
      </button>

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className={styles.skeletonGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {/* ── Events feed ── */}
      {!isLoading && filtered.length > 0 && (
        <div className={styles.feed}>
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* ── Empty: no special events exist ── */}
      {!isLoading && events.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⭐</div>
          <p className={styles.emptyTitle}>{t('festivals.empty.noEvents.title')}</p>
          <p className={styles.emptyText}>{t('festivals.empty.noEvents.text')}</p>
        </div>
      )}

      {/* ── Empty: search returned nothing ── */}
      {!isLoading && events.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>{t('parties.empty.noMatch.title')}</p>
          <p className={styles.emptyText}>{t('parties.empty.noMatch.text')}</p>
        </div>
      )}
      {submitOpen && <SubmitEventModal onClose={() => setSubmitOpen(false)} />}
    </>
  )
}
