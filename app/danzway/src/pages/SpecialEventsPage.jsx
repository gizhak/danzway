import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { fetchEvents, selectEventsStatus } from '../store/appSlice'
import { fetchVenues, selectVenuesStatus } from '../store/venuesSlice'
import { selectActiveSpecialEvents } from '../store/selectors'
import EventCard from '../components/events/EventCard'
import SearchBar from '../components/ui/SearchBar'
import SubmitEventModal from '../components/ui/SubmitEventModal'
import styles from './SpecialEventsPage.module.css'

// Hebrew → English city aliases for bilingual search
const HE_TO_EN = {
  'תל אביב': 'tel aviv', 'ת"א': 'tel aviv',
  'ירושלים': 'jerusalem',
  'חיפה': 'haifa',
  'ראשון': 'rishon', 'ראשון לציון': 'rishon lezion',
  'נתניה': 'netanya',
  'אשדוד': 'ashdod',
  'אשקלון': 'ashkelon',
  'פתח תקוה': 'petah tikva', 'פ"ת': 'petah tikva',
  'הרצליה': 'herzliya',
  'רמת גן': 'ramat gan',
  'גבעתיים': 'givatayim',
  'בני ברק': 'bnei brak',
  'חולון': 'holon',
  'בת ים': 'bat yam',
  'כפר סבא': 'kfar saba',
  'רעננה': 'raanana',
  'מודיעין': 'modiin',
  'אילת': 'eilat',
  'באר שבע': 'beer sheva',
  'רחובות': 'rehovot',
  'חדרה': 'hadera',
  'נס ציונה': 'nes ziona',
  'לוד': 'lod',
  'רמלה': 'ramla',
  'הוד השרון': 'hod hasharon',
  'רמת השרון': 'ramat hasharon',
  'כפר יונה': 'kfar yona',
  'יבנה': 'yavne',
  'קריית גת': 'kiryat gat',
}

function matchesQuery(text, q, qEn) {
  if (!text) return false
  const t = text.toLowerCase()
  return t.includes(q) || (qEn && t.includes(qEn))
}

export default function SpecialEventsPage() {
  const [query,       setQuery]      = useState('')
  const [submitOpen,  setSubmitOpen] = useState(false)
  const dispatch           = useDispatch()
  const { t }              = useTranslation()
  const events             = useSelector(selectActiveSpecialEvents)
  const eventsStatus       = useSelector(selectEventsStatus)
  const venuesStatus       = useSelector(selectVenuesStatus)

  useEffect(() => {
    if (eventsStatus === 'idle') dispatch(fetchEvents())
  }, [eventsStatus, dispatch])

  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [venuesStatus, dispatch])

  const filtered = useMemo(() => {
    if (!query.trim()) return events
    const q   = query.toLowerCase()
    const qEn = HE_TO_EN[q] ?? HE_TO_EN[query.trim()] ?? null
    return events.filter(
      ({ title, venue, location, city, styles: danceStyles = [] }) =>
        matchesQuery(title,    q, qEn) ||
        matchesQuery(venue,    q, qEn) ||
        matchesQuery(location, q, qEn) ||
        matchesQuery(city,     q, qEn) ||
        danceStyles.some((s) => s.toLowerCase().includes(q))
    )
  }, [events, query])

  const isLoading = eventsStatus === 'loading' || venuesStatus === 'loading'

  return (
    <>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroStarRow}>⭐</div>
        <h1 className={styles.heroTitle}>
          {t('festivals.hero.title')}{' '}
          <span className={styles.heroTitleGradient}>{t('festivals.hero.highlight')}</span>
        </h1>
        <p className={styles.heroSubtitle}>{t('festivals.hero.subtitle')}</p>
      </section>

      {/* ── Search + submit row ── */}
      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <button className={styles.submitTrigger} onClick={() => setSubmitOpen(true)}>
        {t('submitEvent.trigger')}
      </button>

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div className={styles.skeletonGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {/* ── Events feed ── */}
      {!isLoading && filtered.length > 0 && (
        <div className={styles.feed}>
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* ── Empty: no special events exist ── */}
      {!isLoading && events.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⭐</div>
          <p className={styles.emptyTitle}>{t('festivals.empty.noEvents.title')}</p>
          <p className={styles.emptyText}>{t('festivals.empty.noEvents.text')}</p>
        </div>
      )}

      {/* ── Empty: search returned nothing ── */}
      {!isLoading && events.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>{t('parties.empty.noMatch.title')}</p>
          <p className={styles.emptyText}>{t('parties.empty.noMatch.text')}</p>
        </div>
      )}
      {submitOpen && <SubmitEventModal onClose={() => setSubmitOpen(false)} />}
    </>
  )
}
