// Star particle vertex shader.
//
// Each particle carries two target positions (formation A and B). uProgress
// blends between them with per-particle stagger and a curl-noise travel arc,
// then idle drift, spin and twinkle are layered on top.

uniform float uTime;
uniform float uProgress;      // 0 = fully A, 1 = fully B
uniform float uPixelRatio;
uniform float uProjScale;     // pixelRatio * viewportHeight / (2 tan(fov/2))
uniform float uSizeScale;     // star diameter in world units
uniform float uSpinA;         // radians of idle rotation for formation A
uniform float uSpinB;
uniform float uArcAmp;        // travel arc amplitude during a morph
uniform float uDriftAmp;      // idle drift amplitude
uniform float uIntensity;     // per-star alpha, scaled by particle count so tiers match
uniform vec3 uColorTable[6];
uniform float uSizeTable[6];

attribute vec3 aPosA;
attribute vec3 aPosB;
attribute float aBrightA;
attribute float aBrightB;
attribute vec3 aFlowA;
attribute vec3 aFlowB;
attribute float aType;
attribute float aSeed;
attribute float aHero;

varying vec3 vColor;
varying float vAlpha;
varying float vCore;

#include <noise>

vec3 rotateY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

float easeInOut(float t) {
  return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
}

void main() {
  // Stagger: each particle starts its journey at a slightly different moment.
  float stagger = aSeed * 0.35;
  float t = clamp((uProgress - stagger) / (1.0 - 0.35), 0.0, 1.0);
  t = easeInOut(t);

  vec3 pa = rotateY(aPosA, uSpinA);
  vec3 pb = rotateY(aPosB, uSpinB);
  vec3 p = mix(pa, pb, t);

  // Travel arc: bow outward mid-transition along a divergence-free field so
  // the morph reads as flow, not a straight-line scramble.
  float arc = sin(t * 3.14159265) * uArcAmp;
  if (arc > 0.0001) {
    p += curlNoise(p * 0.6 + aSeed * 3.0) * arc * (0.6 + 0.8 * aSeed);
  }

  // Idle drift: local motion along the formation's flow field plus a slow
  // low-frequency wobble so a held formation never looks frozen.
  vec3 flow = mix(aFlowA, aFlowB, t);
  float phase = uTime * 0.35 + aSeed * 6.2831853;
  p += flow * sin(phase) * 2.0 * uDriftAmp;
  p += vec3(
    snoise(p * 0.8 + vec3(0.0, uTime * 0.05, 0.0)),
    snoise(p * 0.8 + vec3(17.0, uTime * 0.04, 3.0)),
    snoise(p * 0.8 + vec3(5.0, 11.0, uTime * 0.05))
  ) * 0.012 * uDriftAmp;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // Twinkle: gentle, per-star phase, faster for the brighter types.
  int type = int(aType + 0.5);
  float tw = 0.78 + 0.22 * sin(uTime * (1.2 + 0.4 * aType) + aSeed * 40.0);

  float bright = mix(aBrightA, aBrightB, t) * tw;
  float hero = step(0.5, aHero);
  float sizeMul = uSizeTable[type] * (1.0 + hero * 1.6);
  float size = sizeMul * uSizeScale * uProjScale / max(-mv.z, 0.2);
  gl_PointSize = clamp(size, 1.0, 48.0 * uPixelRatio);

  vColor = uColorTable[type] * (1.0 + hero * 0.15);
  // Sub-pixel stars fade rather than pop.
  vAlpha = bright * uIntensity * clamp(size, 0.55, 1.0);
  vCore = hero;
}
