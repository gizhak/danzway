import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Custom storage adapter so we can round-trip a Set through JSON.
 * localStorage only speaks strings, and JSON.stringify(new Set([...]))
 * produces "{}" — useless. We store it as an Array instead.
 */
const setAwareStorage = {
  getItem(name) {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Revive savedIds from Array → Set
    if (parsed?.state?.savedIds && Array.isArray(parsed.state.savedIds)) {
      parsed.state.savedIds = new Set(parsed.state.savedIds)
    }
    return parsed
  },
  setItem(name, value) {
    // Dehydrate savedIds from Set → Array before storing
    const copy = {
      ...value,
      state: {
        ...value.state,
        savedIds: value.state.savedIds instanceof Set
          ? [...value.state.savedIds]
          : value.state.savedIds,
      },
    }
    localStorage.setItem(name, JSON.stringify(copy))
  },
  removeItem(name) {
    localStorage.removeItem(name)
  },
}

const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Saved events ──────────────────────────────────────
      savedIds: new Set(),

      toggleSave(id) {
        set((state) => {
          const next = new Set(state.savedIds)
          next.has(id) ? next.delete(id) : next.add(id)
          return { savedIds: next }
        })
      },

      isSaved(id) {
        return get().savedIds.has(id)
      },

      // ── Style filter ──────────────────────────────────────
      styleFilter: 'all',

      setStyleFilter(styleFilter) {
        set({ styleFilter })
      },
    }),
    {
      name: 'danzway-app',
      storage: createJSONStorage(() => setAwareStorage),
    }
  )
)

export default useAppStore
