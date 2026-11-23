import * as THREE from 'three'
import { ModelBuilder, noise } from './geometry'

export function createPine() {
  const model = new ModelBuilder()
  model.rod([0, 0, 0], [0, 1.52, 0], 0.17, '#644f4a', 0.1, 6)
  const tiers = [
    { base: 0.62, height: 1.93, radius: 1.17 },
    { base: 1.41, height: 1.72, radius: 0.95 },
    { base: 2.13, height: 1.45, radius: 0.68 },
  ]
  for (const [index, tier] of tiers.entries()) {
    const { base, height, radius } = tier
    const outer: THREE.Vector3[] = []
    const seam: THREE.Vector3[] = []
    const snow: number[] = []
    const needles: number[] = []
    const tip = new THREE.Vector3(-0.07 * index, base + height, 0.02)
    for (let i = 0; i < 12; i++) {
      const branch = i % 2 === 0
      const random = noise(i + index * 14)
      const angle = (i * Math.PI) / 6 + index * 0.52 + random * 0.08
      const reach = radius * (branch ? 0.98 + random * 0.08 : 0.72 + random * 0.09)
      const point = new THREE.Vector3(
        Math.sin(angle) * reach,
        base + (branch ? -0.06 : 0.18) * height,
        Math.cos(angle) * reach,
      )
      outer.push(point)
      seam.push(tip.clone().lerp(point, (branch ? 0.76 : 0.61) + random * 0.1))
    }
    for (let i = 0; i < outer.length; i++) {
      const next = (i + 1) % outer.length
      snow.push(...tip.toArray(), ...seam[i].toArray(), ...seam[next].toArray())
      needles.push(...seam[i].toArray(), ...outer[i].toArray(), ...outer[next].toArray())
      needles.push(...seam[i].toArray(), ...outer[next].toArray(), ...seam[next].toArray())
    }
    const crown = new THREE.BufferGeometry()
    crown.setAttribute('position', new THREE.Float32BufferAttribute(snow, 3))
    model.add(crown, '#eff8ff', [0, 0, 0])
    const boughs = new THREE.BufferGeometry()
    boughs.setAttribute('position', new THREE.Float32BufferAttribute(needles, 3))
    model.add(boughs, index ? '#325d60' : '#234e52', [0, 0, 0])
  }
  return model.finish()
}

export function createRock() {
  const model = new ModelBuilder()
  model.add(
    new THREE.IcosahedronGeometry(1, 0),
    '#646f83',
    [0, 0.35, 0],
    [1.15, 0.75, 0.86],
    [0.1, 0.2, -0.12],
  )
  model.add(
    new THREE.IcosahedronGeometry(1, 0),
    '#c1d4dc',
    [-0.08, 0.81, -0.05],
    [0.86, 0.3, 0.68],
    [0.1, 0.13, -0.1],
  )
  model.add(
    new THREE.IcosahedronGeometry(1, 0),
    '#7a8594',
    [0.62, 0.185, 0.3],
    [0.48, 0.4, 0.47],
    [0.3, 0.15, 0.25],
  )
  return model.finish()
}

export function createCoursePole() {
  const model = new ModelBuilder()
  model.rod([0, 0, 0], [0, 1.44, 0], 0.048, '#eb5537', 0.039)
  model.rod([0, 0.89, 0], [0, 1.12, 0], 0.048, '#ffefda', 0.042)
  model.box([0.07, 1.28, 0], [0.22, 0.27, 0.047], '#f46643')
  return model.finish()
}

/** A low, flexible net between two posts. Its local length is one along -Z. */
export function createNetPanel() {
  const model = new ModelBuilder()
  model.box([0, 0.88, -0.5], [0.032, 0.045, 1], '#e15e47')
  model.box([0, 0.29, -0.5], [0.027, 0.04, 1], '#d96851')
  model.box([0, 0.57, -0.5], [0.023, 0.022, 1], '#e99871')
  for (let i = 0; i < 12; i++) {
    model.box([0, 0.59, -(i + 0.5) / 12], [0.021, 0.58, 0.0035], '#ec9972')
  }
  return model.finish()
}

/** Faceted mountain chains with triangular snow fields and exposed rock faces. */
export function createRidge(distant: boolean) {
  const positions: number[] = []
  const colors: number[] = []
  const t = new THREE.Color()
  type Vertex = [number, number, number]
  const emit = (a: Vertex, b: Vertex, c: Vertex, color: string) => {
    positions.push(...a, ...b, ...c)
    t.set(color)
    for (let i = 0; i < 3; i++) colors.push(t.r, t.g, t.b)
  }
  const peaktops: Vertex[] = []
  const rocks: Vertex[] = []
  const feet: Vertex[] = []
  const width = distant ? 22 : 19
  const baseZ = distant ? -206 : -144
  for (let i = -11; i <= 11; i++) {
    const x = i * width
    const random = noise(i + (distant ? 493 : 303))
    const valley = Math.max(0.12, Math.min(1, Math.abs(x + (distant ? 9 : 2)) / 68))
    const height = (distant ? 12 : 5) + valley * (distant ? 30 : 23) + random * (distant ? 22 : 19)
    peaktops.push([x, height, baseZ - random * 14])
    rocks.push([
      x + width * (0.05 + 0.4 * noise(i + 42)),
      height * (0.42 + random * 0.18),
      baseZ + 8 + random * 9,
    ])
    feet.push([x - width * 0.15, -3.3, baseZ + 18 + random * 12])
  }
  for (let i = 0; i < peaktops.length - 1; i++) {
    const uphill = peaktops[i][1] < peaktops[i + 1][1]
    emit(
      peaktops[i],
      peaktops[i + 1],
      rocks[i + 1],
      distant ? '#e9f4f8' : uphill ? '#eff7f6' : '#ccdfeb',
    )
    emit(peaktops[i], rocks[i + 1], rocks[i], distant ? '#d4e5ef' : uphill ? '#9db6cc' : '#b5cede')
    emit(rocks[i], rocks[i + 1], feet[i], distant ? '#cddfe9' : uphill ? '#99b6c9' : '#bad0dc')
    emit(rocks[i + 1], feet[i + 1], feet[i], distant ? '#d7e8ee' : '#d2e2e8')
  }
  const ridge = new THREE.BufferGeometry()
  ridge.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  ridge.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return ridge
}
