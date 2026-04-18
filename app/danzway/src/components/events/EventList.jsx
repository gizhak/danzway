import { useTranslation } from 'react-i18next'
import EventCard from './EventCard'
import styles from './EventList.module.css'

export default function EventList({ events }) {
  const { t } = useTranslation()
  if (!events || events.length === 0) {
    return <p className={styles.empty}>{t('event.empty')}</p>
  }

  return (
    <div className={styles.feed}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  )
}
