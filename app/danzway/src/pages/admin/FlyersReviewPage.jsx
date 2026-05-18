import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../services/firebase'
import { approveEvent, rejectEvent } from '../../services/pendingEventsService'
import { parseEventWithAI } from '../../services/aiParserService'
import styles from './FlyersReviewPage.module.css'

const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk']
const ADMIN_EMAIL  = 'guy.izhak.tech@gmail.com'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyForm() {
  return {
    title: '', venue: '', location: '', startDate: '', endDate: '',
    time: '', description: '', styles: [], price: '', currency: 'ILS',
    ticketLink: '', coordinates: null, placeId: '',
  }
}

function pendingToForm(p) {
  return {
    title:       p.title        ?? '',
    venue:       p.venue        ?? '',
    location:    p.location     ?? '',
    startDate:   p.startDate    ?? p.date ?? '',
    endDate:     p.endDate      ?? p.date ?? '',
    time:        p.time         ?? '',
    description: p.description  ?? '',
    styles:      p.styles       ?? [],
    price:       p.price        ?? '',
    currency:    p.currency     ?? 'ILS',
    ticketLink:  p.ticketLink   ?? '',
    coordinates: p.coordinates  ?? null,
    placeId:     p.placeId      ?? '',
  }
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ pending, onApproved, onRejected }) {
  const [form,      setForm]      = useState(() => pendingToForm(pending))
  const [parsing,   setParsing]   = useState(false)
  const [parseErr,  setParseErr]  = useState('')
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

  async function handleParse() {
    if (!pending.rawText) return
    setParsing(true)
    setParseErr('')
    try {
      const parsed = await parseEventWithAI(pending.rawText)
      setForm(prev => ({
        ...prev,
        title:       parsed.title       ?? prev.title,
        venue:       parsed.venue       ?? prev.venue,
        location:    parsed.location    ?? prev.location,
        startDate:   parsed.startDate   ?? prev.startDate,
        endDate:     parsed.endDate     ?? prev.endDate,
        time:        parsed.time        ?? prev.time,
        description: parsed.description ?? prev.description,
        styles:      parsed.styles?.length ? parsed.styles : prev.styles,
        price:       parsed.price       != null ? String(parsed.price) : prev.price,
        currency:    parsed.currency    ?? prev.currency,
        ticketLink:  parsed.ticketLink  ?? prev.ticketLink,
        coordinates: parsed.coordinates ?? prev.coordinates,
      }))
      // Persist parsed data back to Firestore so it survives a page refresh
      await updateDoc(doc(db, 'pending_events', pending.id), {
        ...parsed,
        startDate:   parsed.startDate ?? null,
        endDate:     parsed.endDate   ?? null,
        date:        parsed.startDate ?? null,
      })
    } catch (err) {
      setParseErr(err.message)
    } finally {
      setParsing(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    setActionErr('')
    try {
      await approveEvent({ ...pending, ...form, isSpecial: true })
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
      await rejectEvent(pending.id)
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
    <div className={styles.card}>

      {/* ── Card header ── */}
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta}>
          <span className={styles.metaLabel}>ID</span>
          <span className={styles.metaValue}>{pending.id}</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaLabel}>Submitted</span>
          <span className={styles.metaValue}>{submittedDate}</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaLabel}>By</span>
          <span className={styles.metaValue}>{pending.submittedBy}</span>
        </div>
        <button
          className={styles.parseBtn}
          onClick={handleParse}
          disabled={parsing}
        >
          {parsing ? '⏳ Parsing…' : '✨ Parse with AI'}
        </button>
      </div>

      {parseErr && <p className={styles.parseErr}>⚠️ {parseErr}</p>}

      {/* ── Two-column body ── */}
      <div className={styles.cardBody}>

        {/* Left: raw text */}
        <div className={styles.rawCol}>
          <div className={styles.colLabel}>RAW SUBMISSION</div>
          {pending.flyerImageUrl && (
            <a href={pending.flyerImageUrl} target="_blank" rel="noopener noreferrer">
              <img src={pending.flyerImageUrl} alt="Flyer" className={styles.flyerThumb} />
            </a>
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
              <label className={styles.fieldLabel}>Time</label>
              <input
                className={styles.fieldInput}
                type="time"
                value={form.time}
                onChange={e => setField('time', e.target.value)}
              />
            </div>
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
              onChange={e => setField('placeId', e.target.value)}
              placeholder="ChIJ… (leave blank for standalone festival)"
            />
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
  const [user,     setUser]     = useState(undefined)  // undefined = loading
  const [pending,  setPending]  = useState([])
  const [loading,  setLoading]  = useState(true)

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

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

  function removeCard(id) {
    setPending(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className={styles.centeredMsg}>Loading…</div>
  if (!user || user.email !== ADMIN_EMAIL) return <LoginGate />

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/admin/venues" className={styles.backLink}>← Admin Dashboard</Link>
        <h1 className={styles.pageTitle}>⭐ Special Events Review</h1>
        <span className={styles.badge}>{pending.length} pending</span>
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
              onApproved={removeCard}
              onRejected={removeCard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
