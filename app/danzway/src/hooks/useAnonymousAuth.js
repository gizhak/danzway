import { useEffect } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { useDispatch } from 'react-redux'
import { auth } from '../services/firebase'
import { setUid } from '../store/appSlice'

export function useAnonymousAuth() {
  const dispatch = useDispatch()
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setUid(user.uid))
      } else {
        signInAnonymously(auth).catch(() => {})
      }
    })
    return unsubscribe
  }, [dispatch])
}
