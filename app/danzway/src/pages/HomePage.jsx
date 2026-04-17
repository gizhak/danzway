import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectStyleFilter,
  setStyleFilter,
  selectAllEvents,
  selectEventsStatus,
  selectEventsError,
  fetchEvents,
} from '../store/appSlice'
import EventList from '../components/events/EventList'
import StyleFilterRow from '../components/events/StyleFilterRow'
import SearchBar from '../components/ui/SearchBar'
import styles from './HomePage.module.css'

function filterEvents(events, query, styleFilter) {
  let result = events

  // Filter by style bubble
  if (styleFilter !== 'all') {
    result = result.filter((e) =>
      e.styles.some((s) => s.toLowerCase() === styleFilter.toLowerCase())
    )
  }

  // Filter by search query
  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      ({ title, location, venue, styles: danceStyles }) =>
        title.toLowerCase().includes(q) ||
        location.toLowerCase().includes(q) ||
        venue.toLowerCase().includes(q) ||
        danceStyles.some((s) => s.toLowerCase().includes(q))
    )
  }

  return result
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const dispatch          = useDispatch()
  const styleFilter       = useSelector(selectStyleFilter)
  const events            = useSelector(selectAllEvents)
  const status            = useSelector(selectEventsStatus)
  const error             = useSelector(selectEventsError)

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchEvents())
    }
  }, [status, dispatch])

  const filtered = useMemo(
    () => filterEvents(events, query, styleFilter),
    [events, query, styleFilter]
  )

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Find your next{' '}
          <span className={styles.heroTitleGradient}>dance event</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Salsa · Bachata · Kizomba · Zouk and more
        </p>
      </section>

      <div className={styles.filterRow}>
        <StyleFilterRow active={styleFilter} onSelect={(id) => dispatch(setStyleFilter(id))} />
      </div>

      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Upcoming Events</h2>
          {(query || styleFilter !== 'all') && status === 'succeeded' && (
            <span className={styles.resultCount}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Loading skeletons ── */}
        {status === 'loading' && (
          <div className={styles.skeletonList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        )}

        {/* ── Premium error card ── */}
        {status === 'failed' && (
          <div className={styles.errorCard}>
            <div className={styles.errorIconWrap}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div className={styles.errorBody}>
              <p className={styles.errorTitle}>Couldn't load events</p>
              <p className={styles.errorMessage}>{error}</p>
              <button
                className={styles.retryBtn}
                onClick={() => dispatch(fetchEvents())}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* ── Event list ── */}
        {status === 'succeeded' && (
          filtered.length > 0 ? (
            <EventList events={filtered} />
          ) : (
            <p className={styles.noResults}>No events match your filters.</p>
          )
        )}
      </section>
    </>
  )
}
