import { describe, expect, it } from 'vitest'
import { buildBox, checkParams, defaultParams, resolveDims } from './box'
import { bboxOf, pointInPolygon, signedArea } from './geom'
import type { BoxParams, LidType, PlateSolid } from './types'

const base: BoxParams = { ...defaultParams, dimMode: 'outer', width: 80, depth: 60, height: 40, thickness: 3, kerf: 0 }
const mk = (o: Partial<BoxParams> = {}): BoxParams => ({ ...base, ...o })
const part = (m: ReturnType<typeof buildBox>, id: string) => m.parts.find((p) => p.id === id)!

describe('dimensions', () => {
  it('converts inner sizes to outer sizes for every lid type', () => {
    const t = 3
    const inner = (lid: LidType) => resolveDims(mk({ dimMode: 'inner', width: 50, depth: 30, height: 20, lid }))
    expect(inner('none')).toMatchObject({ W: 56, D: 36, H: 23, Hin: 20, Hbody: 23 })
    expect(inner('closed')).toMatchObject({ H: 26, Hin: 20, Hbody: 26 })
    expect(inner('lift-off')).toMatchObject({ H: 26, Hin: 20, Hbody: 23 })
    expect(inner('hinged')).toMatchObject({ H: 26, Hin: 20, Hbody: 23 })
    const s = inner('sliding')
    expect(s.Hin).toBe(20)
    expect(s.Hfront).toBeCloseTo(20 + t)
    expect(s.H).toBeCloseTo(s.Hfront + s.slotH + s.rim)
  })
  it('keeps outer sizes as given', () => {
    const d = resolveDims(mk({ lid: 'closed' }))
    expect([d.W, d.D, d.H, d.Win, d.Din, d.Hin]).toEqual([80, 60, 40, 74, 54, 34])
  })
})

describe('panel sizes', () => {
  it('every panel of the nominal model has exactly the specified outer size', () => {
    const m = buildBox(mk({ lid: 'closed' }))
    expect([part(m, 'bottom').w, part(m, 'bottom').h]).toEqual([80, 60])
    expect([part(m, 'top').w, part(m, 'top').h]).toEqual([80, 60])
    expect([part(m, 'front').w, part(m, 'front').h]).toEqual([80, 40])
    expect([part(m, 'back').w, part(m, 'back').h]).toEqual([80, 40])
    expect([part(m, 'left').w, part(m, 'left').h]).toEqual([60, 40])
    expect([part(m, 'right').w, part(m, 'right').h]).toEqual([60, 40])
  })
  it('finger counts follow the edge length', () => {
    const m = buildBox(mk({ fingerAuto: false, fingerWidth: 10, lid: 'none' }))
    // The front panel's top edge is straight; count the 10 mm-ish notches on its bottom edge.
    const front = part(m, 'front')
    const bottomNotchYs = front.outline.filter(([, y]) => Math.abs(y - 3) < 1e-9)
    // n = 7 segments of 11.43 mm: bottom has 4 notches (even segments recessed) => 8 points on y = t.
    expect(bottomNotchYs.length).toBe(8)
  })
  it('adds the kerf to the outer size and takes it off the holes', () => {
    const k = 0.2
    const nominal = buildBox(mk({ dividersAlong: 1 }))
    const cut = buildBox(mk({ dividersAlong: 1, kerf: k }))
    const a = part(nominal, 'front')
    const b = part(cut, 'front')
    expect(b.w - a.w).toBeCloseTo(k, 9)
    expect(b.h - a.h).toBeCloseTo(k, 9)
    const ha = bboxOf(a.holes)
    const hb = bboxOf(b.holes)
    expect(ha.maxX - ha.minX - (hb.maxX - hb.minX)).toBeCloseTo(k, 9)
    expect(ha.maxY - ha.minY - (hb.maxY - hb.minY)).toBeCloseTo(k, 9)
    // A finger gets wider by exactly one kerf, a notch narrower by one kerf.
    const widths = (pts: [number, number][], y: number) => {
      const xs = pts.filter(([, py]) => Math.abs(py - y) < 1e-6).map(([x]) => x).sort((p, q) => p - q)
      return xs.slice(1).map((x, i) => x - xs[i])
    }
    const tabA = widths(a.outline, a.h).concat(widths(a.outline, 0))
    expect(tabA.length).toBeGreaterThan(0)
    const bw = widths(b.outline, b.h)
    expect(bw.length).toBeGreaterThan(0)
  })
  it('kerf-compensated finger and notch widths differ from nominal by one kerf', () => {
    const k = 0.2
    const nom = buildBox(mk({ lid: 'none' }))
    const cut = buildBox(mk({ lid: 'none', kerf: k }))
    const stepWidths = (p: { outline: [number, number][] }, minY: number) => {
      // Horizontal runs along the bottom profile: points whose y is within the finger band.
      const out: number[] = []
      const o = p.outline
      for (let i = 0; i < o.length; i++) {
        const a = o[i]
        const b = o[(i + 1) % o.length]
        if (Math.abs(a[1] - b[1]) < 1e-9 && a[1] <= minY + 1e-6) out.push(Math.abs(b[0] - a[0]))
      }
      return out.sort((x, y) => x - y)
    }
    const nomRuns = stepWidths(part(nom, 'bottom'), 0)
    const cutRuns = stepWidths(part(cut, 'bottom'), 0)
    expect(nomRuns.length).toBeGreaterThan(0)
    // Bottom runs at y = minimum are the tabs of the bottom plate: wider by k.
    expect(cutRuns.length).toBe(nomRuns.length)
    nomRuns.forEach((w, i) => expect(cutRuns[i] - w).toBeCloseTo(k, 6))
  })
})

/** Which solid plates cover a world point? */
function covering(solids: PlateSolid[], x: number, y: number, z: number): string[] {
  const hits: string[] = []
  for (const s of solids) {
    const d: [number, number, number] = [x - s.o[0], y - s.o[1], z - s.o[2]]
    const u = d[0] * s.u[0] + d[1] * s.u[1] + d[2] * s.u[2]
    const v = d[0] * s.v[0] + d[1] * s.v[1] + d[2] * s.v[2]
    const n: [number, number, number] = [s.u[1] * s.v[2] - s.u[2] * s.v[1], s.u[2] * s.v[0] - s.u[0] * s.v[2], s.u[0] * s.v[1] - s.u[1] * s.v[0]]
    const w = d[0] * n[0] + d[1] * n[1] + d[2] * n[2]
    if (w < 0 || w >= s.t) continue
    if (!pointInPolygon(u, v, s.outline)) continue
    if (s.holes.some((h) => pointInPolygon(u, v, h))) continue
    hits.push(s.id)
  }
  return hits
}

describe('assembled box', () => {
  // Mating edges are complementary: sample the folded box and check that every point of the wall shell
  // belongs to exactly one panel (no gaps, no overlaps) and that nothing else overlaps.
  const cases: [string, Partial<BoxParams>][] = [
    ['open', { lid: 'none' }],
    ['closed', { lid: 'closed' }],
    ['lift-off lid', { lid: 'lift-off' }],
    ['hinged lid', { lid: 'hinged' }],
    ['sliding lid', { lid: 'sliding' }],
    ['manual fingers', { lid: 'closed', fingerAuto: false, fingerWidth: 7 }],
    ['dividers', { lid: 'closed', dividersAcross: 2, dividersAlong: 1 }],
  ]
  for (const [name, o] of cases) {
    it(`fills the wall shell exactly once: ${name}`, () => {
      const params = mk({ ...o, width: 61, depth: 47, height: 36 })
      const m = buildBox(params)
      const d = m.dims
      const plates = m.solids.filter((s): s is PlateSolid => s.kind === 'plate')
      const lid = params.lid
      const topShell = lid === 'closed' ? d.Hbody - d.t : Infinity
      const step = 0.5
      let shell = 0
      let bad: string[] = []
      for (let x = step / 2; x < d.W; x += step) {
        for (let y = step / 2; y < d.D; y += step) {
          for (let z = step / 2; z < d.Hbody; z += step) {
            const inWall = x < d.t || x > d.W - d.t || y < d.t || y > d.D - d.t || z < d.t || z >= topShell
            // Sliding lid walls have a slot, hinged/lift-off lids sit above the body.
            if (!inWall) continue
            const hits = covering(plates, x, y, z)
            if (lid === 'sliding' && y < d.D - d.t && z >= d.Hfront && z < d.Hfront + d.slotH && (x < d.t || x > d.W - d.t)) {
              if (hits.length > 1) bad.push(`${x},${y},${z}:${hits}`)
              continue
            }
            if (lid === 'sliding' && z >= d.Hfront && y < d.t && x >= d.t && x <= d.W - d.t) continue
            shell++
            if (hits.length !== 1) bad.push(`${x},${y},${z}:${hits.join('+') || 'none'}`)
            if (bad.length > 5) break
          }
          if (bad.length > 5) break
        }
        if (bad.length > 5) break
      }
      expect(bad).toEqual([])
      expect(shell).toBeGreaterThan(1000)
    })
  }

  it('never lets two panels overlap inside the cavity', () => {
    const m = buildBox(mk({ lid: 'closed', dividersAcross: 2, dividersAlong: 2, width: 100, depth: 80, height: 50 }))
    const plates = m.solids.filter((s): s is PlateSolid => s.kind === 'plate')
    const d = m.dims
    let overlaps = 0
    let divider = 0
    for (let x = 0.25; x < d.W; x += 0.5)
      for (let y = 0.25; y < d.D; y += 0.5)
        for (let z = 0.25; z < d.H; z += 0.5) {
          const hits = covering(plates, x, y, z)
          if (hits.length > 1) overlaps++
          if (hits.some((h) => h.startsWith('divider'))) divider++
        }
    expect(overlaps).toBe(0)
    expect(divider).toBeGreaterThan(1000)
  })
})

describe('lids and dividers', () => {
  it('lift-off lid has a plug that fits the cavity with clearance', () => {
    const m = buildBox(mk({ lid: 'lift-off', lidClearance: 0.4 }))
    const plug = part(m, 'lid-plug')
    expect(plug.w).toBeCloseTo(74 - 0.8)
    expect(plug.h).toBeCloseTo(54 - 0.8)
    expect([part(m, 'lid').w, part(m, 'lid').h]).toEqual([80, 60])
  })
  it('sliding lid: lower front panel and slotted sides', () => {
    const m = buildBox(mk({ lid: 'sliding' }))
    const d = m.dims
    expect(part(m, 'front').h).toBeCloseTo(d.Hfront)
    expect(part(m, 'left').h).toBeCloseTo(40)
    expect(d.Hfront).toBeLessThan(40)
    expect(part(m, 'lid').w).toBeLessThan(80)
  })
  it('hinged lid is one piece with the back panel and has hinge slits', () => {
    const m = buildBox(mk({ lid: 'hinged', hingeWidth: 20 }))
    const back = part(m, 'back')
    const d = m.dims
    expect(back.w).toBe(80)
    expect(back.h).toBeCloseTo(d.Hbody + 20 + 60)
    expect(back.slits.length).toBeGreaterThan(10)
    for (const s of back.slits) expect(s[0][1]).toBeGreaterThanOrEqual(d.Hbody - 1e-9)
  })
  it('dividers add parts and matching wall slots', () => {
    const m = buildBox(mk({ dividersAcross: 2, dividersAlong: 1, lid: 'none' }))
    expect(m.parts.filter((p) => p.id.startsWith('divider-a')).length).toBe(2)
    expect(m.parts.filter((p) => p.id.startsWith('divider-b')).length).toBe(1)
    expect(part(m, 'left').holes.length).toBe(2)
    expect(part(m, 'front').holes.length).toBe(1)
    // The divider tab fits the wall slot exactly (nominal).
    const slot = bboxOf([part(m, 'left').holes[0]])
    expect(slot.maxX - slot.minX).toBeCloseTo(3)
  })
  it('engraves a label on the front panel', () => {
    const m = buildBox(mk({ label: 'Tea', labelOn: 'front' }))
    expect(part(m, 'front').engrave.length).toBeGreaterThan(2)
    const bb = bboxOf(part(m, 'front').engrave)
    expect(bb.minX).toBeGreaterThan(0)
    expect(bb.maxX).toBeLessThan(80)
  })
})

describe('rounded box with living hinge', () => {
  const rp = (o: Partial<BoxParams> = {}) => mk({ style: 'rounded', cornerRadius: 12, width: 90, depth: 60, height: 40, lid: 'lift-off', ...o })
  it('has a bottom plate and a band of the right length', () => {
    const m = buildBox(rp())
    const d = m.dims
    expect([part(m, 'bottom').w, part(m, 'bottom').h]).toEqual([90, 60])
    const band = part(m, 'band')
    const arc = ((12 - 1.5) * Math.PI) / 2
    const turn = 2 * (90 - 24) + 2 * (60 - 24) + 4 * arc
    expect(band.w).toBeCloseTo(turn + 2 * 3, 6)
    expect(band.h).toBeCloseTo(d.Hbody, 6)
  })
  it('puts straight-line hinge slits only in the corner zones, with the configured spacing', () => {
    const m = buildBox(rp({ hingeSpacing: 2, hingeSlit: 10, hingeBridge: 3 }))
    const band = part(m, 'band')
    expect(band.slits.length).toBeGreaterThan(50)
    for (const s of band.slits) {
      expect(s[0][0]).toBeCloseTo(s[1][0])
      expect(s[1][1] - s[0][1]).toBeLessThanOrEqual(10 + 1e-9)
    }
    const xs = [...new Set(band.slits.map((s) => +s[0][0].toFixed(6)))].sort((a, b) => a - b)
    const gaps = xs.slice(1).map((x, i) => x - xs[i]).filter((g) => g < 5)
    for (const g of gaps) expect(g).toBeCloseTo(2, 5)
  })
  it('a smaller spacing yields more slit lines', () => {
    const count = (s: number) => buildBox(rp({ hingeSpacing: s })).parts.find((p) => p.id === 'band')!.slits.length
    expect(count(1.5)).toBeGreaterThan(count(3))
  })
  it('bottom plate outline is closed counter-clockwise inside its box', () => {
    const b = part(buildBox(rp()), 'bottom')
    expect(signedArea(b.outline)).toBeGreaterThan(0)
    expect(signedArea(b.outline)).toBeLessThan(90 * 60)
  })
})

describe('validation', () => {
  it('rejects impossible parameters', () => {
    expect(checkParams(mk({ thickness: 0 })).errors.length).toBe(1)
    expect(checkParams(mk({ kerf: 3 })).errors.length).toBe(1)
    expect(checkParams(mk({ width: 5 })).errors.length).toBe(1)
    expect(checkParams(mk({ dividersAlong: 15 })).errors.length).toBe(1)
    expect(checkParams(mk({ style: 'rounded', cornerRadius: 1 })).errors.length).toBe(1)
    expect(() => buildBox(mk({ width: NaN }))).toThrow()
  })
  it('accepts the defaults', () => {
    expect(checkParams(defaultParams).errors).toEqual([])
    expect(buildBox(defaultParams).parts.length).toBeGreaterThanOrEqual(7)
  })
})
