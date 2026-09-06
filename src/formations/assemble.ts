import { HERO_COUNT, HERO_SLOTS, type Formation } from './types'

/**
 * Put a freshly generated formation into canonical particle order.
 *
 * 1. Sort every particle by its flow parameter so that, when two formations
 *    are blended index-by-index, neighbours travel together.
 * 2. Move the particles nearest each named hero position to indices
 *    0..HERO_COUNT-1 so the same hero indices land on the right feature in
 *    every chapter. Slots a formation does not name keep whichever particle
 *    the sort placed there.
 */
export function assemble(f: Formation): Formation {
  const n = f.count
  const order = new Uint32Array(n)
  for (let i = 0; i < n; i++) order[i] = i
  const fp = f.flowParam
  order.sort((a, b) => fp[a] - fp[b])

  // Pin heroes: find the nearest particle to each hero point, then swap it to
  // the slot's index within the sorted order.
  const pos = f.position
  const nearest = (p: [number, number, number]) => {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < n; i++) {
      const dx = pos[i * 3] - p[0]
      const dy = pos[i * 3 + 1] - p[1]
      const dz = pos[i * 3 + 2] - p[2]
      const d = dx * dx + dy * dy + dz * dz
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }
  const inverse = new Uint32Array(n)
  for (let k = 0; k < n; k++) inverse[order[k]] = k
  HERO_SLOTS.forEach((slot, slotIndex) => {
    const target = f.heroes[slot]
    if (!target) return
    const particle = nearest(target)
    const from = inverse[particle]
    const to = slotIndex
    if (from === to) return
    const displaced = order[to]
    order[to] = particle
    order[from] = displaced
    inverse[particle] = to
    inverse[displaced] = from
  })

  const out: Formation = {
    count: n,
    position: new Float32Array(n * 3),
    brightness: new Float32Array(n),
    flow: new Float32Array(n * 3),
    flowParam: new Float32Array(n),
    heroes: f.heroes,
    spin: f.spin,
  }
  for (let k = 0; k < n; k++) {
    const i = order[k]
    out.position[k * 3] = pos[i * 3]
    out.position[k * 3 + 1] = pos[i * 3 + 1]
    out.position[k * 3 + 2] = pos[i * 3 + 2]
    out.brightness[k] = f.brightness[i]
    out.flow[k * 3] = f.flow[i * 3]
    out.flow[k * 3 + 1] = f.flow[i * 3 + 1]
    out.flow[k * 3 + 2] = f.flow[i * 3 + 2]
    out.flowParam[k] = fp[i]
  }
  // Heroes glow: a bit brighter wherever a formation named them.
  for (let h = 0; h < HERO_COUNT; h++) {
    if (f.heroes[HERO_SLOTS[h]]) out.brightness[h] = Math.max(out.brightness[h], 2.2)
  }
  return out
}
