import { useCallback, useEffect, useState } from 'react'
import { getStakeholderOverview } from '../api/stakeholder.js'
import { ApiError } from '../api/client.js'

export function useOverview() {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getStakeholderOverview()
      setOverview(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { overview, loading, error, reload: load }
}
