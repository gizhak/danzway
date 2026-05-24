import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../services/firebase'
import { selectAllVenues, fetchVenues } from '../../store/venuesSlice'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../services/firebase'
import { approveEvent, rejectEvent, deleteExpiredPendingEvents, deleteApprovedEvent, purgeCompletedPendingEvents } from '../../services/pendingEventsService'
import { updateEventInFirestore } from '../../services/eventsService'
import { parseEventWithAI } from '../../services/aiParserService'
import { parseOcrText } from '../../utils/ocrParser'
import styles from './FlyersReviewPage.module.css'

const DANCE_STYLES  = ['Salsa', 'Bachata', 'Kizomba', 'Zouk']
const ADMIN_EMAIL   = 'guy.izhak.tech@gmail.com'
const MAPS_API_KEY  = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

// Client-side geocode (production) — domain is whitelisted in Google Cloud Console.
// Returns { placeId, coordinates, formattedAddress, name } | null
async function geocodeClientSide(venue, address, location) {
  if (address) {
    const q   = [address, location, 'Israel'].filter(Boolean).join(', ')
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${MAPS_API_KEY}`)
    const data = await res.json()
    if (data.status === 'OK' && data.results[0]) {
      const r = data.results[0]
      return {
        placeId:          r.place_id,
        coordinates:      { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng },
        formattedAddress: r.formatted_address,
        name:             null,
      }
    }
  }
  if (venue) {
    const q   = [venue, location, 'Israel'].filter(Boolean).join(', ')
    const res  = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.location,places.formattedAddress,places.displayName',
      },
      body: JSON.stringify({ textQuery: q }),
    })
    const data = await res.json()
    if (data.places?.[0]) {
      const p = data.places[0]
      return {
        placeId:          p.id,
        coordinates:      { latitude: p.location.latitude, longitude: p.location.longitude },
        formattedAddress: p.formattedAddress,
        name:             p.displayName?.text ?? null,
      }
    }
  }
  return null
}

// In dev: routes through Cloud Function emulator (bypasses localhost referrer block).
// In prod: calls APIs directly (domain whitelisted in Google Cloud Console).
async function geocodeViaFunction(venue, address, location) {
  if (!venue && !address) return null
  if (import.meta.env.PROD) return geocodeClientSide(venue, address, location)
  const fn = httpsCallable(functions, 'geocodeVenue', { timeout: 15000 })
  const result = await fn({ venue: venue ?? null, address: address ?? null, location: location ?? null, apiKey: MAPS_API_KEY })
  return result.data ?? null
}

// ─── Hebrew city → English ────────────────────────────────────────────────────

const HE_CITIES = {
  'תל אביב': 'Tel Aviv', 'ירושלים': 'Jerusalem', 'חיפה': 'Haifa',
  'ראשון לציון': 'Rishon LeZion', 'פתח תקווה': 'Petah Tikva',
  'הרצליה': 'Herzliya', 'רמת גן': 'Ramat Gan', 'נתניה': 'Netanya',
  'אשדוד': 'Ashdod', 'באר שבע': 'Beer Sheva', 'רחובות': 'Rehovot', 'בת ים': 'Bat Yam',
}

function splitAddressCity(str) {
  if (!str) return { street: null, city: null }
  for (const [heCity, enCity] of Object.entries(HE_CITIES)) {
    if (str.includes(heCity)) {
      const street = str.replace(new RegExp(`,?\\s*${heCity}`), '').trim()
      return { street: street || null, city: enCity }
    }
  }
  return { street: str, city: null }
}

// Parse structured hints the user typed in the submit form
// e.g. "מקום: גסולינה\nכתובת: הס 31, הרצליה\nתאריך: 2026-05-23"
function parseRawTextHints(rawText) {
  if (!rawText) return {}
  const hints = {}
  for (const line of rawText.split('\n')) {
    const kv = line.match(/^([^:]+):\s*(.+)$/)
    if (!kv) continue
    const key = kv[1].trim()
    const val = kv[2].trim()
    if (key === 'כתובת') {
      const { street, city } = splitAddressCity(val)
      hints.address  = street
      if (city) hints.location = city
    } else if (key === 'מקום')   hints.venue    = val
    else if (key === 'תאריך')    hints.startDate = val
    else if (key === 'שעה')      hints.time      = val
  }
  return hints
}

// ─── Venue matching ───────────────────────────────────────────────────────────

function matchVenue(venueName, venuesList) {
  if (!venueName || !venuesList?.length) return null
  // Remove common noise words, then keep only letters+digits
  const norm = s => (s ?? '')
    .toLowerCase()
    .replace(/\b(מועדון|club|bar|hall|the|latin|dance|lounge)\b/gi, '')
    .replace(/[^a-zא-ת0-9]/g, '')
  const needle = norm(venueName)
  if (needle.length < 3) return null
  return venuesList.find(v => {
    const hay = norm(v.name)
    return hay && (hay.includes(needle) || needle.includes(hay))
  }) ?? null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    title: '', venue: '', location: '', address: '', startDate: '', endDate: '',
    time: '', endTime: '', description: '', styles: [], price: '', currency: 'ILS',
    ticketLink: '', coordinates: null, placeId: '',
  }
}

function pendingToForm(p) {
  return {
    title:       p.title        ?? '',
    venue:       p.venue        ?? '',
    location:    p.location     ?? '',
    address:     p.address      ?? '',
    startDate:   p.startDate    ?? p.date ?? '',
    endDate:     p.endDate      ?? p.date ?? '',
    time:        p.time         ?? '',
    endTime:     p.endTime      ?? '',
    description: p.description  ?? '',
    styles:      p.styles       ?? [],
    price:       p.price        ?? '',
    currency:    p.currency     ?? 'ILS',
    ticketLink:  p.ticketLink   ?? '',
    coordinates: p.coordinates  ?? null,
    placeId:     p.placeId      ?? '',
  }
}

// ─── Approved Event Card ──────────────────────────────────────────────────────

function eventToForm(ev) {
  return {
    title:       ev.title        ?? '',
    venue:       ev.venue        ?? '',
    location:    ev.location     ?? '',
    address:     ev.address      ?? '',
    startDate:   ev.startDate    ?? ev.date ?? '',
    endDate:     ev.endDate      ?? '',
    time:        ev.time         ?? '',
    endTime:     ev.endTime      ?? '',
    description: ev.description  ?? '',
    styles:      ev.styles       ?? [],
    price:       ev.price        ?? '',
    currency:    ev.currency     ?? 'ILS',
    ticketLink:  ev.ticketLink   ?? '',
    coordinates: ev.coordinates  ?? null,
  }
}

function ApprovedEventCard({ event, venues }) {
  const [editing,       setEditing]       = useState(false)
  const [form,          setForm]          = useState(() => eventToForm(event))
  const [saving,        setSaving]        = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [findingCoords, setFindingCoords] = useState(false)
  const [err,           setErr]           = useState('')
  const [imgLightbox,   setImgLightbox]   = useState(false)

  function setField(key, val) { setForm(prev => ({ ...prev, [key]: val })) }

  function toggleStyle(s) {
    setForm(prev => ({
      ...prev,
      styles: prev.styles.includes(s)
        ? prev.styles.filter(x => x !== s)
        : [...prev.styles, s],
    }))
  }

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      await updateEventInFirestore(event.id, {
        title:       form.title,
        date:        form.startDate || null,
        startDate:   form.startDate || null,
        endDate:     form.endDate   || null,
        time:        form.time      || null,
        endTime:     form.endTime   || null,
        venue:       form.venue     || null,
        location:    form.location  || null,
        address:     form.address   || null,
        styles:      form.styles,
        price:       form.price,
        ticketLink:  form.ticketLink || null,
        description: form.description || '',
        coordinates: form.coordinates ?? null,
      })
      setEditing(false)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setErr('')
    try {
      await deleteApprovedEvent(event.id, event.flyerStoragePath)
    } catch (e) {
      setErr(e.message)
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleFindCoords() {
    setFindingCoords(true)
    setErr('')
    try {
      const venueName = form.venue || event.venue

      // 1. Check local venues DB first — free, no API quota
      const localMatch = matchVenue(venueName, venues)
      if (localMatch?.coordinates) {
        const coords = {
          latitude:  localMatch.coordinates.latitude  ?? localMatch.coordinates.lat,
          longitude: localMatch.coordinates.longitude ?? localMatch.coordinates.lng,
        }
        setForm(prev => ({ ...prev, coordinates: coords, placeId: localMatch.placeId ?? prev.placeId }))
        await updateEventInFirestore(event.id, { coordinates: coords, placeId: localMatch.placeId ?? null })
        return
      }

      // 2. Fall back to Cloud Function (Places API)
      const geo = await geocodeViaFunction(
        venueName,
        form.address  || event.address,
        form.location || event.location,
      )
      if (geo?.coordinates) {
        setForm(prev => ({ ...prev, coordinates: geo.coordinates, placeId: geo.placeId ?? prev.placeId }))
        await updateEventInFirestore(event.id, { coordinates: geo.coordinates, placeId: geo.placeId ?? null })
      } else {
        setErr('לא נמצאו תוצאות — נסה לתקן את הכתובת ולשמור לפני Find')
      }
    } catch (e) {
      setErr(e.message)
    } finally {
      setFindingCoords(false)
    }
  }

  const dateStr = event.startDate || event.date
  const fmtDate = iso =>
    iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  return (
    <>
      {imgLightbox && (
        <div className={styles.adminLightbox} onClick={() => setImgLightbox(false)}>
          <button className={styles.adminLightboxClose} onClick={() => setImgLightbox(false)}>✕</button>
          <img src={event.image} alt="Flyer" className={styles.adminLightboxImg}
            onClick={e => e.stopPropagation()} />
        </div>
      )}
      <div className={styles.approvedCard}>
        <div className={styles.approvedRow}>
          {event.image && (
            <img src={event.image} alt="" className={styles.approvedThumb}
              onClick={() => setImgLightbox(true)} />
          )}
          <div className={styles.approvedInfo}>
            <span className={styles.approvedTitle}>{event.title || '(no title)'}</span>
            <span className={styles.approvedMeta}>
              {fmtDate(dateStr)}
              {event.time     && ` · ${event.time}`}
              {event.venue    && ` · ${event.venue}`}
              {event.location && ` · ${event.location}`}
            </span>
          </div>
          <div className={styles.approvedBtns}>
            {!form.coordinates?.latitude && (
              <button
                className={styles.findBtn}
                onClick={handleFindCoords}
                disabled={findingCoords}
                title="Find coordinates via Google Places"
              >
                {findingCoords ? '…' : '📍 Find'}
              </button>
            )}
            <button
              className={`${styles.editBtn} ${editing ? styles.editBtnActive : ''}`}
              onClick={() => { setEditing(p => !p); setConfirmDelete(false); setErr('') }}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
            {!confirmDelete ? (
              <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)}>Delete</button>
            ) : (
              <>
                <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting}>
                  {deleting ? '…' : 'Confirm?'}
                </button>
                <button className={styles.deleteCancelBtn} onClick={() => setConfirmDelete(false)}>No</button>
              </>
            )}
          </div>
        </div>

        {err && <p className={styles.actionErr}>⚠️ {err}</p>}

        {editing && (
          <div className={styles.approvedEditForm}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Title *</label>
              <input className={styles.fieldInput} value={form.title}
                onChange={e => setField('title', e.target.value)} placeholder="Event title" />
            </div>

            <div className={styles.fieldGrid2}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Start Date</label>
                <input className={styles.fieldInput} type="date" value={form.startDate}
                  onChange={e => setField('startDate', e.target.value)} />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>End Date</label>
                <input className={styles.fieldInput} type="date" value={form.endDate}
                  onChange={e => setField('endDate', e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGrid2}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Start Time</label>
                <input className={styles.fieldInput} type="time" value={form.time}
                  onChange={e => setField('time', e.target.value)} />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>End Time</label>
                <input className={styles.fieldInput} type="time" value={form.endTime}
                  onChange={e => setField('endTime', e.target.value)} />
              </div>
            </div>

            <div className={styles.fieldGrid2}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Price (ILS)</label>
                <input className={styles.fieldInput} type="number" min="0" value={form.price}
                  onChange={e => setField('price', e.target.value)} placeholder="0 = free" />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Venue</label>
                <input className={styles.fieldInput} value={form.venue}
                  onChange={e => setField('venue', e.target.value)} placeholder="Club / venue name" />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>City</label>
                <input className={styles.fieldInput} value={form.location}
                  onChange={e => setField('location', e.target.value)} placeholder="Tel Aviv…" />
              </div>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Street Address</label>
              <input className={styles.fieldInput} value={form.address}
                onChange={e => setField('address', e.target.value)} placeholder="רחוב + מספר, עיר" />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Ticket Link</label>
              <input className={styles.fieldInput} type="url" value={form.ticketLink}
                onChange={e => setField('ticketLink', e.target.value)} placeholder="https://…" />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Dance Styles</label>
              <div className={styles.styleChips}>
                {DANCE_STYLES.map(s => (
                  <button key={s} type="button"
                    className={`${styles.styleChip} ${form.styles.includes(s) ? styles.styleChipOn : ''}`}
                    onClick={() => toggleStyle(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Description</label>
              <textarea className={styles.fieldTextarea} value={form.description} rows={3}
                onChange={e => setField('description', e.target.value)} />
            </div>

            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Coordinates (lat / lng)</label>
              <div className={styles.coordRow}>
                <input className={styles.fieldInput} type="number" step="any"
                  value={form.coordinates?.latitude ?? ''}
                  onChange={e => setField('coordinates', { ...(form.coordinates ?? {}), latitude: parseFloat(e.target.value) })}
                  placeholder="32.0853 (latitude)" />
                <input className={styles.fieldInput} type="number" step="any"
                  value={form.coordinates?.longitude ?? ''}
                  onChange={e => setField('coordinates', { ...(form.coordinates ?? {}), longitude: parseFloat(e.target.value) })}
                  placeholder="34.7818 (longitude)" />
              </div>
              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.2rem' }}>
                Get from Google Maps: right-click on venue → copy coordinates
              </span>
            </div>

            <div className={styles.approvedSaveRow}>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.title}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ pending, venues, onApproved, onRejected }) {
  const [form,      setForm]      = useState(() => pendingToForm(pending))
  const [parsing,      setParsing]      = useState(false)
  const [parsePhase,   setParsePhase]   = useState('')
  const [parseErr,     setParseErr]     = useState('')
  const [venueMatch,   setVenueMatch]   = useState(null)
  const [imgLightbox,  setImgLightbox]  = useState(false)
  const [ocrParsing, setOcrParsing] = useState(false)
  const [ocrErr,     setOcrErr]     = useState('')
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [actionErr, setActionErr] = useState('')

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function toggleStyle(s) {
    setForm(prev => ({
      ...prev,
      styles: prev.styles.includes(s)
        ? prev.styles.filter(x => x !== s)
        : [...prev.styles, s],
    }))
  }

  async function handleOcrParse() {
    if (!pending.flyerImageUrl) return
    setOcrParsing(true)
    setOcrErr('')
    try {
      const Tesseract = (await import('tesseract.js')).default
      const { data: { text } } = await Tesseract.recognize(
        pending.flyerImageUrl,
        'heb+eng+spa',
        { logger: m => console.log('[OCR]', m.status, m.progress) }
      )
      console.log('[OCR] Raw text:\n', text)
      const parsed = parseOcrText(text)
      setForm(prev => ({
        ...prev,
        title:      parsed.title      || prev.title,
        startDate:  parsed.startDate  || prev.startDate,
        endDate:    parsed.endDate    || prev.endDate,
        time:       parsed.time       || prev.time,
        price:      parsed.price      != null ? String(parsed.price) : prev.price,
        ticketLink: parsed.ticketLink || prev.ticketLink,
        styles:     parsed.styles.length ? parsed.styles : prev.styles,
      }))
    } catch (err) {
      setOcrErr(err.message)
    } finally {
      setOcrParsing(false)
    }
  }

  async function handleParse() {
    if (!pending.flyerImageUrl && !pending.rawText) return
    setParsing(true)
    setParsePhase('ocr')
    setParseErr('')
    try {
      // Step 1: OCR → reliable text extraction (times, dates, addresses)
      let ocrText   = ''
      let ocrParsed = null
      if (pending.flyerImageUrl) {
        try {
          const Tesseract = (await import('tesseract.js')).default
          const { data: { text } } = await Tesseract.recognize(
            pending.flyerImageUrl, 'heb+eng+spa', {}
          )
          ocrText   = text.trim()
          ocrParsed = parseOcrText(ocrText)
          console.log('[OCR parsed]', ocrParsed)
        } catch { /* OCR failed — AI will work from image alone */ }
      }

      // Step 2: AI Vision → semantic understanding (venue name, styles, context)
      setParsePhase('ai')
      const aiParsed = await parseEventWithAI(pending.flyerImageUrl, pending.rawText, ocrText)
      console.log('[AI parsed]', aiParsed)

      // Step 3: Merge — user hints > OCR > AI
      // User-typed hints are most reliable (they explicitly provided the data)
      const hints = parseRawTextHints(pending.rawText)
      console.log('[Hints parsed]', hints)

      const merged = {
        title:       aiParsed.title                                    ?? ocrParsed?.title,
        venue:       hints.venue      ?? aiParsed.venue                ?? null,
        location:    hints.location   ?? ocrParsed?.location           ?? aiParsed.location,
        address:     hints.address    ?? ocrParsed?.address            ?? aiParsed.address,
        startDate:   hints.startDate  ?? ocrParsed?.startDate          ?? aiParsed.startDate,
        endDate:                         ocrParsed?.endDate            ?? aiParsed.endDate,
        time:        hints.time       ?? ocrParsed?.time               ?? aiParsed.time,
        description: aiParsed.description,
        styles:      aiParsed.styles?.length ? aiParsed.styles : (ocrParsed?.styles ?? []),
        price:       ocrParsed?.price != null ? ocrParsed.price        : aiParsed.price,
        currency:    aiParsed.currency    ?? 'ILS',
        ticketLink:  ocrParsed?.ticketLink ?? aiParsed.ticketLink,
        coordinates: aiParsed.coordinates ?? null,
      }

      // Step 4: Resolve coordinates — local venue DB first, then Cloud Function
      const matched = matchVenue(merged.venue, venues)
      if (!merged.coordinates) {
        if (matched?.coordinates) {
          merged.coordinates = {
            latitude:  matched.coordinates.latitude  ?? matched.coordinates.lat,
            longitude: matched.coordinates.longitude ?? matched.coordinates.lng,
          }
        } else if (merged.venue || merged.address) {
          try {
            const geo = await geocodeViaFunction(merged.venue, merged.address, merged.location)
            if (geo?.coordinates) merged.coordinates = geo.coordinates
          } catch { /* non-blocking — admin can fix manually */ }
        }
      }
      setVenueMatch(matched ?? null)

      setForm(prev => ({
        ...prev,
        title:       merged.title       ?? prev.title,
        venue:       merged.venue       ?? prev.venue,
        location:    merged.location    ?? prev.location,
        address:     merged.address     ?? prev.address,
        startDate:   merged.startDate   ?? prev.startDate,
        endDate:     merged.endDate     ?? prev.endDate,
        time:        merged.time        ?? prev.time,
        description: merged.description ?? prev.description,
        styles:      merged.styles?.length ? merged.styles : prev.styles,
        price:       merged.price       != null ? String(merged.price) : prev.price,
        currency:    merged.currency    ?? prev.currency,
        ticketLink:  merged.ticketLink  ?? prev.ticketLink,
        coordinates: merged.coordinates ?? prev.coordinates,
        placeId:     matched ? matched.placeId : (prev.placeId ?? ''),
      }))
      // Persist merged data back to Firestore so it survives a page refresh
      await updateDoc(doc(db, 'pending_events', pending.id), {
        ...merged,
        startDate:   merged.startDate ?? null,
        endDate:     merged.endDate   ?? null,
        date:        merged.startDate ?? null,
        address:     merged.address   ?? null,
      })
    } catch (err) {
      setParseErr(err.message ?? err.code ?? String(err))
    } finally {
      setParsing(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    setActionErr('')
    try {
      let coordinates = form.coordinates ?? null
      // Last-chance coordinate resolution — local DB first, then Cloud Function
      if (!coordinates) {
        const localMatch = matchVenue(form.venue, venues)
        if (localMatch?.coordinates) {
          coordinates = {
            latitude:  localMatch.coordinates.latitude  ?? localMatch.coordinates.lat,
            longitude: localMatch.coordinates.longitude ?? localMatch.coordinates.lng,
          }
        } else if (form.venue || form.address) {
          try {
            const geo = await geocodeViaFunction(form.venue, form.address, form.location)
            if (geo?.coordinates) coordinates = geo.coordinates
          } catch { /* non-blocking */ }
        }
      }
      await approveEvent({ ...pending, ...form, isSpecial: true, coordinates })
      onApproved(pending.id)
    } catch (err) {
      setActionErr(err.message)
      setApproving(false)
    }
  }

  async function handleReject() {
    setRejecting(true)
    setActionErr('')
    try {
      await rejectEvent(pending.id, pending.flyerStoragePath)
      onRejected(pending.id)
    } catch (err) {
      setActionErr(err.message)
      setRejecting(false)
    }
  }

  const submittedDate = pending.submittedAt
    ? new Date(pending.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'unknown'

  return (
    <>
    {imgLightbox && (
      <div className={styles.adminLightbox} onClick={() => setImgLightbox(false)}>
        <button className={styles.adminLightboxClose} onClick={() => setImgLightbox(false)}>✕</button>
        <img
          src={pending.flyerImageUrl}
          alt="Flyer"
          className={styles.adminLightboxImg}
          onClick={e => e.stopPropagation()}
        />
      </div>
    )}

    <div className={styles.card}>

      {/* ── Card header: meta only ── */}
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <span className={styles.metaLabel}>Submitted</span>
          <span className={styles.metaValue}>{submittedDate}</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaLabel}>By</span>
          <span className={styles.metaValue}>{pending.submittedBy}</span>
        </div>
      </div>

      {/* ── Parse buttons row (full width, always visible) ── */}
      <div className={styles.parseBtnsRow}>
        <button
          className={styles.parseBtn}
          onClick={handleParse}
          disabled={parsing}
        >
          {parsing ? '⏳ Parsing…' : '✨ Parse with AI'}
        </button>
        <button
          className={styles.ocrBtn}
          onClick={handleOcrParse}
          disabled={ocrParsing || !pending.flyerImageUrl}
        >
          {ocrParsing ? '⏳ Reading…' : '🔍 Local OCR'}
        </button>
      </div>

      {parseErr && <p className={styles.parseErr}>⚠️ {parseErr}</p>}
      {ocrErr   && <p className={styles.parseErr}>⚠️ OCR: {ocrErr}</p>}

      {form.startDate && new Date(form.startDate) < new Date(new Date().toDateString()) && (
        <p className={styles.pastDateWarn}>
          ⚠️ תאריך המסיבה עבר ({form.startDate}) — האירוע בעבר!
        </p>
      )}

      {/* ── Two-column body ── */}
      <div className={styles.cardBody} style={{ position: 'relative' }}>
        {parsing && (
          <div className={styles.parseOverlay}>
            <div className={styles.parseSpinner} />
            <span>{parsePhase === 'ocr' ? '🔍 קורא טקסט מהתמונה…' : '✨ מנתח עם AI…'}</span>
          </div>
        )}

        {/* Left: raw text */}
        <div className={styles.rawCol}>
          <div className={styles.colLabel}>RAW SUBMISSION</div>
          {pending.flyerImageUrl && (
            <img
              src={pending.flyerImageUrl}
              alt="Flyer"
              className={styles.flyerThumb}
              onClick={() => setImgLightbox(true)}
            />
          )}
          <pre className={styles.rawText}>{pending.rawText ?? '(no raw text)'}</pre>
        </div>

        {/* Right: editable form */}
        <div className={styles.formCol}>
          <div className={styles.colLabel}>PARSED DATA <span className={styles.editableHint}>(editable)</span></div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Title *</label>
            <input
              className={styles.fieldInput}
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="Event title"
            />
          </div>

          <div className={styles.fieldGrid2}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Start Date</label>
              <input
                className={styles.fieldInput}
                type="date"
                value={form.startDate}
                onChange={e => setField('startDate', e.target.value)}
              />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>End Date</label>
              <input
                className={styles.fieldInput}
                type="date"
                value={form.endDate}
                onChange={e => setField('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className={styles.fieldGrid2}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Start Time</label>
              <input
                className={styles.fieldInput}
                type="time"
                value={form.time}
                onChange={e => setField('time', e.target.value)}
              />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>End Time</label>
              <input
                className={styles.fieldInput}
                type="time"
                value={form.endTime}
                onChange={e => setField('endTime', e.target.value)}
              />
            </div>
          </div>

          <div className={styles.fieldGrid2}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Price (ILS)</label>
              <input
                className={styles.fieldInput}
                type="number"
                min="0"
                value={form.price}
                onChange={e => setField('price', e.target.value)}
                placeholder="0 = free"
              />
            </div>
          </div>

          <div className={styles.fieldGrid2}>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Venue</label>
              <input
                className={styles.fieldInput}
                value={form.venue}
                onChange={e => setField('venue', e.target.value)}
                placeholder="Club / venue name"
              />
            </div>
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>City</label>
              <input
                className={styles.fieldInput}
                value={form.location}
                onChange={e => setField('location', e.target.value)}
                placeholder="Tel Aviv, Haifa…"
              />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Street Address</label>
            <input
              className={styles.fieldInput}
              value={form.address}
              onChange={e => setField('address', e.target.value)}
              placeholder="לישנסקי 6, הרצל 32…"
            />
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Ticket Link</label>
            <input
              className={styles.fieldInput}
              type="url"
              value={form.ticketLink}
              onChange={e => setField('ticketLink', e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Google Places ID (optional)</label>
            <input
              className={styles.fieldInput}
              value={form.placeId}
              onChange={e => { setField('placeId', e.target.value); setVenueMatch(null) }}
              placeholder="ChIJ… (leave blank for standalone festival)"
            />
            {venueMatch && (
              <span className={styles.venueMatchBadge}>
                ✓ נמצא במאגר: {venueMatch.name}
              </span>
            )}
          </div>

          {form.coordinates && (
            <div className={styles.fieldRow}>
              <label className={styles.fieldLabel}>Coordinates</label>
              <div className={styles.coordRow}>
                <input
                  className={styles.fieldInput}
                  type="number"
                  step="any"
                  value={form.coordinates.latitude}
                  onChange={e => setField('coordinates', { ...form.coordinates, latitude: parseFloat(e.target.value) })}
                  placeholder="Latitude"
                />
                <input
                  className={styles.fieldInput}
                  type="number"
                  step="any"
                  value={form.coordinates.longitude}
                  onChange={e => setField('coordinates', { ...form.coordinates, longitude: parseFloat(e.target.value) })}
                  placeholder="Longitude"
                />
              </div>
            </div>
          )}

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Dance Styles</label>
            <div className={styles.styleChips}>
              {DANCE_STYLES.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.styleChip} ${form.styles.includes(s) ? styles.styleChipOn : ''}`}
                  onClick={() => toggleStyle(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Description</label>
            <textarea
              className={styles.fieldTextarea}
              value={form.description}
              onChange={e => setField('description', e.target.value)}
              rows={3}
              placeholder="Brief event description…"
            />
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      {actionErr && <p className={styles.actionErr}>⚠️ {actionErr}</p>}
      <div className={styles.cardActions}>
        <button
          className={styles.approveBtn}
          onClick={handleApprove}
          disabled={!form.title || !form.startDate || approving || rejecting}
        >
          {approving ? '⏳ Publishing…' : '✓ Approve & Publish'}
        </button>
        <button
          className={styles.rejectBtn}
          onClick={handleReject}
          disabled={approving || rejecting}
        >
          {rejecting ? '⏳ Rejecting…' : '✗ Reject'}
        </button>
      </div>
    </div>
    </>
  )
}

// ─── Login gate ───────────────────────────────────────────────────────────────

function LoginGate({ onAuth }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setErr('Invalid credentials')
      setLoading(false)
    }
  }

  return (
    <div className={styles.loginWrap}>
      <h2 className={styles.loginTitle}>Admin Login</h2>
      <form onSubmit={handleLogin} className={styles.loginForm}>
        <input className={styles.loginInput} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className={styles.loginInput} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <p className={styles.loginErr}>{err}</p>}
        <button className={styles.loginBtn} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FlyersReviewPage() {
  const venues        = useSelector(selectAllVenues)
  const dispatch      = useDispatch()
  const [user,          setUser]          = useState(undefined)
  const [pending,       setPending]       = useState([])
  const [approved,      setApproved]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [cleaningUp,    setCleaningUp]    = useState(false)
  const [cleanupMsg,    setCleanupMsg]    = useState('')
  const [purging,       setPurging]       = useState(false)

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  // Load venues for matching
  useEffect(() => {
    if (user && user.email === ADMIN_EMAIL && !venues.length) {
      dispatch(fetchVenues())
    }
  }, [user, dispatch, venues.length])

  // Real-time listener — only user_submission events
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    const q = query(
      collection(db, 'pending_events'),
      where('status',  '==', 'raw'),
      where('source',  '==', 'user_submission')
    )
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => {
        const data = d.data()
        return {
          ...data,
          submittedAt: data.submittedAt?.toMillis?.() ?? data.submittedAt ?? null,
        }
      }).sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      setPending(docs)
    })
  }, [user])

  // Real-time listener — approved special events
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return
    const q = query(collection(db, 'events'), where('isSpecial', '==', true))
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => d.data())
        .sort((a, b) => {
          const aDate = a.startDate || a.date || ''
          const bDate = b.startDate || b.date || ''
          return bDate.localeCompare(aDate)
        })
      setApproved(docs)
    })
  }, [user])

  function removeCard(id) {
    setPending(prev => prev.filter(p => p.id !== id))
  }

  async function handleCleanupExpired() {
    setCleaningUp(true)
    setCleanupMsg('')
    try {
      const count = await deleteExpiredPendingEvents()
      setCleanupMsg(count > 0 ? `נמחקו ${count} אירועים שעברו` : 'אין אירועים שעברו')
    } catch (err) {
      setCleanupMsg(`שגיאה: ${err.message}`)
    } finally {
      setCleaningUp(false)
    }
  }

  async function handlePurgeCompleted() {
    setPurging(true)
    setCleanupMsg('')
    try {
      const count = await purgeCompletedPendingEvents()
      setCleanupMsg(count > 0 ? `נוקו ${count} רשומות ישנות` : 'אין רשומות לניקוי')
    } catch (err) {
      setCleanupMsg(`שגיאה: ${err.message}`)
    } finally {
      setPurging(false)
    }
  }

  if (loading) return <div className={styles.centeredMsg}>Loading…</div>
  if (!user || user.email !== ADMIN_EMAIL) return <LoginGate />

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/admin/venues" className={styles.backLink}>← Admin Dashboard</Link>
        <h1 className={styles.pageTitle}>⭐ Special Events Review</h1>
        <span className={styles.badge}>{pending.length} pending</span>
        <button
          className={styles.cleanupBtn}
          onClick={handleCleanupExpired}
          disabled={cleaningUp}
          title="Delete all pending submissions whose event date has already passed"
        >
          {cleaningUp ? '⏳…' : '🗑 Delete Expired'}
        </button>
        <button
          className={styles.purgeBtn}
          onClick={handlePurgeCompleted}
          disabled={purging}
          title="Remove all approved/rejected records so the same flyer can be re-submitted"
        >
          {purging ? '⏳…' : '🧹 Clean DB'}
        </button>
        {cleanupMsg && <span className={styles.cleanupMsg}>{cleanupMsg}</span>}
      </div>

      {pending.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>⭐</div>
          <p className={styles.emptyTitle}>No pending submissions</p>
          <p className={styles.emptyText}>User-submitted events will appear here for review.</p>
        </div>
      ) : (
        <div className={styles.cardList}>
          {pending.map(p => (
            <ReviewCard
              key={p.id}
              pending={p}
              venues={venues}
              onApproved={removeCard}
              onRejected={removeCard}
            />
          ))}
        </div>
      )}

      {approved.length > 0 && (
        <div className={styles.approvedSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Approved Events</h2>
            <span className={styles.badge}>{approved.length}</span>
          </div>
          <div className={styles.approvedList}>
            {approved.map(ev => (
              <ApprovedEventCard key={ev.id} event={ev} venues={venues} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
