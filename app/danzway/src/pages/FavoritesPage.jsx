import { useState, useMemo, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectSavedIds, selectSavedVenueIds } from '../store/appSlice'
import {
  selectActiveVenues,
  selectVenuesStatus,
  fetchVenues,
} from '../store/venuesSlice'
import { selectEventsForActiveVenues } from '../store/selectors'
import { parseLocalDate } from '../i18n/dateUtils'
import EventCard from '../components/events/EventCard'
import VenueCard from '../components/venues/VenueCard'
import styles from './FavoritesPage.module.css'

const FILTERS = ['all', 'parties', 'clubs']

export default function FavoritesPage() {
  const [filter, setFilter] = useState('all')
  const dispatch             = useDispatch()
  const { t }                = useTranslation()

  const savedIds      = useSelector(selectSavedIds)
  const savedVenueIds = useSelector(selectSavedVenueIds)
  // Use the same merged list PartiesPage uses (real + recurring virtual events)
  const allEvents     = useSelector(selectEventsForActiveVenues)
  const allVenues     = useSelector(selectActiveVenues)
  const venuesStatus  = useSelector(selectVenuesStatus)

  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [venuesStatus, dispatch])

  const { todayEvents, futureEvents } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const todayEvents  = []
    const futureEvents = []
    allEvents.forEach((e) => {
      if (!savedIds[e.id] || !e.date) return
      const d = parseLocalDate(e.date)
      if (d < today) return
      if (d < tomorrow) todayEvents.push(e)
      else futureEvents.push(e)
    })
    return { todayEvents, futureEvents }
  }, [allEvents, savedIds])

  const savedEvents = useMemo(() => [...todayEvents, ...futureEvents], [todayEvents, futureEvents])

  // Debug
  useEffect(() => {
    console.log('[Favorites] allEvents:', allEvents.length, '| savedIds:', Object.keys(savedIds), '| savedEvents:', savedEvents.length)
  }, [allEvents, savedIds, savedEvents])

  const savedVenues = useMemo(
    () => allVenues.filter((v) => savedVenueIds[v.placeId]),
    [allVenues, savedVenueIds]
  )

  const showEvents = filter === 'all' || filter === 'parties'
  const showVenues = filter === 'all' || filter === 'clubs'

  const totalCount =
    (showEvents ? savedEvents.length : 0) +
    (showVenues ? savedVenues.length : 0)

  const isEmpty = savedEvents.length === 0 && savedVenues.length === 0

  return (
    <>
      {/* ── Scrollable hero ── */}
      <div className={styles.hero}>
        <h1 className={styles.heroTitle}>{t('favorites.title')}</h1>
        <p className={styles.heroSubtitle}>{t('favorites.subtitle')}</p>
      </div>

      {/* ── Sticky filter chips ── */}
      <div className={styles.stickyBar}>
        <div className={styles.filterRow}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`${styles.filterChip} ${filter === f ? styles.filterChipActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {t(`favorites.filter_${f}`)}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>♡</div>
          <div className={styles.emptyTitle}>{t('favorites.emptyTitle')}</div>
          <div className={styles.emptyText}>{t('favorites.emptyText')}</div>
        </div>
      ) : (
        <div className={styles.content}>

          {/* ── Today's events — always first ── */}
          {showEvents && todayEvents.length > 0 && (
            <section>
              <h2 className={`${styles.sectionHeader} ${styles.sectionHeaderToday}`}>
                🔥 {t('favorites.today', 'היום')}
              </h2>
              {todayEvents.map((e) => (
                <div key={e.id} className={styles.todayCardWrap}>
                  <EventCard event={e} />
                </div>
              ))}
            </section>
          )}

          {/* ── Saved venues ── */}
          {showVenues && savedVenues.length > 0 && (
            <section>
              {filter === 'all' && (
                <h2 className={styles.sectionHeader}>{t('favorites.clubs')}</h2>
              )}
              {savedVenues.map((v) => <VenueCard key={v.placeId} venue={v} />)}
            </section>
          )}

          {/* ── Future events ── */}
          {showEvents && futureEvents.length > 0 && (
            <section>
              {(filter === 'all' || todayEvents.length > 0) && (
                <h2 className={styles.sectionHeader}>{t('favorites.parties')}</h2>
              )}
              {futureEvents.map((e) => <EventCard key={e.id} event={e} />)}
            </section>
          )}

          {totalCount === 0 && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>♡</div>
              <div className={styles.emptyTitle}>{t('favorites.emptyTitle')}</div>
              <div className={styles.emptyText}>{t('favorites.emptyText')}</div>
            </div>
          )}
        </div>
      )}

    </>
  )
}
