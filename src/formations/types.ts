/**
 * A Formation is one chapter's target state for every particle.
 *
 * Every generator returns the same buffers so the particle system can blend
 * any two formations in the vertex shader. Buffers are indexed by particle
 * and are *unsorted* when they leave a generator; `assemble()` sorts them
 * by `flowParam` and pins hero stars so that indices correspond across
 * chapters.
 */

export interface Formation {
  count: number
  /** xyz per particle. */
  position: Float32Array
  /** Brightness multiplier per particle (1 = normal). */
  brightness: Float32Array
  /** xyz local drift direction × speed per particle, for idle motion. */
  flow: Float32Array
  /**
   * Scalar used to order particles so neighbours stay neighbours across a
   * morph: arm angle on the galaxy, arc length on the river, height on the
   * tree, and so on.
   */
  flowParam: Float32Array
  /**
   * Named hero positions. `assemble()` moves the particles nearest these
   * points to indices 0..N so the same stars carry through every chapter.
   */
  heroes: Partial<Record<HeroSlot, [number, number, number]>>
  /** Idle rotation speed about the formation's Y axis, radians per second. */
  spin: number
  /**
   * Haze stays out of a sphere of this radius around the origin. The galaxy
   * uses it to keep dust off its already-white core; most formations leave it 0.
   */
  hazeAvoidRadius: number
}

export const HERO_SLOTS = [
  'armTip',
  'armTipB',
  'coreBright',
  'bendOuter',
  'crest',
  'seam',
  'branchTip',
  'wingTip',
  'wingTipB',
  'fingertipL',
  'fingertipR',
  'midspan',
  'tallestTower',
  'pole',
  'irisHighlight',
  'spare0',
  'spare1',
  'spare2',
  'spare3',
  'spare4',
] as const

export type HeroSlot = (typeof HERO_SLOTS)[number]
export const HERO_COUNT = HERO_SLOTS.length

/** Deterministic PRNG so a formation is identical on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gaussian(rand: () => number, mean = 0, stdev = 1): number {
  const u = 1 - rand()
  const v = rand()
  return mean + stdev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function allocFormation(count: number): Formation {
  return {
    count,
    position: new Float32Array(count * 3),
    brightness: new Float32Array(count).fill(1),
    flow: new Float32Array(count * 3),
    flowParam: new Float32Array(count),
    heroes: {},
    spin: 0,
    hazeAvoidRadius: 0,
  }
}
