import { arcPoints, cleanPolygon, roundedRect, type Pt } from './geom'
import { fingerLayout, fingerSegs, mergeSegs, plateFromEdges, straight, type Seg } from './fingers'
import { latticeVertical } from './hinge'
import { textStrokes } from './font'
import type { RawPart } from './parts'
import type { BoxParams, Dims, PlateSolid, Solid } from './types'

/** Lengths of the strip sections of the rounded box, in travel order, starting at the middle of the back. */
export interface BandLayout {
  /** Straight length of the front and back sides / left and right sides. */
  Lf: number
  Ld: number
  /** Arc length of one corner measured on the neutral fibre (half the thickness inside the outer face). */
  arc: number
  /** Total length of the band: one full turn around the box. */
  P: number
  /** Start and end of each corner zone along the strip. */
  corners: [number, number][]
}

export function bandLayout(W: number, D: number, r: number, t: number): BandLayout {
  const Lf = W - 2 * r
  const Ld = D - 2 * r
  const arc = ((r - t / 2) * Math.PI) / 2
  const starts = [Lf / 2, Lf / 2 + arc + Ld, Lf / 2 + 2 * arc + Ld + Lf, Lf / 2 + 3 * arc + 2 * Ld + Lf]
  return { Lf, Ld, arc, P: 2 * Lf + 2 * Ld + 4 * arc, corners: starts.map((s) => [s, s + arc]) }
}

/** Part of a symmetric finger pattern between pattern coordinates a and b (a <= b). */
function slice(segs: Seg[], a: number, b: number): Seg[] {
  const out: Seg[] = []
  let pos = 0
  for (const s of segs) {
    const lo = Math.max(a, pos)
    const hi = Math.min(b, pos + s.len)
    if (hi - lo > 1e-9) out.push({ len: hi - lo, v: s.v })
    pos += s.len
  }
  return out
}

export function buildRounded(p: BoxParams, d: Dims): { raws: RawPart[]; solids: Solid[] } {
  const { W, D, t, Hbody: Hb, Win, Din } = d
  const r = p.cornerRadius
  const L = bandLayout(W, D, r, t)
  const fw = p.fingerAuto ? 0 : p.fingerWidth
  const lay = (len: number) => fingerLayout(len, t, fw)
  const plateEdge = (len: number) => (len > 2 * t ? fingerSegs(lay(len), 'tab', t) : straight(len))
  const bandEdge = (len: number) => (len > 2 * t ? fingerSegs(lay(len), 'notch', t) : [{ len, v: t }])
  const raws: RawPart[] = []
  const solids: Solid[] = []

  // Bottom plate: rounded rectangle whose straight sides carry the finger notches.
  const pts: Pt[] = []
  const edge = (segs: Seg[], at: (s: number, v: number) => Pt, from: number) => {
    let pos = from
    for (const s of segs) {
      pts.push(at(pos, s.v))
      pos += s.len
      pts.push(at(pos, s.v))
    }
  }
  const front = plateEdge(L.Lf)
  const side = plateEdge(L.Ld)
  if (L.Lf > 1e-9) edge(front, (s, v) => [s, v], r)
  pts.push(...arcPoints(W - r, r, r, -Math.PI / 2, 0))
  if (L.Ld > 1e-9) edge(side, (s, v) => [W - v, s], r)
  pts.push(...arcPoints(W - r, D - r, r, 0, Math.PI / 2))
  if (L.Lf > 1e-9) edge(front, (s, v) => [W - s, D - v], r)
  pts.push(...arcPoints(r, D - r, r, Math.PI / 2, Math.PI))
  if (L.Ld > 1e-9) edge(side, (s, v) => [v, D - s], r)
  pts.push(...arcPoints(r, r, r, Math.PI, (3 * Math.PI) / 2))
  const bottom = cleanPolygon(pts)
  raws.push({ id: 'bottom', name: 'Bottom', outline: bottom })
  solids.push(plate('bottom', 'Bottom', bottom, [0, 0, 0], t, [0, 0, -1]))

  // Band: bottom edge profile, seam fingers, living hinge slits.
  const sd = 2 * t // seam finger depth
  const fPat = L.Lf > 2 * t ? bandEdge(L.Lf) : []
  const dPat = L.Ld > 2 * t ? bandEdge(L.Ld) : []
  const flat = (pat: Seg[], len: number): Seg[] => (pat.length ? pat : [{ len, v: t }])
  const fullF = flat(fPat, L.Lf)
  const fullD = flat(dPat, L.Ld)
  const arcSeg = (): Seg[] => [{ len: L.arc, v: t }]
  const bottomSegs: Seg[] = mergeSegs([
    ...slice(fullF, L.Lf / 2, L.Lf),
    ...arcSeg(),
    ...fullD,
    ...arcSeg(),
    ...fullF,
    ...arcSeg(),
    ...fullD,
    ...arcSeg(),
    ...slice(fullF, 0, L.Lf / 2),
    // Overhang of the seam fingers continues the pattern of the start.
    ...slice(fullF, L.Lf / 2, L.Lf / 2 + sd),
  ])
  const wBand = L.P + sd
  const have = bottomSegs.reduce((a, q) => a + q.len, 0)
  if (have < wBand - 1e-9) bottomSegs.push({ len: wBand - have, v: t })
  const seamLay = lay(Hb)
  const rightEnd = fingerSegs(seamLay, 'tab', sd)
  const leftEnd = fingerSegs(seamLay, 'notch', sd)
  const bandOutline = plateFromEdges(wBand, Hb, bottomSegs, rightEnd, straight(wBand), leftEnd)
  const slits: Pt[][] = []
  const hinge = { spacing: p.hingeSpacing, slit: p.hingeSlit, bridge: p.hingeBridge }
  for (const [a, b] of L.corners) slits.push(...latticeVertical(a, t, b - a, Hb - t, hinge, 2))
  const labelText = p.label.trim()
  const engrave: Pt[][] = []
  if (labelText && p.labelOn === 'front') {
    const size = Math.min(p.labelSize, Math.max(2, Hb - t - 4 * t))
    engrave.push(...textStrokes(labelText, { size, maxWidth: Math.max(4, L.Lf - 2 * t) }).map((l) => l.map(([x, y]) => [x + L.P / 2, y + (t + Hb) / 2] as Pt)))
  }
  raws.push({ id: 'band', name: 'Wall band with living hinges', outline: bandOutline, slits, engrave })
  solids.push({ kind: 'band', id: 'band', name: 'Wall band with living hinges', nameArgs: [], W, D, r, t, z0: t, z1: Hb, out: [0, 0, 0] })

  if (p.lid === 'lift-off') {
    const c = p.lidClearance
    const lidOutline = roundedRect(0, 0, W, D, r)
    const plugR = Math.max(r - t - c, 0.5)
    const plug = roundedRect(0, 0, Win - 2 * c, Din - 2 * c, plugR)
    const lidEngrave =
      labelText && p.labelOn === 'lid' ? textStrokes(labelText, { size: Math.min(p.labelSize, D / 2), maxWidth: Math.max(4, W - 2 * r) }).map((l) => l.map(([x, y]) => [x + W / 2, y + D / 2] as Pt)) : []
    raws.push({ id: 'lid', name: 'Lid', outline: lidOutline, engrave: lidEngrave })
    solids.push(plate('lid', 'Lid', lidOutline, [0, 0, Hb], t, [0, 0, 1]))
    raws.push({ id: 'lid-plug', name: 'Lid plug', outline: plug })
    solids.push(plateAt('lid-plug', 'Lid plug', plug, [t + c, t + c, Hb - t], t))
  }
  return { raws, solids }
}

function plate(id: string, name: string, outline: Pt[], o: [number, number, number], t: number, out: [number, number, number]): PlateSolid {
  return { kind: 'plate', id, name, nameArgs: [], outline, holes: [], o, u: [1, 0, 0], v: [0, 1, 0], t, out }
}

function plateAt(id: string, name: string, outline: Pt[], o: [number, number, number], t: number): PlateSolid {
  return plate(id, name, outline, o, t, [0, 0, 1])
}

/** Point on the band's neutral path at distance s along the strip, with its outward normal. For the 3D preview. */
export function bandPoint(W: number, D: number, r: number, t: number, s: number): { x: number; y: number; nx: number; ny: number } {
  const L = bandLayout(W, D, r, t)
  const rn = r - t / 2
  // Walk counter-clockwise from the middle of the back, travelling towards -x.
  let x = W / 2
  let y = D - t / 2
  let ang = Math.PI // heading
  let rest = ((s % L.P) + L.P) % L.P
  const moves: ['line' | 'arc', number][] = [
    ['line', L.Lf / 2],
    ['arc', L.arc],
    ['line', L.Ld],
    ['arc', L.arc],
    ['line', L.Lf],
    ['arc', L.arc],
    ['line', L.Ld],
    ['arc', L.arc],
    ['line', L.Lf / 2],
  ]
  for (const [kind, len] of moves) {
    const use = Math.min(rest, len)
    if (kind === 'line') {
      x += Math.cos(ang) * use
      y += Math.sin(ang) * use
    } else {
      // Left turn around a centre rn to the left of the heading.
      const cx = x + Math.cos(ang + Math.PI / 2) * rn
      const cy = y + Math.sin(ang + Math.PI / 2) * rn
      const turn = use / rn
      const a0 = ang - Math.PI / 2
      x = cx + Math.cos(a0 + turn) * rn
      y = cy + Math.sin(a0 + turn) * rn
      ang += turn
    }
    rest -= use
    if (rest <= 1e-12) break
  }
  // Heading is counter-clockwise, so the outward normal is to the right of the heading.
  return { x, y, nx: Math.sin(ang), ny: -Math.cos(ang) }
}
