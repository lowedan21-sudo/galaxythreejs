import { allocFormation, gaussian, mulberry32, type Formation } from './types'

/**
 * Chapter 1 and 12: the spiral galaxy.
 *
 * Ported from the tutorial's galaxy.js / utils.js. The original worked in a
 * ~500-unit disc with Z up; here the disc lies in the XZ plane, Y is
 * thickness, and everything is scaled by 1/100 so the galaxy is ~5 units
 * across and sits comfortably with the other formations.
 */

const SCALE = 0.01
const CORE_DIST = 33
const OUTER_CORE_DIST = 100
const ARM_X_MEAN = 200
const ARM_X_DIST = 100
const ARM_Y_MEAN = 100
const ARM_Y_DIST = 50
const THICKNESS = 5
const SPIRAL = 2.0
const ARMS = 2

/** Wind a point on a straight bar into a logarithmic-ish spiral arm. */
function spiral(x: number, y: number, offset: number): [number, number, number] {
  const r = Math.sqrt(x * x + y * y)
  let theta = offset + (x > 0 ? Math.atan(y / x) : Math.atan(y / x) + Math.PI)
  theta += (r / ARM_X_DIST) * SPIRAL
  return [r * Math.cos(theta), r * Math.sin(theta), theta]
}

export function generateGalaxy(count: number, seed = 1): Formation {
  const rand = mulberry32(seed)
  const f = allocFormation(count)
  const { position, brightness, flow, flowParam } = f

  const coreCount = Math.floor(count * 0.2)
  const outerCount = Math.floor(count * 0.2)
  const armCount = count - coreCount - outerCount

  let i = 0
  const put = (x: number, y: number, z: number, b: number, theta: number) => {
    // Galaxy disc in XZ, thickness along Y.
    const px = x * SCALE
    const pz = y * SCALE
    const py = z * SCALE
    position[i * 3] = px
    position[i * 3 + 1] = py
    position[i * 3 + 2] = pz
    brightness[i] = b
    // Tangential drift (slow rotation about Y), faster toward the core.
    const r = Math.hypot(px, pz) + 1e-3
    const speed = 0.02 / Math.sqrt(r + 0.2)
    flow[i * 3] = (-pz / r) * speed
    flow[i * 3 + 1] = 0
    flow[i * 3 + 2] = (px / r) * speed
    flowParam[i] = theta
    i++
  }

  for (let k = 0; k < coreCount; k++) {
    const x = gaussian(rand, 0, CORE_DIST)
    const y = gaussian(rand, 0, CORE_DIST)
    const z = gaussian(rand, 0, THICKNESS)
    put(x, y, z, 0.5, Math.atan2(y, x))
  }
  for (let k = 0; k < outerCount; k++) {
    const x = gaussian(rand, 0, OUTER_CORE_DIST)
    const y = gaussian(rand, 0, OUTER_CORE_DIST)
    const z = gaussian(rand, 0, THICKNESS)
    put(x, y, z, 0.85, Math.atan2(y, x))
  }
  const perArm = Math.floor(armCount / ARMS)
  for (let arm = 0; arm < ARMS; arm++) {
    const n = arm === ARMS - 1 ? armCount - perArm * (ARMS - 1) : perArm
    for (let k = 0; k < n; k++) {
      const bx = gaussian(rand, ARM_X_MEAN, ARM_X_DIST)
      const by = gaussian(rand, ARM_Y_MEAN, ARM_Y_DIST)
      const z = gaussian(rand, 0, THICKNESS)
      const [x, y, theta] = spiral(bx, by, (arm * 2 * Math.PI) / ARMS)
      // Arms are slightly dimmer than the core; the leading edge a touch brighter.
      put(x, y, z, 1.0, theta)
    }
  }

  // Hero positions: tips of the two arms (far end of the bar wound into the spiral).
  const tipA = spiral(ARM_X_MEAN + 2.2 * ARM_X_DIST, ARM_Y_MEAN, 0)
  const tipB = spiral(ARM_X_MEAN + 2.2 * ARM_X_DIST, ARM_Y_MEAN, Math.PI)
  f.heroes.armTip = [tipA[0] * SCALE, 0, tipA[1] * SCALE]
  f.heroes.armTipB = [tipB[0] * SCALE, 0, tipB[1] * SCALE]
  f.heroes.coreBright = [0.08, 0.02, -0.05]
  f.spin = 0.02
  f.hazeAvoidRadius = 1.1
  return f
}
