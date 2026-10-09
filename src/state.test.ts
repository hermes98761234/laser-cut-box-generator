import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE, parseState } from './state'

describe('parseState', () => {
  it('returns the defaults for missing or corrupt data', () => {
    expect(parseState(null)).toEqual(DEFAULT_STATE)
    expect(parseState('{nope')).toEqual(DEFAULT_STATE)
    expect(parseState('42')).toEqual(DEFAULT_STATE)
  })
  it('keeps valid saved values and drops invalid ones', () => {
    const s = parseState(JSON.stringify({ params: { width: 150, lid: 'sliding', style: 'banana', kerf: 'x' }, settings: { lang: 'uk', theme: 'dark' }, sheet: { sheetW: 300 } }))
    expect(s.params.width).toBe(150)
    expect(s.params.lid).toBe('sliding')
    expect(s.params.style).toBe(DEFAULT_STATE.params.style)
    expect(s.params.kerf).toBe(DEFAULT_STATE.params.kerf)
    expect(s.settings.lang).toBe('uk')
    expect(s.sheet.sheetW).toBe(300)
    expect(s.sheet.sheetH).toBe(DEFAULT_STATE.sheet.sheetH)
  })
})
