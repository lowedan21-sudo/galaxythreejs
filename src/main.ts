import * as THREE from 'three'
import './style.css'
import { detectTier } from './config/tiers'
import { generateGalaxy } from './formations/galaxy'
import { assemble } from './formations/assemble'
import { Particles } from './scene/Particles'
import { Haze } from './scene/Haze'
import { Background } from './scene/Background'
import { Renderer } from './scene/Renderer'
import { Camera } from './scene/Camera'

/**
 * M0 boot: chapter 1 (the galaxy) rendered from a single shader-driven Points
 * object with bloom, a scripted camera, and the deep field behind it.
 *
 * Draw calls per frame: 4 (stars, haze, far field, near stars) + post.
 */

const canvas = document.getElementById('scene') as HTMLCanvasElement | null
if (!canvas) throw new Error('Missing #scene canvas')

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const tier = detectTier()
// Dev toggles: ?debug=nopost,nohaze,nobg,nostars
const debug = new Set((new URLSearchParams(location.search).get('debug') ?? '').split(',').filter(Boolean))
document.documentElement.dataset.tier = tier.name

const scene = new THREE.Scene()

// Chapter 1 pose: three-quarter view from above, galaxy right of centre so
// the words have the upper-left.
const camera = new Camera(innerWidth / innerHeight, {
  position: new THREE.Vector3(3.1, 5.0, 8.8),
  target: new THREE.Vector3(-1.0, 0.1, 0.2),
  fov: 48,
})

const renderer = new Renderer(canvas, scene, camera.camera, tier.dprCap, tier.bloomLevels)
const pr = renderer.pixelRatio

const background = new Background(tier.background, pr)
if (!debug.has('nobg')) scene.add(background.group)

const particles = new Particles(tier.particles, pr)
if (!debug.has('nostars')) scene.add(particles.points)

const hazeTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/feathered60.png`)
hazeTexture.colorSpace = THREE.SRGBColorSpace
const haze = new Haze(tier.haze, pr, hazeTexture)
if (!debug.has('nohaze')) scene.add(haze.points)

// Formation 1 into both slots; M1 replaces slot B with the river and drives
// uProgress from scroll.
const galaxy = assemble(generateGalaxy(tier.particles, 1))
particles.setFormation('A', galaxy)
particles.setFormation('B', galaxy)
haze.setFormation('A', galaxy)
haze.setFormation('B', galaxy)

if (reducedMotion) particles.setMotion(0.25, 0)

// Text for chapter 1 becomes visible once the field is on screen.
const chapter1 = document.querySelector<HTMLElement>('[data-chapter="1"]')

function resize(): void {
  const w = innerWidth
  const h = innerHeight
  renderer.resize(w, h)
  camera.setAspect(w / h)
  const p = renderer.pixelRatio
  particles.setViewport(h, camera.camera.fov, p)
  haze.setViewport(h, camera.camera.fov, p)
  background.setPixelRatio(p)
}
resize()
addEventListener('resize', resize)

// Frame loop with tab-hidden pause.
const timer = new THREE.Timer()
let running = true
let frames = 0
let fpsAccum = 0
const fpsEl = import.meta.env.DEV ? createFpsMeter() : null

function frame(): void {
  if (!running) return
  requestAnimationFrame(frame)
  timer.update()
  const dt = Math.min(timer.getDelta(), 0.1)
  const t = timer.getElapsed()

  camera.update(dt)
  particles.update(t)
  haze.update(t, particles.progress, particles.spinA, particles.spinB)
  background.update(t)
  if (debug.has('nopost')) renderer.renderer.render(scene, camera.camera)
  else renderer.render(dt)

  if (fpsEl) {
    frames++
    fpsAccum += dt
    if (fpsAccum >= 0.5) {
      fpsEl.textContent = `${Math.round(frames / fpsAccum)} fps · ${tier.particles.toLocaleString()} stars · ${tier.name}`
      frames = 0
      fpsAccum = 0
    }
  }
}

document.addEventListener('visibilitychange', () => {
  const visible = document.visibilityState === 'visible'
  if (visible && !running) {
    running = true
    timer.reset()
    requestAnimationFrame(frame)
  } else if (!visible) {
    running = false
  }
})

requestAnimationFrame(frame)
requestAnimationFrame(() => {
  document.documentElement.classList.add('is-ready')
  chapter1?.classList.add('is-visible')
})

function createFpsMeter(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'dev-fps'
  document.body.appendChild(el)
  return el
}
