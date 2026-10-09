import type { Pt } from './geom'

export interface LatticeOptions {
  /** Distance between neighbouring slit lines, across the bending direction. */
  spacing: number
  /** Length of one slit. */
  slit: number
  /** Uncut bridge between two slits on the same line. */
  bridge: number
}

/**
 * Straight-line lattice living hinge. Slits run parallel to the bend axis; neighbouring lines are offset
 * by half a period so the uncut bridges stagger.
 * The zone is `across` wide (the bending direction, x) and `along` long (the axis direction, y), with its
 * lower-left corner at (x0, y0). Slits stay `margin` away from the zone's ends along the axis.
 */
export function latticeVertical(x0: number, y0: number, across: number, along: number, o: LatticeOptions, margin = 2): Pt[][] {
  const out: Pt[][] = []
  const period = o.slit + o.bridge
  const lines = Math.max(1, Math.floor(across / o.spacing))
  const used = (lines - 1) * o.spacing
  const start = x0 + (across - used) / 2
  const lo = y0 + margin
  const hi = y0 + along - margin
  for (let i = 0; i < lines; i++) {
    const x = start + i * o.spacing
    const phase = (i % 2) * (period / 2)
    // Slits start at lo - phase, so odd lines begin part-way through a period.
    for (let y = lo - phase; y < hi; y += period) {
      const a = Math.max(y, lo)
      const b = Math.min(y + o.slit, hi)
      if (b - a >= 1) out.push([[x, a], [x, b]])
    }
  }
  return out
}

/** Same lattice, rotated: slits run along x, lines are spread along y. */
export function latticeHorizontal(x0: number, y0: number, along: number, across: number, o: LatticeOptions, margin = 2): Pt[][] {
  return latticeVertical(0, 0, across, along, o, margin).map((line) => line.map(([x, y]) => [x0 + y, y0 + x] as Pt))
}
