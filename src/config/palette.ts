/**
 * Colour system for The Same Light.
 *
 * The star type table is ported from the original tutorial
 * (legacy/finished/config/starDistributions.js). Percentages weight how
 * often each type occurs, colours run warm (K/M class) to cool (B class),
 * and sizes are relative point sizes. The seventh size entry in the
 * original had no matching colour and has been dropped.
 */

export interface StarType {
  /** Occurrence weight, summing to ~100. */
  percentage: number
  /** Linear-space RGB, 0..1. */
  color: [number, number, number]
  /** Relative point size multiplier. */
  size: number
}

function hex(h: number): [number, number, number] {
  // sRGB hex → linear RGB (the shader works in linear light)
  const c = [(h >> 16) & 255, (h >> 8) & 255, h & 255].map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return [c[0], c[1], c[2]]
}

export const STAR_TYPES: StarType[] = [
  { percentage: 76.45, color: hex(0xffcc6f), size: 0.7 },
  { percentage: 12.1, color: hex(0xffd2a1), size: 0.7 },
  { percentage: 7.6, color: hex(0xfff4ea), size: 1.15 },
  { percentage: 3.0, color: hex(0xf8f7ff), size: 1.48 },
  { percentage: 0.6, color: hex(0xcad7ff), size: 2.0 },
  { percentage: 0.13, color: hex(0xaabfff), size: 2.5 },
]

/** Pick a star type index using the percentage weights. */
export function pickStarType(r: number): number {
  let n = r * 100
  for (let i = 0; i < STAR_TYPES.length; i++) {
    n -= STAR_TYPES[i].percentage
    if (n < 0) return i
  }
  return 0
}

/** Flat colour table for upload as a uniform array (6 × vec3). */
export const STAR_COLOR_TABLE = new Float32Array(STAR_TYPES.flatMap((t) => t.color))
export const STAR_SIZE_TABLE = new Float32Array(STAR_TYPES.map((t) => t.size))

export const GROUND_COLOR = 0x02040a
export const HAZE_COLOR = 0x1b3a6b
