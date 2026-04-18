import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './EditEventModal.module.css'

/**
 * Modal for editing/overriding a single event instance.
 *
 * For recurring events  → calls onSave with isOverride=true (saves new doc with same id)
 * For real events       → calls onSave (updates existing doc)
 * Cancel button         → calls onCancel (saves isCancelled stub)
 */
export default function EditEventModal({ event, onSave, onCancel, onClose, isSaving }) {
  const [form, setForm] = useState({
    title:       event.title       ?? '',
    date:        event.date        ?? '',
    time:        event.time        ?? '',
    description: event.description ?? '',
    price:       event.price       ?? '',
    currency:    event.currency    ?? 'ILS',
    whatsapp:    event.whatsapp    ?? '',
  })

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const canSave = form.title.trim() && form.date

  return (
    <AnimatePresence>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <div className={styles.title}>
                {event.isRecurring ? 'Edit Occurrence' : 'Edit Event'}
              </div>
              <div className={styles.subtitle}>
                {event.venue} · {event.isRecurring
                  ? 'This change applies to this date only'
                  : 'Editing the saved event'}
              </div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className={styles.body}>
            <label className={styles.label}>Title</label>
            <input
              className={styles.input}
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Event title"
              autoFocus
            />

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Date</label>
                <input
                  className={styles.input}
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Time</label>
                <input
                  className={styles.input}
                  type="time"
                  value={form.time}
                  onChange={e => set('time', e.target.value)}
                />
              </div>
            </div>

            <label className={styles.label}>Description</label>
            <textarea
              className={styles.textarea}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Description (optional)"
              rows={3}
            />

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Price</label>
                <input
                  className={styles.input}
                  type="text"
                  value={form.price}
                  onChange={e => set('price', e.target.value)}
                  placeholder="0"
                  style={{ maxWidth: '90px' }}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>WhatsApp</label>
                <input
                  className={styles.input}
                  type="text"
                  value={form.whatsapp}
                  onChange={e => set('whatsapp', e.target.value)}
                  placeholder="+972…"
                />
              </div>
            </div>

            {event.isRecurring && (
              <p className={styles.note}>
                ↺ This is a recurring event. Saving will create a one-time override for <strong>{form.date}</strong> only — the weekly schedule is unchanged.
              </p>
            )}
          </div>

          <div className={styles.footer}>
            {onCancel && (
              <button
                className={styles.cancelInstanceBtn}
                onClick={() => onCancel(event)}
                disabled={isSaving}
                title="Cancel this specific occurrence without stopping the schedule"
              >
                ✕ Cancel This Date
              </button>
            )}
            <div className={styles.footerRight}>
              <button className={styles.closeTextBtn} onClick={onClose} disabled={isSaving}>
                Discard
              </button>
              <button
                className={styles.saveBtn}
                onClick={() => onSave(event, form)}
                disabled={isSaving || !canSave}
              >
                {isSaving ? 'Saving…' : '✓ Save'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
