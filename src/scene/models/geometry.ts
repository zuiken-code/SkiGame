import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Point = [number, number, number]

/** Bake flat faces, transforms and a palette into one draw call per model. */
export class ModelBuilder {
  private parts: THREE.BufferGeometry[] = []

  add(
    source: THREE.BufferGeometry,
    color: string,
    position: Point,
    scale: Point = [1, 1, 1],
    rotation: Point = [0, 0, 0],
  ) {
    const part = source.index ? source.toNonIndexed() : source
    if (part !== source) source.dispose()
    part.deleteAttribute('uv')
    part.scale(...scale)
    part.rotateX(rotation[0])
    part.rotateY(rotation[1])
    part.rotateZ(rotation[2])
    part.translate(...position)
    part.computeVertexNormals()
    const tint = new THREE.Color(color)
    const colors = new Float32Array(part.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i)
    part.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.parts.push(part)
  }

  box(position: Point, size: Point, color: string, rotation: Point = [0, 0, 0]) {
    this.add(new THREE.BoxGeometry(1, 1, 1), color, position, size, rotation)
  }

  oval(position: Point, scale: Point, color: string, rotation: Point = [0, 0, 0]) {
    this.add(new THREE.SphereGeometry(1, 8, 6), color, position, scale, rotation)
  }

  rod(start: Point, end: Point, radius: number, color: string, endRadius = radius, sides = 6) {
    const from = new THREE.Vector3(...start)
    const to = new THREE.Vector3(...end)
    const direction = to.clone().sub(from)
    const shape = new THREE.CylinderGeometry(endRadius, radius, direction.length(), sides)
    const turn = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    )
    shape.applyQuaternion(turn)
    this.add(shape, color, from.lerp(to, 0.5).toArray() as Point)
  }

  finish() {
    const merged = mergeGeometries(this.parts)!
    for (const part of this.parts) part.dispose()
    return merged
  }
}

export function noise(key: number) {
  const n = Math.sin(key * 127.1 + 311.7) * 43758.5453
  return n - Math.floor(n)
}
