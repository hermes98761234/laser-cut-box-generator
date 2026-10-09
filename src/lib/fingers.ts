import { cleanPolygon, type Pt } from './geom'

/** A piece of a plate edge: `len` along the edge, recessed `v` into the plate. */
export interface Seg {
  len: number
  v: number
}

export type FingerKind = 'tab' | 'notch'

export interface FingerLayout {
  /** Number of segments (always odd). */
  n: number
  /** Width of every segment. */
  width: number
}

/** Nearest odd integer to x (ties go down), at least 1. */
function nearestOdd(x: number): number {
  const lo = Math.max(1, 2 * Math.floor((x - 1) / 2) + 1)
  const hi = lo + 2
  return x - lo <= hi - x ? lo : hi
}

/**
 * Splits an edge of `length` into an odd number of equal segments.
 * `target` is the wanted finger width (0 or less picks it automatically from the length and thickness).
 * Segments are never narrower than the material thickness, so corners stay well formed.
 */
export function fingerLayout(length: number, thickness: number, target = 0): FingerLayout {
  const want = target > 0 ? target : Math.min(20, Math.max(2 * thickness, length / 8))
  let n = nearestOdd(length / want)
  while (n > 1 && length / n < Math.max(thickness, 1e-6)) n -= 2
  return { n, width: length / n }
}

/**
 * Segments of a finger-jointed edge. A `tab` edge starts and ends with a finger that reaches the edge line
 * (v = 0); its mate is a `notch` edge with the exact complement. `depth` is the material thickness.
 */
export function fingerSegs(layout: FingerLayout, kind: FingerKind, depth: number): Seg[] {
  const segs: Seg[] = []
  for (let i = 0; i < layout.n; i++) {
    const even = i % 2 === 0
    const out = kind === 'tab' ? even : !even
    segs.push({ len: layout.width, v: out ? 0 : depth })
  }
  return segs
}

/** Merges neighbouring segments with equal v and drops empty ones. */
export function mergeSegs(segs: Seg[]): Seg[] {
  const out: Seg[] = []
  for (const s of segs) {
    if (s.len <= 1e-9) continue
    const last = out[out.length - 1]
    if (last && Math.abs(last.v - s.v) < 1e-9) last.len += s.len
    else out.push({ ...s })
  }
  return out
}

export function reverseSegs(segs: Seg[]): Seg[] {
  return segs.map((s) => ({ ...s })).reverse()
}

export function totalLen(segs: Seg[]): number {
  return segs.reduce((a, s) => a + s.len, 0)
}

/** Segments of a straight edge of the given length. */
export function straight(len: number): Seg[] {
  return [{ len, v: 0 }]
}

/**
 * A rectangular plate of size w x h (lower-left at the origin, y up) whose four edges are described by
 * segment lists, each in counter-clockwise travel order: bottom (left to right), right (bottom to top),
 * top (right to left), left (top to bottom). `v` recesses a piece of an edge towards the plate centre.
 * At each corner the vertex is the intersection of the two adjacent offset lines.
 */
export function plateFromEdges(w: number, h: number, bottom: Seg[], right: Seg[], top: Seg[], left: Seg[]): Pt[] {
  const first = (s: Seg[]) => s[0].v
  const last = (s: Seg[]) => s[s.length - 1].v
  const pts: Pt[] = []

  // Walks one edge; `at(s, v)` maps travel distance and recess to plate coordinates.
  const walk = (segs: Seg[], at: (s: number, v: number) => Pt, s0: number, s1: number) => {
    let pos = 0
    segs.forEach((seg, i) => {
      const a = i === 0 ? s0 : pos
      pts.push(at(a, seg.v))
      pos += seg.len
      const b = i === segs.length - 1 ? s1 : pos
      pts.push(at(b, seg.v))
    })
  }

  walk(bottom, (s, v) => [s, v], last(left), w - first(right))
  walk(right, (s, v) => [w - v, s], last(bottom), h - first(top))
  walk(top, (s, v) => [w - s, h - v], last(right), w - first(left))
  walk(left, (s, v) => [v, h - s], last(top), h - first(bottom))
  return cleanPolygon(pts)
}
