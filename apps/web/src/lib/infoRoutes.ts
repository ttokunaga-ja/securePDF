export type InfoPageKind = 'overview' | 'security' | 'api'

const INFO_PATHS: Record<InfoPageKind, string> = {
  overview: '/docs/overview/',
  security: '/docs/security/',
  api: '/docs/api/',
}

export function infoPageForPath(pathname: string): InfoPageKind | null {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/docs/overview') return 'overview'
  if (normalized === '/docs/security') return 'security'
  if (normalized === '/docs/api') return 'api'
  return null
}

export function infoPathForPage(page: InfoPageKind): string {
  return INFO_PATHS[page]
}
