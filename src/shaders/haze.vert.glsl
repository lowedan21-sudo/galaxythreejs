// Haze puffs: large, faint, textured sprites that ride the same A/B morph so
// dust drifts with the stars.

uniform float uTime;
uniform float uProgress;
uniform float uPixelRatio;
uniform float uProjScale;
uniform float uSpinA;
uniform float uSpinB;

attribute vec3 aPosA;
attribute vec3 aPosB;
attribute float aSize;
attribute float aSeed;

varying float vAlpha;

vec3 rotateY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  float t = clamp((uProgress - aSeed * 0.35) / 0.65, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  vec3 p = mix(rotateY(aPosA, uSpinA), rotateY(aPosB, uSpinB), t);
  p.y += sin(uTime * 0.2 + aSeed * 6.28) * 0.03;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aSize * uProjScale / max(-mv.z, 0.2);
  gl_PointSize = clamp(size, 2.0, 220.0 * uPixelRatio);
  // Fade haze that is too close to the camera so it never fills the frame.
  vAlpha = smoothstep(0.5, 3.0, -mv.z) * (0.7 + 0.3 * sin(uTime * 0.15 + aSeed * 9.0));
}
