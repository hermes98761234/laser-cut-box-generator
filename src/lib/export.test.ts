import { describe, expect, it } from 'vitest'
import { buildBox, defaultParams } from './box'
import { parseDxf, sheetToDxf } from './exportDxf'
import { sheetToSvg } from './exportSvg'
import { layoutParts, placePoints, sheetShapes } from './layout'
import { bboxOf } from './geom'
import { textStrokes, textWidth } from './font'

const model = () => buildBox({ ...defaultParams, label: 'Tea', dividersAcross: 1 })
const opts = { sheetW: 600, sheetH: 400, spacing: 3, margin: 5, allowRotate: true }

describe('layout', () => {
  it('keeps every part on the sheet without overlaps', () => {
    const m = model()
    const { sheets, oversize } = layoutParts(m.parts, opts)
    expect(oversize).toEqual([])
    expect(sheets.flat().length).toBe(m.parts.length)
    for (const sheet of sheets) {
      for (const p of sheet) {
        expect(p.x).toBeGreaterThanOrEqual(opts.margin - 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(opts.margin - 1e-9)
        expect(p.x + p.w).toBeLessThanOrEqual(opts.sheetW - opts.margin + 1e-9)
        expect(p.y + p.h).toBeLessThanOrEqual(opts.sheetH - opts.margin + 1e-9)
      }
      for (let i = 0; i < sheet.length; i++)
        for (let j = i + 1; j < sheet.length; j++) {
          const a = sheet[i]
          const b = sheet[j]
          const sep = a.x + a.w + opts.spacing <= b.x + 1e-9 || b.x + b.w + opts.spacing <= a.x + 1e-9 || a.y + a.h + opts.spacing <= b.y + 1e-9 || b.y + b.h + opts.spacing <= a.y + 1e-9
          expect(sep).toBe(true)
        }
    }
  })
  it('uses more sheets when one is too small and flags oversize parts', () => {
    const m = model()
    const small = layoutParts(m.parts, { ...opts, sheetW: 130, sheetH: 130 })
    expect(small.sheets.length).toBeGreaterThan(1)
    const tiny = layoutParts(m.parts, { ...opts, sheetW: 50, sheetH: 50 })
    expect(tiny.oversize.length).toBeGreaterThan(0)
  })
  it('places rotated parts inside their placed box', () => {
    const m = model()
    const { sheets } = layoutParts(m.parts, { ...opts, sheetW: 200, sheetH: 400 })
    for (const pl of sheets.flat()) {
      const bb = bboxOf([placePoints(pl, pl.part.outline)])
      expect(bb.minX).toBeCloseTo(pl.x)
      expect(bb.minY).toBeCloseTo(pl.y)
      expect(bb.maxX).toBeCloseTo(pl.x + pl.w)
      expect(bb.maxY).toBeCloseTo(pl.y + pl.h)
    }
  })
})

describe('SVG export', () => {
  const m = model()
  const { sheets } = layoutParts(m.parts, opts)
  const svg = sheetToSvg(sheets[0], opts.sheetW, opts.sheetH)
  it('is in millimetres with red hairline cuts and blue engraving', () => {
    expect(svg).toContain('width="600mm"')
    expect(svg).toContain('height="400mm"')
    expect(svg).toContain('viewBox="0 0 600 400"')
    expect(svg).toMatch(/<g id="cut"[^>]*stroke="#ff0000"[^>]*stroke-width="0.01"/)
    expect(svg).toMatch(/<g id="engrave"[^>]*stroke="#0000ff"[^>]*stroke-width="0.01"/)
  })
  it('has one path per contour', () => {
    const s = sheetShapes(sheets[0])
    const paths = svg.match(/<path /g)!.length
    expect(paths).toBe(s.closed.length + s.cutLines.length + s.engrave.length)
  })
})

describe('DXF export', () => {
  const m = model()
  const { sheets } = layoutParts(m.parts, opts)
  it('writes R12 LINE entities that parse back', () => {
    const dxf = sheetToDxf(sheets[0], opts.sheetW, opts.sheetH)
    const d = parseDxf(dxf)
    expect(d.version).toBe('AC1009')
    expect(d.endsWithEof).toBe(true)
    expect(d.layers).toEqual(['CUT', 'ENGRAVE'])
    expect(d.entities.every((e) => e.type === 'LINE')).toBe(true)
    const s = sheetShapes(sheets[0])
    const segs = s.closed.reduce((a, p) => a + p.length, 0) + s.cutLines.reduce((a, p) => a + p.length - 1, 0)
    expect(d.entities.filter((e) => e.layer === 'CUT').length).toBe(segs)
    expect(d.entities.filter((e) => e.layer === 'ENGRAVE').length).toBe(s.engrave.reduce((a, p) => a + p.length - 1, 0))
    // Coordinates stay on the sheet.
    for (const e of d.entities) {
      for (const code of [10, 11]) expect(e.data.get(code)![0]).toBeGreaterThanOrEqual(-1e-6)
      for (const code of [10, 11]) expect(e.data.get(code)![0]).toBeLessThanOrEqual(600 + 1e-6)
      for (const code of [20, 21]) {
        expect(e.data.get(code)![0]).toBeGreaterThanOrEqual(-1e-6)
        expect(e.data.get(code)![0]).toBeLessThanOrEqual(400 + 1e-6)
      }
    }
  })
  it('flips y so the drawing is upright in CAD', () => {
    const dxf = parseDxf(sheetToDxf(sheets[0], opts.sheetW, opts.sheetH))
    const ys = dxf.entities.flatMap((e) => e.data.get(20)!)
    const svgPts = sheetShapes(sheets[0]).closed.flat().map((p) => p[1])
    expect(Math.max(...ys)).toBeCloseTo(opts.sheetH - Math.min(...svgPts), 3)
  })
  it('LWPOLYLINE mode writes closed contours with a vertex count', () => {
    const d = parseDxf(sheetToDxf(sheets[0], opts.sheetW, opts.sheetH, 'lwpolyline'))
    expect(d.version).toBe('AC1015')
    const closed = d.entities.filter((e) => e.type === 'LWPOLYLINE' && e.data.get(70)![0] === 1)
    expect(closed.length).toBe(sheetShapes(sheets[0]).closed.length)
    for (const e of d.entities) expect(e.data.get(10)!.length).toBe(e.data.get(90)![0])
  })
  it('a closed contour made of lines ends where it starts', () => {
    const d = parseDxf(sheetToDxf([sheets[0][0]], opts.sheetW, opts.sheetH))
    const lines = d.entities.filter((e) => e.layer === 'CUT')
    const first = lines[0]
    const last = lines[lines.length - 1]
    expect(last.data.get(11)![0]).toBeCloseTo(first.data.get(10)![0])
  })
})

describe('font', () => {
  it('draws text centred and scaled to the cap height', () => {
    const lines = textStrokes('HI', { size: 6 })
    const bb = bboxOf(lines)
    expect(bb.maxY - bb.minY).toBeCloseTo(6)
    expect(bb.minX).toBeCloseTo(-textWidth('HI', 6) / 2)
    expect(bb.maxX - bb.minX).toBeLessThanOrEqual(textWidth('HI', 6) + 1e-9)
  })
  it('shrinks to the maximum width and handles Ukrainian letters', () => {
    const bb = bboxOf(textStrokes('Чай з лимоном', { size: 10, maxWidth: 40 }))
    expect(bb.maxX - bb.minX).toBeLessThanOrEqual(40.001)
    expect(textStrokes('Привіт', { size: 5 }).length).toBeGreaterThan(6)
  })
  it('skips unknown characters', () => {
    expect(textStrokes('~', { size: 5 })).toEqual([])
  })
})
