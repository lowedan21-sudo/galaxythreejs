/**
 * Device tiers. Particle counts and post-processing quality scale with the
 * device so the piece holds 60 fps on a laptop and stays smooth on a phone.
 * Runtime downgrade on sustained frame drops lands in M5.
 */

export type TierName = 'high' | 'medium' | 'low'

export interface Tier {
  name: TierName
  /** Main star particle count. */
  particles: number
  /** Haze puff count. */
  haze: number
  /** Background starfield count. */
  background: number
  /** Device pixel ratio cap. */
  dprCap: number
  /** Mipmap bloom levels. */
  bloomLevels: number
}

export const TIERS: Record<TierName, Tier> = {
  high: { name: 'high', particles: 180_000, haze: 3_000, background: 12_000, dprCap: 1.5, bloomLevels: 5 },
  medium: { name: 'medium', particles: 100_000, haze: 2_000, background: 10_000, dprCap: 1.25, bloomLevels: 4 },
  low: { name: 'low', particles: 45_000, haze: 1_000, background: 8_000, dprCap: 1.0, bloomLevels: 3 },
}

export function detectTier(): Tier {
  const params = new URLSearchParams(location.search)
  const forced = params.get('tier') as TierName | null
  if (forced && forced in TIERS) return TIERS[forced]

  const coarse = matchMedia('(pointer: coarse)').matches
  const small = Math.min(innerWidth, innerHeight) < 700
  if (coarse && small) return TIERS.low

  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 4
  if (coarse || mem < 8 || cores < 4) return TIERS.medium
  return TIERS.high
}
