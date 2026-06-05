import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOUR_STEPS } from './tourSteps'

const TourCtx = createContext(null)
const STORAGE_KEY = 'danzway_tour_seen'

async function pollForElement(selector, maxMs = 1800) {
  if (!selector) return null
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    const el = document.querySelector(selector)
    if (el) return el
    await new Promise(r => setTimeout(r, 60))
  }
  return null
}

export function TourProvider({ children }) {
  const [active,   setActive]   = useState(false)
  const [stepIdx,  setStepIdx]  = useState(0)
  const [rect,     setRect]     = useState(null)
  const [tabRect,  setTabRect]  = useState(null)
  const navigate                = useNavigate()
  const cancelRef               = useRef(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setActive(true), 1000)
      return () => clearTimeout(t)
    }
  }, [])

  const startTour = useCallback(() => {
    setStepIdx(0)
    setRect(null)
    setTabRect(null)
    setActive(true)
  }, [])

  const endTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1')
    setActive(false)
    setRect(null)
    setTabRect(null)
  }, [])

  // Navigate + resolve element whenever step changes
  useEffect(() => {
    if (!active) return
    const step = TOUR_STEPS[stepIdx]
    if (!step) { endTour(); return }

    cancelRef.current = false
    setRect(null)
    setTabRect(null)

    if (step.route) navigate(step.route)

    pollForElement(step.target).then(el => {
      if (cancelRef.current) return
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ x: r.x, y: r.y, w: r.width, h: r.height })
      }
    })

    pollForElement(step.tabTarget).then(el => {
      if (cancelRef.current) return
      if (el) {
        const r = el.getBoundingClientRect()
        setTabRect({ x: r.x, y: r.y, w: r.width, h: r.height })
      }
    })

    return () => { cancelRef.current = true }
  }, [active, stepIdx]) // eslint-disable-line

  // Keep rects in sync on resize / scroll
  useEffect(() => {
    if (!active) return
    const step = TOUR_STEPS[stepIdx]

    function refresh() {
      if (step?.target) {
        const el = document.querySelector(step.target)
        if (el) {
          const r = el.getBoundingClientRect()
          setRect({ x: r.x, y: r.y, w: r.width, h: r.height })
        }
      }
      if (step?.tabTarget) {
        const el = document.querySelector(step.tabTarget)
        if (el) {
          const r = el.getBoundingClientRect()
          setTabRect({ x: r.x, y: r.y, w: r.width, h: r.height })
        }
      }
    }

    window.addEventListener('resize', refresh)
    window.addEventListener('scroll', refresh, true)
    return () => {
      window.removeEventListener('resize', refresh)
      window.removeEventListener('scroll', refresh, true)
    }
  }, [active, stepIdx])

  function next() {
    const ni = stepIdx + 1
    if (ni >= TOUR_STEPS.length) endTour()
    else setStepIdx(ni)
  }

  return (
    <TourCtx.Provider value={{
      active, step: TOUR_STEPS[stepIdx], stepIdx,
      total: TOUR_STEPS.length, rect, tabRect,
      startTour, endTour, next,
    }}>
      {children}
    </TourCtx.Provider>
  )
}

export function useTour() {
  return useContext(TourCtx)
}
