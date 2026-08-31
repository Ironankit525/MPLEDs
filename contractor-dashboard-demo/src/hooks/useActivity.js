import { useCallback, useEffect, useState } from 'react'
import { getActivity } from '../api/admin.js'
import { ApiError } from '../api/client.js'

export function useActivity() {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getActivity()
      setEvents(data.events)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the activity log.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { events, loading, error, reload: load }
}
