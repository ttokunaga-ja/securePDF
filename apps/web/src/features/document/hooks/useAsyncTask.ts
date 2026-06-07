import { useCallback, useState } from 'react'

export interface AsyncTask {
  busy: boolean
  error: string | null
  setError: (message: string | null) => void
  run: (fn: () => Promise<void>) => Promise<void>
}

/** One shared busy/error channel for the workspace's async work (import and
 *  export). Sharing a single instance keeps the toolbar, rail and preview from
 *  showing conflicting spinners. */
export function useAsyncTask(): AsyncTask {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, setError, run }
}
