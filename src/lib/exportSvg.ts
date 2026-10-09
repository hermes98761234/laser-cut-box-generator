import type { Pt } from './geom'
import { sheetShapes, type Placed } from './layout'

const fmt = (n: number) => String(+n.toFixed(3))

function path(pts: Pt[], close: boolean): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join('') + (close ? 'Z' : '')
}

export const CUT_COLOR = '#ff0000'
export const ENGRAVE_COLOR = '#0000ff'
export const HAIRLINE = 0.01

/** SVG for one sheet in millimetres: cut lines red, engraving blue, both 0.01 mm hairlines. */
export function sheetToSvg(placed: Placed[], sheetW: number, sheetH: number): string {
  const s = sheetShapes(placed)
  const cut = [...s.closed.map((p) => path(p, true)), ...s.cutLines.map((p) => path(p, false))]
  const engrave = s.engrave.map((p) => path(p, false))
  const g = (id: string, color: string, paths: string[]) =>
    `  <g id="${id}" fill="none" stroke="${color}" stroke-width="${HAIRLINE}" stroke-linecap="round" stroke-linejoin="round">\n${paths.map((d) => `    <path d="${d}"/>`).join('\n')}\n  </g>`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(sheetW)}mm" height="${fmt(sheetH)}mm" viewBox="0 0 ${fmt(sheetW)} ${fmt(sheetH)}">`,
    g('cut', CUT_COLOR, cut),
    g('engrave', ENGRAVE_COLOR, engrave),
    '</svg>',
    '',
  ].join('\n')
}
