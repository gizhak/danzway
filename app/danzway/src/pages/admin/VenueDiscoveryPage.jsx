import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import {
  fetchVenues,
  selectAllVenues,
  selectVenuesStatus,
  selectImportedPlaceIds,
  updateVenueField,
} from '../../store/venuesSlice'
import { fetchEvents, selectAllEvents } from '../../store/appSlice'
import { selectEventsForActiveVenues } from '../../store/selectors'
import {
  searchDanceVenues,
  getFullVenueDetails,
  importVenuesToFirestore,
} from '../../services/googlePlaces'
import {
  saveEventToFirestore,
  saveEventOverride,
  cancelEventInstance,
  updateEventInFirestore,
} from '../../services/eventsService'
import { crawlVenueWebsite } from '../../services/eventCrawler'
import EditEventModal from '../../components/admin/EditEventModal'
import {
  loadPendingEvents,
  upsertPendingEvents,
  approveEvent,
  rejectEvent,
  approveAllPending,
} from '../../services/pendingEventsService'
import styles from './VenueDiscoveryPage.module.css'

// ─── Cloudinary ───────────────────────────────────────────────────────────────

const CLOUDINARY_CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

async function uploadToCloudinary(file) {
  if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new Error('Cloudinary not configured — add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env.local')
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: fd }
  )
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`)
  return (await res.json()).secure_url
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function containsHebrew(str) {
  return /[\u0590-\u05FF]/.test(str)
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Focused on Salsa, Bachata, Kizomba — the three core styles of DanzWay.
// Broad terms like "dance school" or "tango" brought in irrelevant venues.
const AUTO_QUERIES = [
  'salsa bachata club Tel Aviv',
  'salsa club Israel',
  'bachata club Israel',
  'kizomba Tel Aviv',
  'kizomba club Israel',
  'latin dance club Tel Aviv',
  'latin dance club Israel',
  'מועדון לטיני תל אביב',
  'מועדון סלסה בכטה ישראל',
  'salsa bachata Jerusalem',
  'salsa club Haifa Israel',
  'bachata kizomba Rishon LeZion',
  'latin social dance Israel',
]

const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Tango', 'West Coast Swing', 'Social']
const DAY_NAMES    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Search results cache (localStorage, 24 h TTL) ────────────────────────────
const SEARCH_CACHE_KEY = 'danzway_venue_search_cache'
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000

function loadSearchCache() {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (!cached.timestamp || !Array.isArray(cached.results)) return null
    if (Date.now() - cached.timestamp > SEARCH_CACHE_TTL) return null
    return cached   // { results, timestamp }
  } catch { return null }
}

function saveSearchCache(results) {
  try {
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify({ results, timestamp: Date.now() }))
  } catch { /* storage quota exceeded */ }
}

function clearSearchCache() {
  try { localStorage.removeItem(SEARCH_CACHE_KEY) } catch { /* ignore */ }
}

// ─── StarRating ────────────────────────────────────────────────────────────────

function StarRating({ rating, count }) {
  if (!rating) return null
  return (
    <span className={styles.rating}>
      <span className={styles.ratingStar}>★</span>
      <span className={styles.ratingNum}>{rating.toFixed(1)}</span>
      {count > 0 && (
        <span className={styles.ratingCount}>({count.toLocaleString()})</span>
      )}
    </span>
  )
}

// ─── ReviewItem ────────────────────────────────────────────────────────────────

function ReviewItem({ review }) {
  return (
    <div className={styles.review}>
      <div className={styles.reviewAuthorRow}>
        {review.authorPhoto ? (
          <img src={review.authorPhoto} alt={review.author} className={styles.reviewAvatar} />
        ) : (
          <div className={styles.reviewAvatarFallback}>
            {review.author?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}
        <div className={styles.reviewMeta}>
          <span className={styles.reviewAuthor}>{review.author}</span>
          <span className={styles.reviewTime}>{review.relativeTime}</span>
        </div>
        {review.rating && (
          <span className={styles.reviewStars}>{'★'.repeat(Math.min(review.rating, 5))}</span>
        )}
      </div>
      <p className={styles.reviewText}>{review.text}</p>
    </div>
  )
}

// ─── ExpandedDetails ──────────────────────────────────────────────────────────

function ExpandedDetails({ entry }) {
  if (!entry || entry.status === 'loading') {
    return (
      <div className={styles.detailsLoading}>
        <span className={styles.loadingDot} />
        <span className={styles.loadingDot} />
        <span className={styles.loadingDot} />
      </div>
    )
  }
  if (entry.status === 'error' || !entry.data) {
    return <p className={styles.detailsError}>Could not load venue details.</p>
  }
  const { photos, reviews, phone, website } = entry.data
  return (
    <div className={styles.details}>
      {photos?.length > 0 && (
        <div className={styles.gallery}>
          {photos.map((url, i) => (
            <img key={i} src={url} alt={`Photo ${i + 1}`} className={styles.galleryPhoto} loading="lazy" />
          ))}
        </div>
      )}
      {(phone || website) && (
        <div className={styles.contactRow}>
          {phone && <span className={styles.contactItem}>📞 {phone}</span>}
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className={styles.contactLink}>
              🌐 Website →
            </a>
          )}
        </div>
      )}
      {reviews?.length > 0 && (
        <div className={styles.reviews}>
          <div className={styles.reviewsTitle}>What people say</div>
          {reviews.map((r, i) => <ReviewItem key={i} review={r} />)}
        </div>
      )}
    </div>
  )
}

// ─── VenueResultCard ──────────────────────────────────────────────────────────

function VenueResultCard({
  venue,
  isSelected,
  isImported,
  importedVenueData,
  isExpanded,
  detailsEntry,
  onToggleSelect,
  onExpand,
  onToggleActive,
}) {
  const { name, address, categories, rating, reviewCount, thumbnail } = venue
  const isActive = importedVenueData?.active === true

  return (
    <article className={[styles.card, isSelected ? styles.cardSelected : ''].join(' ')}>
      <div className={styles.cardThumb}>
        {thumbnail ? (
          <img src={thumbnail} alt={name} className={styles.cardThumbImg} />
        ) : (
          <div className={styles.cardThumbPlaceholder}>🎵</div>
        )}

        {isImported ? (
          <button
            className={[styles.vToggleCard, isActive ? styles.vToggleCardOn : ''].join(' ')}
            onClick={(e) => { e.stopPropagation(); onToggleActive(venue.placeId, !isActive) }}
            title={isActive ? 'Live — tap to hide' : 'Hidden — tap to go live'}
          >
            {isActive ? '● Live' : '○ Off'}
          </button>
        ) : (
          <button
            className={[styles.checkbox, isSelected ? styles.checkboxChecked : ''].join(' ')}
            onClick={onToggleSelect}
            aria-label={isSelected ? 'Deselect' : 'Select'}
          >
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardName}>{name}</div>
        <div className={styles.cardAddress}>{address}</div>
        {categories?.length > 0 && (
          <div className={styles.cardCategories}>
            {categories.slice(0, 2).map((c) => (
              <span key={c.en} className={styles.categoryBadge}>{c.en}</span>
            ))}
          </div>
        )}
        <div className={styles.cardFooter}>
          <StarRating rating={rating} count={reviewCount} />
          <button
            className={[styles.detailsBtn, isExpanded ? styles.detailsBtnOpen : ''].join(' ')}
            onClick={onExpand}
          >
            {isExpanded ? 'Hide ▲' : 'Details ▼'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <ExpandedDetails entry={detailsEntry} />
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

// ─── AddPartyForm ─────────────────────────────────────────────────────────────

function AddPartyForm({ venue, onSave, onCancel, isSaving }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    title:       `${venue.name} — Party Night`,
    date:        today,
    time:        '21:00',
    description: '',
    price:       '0',
    currency:    'ILS',
    whatsapp:    venue.phone ?? '',
  })

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const canSave = form.title.trim() && form.date

  return (
    <div className={styles.editFormInner}>
      <p className={styles.editFormHint}>
        Create a one-time event for <strong style={{ color: 'rgba(245,158,11,0.85)' }}>{venue.name}</strong>.
        It will appear immediately in the PARTIES tab.
      </p>

      <input
        className={styles.editInput}
        type="text"
        placeholder="Event title*"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        autoFocus
      />

      <div className={styles.addPartyDateTimeRow}>
        <input
          className={styles.editInput}
          type="date"
          value={form.date}
          onChange={(e) => set('date', e.target.value)}
        />
        <input
          className={styles.editInput}
          type="time"
          value={form.time}
          onChange={(e) => set('time', e.target.value)}
        />
      </div>

      <textarea
        className={styles.addPartyTextarea}
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        rows={2}
      />

      <div className={styles.addPartyDateTimeRow}>
        <input
          className={styles.editInput}
          type="text"
          placeholder="Price (0 = free)"
          value={form.price}
          onChange={(e) => set('price', e.target.value)}
          style={{ maxWidth: '90px' }}
        />
        <input
          className={styles.editInput}
          type="text"
          placeholder="WhatsApp (+972…)"
          value={form.whatsapp}
          onChange={(e) => set('whatsapp', e.target.value)}
        />
      </div>

      <div className={styles.editFormActions}>
        <button
          className={styles.editSaveBtn}
          onClick={() => onSave(form)}
          disabled={isSaving || !canSave}
        >
          {isSaving ? 'Saving…' : '🎉 Create Party'}
        </button>
        <button className={styles.editCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ─── RecurringScheduleEditor ──────────────────────────────────────────────────

function RecurringScheduleEditor({ venue, onSave, onCancel, isSaving }) {
  const existing = venue.recurringSchedule ?? {}
  const [days,        setDays]        = useState(existing.days        ?? [])
  const [time,        setTime]        = useState(existing.time        ?? '21:00')
  const [title,       setTitle]       = useState(existing.title       ?? '')
  const [description, setDescription] = useState(existing.description ?? '')

  function toggleDay(d) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    )
  }

  return (
    <div className={styles.editFormInner}>
      <p className={styles.editFormHint}>
        Pick which days this club runs a regular event.
        DanzWay will auto-generate party cards for the next 8 weeks.
      </p>

      <div className={styles.dayPickerRow}>
        {DAY_NAMES.map((name, i) => (
          <button
            key={i}
            className={[styles.dayBtn, days.includes(i) ? styles.dayBtnOn : ''].join(' ')}
            onClick={() => toggleDay(i)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className={styles.addPartyDateTimeRow}>
        <input
          className={styles.editInput}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          style={{ maxWidth: '120px' }}
        />
        <input
          className={styles.editInput}
          type="text"
          placeholder="Event title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <textarea
        className={styles.addPartyTextarea}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />

      <div className={styles.editFormActions}>
        <button
          className={styles.editSaveBtn}
          onClick={() => onSave({ days, time, title, description })}
          disabled={isSaving || days.length === 0}
        >
          {isSaving ? 'Saving…' : `↻ Save Schedule (${days.length} day${days.length !== 1 ? 's' : ''})`}
        </button>
        <button className={styles.editCancelBtn} onClick={onCancel}>
          {existing.days?.length ? 'Cancel' : 'Skip'}
        </button>
      </div>

      {existing.days?.length > 0 && (
        <button
          className={styles.clearScheduleBtn}
          onClick={() => onSave({ days: [], time: '21:00', title: '', description: '' })}
          disabled={isSaving}
        >
          ✕ Clear schedule
        </button>
      )}
    </div>
  )
}

// ─── ManageEventsPanel ────────────────────────────────────────────────────────

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ManageEventsPanel({ venueEvents, onEdit, onCancel }) {
  if (venueEvents.length === 0) {
    return (
      <div className={styles.eventsPanel}>
        <div className={styles.eventsPanelTitle}>Upcoming Events</div>
        <p className={styles.eventsPanelEmpty}>No upcoming events. Add a party or set a recurring schedule.</p>
      </div>
    )
  }

  return (
    <div className={styles.eventsPanel}>
      <div className={styles.eventsPanelTitle}>
        Upcoming Events ({venueEvents.length})
      </div>
      {venueEvents.map((event) => {
        const d = new Date(event.date)
        const dayLabel = DAY_SHORT[d.getDay()]
        const dateLabel = d.toLocaleDateString('en-IL', { day: 'numeric', month: 'short' })
        const isRecurring = !!event.isRecurring
        const isOverride  = !!event.isOverride

        return (
          <div key={event.id} className={styles.eventRow}>
            <div className={styles.eventRowDate}>{dayLabel} {dateLabel}</div>
            <div className={styles.eventRowTime}>{event.time}</div>
            <div className={styles.eventRowTitle}>{event.title}</div>
            <span className={[
              styles.eventRowBadge,
              isOverride  ? styles.eventRowBadgeOverride  :
              isRecurring ? styles.eventRowBadgeRecurring :
                            styles.eventRowBadgeReal,
            ].join(' ')}>
              {isOverride ? '✎ Edited' : isRecurring ? '↺ Weekly' : '● Saved'}
            </span>
            <div className={styles.eventRowActions}>
              <button
                className={styles.eventEditBtn}
                onClick={() => onEdit(event)}
                title="Edit this occurrence"
              >
                ✎
              </button>
              <button
                className={styles.eventCancelBtn}
                onClick={() => onCancel(event)}
                title={isRecurring ? 'Cancel this date only' : 'Delete this event'}
              >
                ✕
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ImportedVenueRow ─────────────────────────────────────────────────────────

function ImportedVenueRow({
  venue,
  // logo editing
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveLogo,
  isSaving,
  // cloudinary image upload
  isUploadingImage,
  onUploadImage,
  // add party
  isAddingParty,
  onStartAddParty,
  onCancelAddParty,
  onCreateParty,
  isSavingParty,
  // recurring schedule
  isEditingSchedule,
  onStartEditSchedule,
  onCancelEditSchedule,
  onSaveSchedule,
  isSavingSchedule,
  // per-venue scan
  isScanning,
  scanResult,
  onScan,
  // manage events panel
  isManagingEvents,
  onToggleManageEvents,
  venueEvents,
  onEditEvent,
  onCancelEvent,
  // other
  onToggleActive,
  onToggleStyle,
  onSaveSocialField,
}) {
  const {
    name, city, categories, rating, reviewCount,
    logo, photos, active, styles: venueStyles = [],
    recurringSchedule, customImageUrl,
  } = venue

  const fileInputRef = useRef(null)
  const thumb = customImageUrl ?? logo ?? photos?.[0] ?? null
  const [inputUrl,  setInputUrl]  = useState('')
  const [igHandle,   setIgHandle]   = useState(venue.instagram         ?? '')
  const [fbHandle,   setFbHandle]   = useState(venue.facebook          ?? '')
  const [igPostUrl,  setIgPostUrl]  = useState(venue.instagramPostUrl  ?? '')
  const [ticketUrl,  setTicketUrl]  = useState(venue.ticketUrl         ?? '')

  useEffect(() => setIgHandle(venue.instagram ?? ''),         [venue.instagram])
  useEffect(() => setFbHandle(venue.facebook ?? ''),          [venue.facebook])
  useEffect(() => setIgPostUrl(venue.instagramPostUrl ?? ''), [venue.instagramPostUrl])
  useEffect(() => setTicketUrl(venue.ticketUrl ?? ''),        [venue.ticketUrl])

  async function handleSaveLogo() {
    const url = inputUrl.trim()
    if (!url) return
    await onSaveLogo(venue.placeId, url)
    setInputUrl('')
  }

  function handleSocialBlur(field, value) {
    onSaveSocialField(venue.placeId, field, value.trim())
  }

  const hasSchedule = (recurringSchedule?.days ?? []).length > 0
  const scheduleLabel = hasSchedule
    ? recurringSchedule.days.map((d) => DAY_NAMES[d]).join(' · ')
    : null

  return (
    <div
      className={[
        styles.importedRowWrap,
        (isEditing || isAddingParty || isEditingSchedule) ? styles.importedRowWrapEditing : '',
        active ? styles.importedRowWrapActive : '',
      ].join(' ')}
    >
      {/* ── Main row ── */}
      <div className={styles.importedRow}>
        {/* Hidden file input for Cloudinary upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUploadImage(file)
            e.target.value = ''
          }}
        />

        <div className={styles.importedThumb}>
          {thumb ? (
            <img src={thumb} alt={name} className={styles.importedThumbImg} />
          ) : (
            <div className={styles.importedThumbPlaceholder}>🎵</div>
          )}
          {customImageUrl && (
            <span className={styles.customImgBadge} title="Custom Cloudinary image">☁</span>
          )}
        </div>

        <div className={styles.importedInfo}>
          <div className={styles.importedName}>{name}</div>
          <div className={styles.importedCity}>{city}</div>
          {categories?.length > 0 && (
            <div className={styles.importedCategories}>
              {categories.slice(0, 2).map((c) => (
                <span key={c} className={styles.categoryBadge}>{c}</span>
              ))}
            </div>
          )}
          {hasSchedule && (
            <div className={styles.schedulePill}>↻ {scheduleLabel} · {recurringSchedule.time}</div>
          )}
        </div>

        <button
          className={[styles.vTogglePill, active ? styles.vTogglePillOn : ''].join(' ')}
          onClick={() => onToggleActive(venue.placeId, !active)}
          title={active ? 'Live — tap to hide from feed' : 'Hidden — tap to go live'}
        >
          <span className={styles.vToggleDot} />
          {active ? 'Live' : 'Hidden'}
        </button>
      </div>

      {/* ── Style chips ── */}
      <div className={styles.styleChipsRow}>
        {DANCE_STYLES.map((style) => {
          const assigned = venueStyles.includes(style)
          return (
            <button
              key={style}
              className={[styles.styleChip, assigned ? styles.styleChipOn : ''].join(' ')}
              onClick={() => onToggleStyle(venue.placeId, style, venueStyles)}
            >
              {style}
            </button>
          )
        })}
      </div>

      {/* ── Ticket / Event link (crawler priority) ── */}
      <div className={styles.ticketRow}>
        <div className={styles.ticketRowLabel}>🎟 Ticket / Event link</div>
        <div className={styles.socialInputGroup}>
          <input
            className={[styles.socialInput, styles.ticketInput].join(' ')}
            type="url"
            placeholder="Meety, Eventbrite, venue events page… (used by crawler)"
            value={ticketUrl}
            onChange={(e) => setTicketUrl(e.target.value)}
            onBlur={(e) => handleSocialBlur('ticketUrl', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSocialBlur('ticketUrl', ticketUrl)}
          />
          {ticketUrl && (
            <a
              href={ticketUrl}
              target="_blank" rel="noopener noreferrer"
              className={styles.socialOpenBtn}
              title="Open ticket link"
            >
              🔗
            </a>
          )}
        </div>
      </div>

      {/* ── Social inputs + shortcut links ── */}
      <div className={styles.socialRow}>
        <div className={styles.socialInputGroup}>
          <input
            className={styles.socialInput}
            type="text"
            placeholder="@instagram"
            value={igHandle}
            onChange={(e) => setIgHandle(e.target.value)}
            onBlur={(e) => handleSocialBlur('instagram', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSocialBlur('instagram', igHandle)}
          />
          {igHandle && (
            <a
              href={igHandle.startsWith('http') ? igHandle : `https://instagram.com/${igHandle.replace(/^@/, '')}`}
              target="_blank" rel="noopener noreferrer"
              className={styles.socialOpenBtn}
              title="Open Instagram"
            >
              📸
            </a>
          )}
        </div>
        <div className={styles.socialInputGroup}>
          <input
            className={styles.socialInput}
            type="text"
            placeholder="@facebook"
            value={fbHandle}
            onChange={(e) => setFbHandle(e.target.value)}
            onBlur={(e) => handleSocialBlur('facebook', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSocialBlur('facebook', fbHandle)}
          />
          {fbHandle && (
            <a
              href={fbHandle.startsWith('http') ? fbHandle : `https://facebook.com/${fbHandle.replace(/^@/, '')}`}
              target="_blank" rel="noopener noreferrer"
              className={styles.socialOpenBtn}
              title="Open Facebook"
            >
              👍
            </a>
          )}
        </div>
        <input
          className={styles.socialInput}
          type="url"
          placeholder="Instagram post URL"
          value={igPostUrl}
          onChange={(e) => setIgPostUrl(e.target.value)}
          onBlur={(e) => handleSocialBlur('instagramPostUrl', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSocialBlur('instagramPostUrl', igPostUrl)}
        />
      </div>

      {/* ── Action buttons row ── */}
      <div className={styles.importedActionsRow}>
        <div className={styles.importedActionsLeft}>
          <StarRating rating={rating} count={reviewCount} />
          {/* Per-venue scan result badge */}
          {scanResult && (
            <span className={[
              styles.venueScanBadge,
              scanResult.status === 'found'     ? styles.venueScanBadgeFound :
              scanResult.status === 'no_events' ? styles.venueScanBadgeNone  :
              styles.venueScanBadgeError,
            ].join(' ')}>
              {scanResult.status === 'found'     && `✓ ${scanResult.newCount} new / ${scanResult.count} total`}
              {scanResult.status === 'no_events' && '○ No events found'}
              {scanResult.status === 'blocked'   && '✗ Site blocked'}
              {scanResult.status === 'timeout'   && '⏱ Timed out'}
              {scanResult.status === 'error'     && `! ${scanResult.error ?? 'Error'}`}
            </span>
          )}
        </div>
        <div className={styles.importedButtons}>
          <button
            className={[styles.scanVenueBtn, isScanning ? styles.scanVenueBtnActive : ''].join(' ')}
            onClick={onScan}
            disabled={isScanning}
            title="Scan this venue's ticket/event link for upcoming events"
          >
            {isScanning ? <><span className={styles.scanVenueSpinner} /> Scanning…</> : '🔍 Scan'}
          </button>
          <button
            className={[styles.manageEventsBtn, isManagingEvents ? styles.manageEventsBtnActive : ''].join(' ')}
            onClick={onToggleManageEvents}
            title="See and manage all upcoming events for this venue"
          >
            📅 Events {venueEvents.length > 0 && `(${venueEvents.length})`}
          </button>
          <button
            className={[styles.editPhotoBtn, isEditing ? styles.editPhotoBtnActive : ''].join(' ')}
            onClick={isEditing ? onCancelEdit : onStartEdit}
          >
            {isEditing ? '✕' : '🖼 Logo'}
          </button>
          <button
            className={[styles.uploadImageBtn, isUploadingImage ? styles.editPhotoBtnActive : ''].join(' ')}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            title="Upload venue image to Cloudinary"
          >
            {isUploadingImage ? '⏳ Uploading…' : '☁ Upload'}
          </button>
          <button
            className={[styles.recurringBtn, isEditingSchedule ? styles.editPhotoBtnActive : '', hasSchedule ? styles.recurringBtnActive : ''].join(' ')}
            onClick={isEditingSchedule ? onCancelEditSchedule : onStartEditSchedule}
          >
            {isEditingSchedule ? '✕' : hasSchedule ? '↻ Schedule' : '↻ Set Schedule'}
          </button>
          <button
            className={[styles.addPartyBtn, isAddingParty ? styles.editPhotoBtnActive : ''].join(' ')}
            onClick={isAddingParty ? onCancelAddParty : onStartAddParty}
          >
            {isAddingParty ? '✕' : '+ Add Party'}
          </button>
        </div>
      </div>

      {/* ── Logo edit form ── */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            className={styles.editForm}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <div className={styles.editFormInner}>
              <p className={styles.editFormHint}>
                Logo shown on feed cards. Square image works best.
              </p>
              <input
                className={styles.editInput}
                type="url"
                placeholder="Paste logo or photo URL…"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveLogo()}
                autoFocus
              />
              <div className={styles.editFormActions}>
                <button
                  className={styles.editSaveBtn}
                  onClick={handleSaveLogo}
                  disabled={isSaving || !inputUrl.trim()}
                >
                  {isSaving ? 'Saving…' : 'Set as Logo'}
                </button>
                <button className={styles.editCancelBtn} onClick={onCancelEdit}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recurring schedule editor ── */}
      <AnimatePresence>
        {isEditingSchedule && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <RecurringScheduleEditor
              venue={venue}
              onSave={onSaveSchedule}
              onCancel={onCancelEditSchedule}
              isSaving={isSavingSchedule}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add party form ── */}
      <AnimatePresence>
        {isAddingParty && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <AddPartyForm
              venue={venue}
              onSave={onCreateParty}
              onCancel={onCancelAddParty}
              isSaving={isSavingParty}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Manage Events panel ── */}
      <AnimatePresence>
        {isManagingEvents && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
          >
            <ManageEventsPanel
              venueEvents={venueEvents}
              onEdit={onEditEvent}
              onCancel={onCancelEvent}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── DiscoveredEventsPanel ────────────────────────────────────────────────────

const STATUS_ICON = {
  found:     '✓',
  no_events: '○',
  blocked:   '✗',
  timeout:   '⏱',
  error:     '!',
  cached:    '↷',
}

function DiscoveredEventsPanel({
  pendingEvents,
  scanStatus,
  scanProgress,
  scanResults,
  forceRescan,
  onToggleForceRescan,
  venueCount,
  approvingIds,
  approvingAll,
  onStartScan,
  onApproveOne,
  onRejectOne,
  onApproveAll,
  onRescan,
}) {
  const isScanning  = scanStatus === 'scanning'
  const hasDone     = scanStatus === 'done'
  const resultRows  = Object.values(scanResults)
  const cachedCount = resultRows.filter(r => r.status === 'cached').length
  const toScanCount = venueCount - cachedCount

  return (
    <section className={styles.discoveryPanel}>
      {/* ── Header ── */}
      <div className={styles.discoveryHeader}>
        <div className={styles.discoveryTitle}>
          <span className={styles.discoveryDot} />
          Event Discovery Engine
        </div>
        {pendingEvents.length > 0 && (
          <button
            className={styles.approveAllBtn}
            onClick={onApproveAll}
            disabled={approvingAll || isScanning}
          >
            {approvingAll ? 'Approving…' : `✓ Approve All (${pendingEvents.length})`}
          </button>
        )}
      </div>

      {/* ── Scan controls (always visible) ── */}
      <div className={styles.scanControls}>
        <button
          className={styles.scanStartBtn}
          onClick={isScanning ? undefined : onStartScan}
          disabled={isScanning}
        >
          {isScanning
            ? <><span className={styles.scanSpinner} /> Scanning…</>
            : '🔍 Scan for Events'}
        </button>

        <label className={styles.forceRescanLabel}>
          <input
            type="checkbox"
            checked={forceRescan}
            onChange={onToggleForceRescan}
            disabled={isScanning}
          />
          Force rescan (ignore 24 h cache)
        </label>

        {!isScanning && venueCount > 0 && scanStatus === 'idle' && (
          <span className={styles.scanVenueCount}>
            {forceRescan ? venueCount : toScanCount} venue{(forceRescan ? venueCount : toScanCount) !== 1 ? 's' : ''} to scan
            {!forceRescan && cachedCount > 0 && ` · ${cachedCount} cached`}
          </span>
        )}

        {hasDone && (
          <button className={styles.rescanBtn} onClick={onRescan} disabled={isScanning}>
            ↺ Re-scan
          </button>
        )}
      </div>

      {/* ── Scan progress bar ── */}
      {isScanning && (
        <div className={styles.scanProgressWrap}>
          <div className={styles.scanProgressLabel}>
            Crawling venue websites… {scanProgress.done}/{scanProgress.total}
          </div>
          <div className={styles.scanProgressTrack}>
            <div
              className={styles.scanProgressFill}
              style={{
                width: `${scanProgress.total > 0
                  ? (scanProgress.done / scanProgress.total) * 100
                  : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Per-venue scan results ── */}
      {resultRows.length > 0 && (
        <div className={styles.scanResultsList}>
          {resultRows.map((r, i) => (
            <div
              key={i}
              className={[
                styles.scanResultRow,
                r.status === 'found'     ? styles.srFound     : '',
                r.status === 'no_events' ? styles.srNoEvents  : '',
                r.status === 'blocked'   ? styles.srBlocked   : '',
                r.status === 'cached'    ? styles.srCached    : '',
                (r.status === 'timeout' || r.status === 'error') ? styles.srError : '',
              ].join(' ')}
            >
              <span className={styles.srIcon}>{STATUS_ICON[r.status] ?? '?'}</span>
              <span className={styles.srName}>{r.venueName}</span>
              <span className={styles.srDetail}>
                {r.status === 'found'     && `${r.count} event${r.count !== 1 ? 's' : ''} found`}
                {r.status === 'no_events' && 'No events found'}
                {r.status === 'blocked'   && 'Site blocked'}
                {r.status === 'timeout'   && 'Timed out'}
                {r.status === 'error'     && (r.error ?? 'Error')}
                {r.status === 'cached'    && 'Skipped (< 24 h)'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Done / no pending ── */}
      {hasDone && pendingEvents.length === 0 && (
        <p className={styles.discoveryEmpty}>
          No new events discovered. Check back after venues update their pages.
        </p>
      )}

      {/* ── Pending event cards ── */}
      {pendingEvents.length > 0 && (
        <div className={styles.discoveredList}>
          <AnimatePresence>
            {pendingEvents.map(event => {
              const d = new Date(event.date)
              const dateLabel = d.toLocaleDateString('en-IL', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
              })
              const isApproving = approvingIds.has(event.id)

              return (
                <motion.div
                  key={event.id}
                  className={styles.discoveredCard}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.22 }}
                  layout
                >
                  <div className={styles.discoveredLeft}>
                    <div className={styles.discoveredVenue}>{event.venue}</div>
                    <div className={styles.discoveredEventTitle}>{event.title}</div>
                    <div className={styles.discoveredMeta}>
                      <span className={styles.discoveredDate}>{dateLabel}</span>
                      <span className={styles.discoveredTime}>🕐 {event.time}</span>
                    </div>
                    {event.url && event.url !== event.venue && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.discoveredSource}
                      >
                        🔗 Source →
                      </a>
                    )}
                  </div>
                  <div className={styles.discoveredActions}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => onApproveOne(event)}
                      disabled={isApproving}
                    >
                      {isApproving ? '…' : '✓'}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => onRejectOne(event)}
                      disabled={isApproving}
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}

// ─── VenueDiscoveryPage ───────────────────────────────────────────────────────

export default function VenueDiscoveryPage() {
  const dispatch       = useDispatch()
  const importedVenues = useSelector(selectAllVenues)
  const venuesStatus   = useSelector(selectVenuesStatus)
  const importedIds    = useSelector(selectImportedPlaceIds)
  const liveEvents     = useSelector(selectAllEvents)
  const allMergedEvents = useSelector(selectEventsForActiveVenues)

  const importedVenuesByPlaceId = useMemo(() => {
    const map = {}
    importedVenues.forEach((v) => { map[v.placeId] = v })
    return map
  }, [importedVenues])

  // ── Search state ────────────────────────────────────────────────────────────
  const [results,        setResults]        = useState([])
  const [seenIds,        setSeenIds]        = useState(new Set())
  const [selectedIds,    setSelectedIds]    = useState(new Set())
  const [expandedCard,   setExpandedCard]   = useState(null)
  const [detailsCache,   setDetailsCache]   = useState({})
  const [manualQuery,    setManualQuery]    = useState('')
  const [toastMsg,       setToastMsg]       = useState('')

  // ── Auto-discovery state ────────────────────────────────────────────────────
  const [autoProgress,    setAutoProgress]    = useState(0)
  const [autoTotal,       setAutoTotal]       = useState(0)
  const [autoRunning,     setAutoRunning]     = useState(false)
  const [autoDone,        setAutoDone]        = useState(false)
  const [cacheTimestamp,  setCacheTimestamp]  = useState(null) // ms epoch when results were cached
  const discoveryRef = useRef(false)

  // ── Manual search state ─────────────────────────────────────────────────────
  const [manualRunning, setManualRunning]  = useState(false)

  // ── Import state ────────────────────────────────────────────────────────────
  const [importStatus,  setImportStatus]   = useState('idle')

  // ── Venue collection filter ─────────────────────────────────────────────────
  const [venueFilter,       setVenueFilter]        = useState('all') // 'all' | 'live' | 'hidden'

  // ── Logo / bulk edit state ──────────────────────────────────────────────────
  const [editingVenueId,    setEditingVenueId]    = useState(null)
  const [savingLogo,        setSavingLogo]        = useState(false)
  const [uploadingImageId,  setUploadingImageId]  = useState(null)
  const [showBulkEdit,      setShowBulkEdit]      = useState(false)
  const [bulkPhotoUrl,      setBulkPhotoUrl]      = useState('')
  const [savingBulk,        setSavingBulk]        = useState(false)

  // ── Add Party state ─────────────────────────────────────────────────────────
  const [addingPartyVenueId, setAddingPartyVenueId] = useState(null)
  const [savingParty,        setSavingParty]        = useState(false)

  // ── Recurring schedule state ────────────────────────────────────────────────
  const [editingScheduleId,  setEditingScheduleId]  = useState(null)
  const [savingSchedule,     setSavingSchedule]     = useState(false)

  // ── Event discovery state ────────────────────────────────────────────────────
  const [pendingEvents,    setPendingEvents]    = useState([])
  const [scanStatus,       setScanStatus]       = useState('idle')
  const [scanProgress,     setScanProgress]     = useState({ done: 0, total: 0 })
  const [scanResults,      setScanResults]      = useState({})
  const [forceRescan,      setForceRescan]      = useState(false)
  const [approvingIds,     setApprovingIds]     = useState(new Set())
  const [approvingAll,     setApprovingAll]     = useState(false)
  // Per-venue individual scan state
  const [venueScanning,    setVenueScanning]    = useState({}) // { [placeId]: bool }
  const [venueScanResult,  setVenueScanResult]  = useState({}) // { [placeId]: { status, count, newCount, error } }
  const crawlRef = useRef(false)

  // Manage events panel state
  const [managingEventsId, setManagingEventsId] = useState(null) // placeId with panel open
  const [editingEvent,     setEditingEvent]     = useState(null) // event open in edit modal
  const [isSavingEdit,     setIsSavingEdit]     = useState(false)

  // ── Load Firestore venues on mount ──────────────────────────────────────────
  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [dispatch, venuesStatus])

  // ── Auto-discovery on mount — load cache first, API only if cache is stale ──
  useEffect(() => {
    if (discoveryRef.current) return
    discoveryRef.current = true

    const cached = loadSearchCache()
    if (cached) {
      setResults(cached.results)
      setSeenIds(new Set(cached.results.map(v => v.placeId)))
      setCacheTimestamp(cached.timestamp)
      setAutoDone(true)
      return  // ← skip API call entirely
    }

    runAutoDiscovery()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load existing pending events on mount (no auto-crawl) ──────────────────
  useEffect(() => {
    loadPendingEvents().then(setPendingEvents).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

  function isRecentlyScanned(venue) {
    if (!venue.lastScanTimestamp) return false
    return Date.now() - venue.lastScanTimestamp < 24 * 60 * 60 * 1000
  }

  async function updateVenueScanTimestamp(placeId) {
    const now = Date.now()
    dispatch(updateVenueField({ placeId, field: 'lastScanTimestamp', value: now }))
    try {
      await updateDoc(doc(db, 'venues', placeId), { lastScanTimestamp: serverTimestamp() })
    } catch (err) {
      console.warn('[ScanTimestamp]', err.message)
    }
  }

  async function runCrawler(force = false) {
    if (crawlRef.current) return
    crawlRef.current = true
    setScanStatus('scanning')
    setScanResults({})

    // Reload pending events so we show them immediately
    let existing = pendingEvents
    try {
      existing = await loadPendingEvents()
      setPendingEvents(existing)
    } catch (err) {
      console.warn('[Discovery] Could not load pending events:', err.message)
    }

    // Active venues with a crawlable URL (ticketUrl takes priority over website)
    const crawlable = importedVenues.filter(v => {
      if (v.active === false) return false
      const url = v.ticketUrl?.trim() || v.website?.trim()
      return url && !/instagram|facebook|fb\.me/i.test(url)
    })

    const effectiveForce = force || forceRescan
    const toScan = crawlable.filter(v => effectiveForce || !isRecentlyScanned(v))

    // Pre-mark cached venues in results
    const initialResults = {}
    crawlable.forEach(v => {
      if (!toScan.includes(v)) {
        initialResults[v.placeId] = { status: 'cached', count: 0, error: null, venueName: v.name }
      }
    })
    setScanResults(initialResults)
    setScanProgress({ done: 0, total: toScan.length })

    let localPending = [...existing]

    for (let i = 0; i < toScan.length; i++) {
      const venue = toScan[i]
      try {
        const result = await crawlVenueWebsite(venue)

        // Save scan timestamp for non-blocked requests
        if (result.status !== 'blocked') {
          await updateVenueScanTimestamp(venue.placeId)
        }

        if (result.status === 'found' && result.events.length > 0) {
          const saved = await upsertPendingEvents(result.events, localPending, liveEvents)
          if (saved.length > 0) {
            localPending = [...localPending, ...saved]
            setPendingEvents([...localPending])
          }
          setScanResults(prev => ({
            ...prev,
            [venue.placeId]: { status: 'found', count: result.events.length, error: null, venueName: venue.name },
          }))
        } else {
          setScanResults(prev => ({
            ...prev,
            [venue.placeId]: { status: result.status, count: 0, error: result.error, venueName: venue.name },
          }))
        }
      } catch (err) {
        setScanResults(prev => ({
          ...prev,
          [venue.placeId]: { status: 'error', count: 0, error: err.message, venueName: venue.name },
        }))
      }

      setScanProgress({ done: i + 1, total: toScan.length })
      if (i < toScan.length - 1) await delay(800)
    }

    setScanStatus('done')
    crawlRef.current = false
  }

  function handleStartScan() {
    if (scanStatus === 'scanning') return
    crawlRef.current = false
    runCrawler(false)
  }

  function handleRescan() {
    if (scanStatus === 'scanning') return
    crawlRef.current = false
    runCrawler(true)
  }

  async function handleScanVenue(venue) {
    const { placeId } = venue
    setVenueScanning(prev => ({ ...prev, [placeId]: true }))
    setVenueScanResult(prev => ({ ...prev, [placeId]: null }))

    try {
      const result = await crawlVenueWebsite(venue)

      if (result.status !== 'blocked') {
        await updateVenueScanTimestamp(placeId)
      }

      let newCount = 0
      if (result.status === 'found' && result.events.length > 0) {
        // Reload existing pending so dedup is accurate
        const existing = await loadPendingEvents()
        const saved = await upsertPendingEvents(result.events, existing, liveEvents)
        if (saved.length > 0) {
          setPendingEvents(prev => {
            const withoutNew = prev.filter(e => !saved.find(s => s.id === e.id))
            return [...withoutNew, ...saved]
          })
          newCount = saved.length
        }
      }

      setVenueScanResult(prev => ({
        ...prev,
        [placeId]: { status: result.status, count: result.events.length, newCount, error: result.error },
      }))
    } catch (err) {
      setVenueScanResult(prev => ({
        ...prev,
        [placeId]: { status: 'error', count: 0, newCount: 0, error: err.message },
      }))
    } finally {
      setVenueScanning(prev => ({ ...prev, [placeId]: false }))
    }
  }

  async function runAutoDiscovery() {
    setAutoRunning(true)
    setAutoDone(false)
    setCacheTimestamp(null)
    setAutoProgress(0)
    setAutoTotal(AUTO_QUERIES.length)

    let localSeen = new Set()
    const accumulated = []

    for (let i = 0; i < AUTO_QUERIES.length; i++) {
      const found = await searchDanceVenues(AUTO_QUERIES[i], localSeen)
      found.forEach((v) => localSeen.add(v.placeId))
      accumulated.push(...found)
      setResults([...accumulated])
      setSeenIds(new Set(localSeen))
      setAutoProgress(i + 1)
    }

    saveSearchCache(accumulated)
    setAutoRunning(false)
    setAutoDone(true)
  }

  // ── Manual search ───────────────────────────────────────────────────────────
  async function handleManualSearch(query) {
    const q = query.trim()
    if (!q || manualRunning) return
    setManualRunning(true)
    // Append country suffix when query is Hebrew and doesn't already include one
    const searchQ = containsHebrew(q) && !q.includes('ישראל') && !q.toLowerCase().includes('israel')
      ? `${q} ישראל`
      : q
    const found = await searchDanceVenues(searchQ, seenIds)
    setResults((prev) => [...prev, ...found])
    setSeenIds((prev) => {
      const next = new Set(prev)
      found.forEach((v) => next.add(v.placeId))
      return next
    })
    setManualRunning(false)
    if (found.length === 0) showToast('No new results for that search')
  }

  function handleForceRescan() {
    clearSearchCache()
    setCacheTimestamp(null)
    setResults([])
    setSeenIds(new Set())
    setSelectedIds(new Set())
    setExpandedCard(null)
    setAutoDone(false)
    setAutoProgress(0)
    discoveryRef.current = false
    setTimeout(runAutoDiscovery, 0)
  }

  // ── Selection helpers ───────────────────────────────────────────────────────
  function toggleSelect(placeId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(placeId) ? next.delete(placeId) : next.add(placeId)
      return next
    })
  }

  const eligibleIds = results.filter((v) => !importedIds.has(v.placeId)).map((v) => v.placeId)
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id))

  function handleSelectAll() {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds))
  }

  // ── Details expand ──────────────────────────────────────────────────────────
  async function handleExpandCard(placeId) {
    if (expandedCard === placeId) { setExpandedCard(null); return }
    setExpandedCard(placeId)
    if (detailsCache[placeId]) return
    setDetailsCache((prev) => ({ ...prev, [placeId]: { status: 'loading', data: null } }))
    const data = await getFullVenueDetails(placeId)
    setDetailsCache((prev) => ({
      ...prev,
      [placeId]: { status: data ? 'done' : 'error', data },
    }))
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (selectedIds.size === 0 || importStatus === 'loading') return
    setImportStatus('loading')
    const result = await importVenuesToFirestore(Array.from(selectedIds))
    await dispatch(fetchVenues())
    setSelectedIds(new Set())
    setImportStatus('idle')
    if (result.failed === 0) {
      showToast(`✓ Imported ${result.imported} venue${result.imported !== 1 ? 's' : ''}!`)
    } else {
      showToast(`✓ ${result.imported} imported · ⚠️ ${result.failed} failed — see console`)
    }
  }

  // ── V Logic toggle ──────────────────────────────────────────────────────────
  async function handleToggleActive(placeId, newActive) {
    dispatch(updateVenueField({ placeId, field: 'active', value: newActive }))
    try {
      await updateDoc(doc(db, 'venues', placeId), { active: newActive })
    } catch (err) {
      console.error('[ToggleActive]', err)
      dispatch(updateVenueField({ placeId, field: 'active', value: !newActive }))
      showToast('⚠️ Could not update venue status')
    }
  }

  // ── Style tags ──────────────────────────────────────────────────────────────
  async function handleToggleStyle(placeId, style, currentStyles) {
    const updated = currentStyles.includes(style)
      ? currentStyles.filter((s) => s !== style)
      : [...currentStyles, style]
    dispatch(updateVenueField({ placeId, field: 'styles', value: updated }))
    try {
      await updateDoc(doc(db, 'venues', placeId), { styles: updated })
    } catch (err) {
      console.error('[StyleToggle]', err)
      dispatch(updateVenueField({ placeId, field: 'styles', value: currentStyles }))
      showToast('⚠️ Could not update styles')
    }
  }

  // ── Social fields ───────────────────────────────────────────────────────────
  async function handleSaveSocialField(placeId, field, value) {
    const val = value || null
    dispatch(updateVenueField({ placeId, field, value: val }))
    try {
      await updateDoc(doc(db, 'venues', placeId), { [field]: val })
    } catch (err) {
      console.error('[Social]', err)
      showToast('⚠️ Could not save social field')
    }
  }

  // ── Logo editing ────────────────────────────────────────────────────────────
  async function handleSaveLogo(placeId, newUrl) {
    setSavingLogo(true)
    try {
      await updateDoc(doc(db, 'venues', placeId), { logo: newUrl })
      dispatch(updateVenueField({ placeId, field: 'logo', value: newUrl }))
      setEditingVenueId(null)
      showToast('✓ Logo updated!')
    } catch (err) {
      console.error('[EditLogo]', err)
      showToast('⚠️ Could not update logo')
    } finally {
      setSavingLogo(false)
    }
  }

  async function handleUploadImage(placeId, file) {
    setUploadingImageId(placeId)
    try {
      const url = await uploadToCloudinary(file)
      await updateDoc(doc(db, 'venues', placeId), { customImageUrl: url })
      dispatch(updateVenueField({ placeId, field: 'customImageUrl', value: url }))
      showToast('✓ Image uploaded!')
    } catch (err) {
      console.error('[UploadImage]', err)
      showToast(`⚠️ ${err.message}`)
    } finally {
      setUploadingImageId(null)
    }
  }

  async function handleBulkSaveLogo() {
    const url = bulkPhotoUrl.trim()
    if (!url) return
    setSavingBulk(true)
    try {
      await Promise.all(
        importedVenues.map((v) => updateDoc(doc(db, 'venues', v.placeId), { logo: url }))
      )
      importedVenues.forEach((v) =>
        dispatch(updateVenueField({ placeId: v.placeId, field: 'logo', value: url }))
      )
      setShowBulkEdit(false)
      setBulkPhotoUrl('')
      showToast(`✓ Logo set for all ${importedVenues.length} venues!`)
    } catch (err) {
      console.error('[BulkLogo]', err)
      showToast('⚠️ Some logos could not be updated')
    } finally {
      setSavingBulk(false)
    }
  }

  // ── Discovered event approval ───────────────────────────────────────────────
  async function handleApproveOne(event) {
    setApprovingIds(prev => new Set(prev).add(event.id))
    try {
      await approveEvent(event)
      dispatch(fetchEvents())
      setPendingEvents(prev => prev.filter(e => e.id !== event.id))
      showToast(`✓ "${event.title}" added to PARTIES!`)
    } catch (err) {
      console.error('[ApproveOne]', err)
      showToast('⚠️ Could not approve event')
    } finally {
      setApprovingIds(prev => { const s = new Set(prev); s.delete(event.id); return s })
    }
  }

  async function handleRejectOne(event) {
    try {
      await rejectEvent(event.id)
      setPendingEvents(prev => prev.filter(e => e.id !== event.id))
    } catch (err) {
      console.error('[RejectOne]', err)
      showToast('⚠️ Could not reject event')
    }
  }

  async function handleApproveAll() {
    if (pendingEvents.length === 0) return
    setApprovingAll(true)
    try {
      const result = await approveAllPending(pendingEvents)
      dispatch(fetchEvents())
      setPendingEvents([])
      showToast(`✓ ${result.approved} event${result.approved !== 1 ? 's' : ''} approved!${result.failed > 0 ? ` (${result.failed} failed)` : ''}`)
    } catch (err) {
      console.error('[ApproveAll]', err)
      showToast('⚠️ Could not approve all events')
    } finally {
      setApprovingAll(false)
    }
  }

  // ── Add Party ───────────────────────────────────────────────────────────────
  async function handleCreateParty(placeId, formData) {
    const venue = importedVenuesByPlaceId[placeId]
    if (!venue) return
    setSavingParty(true)
    try {
      await saveEventToFirestore({
        title:       formData.title.trim(),
        date:        formData.date,
        time:        formData.time,
        venue:       venue.name,
        location:    venue.city    ?? '',
        placeId:     venue.placeId,
        styles:      venue.styles  ?? [],
        description: formData.description?.trim() ?? '',
        price:       formData.price    ?? '0',
        currency:    formData.currency ?? 'ILS',
        whatsapp:    formData.whatsapp?.trim() || null,
        isManual:    true,
      })
      dispatch(fetchEvents())   // refresh PartiesPage immediately
      setAddingPartyVenueId(null)
      showToast(`🎉 Party created for ${venue.name}!`)
    } catch (err) {
      console.error('[CreateParty]', err)
      showToast('⚠️ Could not create party')
    } finally {
      setSavingParty(false)
    }
  }

  // ── Recurring schedule ──────────────────────────────────────────────────────
  async function handleSaveSchedule(placeId, schedule) {
    const prev = importedVenuesByPlaceId[placeId]?.recurringSchedule ?? null
    dispatch(updateVenueField({ placeId, field: 'recurringSchedule', value: schedule }))
    setSavingSchedule(true)
    try {
      await updateDoc(doc(db, 'venues', placeId), { recurringSchedule: schedule })
      setEditingScheduleId(null)
      const daysSet = schedule.days?.length ?? 0
      showToast(daysSet > 0 ? `↻ Schedule saved (${daysSet} day${daysSet !== 1 ? 's' : ''})!` : '↻ Schedule cleared')
    } catch (err) {
      console.error('[SaveSchedule]', err)
      dispatch(updateVenueField({ placeId, field: 'recurringSchedule', value: prev }))
      showToast('⚠️ Could not save schedule')
    } finally {
      setSavingSchedule(false)
    }
  }

  // ── Event edit / override / cancel ─────────────────────────────────────────
  async function handleEditSave(originalEvent, formData) {
    setIsSavingEdit(true)
    try {
      const payload = {
        title:       formData.title.trim(),
        date:        formData.date,
        time:        formData.time,
        description: formData.description?.trim() ?? '',
        price:       formData.price    ?? '',
        currency:    formData.currency ?? 'ILS',
        whatsapp:    formData.whatsapp?.trim() || null,
        venue:       originalEvent.venue,
        location:    originalEvent.location,
        placeId:     originalEvent.placeId,
        styles:      originalEvent.styles ?? [],
      }
      if (originalEvent.isRecurring) {
        await saveEventOverride(originalEvent.id, payload)
      } else {
        await updateEventInFirestore(originalEvent.id, payload)
      }
      dispatch(fetchEvents())
      setEditingEvent(null)
      showToast('✓ Event saved!')
    } catch (err) {
      console.error('[EditEvent]', err)
      showToast('⚠️ Could not save event')
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleCancelInstance(event) {
    if (!window.confirm(
      `Cancel "${event.title}" on ${event.date}?\n\nOnly this date is cancelled — the weekly schedule continues.`
    )) return
    try {
      await cancelEventInstance(event.id, {
        placeId: event.placeId,
        date:    event.date,
        venue:   event.venue,
      })
      dispatch(fetchEvents())
      setEditingEvent(null)
      showToast('✓ Occurrence cancelled')
    } catch (err) {
      console.error('[CancelInstance]', err)
      showToast('⚠️ Could not cancel occurrence')
    }
  }

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3200)
  }

  const isImporting   = importStatus === 'loading'
  const liveCount     = importedVenues.filter(v => v.active === true).length
  const hiddenCount   = importedVenues.filter(v => v.active !== true).length

  // Build a per-venue event map from the merged selector
  const eventsByVenue = useMemo(() => {
    const map = {}
    allMergedEvents.forEach(e => {
      if (!e.placeId) return
      if (!map[e.placeId]) map[e.placeId] = []
      map[e.placeId].push(e)
    })
    return map
  }, [allMergedEvents])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Venue Control Center</h1>
        <p className={styles.pageSubtitle}>
          Discover · import · control every dance venue in Israel
        </p>
      </div>

      {/* ── Imported venues (collection) — shown FIRST so filter tabs are immediately visible ── */}
      {importedVenues.length > 0 && (
        <section className={styles.importedSection}>
          <div className={styles.importedSectionHeader}>
            <span className={styles.sectionLabel}>
              In your collection ({importedVenues.length})
            </span>
            <button
              className={[styles.bulkEditToggleBtn, showBulkEdit ? styles.bulkEditToggleBtnActive : ''].join(' ')}
              onClick={() => { setShowBulkEdit((v) => !v); setBulkPhotoUrl('') }}
            >
              {showBulkEdit ? '✕ Cancel' : '🖼 Set Logo for All'}
            </button>
          </div>

          {/* ── Venue filter tabs ── */}
          <div className={styles.venueFilterTabs}>
            <button
              className={[styles.venueFilterTab, venueFilter === 'all' ? styles.venueFilterTabActive : ''].join(' ')}
              onClick={() => setVenueFilter('all')}
            >
              All <span className={styles.venueFilterCount}>{importedVenues.length}</span>
            </button>
            <button
              className={[styles.venueFilterTab, venueFilter === 'live' ? styles.venueFilterTabLive : ''].join(' ')}
              onClick={() => setVenueFilter('live')}
            >
              ● Live <span className={styles.venueFilterCount}>{liveCount}</span>
            </button>
            <button
              className={[styles.venueFilterTab, venueFilter === 'hidden' ? styles.venueFilterTabHidden : ''].join(' ')}
              onClick={() => setVenueFilter('hidden')}
            >
              ○ Hidden <span className={styles.venueFilterCount}>{hiddenCount}</span>
            </button>
          </div>

          <AnimatePresence>
            {showBulkEdit && (
              <motion.div
                className={styles.bulkEditBar}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div className={styles.editFormInner}>
                  <p className={styles.bulkEditHint}>
                    Paste one URL — sets the logo for <strong>all {importedVenues.length} venues</strong>.
                  </p>
                  <input
                    className={styles.editInput}
                    type="url"
                    placeholder="Paste logo URL…"
                    value={bulkPhotoUrl}
                    onChange={(e) => setBulkPhotoUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBulkSaveLogo()}
                  />
                  <div className={styles.editFormActions}>
                    <button
                      className={styles.editSaveBtn}
                      onClick={handleBulkSaveLogo}
                      disabled={savingBulk || !bulkPhotoUrl.trim()}
                    >
                      {savingBulk ? 'Saving…' : `Apply to All (${importedVenues.length})`}
                    </button>
                    <button
                      className={styles.editCancelBtn}
                      onClick={() => { setShowBulkEdit(false); setBulkPhotoUrl('') }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={styles.importedList}>
            {importedVenues
              .filter(v =>
                venueFilter === 'all'    ? true :
                venueFilter === 'live'   ? v.active === true :
                /* hidden */               v.active !== true
              )
              .map((venue) => (
              <ImportedVenueRow
                key={venue.placeId}
                venue={venue}
                // logo
                isEditing={editingVenueId === venue.placeId}
                onStartEdit={() => { setEditingVenueId(venue.placeId); setAddingPartyVenueId(null); setEditingScheduleId(null) }}
                onCancelEdit={() => setEditingVenueId(null)}
                onSaveLogo={handleSaveLogo}
                isSaving={savingLogo && editingVenueId === venue.placeId}
                // cloudinary image upload
                isUploadingImage={uploadingImageId === venue.placeId}
                onUploadImage={(file) => handleUploadImage(venue.placeId, file)}
                // add party
                isAddingParty={addingPartyVenueId === venue.placeId}
                onStartAddParty={() => { setAddingPartyVenueId(venue.placeId); setEditingVenueId(null); setEditingScheduleId(null) }}
                onCancelAddParty={() => setAddingPartyVenueId(null)}
                onCreateParty={(formData) => handleCreateParty(venue.placeId, formData)}
                isSavingParty={savingParty && addingPartyVenueId === venue.placeId}
                // recurring schedule
                isEditingSchedule={editingScheduleId === venue.placeId}
                onStartEditSchedule={() => { setEditingScheduleId(venue.placeId); setEditingVenueId(null); setAddingPartyVenueId(null) }}
                onCancelEditSchedule={() => setEditingScheduleId(null)}
                onSaveSchedule={(schedule) => handleSaveSchedule(venue.placeId, schedule)}
                isSavingSchedule={savingSchedule && editingScheduleId === venue.placeId}
                // per-venue scan
                isScanning={!!venueScanning[venue.placeId]}
                scanResult={venueScanResult[venue.placeId] ?? null}
                onScan={() => handleScanVenue(venue)}
                // manage events
                isManagingEvents={managingEventsId === venue.placeId}
                onToggleManageEvents={() => setManagingEventsId(
                  managingEventsId === venue.placeId ? null : venue.placeId
                )}
                venueEvents={eventsByVenue[venue.placeId] ?? []}
                onEditEvent={setEditingEvent}
                onCancelEvent={handleCancelInstance}
                // other
                onToggleActive={handleToggleActive}
                onToggleStyle={handleToggleStyle}
                onSaveSocialField={handleSaveSocialField}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Discovered Events (crawler results) ── */}
      <DiscoveredEventsPanel
        pendingEvents={pendingEvents}
        scanStatus={scanStatus}
        scanProgress={scanProgress}
        scanResults={scanResults}
        forceRescan={forceRescan}
        onToggleForceRescan={() => setForceRescan(v => !v)}
        venueCount={importedVenues.filter(v => {
          if (v.active === false) return false
          const url = v.ticketUrl?.trim() || v.website?.trim()
          return url && !/instagram|facebook|fb\.me/i.test(url)
        }).length}
        approvingIds={approvingIds}
        approvingAll={approvingAll}
        onStartScan={handleStartScan}
        onApproveOne={handleApproveOne}
        onRejectOne={handleRejectOne}
        onApproveAll={handleApproveAll}
        onRescan={handleRescan}
      />

      {/* ── Auto-discovery progress bar ── */}
      {autoRunning && (
        <div className={styles.autoDiscoveryBar}>
          <div className={styles.autoDiscoveryLabel}>
            <span className={styles.autoDiscoverySpinner} />
            Searching Google Places…
            <span className={styles.autoDiscoveryProgress}>
              {autoProgress} / {autoTotal}
            </span>
          </div>
          <div className={styles.autoProgressTrack}>
            <div
              className={styles.autoProgressFill}
              style={{ width: `${autoTotal > 0 ? (autoProgress / autoTotal) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {autoDone && results.length > 0 && !autoRunning && (
        <div className={[styles.autoDiscoveryDone, cacheTimestamp ? styles.autoDiscoveryDoneCached : ''].join(' ')}>
          {cacheTimestamp ? (
            <>
              <span>
                📋 {results.length} venues · cached{' '}
                {new Date(cacheTimestamp).toLocaleString('en-IL', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <button className={styles.rerunBtn} onClick={handleForceRescan}>↺ Re-scan Google</button>
            </>
          ) : (
            <>
              <span>✓ Found {results.length} venue{results.length !== 1 ? 's' : ''} across Israel</span>
              <button className={styles.rerunBtn} onClick={handleForceRescan}>↺ Re-scan</button>
            </>
          )}
        </div>
      )}

      {/* ── Manual search ── */}
      <section className={styles.searchSection}>
        <div className={styles.sectionLabel}>Add a specific venue</div>
        <div className={styles.manualRow}>
          <input
            className={styles.manualInput}
            type="text"
            placeholder="e.g. Baila, Studio Latino, Club Habana…"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch(manualQuery)}
            disabled={manualRunning}
            dir="auto"
          />
          <button
            className={styles.manualSearchBtn}
            onClick={() => handleManualSearch(manualQuery)}
            disabled={manualRunning || !manualQuery.trim()}
          >
            {manualRunning ? '⏳' : 'Search'}
          </button>
        </div>
      </section>

      {/* ── Sticky bulk controls ── */}
      {results.length > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {results.length} venue{results.length !== 1 ? 's' : ''}
            {importedIds.size > 0 && (
              <span className={styles.bulkImportedCount}> · {importedIds.size} imported</span>
            )}
          </span>
          <div className={styles.bulkActions}>
            {eligibleIds.length > 0 && (
              <button className={styles.selectAllBtn} onClick={handleSelectAll} disabled={isImporting}>
                {allEligibleSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
            <button
              className={[styles.importBtn, isImporting ? styles.importBtnLoading : ''].join(' ')}
              onClick={handleImport}
              disabled={selectedIds.size === 0 || isImporting}
            >
              {isImporting ? (
                <><span className={styles.importSpinner} />Importing…</>
              ) : (
                `Import Selected (${selectedIds.size})`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Results grid ── */}
      {results.length > 0 && (
        <section className={styles.resultsSection}>
          <div className={styles.resultsGrid}>
            {results.map((venue) => (
              <VenueResultCard
                key={venue.placeId}
                venue={venue}
                isSelected={selectedIds.has(venue.placeId)}
                isImported={importedIds.has(venue.placeId)}
                importedVenueData={importedVenuesByPlaceId[venue.placeId] ?? null}
                isExpanded={expandedCard === venue.placeId}
                detailsEntry={detailsCache[venue.placeId]}
                onToggleSelect={() => toggleSelect(venue.placeId)}
                onExpand={() => handleExpandCard(venue.placeId)}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>
        </section>
      )}

      {results.length === 0 && autoRunning && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗺</div>
          <p>Scanning dance venues across Israel…</p>
        </div>
      )}

      {results.length === 0 && !autoRunning && autoDone && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p>No venues found. Try a specific search above.</p>
        </div>
      )}

      {/* ── Admin: Edit / Override modal ── */}
      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          onSave={handleEditSave}
          onCancel={editingEvent.isRecurring ? handleCancelInstance : undefined}
          onClose={() => setEditingEvent(null)}
          isSaving={isSavingEdit}
        />
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key={toastMsg}
            className={styles.toast}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
