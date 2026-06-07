// Auth/session singleton: tracks the signed-in user, the issued API key, and
// daily credits, and exposes ensureApiKey() which opens the Google sign-in popup
// on demand. When auth is not configured it is inert (returns null), so Office
// import falls back to the unauthenticated path.

import { type DailyCredits, getCreditsToday, issueApiKey } from './authApi'
import { type AuthUser, isAuthConfigured, loadAuthClient } from './firebase'

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
let user: AuthUser | null = null
let credits: DailyCredits | null = null

export interface SessionState {
  configured: boolean
  user: AuthUser | null
  hasKey: boolean
  credits: DailyCredits | null
}

const listeners = new Set<(state: SessionState) => void>()

function snapshot(): SessionState {
  return { configured: isAuthConfigured(), user, hasKey: Boolean(apiKey), credits }
}

function emit(): void {
  const state = snapshot()
  for (const listener of listeners) listener(state)
}

export function subscribe(cb: (state: SessionState) => void): () => void {
  listeners.add(cb)
  cb(snapshot())
  return () => {
    listeners.delete(cb)
  }
}

export function getApiKey(): string | null {
  return apiKey
}

export function clearApiKey(): void {
  apiKey = null
  storeKey(null)
  emit()
}

let initialized = false

/** Restore a persisted Firebase session (if configured) and track auth changes. */
export function initSession(): void {
  if (initialized) return
  initialized = true
  const pending = loadAuthClient()
  if (!pending) return
  void pending.then((client) => {
    client.onChange((next) => {
      user = next
      if (!next) clearApiKey()
      emit()
      if (next) void refreshCredits()
    })
  })
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
  user = current
  emit()

  const idToken = await client.getIdToken()
  apiKey = await issueApiKey(idToken)
  storeKey(apiKey)
  emit()
  void refreshCredits()
  return apiKey
}

export async function refreshCredits(): Promise<void> {
  const pending = loadAuthClient()
  if (!pending) return
  const client = await pending
  if (!client.currentUser()) return
  try {
    const idToken = await client.getIdToken()
    credits = await getCreditsToday(idToken)
    emit()
  } catch {
    /* best-effort */
  }
}

export async function signIn(): Promise<void> {
  await ensureApiKey()
}

export async function signOutSession(): Promise<void> {
  const pending = loadAuthClient()
  if (pending) {
    try {
      await (await pending).signOut()
    } catch {
      /* ignore */
    }
  }
  user = null
  credits = null
  clearApiKey()
}
