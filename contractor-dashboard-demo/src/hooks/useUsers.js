import { useCallback, useEffect, useState } from 'react'
import { listUsers } from '../api/admin'
import { ApiError } from '../api/client'

export function useUsers() {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { users, loading, error, reload: load }
}
