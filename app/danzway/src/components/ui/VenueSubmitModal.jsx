import { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { selectUid } from '../../store/appSlice'
import { notifyAdminNewVenueRequest } from '../../services/notificationService'
import styles from './VenueSubmitModal.module.css'

const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Tango', 'West Coast Swing', 'Social']

function compressImage(file, maxPx = 1400, quality = 0.82) {
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

async function uploadPhoto(blob) {
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
  return data.secure_url
}

export default function VenueSubmitModal({ onClose }) {
  const { t }  = useTranslation()
  const uid    = useSelector(selectUid)
  const [step, setStep] = useState(1)

  // Step 1
  const [name,           setName]           = useState('')
  const [address,        setAddress]        = useState('')
  const [city,           setCity]           = useState('')
  const [selectedStyles, setSelectedStyles] = useState([])
  const [description,    setDescription]    = useState('')

  // Step 2
  const [imageFile,     setImageFile]     = useState(null)
  const [imagePreview,  setImagePreview]  = useState(null)
  const [compressed,    setCompressed]    = useState(null)
  const [whatsapp,      setWhatsapp]      = useState('')
  const [email,         setEmail]         = useState('')
  const [instagram,     setInstagram]     = useState('')
  const [facebook,      setFacebook]      = useState('')
  const [googleUrl,     setGoogleUrl]     = useState('')

  // status: idle | saving | done | error
  const [status, setStatus] = useState('idle')
  const [errMsg, setErrMsg] = useState('')
  const fileInputRef = useRef(null)

  function toggleStyle(s) {
    setSelectedStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    const blob = await compressImage(file)
    setCompressed(blob)
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    setCompressed(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const step1Valid = name.trim() && address.trim() && city.trim() && selectedStyles.length > 0
  const canSubmit  = !!imageFile && status === 'idle'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('saving')
    setErrMsg('')
    try {
      const photoUrl = compressed ? await uploadPhoto(compressed) : null
      await addDoc(collection(db, 'venueRequests'), {
        name:        name.trim(),
        address:     address.trim(),
        city:        city.trim(),
        styles:      selectedStyles,
        description: description.trim() || null,
        photoUrl,
        whatsapp:    whatsapp.trim()   || null,
        email:       email.trim()      || null,
        instagram:   instagram.trim()  || null,
        facebook:    facebook.trim()   || null,
        googleUrl:   googleUrl.trim()  || null,
        uid,
        submittedAt: serverTimestamp(),
        status:      'pending',
      })
      notifyAdminNewVenueRequest({ name: name.trim(), city: city.trim(), address: address.trim() })
      setStatus('done')
    } catch {
      setErrMsg(t('venueSubmit.error'))
      setStatus('error')
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        {status === 'done' ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>🕺</div>
            <h2 className={styles.successTitle}>{t('venueSubmit.successTitle')}</h2>
            <p  className={styles.successText}>{t('venueSubmit.successText')}</p>
            <button className={styles.doneBtn} onClick={onClose}>{t('venueSubmit.done')}</button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <span className={styles.headerIcon}>🏛️</span>
              <h2 className={styles.title}>{t('venueSubmit.title')}</h2>
              <p  className={styles.subtitle}>{t('venueSubmit.subtitle')}</p>
            </div>

            {/* Step indicator */}
            <div className={styles.stepIndicator}>
              <div className={`${styles.stepDot} ${step >= 1 ? styles.stepDotActive : ''}`} />
              <div className={`${styles.stepLine} ${step >= 2 ? styles.stepLineActive : ''}`} />
              <div className={`${styles.stepDot} ${step >= 2 ? styles.stepDotActive : ''}`} />
            </div>
            <p className={styles.stepLabel}>
              {step === 1 ? t('venueSubmit.step1Label') : t('venueSubmit.step2Label')}
            </p>

            {/* ── Step 1: venue info ── */}
            {step === 1 && (
              <div className={styles.form}>
                <input className={styles.input}
                  placeholder={`${t('venueSubmit.name')} *`}
                  value={name} onChange={e => setName(e.target.value)} />

                <input className={styles.input}
                  placeholder={`${t('venueSubmit.address')} *`}
                  value={address} onChange={e => setAddress(e.target.value)} />

                <input className={styles.input}
                  placeholder={`${t('venueSubmit.city')} *`}
                  value={city} onChange={e => setCity(e.target.value)} />

                <div>
                  <p className={styles.fieldLabel}>{t('venueSubmit.stylesLabel')} *</p>
                  <div className={styles.stylesGrid}>
                    {DANCE_STYLES.map(s => (
                      <button key={s} type="button"
                        className={`${styles.styleChip} ${selectedStyles.includes(s) ? styles.styleChipOn : ''}`}
                        onClick={() => toggleStyle(s)}>
                        {t(`styles.${s}`, { defaultValue: s })}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea className={styles.textarea}
                  placeholder={t('venueSubmit.description')}
                  value={description} onChange={e => setDescription(e.target.value)}
                  rows={3} />

                <button className={styles.nextBtn} disabled={!step1Valid}
                  onClick={() => setStep(2)}>
                  {t('venueSubmit.next')}
                </button>
              </div>
            )}

            {/* ── Step 2: photo + contact ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className={styles.form}>

                {/* Photo — required */}
                {imagePreview ? (
                  <div className={styles.previewWrap}>
                    <img src={imagePreview} alt="venue" className={styles.preview} />
                    <button type="button" className={styles.clearBtn} onClick={clearImage}>✕</button>
                  </div>
                ) : (
                  <button type="button" className={styles.photoBtn}
                    onClick={() => fileInputRef.current?.click()}>
                    📸 {t('venueSubmit.photoBtn')}
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*"
                  className={styles.hiddenInput} onChange={handleFileChange} />

                {/* Contact — optional but recommended */}
                <p className={styles.fieldLabel}>
                  {t('venueSubmit.contactLabel')}
                  <span className={styles.recommended}> ({t('venueSubmit.recommended')})</span>
                </p>

                <input className={styles.input}
                  placeholder="WhatsApp"
                  value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
                <input className={styles.input} type="email"
                  placeholder={t('venueSubmit.email')}
                  value={email} onChange={e => setEmail(e.target.value)} />
                <input className={styles.input}
                  placeholder="Instagram"
                  value={instagram} onChange={e => setInstagram(e.target.value)} />
                <input className={styles.input}
                  placeholder="Facebook"
                  value={facebook} onChange={e => setFacebook(e.target.value)} />
                <input className={styles.input}
                  placeholder={t('venueSubmit.googleUrl')}
                  value={googleUrl} onChange={e => setGoogleUrl(e.target.value)} />

                {status === 'error' && <p className={styles.errorMsg}>⚠️ {errMsg}</p>}

                <div className={styles.actionRow}>
                  <button type="button" className={styles.backBtn} onClick={() => setStep(1)}>
                    {t('venueSubmit.back')}
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={!canSubmit}>
                    {status === 'saving' ? t('venueSubmit.saving') : t('venueSubmit.submit')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
