import * as THREE from 'three'

export interface CameraPose {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

/**
 * Scripted camera. M0 holds a single pose (chapter 1) with damped pointer
 * parallax. M1 adds per-chapter keyframes interpolated across the timeline;
 * M4 adds the Rest-phase drag orbit.
 */
export class Camera {
  readonly camera: THREE.PerspectiveCamera
  private pose: CameraPose
  private readonly pointer = new THREE.Vector2()
  private readonly pointerSmoothed = new THREE.Vector2()
  private parallaxEnabled: boolean
  private readonly tmpPos = new THREE.Vector3()
  private readonly tmpRight = new THREE.Vector3()
  private readonly tmpUp = new THREE.Vector3()
  private readonly tmpForward = new THREE.Vector3()

  constructor(aspect: number, pose: CameraPose) {
    this.camera = new THREE.PerspectiveCamera(pose.fov, aspect, 0.05, 400)
    this.pose = pose
    this.parallaxEnabled = !matchMedia('(prefers-reduced-motion: reduce)').matches && !matchMedia('(pointer: coarse)').matches
    if (this.parallaxEnabled) {
      addEventListener('pointermove', (e) => {
        this.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1))
      })
      addEventListener('pointerleave', () => this.pointer.set(0, 0))
    }
    this.apply(1)
  }

  setPose(pose: CameraPose): void {
    this.pose = pose
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  /** Call once per frame. `dt` in seconds. */
  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 2.5)
    this.pointerSmoothed.lerp(this.pointer, k)
    this.apply(k)
  }

  private apply(_k: number): void {
    const { position, target, fov } = this.pose
    // Parallax: rotate the eye ±2° around the target based on pointer position.
    const yaw = this.pointerSmoothed.x * THREE.MathUtils.degToRad(2)
    const pitch = this.pointerSmoothed.y * THREE.MathUtils.degToRad(1.4)

    this.tmpForward.subVectors(target, position).normalize()
    this.tmpRight.crossVectors(this.tmpForward, this.camera.up).normalize()
    this.tmpUp.crossVectors(this.tmpRight, this.tmpForward).normalize()
    const dist = position.distanceTo(target)
    this.tmpPos
      .copy(position)
      .addScaledVector(this.tmpRight, Math.sin(yaw) * dist)
      .addScaledVector(this.tmpUp, Math.sin(pitch) * dist)

    this.camera.position.copy(this.tmpPos)
    this.camera.lookAt(target)
    if (this.camera.fov !== fov) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
