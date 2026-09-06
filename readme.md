# The Same Light

A scroll-driven WebGL experience built with Three.js. Twelve connected chapters in which one field of stars becomes a galaxy, a river, a wave, a seed, a tree, a bird, two hands, a bridge, a city, a planet, an eye, and a galaxy again.

- **Build plan:** [docs/PLAN.md](docs/PLAN.md)
- **Reference images:** [docs/references/](docs/references/)

## Develop

```sh
npm install
npm run dev        # Vite dev server with an fps meter in the corner
npm run build      # typecheck + production build to dist/
npm run preview    # serve dist/
```

URL flags while developing:

- `?tier=high|medium|low` forces a device tier (particle count, bloom quality, DPR cap).
- `?debug=nopost,nohaze,nobg,nostars` switches parts of the scene off to isolate a look.

## Layout

- `src/scene/` — renderer and post chain, scripted camera, the single-draw-call star field, haze, deep-field background.
- `src/shaders/` — GLSL for the star particles (A/B morph, curl-noise travel arcs, twinkle), haze, and noise.
- `src/formations/` — one generator per chapter plus `assemble()`, which sorts particles by flow parameter and pins hero stars so indices correspond across chapters.
- `src/config/` — star palette (ported from the tutorial) and device tiers.
- `legacy/` — the Three.js galaxy tutorial this project started from, kept for reference.

## Status

M0 (foundation) is in: chapter 1 renders from one shader-driven `Points` object with bloom, a scripted camera with pointer parallax, and a background starfield. Next is M1: the morph engine driven by scroll, and the galaxy → river transition.
