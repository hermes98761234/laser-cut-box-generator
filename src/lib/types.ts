import type { Pt } from './geom'

export type Vec3 = [number, number, number]

export type LidType = 'none' | 'closed' | 'sliding' | 'hinged' | 'lift-off'
export type BoxStyle = 'finger' | 'rounded'
export type LabelOn = 'front' | 'lid'

export interface BoxParams {
  style: BoxStyle
  /** Whether width/depth/height are inside or outside measures. */
  dimMode: 'inner' | 'outer'
  width: number
  depth: number
  height: number
  /** Material thickness. */
  thickness: number
  /** Width of material the laser removes. */
  kerf: number
  lid: LidType
  fingerAuto: boolean
  fingerWidth: number
  /** Dividers parallel to the front and back panels. */
  dividersAcross: number
  /** Dividers parallel to the side panels. */
  dividersAlong: number
  /** Outer corner radius of the rounded (living hinge) box. */
  cornerRadius: number
  /** Distance between slit lines of the living hinge. */
  hingeSpacing: number
  hingeSlit: number
  hingeBridge: number
  /** Width of the living hinge strip of a hinged lid. */
  hingeWidth: number
  /** Play between a lid and what it sits in. */
  lidClearance: number
  label: string
  labelSize: number
  labelOn: LabelOn
}

/** One flat piece to cut. All coordinates are in mm with the bounding box starting at (0, 0). */
export interface Part {
  id: string
  /** English name; `{0}` is replaced by the first of `nameArgs`. */
  name: string
  nameArgs: number[]
  /** Closed outer contour (counter-clockwise). */
  outline: Pt[]
  /** Closed inner cut-outs. */
  holes: Pt[][]
  /** Open cut lines (living hinge slits). */
  slits: Pt[][]
  /** Open engraved lines. */
  engrave: Pt[][]
  w: number
  h: number
}

export interface PlateSolid {
  kind: 'plate'
  id: string
  name: string
  nameArgs: number[]
  /** Nominal outline and holes in plate coordinates (u, v). */
  outline: Pt[]
  holes: Pt[][]
  /** World position of plate coordinate (0, 0). */
  o: Vec3
  u: Vec3
  v: Vec3
  /** Thickness extends along u x v. */
  t: number
  /** Unit direction used to explode the model. */
  out: Vec3
}

export interface BandSolid {
  kind: 'band'
  id: string
  name: string
  nameArgs: number[]
  W: number
  D: number
  r: number
  t: number
  z0: number
  z1: number
  out: Vec3
}

export type Solid = PlateSolid | BandSolid

export interface Dims {
  /** Outer size, including a lid that sits on top. */
  W: number
  D: number
  H: number
  /** Inner cavity. */
  Win: number
  Din: number
  Hin: number
  t: number
  /** Height of the walls (outer height without a lid that sits on top). */
  Hbody: number
  /** Height of the front panel; lower than Hbody for a sliding lid. */
  Hfront: number
  slotH: number
  rim: number
}

export interface BoxModel {
  dims: Dims
  /** Parts with kerf compensation applied. */
  parts: Part[]
  solids: Solid[]
  /** Translation keys for non-fatal problems. */
  warnings: string[]
}
