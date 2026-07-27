import * as THREE from 'three';
import { findAnimationClip } from './findAnimationClip.js';

/**
 * Resolve a timeline segment from frames or seconds.
 * endFrame / end are inclusive in config; Three.js subclip end is exclusive.
 */
export function resolveTimelineSegment (state, fps = 30)
{
    const rate = fps > 0 ? fps : 30;

    if (state.startFrame != null || state.endFrame != null)
    {
        const startFrame = state.startFrame ?? 0;
        const endFrame = state.endFrame ?? startFrame;

        return {
            startFrame,
            endFrameExclusive: endFrame + 1,
            duration: (endFrame - startFrame + 1) / rate,
        };
    }

    if (state.start != null || state.end != null)
    {
        const start = state.start ?? 0;
        const end = state.end ?? start;
        const startFrame = Math.round(start * rate);
        const endFrame = Math.round(end * rate);

        return {
            startFrame,
            endFrameExclusive: endFrame + 1,
            duration: Math.max(0, end - start),
        };
    }

    return {
        startFrame: 0,
        endFrameExclusive: 1,
        duration: 0,
    };
}

export function framesToSeconds (frames, fps = 30)
{
    const rate = fps > 0 ? fps : 30;

    return frames / rate;
}

export function secondsToFrames (seconds, fps = 30)
{
    const rate = fps > 0 ? fps : 30;

    return Math.round(seconds * rate);
}

/**
 * Play named segments from one baked FBX clip using frame or second ranges.
 */
export class TimelineAnimationController
{
    constructor (model, config = {})
    {
        this.model = model;
        this.config = config;
        this.fps = config.fps ?? 30;
        this.mixer = new THREE.AnimationMixer(model);
        this.states = new Map();
        this.currentState = null;
        this.currentAction = null;
        this.onStateComplete = null;

        const sourceClip = findAnimationClip(model.animations, config.clip);

        if (!sourceClip)
        {
            console.warn(
                'Timeline animation clip not found:',
                config.clip,
                model.animations?.map((entry) => entry.name)
            );
            return;
        }

        Object.entries(config.states ?? {}).forEach(([name, stateConfig]) => {
            const segment = resolveTimelineSegment(stateConfig, this.fps);
            const subclip = THREE.AnimationUtils.subclip(
                sourceClip,
                name,
                segment.startFrame,
                segment.endFrameExclusive,
                this.fps
            );
            const action = this.mixer.clipAction(subclip);
            const loop = stateConfig.loop === true;

            action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
            action.clampWhenFinished = !loop;

            this.states.set(name, {
                action,
                config: stateConfig,
                duration: segment.duration,
            });
        });

        this.mixer.addEventListener('finished', (event) => {
            this.handleFinished(event);
        });
    }

    getMixer ()
    {
        return this.mixer;
    }

    hasState (name)
    {
        return this.states.has(name);
    }

    getStateDuration (name)
    {
        return this.states.get(name)?.duration ?? 0;
    }

        playState (name, { fade = 0.15, force = false, durationMs = null } = {})
    {
        const state = this.states.get(name);

        if (!state)
        {
            console.warn(`Timeline animation state not found: ${name}`);
            return false;
        }

        if (!force && this.currentState === name && state.action.isRunning())
        {
            return true;
        }

        if (this.currentAction && this.currentAction !== state.action)
        {
            this.currentAction.fadeOut(fade);
        }

        state.action.reset();
        state.action.setEffectiveWeight(1);

        const targetDurationSec = durationMs != null
            ? durationMs / 1000
            : (state.config.playDurationMs != null ? state.config.playDurationMs / 1000 : null);

        if (targetDurationSec != null && state.duration > 0)
        {
            state.action.timeScale = state.duration / targetDurationSec;
        }
        else
        {
            state.action.timeScale = state.config.timeScale ?? 1;
        }

        state.action.fadeIn(fade);
        state.action.play();

        this.currentAction = state.action;
        this.currentState = name;

        return true;
    }

    handleFinished (event)
    {
        const finishedState = [...this.states.entries()]
            .find(([, state]) => state.action === event.action)?.[0];

        if (!finishedState)
        {
            return;
        }

        const state = this.states.get(finishedState);
        const returnTo = state?.config?.returnTo;

        if (typeof this.onStateComplete === 'function')
        {
            this.onStateComplete(finishedState, state?.config ?? {});
        }

        if (returnTo && this.hasState(returnTo))
        {
            this.playState(returnTo);
        }
    }

    update (deltaSec)
    {
        this.mixer.update(deltaSec);
    }
}
