import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
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
      safeFilters.some((style) =>
        (v.styles ?? []).some((s) => s.toLowerCase() === style.toLowerCase())
      )
    )
  }

  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      ({ name, city, address, categories, categoriesHe, tags }) =>
        name?.toLowerCase().includes(q) ||
        city?.toLowerCase().includes(q) ||
        address?.toLowerCase().includes(q) ||
        (categories    ?? []).some((c) => c.toLowerCase().includes(q)) ||
        (categoriesHe  ?? []).some((c) => c.includes(query.trim())) ||
        (tags          ?? []).some((tag) => tag.toLowerCase().includes(q))
    )
  }

  return result
}

export default function HomePage() {
  const [query,   setQuery]   = useState('')
  const dispatch              = useDispatch()
  const { t }                 = useTranslation()
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
    () => {
      return filterVenues(activeVenues, query, styleFilters)
    },
    [activeVenues, query, styleFilters]
  )

  const isLoading  = venuesStatus === 'loading'
  const isFiltering = (Array.isArray(styleFilters) && styleFilters.length > 0) || query.trim().length > 0

  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          {t('home.hero.title')}{' '}
          <span className={styles.heroTitleGradient}>{t('home.hero.highlight')}</span>
        </h1>
        <p className={styles.heroSubtitle}>{t('home.hero.subtitle')}</p>
      </section>

      {/* ── Sticky filter + search bar ── */}
      <div className={styles.stickyBar}>
        <div className={styles.filterRow}>
          <StyleFilterRow
            activeFilters={styleFilters}
            onSelect={(id) => dispatch(toggleStyleFilter(id))}
          />
        </div>
        <div className={styles.searchRow}>
          <SearchBar value={query} onChange={setQuery} />
        </div>
      </div>

      {/* ── Count row ── */}
      {isFiltering && !isLoading && (
        <div className={styles.countRow}>
          {t('home.count', { count: filtered.length })}
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
          <p className={styles.emptyTitle}>{t('home.empty.noClubs.title')}</p>
          <p className={styles.emptyText}>{t('home.empty.noClubs.text')}</p>
        </div>
      )}

      {/* ── Empty: filter returned nothing ── */}
      {!isLoading && activeVenues.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>{t('home.empty.noMatch.title')}</p>
          <p className={styles.emptyText}>{t('home.empty.noMatch.text')}</p>
        </div>
      )}
    </>
  )
}
