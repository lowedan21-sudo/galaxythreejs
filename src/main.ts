import * as THREE from 'three'
import './style.css'
import { detectTier } from './config/tiers'
import { getFormation, hasFormation } from './formations'
import { Particles } from './scene/Particles'
import { Haze } from './scene/Haze'
import { Background } from './scene/Background'
import { Renderer } from './scene/Renderer'
import { Camera } from './scene/Camera'
import { CHAPTERS, CHAPTER_VH } from './timeline/chapters'
import { Scroll } from './timeline/Scroll'
import { phaseState } from './timeline/Phases'
import { Text } from './ui/Text'

/**
 * Boot. One star field, one camera, one number (scroll) driving everything.
 *
 * Draw calls per frame: 4 (stars, haze, far field, near stars) + post.
 */

const canvas = document.getElementById('scene') as HTMLCanvasElement | null
const spacer = document.getElementById('scroll-space')
const textRoot = document.getElementById('chapters')
if (!canvas || !spacer || !textRoot) throw new Error('Missing scaffold elements')

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const tier = detectTier()
// Dev toggles: ?debug=nopost,nohaze,nobg,nostars
const debug = new Set((new URLSearchParams(location.search).get('debug') ?? '').split(',').filter(Boolean))
document.documentElement.dataset.tier = tier.name

// Only chapters with a generator play; the rest join as M2 and M3 land.
const chapters = CHAPTERS.filter((c) => hasFormation(c.formation))

const scene = new THREE.Scene()
const camera = new Camera(innerWidth / innerHeight, chapters[0].camera)
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

if (reducedMotion) particles.setMotion(0.25, 0)

// Slot management: during chapter k, slot A holds formation k-1 and slot B
// holds formation k; uProgress runs 0 → 1 across Arrival. Crossing a chapter
// boundary re-points the slots, which is seamless because B at 1 equals the
// next A at 0.
let loadedChapter = -1
function loadChapterPair(k: number): void {
  if (k === loadedChapter) return
  loadedChapter = k
  const prev = chapters[Math.max(0, k - 1)]
  const cur = chapters[k]
  const a = getFormation(prev.formation, tier.particles)
  const b = getFormation(cur.formation, tier.particles)
  particles.setFormation('A', a)
  particles.setFormation('B', b)
  haze.setFormation('A', a)
  haze.setFormation('B', b)
}
loadChapterPair(0)

const text = new Text(textRoot, chapters)
const scroll = new Scroll(spacer, chapters.length, CHAPTER_VH, reducedMotion)

// Dev: ?T=1.15 jumps the timeline to a position for tuning a moment.
const startT = parseFloat(new URLSearchParams(location.search).get('T') ?? '')
if (!Number.isNaN(startT)) requestAnimationFrame(() => scroll.scrollTo(startT, 0, true))

function resize(): void {
  const w = innerWidth
  const h = innerHeight
  renderer.resize(w, h)
  camera.setAspect(w / h)
  const p = renderer.pixelRatio
  particles.setViewport(h, camera.camera.fov, p)
  haze.setViewport(h, camera.camera.fov, p)
  background.setPixelRatio(p)
  scroll.setLength(chapters.length, CHAPTER_VH)
}
resize()
addEventListener('resize', resize)

// Frame loop with tab-hidden pause.
const timer = new THREE.Timer()
let running = true
let frames = 0
let fpsAccum = 0
let smoothedMorph = 1
const fpsEl = import.meta.env.DEV ? createFpsMeter() : null

function frame(now: number): void {
  if (!running) return
  requestAnimationFrame(frame)
  timer.update()
  const dt = Math.min(timer.getDelta(), 0.1)
  const t = timer.getElapsed()

  scroll.update(now)
  const state = phaseState(scroll.T, chapters.length)
  loadChapterPair(state.chapter)

  // The morph uniform chases the scroll-derived target so stopping mid-scroll
  // settles softly instead of freezing mid-frame.
  const chase = 1 - Math.exp(-dt * 7)
  smoothedMorph += (state.morph - smoothedMorph) * chase
  if (Math.abs(smoothedMorph - state.morph) < 0.0005) smoothedMorph = state.morph
  particles.progress = smoothedMorph

  const cur = chapters[state.chapter]
  const prev = chapters[Math.max(0, state.chapter - 1)]
  camera.blendPose(prev.camera, cur.camera, state.cameraBlend, cur.drift, state.p)
  camera.update(dt)

  text.update(state.chapter, state.textAlpha, state.textDrift)

  particles.update(t)
  haze.update(t, particles.progress, particles.spinA, particles.spinB)
  background.update(t)
  if (debug.has('nopost')) renderer.renderer.render(scene, camera.camera)
  else renderer.render(dt)

  if (fpsEl) {
    frames++
    fpsAccum += dt
    if (fpsAccum >= 0.5) {
      fpsEl.textContent = `${Math.round(frames / fpsAccum)} fps · ${tier.particles.toLocaleString()} stars · ${tier.name} · T ${scroll.T.toFixed(2)}`
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
requestAnimationFrame(() => document.documentElement.classList.add('is-ready'))

function createFpsMeter(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'dev-fps'
  document.body.appendChild(el)
  return el
}
