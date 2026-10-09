export type Pt = [number, number]

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const EPS = 1e-9

export function bboxOf(shapes: Pt[][]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of shapes) {
    for (const [x, y] of s) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  return { minX, minY, maxX, maxY }
}

/** Signed area; positive for counter-clockwise polygons (y up). */
export function signedArea(p: Pt[]): number {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]
    const [x2, y2] = p[(i + 1) % p.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

export function translate(p: Pt[], dx: number, dy: number): Pt[] {
  return p.map(([x, y]) => [x + dx, y + dy])
}

export function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
}

/** Removes repeated points and collinear middle points of a closed polygon. */
export function cleanPolygon(p: Pt[]): Pt[] {
  let pts = p.filter((q, i) => {
    const n = p[(i + 1) % p.length]
    return Math.abs(q[0] - n[0]) > EPS || Math.abs(q[1] - n[1]) > EPS
  })
  let changed = true
  while (changed && pts.length > 3) {
    changed = false
    const out: Pt[] = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]
      const b = pts[i]
      const c = pts[(i + 1) % pts.length]
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
      const scale = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1])
      if (Math.abs(cross) <= 1e-9 * Math.max(1, scale)) {
        changed = true
        continue
      }
      out.push(b)
    }
    pts = out
  }
  return pts
}

/**
 * Offsets a closed polygon by `d` with mitred corners. Positive `d` moves the boundary
 * outwards (grows the enclosed region), negative moves it inwards, whatever the winding.
 * Exact for rectilinear polygons; for arcs approximated by short segments it is accurate to
 * the segment length.
 */
export function offsetPolygon(poly: Pt[], d: number): Pt[] {
  const p = cleanPolygon(poly)
  if (d === 0 || p.length < 3) return p
  // For a CCW polygon the outward normal of edge (dx,dy) is (dy,-dx).
  const sgn = signedArea(p) >= 0 ? 1 : -1
  const n = p.length
  const normals: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = p[i]
    const b = p[(i + 1) % n]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    normals.push([(sgn * dy) / len, (-sgn * dx) / len])
  }
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const n1 = normals[(i + n - 1) % n]
    const n2 = normals[i]
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1]
    // Limit the mitre on very sharp corners.
    const f = d / Math.max(k, 0.2)
    out.push([p[i][0] + (n1[0] + n2[0]) * f, p[i][1] + (n1[1] + n2[1]) * f])
  }
  return out
}

/** Points of an arc, endpoints included. Angles in radians, counter-clockwise for a1 > a0. */
export function arcPoints(cx: number, cy: number, r: number, a0: number, a1: number, maxStep = 0.12): Pt[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / maxStep))
  const out: Pt[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}

/** Counter-clockwise rounded rectangle with corner radius r, lower-left corner at (x, y). */
export function roundedRect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  if (r <= EPS) return rect(x, y, w, h)
  const pts: Pt[] = []
  pts.push(...arcPoints(x + w - r, y + r, r, -Math.PI / 2, 0))
  pts.push(...arcPoints(x + w - r, y + h - r, r, 0, Math.PI / 2))
  pts.push(...arcPoints(x + r, y + h - r, r, Math.PI / 2, Math.PI))
  pts.push(...arcPoints(x + r, y + r, r, Math.PI, (3 * Math.PI) / 2))
  return cleanPolygon(pts)
}

export function pointInPolygon(x: number, y: number, p: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]
    const [xj, yj] = p[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
