import { useState, useEffect, useRef, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../services/firebase'
import {
  fetchVenues,
  selectAllVenues,
  selectVenuesStatus,
  selectImportedPlaceIds,
  updateVenueField,
} from '../../store/venuesSlice'
import {
  searchDanceVenues,
  getFullVenueDetails,
  importVenuesToFirestore,
} from '../../services/googlePlaces'
import styles from './VenueDiscoveryPage.module.css'

// ─── Auto-discovery queries (run automatically on mount) ───────────────────
// Ordered from broadest/most likely to find venues → specific cities/styles.
// Hebrew queries (לטיני / ריקודים) ensure Israeli venues with Hebrew names appear.

const AUTO_QUERIES = [
  'latin dance club Israel',
  'salsa bachata club Tel Aviv',
  'מועדון לטיני תל אביב',
  'מועדון ריקודים ישראל',
  'dance club Tel Aviv',
  'latin bar Tel Aviv',
  'dance school Tel Aviv',
  'salsa club Jerusalem',
  'bachata club Israel',
  'kizomba Tel Aviv',
  'tango club Israel',
  'dance studio Tel Aviv',
  'zouk dance Israel',
  'west coast swing Israel',
]

const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Tango', 'West Coast Swing', 'Social']

// ─── StarRating ────────────────────────────────────────────────────────────

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

// ─── ReviewItem ────────────────────────────────────────────────────────────

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

// ─── ExpandedDetails ───────────────────────────────────────────────────────

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

// ─── VenueResultCard ───────────────────────────────────────────────────────

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
  // active is from the live Redux importedVenueData; default false when not yet loaded
  const isActive = importedVenueData?.active === true

  return (
    <article
      className={[styles.card, isSelected ? styles.cardSelected : ''].join(' ')}
    >
      {/* Thumbnail */}
      <div className={styles.cardThumb}>
        {thumbnail ? (
          <img src={thumbnail} alt={name} className={styles.cardThumbImg} />
        ) : (
          <div className={styles.cardThumbPlaceholder}>🎵</div>
        )}

        {isImported ? (
          // ── Live V-toggle for already-imported venues ──
          <button
            className={[styles.vToggleCard, isActive ? styles.vToggleCardOn : ''].join(' ')}
            onClick={(e) => { e.stopPropagation(); onToggleActive(venue.placeId, !isActive) }}
            title={isActive ? 'Live — tap to hide' : 'Hidden — tap to go live'}
          >
            {isActive ? '● Live' : '○ Off'}
          </button>
        ) : (
          // ── Checkbox for not-yet-imported venues ──
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

      {/* Card body */}
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

      {/* Expandable details */}
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

// ─── ImportedVenueRow ──────────────────────────────────────────────────────

function ImportedVenueRow({
  venue,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveLogo,
  isSaving,
  onToggleActive,
  onToggleStyle,
  onSaveSocialField,
}) {
  const {
    name, city, categories, rating, reviewCount,
    logo, photos, active, styles: venueStyles = [],
  } = venue

  const thumb = logo ?? photos?.[0] ?? null
  const [inputUrl,  setInputUrl]  = useState('')
  const [igHandle,  setIgHandle]  = useState(venue.instagram         ?? '')
  const [fbHandle,  setFbHandle]  = useState(venue.facebook          ?? '')
  const [igPostUrl, setIgPostUrl] = useState(venue.instagramPostUrl  ?? '')

  useEffect(() => setIgHandle(venue.instagram ?? ''),         [venue.instagram])
  useEffect(() => setFbHandle(venue.facebook ?? ''),          [venue.facebook])
  useEffect(() => setIgPostUrl(venue.instagramPostUrl ?? ''), [venue.instagramPostUrl])

  async function handleSaveLogo() {
    const url = inputUrl.trim()
    if (!url) return
    await onSaveLogo(venue.placeId, url)
    setInputUrl('')
  }

  function handleSocialBlur(field, value) {
    onSaveSocialField(venue.placeId, field, value.trim())
  }

  return (
    <div
      className={[
        styles.importedRowWrap,
        isEditing ? styles.importedRowWrapEditing : '',
        active    ? styles.importedRowWrapActive  : '',
      ].join(' ')}
    >
      {/* ── Main row: thumb + info + V toggle ── */}
      <div className={styles.importedRow}>
        <div className={styles.importedThumb}>
          {thumb ? (
            <img src={thumb} alt={name} className={styles.importedThumbImg} />
          ) : (
            <div className={styles.importedThumbPlaceholder}>🎵</div>
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
        </div>

        {/* Prominent V toggle */}
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

      {/* ── Social inputs ── */}
      <div className={styles.socialRow}>
        <input
          className={styles.socialInput}
          type="text"
          placeholder="@instagram"
          value={igHandle}
          onChange={(e) => setIgHandle(e.target.value)}
          onBlur={(e) => handleSocialBlur('instagram', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSocialBlur('instagram', igHandle)}
        />
        <input
          className={styles.socialInput}
          type="text"
          placeholder="@facebook"
          value={fbHandle}
          onChange={(e) => setFbHandle(e.target.value)}
          onBlur={(e) => handleSocialBlur('facebook', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSocialBlur('facebook', fbHandle)}
        />
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

      {/* ── Actions: rating + buttons ── */}
      <div className={styles.importedActionsRow}>
        <StarRating rating={rating} count={reviewCount} />
        <div className={styles.importedButtons}>
          <button
            className={[styles.editPhotoBtn, isEditing ? styles.editPhotoBtnActive : ''].join(' ')}
            onClick={isEditing ? onCancelEdit : onStartEdit}
          >
            {isEditing ? '✕' : '🖼 Logo/Photo'}
          </button>
          <button className={styles.createEventBtn} disabled title="Coming in Plan 011">
            Create Event →
          </button>
        </div>
      </div>

      {/* ── Inline logo edit form ── */}
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
                Logo is shown on home feed cards. Square image works best.
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
    </div>
  )
}

// ─── VenueDiscoveryPage ────────────────────────────────────────────────────

export default function VenueDiscoveryPage() {
  const dispatch       = useDispatch()
  const importedVenues = useSelector(selectAllVenues)
  const venuesStatus   = useSelector(selectVenuesStatus)
  const importedIds    = useSelector(selectImportedPlaceIds)

  // { [placeId]: venue } for live toggle state in search result cards
  const importedVenuesByPlaceId = useMemo(() => {
    const map = {}
    importedVenues.forEach((v) => { map[v.placeId] = v })
    return map
  }, [importedVenues])

  // ── Search state ────────────────────────────────────────────────────────
  const [results,        setResults]        = useState([])
  const [seenIds,        setSeenIds]        = useState(new Set())
  const [selectedIds,    setSelectedIds]    = useState(new Set())
  const [expandedCard,   setExpandedCard]   = useState(null)
  const [detailsCache,   setDetailsCache]   = useState({})
  const [manualQuery,    setManualQuery]    = useState('')
  const [toastMsg,       setToastMsg]       = useState('')

  // ── Auto-discovery state ────────────────────────────────────────────────
  const [autoProgress,   setAutoProgress]   = useState(0)   // queries completed
  const [autoTotal,      setAutoTotal]      = useState(0)   // total queries
  const [autoRunning,    setAutoRunning]    = useState(false)
  const [autoDone,       setAutoDone]       = useState(false)
  const discoveryRef = useRef(false)  // prevents double-run in StrictMode

  // ── Manual search state ─────────────────────────────────────────────────
  const [manualRunning,  setManualRunning]  = useState(false)

  // ── Import state ────────────────────────────────────────────────────────
  const [importStatus,   setImportStatus]   = useState('idle')

  // ── Logo / bulk edit state ──────────────────────────────────────────────
  const [editingVenueId, setEditingVenueId] = useState(null)
  const [savingLogo,     setSavingLogo]     = useState(false)
  const [showBulkEdit,   setShowBulkEdit]   = useState(false)
  const [bulkPhotoUrl,   setBulkPhotoUrl]   = useState('')
  const [savingBulk,     setSavingBulk]     = useState(false)

  // ── Load Firestore venues on mount ──────────────────────────────────────
  useEffect(() => {
    if (venuesStatus === 'idle') dispatch(fetchVenues())
  }, [dispatch, venuesStatus])

  // ── Auto-discovery on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (discoveryRef.current) return   // already started (StrictMode double-invoke guard)
    discoveryRef.current = true
    runAutoDiscovery()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runAutoDiscovery() {
    setAutoRunning(true)
    setAutoDone(false)
    setAutoProgress(0)
    setAutoTotal(AUTO_QUERIES.length)

    // Use a local seen set so we deduplicate across all auto queries
    let localSeen = new Set()
    const accumulated = []

    for (let i = 0; i < AUTO_QUERIES.length; i++) {
      const found = await searchDanceVenues(AUTO_QUERIES[i], localSeen)
      found.forEach((v) => localSeen.add(v.placeId))
      accumulated.push(...found)

      // Update state after each query so results appear progressively
      setResults([...accumulated])
      setSeenIds(new Set(localSeen))
      setAutoProgress(i + 1)
    }

    setAutoRunning(false)
    setAutoDone(true)
  }

  // ── Manual search (additive — results stack on top of auto-discovery) ───
  async function handleManualSearch(query) {
    const q = query.trim()
    if (!q || manualRunning) return
    setManualRunning(true)

    const found = await searchDanceVenues(q, seenIds)
    setResults((prev) => [...prev, ...found])
    setSeenIds((prev) => {
      const next = new Set(prev)
      found.forEach((v) => next.add(v.placeId))
      return next
    })
    setManualRunning(false)
    if (found.length === 0) showToast('No new results for that search')
  }

  function handleClearResults() {
    setResults([])
    setSeenIds(new Set())
    setSelectedIds(new Set())
    setExpandedCard(null)
    setAutoDone(false)
    setAutoProgress(0)
    // Re-run auto-discovery
    discoveryRef.current = false
    setTimeout(runAutoDiscovery, 0)
  }

  // ── Selection helpers ───────────────────────────────────────────────────
  function toggleSelect(placeId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(placeId) ? next.delete(placeId) : next.add(placeId)
      return next
    })
  }

  const eligibleIds = results
    .filter((v) => !importedIds.has(v.placeId))
    .map((v) => v.placeId)

  const allEligibleSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selectedIds.has(id))

  function handleSelectAll() {
    setSelectedIds(allEligibleSelected ? new Set() : new Set(eligibleIds))
  }

  // ── Details expand ──────────────────────────────────────────────────────
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

  // ── Import ──────────────────────────────────────────────────────────────
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

  // ── V Logic toggle ──────────────────────────────────────────────────────
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

  // ── Style tags ──────────────────────────────────────────────────────────
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

  // ── Social fields ───────────────────────────────────────────────────────
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

  // ── Logo editing ────────────────────────────────────────────────────────
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

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3200)
  }

  const isImporting = importStatus === 'loading'

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Venue Control Center</h1>
        <p className={styles.pageSubtitle}>
          Discover · import · control every dance venue in Israel
        </p>
      </div>

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
        <div className={styles.autoDiscoveryDone}>
          ✓ Found {results.length} venue{results.length !== 1 ? 's' : ''} across Israel
          <button className={styles.rerunBtn} onClick={handleClearResults}>↺ Re-scan</button>
        </div>
      )}

      {/* ── Manual search (additive — stacks on auto results) ── */}
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
              <button
                className={styles.selectAllBtn}
                onClick={handleSelectAll}
                disabled={isImporting}
              >
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

      {/* ── Initial loading state (no results yet, auto-discovery running) ── */}
      {results.length === 0 && autoRunning && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🗺</div>
          <p>Scanning dance venues across Israel…</p>
        </div>
      )}

      {/* ── Empty state (done, nothing found) ── */}
      {results.length === 0 && !autoRunning && autoDone && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p>No venues found. Try a specific search above.</p>
        </div>
      )}

      {/* ── Section C: Imported venues ── */}
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
            {importedVenues.map((venue) => (
              <ImportedVenueRow
                key={venue.placeId}
                venue={venue}
                isEditing={editingVenueId === venue.placeId}
                onStartEdit={() => setEditingVenueId(venue.placeId)}
                onCancelEdit={() => setEditingVenueId(null)}
                onSaveLogo={handleSaveLogo}
                isSaving={savingLogo && editingVenueId === venue.placeId}
                onToggleActive={handleToggleActive}
                onToggleStyle={handleToggleStyle}
                onSaveSocialField={handleSaveSocialField}
              />
            ))}
          </div>
        </section>
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
