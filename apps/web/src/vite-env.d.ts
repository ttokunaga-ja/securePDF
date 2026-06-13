/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  /** authAPI base URL (e.g. https://auth.api.takumi-tokunaga.com). */
  readonly VITE_AUTHAPI_URL?: string
  /** Firebase web config. Auth is enabled only when all four are present. */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  /** Google AdSense publisher id, e.g. ca-pub-0000000000000000. */
  readonly VITE_ADSENSE_CLIENT?: string
  /** Manual AdSense display ad unit slots for the pre-input empty state. */
  readonly VITE_ADSENSE_EMPTY_TOP_SLOT?: string
  readonly VITE_ADSENSE_EMPTY_BOTTOM_SLOT?: string
  /** Show local placeholder boxes when AdSense ids are not configured. */
  readonly VITE_ADSENSE_PLACEHOLDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
