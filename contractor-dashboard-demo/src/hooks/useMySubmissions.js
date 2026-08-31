import { useCallback, useEffect, useState } from 'react'
import { getMySubmissions } from '../api/images.js'
import { ApiError } from '../api/client.js'

/**
 * Shared data source for the submissions list and detail pages so a
 * direct-URL visit to a detail page still works (it fetches the same
 * list and finds its record by id, rather than relying on router
 * state passed from the list page).
 *
 * There's no push/websocket backend yet, so "live" here means
 * "current as of the last load/reload" — reload() is exposed for a
 * manual refresh action and is called again on every mount.
 */
export function useMySubmissions() {
  const [submissions, setSubmissions] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMySubmissions()
      setSubmissions(data.images)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your submissions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { submissions, loading, error, reload: load }
}
