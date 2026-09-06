/**
 * The master timeline: one number T in [0, N) where N is the number of
 * playable chapters. Chapter k owns T in [k, k+1) and local progress
 * p = T - k splits into four phases:
 *
 *   Arrival      0.00 – 0.30   morph k-1 → k runs 0 → 1
 *   Recognition  0.30 – 0.45   words enter
 *   Rest         0.45 – 0.80   hold
 *   Departure    0.80 – 1.00   words leave by 0.92
 *
 * Everything derives from T, so scrolling backward retraces for free.
 */

export const ARRIVAL_END = 0.3
export const RECOGNITION_END = 0.45
export const REST_END = 0.8
export const TEXT_OUT_END = 0.92

export interface PhaseState {
  /** Index of the chapter that owns T (0-based). */
  chapter: number
  /** Local progress within the chapter, 0..1. */
  p: number
  /** Morph progress from the previous chapter's formation, 0..1 (eased). */
  morph: number
  /** Text opacity 0..1 and vertical drift in px for this chapter's words. */
  textAlpha: number
  textDrift: number
  /** Camera blend from the previous chapter's pose, 0..1 (eased). */
  cameraBlend: number
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function phaseState(T: number, chapterCount: number): PhaseState {
  const maxT = Math.max(0, chapterCount - 1e-4)
  const t = T < 0 ? 0 : T > maxT ? maxT : T
  const chapter = Math.floor(t)
  const p = t - chapter

  // Chapter 0 has nothing to arrive from; it starts fully formed.
  const morphRaw = chapter === 0 ? 1 : clamp01(p / ARRIVAL_END)
  const morph = easeInOutCubic(morphRaw)

  let textAlpha = 0
  let textDrift = 12
  if (chapter === 0 && p < REST_END) {
    // The first chapter opens fully formed with its words already in place.
    textAlpha = 1
    textDrift = 0
  } else if (p < ARRIVAL_END) {
    textAlpha = 0
    textDrift = 12
  } else if (p < RECOGNITION_END) {
    const k = easeOutCubic((p - ARRIVAL_END) / (RECOGNITION_END - ARRIVAL_END))
    textAlpha = k
    textDrift = 12 * (1 - k)
  } else if (p < REST_END) {
    textAlpha = 1
    textDrift = 0
  } else if (p < TEXT_OUT_END) {
    const k = easeInOutCubic((p - REST_END) / (TEXT_OUT_END - REST_END))
    textAlpha = 1 - k
    textDrift = -8 * k
  } else {
    textAlpha = 0
    textDrift = -8
  }

  return { chapter, p, morph, textAlpha, textDrift, cameraBlend: morph }
}
