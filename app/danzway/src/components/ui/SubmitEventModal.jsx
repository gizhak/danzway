import { useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { selectUid } from '../../store/appSlice'
import { submitUserEvent } from '../../services/pendingEventsService'
import styles from './SubmitEventModal.module.css'

async function uploadToCloudinary(file) {
  const cloudName    = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) return null
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Image upload failed')
  return data.secure_url
}

export default function SubmitEventModal({ onClose }) {
  const { t } = useTranslation()
  const uid   = useSelector(selectUid)

  const [text,         setText]         = useState('')
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [phase,        setPhase]        = useState('idle')
  const [errMsg,       setErrMsg]       = useState('')
  const fileInputRef = useRef(null)

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setPhase('saving')
    setErrMsg('')
    try {
      let flyerImageUrl = null
      if (imageFile) {
        try {
          flyerImageUrl = await uploadToCloudinary(imageFile)
        } catch {
          // image upload failed — submit text anyway, admin will see placeholder
        }
      }
      await submitUserEvent(text.trim(), uid, flyerImageUrl)
      setPhase('done')
    } catch (err) {
      setErrMsg(err.message ?? 'Unknown error')
      setPhase('error')
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>

        {phase === 'done' ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>⭐</div>
            <h2 className={styles.successTitle}>{t('submitEvent.successTitle')}</h2>
            <p className={styles.successText}>{t('submitEvent.successText')}</p>
            <button className={styles.doneBtn} onClick={onClose}>
              {t('submitEvent.done')}
            </button>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <span className={styles.headerIcon}>⭐</span>
              <h2 className={styles.title}>{t('submitEvent.title')}</h2>
              <p className={styles.subtitle}>{t('submitEvent.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <label className={styles.label} htmlFor="event-raw-text">
                {t('submitEvent.label')}
              </label>
              <textarea
                id="event-raw-text"
                className={styles.textarea}
                placeholder={t('submitEvent.placeholder')}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                disabled={phase === 'saving'}
                autoFocus
              />

              <label className={styles.label}>{t('submitEvent.imageLabel')}</label>
              {imagePreview ? (
                <div className={styles.imagePreviewWrap}>
                  <img src={imagePreview} alt="Flyer preview" className={styles.imagePreview} />
                  <button
                    type="button"
                    className={styles.imageClearBtn}
                    onClick={clearImage}
                    aria-label="Remove image"
                  >✕</button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.imagePickerBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={phase === 'saving'}
                >
                  📸 {t('submitEvent.imageBtn')}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.hiddenFileInput}
                onChange={handleFileChange}
                disabled={phase === 'saving'}
              />

              <p className={styles.hint}>{t('submitEvent.hint')}</p>

              {phase === 'error' && (
                <p className={styles.errorMsg}>⚠️ {errMsg}</p>
              )}

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={(!text.trim() && !imageFile) || phase === 'saving'}
              >
                {phase === 'saving' ? t('submitEvent.saving') : t('submitEvent.submit')}
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  )
}
