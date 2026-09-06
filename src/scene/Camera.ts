import * as THREE from 'three'

export interface CameraPose {
  position: THREE.Vector3
  target: THREE.Vector3
  fov: number
}

/**
 * Scripted camera. The timeline hands it a pose every frame (blended between
 * chapter poses during Arrival, drifting during the chapter); this class adds
 * damped pointer parallax on top. M4 adds the Rest-phase drag orbit.
 */
export class Camera {
  readonly camera: THREE.PerspectiveCamera
  private readonly pose: CameraPose
  private readonly pointer = new THREE.Vector2()
  private readonly pointerSmoothed = new THREE.Vector2()
  private readonly tmpPos = new THREE.Vector3()
  private readonly tmpRight = new THREE.Vector3()
  private readonly tmpUp = new THREE.Vector3()
  private readonly tmpForward = new THREE.Vector3()

  constructor(aspect: number, pose: CameraPose) {
    this.camera = new THREE.PerspectiveCamera(pose.fov, aspect, 0.05, 400)
    this.pose = { position: pose.position.clone(), target: pose.target.clone(), fov: pose.fov }
    const parallax = !matchMedia('(prefers-reduced-motion: reduce)').matches && !matchMedia('(pointer: coarse)').matches
    if (parallax) {
      addEventListener('pointermove', (e) => {
        this.pointer.set((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1))
      })
      addEventListener('pointerleave', () => this.pointer.set(0, 0))
    }
    this.apply()
  }

  /** Blend two poses into this camera's target pose, with an optional drift. */
  blendPose(from: CameraPose, to: CameraPose, k: number, drift?: THREE.Vector3, driftAmount = 0): void {
    this.pose.position.lerpVectors(from.position, to.position, k)
    this.pose.target.lerpVectors(from.target, to.target, k)
    this.pose.fov = from.fov + (to.fov - from.fov) * k
    if (drift) this.pose.position.addScaledVector(drift, driftAmount)
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  /** Call once per frame after blendPose. `dt` in seconds. */
  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 2.5)
    this.pointerSmoothed.lerp(this.pointer, k)
    this.apply()
  }

  private apply(): void {
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
    if (Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
