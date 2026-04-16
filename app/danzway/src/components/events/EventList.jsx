import EventCard from './EventCard'
import styles from './EventList.module.css'

export default function EventList({ events }) {
  if (!events || events.length === 0) {
    return <p className={styles.empty}>No events found.</p>
  }

  return (
    <div className={styles.feed}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
