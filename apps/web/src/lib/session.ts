// Auth/session singleton for the Office conversion path. It stores the issued
// API key and opens the Google sign-in popup only when ensureApiKey() is called
// from a backend-converted import. When auth is not configured it is inert
// (returns null), so Office import falls back to the unauthenticated path.

import { issueApiKey } from './authApi'
import { loadAuthClient } from './firebase'

const KEY_STORAGE = 'securepdf.apiKey'

function readStoredKey(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null
  } catch {
    return null
  }
}

function storeKey(key: string | null): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* ignore storage errors (private mode etc.) */
  }
}

let apiKey: string | null = readStoredKey()

export function getApiKey(): string | null {
  return apiKey
}

export function clearApiKey(): void {
  apiKey = null
  storeKey(null)
}

/** Ensure an API key is available, opening the Google sign-in popup if needed.
 *  Returns null when auth is not configured (caller falls back to no-auth path).
 *  Call this synchronously close to a user gesture so the popup is not blocked. */
export async function ensureApiKey(): Promise<string | null> {
  const pending = loadAuthClient()
  if (!pending) return null
  const client = await pending
  if (apiKey) return apiKey

  let current = client.currentUser()
  if (!current) current = await client.signIn()

  const idToken = await client.getIdToken()
  apiKey = await issueApiKey(idToken)
  storeKey(apiKey)
  return apiKey
}
