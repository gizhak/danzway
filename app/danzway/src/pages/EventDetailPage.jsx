import { useParams, Link } from 'react-router-dom'
import { mockEvents } from '../data/mockEvents'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import styles from './EventDetailPage.module.css'

export default function EventDetailPage() {
  const { id } = useParams()
  const event = mockEvents.find((e) => e.id === id)

  if (!event) {
    return <p className={styles.notFound}>Event not found.</p>
  }

  const { title, date, time, location, venue, styles: danceStyles, description, price, currency, url } = event

  const formattedDate = new Date(date).toLocaleDateString('en-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <Link to="/" className={styles.back}>← Back to events</Link>

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.meta}>
        <span>📅 {formattedDate} · {time}</span>
        <span>📍 {venue}, {location}</span>
      </div>

      <div className={styles.badges}>
        {danceStyles.map((s) => (
          <Badge key={s} label={s} />
        ))}
      </div>

      <p className={styles.description}>{description}</p>

      <p className={styles.price}>{price} {currency}</p>

      <Button as="a" href={url} target="_blank" rel="noopener noreferrer">
        Get Tickets
      </Button>
    </>
  )
}
