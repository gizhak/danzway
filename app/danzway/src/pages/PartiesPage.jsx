import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import {
  selectEventsStatus,
  selectStyleFilters,
  toggleStyleFilter,
  fetchEvents,
} from '../store/appSlice'
import {
  fetchVenues,
  selectVenuesStatus,
} from '../store/venuesSlice'
import { selectEventsForActiveVenues } from '../store/selectors'
import EventCard from '../components/events/EventCard'
import StyleFilterRow from '../components/events/StyleFilterRow'
import SearchBar from '../components/ui/SearchBar'
import styles from './PartiesPage.module.css'

function applyFilters(events, query, styleFilters) {
  let result = events  // already future-only and sorted by the selector

  // Style filter (AND logic)
  const safeFilters = Array.isArray(styleFilters) ? styleFilters : []
  if (safeFilters.length > 0) {
    result = result.filter((e) =>
      safeFilters.some((style) =>
        (e.styles ?? []).some((s) => s.toLowerCase() === style.toLowerCase())
      )
    )
  }

  // Search filter
  if (query.trim()) {
    const q = query.toLowerCase()
    result = result.filter(
      ({ title, venue, location, styles: danceStyles = [] }) =>
        title?.toLowerCase().includes(q) ||
        venue?.toLowerCase().includes(q) ||
        location?.toLowerCase().includes(q) ||
        danceStyles.some((s) => s.toLowerCase().includes(q))
    )
  }

  return result
}

export default function PartiesPage() {
  const [query, setQuery] = useState('')
  const dispatch          = useDispatch()
  const { t }             = useTranslation()
  const events            = useSelector(selectEventsForActiveVenues)
  const eventsStatus      = useSelector(selectEventsStatus)
  const venuesStatus      = useSelector(selectVenuesStatus)
  const styleFilters      = useSelector(selectStyleFilters)

  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [venuesStatus, dispatch])

  const filtered = useMemo(
    () => applyFilters(events, query, styleFilters),
    [events, query, styleFilters]
  )

  const isLoading   = eventsStatus === 'loading' || venuesStatus === 'loading'
  const isFiltering = (Array.isArray(styleFilters) && styleFilters.length > 0) || query.trim().length > 0

  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          {t('parties.hero.title')}{' '}
          <span className={styles.heroTitleGradient}>{t('parties.hero.highlight')}</span>
        </h1>
        <p className={styles.heroSubtitle}>{t('parties.hero.subtitle')}</p>
      </section>

      {/* ── Style filter bubbles ── */}
      <div className={styles.filterRow}>
        <StyleFilterRow
          activeFilters={styleFilters}
          onSelect={(id) => { dispatch(toggleStyleFilter(id)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        />
      </div>

      {/* ── Search ── */}
      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      {/* ── Count row ── */}
      {isFiltering && !isLoading && (
        <div className={styles.countRow}>
          {t('parties.count', { count: filtered.length })}
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

      {/* ── Events list ── */}
      {!isLoading && filtered.length > 0 && (
        <div className={styles.feed}>
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* ── Empty: no events for active venues ── */}
      {!isLoading && events.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎉</div>
          <p className={styles.emptyTitle}>{t('parties.empty.noParties.title')}</p>
          <p className={styles.emptyText}>{t('parties.empty.noParties.text')}</p>
        </div>
      )}

      {/* ── Empty: filter returned nothing ── */}
      {!isLoading && events.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>{t('parties.empty.noMatch.title')}</p>
          <p className={styles.emptyText}>{t('parties.empty.noMatch.text')}</p>
        </div>
      )}

    </>
  )
}
