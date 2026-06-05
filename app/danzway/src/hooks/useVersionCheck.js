import { useEffect, useState } from 'react'

const STORAGE_KEY = 'danzway_seen_version'

async function fetchServerVersion() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`)
    const { version } = await r.json()
    return version ?? null
  } catch {
    return null
  }
}

export function useVersionCheck() {
  const [needsUpdate,    setNeedsUpdate]    = useState(false)
  const [serverVersion,  setServerVersion]  = useState(null)

  useEffect(() => {
    async function check() {
      const version = await fetchServerVersion()
      if (!version) return
      setServerVersion(version)

      const seenVersion = localStorage.getItem(STORAGE_KEY)

      if (!seenVersion) {
        // First ever visit — save the current version, no banner
        localStorage.setItem(STORAGE_KEY, version)
        return
      }

      if (version !== seenVersion) {
        setNeedsUpdate(true)
      }
    }

    check()

    // Re-check whenever the user returns to the app (background → foreground)
    function onVisibility() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  function acceptUpdate() {
    // Save new version BEFORE reloading so banner won't re-appear after refresh
    if (serverVersion) localStorage.setItem(STORAGE_KEY, serverVersion)
    window.location.reload(true)
  }

  return { needsUpdate, acceptUpdate }
}
