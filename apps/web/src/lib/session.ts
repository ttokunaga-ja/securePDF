// Auth/session singleton for the Office conversion path. It stores the issued
// API key and opens the Google sign-in popup only when ensureApiKey() is called
// from a backend-converted import. When auth is not configured it is inert
// (returns null), so Office import falls back to the unauthenticated path.

import { t } from '../app/i18n'
import { AuthApiError, issueApiKey } from './authApi'
import { type AuthClient, getLoadedAuthClient, loadAuthClient, preloadAuthClient } from './firebase'

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

export function prepareAuthPopup(): void {
  preloadAuthClient()
}

function isFirebasePopupBlocked(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String((error as { code?: unknown }).code) === 'auth/popup-blocked'
  )
}

function needsRecentSignIn(error: unknown): boolean {
  return (
    error instanceof AuthApiError &&
    error.status === 401 &&
    (error.code === 'RECENT_SIGN_IN_REQUIRED' ||
      error.code === 'UNAUTHORIZED' ||
      error.code === 'INVALID_AUTHORIZATION')
  )
}

function authFailedError(): Error {
  return new Error(t('import.officeAuthFailed'))
}

async function runPopupSignIn(client: AuthClient): Promise<void> {
  try {
    if (client.currentUser()) await client.reauthenticate()
    else await client.signIn()
  } catch (error) {
    if (isFirebasePopupBlocked(error)) {
      throw new Error(t('import.officeAuthPopupBlocked'))
    }
    throw error
  }
}

/** Ensure an API key is available, opening the Google sign-in popup if needed.
 *  Returns null when auth is not configured (caller falls back to no-auth path).
 *  Call this synchronously close to a user gesture so the popup is not blocked. */
export async function ensureApiKey(): Promise<string | null> {
  if (apiKey) return apiKey

  let client = getLoadedAuthClient()
  if (!client) {
    const pending = loadAuthClient()
    if (!pending) return null
    client = await pending
  }

  await runPopupSignIn(client)

  const idToken = await client.getIdToken()
  try {
    apiKey = await issueApiKey(idToken)
  } catch (error) {
    if (error instanceof AuthApiError && !needsRecentSignIn(error)) throw authFailedError()
    if (!needsRecentSignIn(error)) throw error
    await runPopupSignIn(client)
    try {
      apiKey = await issueApiKey(await client.getIdToken())
    } catch (retryError) {
      if (retryError instanceof AuthApiError) throw authFailedError()
      throw retryError
    }
  }

  storeKey(apiKey)
  return apiKey
}
