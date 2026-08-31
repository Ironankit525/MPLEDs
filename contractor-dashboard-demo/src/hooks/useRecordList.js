import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

/**
 * Generic loader for any endpoint shaped like { images, count } —
 * the review queue and review history both are. There's no
 * push/websocket backend, so "live" here means "current as of the
 * last load/reload"; reload() backs a manual refresh action and runs
 * again on every mount.
 */
export function useRecordList(fetcher, errorMessage) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetcher()
      setItems(data.images)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorMessage)
    } finally {
      setLoading(false)
    }
  }, [fetcher, errorMessage])

  useEffect(() => {
    load()
  }, [load])

  return { items, loading, error, reload: load }
}
