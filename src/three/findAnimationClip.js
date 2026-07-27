import * as THREE from 'three';

/**
 * Find an animation clip by exact name, then by partial match.
 * When several clips match, prefer the one with the most tracks
 * (GLB exports often rename clips like "Root|ClipName|Layer").
 *
 * @param {THREE.AnimationClip[]} animations
 * @param {string} [clipName]
 * @returns {THREE.AnimationClip | null}
 */
export function findAnimationClip (animations, clipName)
{
    if (!animations?.length)
    {
        return null;
    }

    if (!clipName)
    {
        return animations[0];
    }

    const exact = THREE.AnimationClip.findByName(animations, clipName);

    if (exact)
    {
        return exact;
    }

    const needle = clipName.toLowerCase();
    const matches = animations.filter((clip) => clip.name?.toLowerCase().includes(needle));

    if (!matches.length)
    {
        return null;
    }

    matches.sort((a, b) => (b.tracks?.length ?? 0) - (a.tracks?.length ?? 0));

    return matches[0];
}
