import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  selectStyleFilters,
  toggleStyleFilter,
  selectEventsStatus,
  fetchEvents,
} from '../store/appSlice'
import {
  selectActiveVenues,
  selectVenuesStatus,
  fetchVenues,
} from '../store/venuesSlice'
import VenueCard from '../components/venues/VenueCard'
import StyleFilterRow from '../components/events/StyleFilterRow'
import SearchBar from '../components/ui/SearchBar'
import styles from './HomePage.module.css'

/**
 * Filter active venues by:
 *   1. Selected dance styles (ALL must be present — AND logic)
 *   2. Search query (name, city, address)
 */
function filterVenues(venues, query, styleFilters) {
  let result = venues

  const safeFilters = Array.isArray(styleFilters) ? styleFilters : []
  if (safeFilters.length > 0) {
    result = result.filter((v) =>
      safeFilters.every((style) =>
        (v.styles ?? []).some((s) => s.toLowerCase() === style.toLowerCase())
      )
    )
  }

  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      ({ name, city, address, categories }) =>
        name?.toLowerCase().includes(q) ||
        city?.toLowerCase().includes(q) ||
        address?.toLowerCase().includes(q) ||
        (categories ?? []).some((c) => c.toLowerCase().includes(q))
    )
  }

  return result
}

export default function HomePage() {
  const [query,   setQuery]   = useState('')
  const dispatch              = useDispatch()
  const styleFilters          = useSelector(selectStyleFilters)
  const activeVenues          = useSelector(selectActiveVenues)
  const venuesStatus          = useSelector(selectVenuesStatus)
  const eventsStatus          = useSelector(selectEventsStatus)

  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [venuesStatus, dispatch])

  // Events are needed for the next-event date badge on each venue card
  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  const filtered = useMemo(
    () => filterVenues(activeVenues, query, styleFilters),
    [activeVenues, query, styleFilters]
  )

  const isLoading  = venuesStatus === 'loading'
  const isFiltering = (Array.isArray(styleFilters) && styleFilters.length > 0) || query.trim().length > 0

  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Find your next{' '}
          <span className={styles.heroTitleGradient}>dance club</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Salsa · Bachata · Kizomba · Zouk and more across Israel
        </p>
      </section>

      {/* ── Style filter bubbles ── */}
      <div className={styles.filterRow}>
        <StyleFilterRow
          activeFilters={styleFilters}
          onSelect={(id) => dispatch(toggleStyleFilter(id))}
        />
      </div>

      {/* ── Search ── */}
      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* ── Count row ── */}
      {isFiltering && !isLoading && (
        <div className={styles.countRow}>
          {filtered.length} club{filtered.length !== 1 ? 's' : ''} found
        </div>
      )}

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className={styles.skeletonGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {/* ── Venue grid ── */}
      {!isLoading && filtered.length > 0 && (
        <div className={styles.venueGrid}>
          {filtered.map((venue) => (
            <VenueCard key={venue.placeId} venue={venue} />
          ))}
        </div>
      )}

      {/* ── Empty: no venues imported yet ── */}
      {!isLoading && activeVenues.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🕺</div>
          <p className={styles.emptyTitle}>No clubs yet</p>
          <p className={styles.emptyText}>
            The admin is still curating the best dance spots.{'\n'}Check back soon!
          </p>
        </div>
      )}

      {/* ── Empty: filter returned nothing ── */}
      {!isLoading && activeVenues.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>No matches</p>
          <p className={styles.emptyText}>
            No clubs match your current filters. Try a different style or clear your search.
          </p>
        </div>
      )}
    </>
  )
}
