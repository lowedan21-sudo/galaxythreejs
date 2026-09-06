import type { Formation } from './types'
import { assemble } from './assemble'
import { generateGalaxy } from './galaxy'
import { generateRiver } from './river'

export type FormationKey = 'galaxy' | 'river' | 'wave' | 'seed' | 'tree' | 'bird' | 'hands' | 'bridge' | 'city' | 'planet' | 'eye'

type Generator = (count: number) => Formation

/**
 * Registry of formation generators. Chapters whose generator is not here yet
 * are skipped by the timeline, so the piece grows one chapter at a time.
 */
const GENERATORS: Partial<Record<FormationKey, Generator>> = {
  galaxy: (n) => generateGalaxy(n, 1),
  river: (n) => generateRiver(n, 2),
}

const cache = new Map<string, Formation>()

export function hasFormation(key: FormationKey): boolean {
  return key in GENERATORS
}

/** Generate (once) and return the assembled formation for a key. */
export function getFormation(key: FormationKey, count: number): Formation {
  const id = `${key}:${count}`
  let f = cache.get(id)
  if (!f) {
    const gen = GENERATORS[key]
    if (!gen) throw new Error(`No generator for formation "${key}"`)
    f = assemble(gen(count))
    cache.set(id, f)
  }
  return f
}
