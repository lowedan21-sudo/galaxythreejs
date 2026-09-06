import * as THREE from 'three'
import { allocFormation, gaussian, mulberry32, type Formation } from './types'

/**
 * Chapter 2: the river of stars.
 *
 * A Catmull-Rom spline winding in an S through depth. Four streams ride the
 * same spline at slightly different depths and lateral offsets; the inner
 * stream is brightest. The flow parameter is arc length, so when the galaxy
 * (sorted by arm angle) morphs here, one arm unwinds into the current.
 */

// Wider than deep so a three-quarter camera sees the whole S at once.
const CONTROL_POINTS = [
  [-9.5, 0.5, -6.5],
  [-6.0, 0.3, -4.4],
  [-2.4, 0.05, -3.6],
  [1.4, -0.1, -2.2],
  [2.6, 0.0, -0.2],
  [0.2, 0.1, 1.6],
  [-1.4, 0.0, 3.2],
  [1.2, -0.1, 4.6],
  [5.8, -0.25, 5.4],
].map(([x, y, z]) => new THREE.Vector3(x, y, z))

// Brightness runs higher than the galaxy's because the same stars cover
// several times the screen area here.
const STREAMS = [
  { lateral: 0.0, depth: 0.0, width: 0.26, brightness: 2.4, share: 0.34 },
  { lateral: 0.55, depth: -0.14, width: 0.34, brightness: 1.7, share: 0.26 },
  { lateral: -0.5, depth: 0.12, width: 0.36, brightness: 1.6, share: 0.24 },
  { lateral: 0.05, depth: 0.3, width: 0.85, brightness: 0.9, share: 0.16 },
]

export function generateRiver(count: number, seed = 2): Formation {
  const rand = mulberry32(seed)
  const f = allocFormation(count)
  const { position, brightness, flow, flowParam } = f
  const curve = new THREE.CatmullRomCurve3(CONTROL_POINTS, false, 'centripetal', 0.5)

  const p = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const side = new THREE.Vector3()

  let i = 0
  STREAMS.forEach((s, streamIndex) => {
    const n = streamIndex === STREAMS.length - 1 ? count - i : Math.floor(count * s.share)
    for (let k = 0; k < n && i < count; k++) {
      // Slight bias toward the middle of the curve so the ends thin out.
      let t = rand()
      t = 0.5 + (t - 0.5) * (0.92 + 0.16 * rand())
      t = Math.min(0.998, Math.max(0.002, t))
      curve.getPointAt(t, p)
      curve.getTangentAt(t, tangent)
      side.crossVectors(tangent, up).normalize()

      const lateral = s.lateral + gaussian(rand, 0, s.width)
      const depth = s.depth + gaussian(rand, 0, s.width * 0.35)
      const x = p.x + side.x * lateral
      const y = p.y + depth
      const z = p.z + side.z * lateral

      position[i * 3] = x
      position[i * 3 + 1] = y
      position[i * 3 + 2] = z
      // Brightest along the inner stream, fading toward the banks.
      const bank = Math.exp(-(lateral - s.lateral) * (lateral - s.lateral) / (2 * s.width * s.width))
      // Knots of brighter stars along the current, like the reference image.
      const knots = 0.75 + 0.25 * Math.sin(t * 41.0 + streamIndex * 1.7) * Math.sin(t * 17.0)
      brightness[i] = s.brightness * (0.6 + 0.4 * bank) * knots
      // Current: drift along the tangent, faster mid-stream.
      const speed = 0.05 * (0.5 + 0.5 * bank)
      flow[i * 3] = tangent.x * speed
      flow[i * 3 + 1] = 0
      flow[i * 3 + 2] = tangent.z * speed
      // Arc length, with the stream index as a tiny tie-breaker so streams
      // stay grouped when sorted.
      flowParam[i] = t + streamIndex * 0.0004
      i++
    }
  })

  // Heroes: the outer edge of the big bend, and the source and mouth.
  curve.getPointAt(0.42, p)
  curve.getTangentAt(0.42, tangent)
  side.crossVectors(tangent, up).normalize()
  f.heroes.bendOuter = [p.x + side.x * 0.5, p.y, p.z + side.z * 0.5]
  curve.getPointAt(0.02, p)
  f.heroes.armTip = [p.x, p.y, p.z]
  curve.getPointAt(0.98, p)
  f.heroes.armTipB = [p.x, p.y, p.z]
  f.spin = 0
  return f
}
