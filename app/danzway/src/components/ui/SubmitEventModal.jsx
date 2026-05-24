import { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { collection, getDocs, query as firestoreQuery, where } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { selectUid } from '../../store/appSlice'
import { submitUserEvent } from '../../services/pendingEventsService'
import { parseOcrText } from '../../utils/ocrParser'
import styles from './SubmitEventModal.module.css'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function compressImage(file, maxPx = 1200, quality = 0.75) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale   = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas  = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    img.src = url
  })
}

function computeFingerprint(base64) {
  return base64.slice(0, 32) + base64.slice(-32) + String(base64.length)
}

async function uploadFlyer(blob, fingerprint) {
  const formData = new FormData()
  formData.append('file', blob)
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(`cloudinary:${res.status}`)
  const data = await res.json()
  return { url: data.secure_url, path: data.public_id, fingerprint }
}

const HE_TO_LATIN = {
  'א':'a','ב':'b','ג':'g','ד':'d','ה':'a','ו':'v','ז':'z','ח':'h','ט':'t','י':'i',
  'כ':'k','ך':'k','ל':'l','מ':'m','ם':'m','נ':'n','ן':'n','ס':'s','ע':'','פ':'p',
  'ף':'f','צ':'ts','ץ':'ts','ק':'k','ר':'r','ש':'sh','ת':'t',
}

function isHebrew(str) { return /[א-ת]/.test(str) }

function hebrewToLatin(str) {
  return str.split('').map(c => HE_TO_LATIN[c] ?? c).join('').replace(/(.)\1+/g, '$1')
}

function isSubsequence(needle, haystack) {
  let i = 0
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (needle[i] === haystack[j]) i++
  }
  return i === needle.length
}

function venueNameMatches(venue, query) {
  const name = (venue.name ?? '').toLowerCase()
  const q    = query.toLowerCase()
  if (name.includes(q)) return true
  if (isHebrew(query)) {
    const lat = hebrewToLatin(q)
    if (lat.length >= 2 && (name.includes(lat) || isSubsequence(lat, name))) return true
  }
  return false
}

function fmtDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

export default function SubmitEventModal({ onClose }) {
  const { t } = useTranslation()
  const uid    = useSelector(selectUid)
  const venues = useSelector((state) => state.venues.venues)

  const [imageFile,         setImageFile]         = useState(null)
  const [imagePreview,      setImagePreview]       = useState(null)
  const [lightbox,          setLightbox]           = useState(false)
  const [extraText,         setExtraText]          = useState('')
  const [hintVenue,         setHintVenue]          = useState('')
  const [hintAddress,       setHintAddress]        = useState('')
  const [hintDate,          setHintDate]           = useState('')
  const [hintTime,          setHintTime]           = useState('')
  const [venueMatches,      setVenueMatches]       = useState([])
  const [selectedPlaceId,   setSelectedPlaceId]    = useState(null)
  const [compressedBlob,    setCompressedBlob]     = useState(null)
  const [scannedFingerprint,setScannedFingerprint] = useState(null)
  const [pastDateWarning,   setPastDateWarning]    = useState(false)
  const [isDuplicate,       setIsDuplicate]        = useState(false)
  // phase: idle | scanning | ready | saving | done | error
  const [phase,             setPhase]              = useState('idle')
  const [errMsg,            setErrMsg]             = useState('')
  const [ocrFound,          setOcrFound]           = useState(null)
  const fileInputRef = useRef(null)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setPhase('scanning')
    setOcrFound(null)
    setPastDateWarning(false)
    setIsDuplicate(false)

    // Compress once — reused on submit (avoid double compression)
    const compressed  = await compressImage(file)
    const imageBase64 = await fileToBase64(compressed)
    const fp = computeFingerprint(imageBase64)
    setCompressedBlob(compressed)
    setScannedFingerprint(fp)

    // Duplicate check (fire-and-forget, doesn't block OCR)
    getDocs(firestoreQuery(collection(db, 'pending_events'), where('imageFingerprint', '==', fp)))
      .then(snap => { if (!snap.empty) setIsDuplicate(true) })
      .catch(() => {})

    try {
      const Tesseract = (await import('tesseract.js')).default
      const { data: { text } } = await Tesseract.recognize(file, 'heb+eng', {})
      const parsed = parseOcrText(text)

      if (parsed.startDate) setHintDate(parsed.startDate)
      if (parsed.time)      setHintTime(parsed.time)

      // Past date warning
      const todayStr = new Date().toISOString().split('T')[0]
      if (parsed.startDate && parsed.startDate < todayStr) setPastDateWarning(true)

      setOcrFound({
        date:       parsed.startDate,
        time:       parsed.time,
        city:       parsed.location,
        hasAddress: !!parsed.address,
      })
    } catch {
      setOcrFound(null)
    }
    setPhase('ready')
  }

  function handleVenueInput(e) {
    const val = e.target.value
    setHintVenue(val)
    setSelectedPlaceId(null)
    if (val.trim().length < 2) { setVenueMatches([]); return }
    setVenueMatches(
      venues.filter(v => v.active !== false && venueNameMatches(v, val)).slice(0, 5)
    )
  }

  function selectVenue(venue) {
    setHintVenue(venue.name)
    setSelectedPlaceId(venue.placeId ?? null)
    if (venue.address) setHintAddress(venue.address)
    else if (venue.city) setHintAddress(venue.city)
    setVenueMatches([])
  }

  function clearImage() {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setOcrFound(null)
    setHintDate('')
    setHintTime('')
    setCompressedBlob(null)
    setScannedFingerprint(null)
    setPastDateWarning(false)
    setIsDuplicate(false)
    setPhase('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!imageFile && !extraText.trim()) return
    setPhase('saving')
    setErrMsg('')
    try {
      let flyerImageUrl    = null
      let flyerStoragePath = null
      let fingerprint      = null
      if (imageFile) {
        const uploaded   = await uploadFlyer(compressedBlob, scannedFingerprint)
        flyerImageUrl    = uploaded.url
        flyerStoragePath = uploaded.path
        fingerprint      = uploaded.fingerprint
      }
      const hintParts = []
      if (hintVenue.trim())   hintParts.push(`מקום: ${hintVenue.trim()}`)
      if (hintAddress.trim()) hintParts.push(`כתובת: ${hintAddress.trim()}`)
      if (hintDate)           hintParts.push(`תאריך: ${hintDate}`)
      if (hintTime)           hintParts.push(`שעה: ${hintTime}`)
      const combinedText = [extraText.trim(), ...hintParts].filter(Boolean).join('\n') || null
      await submitUserEvent(combinedText, uid, flyerImageUrl, flyerStoragePath, fingerprint, selectedPlaceId)
      setPhase('done')
    } catch (err) {
      const code = err.code ?? err.message ?? ''
      const friendly =
        code.includes('cloudinary')    ? 'שגיאה בהעלאת התמונה. נסה שוב.' :
        code.includes('internal')      ? 'שגיאת שרת. נסה שוב עוד כמה דקות.' :
        code.includes('unavailable')   ? 'השרת לא זמין כרגע. נסה שוב מאוחר יותר.' :
        code.includes('deadline')      ? 'הבקשה ארכה יותר מדי. נסה שוב.' :
        code.includes('unauthenticated') ? 'יש להתחבר לפני שליחה.' :
        code.includes('permission')    ? 'אין הרשאה לשלוח. פנה לתמיכה.' :
        'אירעה שגיאה. נסה שוב או פנה לתמיכה.'
      setErrMsg(friendly)
      setPhase('error')
    }
  }

  const isScanning     = phase === 'scanning'
  const canSubmit      = (imageFile || extraText.trim()) && !isScanning && phase !== 'saving' && !isDuplicate
  const addressMissing = ocrFound && !ocrFound.hasAddress && !hintAddress.trim()

  return (
    <>
    {lightbox && (
      <div className={styles.lightboxBackdrop} onClick={() => setLightbox(false)}>
        <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>✕</button>
        <img src={imagePreview} alt="Flyer" className={styles.lightboxImg}
          onClick={e => e.stopPropagation()} />
      </div>
    )}
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        {phase === 'done' ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>⭐</div>
            <h2 className={styles.successTitle}>{t('submitEvent.successTitle')}</h2>
            <p className={styles.successText}>{t('submitEvent.successText')}</p>
            <button className={styles.doneBtn} onClick={onClose}>{t('submitEvent.done')}</button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <span className={styles.headerIcon}>⭐</span>
              <h2 className={styles.title}>{t('submitEvent.title')}</h2>
              <p className={styles.subtitle}>{t('submitEvent.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>

              {/* ── Image section ── */}
              <label className={styles.label}>{t('submitEvent.imageLabel')}</label>

              {isScanning ? (
                /* ── Scanning overlay on the image ── */
                <div className={styles.scanWrap}>
                  <img src={imagePreview} alt="" className={styles.scanBgImg} />
                  <div className={styles.scanOverlay}>
                    <svg viewBox="0 0 100 100" className={styles.scanOrbit} aria-hidden="true">
                      <circle cx="50" cy="50" r="44" fill="none"
                        stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray="92 184">
                        <animateTransform attributeName="transform" type="rotate"
                          values="0 50 50;360 50 50" dur="2s" repeatCount="indefinite" />
                      </circle>
                      <ellipse cx="50" cy="50" rx="44" ry="16" fill="none"
                        stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray="87 174">
                        <animateTransform attributeName="transform" type="rotate"
                          values="0 50 50;360 50 50" dur="1.3s" repeatCount="indefinite" />
                      </ellipse>
                      <ellipse cx="50" cy="50" rx="16" ry="44" fill="none"
                        stroke="#fde68a" strokeWidth="2" strokeLinecap="round"
                        strokeDasharray="87 174" strokeOpacity="0.72">
                        <animateTransform attributeName="transform" type="rotate"
                          values="360 50 50;0 50 50" dur="2.9s" repeatCount="indefinite" />
                      </ellipse>
                    </svg>
                    <p className={styles.scanLabel}>
                      מנתחת פלייר<span className={styles.scanDots}><span>.</span><span>.</span><span>.</span></span>
                    </p>
                  </div>
                </div>
              ) : imagePreview ? (
                <div className={styles.imagePreviewWrap}>
                  <img src={imagePreview} alt="Flyer preview" className={styles.imagePreview}
                    onClick={() => setLightbox(true)} />
                  <button type="button" className={styles.imageClearBtn}
                    onClick={clearImage} aria-label="Remove image">✕</button>
                  <span className={styles.zoomHint}>הגדל לצפייה</span>
                </div>
              ) : (
                <button type="button" className={styles.imagePickerBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={phase === 'saving'}>
                  📸 {t('submitEvent.imageBtn')}
                </button>
              )}

              <input ref={fileInputRef} type="file" accept="image/*"
                className={styles.hiddenFileInput}
                onChange={handleFileChange} disabled={phase === 'saving'} />

              {/* ── OCR results summary ── */}
              {phase === 'ready' && ocrFound && (
                <div className={styles.ocrSummary}>
                  <span className={styles.ocrFoundLabel}>זוהה</span>
                  {ocrFound.date && <span className={styles.foundChip}>{fmtDate(ocrFound.date)}</span>}
                  {ocrFound.time && <span className={styles.foundChip}>{ocrFound.time}</span>}
                  {ocrFound.city && <span className={styles.foundChip}>{ocrFound.city}</span>}
                  {!ocrFound.date && !ocrFound.time && !ocrFound.city && (
                    <span className={styles.ocrNotFound}>לא זוהו נתונים — אנא מלא ידנית</span>
                  )}
                </div>
              )}

              {/* ── Warnings ── */}
              {isDuplicate && (
                <div className={styles.warnBanner} data-type="dup">
                  ⚠️ פלייר זה כבר נשלח למערכת — לא ניתן לשלוח שוב
                </div>
              )}
              {!isDuplicate && pastDateWarning && (
                <div className={styles.warnBanner} data-type="date">
                  ⚠️ התאריך שזוהה בפלייר כבר עבר — האם הפלייר עדכני?
                </div>
              )}

              {/* ── Hint fields (shown after scan or in idle) ── */}
              {(phase === 'ready' || phase === 'idle' || phase === 'error') && (
                <div className={styles.hintSection}>
                  <p className={styles.hintTitle}>
                    {phase === 'ready' ? 'אמת ✓ והשלם נתונים חסרים' : 'נא להכניס נתונים לדיוק מירבי (אופציונלי)'}
                  </p>
                  <div className={styles.hintFields}>
                    <div className={styles.venueAutocomplete}>
                      <input className={`${styles.hintInput} ${selectedPlaceId ? styles.hintInputLinked : ''}`}
                        placeholder="שם המקום (מועדון / אולם)"
                        value={hintVenue}
                        onChange={handleVenueInput}
                        onBlur={() => setTimeout(() => setVenueMatches([]), 150)}
                        disabled={phase === 'saving'}
                        autoComplete="off" />
                      {venueMatches.length > 0 && (
                        <div className={styles.venueDropdown}>
                          {venueMatches.map(v => (
                            <button key={v.placeId ?? v.name} type="button"
                              className={styles.venueDropdownItem}
                              onMouseDown={() => selectVenue(v)}>
                              <span className={styles.venueDropdownName}>{v.name}</span>
                              {v.city && <span className={styles.venueDropdownCity}>{v.city}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      className={`${styles.hintInput} ${addressMissing ? styles.hintInputAlert : ''}`}
                      placeholder={addressMissing ? 'כתובת לא נמצאה בפלייר — תוסיף?' : 'כתובת מלאה (רחוב + מספר, עיר)'}
                      value={hintAddress} onChange={e => setHintAddress(e.target.value)}
                      disabled={phase === 'saving'} />

                    <div className={styles.hintRow}>
                      <input className={styles.hintInput} type="date"
                        value={hintDate} onChange={e => setHintDate(e.target.value)}
                        disabled={phase === 'saving'} />
                      <input className={styles.hintInput} type="time"
                        value={hintTime} onChange={e => setHintTime(e.target.value)}
                        disabled={phase === 'saving'} />
                    </div>
                  </div>
                </div>
              )}

              <p className={styles.hint}>{t('submitEvent.hint')}</p>

              {phase === 'error' && <p className={styles.errorMsg}>⚠️ {errMsg}</p>}

              <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
                {phase === 'saving' ? t('submitEvent.saving') : t('submitEvent.submit')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
    </>
  )
}
