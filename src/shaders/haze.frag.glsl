uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;

varying float vAlpha;

void main() {
  float a = texture2D(uMap, gl_PointCoord).a * vAlpha * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
