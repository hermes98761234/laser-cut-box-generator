import { useMemo } from 'react'
import { placePoints, type Placed } from '../lib/layout'
import type { Pt } from '../lib/geom'
import type { T } from '../i18n'

const d = (pts: Pt[], close: boolean) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${+x.toFixed(3)} ${+y.toFixed(3)}`).join('') + (close ? 'Z' : '')

type Props = {
  placed: Placed[]
  sheetW: number
  sheetH: number
  oversize: string[]
  t: T
}

/** The cutting sheet: cut lines red, engraving blue, drawn at true scale (1 unit = 1 mm). */
export default function SheetView({ placed, sheetW, sheetH, oversize, t }: Props) {
  const parts = useMemo(
    () =>
      placed.map((pl) => ({
        id: pl.part.id,
        name: t(pl.part.name, ...pl.part.nameArgs),
        fill: [pl.part.outline, ...pl.part.holes].map((c) => d(placePoints(pl, c), true)).join(''),
        slits: pl.part.slits.map((l) => d(placePoints(pl, l), false)).join(''),
        engrave: pl.part.engrave.map((l) => d(placePoints(pl, l), false)).join(''),
        cx: pl.x + pl.w / 2,
        cy: pl.y + pl.h / 2,
        w: pl.w,
        h: pl.h,
        engraved: pl.part.engrave.length > 0,
      })),
    [placed, t],
  )
  const fs = Math.max(2.2, Math.min(sheetW, sheetH) / 70)
  return (
    <svg className="sheet" viewBox={`0 0 ${sheetW} ${sheetH}`} role="img" aria-label={t('Cutting sheet layout')} preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width={sheetW} height={sheetH} className="sheet-bg" />
      {parts.map((p) => (
        <g key={p.id}>
          <path d={p.fill} fillRule="evenodd" className={oversize.includes(p.id) ? 'cut-shape over' : 'cut-shape'} />
          {p.slits && <path d={p.slits} className="cut-line" />}
          {p.engrave && <path d={p.engrave} className="engrave-line" />}
          {!p.engraved && p.name.length * fs * 0.6 < p.w && fs * 1.5 < p.h && (
            <text x={p.cx} y={p.cy} fontSize={fs} textAnchor="middle" className="part-label">
              {p.name}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
