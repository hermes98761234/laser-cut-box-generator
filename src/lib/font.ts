import type { Pt } from './geom'

/** Single-stroke font on a 4 x 6 grid (y up), for engraving labels. Polylines separated by ';'. */
const G: Record<string, string> = {
  A: '0,0 2,6 4,0;1,2 3,2',
  B: '0,0 0,6 3,6 4,5 4,4 3,3 0,3;3,3 4,2 4,1 3,0 0,0',
  C: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1',
  D: '0,0 0,6 2,6 4,4 4,2 2,0 0,0',
  E: '4,6 0,6 0,0 4,0;0,3 3,3',
  F: '4,6 0,6 0,0;0,3 3,3',
  G: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,3 2,3',
  H: '0,0 0,6;4,0 4,6;0,3 4,3',
  I: '1,6 3,6;2,6 2,0;1,0 3,0',
  J: '4,6 4,1 3,0 1,0 0,1',
  K: '0,0 0,6;4,6 0,2;1.5,3.2 4,0',
  L: '0,6 0,0 4,0',
  M: '0,0 0,6 2,3 4,6 4,0',
  N: '0,0 0,6 4,0 4,6',
  O: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0',
  P: '0,0 0,6 3,6 4,5 4,4 3,3 0,3',
  Q: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0;2,2 4,0',
  R: '0,0 0,6 3,6 4,5 4,4 3,3 0,3;2,3 4,0',
  S: '4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1',
  T: '0,6 4,6;2,6 2,0',
  U: '0,6 0,1 1,0 3,0 4,1 4,6',
  V: '0,6 2,0 4,6',
  W: '0,6 1,0 2,3 3,0 4,6',
  X: '0,0 4,6;0,6 4,0',
  Y: '0,6 2,3 4,6;2,3 2,0',
  Z: '0,6 4,6 0,0 4,0',
  '0': '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0;1,1 3,5',
  '1': '1,5 2,6 2,0;1,0 3,0',
  '2': '0,5 1,6 3,6 4,5 4,4 0,0 4,0',
  '3': '0,5 1,6 3,6 4,5 4,4 3,3 1.5,3;3,3 4,2 4,1 3,0 1,0 0,1',
  '4': '3,0 3,6 0,2 4,2',
  '5': '4,6 0,6 0,3 3,3 4,2 4,1 3,0 1,0 0,1',
  '6': '3,6 1,6 0,5 0,1 1,0 3,0 4,1 4,2 3,3 0,3',
  '7': '0,6 4,6 1.5,0',
  '8': '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3',
  '9': '1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,4 1,3 4,3',
  '-': '0,3 4,3',
  '.': '2,0 2,0.3',
  ',': '2,0.6 1.5,-1',
  ':': '2,1 2,1.3;2,4 2,4.3',
  '!': '2,6 2,2;2,0 2,0.3',
  '?': '0,5 1,6 3,6 4,5 4,4 2,3 2,2;2,0 2,0.3',
  '/': '0,0 4,6',
  '+': '0,3 4,3;2,1 2,5',
  '_': '0,0 4,0',
  '(': '3,6 1,4 1,2 3,0',
  ')': '1,6 3,4 3,2 1,0',
  "'": '2,6 2,4',
  '#': '1,0 1,6;3,0 3,6;0,2 4,2;0,4 4,4',
  // Cyrillic look-alikes reuse the Latin shapes.
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'У': 'Y', 'І': 'I',
  'Б': '4,6 0,6 0,0 3,0 4,1 4,2 3,3 0,3',
  'Г': '4,6 0,6 0,0',
  'Ґ': '0,0 0,6 3,6 3,7.5',
  'Д': '0,-1 0,0 4,0 4,-1;0.8,0 1.2,6 3.5,6 3.5,0',
  'Ж': '0,6 2,3 0,0;4,6 2,3 4,0;2,6 2,0',
  'З': '0,5 1,6 3,6 4,5 4,4 3,3 1.5,3;3,3 4,2 4,1 3,0 1,0 0,1',
  'И': '0,0 0,6;4,0 4,6;0,0 4,6',
  'Й': '0,0 0,6;4,0 4,6;0,0 4,6;1,7.8 2,7 3,7.8',
  'Л': '0,0 1.5,1 2,6 4,6 4,0',
  'П': '0,0 0,6 4,6 4,0',
  'Ф': '2,0 2,6;1,1 0,2 0,4 1,5 3,5 4,4 4,2 3,1 1,1',
  'Ц': '0,6 0,0 4,0 4,6;4,0 4,-1',
  'Ч': '0,6 0,4 1,3 4,3;4,6 4,0',
  'Ш': '0,6 0,0 4,0 4,6;2,6 2,0',
  'Щ': '0,6 0,0 4,0 4,6;2,6 2,0;4,0 4,-1',
  'Ъ': '0,6 1,6 1,0 3,0 4,1 4,2 3,3 1,3',
  'Ы': '0,6 0,0 2,0 3,1 3,2 2,3 0,3;4,0 4,6',
  'Ь': '0,6 0,0 3,0 4,1 4,2 3,3 0,3',
  'Э': '0,5 1,6 3,6 4,5 4,1 3,0 1,0 0,1;1,3 4,3',
  'Ю': '0,6 0,0;0,3 1.5,3;1.5,5 2.5,6 3.5,6 4,5 4,1 3.5,0 2.5,0 1.5,1 1.5,5',
  'Я': '4,0 4,6 1,6 0,5 0,4 1,3 4,3;1,3 0,0',
  'Є': '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1;0,3 3,3',
  'Ї': '1,6 3,6;2,6 2,0;1,0 3,0;1,7.5 1,7.6;3,7.5 3,7.6',
}

const cache = new Map<string, Pt[][]>()

function glyph(ch: string): Pt[][] | null {
  let def = G[ch]
  if (def === undefined) return null
  if (G[def] !== undefined && def.length === 1) def = G[def]
  let g = cache.get(ch)
  if (!g) {
    g = def.split(';').map((line) => line.split(' ').map((p) => p.split(',').map(Number) as Pt))
    cache.set(ch, g)
  }
  return g
}

export interface TextOptions {
  /** Cap height in mm. */
  size: number
  /** Maximum total width in mm; the text is scaled down to fit. */
  maxWidth?: number
}

/** Width of the text at the given cap height (mm). */
export function textWidth(text: string, size: number): number {
  const n = [...text].length
  if (n === 0) return 0
  return ((n * 6 - 2) * size) / 6
}

/**
 * Converts text to open polylines (mm) centred on the origin. Unknown characters leave a gap.
 * Letters are upper-cased because the font has capitals only.
 */
export function textStrokes(text: string, opts: TextOptions): Pt[][] {
  const chars = [...text.toUpperCase()]
  if (chars.length === 0) return []
  let size = opts.size
  if (opts.maxWidth && textWidth(text, size) > opts.maxWidth) size = (opts.maxWidth * 6) / (chars.length * 6 - 2)
  const k = size / 6
  const total = (chars.length * 6 - 2) * k
  const out: Pt[][] = []
  chars.forEach((ch, i) => {
    const g = glyph(ch)
    if (!g) return
    for (const line of g) out.push(line.map(([x, y]) => [-total / 2 + (i * 6 + x) * k, (y - 3) * k]))
  })
  return out
}
