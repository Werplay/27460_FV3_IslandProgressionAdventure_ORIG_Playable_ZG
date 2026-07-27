import * as THREE from 'three';
import { TimelineAnimationController } from './TimelineAnimationController.js';
import { findAnimationClip } from './findAnimationClip.js';

/**
 * Start a timeline animation with named frame/second segments.
 * @returns {TimelineAnimationController | null}
 */
export function setupTimelineAnimation (model, config = {})
{
    const controller = new TimelineAnimationController(model, config);

    if (!controller.states.size)
    {
        return null;
    }

    const defaultState = config.defaultState ?? [...controller.states.keys()][0];

    if (defaultState)
    {
        controller.playState(defaultState, { fade: 0, force: true });
    }

    model.userData.timelineAnimation = controller;

    return controller;
}

/**
 * Start a looping (or one-shot) clip on a loaded FBX/GLB model.
 * @param {import('three').Object3D} model
 * @param {{ clip?: string, loop?: boolean, timeScale?: number, states?: object, type?: string }} [config]
 * @returns {THREE.AnimationMixer | TimelineAnimationController | null}
 */
export function setupModelAnimation (model, config = {})
{
    if (config?.type === 'timeline' || config?.states)
    {
        return setupTimelineAnimation(model, config);
    }

    if (!model.animations?.length)
    {
        return null;
    }

    const clip = findAnimationClip(model.animations, config.clip);

    if (!clip)
    {
        console.warn(
            `Animation clip not found: ${config.clip}`,
            model.animations.map((entry) => entry.name)
        );
        return null;
    }

    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    const loop = config.loop !== false;

    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
    action.clampWhenFinished = !loop;
    action.timeScale = config.timeScale ?? 1;
    action.play();

    model.userData.animationMixer = mixer;

    return mixer;
}

/**
 * @param {THREE.AnimationMixer[]} mixers
 * @param {number} deltaMs
 */
export function updateModelAnimations (mixers, deltaMs)
{
    const deltaSec = deltaMs / 1000;

    mixers.forEach((mixer) => {
        mixer.update(deltaSec);
    });
}
