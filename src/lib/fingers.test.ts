import { describe, expect, it } from 'vitest'
import { fingerLayout, fingerSegs, mergeSegs, plateFromEdges, straight, totalLen } from './fingers'
import { bboxOf, offsetPolygon, rect, signedArea } from './geom'

describe('fingerLayout', () => {
  it('uses an odd number of equal fingers close to the wanted width', () => {
    expect(fingerLayout(105, 3, 15)).toEqual({ n: 7, width: 15 })
    const l = fingerLayout(100, 3, 10)
    expect(l.n % 2).toBe(1)
    expect(l.n * l.width).toBeCloseTo(100)
    expect(Math.abs(l.width - 10)).toBeLessThan(1.2)
  })
  it('picks a sensible automatic width', () => {
    const l = fingerLayout(100, 3)
    expect(l.n).toBe(7)
    expect(l.width).toBeGreaterThanOrEqual(6)
    expect(fingerLayout(40, 3).n).toBe(7)
  })
  it('never makes fingers narrower than the thickness', () => {
    for (const len of [7, 10, 20, 33]) {
      const l = fingerLayout(len, 3, 1)
      expect(l.width).toBeGreaterThanOrEqual(3 - 1e-9)
      expect(l.n % 2).toBe(1)
    }
    expect(fingerLayout(5, 3, 2).n).toBe(1)
  })
})

describe('fingerSegs', () => {
  it('tab and notch edges are exact complements', () => {
    const lay = fingerLayout(90, 3, 9)
    const a = fingerSegs(lay, 'tab', 3)
    const b = fingerSegs(lay, 'notch', 3)
    expect(a.length).toBe(lay.n)
    a.forEach((s, i) => expect(s.v + b[i].v).toBe(3))
    expect(a.filter((s) => s.v === 0).length).toBe((lay.n + 1) / 2)
    expect(b.filter((s) => s.v === 0).length).toBe((lay.n - 1) / 2)
    expect(totalLen(a)).toBeCloseTo(90)
  })
  it('mergeSegs joins neighbours', () => {
    expect(mergeSegs([{ len: 1, v: 0 }, { len: 2, v: 0 }, { len: 0, v: 5 }, { len: 1, v: 3 }])).toEqual([
      { len: 3, v: 0 },
      { len: 1, v: 3 },
    ])
  })
})

describe('plateFromEdges', () => {
  it('builds a plain rectangle from straight edges', () => {
    const p = plateFromEdges(40, 20, straight(40), straight(20), straight(40), straight(20))
    expect(p.length).toBe(4)
    expect(bboxOf([p])).toEqual({ minX: 0, minY: 0, maxX: 40, maxY: 20 })
    expect(signedArea(p)).toBeCloseTo(800)
  })
  it('keeps the bounding box when edges have tabs and loses area for notches', () => {
    const t = 3
    const tabs = (L: number) => fingerSegs(fingerLayout(L, t, 10), 'tab', t)
    const notches = (L: number) => fingerSegs(fingerLayout(L, t, 10), 'notch', t)
    const a = plateFromEdges(60, 40, tabs(60), tabs(40), tabs(60), tabs(40))
    const b = plateFromEdges(60, 40, notches(60), notches(40), notches(60), notches(40))
    expect(bboxOf([a])).toEqual({ minX: 0, minY: 0, maxX: 60, maxY: 40 })
    expect(signedArea(a)).toBeLessThan(2400)
    expect(signedArea(a)).toBeGreaterThan(signedArea(b))
  })
})

describe('offsetPolygon', () => {
  it('grows and shrinks a rectangle by the offset on every side', () => {
    const r = rect(0, 0, 10, 6)
    expect(bboxOf([offsetPolygon(r, 0.5)])).toEqual({ minX: -0.5, minY: -0.5, maxX: 10.5, maxY: 6.5 })
    expect(bboxOf([offsetPolygon(r, -0.5)])).toEqual({ minX: 0.5, minY: 0.5, maxX: 9.5, maxY: 5.5 })
  })
  it('does not depend on the winding', () => {
    const cw = rect(0, 0, 10, 6).reverse()
    expect(bboxOf([offsetPolygon(cw, 1)])).toEqual({ minX: -1, minY: -1, maxX: 11, maxY: 7 })
  })
})
