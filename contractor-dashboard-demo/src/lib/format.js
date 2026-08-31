export function isRemoteUrl(path) {
  return typeof path === 'string' && (/^https?:\/\//.test(path) || /^blob:/.test(path))
}

export function formatDate(value, opts) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString(undefined, opts || { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return '—'
  }
}
