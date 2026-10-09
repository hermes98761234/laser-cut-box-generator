import { useEffect, useRef, useState } from 'react'
import type { BufferGeometry, Group } from 'three'
import type { Dims, PlateSolid, Solid } from '../lib/types'
import { bandPoint, bandLayout } from '../lib/rounded'
import type { T } from '../i18n'

type Props = { solids: Solid[]; dims: Dims; explode: number; theme: string; t: T }

type Three = typeof import('three')

interface Scene {
  THREE: Three
  render: () => void
  setExplode: (k: number) => void
  dispose: () => void
}

function plateMesh(THREE: Three, s: PlateSolid) {
  const shape = new THREE.Shape(s.outline.map(([x, y]) => new THREE.Vector2(x, y)))
  for (const h of s.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
  const geo = new THREE.ExtrudeGeometry(shape, { depth: s.t, bevelEnabled: false })
  const n = new THREE.Vector3().crossVectors(new THREE.Vector3(...s.u), new THREE.Vector3(...s.v))
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...s.u), new THREE.Vector3(...s.v), n)
  m.setPosition(...s.o)
  return { geo, m }
}

function bandGeometry(THREE: Three, s: Extract<Solid, { kind: 'band' }>) {
  const N = 240
  const pos: number[] = []
  const idx: number[] = []
  const L = bandLayout(s.W, s.D, s.r, s.t)
  const ring = (offset: number, z: number) => {
    const base = pos.length / 3
    for (let i = 0; i <= N; i++) {
      const p = bandPoint(s.W, s.D, s.r, s.t, (L.P * i) / N)
      pos.push(p.x + p.nx * offset, p.y + p.ny * offset, z)
    }
    return base
  }
  const quad = (a: number, b: number, flip: boolean) => {
    for (let i = 0; i < N; i++) {
      const [p, q, r, u] = [a + i, a + i + 1, b + i, b + i + 1]
      if (flip) idx.push(p, r, q, q, r, u)
      else idx.push(p, q, r, q, u, r)
    }
  }
  const h = s.t / 2
  const oLo = ring(h, s.z0)
  const oHi = ring(h, s.z1)
  const iLo = ring(-h, s.z0)
  const iHi = ring(-h, s.z1)
  quad(oLo, oHi, false)
  quad(iLo, iHi, true)
  quad(oHi, iHi, false)
  quad(oLo, iLo, true)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

async function createScene(el: HTMLElement, solids: Solid[], dims: Dims, explode: number): Promise<Scene> {
  const THREE = await import('three')
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  el.appendChild(renderer.domElement)
  const css = getComputedStyle(el)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(css.getPropertyValue('--chart-bg').trim() || '#ffffff')
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  sun.position.set(dims.W, -dims.D * 1.5, dims.H * 3)
  scene.add(sun)

  const size = Math.max(dims.W, dims.D, dims.H)
  const camera = new THREE.PerspectiveCamera(40, 1, size / 50, size * 30)
  camera.up.set(0, 0, 1)
  const target = new THREE.Vector3(dims.W / 2, dims.D / 2, dims.H / 2)
  camera.position.set(dims.W / 2 + size * 1.5, dims.D / 2 - size * 1.7, dims.H / 2 + size * 1.2)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(target)
  controls.enableDamping = true
  controls.update()

  const woods = [0xd9b382, 0xcfa56c, 0xe0be8e, 0xc99b62]
  const mats = woods.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, side: THREE.DoubleSide }))
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x5b4327 })
  const pivots: { g: Group; out: [number, number, number] }[] = []
  const disposables: { dispose(): void }[] = [renderer, edgeMat, ...mats]
  solids.forEach((s, i) => {
    const pivot = new THREE.Group()
    let geo: BufferGeometry
    const mesh = new THREE.Mesh()
    if (s.kind === 'plate') {
      const pm = plateMesh(THREE, s)
      geo = pm.geo
      mesh.matrixAutoUpdate = false
      mesh.matrix.copy(pm.m)
    } else {
      geo = bandGeometry(THREE, s)
    }
    mesh.geometry = geo
    mesh.material = mats[i % mats.length]
    pivot.add(mesh)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat)
    if (s.kind === 'plate') {
      edges.matrixAutoUpdate = false
      edges.matrix.copy(mesh.matrix)
    }
    pivot.add(edges)
    disposables.push(geo, edges.geometry)
    scene.add(pivot)
    pivots.push({ g: pivot, out: s.out })
  })

  const setExplode = (k: number) => {
    const d = size * 0.6 * k
    for (const p of pivots) p.g.position.set(p.out[0] * d, p.out[1] * d, p.out[2] * d)
  }
  setExplode(explode)

  const resize = () => {
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    renderer.setSize(w, h, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(el)
  let raf = 0
  let alive = true
  const render = () => {
    controls.update()
    renderer.render(scene, camera)
  }
  const loop = () => {
    if (!alive) return
    render()
    raf = requestAnimationFrame(loop)
  }
  loop()
  return {
    THREE,
    render,
    setExplode,
    dispose: () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.domElement.remove()
    },
  }
}

/** Folded 3D preview with an explode slider, loaded on demand (three.js is a separate chunk). */
export default function Preview3D({ solids, dims, explode, theme, t }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<Scene | null>(null)
  const [failed, setFailed] = useState(false)
  const explodeRef = useRef(explode)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let cancelled = false
    let created: Scene | null = null
    setFailed(false)
    createScene(el, solids, dims, explodeRef.current)
      .then((s) => {
        if (cancelled) s.dispose()
        else {
          created = s
          scene.current = s
        }
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      created?.dispose()
      scene.current = null
    }
  }, [solids, dims, theme])

  useEffect(() => {
    explodeRef.current = explode
    scene.current?.setExplode(explode)
  }, [explode])

  return (
    <div className="scene-canvas" ref={host} role="img" aria-label={t('3D preview of the assembled box')}>
      {failed && <div className="scene-msg">{t('3D preview needs WebGL, which is not available here.')}</div>}
    </div>
  )
}
