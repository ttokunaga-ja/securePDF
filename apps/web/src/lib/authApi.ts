// Calls the central authAPI public endpoints with a Firebase ID token to issue an
// API key (tkp_) and read daily credits. The key is then sent to the Office
// convert endpoint as the X-API-Key header.

function baseUrl(): string {
  return (import.meta.env.VITE_AUTHAPI_URL ?? '').replace(/\/+$/, '')
}

/** POST /api/keys — rotates and returns a fresh `tkp_` API key. */
export async function issueApiKey(idToken: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/keys`, {
    method: 'POST',
    headers: { authorization: `Bearer ${idToken}` },
  })
  if (!res.ok) throw new Error(`issue api key failed: ${res.status}`)
  const data = (await res.json()) as { apiKey?: string | null }
  if (!data.apiKey) throw new Error('api key not returned')
  return data.apiKey
}

export interface DailyCredits {
  remaining: number
  limit: number
  used: number
}

/** GET /api/credits/today — best-effort; returns null on failure. */
export async function getCreditsToday(idToken: string): Promise<DailyCredits | null> {
  const res = await fetch(`${baseUrl()}/api/credits/today`, {
    headers: { authorization: `Bearer ${idToken}` },
  })
  if (!res.ok) return null
  const d = (await res.json()) as {
    remainingCredits?: number
    dailyLimit?: number
    usedCredits?: number
  }
  return { remaining: d.remainingCredits ?? 0, limit: d.dailyLimit ?? 0, used: d.usedCredits ?? 0 }
}
