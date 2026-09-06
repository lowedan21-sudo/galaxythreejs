# The Same Light — Build Plan

A scroll-driven WebGL experience. Twelve chapters. One field of stars that becomes a galaxy, a river, a wave, a seed, a tree, a bird, two hands, a bridge, a city, a planet, an eye, and a galaxy again. No characters, almost no text. Every shape emerges from the one before it, and the visitor can follow the transformation.

This document is the working plan: what we keep from the current repo, the architecture, a per-chapter spec, milestones, and the open decisions.

---

## 1. Design principles (the rules the build answers to)

1. **One material, twelve forms.** The same particles persist through all twelve chapters. Nothing is swapped in or faded over. A star that starts on a galaxy arm is the same vertex that later sits on a bridge deck.
2. **Followable transformation.** Neighbouring stars stay neighbours during a morph. Stars travel along curved paths with stagger, never a straight-line lerp, so the change reads as flow rather than teleport.
3. **Scroll is the clock.** Scroll position is the only timeline. Stop scrolling and the formation holds with idle life (slow rotation, twinkle, local drift). Scroll back and everything retraces.
4. **Text lives in the composition.** No cards, panels, or backplates. Each formation reserves a planned area of negative space and the type sits there. Readability comes from particle placement, camera framing, and restrained brightness.
5. **A few stars carry the thread.** Twelve to twenty "hero" stars have a hand-assigned role in every formation (arm tip, river bend, wave crest, seed seam, branch tip, wing tip, fingertip, bridge midspan, tallest tower, planet pole, iris highlight, arm tip). Most visitors won't consciously track them; the piece will feel connected because of them.
6. **Quiet, curious, expansive.** Deep blue-black ground, warm-white and cool-blue star colours (already in the repo's star distribution), soft bloom, slow easing. Nothing snaps.

---

## 2. Review of the current repo

The repo is a completed Three.js galaxy tutorial (`finished/`) plus its starting point (`starter_project/`). It proves out the look we want for chapter 1 and 12, and a couple of its ideas carry straight over. Its structure does not scale to what we're building.

### Keep (port into the new codebase)

| What | Where | Why |
|---|---|---|
| Spiral arm math | `finished/utils.js` `spiral()` and `gaussianRandom()` | Produces the galaxy shape we want. Becomes the chapter 1 and 12 formation generator. |
| Galaxy shape parameters | `finished/config/galaxyConfig.js` | Core / outer core / arm distributions and thickness are tuned already. |
| Star type distribution | `finished/config/starDistributions.js` | The percentage / colour / size table gives realistic warm-to-blue colour mix. Becomes a per-particle attribute. |
| Bloom compositing concept | `finished/shaders/CompositionShader.js`, `main.js` | Separate bloom layer added over base. We keep the idea, replace the implementation. |
| Sprite textures | `finished/resources/sprite120.png`, `feathered60.png` | Star sprite and haze puff. Useful as the haze layer texture; the main stars will be drawn procedurally in the fragment shader. |

### Replace

| Problem | Impact | Replacement |
|---|---|---|
| 7,000 individual `THREE.Sprite` objects, one draw call each | Cannot scale to 100k+ particles, and morphing thousands of objects per frame on the CPU is a non-starter | One `THREE.Points` (or instanced quads) with all positions in a `BufferAttribute`. One draw call. All motion in the vertex shader. |
| Per-frame JS loop that rescales every star by camera distance | CPU-bound; blocks 60fps at scale | Size attenuation computed in the vertex shader from view-space depth. |
| Haze sprites share one `SpriteMaterial` and mutate `material.opacity` per sprite | Every haze puff ends with the opacity of the last one processed; the loop has no effect. Existing bug. | Per-particle opacity attribute on a second, small Points layer. |
| Three `EffectComposer`s each re-rendering the full scene (3 scene renders per frame) | Triples render cost | One composer, selective bloom via a bright-mask or a single bloom pass with threshold (see §3.4). |
| `MapControls` orbit camera | Free orbit conflicts with a scripted, scroll-driven camera | Scripted camera path with bounded pointer parallax and an optional, limited drag orbit in the Rest phase. |
| Three r150 from unpkg via import map, no bundler | No TypeScript, no tree shaking, no asset pipeline, CDN dependency at runtime | Vite + TypeScript, pinned `three` (current release), bundled and self-hosted. |
| `AxesHelper` in the scene, unused `NUM_ARMS`, `starTypes.size` has 7 entries vs 6 colours | Tutorial leftovers | Removed / corrected during the port. |

Recommendation: move `finished/` and `starter_project/` under `legacy/` (or delete after M0 lands) so the root becomes the new app.

---

## 3. Architecture

### 3.1 Stack

- **Vite + TypeScript**. Fast dev server, small production bundle, static output deployable anywhere (GitHub Pages, Netlify, Vercel).
- **three** (latest, pinned). Vanilla Three.js, not React Three Fiber. The scene is one particle system and a camera; a component framework adds nothing here and costs frame time.
- **Custom GLSL** via `ShaderMaterial` for the particle system (vertex morph, curl noise, twinkle, soft point sprite).
- **postprocessing** (pmndrs) for bloom. Its mipmap-blur bloom is cheaper and softer than `UnrealBloomPass` and composes in one pass.
- **lenis** for smoothed native scroll. Native scroll is never hijacked. Lenis only eases the reported position.
- **gsap + ScrollTrigger** for the master timeline and text choreography, or a hand-rolled progress mapper if we want zero dependencies. Recommendation: hand-rolled. The timeline is one number, and mapping it to phases is 40 lines.
- **simplex-noise** (or an inline GLSL noise) for curl noise in the shader and continent noise on the CPU.
- No UI framework. The DOM has one canvas, twelve text blocks, and two links.

### 3.2 The particle system

One persistent buffer of `N` particles. `N` is chosen at boot by device tier (§6).

Per-particle attributes, static for the whole experience:

| Attribute | Type | Purpose |
|---|---|---|
| `aType` | float | Star type index (0–5). Drives colour and base size from the ported distribution table. |
| `aSeed` | float | Random 0–1. Twinkle phase, stagger offset, noise seed. |
| `aHero` | float | 0 for normal, 1–20 for hero stars. Hero stars get a larger size and a slightly warmer colour, and never get culled in low tiers. |

Per-formation attributes, one set per chapter, stored as `Float32Array`s on the CPU and uploaded as two "slots" (A and B) that the shader blends between:

| Attribute | Type | Purpose |
|---|---|---|
| `aPosA`, `aPosB` | vec3 | Target position in formation A and B. |
| `aBrightA`, `aBrightB` | float | Brightness multiplier (crests, seams, edges brighter; dust and fill dimmer). |
| `aFlowA`, `aFlowB` | vec3 | Local drift direction and speed for idle motion (river current, bridge traffic, tree sap, galaxy rotation tangent). |

Uniforms: `uProgress` (0–1 morph between A and B), `uTime`, `uPixelRatio`, `uSizeScale`, `uNoiseAmp`, `uFlowAmp`, `uCameraPos`.

Vertex shader per particle:

1. `t = smoothstep(stagger)` where `stagger` offsets `uProgress` by `aSeed * 0.35` so particles leave and arrive in waves, not all at once.
2. Base position = `mix(aPosA, aPosB, ease(t))`.
3. Add a travel arc: displace along a curl-noise vector scaled by `sin(t * PI)` so paths bow outward mid-transition. This is what makes a morph read as stars *travelling*.
4. Add idle drift: `aFlow * uTime` wrapped with a small amplitude, plus a low-frequency noise wobble.
5. Twinkle: size and alpha modulated by `sin(uTime * f + aSeed * TWO_PI)`.
6. Size attenuation from view depth, clamped, hero and type multipliers applied.

Fragment shader: soft radial falloff (no texture fetch), colour from type, alpha from brightness and twinkle, additive blending. A second tiny Points layer (about 2–3k particles) uses `feathered60.png` at low opacity for haze and follows the same morph so dust drifts with the stars.

Slot management: chapter `k` transitions use slots A = formation `k`, B = formation `k+1`. When the timeline crosses into chapter `k+1`, we copy B into A and upload formation `k+2` into B. The copy is a buffer swap, not a re-upload of A. Scrolling backward mirrors this.

### 3.3 Formation generators

Each chapter is a pure function `(N, seed) => Formation { pos, bright, flow, heroSlots }`. They run once at boot (in a Web Worker so the intro is never blocked) and are cached.

Two families:

**Procedural (math)** — galaxy, river, wave, seed, tree, bridge, city, planet, eye. Each is a parametric surface or curve sampled with density weighting so the important lines (crest, seam, trunk, deck, coastlines, iris strands) receive more particles.

**Mesh-sampled** — bird, two hands. Sampled from low-poly GLB models with `MeshSurfaceSampler`, with extra density along mesh edges and feather outlines. The reference bird image is drawn as edge-heavy line work, not a filled silhouette. We reproduce that by sampling 60 percent of particles along edges and outlines and 40 percent on surfaces.

**Correspondence (which star goes where).** Readability of a morph depends on the index mapping between formation `k` and `k+1`. Rule: every formation exposes a scalar *flow parameter* per particle (arm angle on the galaxy, arc length on the river, position along the crest on the wave, height on the tree, and so on). Both formations are sorted by their flow parameter before being assigned to particle indices. Adjacent stars stay adjacent, and the story beats in the brief (one arm stretches into the river, the crest folds into the seed, the canopy becomes wings) fall out of the sort rather than being animated by hand. For the two mesh-sampled forms we sort by a projected axis (wing span for the bird, palm-to-fingertip for the hands).

**Hero stars.** Each generator returns twenty named slots (`armTip`, `bendOuter`, `crest`, `seam`, `branchTip`, `wingTip`, `fingertipL`, `fingertipR`, `midspan`, `tallestTower`, `pole`, `irisHighlight`, and so on). The assembler forces particle indices 0–19 into those slots in every formation after sorting, so hero stars ride through all twelve chapters in predictable places.

### 3.4 Rendering pipeline

```
scene (points + haze + background starfield)
  → render to HDR target (HalfFloat)
  → bloom (postprocessing MipmapBlur, luminance threshold, ~0.6 intensity)
  → tone map (ACES, exposure ~0.6) + subtle vignette + film grain (very low)
  → screen
```

One scene render per frame. Bloom threshold does the job of the old bloom layer: only bright stars, seams, and crests bloom; fill and dust don't. Bloom runs at half resolution.

Background: a static 8–12k point starfield on a large sphere (tiny points, no bloom) plus 6–10 larger "near" stars that parallax with the camera. It never morphs; it gives the sense that the formations sit *in* space.

Colour: renderer in linear, output sRGB. Ground colour `#02040a`. Star palette from the ported distribution table plus a cool haze `#1b3a6b` at 10–15 percent.

### 3.5 Scroll, timeline, and phases

Document height: twelve chapters × 300vh, plus a 100vh intro hold and a 100vh outro hold. About 3,800vh total. Lenis eases native scroll; we read `scrollY / (docHeight − viewportHeight)` and convert to a master `T ∈ [0, 12]`.

Chapter `k` occupies `T ∈ [k, k+1)`. Within a chapter, local progress `p = T − k` is split into four phases:

| Phase | `p` range | Particles | Text |
|---|---|---|---|
| Arrival | 0.00 – 0.30 | `uProgress` for morph `k−1 → k` runs 0 → 1 | Previous chapter's words are already gone |
| Recognition | 0.30 – 0.45 | Formation settled, idle motion only | Words enter: 12px upward drift, opacity 0 → 1 |
| Rest | 0.45 – 0.80 | Hold. Slow rotation, twinkle, local drift | Words hold |
| Departure | 0.80 – 1.00 | Hold, then the *next* Arrival begins at `p = 1.0` | Words leave: opacity 1 → 0 with 8px drift, done by `p = 0.92` |

The morph uniform tracks a *smoothed* target (`uProgress += (target − uProgress) * 0.08` per frame). Stopping mid-scroll lets the morph settle gently instead of freezing mid-frame. Scrolling backward reverses everything with no special casing because every value derives from `T`.

Chapter 1 starts fully formed at `T = 0` (no Arrival). Chapter 12's Arrival morphs eye → galaxy, and chapter 12's formation buffer is byte-identical to chapter 1's, so the loop closes exactly. Replay scrolls to top with a 3 second eased scroll; Share copies the URL and, if available, opens the native share sheet.

### 3.6 Camera

A scripted camera path: per chapter, keyframes for position, look-at target, and field of view, interpolated with Catmull-Rom across `T`. The camera does the framing that creates negative space (§4).

Layered on top:

- **Pointer parallax**: up to ±2° yaw/pitch, damped, so the scene feels held rather than fixed. Disabled on touch and under reduced motion.
- **Rest-phase drag orbit** (the "camera control" the brief asks for): during Rest, dragging rotates the view up to ±25° around the formation's axis with damping. It eases back to the scripted pose when Departure begins. This gives control without letting the visitor break the composition or lose the text.
- Camera never rolls except where scripted (a slight roll on the wave and the eye).

### 3.7 Text layer

Twelve `<section>` elements absolutely positioned over the canvas, each with a single line of type. Each has a per-chapter anchor expressed in viewport units (for example `left: 58vw; top: 46vh; max-width: 26ch`) tuned so it sits in that formation's reserved negative space on desktop, tablet, and portrait phone. Opacity and transform are set from the phase mapper every frame; no CSS scroll-snapping, no scroll-jacking. Text is real DOM, so it's selectable, searchable, and readable by assistive tech.

Type: one light-weight humanist serif or geometric sans at 28–40px desktop, 22–26px mobile, letterspacing +0.02em, colour `#e8e4dc` at 90 percent. Self-hosted WOFF2, `font-display: swap`. Candidates: Cormorant Garamond Light, Fraunces Light, or Inter Light. Decision pending (§9).

### 3.8 Intro and loading

Boot order: canvas paints the background starfield within the first frame; formations generate in a worker (galaxy first so chapter 1 appears within about 300 ms); remaining eleven formations stream in over the next 1–2 seconds while the visitor is still reading the first line. A thin scroll cue ("scroll", 1px line, breathing opacity) appears at the bottom after 2 seconds of no scroll on first visit.

---

## 4. Chapter spec

Each row: how the form is generated, where the negative space is reserved, what the camera does, the hero-star role, and how the form leaves.

| # | Chapter | Generator | Negative space (text) | Camera | Hero role | Transition out |
|---|---|---|---|---|---|---|
| 1 | The Beginning — Galaxy | Ported `spiral()` with core, outer core, two arms; thickness 5; 3–4 percent brightness bump at core | Upper-left, above the arm that will stretch | Three-quarter view from above, slow 0.02 rad/s rotation | Tip of the leading arm | Leading arm's flow parameter unwinds first; sort by arm angle → river arc length |
| 2 | The Current — River | Catmull-Rom spline through 7–9 control points, S-curve into depth; 4 streams offset ±depth, Gaussian lateral spread; brightness peaks on the inner stream | Inside the large bend, right of centre | Low, alongside the current, drifting forward with it (dolly along spline) | Bright cluster at the bend | Streams converge: arc-length parameter maps to crest position; downstream half rises |
| 3 | The Tide — Wave | Logarithmic-spiral cross-section swept along a 2.5-unit arc; crest particles brightest; dust field under the barrel | Inside the hollow (the "eye" of the barrel) | Slightly below crest height, small roll | Crest highlight | Crest folds inward: all flow parameters contract toward one point; the outer 25 percent of stars stay as suspended field |
| 4 | The Seed — Possibility Held | Lens (ellipsoid shell, 2 nested layers) plus a bright seam line through the long axis; sparse halo | Left of the seed, wide open field | Pulls back; seed occupies 20 percent of frame, off-centre right | The seam | Seam opens: seam particles become trunk; lower shell → roots, upper shell → shoot |
| 5 | The Growth — Tree | Recursive branching (5–6 levels, 2–3 branches per node, decreasing radius), particles distributed by branch length; roots are a mirrored, flatter copy; brightness rises toward trunk | Right of the trunk, mid-height | Frontal, tree slightly left; slow 1° breathing sway via flow attribute | Tip of the highest branch | Upper branches sort by lateral position and sweep into wing span; trunk → body |
| 6 | The Flight — Bird | GLB (low-poly bird, wings extended), 60 percent edge-sampled, 40 percent surface; feather outlines get brightness bump | Beneath the lifted wing, lower-left | Three-quarter from below-front, slight upward drift as if lifting | Wing tip | Wings sweep forward and split by left/right into two streams (sort by lateral sign then span) |
| 7 | The Reach — Two Hands | Two GLB hand meshes, open, reaching, mirrored; fingers edge-weighted; small gap between fingertips | Above the gap | Frontal, hands fill lower 60 percent of frame | Both index fingertips | Fingertips approach; a thread of 200 particles crosses the gap first, then the rest follow to become a deck |
| 8 | The Connection — Bridge | Deck as a shallow catenary between two abutments; two arches (curved palms become arches); cables as vertical lines; flow attribute along deck for "traffic" | Under the main arch | Rises from under the deck to above it during Rest | Midspan on the deck | Camera continues to rise; deck extends into a branching network; brightness clusters seed the buildings |
| 9 | The Shared World — City | Procedural grid with gaps (plazas), 60–90 boxes of varied height, particles on vertical edges and rooftops; street flow attribute for moving points | Sky above the skyline (upper 45 percent) | Elevated three-quarter, slow pull-back | Top of the tallest tower | Pull back continues; ground plane bends around a sphere (positions projected onto a globe) |
| 10 | The Whole — Planet | Fibonacci sphere; brightness from 3-octave noise thresholded into "continents" and city clusters; thin atmosphere ring (haze layer) with limb glow | Left of the globe (globe off-centre right) | Wide, globe fills 35 percent of frame; 0.01 rad/s rotation | The pole | Surface patterns sweep into concentric strands (positions re-parameterised by latitude → radius) |
| 11 | The Wonder — Eye | Iris: 5–7 concentric rings with radial strand noise; empty pupil; almond outline; a faint 400-particle spiral inside the pupil | Below the eye | Slow push toward the pupil | Iris highlight (catchlight) | Iris loosens into trails; pupil spiral expands; camera continues through |
| 12 | The Return — Galaxy | Identical buffer to chapter 1 | Upper-left, as chapter 1 | Settles into the chapter 1 pose, rotation resumes | Tip of the leading arm (same star as chapter 1) | Text fades; Replay and Share appear after 4 seconds of hold |

Words (one line each, from the brief):

1. Everything begins with possibility.
2. A small movement can change the course.
3. Change gathers strength.
4. Even the smallest beginning holds a world.
5. What grows reaches beyond itself.
6. Then comes the courage to let go.
7. Across the distance, we find each other.
8. What we make together carries us further.
9. A thousand separate lives. A world in common.
10. There is more holding us together than we can see.
11. And still, we look up.
12. The same light. Still becoming.

Reference images for chapters 2–6 are in `docs/references/`. They set the visual target: dark ground, warm-white cores with cool blue dust, edge-heavy line work rather than filled silhouettes, and a deliberate empty region in each composition.

---

## 5. Project structure

```
/
├─ index.html                 # canvas + 12 text sections + replay/share
├─ src/
│  ├─ main.ts                 # boot, tier detection, loop
│  ├─ scene/
│  │  ├─ Renderer.ts          # renderer, composer, bloom, tone map
│  │  ├─ Camera.ts            # scripted path + parallax + rest-phase orbit
│  │  ├─ Background.ts        # static starfield + near stars
│  │  └─ Particles.ts         # Points, attributes, slot A/B management
│  ├─ shaders/
│  │  ├─ particles.vert.glsl
│  │  ├─ particles.frag.glsl
│  │  ├─ haze.vert.glsl / haze.frag.glsl
│  │  └─ noise.glsl           # simplex + curl, #included
│  ├─ formations/
│  │  ├─ types.ts             # Formation interface, hero slot names
│  │  ├─ assemble.ts          # sort by flow param, place hero stars
│  │  ├─ galaxy.ts  river.ts  wave.ts  seed.ts  tree.ts
│  │  ├─ bird.ts  hands.ts    # MeshSurfaceSampler based
│  │  ├─ bridge.ts  city.ts  planet.ts  eye.ts
│  │  └─ worker.ts            # runs generators off the main thread
│  ├─ timeline/
│  │  ├─ Scroll.ts            # lenis wrapper → master T
│  │  ├─ Phases.ts            # T → chapter, phase, morph target, text alpha
│  │  └─ chapters.ts          # per-chapter camera keys, text anchors, copy
│  ├─ ui/
│  │  ├─ Text.ts              # applies alpha/transform to the 12 sections
│  │  └─ Controls.ts          # scroll cue, replay, share
│  └─ config/
│     ├─ tiers.ts             # particle counts, bloom quality per tier
│     └─ palette.ts           # ported star distribution + ground/haze colours
├─ public/
│  ├─ models/bird.glb  hands.glb
│  ├─ fonts/
│  └─ textures/feathered60.png
├─ docs/
│  ├─ PLAN.md                 # this file
│  └─ references/             # the five reference images
└─ legacy/                    # finished/ and starter_project/ from the tutorial
```

---

## 6. Performance budget and tiers

Target: 60 fps on a 2020 MacBook Air, 30+ fps on a mid-range Android phone, first paint under 1 second, chapter 1 interactive under 1.5 seconds on 4G.

| Tier | Detection | Particles | Haze | Bloom | DPR cap |
|---|---|---|---|---|---|
| High | Desktop, `deviceMemory ≥ 8`, no `MaxTextureSize` limits, first 30 frames ≥ 55 fps | 180k | 3k | Full, 5 mip levels | 1.5 |
| Medium | Desktop or tablet not meeting High | 100k | 2k | Full, 4 mip levels | 1.25 |
| Low | Phone, or any device dropping below 40 fps for 2 seconds | 45k | 1k | Half-res, 3 mip levels | 1.0 |
| Fallback | No WebGL2 | — | — | — | Static poster image per chapter, text still scrolls |

Rules: one draw call for the main particles; no per-frame CPU loops over particles; formation generation in a worker; `requestAnimationFrame` paused when the tab is hidden; frame loop runs on demand (only when `T`, time-based idle motion, or pointer changes, which in practice is always while visible, but the plumbing is there). Total JS under 250 KB gzipped. Models under 150 KB each. Fonts subset to Latin.

---

## 7. Accessibility, motion, and fallbacks

- `prefers-reduced-motion`: morphs become 600 ms cross-dissolves at each chapter boundary (opacity down, positions jump, opacity up), idle drift and pointer parallax off, twinkle amplitude quartered, camera holds a single pose per chapter. Text transitions become fades only.
- Text is real DOM in reading order. The document has a `<main>` and twelve `<section>`s, each with a visually hidden `<h2>` ("Chapter 3 — The Tide") ahead of the line of copy.
- Keyboard: Page Down / arrows scroll natively. Replay and Share are `<button>` and `<a>` with visible focus rings.
- Contrast: `#e8e4dc` on `#02040a` far exceeds AA. We also enforce a rule in the placement pass that no more than 4 percent of pixels in a text's bounding box carry bright particles during Rest (measured once per chapter in dev with a readback, not at runtime).
- No WebGL2: a poster image per chapter (rendered from the real scene) and the text still scroll. The experience degrades to a quiet illustrated poem rather than a blank page.
- Meta: title, description, Open Graph image (chapter 3 wave render), theme colour. Single route, so no routing concerns.

---

## 8. Milestones

Each milestone has a demoable outcome and a gate. Estimates are working days for one person.

**M0 — Foundation (2–3 days)**
Vite + TS scaffold. Port galaxy to a single `Points` with the custom shader, bloom via `postprocessing`, scripted static camera, background starfield. Move tutorial code to `legacy/`.
Gate: chapter 1 renders at 60 fps with 180k particles on a laptop and looks at least as good as the tutorial output.

**M1 — Morph engine and timeline (3–4 days)**
Slot A/B attributes, stagger, curl-noise travel arcs, smoothed `uProgress`. Lenis scroll → master `T`. Phase mapper. Text layer with the first two lines. River generator. Correspondence sort.
Gate: scroll galaxy → river → galaxy and back, and the arm visibly unwinding into the current reads as one continuous motion. Text enters and leaves on the rhythm in §3.5.

**M2 — Procedural formations (5–6 days)**
Wave, seed, tree, bridge, city, planet, eye generators with brightness and flow attributes. Hero slot assignment. Idle motion (rotation, drift, twinkle) per formation.
Gate: all nine procedural chapters scroll end to end. Each formation is recognisable in a 2-second glance without its caption.

**M3 — Mesh-sampled formations (3–4 days)**
Source or author low-poly bird and hands GLBs. Edge-weighted sampling. Tree → bird and bird → hands correspondence. Hands → bridge thread moment.
Gate: bird and hands read at the same clarity as the reference images. Wing tips and fingertips are hero stars.

**M4 — Camera, composition, typography (3–4 days)**
Per-chapter camera keyframes, pointer parallax, rest-phase orbit. Text anchors tuned for desktop, tablet, portrait phone. Negative-space readback check. Font decision and self-hosting.
Gate: every line of copy is readable at rest on all three breakpoints without a backplate. Camera never exposes an empty or broken view mid-morph.

**M5 — Performance, fallbacks, polish (3 days)**
Tier detection, worker generation, loading order, reduced motion, no-WebGL poster fallback, replay and share, scroll cue, OG image, favicon, vignette and grain.
Gate: Lighthouse performance ≥ 90 on desktop, ≥ 75 on a mid-range phone profile. Reduced-motion mode is a complete experience. `axe` reports no violations.

**M6 — QA and launch (2 days)**
Cross-browser (Chrome, Safari, Firefox, iOS Safari, Android Chrome). Real-device pass on two phones. Deploy to static hosting with a custom domain and cache headers.
Gate: sign-off on real devices. Public URL.

Total: roughly 21–26 working days. M2 and M3 can run in parallel if two people are on it.

---

## 9. Open decisions

These are yours to make. Defaults are listed so the build can proceed if you'd rather not decide now.

1. **Typeface.** Cormorant Garamond Light (literary, quiet), Fraunces Light (warmer, more character), or Inter Light (neutral, modern). Default: Cormorant Garamond Light.
2. **Bird and hands source.** Buy or download CC0 low-poly GLBs and adapt, or author in Blender (about a day). Default: CC0 models, adapted.
3. **Rest-phase drag orbit.** Keep it (brief asks for camera control) or drop it to protect composition. Default: keep, limited to ±25°.
4. **Sound.** The brief doesn't mention audio. A single low ambient drone with a muted-by-default toggle would suit the tone. Default: no audio in v1, leave a hook.
5. **Hosting.** GitHub Pages from this repo (free, simple), or Netlify/Vercel (preview deploys per PR). Default: GitHub Pages with a deploy workflow.
6. **Chapter length.** 300vh per chapter is the starting point. We'll feel this out in M1 and may go to 250vh or 350vh.

---

## 10. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Bird and hands don't read as clearly as the references from particles alone | Medium | Edge-weighted sampling, higher brightness on outlines, camera framing with the silhouette against empty sky. Prototype in M3 before tuning other chapters. |
| A morph looks like a scramble rather than a transformation | Medium | Correspondence sort by flow parameter, stagger, travel arcs. Test each transition in isolation with a debug slider before wiring to scroll. |
| Mobile GPUs choke on bloom + 100k additive points | Medium | Tier system, half-res bloom, particle counts per tier, runtime downgrade on sustained frame drops. |
| Text collides with bright particles at some breakpoints | Medium | Per-breakpoint anchors, dev-time readback check, brightness attribute lets us dim a region without moving stars. |
| Scroll feels too long or too short | Low | Chapter length is one constant; tune in M1. |
| Formation generation blocks the intro | Low | Worker, galaxy first, stream the rest. |

---

## 11. Next step

Start M0 on this branch: scaffold Vite + TypeScript, port the galaxy to a single `Points` with the custom shader, and get chapter 1 rendering at 60 fps with bloom. Then M1 proves the whole idea on the galaxy → river transition before we invest in the other ten forms.
