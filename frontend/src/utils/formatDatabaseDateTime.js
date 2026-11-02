const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function formatDatabaseDateTime(value) {
  if (!value) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value)
  if (!match) return value

  const [, year, month, day, hour, minute] = match
  const hourNumber = Number(hour)
  const displayHour = hourNumber % 12 || 12
  const period = hourNumber >= 12 ? 'PM' : 'AM'
  return `${months[Number(month) - 1]} ${Number(day)}, ${year} · ${displayHour}:${minute} ${period}`
}
