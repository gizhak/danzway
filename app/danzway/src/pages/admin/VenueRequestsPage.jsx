import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  collection, query, where,
  onSnapshot, updateDoc, deleteDoc, doc, serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { db, auth } from '../../services/firebase'
import styles from './VenueRequestsPage.module.css'

const ADMIN_EMAIL  = 'guy.izhak.tech@gmail.com'
const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Tango', 'West Coast Swing', 'Social']
const MAPS_KEY     = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

async function geocodeAddress(address, city) {
  const q = encodeURIComponent(`${address}, ${city}, Israel`)
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${MAPS_KEY}`)
  const json = await res.json()
  if (json.status !== 'OK' || !json.results[0]) return null
  const { lat, lng } = json.results[0].geometry.location
  return { lat, lng }
}

function fmt(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({ req, onSave, onDelete, onApprove, onReject, onStatusChange, onAddToVenues, busy }) {
  const [expanded, setExpanded] = useState(true)
  const [editing,  setEditing]  = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Edit form state
  const [form, setForm] = useState({
    name:        req.name        ?? '',
    address:     req.address     ?? '',
    city:        req.city        ?? '',
    styles:      req.styles      ?? [],
    description: req.description ?? '',
    whatsapp:    req.whatsapp    ?? '',
    email:       req.email       ?? '',
    instagram:   req.instagram   ?? '',
    facebook:    req.facebook    ?? '',
    googleUrl:   req.googleUrl   ?? '',
  })

  function toggleStyle(s) {
    setForm(f => ({
      ...f,
      styles: f.styles.includes(s) ? f.styles.filter(x => x !== s) : [...f.styles, s],
    }))
  }

  function startEdit() {
    setForm({
      name:        req.name        ?? '',
      address:     req.address     ?? '',
      city:        req.city        ?? '',
      styles:      req.styles      ?? [],
      description: req.description ?? '',
      whatsapp:    req.whatsapp    ?? '',
      email:       req.email       ?? '',
      instagram:   req.instagram   ?? '',
      facebook:    req.facebook    ?? '',
      googleUrl:   req.googleUrl   ?? '',
    })
    setEditing(true)
  }

  const isBusy = busy?.startsWith(req.id)

  return (
    <div className={`${styles.card} ${styles[`card_${req.status}`] ?? ''}`}>

      {/* ── Header ── */}
      <div className={styles.cardHeader}>
        <div className={styles.cardMeta} onClick={() => !editing && setExpanded(v => !v)}>
          <span className={`${styles.statusBadge} ${styles[`badge_${req.status}`]}`}>
            {req.status === 'pending' ? '⏳ ממתין' : req.status === 'approved' ? '✓ אושר' : req.status === 'added' ? '🏛️ נוסף' : '✗ נדחה'}
          </span>
          <span className={styles.cardName}>{req.name}</span>
          <span className={styles.cardCity}>{req.city}</span>
        </div>
        <div className={styles.cardActions}>
          <span className={styles.cardDate}>{fmt(req.submittedAt)}</span>
          {!editing && (
            <button className={styles.editBtn} onClick={startEdit} title="ערוך">✏️</button>
          )}
          {!confirmDelete ? (
            <button className={styles.deleteBtn} onClick={() => setConfirmDelete(true)} title="מחק">🗑️</button>
          ) : (
            <span className={styles.confirmRow}>
              <button className={styles.confirmYes} onClick={() => onDelete(req.id)} disabled={isBusy}>
                {isBusy ? '⏳' : 'מחק?'}
              </button>
              <button className={styles.confirmNo} onClick={() => setConfirmDelete(false)}>ביטול</button>
            </span>
          )}
          <span className={styles.expandIcon} onClick={() => setExpanded(v => !v)}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className={styles.cardBody}>

          {/* ── Photo ── */}
          {req.photoUrl && (
            <a href={req.photoUrl} target="_blank" rel="noreferrer">
              <img src={req.photoUrl} alt={req.name} className={styles.photo} />
            </a>
          )}

          {/* ── View mode ── */}
          {!editing && (
            <>
              <div className={styles.detailGrid}>
                <Row label="כתובת"    value={`${req.address}, ${req.city}`} />
                <Row label="סגנונות"  value={req.styles?.join(' · ')} />
                <Row label="על המקום" value={req.description} desc />
              </div>

              <div className={styles.contacts}>
                {req.whatsapp  && <a href={`https://wa.me/${req.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className={styles.contactChip}>📱 {req.whatsapp}</a>}
                {req.email     && <a href={`mailto:${req.email}`} target="_blank" rel="noreferrer" className={styles.contactChip}>✉️ {req.email}</a>}
                {req.instagram && <a href={`https://instagram.com/${req.instagram.replace('@','')}`} target="_blank" rel="noreferrer" className={styles.contactChip}>📸 {req.instagram}</a>}
                {req.facebook  && <a href={req.facebook.startsWith('http') ? req.facebook : `https://facebook.com/${req.facebook}`} target="_blank" rel="noreferrer" className={styles.contactChip}>👍 {req.facebook}</a>}
                {req.googleUrl && <a href={req.googleUrl} target="_blank" rel="noreferrer" className={styles.contactChip}>📍 Google</a>}
              </div>

              {/* Status buttons */}
              <div className={styles.statusRow}>
                {req.status !== 'added' && (
                  <button className={`${styles.statusBtn} ${req.status === 'approved' ? styles.statusBtnActive_approved : ''}`}
                    disabled={isBusy || req.status === 'approved'}
                    onClick={() => onApprove(req.id)}>
                    ✓ אשר
                  </button>
                )}
                {req.status === 'approved' && (
                  <>
                    <button className={`${styles.statusBtn} ${styles.statusBtnActive_pending}`}
                      disabled={isBusy}
                      onClick={() => onStatusChange(req.id, 'pending')}>
                      ↩ להמתנה
                    </button>
                    <button className={`${styles.statusBtn} ${styles.statusBtnAdd}`}
                      disabled={isBusy}
                      onClick={() => onAddToVenues(req)}>
                      {isBusy ? '⏳' : '🏛️ הוסף למועדונים'}
                    </button>
                  </>
                )}
                {req.status === 'added' && (
                  <button className={`${styles.statusBtn} ${styles.statusBtnActive_added}`} disabled>
                    🏛️ נוסף למועדונים
                  </button>
                )}
                {req.status !== 'added' && (
                  <button className={`${styles.statusBtn} ${styles.statusBtnReject}`}
                    disabled={isBusy}
                    onClick={() => onReject(req.id)}>
                    ✗ דחה ומחק
                  </button>
                )}
              </div>
            </>
          )}

          {/* ── Edit mode ── */}
          {editing && (
            <div className={styles.editForm}>
              <label className={styles.editLabel}>שם המועדון</label>
              <input className={styles.editInput} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

              <div className={styles.editRow}>
                <div className={styles.editCol}>
                  <label className={styles.editLabel}>כתובת</label>
                  <input className={styles.editInput} value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div className={styles.editCol}>
                  <label className={styles.editLabel}>עיר</label>
                  <input className={styles.editInput} value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
              </div>

              <label className={styles.editLabel}>סגנונות</label>
              <div className={styles.stylesGrid}>
                {DANCE_STYLES.map(s => (
                  <button key={s} type="button"
                    className={`${styles.styleChip} ${form.styles.includes(s) ? styles.styleChipOn : ''}`}
                    onClick={() => toggleStyle(s)}>{s}</button>
                ))}
              </div>

              <label className={styles.editLabel}>על המועדון</label>
              <textarea className={styles.editTextarea} rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

              <label className={styles.editLabel}>יצירת קשר</label>
              <div className={styles.contactFields}>
                <input className={styles.editInput} placeholder="📱 WhatsApp"
                  value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
                <input className={styles.editInput} placeholder="✉️ Email"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <input className={styles.editInput} placeholder="📸 Instagram"
                  value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
                <input className={styles.editInput} placeholder="👍 Facebook"
                  value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} />
                <input className={styles.editInput} placeholder="📍 Google Maps URL"
                  value={form.googleUrl} onChange={e => setForm(f => ({ ...f, googleUrl: e.target.value }))} />
              </div>

              <div className={styles.editActions}>
                <button className={styles.saveBtn} disabled={isBusy}
                  onClick={async () => { await onSave(req.id, form); setEditing(false) }}>
                  {isBusy ? '⏳ שומר…' : '✓ שמור'}
                </button>
                <button className={styles.cancelBtn} onClick={() => setEditing(false)}>ביטול</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, desc }) {
  if (!value) return null
  return (
    <div className={styles.detailItem}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={desc ? styles.detailDesc : ''}>{value}</span>
    </div>
  )
}

// ─── Login gate ───────────────────────────────────────────────────────────────

function LoginGate() {
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
        <input className={styles.loginInput} type="email" placeholder="Email"
          value={email} onChange={e => setEmail(e.target.value)} />
        <input className={styles.loginInput} type="password" placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)} />
        {err && <p className={styles.loginErr}>{err}</p>}
        <button className={styles.loginBtn} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VenueRequestsPage() {
  const [user,    setUser]    = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState([])
  const [done,    setDone]    = useState([])
  const [busy,    setBusy]    = useState(null)

  useEffect(() => onAuthStateChanged(auth, u => { setUser(u); setLoading(false) }), [])

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return

    const sort = docs => [...docs].sort((a, b) => {
      const ta = a.submittedAt?.toMillis?.() ?? 0
      const tb = b.submittedAt?.toMillis?.() ?? 0
      return tb - ta
    })

    const unsubPending = onSnapshot(
      query(collection(db, 'venueRequests'), where('status', '==', 'pending')),
      snap => setPending(sort(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    )
    // History = approved + added; rejected are deleted immediately to keep DB lean
    const unsubDone = onSnapshot(
      query(collection(db, 'venueRequests'), where('status', 'in', ['approved', 'added'])),
      snap => setDone(sort(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    )
    return () => { unsubPending(); unsubDone() }
  }, [user])

  async function handleSave(id, form) {
    setBusy(id + '_save')
    await updateDoc(doc(db, 'venueRequests', id), {
      name:        form.name.trim(),
      address:     form.address.trim(),
      city:        form.city.trim(),
      styles:      form.styles,
      description: form.description.trim() || null,
      whatsapp:    form.whatsapp.trim()    || null,
      email:       form.email.trim()       || null,
      instagram:   form.instagram.trim()   || null,
      facebook:    form.facebook.trim()    || null,
      googleUrl:   form.googleUrl.trim()   || null,
      updatedAt:   serverTimestamp(),
    })
    setBusy(null)
  }

  // Delete = remove from DB entirely
  async function handleDelete(id) {
    setBusy(id + '_delete')
    await deleteDoc(doc(db, 'venueRequests', id))
    setBusy(null)
  }

  // Approve = mark as approved, keep in DB
  async function handleApprove(id) {
    setBusy(id + '_status')
    await updateDoc(doc(db, 'venueRequests', id), { status: 'approved', reviewedAt: serverTimestamp() })
    setBusy(null)
  }

  // Reject = delete from DB (keeps it lean)
  async function handleReject(id) {
    setBusy(id + '_delete')
    await deleteDoc(doc(db, 'venueRequests', id))
    setBusy(null)
  }

  // Move approved back to pending
  async function handleStatusChange(id, status) {
    setBusy(id + '_status')
    await updateDoc(doc(db, 'venueRequests', id), { status, reviewedAt: serverTimestamp() })
    setBusy(null)
  }

  // Geocode + create venue doc + mark request as added
  async function handleAddToVenues(req) {
    setBusy(req.id + '_add')
    try {
      const coords = await geocodeAddress(req.address, req.city)
      const venueId = `custom_${req.id.slice(0, 12)}`
      await setDoc(doc(db, 'venues', venueId), {
        placeId:      venueId,
        name:         req.name,
        address:      req.address,
        city:         req.city,
        styles:       req.styles ?? [],
        description:  req.description ?? null,
        photos:       req.photoUrl ? [req.photoUrl] : [],
        coordinates:  coords,
        whatsapp:     req.whatsapp  ?? null,
        email:        req.email     ?? null,
        instagram:    req.instagram ?? null,
        facebook:     req.facebook  ?? null,
        googleUrl:    req.googleUrl ?? null,
        active:       true,
        isCustom:     true,
        logo:         null,
        instagramPostUrl: null,
        importedAt:   serverTimestamp(),
      })
      await updateDoc(doc(db, 'venueRequests', req.id), {
        status:    'added',
        venueId,
        reviewedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('[AddToVenues]', err)
      alert('שגיאה בהוספת המועדון: ' + err.message)
    }
    setBusy(null)
  }

  if (loading) return <div className={styles.centeredMsg}>Loading…</div>
  if (!user || user.email !== ADMIN_EMAIL) return <LoginGate />

  const sharedProps = {
    onSave: handleSave,
    onDelete: handleDelete,
    onApprove: handleApprove,
    onReject: handleReject,
    onStatusChange: handleStatusChange,
    onAddToVenues: handleAddToVenues,
    busy,
  }

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link to="/admin/flyers" className={styles.navLink}>← Flyers</Link>
        <h1 className={styles.pageTitle}>
          🏛️ בקשות מועדונים
          {pending.length > 0 && <span className={styles.badge}>{pending.length}</span>}
        </h1>
        <Link to="/admin/venues" className={styles.navLink}>Venues →</Link>
      </div>

      <div className={styles.content}>
        <h2 className={styles.sectionTitle}>⏳ ממתין לאישור ({pending.length})</h2>
        {pending.length === 0 && <p className={styles.emptyMsg}>אין בקשות חדשות</p>}
        {pending.map(req => <RequestCard key={req.id} req={req} {...sharedProps} />)}

        {done.length > 0 && (
          <>
            <h2 className={styles.sectionTitle} style={{ marginTop: '2.5rem' }}>
              ✓ מאושרים ונוספו ({done.length})
            </h2>
            {done.map(req => <RequestCard key={req.id} req={req} {...sharedProps} />)}
          </>
        )}
      </div>
    </div>
  )
}
