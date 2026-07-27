// 3D island scene rendered with Three.js, styled after bright cartoon farm games
// (FarmVille-like): a grass island ringed by a sandy beach, sitting in stylized
// toon water, viewed through a tilted perspective camera.
//
// The camera is perspective (not orthographic) to match the reference's 3/4
// depth falloff. Framing uses the island's bounding sphere so it stays fitted on
// any aspect ratio (tall portrait or landscape).
import * as THREE from 'three';
import groundTextureSrc from 'assets/images/Ground3.jpg';

// Camera.
const CAM_FOV = 34;
const CAM_ELEV_DEG = 45; // tilt down from horizontal
const CAM_AZIM_DEG = 65; // rotation around the island (3/4 view)
const FIT_RADIUS = 2; // world radius kept in frame (smaller = more zoomed in)
// Aim point, offset toward the island's +X (screen top-right) edge so the land
// fills the frame and water is only visible in the top-right corner.
const CAM_TARGET = new THREE.Vector3(-15, 3, 4);

// Island (grass) block.
const ISLAND_SIZE = 40;
const ISLAND_HEIGHT = 2;
const ISLAND_TOP_Y = 0.6; // grass top above the water surface
const TEXTURE_REPEAT = 3;
const GRASS_TINT = 0x8fe25a; // multiplies the lime texture toward a vivid green
const SAND_COLOR = 0xf3c53f; // golden-yellow beach

// Beach (sand platform under/around the grass).
const BEACH_SIZE = 41;
const BEACH_HEIGHT = 2.2;
const BEACH_TOP_Y = 0.2; // sand top just above the water surface

// Water.
const WATER_SIZE = 240; // large so its far edge stays off-screen
const WATER_SEGMENTS = 128;

const WATER_VERT = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  // Directional sine waves; also accumulate the height gradient for the normal.
  void addWave(vec2 dir, float amp, float freq, float speed, inout float h, inout vec2 grad) {
    vec2 d = normalize(dir);
    float phase = dot(d, position.xy) * freq + uTime * speed;
    h += amp * sin(phase);
    grad += d * (amp * freq * cos(phase));
  }

  void main() {
    float h = 0.0;
    vec2 grad = vec2(0.0);
    addWave(vec2(1.0, 0.0), 0.10, 0.50, 1.0, h, grad);
    addWave(vec2(0.4, 1.0), 0.06, 0.85, 1.3, h, grad);

    vec3 displaced = position;
    displaced.z += h;

    vec3 localN = normalize(vec3(-grad.x, -grad.y, 1.0));
    vNormal = normalize(mat3(modelMatrix) * localN);

    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const WATER_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uViewDir;
  uniform float uIslandHalf;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  // Value noise + fbm for the mottled toon-water patches.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vWorldPos.xz;

    // Saturated blue base with lighter aqua patches (mottling).
    float mottle = fbm(uv * 0.12 + uTime * 0.02);
    vec3 color = mix(uDeepColor, uShallowColor, smoothstep(0.45, 0.88, mottle));

    // Scattered brighter aqua blotches.
    float blotch = fbm(uv * 0.28 - uTime * 0.03);
    color = mix(color, uShallowColor, smoothstep(0.60, 0.85, blotch) * 0.6);

    // Distance to the (square) island edge.
    float d = max(abs(vWorldPos.x), abs(vWorldPos.z));

    // Soft lighter shallows a little further out from shore.
    float shallow = smoothstep(uIslandHalf + 7.0, uIslandHalf + 2.5, d);
    color = mix(color, uShallowColor * 1.1, shallow * 0.5);

    // Crisp white foam rim hugging the shoreline, wobbled by noise so the edge
    // isn't a perfect square.
    float wobble = (fbm(uv * 0.5 + uTime * 0.05) - 0.5) * 2.2;
    float foam = smoothstep(uIslandHalf + 2.2, uIslandHalf + 0.5, d + wobble);
    color = mix(color, uFoamColor, foam * 0.9);

    // Soft, gentle sun sparkle from the wave normals.
    vec3 N = normalize(vNormal);
    vec3 H = normalize(normalize(uSunDir) + normalize(uViewDir));
    float spec = pow(max(dot(N, H), 0.0), 60.0);
    color += uSunColor * spec * 0.35;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Scene3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private camDir: THREE.Vector3;
  private water!: THREE.Mesh;
  private waterGeo!: THREE.PlaneGeometry;
  private waterMat!: THREE.ShaderMaterial;
  private clock = new THREE.Clock();
  private width: number;
  private height: number;
  private running = true;
  private rafId = 0;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0'
    } as CSSStyleDeclaration);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd6f2); // bright sky

    // Fixed view direction (unit vector) from elevation/azimuth.
    const el = THREE.MathUtils.degToRad(CAM_ELEV_DEG);
    const az = THREE.MathUtils.degToRad(CAM_AZIM_DEG);
    this.camDir = new THREE.Vector3(
      Math.cos(el) * Math.cos(az),
      Math.sin(el),
      Math.cos(el) * Math.sin(az)
    ).normalize();

    this.camera = new THREE.PerspectiveCamera(CAM_FOV, width / height, 0.1, 1000);
    this.updateCamera();

    this.addLights();
    this.addWater();
    this.addBeach();
    this.addIsland();

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  private addLights(): void {
    // Bright, flat cartoon lighting. Only the grass and beach are lit by these
    // (the water is self-lit by its shader), so raising them brightens the land.
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(30, 45, 15);
    this.scene.add(sun);
  }

  private addWater(): void {
    this.waterGeo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGMENTS, WATER_SEGMENTS);
    const sunDir = new THREE.Vector3(30, 45, 15).normalize();

    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x3f9fe0) },
        uShallowColor: { value: new THREE.Color(0x86d6ef) },
        uFoamColor: { value: new THREE.Color(0xffffff) },
        uSunColor: { value: new THREE.Color(0xffffff) },
        uSunDir: { value: sunDir },
        uViewDir: { value: this.camDir.clone() },
        uIslandHalf: { value: BEACH_SIZE / 2 }
      },
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG
    });

    this.water = new THREE.Mesh(this.waterGeo, this.waterMat);
    this.water.rotation.x = -Math.PI / 2; // water surface at y = 0
    this.scene.add(this.water);
  }

  private addBeach(): void {
    const sand = new THREE.MeshStandardMaterial({ color: SAND_COLOR, roughness: 1 });
    const beach = new THREE.Mesh(new THREE.BoxGeometry(BEACH_SIZE, BEACH_HEIGHT, BEACH_SIZE), sand);
    beach.position.y = BEACH_TOP_Y - BEACH_HEIGHT / 2;
    this.scene.add(beach);
  }

  private addIsland(): void {
    const texture = new THREE.TextureLoader().load(groundTextureSrc);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Vivid green grass. The lime Ground3.jpg is tinted toward the reference's
    // saturated green (GRASS_TINT multiplies the texture) with a small green
    // emissive to keep it bright; tweak these two to taste.
    const grass = new THREE.MeshStandardMaterial({
      map: texture,
      color: GRASS_TINT,
      emissive: 0x2f8f3a,
      emissiveIntensity: 0.35,
      roughness: 1
    });
    // Slightly darker green for the island's side "cliff" edges.
    const grassSide = new THREE.MeshStandardMaterial({ color: 0x3f9a2b, roughness: 1 });

    // BoxGeometry material order: [ +x, -x, +y(top), -y(bottom), +z, -z ].
    const geometry = new THREE.BoxGeometry(ISLAND_SIZE, ISLAND_HEIGHT, ISLAND_SIZE);
    const island = new THREE.Mesh(geometry, [grassSide, grassSide, grass, grassSide, grassSide, grassSide]);
    island.position.y = ISLAND_TOP_Y - ISLAND_HEIGHT / 2;
    this.scene.add(island);
  }

  /** Frame the island so it fits on any aspect ratio, aimed at CAM_TARGET. */
  private updateCamera(): void {
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;

    const vFov = THREE.MathUtils.degToRad(CAM_FOV);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const minHalf = Math.min(vFov / 2, hFov / 2);
    const dist = FIT_RADIUS / Math.sin(minHalf);

    // Position along the fixed view direction, offset by the aim point so the
    // island sits toward the bottom-left and water shows only at the top-right.
    this.camera.position.copy(this.camDir).multiplyScalar(dist).add(CAM_TARGET);
    this.camera.lookAt(CAM_TARGET);
    this.camera.near = Math.max(0.1, dist - FIT_RADIUS * 4);
    this.camera.far = dist + FIT_RADIUS * 6;
    this.camera.updateProjectionMatrix();
  }

  private animate(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.animate);
    this.waterMat.uniforms.uTime.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.updateCamera();
  }

  public pause(): void {
    this.running = false;
  }

  public resume(): void {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.animate);
  }

  public destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
