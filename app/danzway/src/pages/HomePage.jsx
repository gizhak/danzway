import { useState, useMemo } from 'react'
import { mockEvents } from '../data/mockEvents'
import EventList from '../components/events/EventList'
import SearchBar from '../components/ui/SearchBar'
import styles from './HomePage.module.css'

function filterEvents(events, query) {
  if (!query.trim()) return events
  const q = query.toLowerCase()
  return events.filter(({ title, location, venue, styles: danceStyles }) =>
    title.toLowerCase().includes(q) ||
    location.toLowerCase().includes(q) ||
    venue.toLowerCase().includes(q) ||
    danceStyles.some((s) => s.toLowerCase().includes(q))
  )
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterEvents(mockEvents, query), [query])

  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Find your next{' '}
          <span className={styles.heroTitleGradient}>dance event</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Salsa, Bachata, Kizomba, Zouk and more — all in one place.
        </p>
      </section>

      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Upcoming Events</h2>
          {query && (
            <span className={styles.resultCount}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {filtered.length > 0 ? (
          <EventList events={filtered} />
        ) : (
          <p className={styles.noResults}>No events match "{query}".</p>
        )}
      </section>
    </>
  )
}
