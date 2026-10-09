import { bboxOf, cleanPolygon, offsetPolygon, type Pt } from './geom'
import type { BoxParams, Dims, Part } from './types'

/** A translatable message: the English template followed by values for `{0}`, `{1}`. */
export type Issue = [string, ...(string | number)[]]

export const defaultParams: BoxParams = {
  style: 'finger',
  dimMode: 'inner',
  width: 100,
  depth: 70,
  height: 40,
  thickness: 3,
  kerf: 0.15,
  lid: 'lift-off',
  fingerAuto: true,
  fingerWidth: 8,
  dividersAcross: 0,
  dividersAlong: 0,
  cornerRadius: 12,
  hingeSpacing: 2.5,
  hingeSlit: 18,
  hingeBridge: 4,
  hingeWidth: 20,
  lidClearance: 0.3,
  label: '',
  labelSize: 8,
  labelOn: 'front',
}

export interface RawPart {
  id: string
  name: string
  nameArgs?: number[]
  outline: Pt[]
  holes?: Pt[][]
  slits?: Pt[][]
  engrave?: Pt[][]
}

/**
 * Applies kerf compensation and moves the part to the origin.
 * The laser removes `kerf` of material, half on each side of the path, so the outer contour moves outwards
 * by kerf / 2 and every hole moves inwards by kerf / 2. Tabs then come out `kerf` wider and slots `kerf`
 * narrower on the path, which is exactly what the cut leaves behind at nominal size.
 */
export function finalize(raw: RawPart, kerf: number): Part {
  const outline = kerf > 0 ? offsetPolygon(raw.outline, kerf / 2) : cleanPolygon(raw.outline)
  const holes = (raw.holes ?? []).map((h) => (kerf > 0 ? offsetPolygon(h, -kerf / 2) : cleanPolygon(h)))
  const bb = bboxOf([outline])
  const mv = (p: Pt[]): Pt[] => p.map(([x, y]) => [x - bb.minX, y - bb.minY])
  return {
    id: raw.id,
    name: raw.name,
    nameArgs: raw.nameArgs ?? [],
    outline: mv(outline),
    holes: holes.map(mv),
    slits: (raw.slits ?? []).map(mv),
    engrave: (raw.engrave ?? []).map(mv),
    w: bb.maxX - bb.minX,
    h: bb.maxY - bb.minY,
  }
}

const finite = (...xs: number[]) => xs.every((x) => Number.isFinite(x))

/** Slot height and rim of a sliding lid. */
export function slideSlot(t: number, lidClearance: number): { slotH: number; rim: number } {
  return { slotH: t + lidClearance, rim: Math.max(t, 3) }
}

/** Resolves inner/outer input into every size the builders need. */
export function resolveDims(p: BoxParams): Dims {
  const t = p.thickness
  const lid = p.style === 'rounded' && p.lid !== 'lift-off' ? 'none' : p.lid
  const { slotH, rim } = lid === 'sliding' ? slideSlot(t, p.lidClearance) : { slotH: 0, rim: 0 }
  const onTop = lid === 'lift-off' || lid === 'hinged'
  // Height between the floor panel and the outer top that the lid takes away from the cavity.
  const topLoss = lid === 'closed' || onTop ? t : lid === 'sliding' ? slotH + rim : 0
  let W: number, D: number, H: number
  if (p.dimMode === 'inner') {
    W = p.width + 2 * t
    D = p.depth + 2 * t
    H = p.height + t + topLoss
  } else {
    W = p.width
    D = p.depth
    H = p.height
  }
  const Hbody = H - (onTop ? t : 0)
  const Hin = H - t - topLoss
  const Hfront = lid === 'sliding' ? Hbody - slotH - rim : Hbody
  return { W, D, H, Win: W - 2 * t, Din: D - 2 * t, Hin, t, Hbody, Hfront, slotH, rim }
}

export function checkParams(p: BoxParams): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = []
  const warnings: Issue[] = []
  const nums = [p.width, p.depth, p.height, p.thickness, p.kerf, p.fingerWidth, p.cornerRadius, p.hingeSpacing, p.hingeSlit, p.hingeBridge, p.hingeWidth, p.lidClearance, p.labelSize, p.dividersAcross, p.dividersAlong]
  if (!finite(...nums) || p.width <= 0 || p.depth <= 0 || p.height <= 0 || p.thickness <= 0) {
    errors.push(['Sizes and thickness must be positive numbers.'])
    return { errors, warnings }
  }
  const t = p.thickness
  if (p.kerf < 0 || p.kerf >= t) errors.push(['Kerf must be at least 0 and less than the material thickness.'])
  if (!p.fingerAuto && p.fingerWidth <= 0) errors.push(['Finger width must be positive.'])
  if (p.lidClearance < 0 || p.lidClearance > t) errors.push(['Lid clearance must be between 0 and the material thickness.'])
  const d = resolveDims(p)
  if (d.Win < 3 * t || d.Din < 3 * t || d.Hin < t) {
    errors.push(['The box is too small for this material thickness.'])
    return { errors, warnings }
  }
  const rounded = p.style === 'rounded'
  if (rounded) {
    const rMin = 2 * t
    const rMax = Math.min(d.W, d.D) / 2
    if (p.cornerRadius < rMin || p.cornerRadius > rMax + 1e-9) errors.push(['Corner radius must be between {0} and {1} mm.', +rMin.toFixed(2), +rMax.toFixed(2)])
    if (p.hingeSpacing <= 0 || p.hingeSlit <= 0 || p.hingeBridge <= 0) errors.push(['Hinge pattern values must be positive.'])
    if (p.lid !== 'none' && p.lid !== 'lift-off') warnings.push(['The rounded box supports an open top or a lift-off lid only.'])
    if (p.dividersAcross > 0 || p.dividersAlong > 0) warnings.push(['Dividers are only available for the finger-joint box.'])
  } else {
    for (const [n, inner, key] of [
      [p.dividersAcross, d.Din, 'across'],
      [p.dividersAlong, d.Win, 'along'],
    ] as const) {
      const k = Math.floor(n)
      if (k < 0 || k > 20) errors.push(['Dividers must be between 0 and 20.'])
      else if (k > 0 && (inner - k * t) / (k + 1) < 2 * t) errors.push(['Too many dividers ({0}): compartments would be narrower than twice the thickness.', key])
    }
    if (p.lid === 'hinged' && p.hingeWidth < 2 * t) errors.push(['The hinge strip must be at least twice the thickness wide.'])
    if (p.hingeSpacing <= 0 || p.hingeSlit <= 0 || p.hingeBridge <= 0) {
      if (p.lid === 'hinged') errors.push(['Hinge pattern values must be positive.'])
    }
  }
  return { errors, warnings }
}
