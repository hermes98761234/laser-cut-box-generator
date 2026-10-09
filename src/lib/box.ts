import { cleanPolygon, rect, type Pt } from './geom'
import { fingerLayout, fingerSegs, mergeSegs, plateFromEdges, straight, type Seg } from './fingers'
import { latticeHorizontal } from './hinge'
import { textStrokes } from './font'
import { checkParams, finalize, resolveDims, slideSlot, type RawPart } from './parts'
import { buildRounded } from './rounded'
import type { BoxModel, BoxParams, Dims, PlateSolid, Solid, Vec3 } from './types'

export { checkParams, defaultParams, resolveDims } from './parts'

/** Builds all flat parts (with kerf compensation) and the 3D solids of a box. Throws if the parameters are invalid. */
export function buildBox(p: BoxParams): BoxModel {
  const check = checkParams(p)
  if (check.errors.length) throw new RangeError(check.errors[0][0])
  const dims = resolveDims(p)
  const warnings = check.warnings.map((w) => w[0])
  const { raws, solids } = p.style === 'rounded' ? buildRounded(p, dims) : buildFinger(p, dims, warnings)
  return { dims, parts: raws.map((r) => finalize(r, p.kerf)), solids, warnings }
}

interface Built {
  raws: RawPart[]
  solids: Solid[]
}

/** Divider outline in (length, z): body between the walls, end tabs for the wall slots, half-lap notches. */
function dividerOutline(len: number, t: number, notches: number[], notchesOnTop: boolean, zb: number, zt: number, tab: { lo: number; hi: number } | null): Pt[] {
  const hn = (zt - zb) / 2
  const x0 = t
  const x1 = len - t
  const pts: Pt[] = [[x0, zb]]
  if (!notchesOnTop) for (const n of notches) pts.push([n, zb], [n, zb + hn], [n + t, zb + hn], [n + t, zb])
  pts.push([x1, zb])
  if (tab) pts.push([x1, tab.lo], [len, tab.lo], [len, tab.hi], [x1, tab.hi])
  pts.push([x1, zt])
  if (notchesOnTop) for (const n of [...notches].reverse()) pts.push([n + t, zt], [n + t, zt - hn], [n, zt - hn], [n, zt])
  pts.push([x0, zt])
  if (tab) pts.push([x0, tab.hi], [0, tab.hi], [0, tab.lo], [x0, tab.lo])
  return cleanPolygon(pts)
}

/** Lower-left positions of n evenly spaced dividers of thickness t inside a cavity of the given length. */
export function dividerPositions(inner: number, n: number, t: number): number[] {
  const c = (inner - n * t) / (n + 1)
  return Array.from({ length: n }, (_, i) => t + (i + 1) * c + i * t)
}

function plate(id: string, name: string, outline: Pt[], holes: Pt[][], o: Vec3, u: Vec3, v: Vec3, t: number, out: Vec3, nameArgs: number[] = []): PlateSolid {
  return { kind: 'plate', id, name, nameArgs, outline, holes, o, u, v, t, out }
}

function buildFinger(p: BoxParams, d: Dims, warnings: string[]): Built {
  const { W, D, t, Hbody: Hb, Hfront: Hf, Win, Din, Hin } = d
  const lid = p.lid
  const hasTop = lid === 'closed'
  const sliding = lid === 'sliding'
  const lay = (L: number) => fingerLayout(L, t, p.fingerAuto ? 0 : p.fingerWidth)
  const tab = (L: number) => fingerSegs(lay(L), 'tab', t)
  const notch = (L: number) => fingerSegs(lay(L), 'notch', t)

  const nA = Math.floor(p.dividersAcross)
  const nB = Math.floor(p.dividersAlong)
  const ya = dividerPositions(Din, nA, t)
  const xb = dividerPositions(Win, nB, t)
  const Hd = Hin - (lid === 'lift-off' ? t + p.lidClearance : 0)
  const zb = t
  const zt = t + Hd
  const g = t
  const htab = Math.min(Hd - g - t, Math.max(2 * t, Hd / 2))
  const hasTabs = htab >= t
  if ((nA > 0 || nB > 0) && !hasTabs) warnings.push('The box is too low for divider tabs; dividers will not be locked in.')
  const tabSpan = hasTabs ? { lo: zb + g, hi: zb + g + htab } : null
  const slotHoles = (positions: number[]): Pt[][] => (hasTabs ? positions.map((x) => rect(x, zb + g, t, htab)) : [])

  const raws: RawPart[] = []
  const solids: Solid[] = []
  const add = (raw: RawPart, solid: PlateSolid | null) => {
    raws.push(raw)
    if (solid) solids.push(solid)
  }

  const labelText = p.label.trim()
  const strokes = (cx: number, cy: number, w: number, h: number, rot = false): Pt[][] => {
    if (!labelText) return []
    const size = Math.min(p.labelSize, Math.max(2, h - 4 * t))
    return textStrokes(labelText, { size, maxWidth: Math.max(4, w - 4 * t) }).map((l) => l.map(([x, y]) => (rot ? [cx - x, cy - y] : [cx + x, cy + y]) as Pt))
  }
  // Keep the front label clear of the divider slots when there are any.
  const frontLabel = (): Pt[][] => {
    if (nB > 0 && tabSpan && Hf - tabSpan.hi > 4 * t + 3) {
      const room = Hf - tabSpan.hi
      return strokes(W / 2, tabSpan.hi + room / 2, W, room)
    }
    return strokes(W / 2, Hf / 2, W, Hf)
  }
  const labelFront = labelText && (p.labelOn === 'front' || lid === 'none')
  const labelLid = labelText && p.labelOn === 'lid' && lid !== 'none'

  // Bottom (and top) plate: finger tabs on all four edges.
  const flat = plateFromEdges(W, D, tab(W), tab(D), tab(W), tab(D))
  add({ id: 'bottom', name: 'Bottom', outline: flat }, plate('bottom', 'Bottom', flat, [], [0, 0, 0], [1, 0, 0], [0, 1, 0], t, [0, 0, -1]))
  if (hasTop) {
    const engrave = labelLid ? strokes(W / 2, D / 2, W, D) : []
    add({ id: 'top', name: 'Top', outline: flat, engrave }, plate('top', 'Top', flat, [], [0, 0, Hb - t], [1, 0, 0], [0, 1, 0], t, [0, 0, 1]))
  }

  // Front and back panels.
  const topEdge = (L: number) => (hasTop ? notch(L) : straight(L))
  const frontOutline = plateFromEdges(W, Hf, notch(W), tab(Hf), topEdge(W), tab(Hf))
  const frontHoles = slotHoles(xb)
  add(
    { id: 'front', name: 'Front', outline: frontOutline, holes: frontHoles, engrave: labelFront ? frontLabel() : [] },
    plate('front', 'Front', frontOutline, frontHoles, [0, t, 0], [1, 0, 0], [0, 0, 1], t, [0, -1, 0]),
  )

  if (lid === 'hinged') {
    // Back panel, living hinge strip and lid in one piece: the lid folds over the top.
    const hw = p.hingeWidth
    const base = plateFromEdges(W, Hb, notch(W), tab(Hb), straight(W), tab(Hb))
    const i = base.findIndex((q, k) => Math.abs(q[0] - W) < 1e-6 && Math.abs(q[1] - Hb) < 1e-6 && Math.abs(base[(k + 1) % base.length][0]) < 1e-6)
    const combined = cleanPolygon([...base.slice(0, i + 1), [W, Hb + hw], [W, Hb + hw + D], [0, Hb + hw + D], [0, Hb + hw], ...base.slice(i + 1)])
    const slits = latticeHorizontal(0, Hb, W, hw, { spacing: p.hingeSpacing, slit: p.hingeSlit, bridge: p.hingeBridge }, Math.min(4, W / 4))
    const engrave = labelLid ? strokes(W / 2, Hb + hw + D / 2, W, D, true) : []
    add({ id: 'back', name: 'Back with hinged lid', outline: combined, holes: slotHoles(xb), slits, engrave }, plate('back', 'Back', base, slotHoles(xb), [0, D, 0], [1, 0, 0], [0, 0, 1], t, [0, 1, 0]))
    const lidOutline = rect(0, 0, W, D)
    solids.push(plate('lid', 'Lid', lidOutline, [], [0, 0, Hb], [1, 0, 0], [0, 1, 0], t, [0, 0, 1]))
  } else {
    const backOutline = plateFromEdges(W, Hb, notch(W), tab(Hb), topEdge(W), tab(Hb))
    add(
      { id: 'back', name: 'Back', outline: backOutline, holes: slotHoles(xb) },
      plate('back', 'Back', backOutline, slotHoles(xb), [0, D, 0], [1, 0, 0], [0, 0, 1], t, [0, 1, 0]),
    )
  }

  // Side panels (identical): u runs from the front to the back.
  let frontEdge: Seg[] = notch(Hb)
  if (sliding) {
    const { slotH, rim } = slideSlot(t, p.lidClearance)
    frontEdge = mergeSegs([{ len: rim, v: 0 }, { len: slotH, v: D - t }, ...notch(Hf)])
  }
  const sideOutline = plateFromEdges(D, Hb, notch(D), notch(Hb), hasTop ? notch(D) : straight(D), frontEdge)
  const sideHoles = slotHoles(ya)
  add({ id: 'left', name: 'Left side', outline: sideOutline, holes: sideHoles }, plate('left', 'Left side', sideOutline, sideHoles, [0, 0, 0], [0, 1, 0], [0, 0, 1], t, [-1, 0, 0]))
  add({ id: 'right', name: 'Right side', outline: sideOutline, holes: sideHoles }, plate('right', 'Right side', sideOutline, sideHoles, [W - t, 0, 0], [0, 1, 0], [0, 0, 1], t, [1, 0, 0]))

  // Lids.
  const c = p.lidClearance
  if (lid === 'lift-off') {
    const lidOutline = rect(0, 0, W, D)
    const plug = rect(0, 0, Win - 2 * c, Din - 2 * c)
    add({ id: 'lid', name: 'Lid', outline: lidOutline, engrave: labelLid ? strokes(W / 2, D / 2, W, D) : [] }, plate('lid', 'Lid', lidOutline, [], [0, 0, Hb], [1, 0, 0], [0, 1, 0], t, [0, 0, 1]))
    add({ id: 'lid-plug', name: 'Lid plug', outline: plug }, plate('lid-plug', 'Lid plug', plug, [], [t + c, t + c, Hb - t], [1, 0, 0], [0, 1, 0], t, [0, 0, 1]))
  } else if (sliding) {
    const lidOutline = rect(0, 0, W - c, D - t - c)
    add(
      { id: 'lid', name: 'Sliding lid', outline: lidOutline, engrave: labelLid ? strokes((W - c) / 2, (D - t - c) / 2, W, D) : [] },
      plate('lid', 'Sliding lid', lidOutline, [], [c / 2, 0, Hf], [1, 0, 0], [0, 1, 0], t, [0, -1, 0]),
    )
  }

  // Dividers: A runs across the width (parallel to the front), B along the depth.
  ya.forEach((y, i) => {
    const outline = dividerOutline(W, t, xb, true, zb, zt, tabSpan)
    add({ id: `divider-a${i + 1}`, name: 'Divider A{0}', nameArgs: [i + 1], outline }, plate(`divider-a${i + 1}`, 'Divider A{0}', outline, [], [0, y + t, 0], [1, 0, 0], [0, 0, 1], t, [0, 0, 1], [i + 1]))
  })
  xb.forEach((x, i) => {
    const outline = dividerOutline(D, t, ya, false, zb, zt, tabSpan)
    add({ id: `divider-b${i + 1}`, name: 'Divider B{0}', nameArgs: [i + 1], outline }, plate(`divider-b${i + 1}`, 'Divider B{0}', outline, [], [x, 0, 0], [0, 1, 0], [0, 0, 1], t, [0, 0, 1], [i + 1]))
  })
  return { raws, solids }
}
