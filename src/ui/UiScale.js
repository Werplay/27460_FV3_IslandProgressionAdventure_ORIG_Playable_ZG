/** Design resolution — matches main.js projectWidth / projectHeight. */
export const UI_DESIGN = {
    width: 1136,
    height: 640,
};

/** Match main.js resize logic (window aspect), not Phaser internal scale. */
export function getOrientation (scene)
{
    if (typeof window !== 'undefined' && window.innerWidth && window.innerHeight)
    {
        return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    }

    return scene.scale.width > scene.scale.height ? 'landscape' : 'portrait';
}

/** Uniform scale so fixed px values fit any aspect ratio / orientation. */
export function getUiScale (scene)
{
    const { width, height } = scene.scale;

    return Math.min(
        width / UI_DESIGN.width,
        height / UI_DESIGN.height
    );
}

export function scalePx (value, scene)
{
    return value * getUiScale(scene);
}

export function scalePoint (point, scene)
{
    if (!point)
    {
        return { x: 0, y: 0 };
    }

    return {
        x: scalePx(point.x ?? 0, scene),
        y: scalePx(point.y ?? 0, scene),
    };
}

/**
 * Pick orientation-specific layout, then scale pixel values.
 * Supports:
 *   42
 *   { x: 10, y: 20 }
 *   { portrait: { x, y }, landscape: { x, y } }
 */
export function resolveOffset (offset, scene)
{
    if (offset == null)
    {
        return { x: 0, y: 0 };
    }

    if (typeof offset === 'number')
    {
        const scaled = scalePx(offset, scene);
        return { x: scaled, y: scaled };
    }

    const orient = getOrientation(scene);
    let chosen = offset[orient] ?? offset.portrait ?? offset;

    if (chosen.portrait !== undefined || chosen.landscape !== undefined)
    {
        chosen = chosen[orient] ?? chosen.portrait ?? chosen;
    }

    return scalePoint(chosen, scene);
}

export function resolveUiScale (value, scene, orientation = null)
{
    if (value == null)
    {
        return 1;
    }

    if (typeof value === 'number')
    {
        return value;
    }

    const orient = orientation ?? getOrientation(scene);
    return value[orient] ?? value.portrait ?? 1;
}

export function resolveLayoutNumber (value, scene)
{
    if (value == null)
    {
        return value;
    }

    if (typeof value === 'number')
    {
        return scalePx(value, scene);
    }

    const orient = getOrientation(scene);
    const chosen = value[orient] ?? value.portrait ?? value;

    if (typeof chosen === 'number')
    {
        return scalePx(chosen, scene);
    }

    return chosen;
}

export function resolveCameraOffset (offset, scene, orientation = null)
{
    if (!offset)
    {
        return { x: 0, y: 0, z: 0 };
    }

    const orient = orientation ?? getOrientation(scene);
    const chosen = (offset.portrait !== undefined || offset.landscape !== undefined)
        ? (offset[orient] ?? offset.portrait ?? offset)
        : offset;

    return {
        x: chosen.x ?? 0,
        y: chosen.y ?? 0,
        z: chosen.z ?? 0,
    };
}

/**
 * Normalized text position inside a bubble (0–1).
 * x: 0 = left, 0.5 = center, 1 = right
 * y: 0 = top, 0.5 = center, 1 = bottom
 * Supports { portrait: { x, y }, landscape: { x, y } }.
 */
export function resolveBubbleTextPosition (position, scene, orientation = null)
{
    const defaults = { x: 0.5, y: 0.5 };

    if (!position)
    {
        return defaults;
    }

    const orient = orientation ?? getOrientation(scene);
    const chosen = (position.portrait !== undefined || position.landscape !== undefined)
        ? (position[orient] ?? position.portrait ?? position)
        : position;

    return {
        x: chosen.x ?? defaults.x,
        y: chosen.y ?? defaults.y,
    };
}

/** Map normalized bubble text position to local coords (box centered at origin). */
export function bubbleTextPositionCentered (pos, boxW, boxH)
{
    return {
        x: boxW * (pos.x - 0.5),
        y: boxH * (pos.y - 0.5),
    };
}

/** Map normalized bubble text position to local coords (box origin left + vertical center). */
export function bubbleTextPositionTopCenter (pos, boxW, boxH)
{
    return {
        x: boxW * pos.x,
        y: boxH * (pos.y - 0.5),
    };
}

/** Resolve zoomFactor + positionOffset for the current orientation (no pixel scaling). */
export function resolveCameraTarget (target, scene, orientation = null)
{
    if (!target)
    {
        return {
            zoomFactor: 1,
            positionOffset: { x: 0, y: 0, z: 0 },
        };
    }

    return {
        zoomFactor: resolveUiScale(target.zoomFactor ?? 1, scene, orientation),
        positionOffset: resolveCameraOffset(target.positionOffset, scene, orientation),
    };
}

export function scaledSize (size, scene)
{
    const scaled = scalePx(size, scene);
    return { width: scaled, height: scaled };
}
