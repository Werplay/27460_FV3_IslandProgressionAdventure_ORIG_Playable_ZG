/**
 * Camera tuning — change these values and refresh to see the difference.
 *
 * projection: 'orthographic' = Hay Day–style (no perspective foreshortening)
 * viewMode:    'isometric'    = angled corner view (not top-down)
 *
 * Zoom in:  lower zoomFactor
 * Zoom out: higher zoomFactor
 * Pan:      change positionOffset x and z
 */
export const CAMERA_CONFIG = {
    projection: 'orthographic',

    // 'isometric' = lookAt focus from a corner angle | 'manual' = use rotation below
    viewMode: 'isometric',

    // --- Perspective only ---
    fov: 100,

    // --- Orthographic only ---
    orthoFitScale: 0.3,

    // Zoomed to frame the island + a water border. Lower = tighter.
    zoomFactor: { portrait: 2.4, landscape: 2.0 },

    // Pan toward the island's left shore. In this iso view screen-LEFT is the
    // diagonal world (-X, +Z) in EQUAL amounts; world -X alone points to the TOP.
    // So keep x and z equal-and-opposite for water on the left:
    //   more left water  -> increase both magnitudes together (e.g. -14 / +14)
    //   water creeping up -> raise z (or reduce -x); creeping down -> lower z.
    positionOffset: {
        portrait: { x: -8, y: 0, z: 8 },
        landscape: { x: -8, y: 0, z: 8 },
    },

    // Used only when viewMode is 'manual'.
    heightFactor: 0.3,
    depthFactor: 0.5,

    // Point the camera looks at.
    focusOffset: { x: 0, y: 0, z: 1 },

    // Isometric corner direction — equal x/z ≈ 45° yaw, y lifts the angle off top-down.
    isometricDirection: { x: 1, y: 1.4, z: 1 },

    useManualRotation: false,
    rotation: { x: -35, y: 45, z: 0 },

    targetSize: 100,
};
