import { useEffect, useState } from 'react'

const APP_VERSION = 'beta2'

export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false)

  useEffect(() => {
    fetch(`/version.json?t=${Date.now()}`)
      .then((r) => r.json())
      .then(({ version }) => {
        if (version && version !== APP_VERSION) setNeedsUpdate(true)
      })
      .catch(() => {})
  }, [])

  return needsUpdate
}
