import * as THREE from 'three'
import type { Formation } from '../formations/types'
import { HERO_COUNT } from '../formations/types'
import { pickStarType, STAR_COLOR_TABLE, STAR_SIZE_TABLE } from '../config/palette'
import noiseGlsl from '../shaders/noise.glsl?raw'
import vertGlsl from '../shaders/particles.vert.glsl?raw'
import fragGlsl from '../shaders/particles.frag.glsl?raw'

/**
 * The one persistent star field. Every chapter is a pair of target buffers
 * (slot A, slot B) that the shader blends between with `uProgress`.
 *
 * Draw calls: 1.
 */
export class Particles {
  readonly points: THREE.Points
  readonly material: THREE.ShaderMaterial
  private readonly geometry: THREE.BufferGeometry
  private readonly posA: THREE.BufferAttribute
  private readonly posB: THREE.BufferAttribute
  private readonly brightA: THREE.BufferAttribute
  private readonly brightB: THREE.BufferAttribute
  private readonly flowA: THREE.BufferAttribute
  private readonly flowB: THREE.BufferAttribute
  private spinRateA = 0
  private spinRateB = 0

  constructor(readonly count: number, pixelRatio: number) {
    const g = new THREE.BufferGeometry()
    this.geometry = g

    // Points need a `position` attribute for frustum culling and bounds; we
    // disable culling and drive real positions from aPosA/aPosB instead.
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))

    this.posA = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.posB = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.brightA = new THREE.BufferAttribute(new Float32Array(count), 1)
    this.brightB = new THREE.BufferAttribute(new Float32Array(count), 1)
    this.flowA = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    this.flowB = new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    for (const a of [this.posA, this.posB, this.brightA, this.brightB, this.flowA, this.flowB]) {
      a.setUsage(THREE.DynamicDrawUsage)
    }
    g.setAttribute('aPosA', this.posA)
    g.setAttribute('aPosB', this.posB)
    g.setAttribute('aBrightA', this.brightA)
    g.setAttribute('aBrightB', this.brightB)
    g.setAttribute('aFlowA', this.flowA)
    g.setAttribute('aFlowB', this.flowB)

    // Static identity attributes.
    const type = new Float32Array(count)
    const seed = new Float32Array(count)
    const hero = new Float32Array(count)
    let s = 12345
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }
    for (let i = 0; i < count; i++) {
      type[i] = pickStarType(rand())
      seed[i] = rand()
      hero[i] = i < HERO_COUNT ? 1 : 0
    }
    // Heroes are always one of the two brightest, bluest-white types.
    for (let i = 0; i < HERO_COUNT; i++) type[i] = 3 + (i % 2)
    g.setAttribute('aType', new THREE.BufferAttribute(type, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aHero', new THREE.BufferAttribute(hero, 1))

    const colorTable: THREE.Vector3[] = []
    for (let i = 0; i < 6; i++) {
      colorTable.push(new THREE.Vector3(STAR_COLOR_TABLE[i * 3], STAR_COLOR_TABLE[i * 3 + 1], STAR_COLOR_TABLE[i * 3 + 2]))
    }

    this.material = new THREE.ShaderMaterial({
      vertexShader: vertGlsl.replace('#include <noise>', noiseGlsl),
      fragmentShader: fragGlsl,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uProjScale: { value: 1000 },
        uSizeScale: { value: 0.024 },
        uSpinA: { value: 0 },
        uSpinB: { value: 0 },
        uArcAmp: { value: 0.35 },
        uDriftAmp: { value: 1 },
        // Dense regions sum additively, so brightness per star falls as count rises.
        uIntensity: { value: Math.min(1, 0.55 * Math.sqrt(60_000 / count)) },
        uColorTable: { value: colorTable },
        uSizeTable: { value: Array.from(STAR_SIZE_TABLE) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    })

    this.points = new THREE.Points(g, this.material)
    this.points.frustumCulled = false
  }

  /** Load a formation into slot A or B. */
  setFormation(slot: 'A' | 'B', f: Formation): void {
    if (f.count !== this.count) throw new Error(`Formation count ${f.count} ≠ particle count ${this.count}`)
    const pos = slot === 'A' ? this.posA : this.posB
    const bright = slot === 'A' ? this.brightA : this.brightB
    const flow = slot === 'A' ? this.flowA : this.flowB
    ;(pos.array as Float32Array).set(f.position)
    ;(bright.array as Float32Array).set(f.brightness)
    ;(flow.array as Float32Array).set(f.flow)
    pos.needsUpdate = true
    bright.needsUpdate = true
    flow.needsUpdate = true
    if (slot === 'A') this.spinRateA = f.spin
    else this.spinRateB = f.spin
  }

  /** Copy slot B into slot A (used when the timeline crosses a chapter). */
  promoteBToA(): void {
    ;(this.posA.array as Float32Array).set(this.posB.array as Float32Array)
    ;(this.brightA.array as Float32Array).set(this.brightB.array as Float32Array)
    ;(this.flowA.array as Float32Array).set(this.flowB.array as Float32Array)
    this.posA.needsUpdate = true
    this.brightA.needsUpdate = true
    this.flowA.needsUpdate = true
    this.spinRateA = this.spinRateB
  }

  set progress(v: number) {
    this.material.uniforms.uProgress.value = v
  }
  get progress(): number {
    return this.material.uniforms.uProgress.value as number
  }

  /**
   * Point sizes are projected from world units, so a star is the same
   * apparent size at any viewport size or pixel ratio.
   */
  setViewport(heightPx: number, fovDeg: number, pixelRatio: number): void {
    this.material.uniforms.uPixelRatio.value = pixelRatio
    this.material.uniforms.uProjScale.value = (pixelRatio * heightPx) / (2 * Math.tan((fovDeg * Math.PI) / 360))
  }

  setMotion(driftAmp: number, arcAmp: number): void {
    this.material.uniforms.uDriftAmp.value = driftAmp
    this.material.uniforms.uArcAmp.value = arcAmp
  }

  update(time: number): void {
    const u = this.material.uniforms
    u.uTime.value = time
    u.uSpinA.value = time * this.spinRateA
    u.uSpinB.value = time * this.spinRateB
  }

  get spinA(): number {
    return this.material.uniforms.uSpinA.value as number
  }
  get spinB(): number {
    return this.material.uniforms.uSpinB.value as number
  }

  dispose(): void {
    this.geometry.dispose()
    this.material.dispose()
  }
}
