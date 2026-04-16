import { mockEvents } from '../data/mockEvents'
import EventList from '../components/events/EventList'
import styles from './HomePage.module.css'

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Find your next <span>dance event</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Salsa, Bachata, Kizomba, Zouk and more — all in one place.
        </p>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Upcoming Events</h2>
        <EventList events={mockEvents} />
      </section>
    </>
  )
}
