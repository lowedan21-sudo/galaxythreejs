import * as THREE from 'three'

/**
 * The deep field: thousands of tiny distant stars on a far sphere that never
 * morph, plus a handful of larger near stars that parallax with the camera.
 * This is what makes the formations feel like they sit *in* space.
 *
 * Draw calls: 2.
 */
export class Background {
  readonly group = new THREE.Group()
  private readonly far: THREE.Points
  private readonly near: THREE.Points
  private readonly farMat: THREE.ShaderMaterial
  private readonly nearMat: THREE.ShaderMaterial

  constructor(count: number, pixelRatio: number) {
    let s = 4242
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 4294967296
    }

    const vert = /* glsl */ `
      uniform float uPixelRatio;
      uniform float uTime;
      uniform float uBaseSize;
      attribute float aSize;
      attribute float aSeed;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.75 + 0.25 * sin(uTime * (0.6 + aSeed) + aSeed * 50.0);
        gl_PointSize = aSize * uBaseSize * uPixelRatio;
        vColor = aColor;
        vAlpha = tw;
      }
    `
    const frag = /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = pow(1.0 - d, 1.8) * vAlpha;
        gl_FragColor = vec4(vColor, a);
      }
    `
    const makeMat = (baseSize: number) =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uPixelRatio: { value: pixelRatio }, uTime: { value: 0 }, uBaseSize: { value: baseSize } },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      })

    // Far field: uniform on a sphere of radius 60, slightly denser near the
    // galactic plane so it reads as a sky rather than static.
    const farPos = new Float32Array(count * 3)
    const farSize = new Float32Array(count)
    const farSeed = new Float32Array(count)
    const farColor = new Float32Array(count * 3)
    const palette = [
      [1.0, 0.86, 0.62],
      [1.0, 0.93, 0.86],
      [0.93, 0.95, 1.0],
      [0.72, 0.8, 1.0],
    ]
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1
      const phi = rand() * Math.PI * 2
      const y = u * (0.35 + 0.65 * rand()) // squash toward the plane a little
      const r = Math.sqrt(1 - y * y)
      const R = 60
      farPos[i * 3] = R * r * Math.cos(phi)
      farPos[i * 3 + 1] = R * y
      farPos[i * 3 + 2] = R * r * Math.sin(phi)
      const big = rand()
      farSize[i] = big > 0.985 ? 2.6 : big > 0.9 ? 1.6 : 1.0
      farSeed[i] = rand()
      const c = palette[Math.min(3, Math.floor(rand() * 4))]
      const dim = 0.35 + rand() * 0.45
      farColor[i * 3] = c[0] * dim
      farColor[i * 3 + 1] = c[1] * dim
      farColor[i * 3 + 2] = c[2] * dim
    }
    const farGeo = new THREE.BufferGeometry()
    farGeo.setAttribute('position', new THREE.BufferAttribute(farPos, 3))
    farGeo.setAttribute('aSize', new THREE.BufferAttribute(farSize, 1))
    farGeo.setAttribute('aSeed', new THREE.BufferAttribute(farSeed, 1))
    farGeo.setAttribute('aColor', new THREE.BufferAttribute(farColor, 3))
    this.farMat = makeMat(1.1)
    this.far = new THREE.Points(farGeo, this.farMat)
    this.far.frustumCulled = false

    // Near stars: 8 brighter points a few units out, for parallax.
    const nearCount = 8
    const nearPos = new Float32Array(nearCount * 3)
    const nearSize = new Float32Array(nearCount)
    const nearSeed = new Float32Array(nearCount)
    const nearColor = new Float32Array(nearCount * 3)
    for (let i = 0; i < nearCount; i++) {
      const a = rand() * Math.PI * 2
      const r = 9 + rand() * 8
      nearPos[i * 3] = Math.cos(a) * r
      nearPos[i * 3 + 1] = (rand() - 0.5) * 8
      nearPos[i * 3 + 2] = Math.sin(a) * r
      nearSize[i] = 5 + rand() * 4
      nearSeed[i] = rand()
      const c = palette[1 + Math.floor(rand() * 3)]
      nearColor[i * 3] = c[0] * 0.9
      nearColor[i * 3 + 1] = c[1] * 0.9
      nearColor[i * 3 + 2] = c[2] * 0.9
    }
    const nearGeo = new THREE.BufferGeometry()
    nearGeo.setAttribute('position', new THREE.BufferAttribute(nearPos, 3))
    nearGeo.setAttribute('aSize', new THREE.BufferAttribute(nearSize, 1))
    nearGeo.setAttribute('aSeed', new THREE.BufferAttribute(nearSeed, 1))
    nearGeo.setAttribute('aColor', new THREE.BufferAttribute(nearColor, 3))
    this.nearMat = makeMat(1.0)
    this.near = new THREE.Points(nearGeo, this.nearMat)
    this.near.frustumCulled = false

    this.group.add(this.far, this.near)
    this.group.renderOrder = -2
  }

  setPixelRatio(pr: number): void {
    this.farMat.uniforms.uPixelRatio.value = pr
    this.nearMat.uniforms.uPixelRatio.value = pr
  }

  update(time: number): void {
    this.farMat.uniforms.uTime.value = time
    this.nearMat.uniforms.uTime.value = time
  }

  dispose(): void {
    this.far.geometry.dispose()
    this.near.geometry.dispose()
    this.farMat.dispose()
    this.nearMat.dispose()
  }
}
