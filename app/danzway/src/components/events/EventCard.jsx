import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import styles from './EventCard.module.css'

export default function EventCard({ event }) {
  const { id, title, date, time, location, venue, styles: danceStyles, image, price, currency } = event

  const formattedDate = new Date(date).toLocaleDateString('en-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <article className={styles.card}>
      {image ? (
        <div className={styles.imageWrapper}>
          <img src={image} alt={title} className={styles.image} />
          <div className={styles.imageOverlay} />
        </div>
      ) : (
        <div className={styles.imagePlaceholder}>♪</div>
      )}

      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>

        <div className={styles.meta}>
          <span>📅 {formattedDate} · {time}</span>
          <span>📍 {venue}, {location}</span>
        </div>

        <div className={styles.badges}>
          {danceStyles.map((s) => (
            <Badge key={s} label={s} />
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.price}>
          {price} {currency}
        </span>
        <Button as={Link} to={`/events/${id}`} variant="outline">
          Details
        </Button>
      </div>
    </article>
  )
}
