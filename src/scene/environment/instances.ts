import * as THREE from 'three'

/** Fixed-capacity batches avoid React updates and GPU allocations during a run. */
export class Instances {
  readonly mesh: THREE.InstancedMesh
  private readonly pose = new THREE.Object3D()
  private next = 0

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, capacity: number) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  place(x: number, y: number, z: number, sx: number, sy = sx, sz = sx, yaw = 0, bank = 0) {
    if (this.next >= this.mesh.instanceMatrix.count) return
    this.pose.position.set(x, y, z)
    this.pose.scale.set(sx, sy, sz)
    this.pose.rotation.set(0, yaw, bank, 'YXZ')
    this.pose.updateMatrix()
    this.mesh.setMatrixAt(this.next++, this.pose.matrix)
  }

  finish() {
    this.mesh.count = this.next
    this.mesh.instanceMatrix.needsUpdate = true
    this.next = 0
  }
}
