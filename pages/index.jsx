import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Index() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If offline, always go to trips to try loading from cache.
      if (!session && navigator.onLine) {
        router.replace('/login')
      } else {
        router.replace('/trips')
      }
    })
  }, [])

  return null
}
