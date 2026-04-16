import { useState, useMemo } from 'react'
import { mockEvents } from '../data/mockEvents'
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
  const [query, setQuery]             = useState('')
  const [styleFilter, setStyleFilter] = useState('all')

  const filtered = useMemo(
    () => filterEvents(mockEvents, query, styleFilter),
    [query, styleFilter]
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
        <StyleFilterRow active={styleFilter} onSelect={setStyleFilter} />
      </div>

      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Upcoming Events</h2>
          {(query || styleFilter !== 'all') && (
            <span className={styles.resultCount}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {filtered.length > 0 ? (
          <EventList events={filtered} />
        ) : (
          <p className={styles.noResults}>No events match your filters.</p>
        )}
      </section>
    </>
  )
}
