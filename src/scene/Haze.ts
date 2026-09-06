import * as THREE from 'three'
import type { Formation } from '../formations/types'
import { HAZE_COLOR } from '../config/palette'
import vertGlsl from '../shaders/haze.vert.glsl?raw'
import fragGlsl from '../shaders/haze.frag.glsl?raw'

/**
 * Faint dust that follows the stars. A few thousand large soft sprites,
 * sampled from the same formation so the haze morphs with the field.
 *
 * Draw calls: 1.
 */
export class Haze {
  readonly points: THREE.Points
  readonly material: THREE.ShaderMaterial
  private readonly posA: THREE.BufferAttribute
  private readonly posB: THREE.BufferAttribute
  private readonly geometry: THREE.BufferGeometry

  constructor(readonly count: number, pixelRatio: number, texture: THREE.Texture) {
    const g = new THREE.BufferGeometry()
    this.geometry = g
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    this.posA = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.posB = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.posA.setUsage(THREE.DynamicDrawUsage)
    this.posB.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aPosA', this.posA)
    g.setAttribute('aPosB', this.posB)

    const size = new Float32Array(count)
    const seed = new Float32Array(count)
    let s = 777
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
    for (let i = 0; i < count; i++) {
      size[i] = 0.25 + rand() * 0.4
      seed[i] = rand()
    }
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertGlsl,
      fragmentShader: fragGlsl,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uProjScale: { value: 1000 },
        uSpinA: { value: 0 },
        uSpinB: { value: 0 },
        uMap: { value: texture },
        uColor: { value: new THREE.Color(HAZE_COLOR) },
        uOpacity: { value: 0.11 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })
    this.points = new THREE.Points(g, this.material)
    this.points.frustumCulled = false
    // Haze renders before the stars so the additive stars sit on top.
    this.points.renderOrder = -1
  }

  /** Sample `count` positions from a formation, spread by every k-th particle. */
  setFormation(slot: 'A' | 'B', f: Formation): void {
    const target = (slot === 'A' ? this.posA : this.posB).array as Float32Array
    // Walk the formation with a fixed stride, skipping the dense centre where
    // the stars already sum to white and dust would only add a blue wash.
    const stride = Math.max(1, Math.floor(f.count / (this.count * 2)))
    let j = 0
    for (let i = 0; i < this.count; i++) {
      let tries = 0
      let x = 0
      let y = 0
      let z = 0
      do {
        j = (j + stride) % f.count
        x = f.position[j * 3]
        y = f.position[j * 3 + 1]
        z = f.position[j * 3 + 2]
        tries++
      } while (x * x + y * y + z * z < 1.2 && tries < 8)
      target[i * 3] = x
      target[i * 3 + 1] = y
      target[i * 3 + 2] = z
    }
    ;(slot === 'A' ? this.posA : this.posB).needsUpdate = true
  }

  promoteBToA(): void {
    ;(this.posA.array as Float32Array).set(this.posB.array as Float32Array)
    this.posA.needsUpdate = true
  }

  setViewport(heightPx: number, fovDeg: number, pixelRatio: number): void {
    this.material.uniforms.uPixelRatio.value = pixelRatio
    this.material.uniforms.uProjScale.value = (pixelRatio * heightPx) / (2 * Math.tan((fovDeg * Math.PI) / 360))
  }

  update(time: number, progress: number, spinA: number, spinB: number): void {
    const u = this.material.uniforms
    u.uTime.value = time
    u.uProgress.value = progress
    u.uSpinA.value = spinA
    u.uSpinB.value = spinB
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
