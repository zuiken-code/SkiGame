import * as THREE from 'three'
import {
  COURSE_HALF_WIDTH,
  RIVAL_FALL_TIME,
  courseCenter,
  type GameState,
} from '../../game/simulation'
import {
  createCoursePole,
  createNetPanel,
  createPine,
  createRidge,
  createRock,
} from '../models/courseObjects'
import { noise } from '../models/geometry'
import { createSkier } from '../models/skier'
import { Instances } from './instances'
import { createPiste } from './piste'
import { createTracks } from './tracks'

function createShadowMaterial() {
  const size = 32
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(((x + 0.5) * 2) / size - 1, ((y + 0.5) * 2) / size - 1)
      const i = (y * size + x) * 4
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255
      pixels[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (1 - r) * 4)))
    }
  }
  const map = new THREE.DataTexture(pixels, size, size)
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return new THREE.MeshBasicMaterial({
    color: '#668aab',
    transparent: true,
    opacity: 0.26,
    map,
    depthWrite: false,
  })
}

function createBackdrop() {
  const group = new THREE.Group()
  const skyGeometry = new THREE.PlaneGeometry(710, 240)
  const skyColors = new Float32Array(12)
  const top = new THREE.Color('#51bfe9')
  const bottom = new THREE.Color('#e6faff')
  for (let v = 0; v < 4; v++) (v < 2 ? top : bottom).toArray(skyColors, v * 3)
  skyGeometry.setAttribute('color', new THREE.BufferAttribute(skyColors, 3))
  const sky = new THREE.Mesh(
    skyGeometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
  )
  sky.position.set(0, 50, -258)
  group.add(sky)

  const ridgeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
  group.add(
    new THREE.Mesh(createRidge(true), ridgeMaterial),
    new THREE.Mesh(createRidge(false), ridgeMaterial),
  )
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(5.6, 32),
    new THREE.MeshBasicMaterial({ color: '#fff5d9', fog: false }),
  )
  sun.position.set(-34, 30, -241)
  group.add(sun)
  return group
}

export function createWorld() {
  const group = new THREE.Group()
  const scenery = new THREE.Group()
  const backdrop = createBackdrop()
  const piste = createPiste()
  const tracks = createTracks()
  const terrain = new THREE.Mesh(
    new THREE.PlaneGeometry(650, 380).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#e0ecef' }),
  )
  terrain.position.set(0, -0.025, -75)
  group.add(terrain, backdrop, piste.mesh, tracks.mesh, scenery)

  const colorMaterial = new THREE.MeshLambertMaterial({ vertexColors: true })
  const shadowMaterial = createShadowMaterial()
  const shadowShape = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2)
  const pineGeometry = createPine()
  const forest = new Instances(pineGeometry, colorMaterial, 135)
  const coursePines = new Instances(pineGeometry, colorMaterial, 64)
  const rocks = new Instances(createRock(), colorMaterial, 64)
  const poles = new Instances(createCoursePole(), colorMaterial, 52)
  const nets = new Instances(createNetPanel(), colorMaterial, 40)
  const forestShadows = new Instances(shadowShape, shadowMaterial, 135)
  const actionShadows = new Instances(shadowShape, shadowMaterial, 96)
  const rivals = new Instances(createSkier(true), colorMaterial, 16)
  const slideRings = new Instances(
    new THREE.RingGeometry(0.74, 0.87, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#e5a200' }),
    16,
  )
  const skier = new THREE.Mesh(createSkier(), colorMaterial)
  scenery.add(forest.mesh, poles.mesh, nets.mesh, forestShadows.mesh)
  group.add(coursePines.mesh, rocks.mesh, actionShadows.mesh, slideRings.mesh, rivals.mesh, skier)
  const lookAt = new THREE.Vector3()
  let anchor = Infinity
  let previous: GameState | undefined
  let lastAspect = 0

  function updateSurroundings(distance: number) {
    const stride = 7.5
    const start = Math.floor(distance / stride) - 3
    if (start !== anchor) {
      anchor = start
      for (let index = start; index < start + 25; index++) {
        const d = index * stride
        const z = (start - index) * stride
        for (const side of [-1, 1]) {
          const key = 4 * index + side
          const sideX = courseCenter(d) + side * (COURSE_HALF_WIDTH + 0.37)
          poles.place(sideX, 0.04, z, 1)
          const netPhase = ((index % 9) + 9) % 9
          if ((side === -1 && netPhase < 4) || (side === 1 && netPhase > 4)) {
            const dx = courseCenter(d + stride) - courseCenter(d)
            nets.place(sideX, 0.05, z, 1, 1, Math.hypot(dx, stride), -Math.atan2(dx, stride))
          }
          for (let depth = 0; depth < 2; depth++) {
            const seed = key + depth * 102.73
            const treeDistance = d + (noise(seed + 11) - 0.5) * stride
            const treeX =
              courseCenter(treeDistance) +
              side * (COURSE_HALF_WIDTH + 4.1 + depth * 9 + noise(seed + 5) * 6)
            const s = 1 + noise(seed + 3) * (depth ? 1.48 : 1)
            const treeZ = start * stride - treeDistance
            forest.place(
              treeX,
              0,
              treeZ,
              s,
              s * (0.97 + noise(seed + 7) * 0.22),
              s,
              noise(seed + 9) * 6.28,
            )
            forestShadows.place(
              treeX + s * 0.45,
              0.018,
              treeZ + s * 0.36,
              s * 1.63,
              1,
              s * 1.04,
              -0.52,
            )
          }
        }
      }
      forest.finish()
      poles.finish()
      nets.finish()
      forestShadows.finish()
    }
    scenery.position.z = distance - start * stride
  }

  function update(
    state: GameState,
    camera: THREE.PerspectiveCamera,
    aspect: number,
    delta: number,
  ) {
    updateSurroundings(state.distance)
    piste.update(state.distance)
    tracks.update(state)
    for (const item of state.obstacles) {
      const z = state.distance - item.distance
      const yaw = noise(item.id + 115) * Math.PI * 2
      if (item.kind === 'pine') {
        const scale = item.radius / 1.09
        coursePines.place(item.x, 0.04, z, scale, scale * 1.18, scale, yaw)
      } else {
        rocks.place(item.x, 0.04, z, item.radius, item.radius, item.radius, yaw)
      }
      actionShadows.place(
        item.x + item.radius * 0.26,
        0.066,
        z + item.radius * 0.19,
        item.radius * 1.28,
        1,
        item.radius * 0.86,
        -0.52,
      )
    }
    coursePines.finish()
    rocks.finish()
    for (const rival of state.enemies) {
      const z = state.distance - rival.distance
      if (z > 22) continue
      const fall =
        rival.fallTimer > 0
          ? Math.min(1, (RIVAL_FALL_TIME - rival.fallTimer) * 10, rival.fallTimer * 6)
          : 0
      const sliding = rival.slideTimer > 0
      const yaw = -rival.lean * 0.4 + fall * rival.fallSide * 0.86 + (sliding ? 0.58 : 0)
      const bank = -rival.lean * 0.25 + fall * rival.fallSide * 1.42 - (sliding ? 0.48 : 0)
      rivals.place(rival.x, 0.065 + fall * 0.15, z, 0.76, sliding ? 0.57 : 0.76, 0.76, yaw, bank)
      if (sliding) {
        const pulse = 1.05 + Math.sin(state.elapsed * 15) * 0.09
        slideRings.place(rival.x, 0.078, z, pulse, 1, pulse * 1.22, yaw)
      }
      actionShadows.place(rival.x + 0.19, 0.065, z + 0.21, 0.38, 1, 0.75, -0.28)
    }
    rivals.finish()
    slideRings.finish()
    const hitWobble =
      state.slowTimer > 0 ? Math.min(0.12, state.slowTimer * 0.1) * Math.sin(state.elapsed * 23) : 0
    skier.position.set(state.x, 0.055, 0)
    skier.scale.setScalar(0.78)
    skier.rotation.set(0, -state.lean * 0.43, -state.lean * 0.28 + hitWobble, 'YXZ')
    actionShadows.place(state.x + 0.2, 0.065, 0.23, 0.4, 1, 0.78, -0.28 - state.lean * 0.21)
    actionShadows.finish()

    const portrait = aspect < 1
    if (lastAspect !== aspect) {
      camera.fov = portrait ? 70 : 55
      camera.updateProjectionMatrix()
      lastAspect = aspect
    }
    const smooth = previous === state ? 1 - Math.exp(-8 * Math.min(delta, 0.12)) : 1
    const center = courseCenter(state.distance)
    const aimX = state.x * 0.57 + courseCenter(state.distance + 13) * 0.43
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      state.x * 0.79 + center * 0.21,
      smooth,
    )
    camera.position.y = portrait ? 11.8 : 11.4
    camera.position.z = portrait ? 21 : 21.2
    lookAt.set(THREE.MathUtils.lerp(lookAt.x, aimX, smooth), 0.8, -2.4)
    camera.lookAt(lookAt)
    backdrop.position.x = camera.position.x * 0.75
    previous = state
  }

  function dispose() {
    const materials = new Set<THREE.Material>()
    const geometries = new Set<THREE.BufferGeometry>()
    group.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        geometries.add(node.geometry)
        for (const mat of Array.isArray(node.material) ? node.material : [node.material])
          materials.add(mat)
      }
      if (node instanceof THREE.InstancedMesh) node.dispose()
    })
    shadowMaterial.map?.dispose()
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
  }
  return { group, update, dispose }
}
