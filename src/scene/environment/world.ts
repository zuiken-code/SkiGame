import * as THREE from 'three'
import {
  COURSE_HALF_WIDTH,
  RIVAL_FALL_TIME,
  courseCenter,
  isInvulnerable,
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
import { createBoostToken, createJumpRamp } from '../models/courseFeatures'
import { createProtectionBarrier } from '../models/protectionBarrier'
import { createReachArms, createSkier } from '../models/skier'
import { RIVAL_SCALE, armExtension } from '../../game/reach'
import { GLIDE_DURATION, playerHeight, smoothstep } from '../../game/features'
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
  const boostTokens = new Instances(createBoostToken(), colorMaterial, 8)
  const ramps = new Instances(createJumpRamp(), colorMaterial, 8)
  const poles = new Instances(createCoursePole(), colorMaterial, 52)
  const nets = new Instances(createNetPanel(), colorMaterial, 40)
  const forestShadows = new Instances(shadowShape, shadowMaterial, 135)
  const actionShadows = new Instances(shadowShape, shadowMaterial, 96)
  const rivals = new Instances(createSkier(true), colorMaterial, 16)
  const grabbingSkis = new Instances(createSkier(true, 'skis'), colorMaterial, 16)
  const grabbingTorso = new Instances(createSkier(true, 'torso'), colorMaterial, 16)
  const grabbingArms = new Instances(createReachArms(), colorMaterial, 16)
  const skier = new THREE.Mesh(createSkier(), colorMaterial)
  const protectionBarrier = createProtectionBarrier()
  scenery.add(forest.mesh, poles.mesh, nets.mesh, forestShadows.mesh)
  group.add(
    coursePines.mesh,
    rocks.mesh,
    boostTokens.mesh,
    ramps.mesh,
    actionShadows.mesh,
    rivals.mesh,
    grabbingSkis.mesh,
    grabbingTorso.mesh,
    grabbingArms.mesh,
    skier,
    protectionBarrier,
  )
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
    for (const feature of state.features) {
      const z = state.distance - feature.distance
      if (feature.kind === 'boost') {
        const spin = state.elapsed * 2.9 + feature.distance
        boostTokens.place(feature.x, 0.99 + Math.sin(spin * 1.5) * 0.12, z, 1, 1, 1, spin)
        actionShadows.place(feature.x, 0.059, z, 0.56, 1, 0.47)
      } else {
        ramps.place(feature.x, 0.041, z, 1, 1, 1, -feature.heading)
      }
    }
    boostTokens.finish()
    ramps.finish()
    for (const rival of state.enemies) {
      const z = state.distance - rival.distance
      if (z > 22) continue
      const fall =
        rival.fallTimer > 0
          ? Math.min(1, (RIVAL_FALL_TIME - rival.fallTimer) * 10, rival.fallTimer * 6)
          : 0
      if (rival.reachTimer > 0) {
        const aim = Math.atan2(-rival.reachX, rival.reachDownhill)
        grabbingSkis.place(
          rival.x,
          0.065,
          z,
          RIVAL_SCALE,
          RIVAL_SCALE,
          RIVAL_SCALE,
          -rival.lean * 0.28,
        )
        grabbingTorso.place(rival.x, 0.065, z, RIVAL_SCALE, RIVAL_SCALE, RIVAL_SCALE, aim)
        grabbingArms.place(
          rival.x,
          0.065,
          z,
          RIVAL_SCALE,
          RIVAL_SCALE,
          RIVAL_SCALE * armExtension(rival.reachTimer),
          aim,
        )
      } else {
        const yaw = -rival.lean * 0.4 + fall * rival.fallSide * 0.86
        const bank = -rival.lean * 0.25 + fall * rival.fallSide * 1.42
        rivals.place(
          rival.x,
          0.065 + fall * 0.15,
          z,
          RIVAL_SCALE,
          RIVAL_SCALE,
          RIVAL_SCALE,
          yaw,
          bank,
        )
      }
      actionShadows.place(rival.x + 0.19, 0.065, z + 0.21, 0.38, 1, 0.75, -0.28)
    }
    rivals.finish()
    grabbingSkis.finish()
    grabbingTorso.finish()
    grabbingArms.finish()
    const { glideRemaining } = state
    const rise = playerHeight(glideRemaining, state.x, state.distance, state.features)
    const glidePitch = glideRemaining > 0
      ? 0.19 * (1 - smoothstep((GLIDE_DURATION - glideRemaining) / 0.52)) -
        0.16 * (1 - smoothstep(glideRemaining / 0.8)) * smoothstep(glideRemaining / 0.18)
      : 0
    skier.position.set(state.x, 0.055 + rise, 0)
    skier.scale.setScalar(0.78)
    skier.rotation.set(glidePitch, -state.lean * 0.43, -state.lean * 0.28, 'YXZ')
    protectionBarrier.visible = isInvulnerable(state)
    if (protectionBarrier.visible) {
      protectionBarrier.position.set(state.x, 0.8 + rise, 0)
      protectionBarrier.material.uniforms.time.value = state.elapsed
    }
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
    camera.position.y = (portrait ? 11.8 : 11.4) + rise * 0.62
    camera.position.z = portrait ? 21 : 21.2
    lookAt.set(THREE.MathUtils.lerp(lookAt.x, aimX, smooth), 0.8 + rise * 0.68, -2.4)
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
