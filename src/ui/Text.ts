import type { ChapterSpec } from '../timeline/chapters'

/**
 * The words. One absolutely positioned section per playable chapter, placed
 * in that formation's reserved negative space by CSS. Opacity and drift are
 * driven every frame from the phase mapper; no CSS transitions race it.
 */
export class Text {
  private readonly sections: HTMLElement[] = []

  constructor(root: HTMLElement, chapters: ChapterSpec[]) {
    root.textContent = ''
    for (const c of chapters) {
      const section = document.createElement('section')
      section.className = 'chapter'
      section.dataset.chapter = String(c.number)
      const label = document.createElement('h2')
      label.className = 'label'
      label.textContent = `Chapter ${c.number} — ${c.title}`
      const line = document.createElement('p')
      line.textContent = c.line
      section.append(label, line)
      section.style.opacity = '0'
      root.appendChild(section)
      this.sections.push(section)
    }
  }

  /** Show chapter `index` at `alpha` with `driftPx`; all others hidden. */
  update(index: number, alpha: number, driftPx: number): void {
    for (let i = 0; i < this.sections.length; i++) {
      const el = this.sections[i]
      if (i === index) {
        el.style.opacity = (alpha * 0.9).toFixed(3)
        el.style.transform = `translate3d(0, ${driftPx.toFixed(2)}px, 0)`
        el.style.visibility = alpha > 0.001 ? 'visible' : 'hidden'
      } else if (el.style.visibility !== 'hidden') {
        el.style.opacity = '0'
        el.style.visibility = 'hidden'
      }
    }
  }
}
