import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import he from './locales/he.json'

const saved = localStorage.getItem('danzway-lang') ?? 'he'

// Apply dir/lang before React mounts to prevent layout flash
document.documentElement.lang = saved
document.documentElement.dir  = saved === 'he' ? 'rtl' : 'ltr'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    lng:          saved,
    fallbackLng:  'en',
    interpolation: { escapeValue: false },
  })

export default i18n
