// Soft procedural star: a bright core with a gentle falloff. No texture fetch.

varying vec3 vColor;
varying float vAlpha;
varying float vCore;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;           // 0 at centre, 1 at edge
  if (d > 1.0) discard;
  float halo = pow(1.0 - d, 2.2);
  float core = exp(-d * d * 14.0);
  float a = (halo * 0.55 + core) * vAlpha;
  // Heroes get a whiter, hotter core.
  vec3 c = mix(vColor, vec3(1.0), core * (0.25 + 0.45 * vCore));
  gl_FragColor = vec4(c, a);
}
