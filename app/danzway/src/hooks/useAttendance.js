import { useEffect, useState, useCallback } from 'react'
import { subscribeToAttendance, toggleAttendance } from '../services/attendanceService'

export function useAttendance(eventId, uid) {
  const [data, setData] = useState({ count: 0, attendees: {} })

  useEffect(() => {
    if (!eventId) return
    return subscribeToAttendance(eventId, setData)
  }, [eventId])

  const isGoing = uid ? data.attendees?.[uid] === true : false
  const count   = data.count ?? 0

  const toggle = useCallback(() => {
    if (!uid || !eventId) return
    toggleAttendance(eventId, uid).catch(() => {})
  }, [eventId, uid])

  return { count, isGoing, toggle }
}
