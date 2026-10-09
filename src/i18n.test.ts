import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIB_STRINGS, tr, UK } from './i18n'

/** Literal strings passed to t('…'), mm('…') or N('…') anywhere in src/, excluding tests. */
function usedKeys(dir = 'src'): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...usedKeys(p))
    else if (/\.tsx?$/.test(name) && !name.includes('.test.')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/\b(?:t|N|mm)\(\s*(['"])((?:(?!\1).)*)\1/g)) out.push(m[2])
    }
  }
  return out
}

/** Messages in src/lib are tuples like ['Text {0}', x] or strings pushed to warnings. */
function libMessages(): string[] {
  const out: string[] = []
  for (const f of ['parts.ts', 'box.ts']) {
    const src = readFileSync(join('src/lib', f), 'utf8')
    for (const m of src.matchAll(/(?:errors|warnings)\.push\(\s*\[?\s*'((?:[^'\\]|\\.)*)'/g)) out.push(m[1].replace(/\\'/g, "'"))
  }
  return out
}

describe('tr', () => {
  it('substitutes placeholders', () => {
    expect(tr('en', 'Sheet {0} of {1}', 2, 3)).toBe('Sheet 2 of 3')
    expect(tr('uk', 'Sheet {0} of {1}', 2, 3)).toBe('Аркуш 2 з 3')
  })
  it('falls back to English for unknown strings', () => {
    expect(tr('uk', 'Not in the dictionary {0}', 1)).toBe('Not in the dictionary 1')
  })
})

describe('UK dictionary', () => {
  it('keeps the same placeholders as the English source', () => {
    const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join()
    for (const [en, uk] of Object.entries(UK)) expect(ph(uk), en).toBe(ph(en))
  })
  it('translates every string the UI uses', () => {
    const keys = usedKeys()
    expect(keys.length).toBeGreaterThan(50)
    expect(keys.filter((k) => !(k in UK))).toEqual([])
  })
  it('translates every message and part name produced by the geometry code', () => {
    const msgs = libMessages()
    expect(msgs.length).toBeGreaterThan(8)
    expect(msgs.filter((k) => !(k in UK))).toEqual([])
    expect(LIB_STRINGS.filter((k) => !(k in UK))).toEqual([])
  })
})
