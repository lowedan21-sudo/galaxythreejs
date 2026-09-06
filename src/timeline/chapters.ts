import * as THREE from 'three'
import type { FormationKey } from '../formations'
import type { CameraPose } from '../scene/Camera'

export interface ChapterSpec {
  /** 1-based chapter number from the brief. */
  number: number
  title: string
  line: string
  formation: FormationKey
  /** Camera at rest for this chapter. */
  camera: CameraPose
  /**
   * Position offset applied linearly across the chapter (0 at Arrival, full
   * at Departure). Gives the river its dolly and the city its pull-back.
   */
  drift?: THREE.Vector3
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/**
 * All twelve chapters. The timeline only plays chapters whose formation has
 * a generator (see formations/index.ts); the rest wait for M2 and M3.
 */
export const CHAPTERS: ChapterSpec[] = [
  {
    number: 1,
    title: 'The Beginning',
    line: 'Everything begins with possibility.',
    formation: 'galaxy',
    camera: { position: v(3.1, 5.0, 8.8), target: v(-1.0, 0.1, 0.2), fov: 48 },
  },
  {
    number: 2,
    title: 'The Current',
    line: 'A small movement can change the course.',
    formation: 'river',
    camera: { position: v(5.5, 7.0, 15.5), target: v(-0.4, 0.0, -0.6), fov: 46 },
    drift: v(-2.4, -0.8, -1.0),
  },
  {
    number: 3,
    title: 'The Tide',
    line: 'Change gathers strength.',
    formation: 'wave',
    camera: { position: v(0, 1.2, 8), target: v(0, 0.8, 0), fov: 50 },
  },
  {
    number: 4,
    title: 'The Seed',
    line: 'Even the smallest beginning holds a world.',
    formation: 'seed',
    camera: { position: v(-1.5, 0.6, 9), target: v(1.4, 0, 0), fov: 46 },
  },
  {
    number: 5,
    title: 'The Growth',
    line: 'What grows reaches beyond itself.',
    formation: 'tree',
    camera: { position: v(1.2, 0.4, 9.5), target: v(-0.8, 0.2, 0), fov: 48 },
  },
  {
    number: 6,
    title: 'The Flight',
    line: 'Then comes the courage to let go.',
    formation: 'bird',
    camera: { position: v(-1, -1.5, 9), target: v(0.5, 0.6, 0), fov: 50 },
  },
  {
    number: 7,
    title: 'The Reach',
    line: 'Across the distance, we find each other.',
    formation: 'hands',
    camera: { position: v(0, 0.4, 8.5), target: v(0, -0.6, 0), fov: 48 },
  },
  {
    number: 8,
    title: 'The Connection',
    line: 'What we make together carries us further.',
    formation: 'bridge',
    camera: { position: v(0, -1.2, 9), target: v(0, 0.4, 0), fov: 50 },
    drift: v(0, 2.6, 0),
  },
  {
    number: 9,
    title: 'The Shared World',
    line: 'A thousand separate lives. A world in common.',
    formation: 'city',
    camera: { position: v(3, 2.8, 8), target: v(0, -0.8, 0), fov: 48 },
    drift: v(0.5, 1.2, 3),
  },
  {
    number: 10,
    title: 'The Whole',
    line: 'There is more holding us together than we can see.',
    formation: 'planet',
    camera: { position: v(-2.5, 0.5, 10), target: v(1.6, 0, 0), fov: 46 },
  },
  {
    number: 11,
    title: 'The Wonder',
    line: 'And still, we look up.',
    formation: 'eye',
    camera: { position: v(0, 0.3, 8), target: v(0, 0.6, 0), fov: 46 },
    drift: v(0, 0, -3.5),
  },
  {
    number: 12,
    title: 'The Return',
    line: 'The same light. Still becoming.',
    formation: 'galaxy',
    camera: { position: v(3.1, 5.0, 8.8), target: v(-1.0, 0.1, 0.2), fov: 48 },
  },
]

/** Scroll distance per chapter, in viewport heights. Tuned in M1. */
export const CHAPTER_VH = 300
