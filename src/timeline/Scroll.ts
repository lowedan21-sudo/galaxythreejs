import Lenis from 'lenis'

/**
 * Native scroll, eased. Lenis never hijacks the wheel or touch; it only
 * smooths the reported position. We size a spacer so the document is
 * `chapters × CHAPTER_VH` tall and read the master timeline T from it.
 */
export class Scroll {
  private readonly lenis: Lenis | null
  private readonly spacer: HTMLElement
  private chapterPx = 1
  private chapters = 1
  /** Eased scroll position in px. */
  private y = 0

  constructor(spacer: HTMLElement, chapters: number, chapterVh: number, reducedMotion: boolean) {
    this.spacer = spacer
    this.setLength(chapters, chapterVh)

    this.lenis = reducedMotion
      ? null
      : new Lenis({
          lerp: 0.085,
          smoothWheel: true,
          syncTouch: false,
          wheelMultiplier: 0.9,
        })

    if (this.lenis) {
      this.lenis.on('scroll', (e: { scroll: number }) => {
        this.y = e.scroll
      })
    } else {
      addEventListener('scroll', () => (this.y = scrollY), { passive: true })
      this.y = scrollY
    }
  }

  setLength(chapters: number, chapterVh: number): void {
    this.chapters = Math.max(1, chapters)
    this.chapterPx = (innerHeight * chapterVh) / 100
    // The last chapter needs a full viewport of room to hold at the end.
    this.spacer.style.height = `${this.chapterPx * this.chapters + innerHeight}px`
    this.lenis?.resize()
  }

  /** Call once per frame with the DOM high-res timestamp in ms. */
  update(timeMs: number): void {
    this.lenis?.raf(timeMs)
  }

  /** Master timeline position: chapter index plus local progress. */
  get T(): number {
    return this.y / this.chapterPx
  }

  /** Programmatic scroll to a timeline position, eased (or immediate). */
  scrollTo(T: number, durationSeconds = 2.5, immediate = false): void {
    const target = T * this.chapterPx
    if (this.lenis) {
      this.lenis.scrollTo(target, immediate ? { immediate: true, force: true } : { duration: durationSeconds })
      if (immediate) this.y = target
    } else {
      scrollTo({ top: target, behavior: immediate ? 'auto' : 'smooth' })
      this.y = target
    }
  }
}
