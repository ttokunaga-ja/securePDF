// Lazy Firebase Auth boundary. The Firebase SDK is only loaded when auth is
// configured and the user starts interacting with file import — kept out of the
// main bundle via a dynamic import of ./firebaseImpl (the same lazy pattern as
// lib/core.ts for the PDF engine). Preloading the chunk before Office conversion
// keeps signInWithPopup() close enough to the later user gesture for Chrome.
//
// Auth is "configured" only when all VITE_FIREBASE_* values are present. When not
// configured, the app behaves as before (no sign-in; Office falls back to the
// unauthenticated GAS path), which keeps local dev and tests untouched.

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
}

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}

export interface AuthClient {
  currentUser(): AuthUser | null
  onChange(cb: (user: AuthUser | null) => void): () => void
  signIn(): Promise<AuthUser>
  reauthenticate(): Promise<AuthUser>
  signOut(): Promise<void>
  getIdToken(): Promise<string>
}

function readConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
  const appId = import.meta.env.VITE_FIREBASE_APP_ID
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  }
}

const config = readConfig()

export function isAuthConfigured(): boolean {
  return config !== null
}

let clientPromise: Promise<AuthClient> | null = null
let loadedClient: AuthClient | null = null

export function getLoadedAuthClient(): AuthClient | null {
  return loadedClient
}

/** Lazily load the Firebase-backed auth client, or null when auth is unconfigured. */
export function loadAuthClient(): Promise<AuthClient> | null {
  if (!config) return null
  if (!clientPromise) {
    clientPromise = import('./firebaseImpl')
      .then((m) => {
        loadedClient = m.createAuthClient(config)
        return loadedClient
      })
      .catch((error: unknown) => {
        clientPromise = null
        throw error
      })
  }
  return clientPromise
}

/** Start loading Firebase Auth without opening a popup. Safe to call repeatedly. */
export function preloadAuthClient(): void {
  void loadAuthClient()?.catch(() => {
    /* Retried by ensureApiKey(); preloading should never surface a UI error. */
  })
}
