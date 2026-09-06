import * as THREE from 'three'
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing'
import { GROUND_COLOR } from '../config/palette'

/**
 * Renderer + post chain.
 *
 *   scene → HDR (HalfFloat) → mipmap bloom → ACES tone map + vignette → screen
 *
 * One scene render per frame. The bloom threshold does the work the
 * tutorial's separate bloom layer used to: only bright stars, seams and
 * crests bloom; fill and dust stay soft.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer
  readonly composer: EffectComposer
  readonly bloom: BloomEffect
  private dprCap: number

  constructor(canvas: HTMLCanvasElement, scene: THREE.Scene, camera: THREE.PerspectiveCamera, dprCap: number, bloomLevels: number) {
    this.dprCap = dprCap
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA is wasted on points; bloom softens edges anyway
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
      alpha: false,
    })
    this.renderer.setClearColor(GROUND_COLOR, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // Tone mapping is done in the post chain so bloom sees linear HDR values.
    this.renderer.toneMapping = THREE.NoToneMapping

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 0,
    })
    this.composer.addPass(new RenderPass(scene, camera))

    this.bloom = new BloomEffect({
      mipmapBlur: true,
      levels: bloomLevels,
      intensity: 0.7,
      radius: 0.55,
      luminanceThreshold: 0.7,
      luminanceSmoothing: 0.3,
    })
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
    const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.55 })
    this.composer.addPass(new EffectPass(camera, this.bloom, vignette, tone))

    this.renderer.toneMappingExposure = 1.0
    this.resize(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight)
  }

  get pixelRatio(): number {
    return Math.min(devicePixelRatio || 1, this.dprCap)
  }

  resize(width: number, height: number): void {
    const pr = this.pixelRatio
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
  }

  render(deltaSeconds: number): void {
    this.composer.render(deltaSeconds)
  }

  dispose(): void {
    this.composer.dispose()
    this.renderer.dispose()
  }
}
