import * as THREE from 'three';

// Stylised water + sandy beach skirt that turns the flat farm ground into an
// island. Add the returned group to the SAME group as the ground plane (the
// environment group) so it shifts together; the shader uses the plane's LOCAL
// coordinates (island-centered) so the shoreline stays aligned regardless.
//
// The look is deliberately flat and graphic, in the mould of Hay Day / Township:
// a single sheet of colour, scattered crisp patches of lighter water, and a
// two-part shoreline (tight white rim + wide soft haze). No specular, no
// posterised depth bands, no whitecaps — flatness is the whole point, so
// anything that shades the surface fights the style.

const WATER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmp;   // swell height. 0 = dead flat, matching the reference art
  uniform float uWaveScale; // world size of one swell (bigger = broader rollers)
  varying vec2 vLocal; // island-local X,Z (before the -90deg rotation)

  void main() {
    vec3 displaced = position;

    // The surface is flat by default. There is no lighting on this material, so
    // a swell only reads as a wobble of the silhouette and of the shoreline —
    // enough to stop the sea feeling frozen if you want it, off by default.
    float f = 1.0 / max(uWaveScale, 0.001);
    displaced.z += uWaveAmp * sin(position.x * f + uTime * 0.9);
    displaced.z += uWaveAmp * 0.6 * sin(position.y * f * 1.7 + uTime * 1.2);

    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const WATER_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uWaterColor;
  uniform vec3 uPatchColor;
  uniform vec3 uFoamColor;
  uniform float uShoreEdge; // world distance from centre to the sand's outer edge
  uniform float uPatchScaleBig;
  uniform float uPatchScaleSmall;
  uniform float uPatchThresholdBig;
  uniform float uPatchThresholdSmall;
  uniform float uPatchSoftness;
  uniform float uPatchOpacity;
  uniform float uPatchDrift;
  uniform float uRimWidth;
  uniform float uRimSoftness;
  uniform float uHazeWidth;
  uniform float uHazeStrength;
  uniform float uShoreWobble;
  uniform float uShoreDrift;
  varying vec2 vLocal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Two octaves only, normalised to 0..1. Deliberately smoother than a 4-octave
  // fbm: the patches want simple rounded contours, and extra octaves just make
  // their edges fizzy once we threshold them.
  float fbm2(vec2 p) {
    float v = 0.6 * noise(p) + 0.3 * noise(p * 2.0);
    return v / 0.9;
  }
  // Rougher field, used only to break up the shoreline.
  float fbm4(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }

  // NOTE: every smoothstep below is written ASCENDING (edge0 < edge1) and its
  // width is forced positive. GLSL leaves smoothstep UNDEFINED when
  // edge0 >= edge1, and drivers that return 1.0 for that case flood the whole
  // plane with foam colour — which looks like flat, featureless water.
  // Invert with 1.0 - smoothstep(...) instead of swapping the edges.

  // Threshold a noise field into a flat patch. The softness is tiny — just wide
  // enough to antialias — so the shapes read as painted cut-outs with a crisp
  // edge rather than soft clouds. (Not named "patch": that is a reserved word.)
  float blobAt(vec2 p, float scale, float threshold, vec2 drift) {
    float n = fbm2(p * scale + drift);
    float w = max(uPatchSoftness, 0.0001);
    return smoothstep(threshold, threshold + w, n);
  }

  void main() {
    vec2 uv = vLocal;
    vec2 drift = vec2(uTime * uPatchDrift, uTime * uPatchDrift * 0.6);

    // 1. A single flat sheet of colour. No gradient, no shading, no depth ramp.
    vec3 color = uWaterColor;

    // 2. Scattered patches of lighter water, at two scales so big amoeba shapes
    //    and small flecks mix the way they do in the reference art.
    float big = blobAt(uv, uPatchScaleBig, uPatchThresholdBig, drift);
    float small = blobAt(uv, uPatchScaleSmall, uPatchThresholdSmall, -drift * 1.3);
    color = mix(color, uPatchColor, max(big, small) * uPatchOpacity);

    // 3. Shoreline. Distance BEYOND the sand's outer edge, wobbled so it never
    //    traces the perfect square the island actually is.
    float d = max(abs(uv.x), abs(uv.y));
    float shore = d - uShoreEdge + (fbm4(uv * 0.4 + uTime * uShoreDrift) - 0.5) * uShoreWobble;

    //    Both foam terms below are written as "1.0 - smoothstep(...)", so both
    //    saturate to 1.0 for ANY point shoreward of the edge — everything inside
    //    the island renders as solid foam white. That was free while the land
    //    covered all of it, but a channel cut through the island (see the
    //    channel option on createIslandWater) opens a window onto that water,
    //    and it came through as a white stripe instead of a stream.
    //
    //    So the foam is gated to a band around the edge. The gate is still 1 at
    //    the shoreline itself — the wobble only shifts shore by about ±0.11 there,
    //    well inside the fade — so the sea is untouched, and it reaches 0 a
    //    couple of haze-widths in, which is the water a channel exposes.
    float atShore = smoothstep(-3.0 * uHazeWidth, -0.5 * uHazeWidth, shore);

    //    A wide, soft bloom of pale water fading out to sea...
    float haze = 1.0 - smoothstep(0.0, max(uHazeWidth, 0.0001), shore);
    color = mix(color, uFoamColor, haze * uHazeStrength * atShore);

    //    ...and a brighter, tighter band hugging the sand itself.
    float rimSoft = max(uRimSoftness, 0.0001);
    float rim = 1.0 - smoothstep(uRimWidth - rimSoft, uRimWidth + rimSoft, shore);
    color = mix(color, uFoamColor, rim * atShore);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Water look. Every value is overridable per-call via `opts.water`, so the style
 * can be tuned from IslandScene without touching the shader. All distances are
 * in world units — scale them alongside ISLAND_SIZE if you resize the island.
 */
const WATER = {
  // --- the flat sheet ---
  waterColor: 0x5fc9f2, // the one base colour of the open sea
  patchColor: 0xa2e6fa, // the lighter blue of the scattered patches
  foamColor: 0xffffff,

  // --- how the detail scales with the camera ---
  // Blob size and foam width are in world units, which means a zoomed-in camera
  // can frame less world than a single feature and see nothing but flat colour.
  // To avoid re-tuning every time the shot changes, pass `viewRadius` (the
  // scene's FIT_RADIUS) and every size below is scaled by referenceView/viewRadius
  // — so the water keeps the same look ON SCREEN at any zoom. The numbers below
  // are therefore "as seen when the camera frames referenceView world units".
  referenceView: 16, // the framing these defaults describe. Omit viewRadius to disable scaling.

  // --- scattered light patches ---
  patchScaleBig: 0.6, // noise frequency of the large blobs. higher = smaller, busier
  patchScaleSmall: 1.62, // frequency of the small flecks
  patchThresholdBig: 0.7, // cut point. HIGHER = fewer and smaller patches
  patchThresholdSmall: 0.8, // these two scatter patches over roughly a tenth of the sea
  patchSoftness: 0.04, // edge feather. keep tiny — this is what makes them crisp cut-outs
  patchOpacity: 1.0, // 1 = flat solid patches, lower = tinted
  patchDrift: 0.03, // slow drift so the sea is not frozen. 0 = perfectly still

  // --- shoreline, measured outward from the sand's edge ---
  rimWidth: 1.0, // width of the bright band against the sand
  rimSoftness: 0.5, // its feather. small = a crisp painted line
  hazeWidth: 3.0, // how far the soft pale bloom reaches out to sea
  hazeStrength: 0.5, // how white that bloom gets at the shore
  shoreWobble: 1.2, // noise that stops the shoreline tracing a square
  shoreDrift: 0.08, // how fast that wobble crawls, so the foam edge breathes

  // --- surface ---
  // The material is unlit, so a swell does not shade — it displaces the vertices
  // while the colour stays pinned to their original position, which ripples the
  // pattern and the shoreline silhouette. Subtle by nature; 0 = dead flat.
  waveAmp: 0.15, // swell height
  waveScale: 2.4 // world size of one swell
};

/**
 * @param {{ islandHalf?: number, waterSize?: number, waterY?: number,
 *   beachSize?: number, viewRadius?: number, sunDir?: number[], viewDir?: number[],
 *   channel?: { x: number, width: number }, water?: Partial<typeof WATER> }} opts
 *   `channel` slots a gap through the beach skirt so the sea shows through it
 *   as a stream. Cut the matching gap in the land above it.
 *   `viewRadius` is how much world the camera frames (the scene's FIT_RADIUS).
 *   Pass it and the detail auto-scales to the shot; omit it for plain world units.
 *   `sunDir`/`viewDir` are accepted but unused — the surface is unlit by design.
 * @returns {{ group: THREE.Group, update: (elapsedSeconds: number) => void }}
 */
export function createIslandWater(opts = {}) {
  const islandHalf = opts.islandHalf ?? 24;
  const waterSize = opts.waterSize ?? 400;
  const waterY = opts.waterY ?? -0.4;
  const beachSize = opts.beachSize ?? islandHalf * 2 + 2;
  const beachHeight = 8;
  const cfg = { ...WATER, ...(opts.water ?? {}) };

  // Detail scale. `k` > 1 means the camera frames less world than the defaults
  // assume, so features shrink to keep the same apparent size on screen — a
  // zoomed-in shot gets smaller blobs and a narrower foam band rather than
  // sitting inside one giant blob and a wall of white. Omitting viewRadius
  // leaves k = 1, i.e. plain world units (what FarmBoot gets).
  const k = cfg.referenceView / (opts.viewRadius ?? cfg.referenceView);

  const group = new THREE.Group();
  group.name = 'islandWater';

  // Sandy beach skirt: a box a touch larger than the grass, its top just below
  // the grass so a sand rim shows around the edge and a cliff drops into the sea.
  //
  // `channel` cuts a gap straight through it, running the full depth in Z. The
  // skirt is what fills every inch under the island, so cutting it is what lets
  // the sea BELOW show through as a stream — the same surface, the same shader,
  // the same swell, just seen through a slot. Whatever cuts the same gap in the
  // grass above (see IslandScene's slabs) has to agree on x and width.
  const sand = new THREE.MeshStandardMaterial({ color: 0xefc85a, roughness: 1 });
  const skirt = (fromX, toX) => {
    const width = toX - fromX;
    if (width <= 0) return;
    const beach = new THREE.Mesh(new THREE.BoxGeometry(width, beachHeight, beachSize), sand);
    beach.position.set(fromX + width / 2, -0.02 - beachHeight / 2, 0);
    beach.receiveShadow = true;
    group.add(beach);
  };

  const channel = opts.channel;
  if (channel) {
    // The sand is pulled back a little FURTHER than the land it sits under.
    // Cutting both at the same x leaves the skirt's side wall exactly coplanar
    // with the grass slab's, and two coplanar faces z-fight — it reads as a
    // stitched green-and-sand dashed line down the bank. Set back, the sand
    // wall hides behind the grass wall, and everything below the waterline is
    // covered by the sea anyway.
    const relief = 0.15;
    skirt(-beachSize / 2, channel.x - channel.width / 2 - relief);
    skirt(channel.x + channel.width / 2 + relief, beachSize / 2);
  } else {
    skirt(-beachSize / 2, beachSize / 2);
  }

  // Water plane surrounding the island.
  const geo = new THREE.PlaneGeometry(waterSize, waterSize, 128, 128);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWaterColor: { value: new THREE.Color(cfg.waterColor) },
      uPatchColor: { value: new THREE.Color(cfg.patchColor) },
      uFoamColor: { value: new THREE.Color(cfg.foamColor) },
      // Foam is measured from the SAND's outer edge, not the grass, so a width
      // of 0 sits exactly where the water meets the beach.
      uShoreEdge: { value: beachSize / 2 },
      uPatchScaleBig: { value: cfg.patchScaleBig * k },
      uPatchScaleSmall: { value: cfg.patchScaleSmall * k },
      uPatchThresholdBig: { value: cfg.patchThresholdBig },
      uPatchThresholdSmall: { value: cfg.patchThresholdSmall },
      uPatchSoftness: { value: cfg.patchSoftness },
      uPatchOpacity: { value: cfg.patchOpacity },
      uPatchDrift: { value: cfg.patchDrift },
      uRimWidth: { value: cfg.rimWidth / k },
      uRimSoftness: { value: cfg.rimSoftness / k },
      uHazeWidth: { value: cfg.hazeWidth / k },
      uHazeStrength: { value: cfg.hazeStrength },
      uShoreWobble: { value: cfg.shoreWobble / k },
      uShoreDrift: { value: cfg.shoreDrift },
      uWaveAmp: { value: cfg.waveAmp / k },
      uWaveScale: { value: cfg.waveScale / k }
    },
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG
  });
  const water = new THREE.Mesh(geo, mat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY;
  water.renderOrder = -1; // draw before props
  group.add(water);

  return {
    group,
    update(elapsedSeconds) {
      mat.uniforms.uTime.value = elapsedSeconds;
    }
  };
}
