// Auth/session singleton for the Office conversion path. It keeps the issued
// API key in memory for the current page session and opens the Google sign-in
// popup only when ensureApiKey() is called from a backend-converted import. When
// auth is not configured it is inert and returns null.

import { t } from '../app/i18n'
import { AuthApiError, issueApiKey } from './authApi'
import { type AuthClient, getLoadedAuthClient, loadAuthClient, preloadAuthClient } from './firebase'

export const API_KEY_REQUEST_URL = 'https://takumi-tokunaga.com/contact/#api-access'
export const API_KEY_PATTERN = /^tkp_[a-f0-9]{64}$/

let apiKey: string | null = null

export interface ApiKeyState {
  apiKey: string | null
  hasKey: boolean
  valid: boolean
}

const listeners = new Set<(state: ApiKeyState) => void>()

export function normalizeApiKey(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

export function isValidApiKey(value: string): boolean {
  return API_KEY_PATTERN.test(value)
}

function snapshot(): ApiKeyState {
  return { apiKey, hasKey: Boolean(apiKey), valid: apiKey ? isValidApiKey(apiKey) : false }
}

function emit(): void {
  const state = snapshot()
  for (const listener of listeners) listener(state)
}

function setApiKey(next: string): void {
  apiKey = next
  emit()
}

export function subscribeApiKey(cb: (state: ApiKeyState) => void): () => void {
  listeners.add(cb)
  cb(snapshot())
  return () => {
    listeners.delete(cb)
  }
}

export function getApiKey(): string | null {
  return apiKey
}

export function hasValidApiKey(): boolean {
  return apiKey ? isValidApiKey(apiKey) : false
}

export function clearApiKey(): void {
  apiKey = null
  emit()
}

export function saveApiKey(value: string): boolean {
  const normalized = normalizeApiKey(value)
  if (!isValidApiKey(normalized)) return false
  setApiKey(normalized)
  return true
}

export function prepareAuthPopup(): void {
  preloadAuthClient()
}

function isFirebasePopupOpenFailure(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : ''
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
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
    if (isFirebasePopupOpenFailure(error)) {
      throw new Error(t('import.officeAuthPopupBlocked'))
    }
    throw error
  }
}

async function issueAndStoreApiKey(client: AuthClient): Promise<string> {
  const idToken = await client.getIdToken()
  let next: string
  try {
    next = await issueApiKey(idToken)
  } catch (error) {
    if (error instanceof AuthApiError && !needsRecentSignIn(error)) throw authFailedError()
    if (!needsRecentSignIn(error)) throw error
    await runPopupSignIn(client)
    try {
      next = await issueApiKey(await client.getIdToken())
    } catch (retryError) {
      if (retryError instanceof AuthApiError) throw authFailedError()
      throw retryError
    }
  }
  setApiKey(next)
  return next
}

export async function issueApiKeyViaPopup(): Promise<string | null> {
  // Use the synchronous getter when the client is already loaded so that
  // signInWithPopup is reached without any preceding await. This preserves the
  // browser's transient user activation when the SDK was preloaded on mount.
  let client = getLoadedAuthClient()
  if (!client) {
    const pending = loadAuthClient()
    if (!pending) return null
    client = await pending
  }
  await runPopupSignIn(client)
  return issueAndStoreApiKey(client)
}

/** Ensure an API key is available, opening the Google sign-in popup if needed.
 *  Returns null when auth is not configured (caller falls back to no-auth path).
 *  Call this synchronously close to a user gesture so the popup is not blocked. */
export async function ensureApiKey(): Promise<string | null> {
  if (apiKey && isValidApiKey(apiKey)) return apiKey
  if (apiKey) clearApiKey()
  return issueApiKeyViaPopup()
}
