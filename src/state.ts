import { defaultParams } from './lib/parts'
import type { DxfMode } from './lib/exportDxf'
import type { BoxParams } from './lib/types'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'

export interface SheetSettings {
  sheetW: number
  sheetH: number
  spacing: number
  margin: number
  allowRotate: boolean
}

export interface Settings {
  lang: Lang
  theme: Theme
  dxfMode: DxfMode
}

export interface AppState {
  params: BoxParams
  sheet: SheetSettings
  settings: Settings
}

export const DEFAULT_STATE: AppState = {
  params: defaultParams,
  sheet: { sheetW: 600, sheetH: 400, spacing: 3, margin: 5, allowRotate: true },
  settings: { lang: 'en', theme: 'auto', dxfMode: 'lines' },
}

const KEY = 'laser-cut-box-generator:v1'

/** Keeps the saved value only when it has the same type as the default (and, for strings, is allowed). */
function merge<T extends object>(defaults: T, saved: unknown, choices: Partial<Record<keyof T, readonly string[]>> = {}): T {
  const out = { ...defaults }
  if (typeof saved !== 'object' || saved === null) return out
  const s = saved as Record<string, unknown>
  for (const k of Object.keys(defaults) as (keyof T & string)[]) {
    const d = defaults[k]
    const v = s[k]
    if (typeof v !== typeof d) continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    const allowed = choices[k]
    if (allowed && !allowed.includes(v as string)) continue
    out[k] = v as T[keyof T & string]
  }
  return out
}

export function parseState(raw: string | null): AppState {
  try {
    const s = JSON.parse(raw ?? 'null')
    if (s && typeof s === 'object') {
      return {
        params: merge(DEFAULT_STATE.params, s.params, {
          style: ['finger', 'rounded'],
          dimMode: ['inner', 'outer'],
          lid: ['none', 'closed', 'sliding', 'hinged', 'lift-off'],
          labelOn: ['front', 'lid'],
        }),
        sheet: merge(DEFAULT_STATE.sheet, s.sheet),
        settings: merge(DEFAULT_STATE.settings, s.settings, { lang: ['en', 'uk'], theme: ['auto', 'light', 'dark'], dxfMode: ['lines', 'lwpolyline'] }),
      }
    }
  } catch {
    // Corrupt or unavailable storage: start from the defaults.
  }
  return structuredClone(DEFAULT_STATE)
}

export function loadState(): AppState {
  try {
    return parseState(localStorage.getItem(KEY))
  } catch {
    return structuredClone(DEFAULT_STATE)
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private mode or quota: the app still works, it just won't remember.
  }
}
