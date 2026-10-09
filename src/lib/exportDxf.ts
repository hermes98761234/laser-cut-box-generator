import type { Pt } from './geom'
import { sheetShapes, type Placed } from './layout'

export type DxfMode = 'lines' | 'lwpolyline'

const fmt = (n: number) => String(+n.toFixed(4))

/**
 * ASCII DXF for one sheet in millimetres. The sheet's y axis points down, DXF's points up, so y is flipped.
 * `lines` writes R12 (AC1009) LINE entities, which every reader understands.
 * `lwpolyline` writes LWPOLYLINE entities (a R13+ entity) with an AC1015 header, which keeps contours joined.
 */
export function sheetToDxf(placed: Placed[], sheetW: number, sheetH: number, mode: DxfMode = 'lines'): string {
  const s = sheetShapes(placed)
  const flip = (p: Pt[]): Pt[] => p.map(([x, y]) => [x, sheetH - y] as Pt)
  const out: (string | number)[] = []
  const g = (code: number, value: string | number) => out.push(code, value)
  const v2015 = mode === 'lwpolyline'

  g(0, 'SECTION')
  g(2, 'HEADER')
  g(9, '$ACADVER')
  g(1, v2015 ? 'AC1015' : 'AC1009')
  g(9, '$INSUNITS')
  g(70, 4)
  g(9, '$MEASUREMENT')
  g(70, 1)
  g(9, '$EXTMIN')
  g(10, 0)
  g(20, 0)
  g(30, 0)
  g(9, '$EXTMAX')
  g(10, fmt(sheetW))
  g(20, fmt(sheetH))
  g(30, 0)
  g(0, 'ENDSEC')
  g(0, 'SECTION')
  g(2, 'TABLES')
  g(0, 'TABLE')
  g(2, 'LTYPE')
  g(70, 1)
  g(0, 'LTYPE')
  g(2, 'CONTINUOUS')
  g(70, 0)
  g(3, 'Solid line')
  g(72, 65)
  g(73, 0)
  g(40, 0)
  g(0, 'ENDTAB')
  g(0, 'TABLE')
  g(2, 'LAYER')
  g(70, 2)
  for (const [name, color] of [
    ['CUT', 1],
    ['ENGRAVE', 5],
  ] as const) {
    g(0, 'LAYER')
    g(2, name)
    g(70, 0)
    g(62, color)
    g(6, 'CONTINUOUS')
  }
  g(0, 'ENDTAB')
  g(0, 'ENDSEC')
  g(0, 'SECTION')
  g(2, 'ENTITIES')

  const poly = (layer: string, pts: Pt[], closed: boolean) => {
    if (pts.length < 2) return
    if (mode === 'lwpolyline') {
      g(0, 'LWPOLYLINE')
      g(8, layer)
      g(100, 'AcDbEntity')
      g(100, 'AcDbPolyline')
      g(90, pts.length)
      g(70, closed ? 1 : 0)
      for (const [x, y] of pts) {
        g(10, fmt(x))
        g(20, fmt(y))
      }
      return
    }
    const n = closed ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      g(0, 'LINE')
      g(8, layer)
      g(10, fmt(a[0]))
      g(20, fmt(a[1]))
      g(30, 0)
      g(11, fmt(b[0]))
      g(21, fmt(b[1]))
      g(31, 0)
    }
  }
  for (const p of s.closed) poly('CUT', flip(p), true)
  for (const p of s.cutLines) poly('CUT', flip(p), false)
  for (const p of s.engrave) poly('ENGRAVE', flip(p), false)
  g(0, 'ENDSEC')
  g(0, 'EOF')
  return out.map((x) => String(x)).join('\n') + '\n'
}

export interface DxfEntity {
  type: string
  layer: string
  /** Coordinate values by group code, in file order. */
  data: Map<number, number[]>
}

/** Minimal reader for the files written above; used by the tests and to sanity-check exports. */
export function parseDxf(text: string): { version: string; entities: DxfEntity[]; layers: string[]; endsWithEof: boolean } {
  const lines = text.split(/\r?\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  if (lines.length % 2 !== 0) throw new Error('DXF has an odd number of lines')
  const pairs: [number, string][] = []
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i].trim())
    if (!Number.isInteger(code)) throw new Error(`Bad group code "${lines[i]}" on line ${i + 1}`)
    pairs.push([code, lines[i + 1].trim()])
  }
  let version = ''
  const layers: string[] = []
  const entities: DxfEntity[] = []
  let section = ''
  let table = ''
  let cur: DxfEntity | null = null
  for (let i = 0; i < pairs.length; i++) {
    const [code, val] = pairs[i]
    if (code === 0 && val === 'SECTION') section = pairs[i + 1][1]
    if (code === 0 && val === 'ENDSEC') section = ''
    if (section === 'HEADER' && code === 9 && val === '$ACADVER') version = pairs[i + 1][1]
    if (section === 'TABLES') {
      if (code === 0 && val === 'TABLE') table = pairs[i + 1][1]
      if (table === 'LAYER' && code === 0 && val === 'LAYER') layers.push(pairs[i + 1][1])
    }
    if (section === 'ENTITIES' && !(code === 0 && val === 'SECTION')) {
      if (code === 0) {
        cur = { type: val, layer: '', data: new Map() }
        entities.push(cur)
      } else if (cur) {
        if (code === 8) cur.layer = val
        else if (code !== 100) {
          const list = cur.data.get(code) ?? []
          list.push(Number(val))
          cur.data.set(code, list)
        }
      }
    }
  }
  const last = pairs[pairs.length - 1]
  return { version, entities, layers, endsWithEof: last[0] === 0 && last[1] === 'EOF' }
}
