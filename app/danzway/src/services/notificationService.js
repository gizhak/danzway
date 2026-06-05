import emailjs from '@emailjs/browser'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
const ADMIN_EMAIL = 'guy.izhak.tech@gmail.com'

function send(params) {
  console.log('[EmailJS] send called', { SERVICE_ID, TEMPLATE_ID, hasKey: !!PUBLIC_KEY })
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.error('[EmailJS] Missing env vars — not sending')
    return
  }
  emailjs
    .send(SERVICE_ID, TEMPLATE_ID, { to_email: ADMIN_EMAIL, ...params }, { publicKey: PUBLIC_KEY })
    .then(() => console.log('[EmailJS] sent OK'))
    .catch((err) => console.error('[EmailJS] error:', JSON.stringify(err)))
}

export function notifyAdminNewSubmission({ flyerImageUrl, rawText, submittedAt }) {
  send({
    subject:       'פלייר חדש הוגש — DanzWay',
    flyer_url:     flyerImageUrl ?? '(no image)',
    raw_text:      rawText       ?? '(no text)',
    submitted_at:  submittedAt   ?? new Date().toLocaleString('he-IL'),
    dashboard_url: 'https://danzway-app.web.app/admin/flyers',
  })
}

export function notifyAdminNewVenueRequest({ name, city, address }) {
  send({
    subject:       'בקשת מועדון חדשה — DanzWay',
    flyer_url:     '(venue request)',
    raw_text:      `שם: ${name}\nעיר: ${city}\nכתובת: ${address}`,
    submitted_at:  new Date().toLocaleString('he-IL'),
    dashboard_url: 'https://danzway-app.web.app/admin/venue-requests',
  })
}
