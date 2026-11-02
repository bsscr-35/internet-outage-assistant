import { useCallback, useEffect, useRef, useState } from 'react'

const REFRESH_INTERVAL = 30_000

export default function useAutoRefresh(loadData) {
  const loadDataRef = useRef(loadData)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(false)
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState(null)

  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return false

    inFlightRef.current = true
    try {
      const succeeded = await loadDataRef.current()
      if (succeeded && mountedRef.current) setLastSuccessfulAt(new Date())
      return Boolean(succeeded)
    } finally {
      inFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    const intervalId = window.setInterval(() => {
      void refresh()
    }, REFRESH_INTERVAL)

    return () => {
      mountedRef.current = false
      window.clearInterval(intervalId)
    }
  }, [refresh])

  return { lastSuccessfulAt, refresh }
}
