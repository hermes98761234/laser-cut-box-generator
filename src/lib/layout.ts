import type { Pt } from './geom'
import type { Part } from './types'

export interface LayoutOptions {
  sheetW: number
  sheetH: number
  /** Gap between parts. */
  spacing: number
  /** Gap between parts and the sheet edge. */
  margin: number
  allowRotate: boolean
}

export interface Placed {
  part: Part
  /** Top-left corner of the placed bounding box on the sheet (y grows downwards). */
  x: number
  y: number
  /** Turned by 90 degrees clockwise. */
  rot: boolean
  /** Size of the placed bounding box. */
  w: number
  h: number
}

export interface LayoutResult {
  sheets: Placed[][]
  /** Ids of parts larger than the sheet. */
  oversize: string[]
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** MaxRects bin with the bottom-left rule. */
class Bin {
  free: Rect[]
  w: number
  h: number
  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.free = [{ x: 0, y: 0, w, h }]
  }

  insert(w: number, h: number, rotate: boolean): (Rect & { rot: boolean }) | null {
    let best: (Rect & { rot: boolean }) | null = null
    let bestBottom = Infinity
    let bestLeft = Infinity
    for (const f of this.free) {
      for (const rot of rotate && Math.abs(w - h) > 1e-9 ? [false, true] : [false]) {
        const rw = rot ? h : w
        const rh = rot ? w : h
        if (rw > f.w + 1e-9 || rh > f.h + 1e-9) continue
        // Bottom-left rule: the lowest (then leftmost) spot, which fills the sheet row by row.
        const bottom = f.y + rh
        if (bottom < bestBottom - 1e-9 || (Math.abs(bottom - bestBottom) < 1e-9 && f.x < bestLeft)) {
          best = { x: f.x, y: f.y, w: rw, h: rh, rot }
          bestBottom = bottom
          bestLeft = f.x
        }
      }
    }
    if (best) this.place(best)
    return best
  }

  private place(r: Rect) {
    const next: Rect[] = []
    for (const f of this.free) {
      if (r.x >= f.x + f.w - 1e-9 || r.x + r.w <= f.x + 1e-9 || r.y >= f.y + f.h - 1e-9 || r.y + r.h <= f.y + 1e-9) {
        next.push(f)
        continue
      }
      if (r.x > f.x + 1e-9) next.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h })
      if (r.x + r.w < f.x + f.w - 1e-9) next.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - (r.x + r.w), h: f.h })
      if (r.y > f.y + 1e-9) next.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y })
      if (r.y + r.h < f.y + f.h - 1e-9) next.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - (r.y + r.h) })
    }
    this.free = next.filter((a, i) => !next.some((b, j) => i !== j && contains(b, a) && (!contains(a, b) || j < i)))
  }
}

const contains = (a: Rect, b: Rect) => b.x >= a.x - 1e-9 && b.y >= a.y - 1e-9 && b.x + b.w <= a.x + a.w + 1e-9 && b.y + b.h <= a.y + a.h + 1e-9

/** Packs the bounding boxes of the parts onto as few sheets as it can, largest parts first. */
export function layoutParts(parts: Part[], o: LayoutOptions): LayoutResult {
  const sorted = [...parts].sort((a, b) => b.w * b.h - a.w * a.h || b.h - a.h)
  const binW = o.sheetW - 2 * o.margin + o.spacing
  const binH = o.sheetH - 2 * o.margin + o.spacing
  const sheets: Placed[][] = []
  const bins: Bin[] = []
  const oversize: string[] = []
  for (const part of sorted) {
    const w = part.w + o.spacing
    const h = part.h + o.spacing
    const fitsEmpty = (w <= binW + 1e-9 && h <= binH + 1e-9) || (o.allowRotate && h <= binW + 1e-9 && w <= binH + 1e-9)
    if (!fitsEmpty) {
      oversize.push(part.id)
      sheets.push([{ part, x: o.margin, y: o.margin, rot: false, w: part.w, h: part.h }])
      bins.push(new Bin(0, 0))
      continue
    }
    let done = false
    for (let i = 0; i < bins.length && !done; i++) {
      if (bins[i].w === 0) continue
      const r = bins[i].insert(w, h, o.allowRotate)
      if (r) {
        sheets[i].push({ part, x: o.margin + r.x, y: o.margin + r.y, rot: r.rot, w: r.rot ? part.h : part.w, h: r.rot ? part.w : part.h })
        done = true
      }
    }
    if (!done) {
      const bin = new Bin(binW, binH)
      const r = bin.insert(w, h, o.allowRotate)!
      bins.push(bin)
      sheets.push([{ part, x: o.margin + r.x, y: o.margin + r.y, rot: r.rot, w: r.rot ? part.h : part.w, h: r.rot ? part.w : part.h }])
    }
  }
  if (sheets.length === 0) sheets.push([])
  return { sheets, oversize }
}

/** Maps points of a part (y up, origin at its bounding box corner) to sheet coordinates (y down). */
export function placePoints(pl: Placed, pts: Pt[]): Pt[] {
  const { part, x, y, rot } = pl
  return rot ? pts.map(([px, py]) => [x + py, y + px] as Pt) : pts.map(([px, py]) => [x + px, y + (part.h - py)] as Pt)
}

export interface SheetShapes {
  /** Closed cut contours. */
  closed: Pt[][]
  /** Open cut lines. */
  cutLines: Pt[][]
  engrave: Pt[][]
}

export function sheetShapes(placed: Placed[]): SheetShapes {
  const s: SheetShapes = { closed: [], cutLines: [], engrave: [] }
  for (const pl of placed) {
    for (const h of pl.part.holes) s.closed.push(placePoints(pl, h))
    for (const l of pl.part.slits) s.cutLines.push(placePoints(pl, l))
    s.closed.push(placePoints(pl, pl.part.outline))
    for (const l of pl.part.engrave) s.engrave.push(placePoints(pl, l))
  }
  return s
}
