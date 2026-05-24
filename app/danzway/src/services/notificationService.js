import emailjs from '@emailjs/browser'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Sends an admin notification email when a new flyer is submitted.
 * Fire-and-forget — never throws, never blocks the submission flow.
 */
export function notifyAdminNewSubmission({ flyerImageUrl, rawText, submittedAt }) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return

  emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      flyer_url:    flyerImageUrl ?? '(no image)',
      raw_text:     rawText       ?? '(no text)',
      submitted_at: submittedAt   ?? new Date().toLocaleString('he-IL'),
      dashboard_url: 'https://danzway-app.web.app/admin/flyers',
      email:        'noreply@danzway.app',
      name:         'DanzWay User',
    },
    PUBLIC_KEY,
  ).catch((err) => console.warn('[EmailJS]', err))
}
