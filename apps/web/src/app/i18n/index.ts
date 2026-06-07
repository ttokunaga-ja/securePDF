import { ja } from './messages.ja'

export type MessageKey = keyof typeof ja

const messages = ja

/** Resolve a message key, interpolating `{name}` tokens from `params`. Keys are
 *  validated at compile time, so a missing or renamed key fails typecheck. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = messages[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
