import * as THREE from 'three';
import { CAMERA_CONFIG } from '../config/cameraConfig.js';
import { resolveCameraTarget } from '../ui/UiScale.js';

function cloneOffset (offset)
{
    return { x: offset.x, y: offset.y, z: offset.z };
}

export class CameraController
{
    constructor (camera, modelMaxDim, aspect, phaserScene)
    {
        this.camera = camera;
        this.scene = phaserScene;
        this.modelMaxDim = modelMaxDim;
        this.aspect = aspect;
        this.baseConfig = CAMERA_CONFIG;
        this.viewTargetRaw = CAMERA_CONFIG;
        this.transition = null;
        this.fixedQuaternion = null;

        const initial = resolveCameraTarget(CAMERA_CONFIG, phaserScene);
        this.zoomFactor = initial.zoomFactor;
        this.positionOffset = cloneOffset(initial.positionOffset);

        this.captureFixedRotation();
    }

    isOrthographic ()
    {
        return this.baseConfig.projection === 'orthographic';
    }

    /** Set rotation once from config; gameplay only zooms and pans after this. */
    captureFixedRotation ()
    {
        const cfg = this.baseConfig;

        if (cfg.viewMode === 'isometric')
        {
            this.apply(true);
            this.fixedQuaternion = this.camera.quaternion.clone();
            return;
        }

        if (cfg.useManualRotation)
        {
            this.fixedQuaternion = null;
            return;
        }

        this.apply(true);
        this.fixedQuaternion = this.camera.quaternion.clone();
    }

    apply (allowLookAt = false)
    {
        if (this.isOrthographic())
        {
            this.applyOrthographic(allowLookAt);
        }
        else
        {
            this.applyPerspective(allowLookAt);
        }
    }

    applyPerspective (allowLookAt = false)
    {
        const cfg = this.baseConfig;
        const maxDim = this.modelMaxDim || cfg.targetSize;

        this.camera.fov = cfg.fov;

        const fovRad = cfg.fov * (Math.PI / 180);
        const fitDistance = maxDim / (2 * Math.tan(fovRad / 2));
        const distance = fitDistance * this.zoomFactor;

        this.setCameraTransform(cfg, distance, allowLookAt);
        this.camera.far = distance * 20;
        this.camera.updateProjectionMatrix();
    }

    applyOrthographic (allowLookAt = false)
    {
        const cfg = this.baseConfig;
        const maxDim = this.modelMaxDim || cfg.targetSize;

        const fovRad = cfg.fov * (Math.PI / 180);
        const fitDistance = maxDim / (2 * Math.tan(fovRad / 2));
        const distance = fitDistance * this.zoomFactor;
        const halfH = distance * Math.tan(fovRad / 2) * (cfg.orthoFitScale ?? 1);
        const halfW = halfH * this.aspect;

        this.camera.left = -halfW;
        this.camera.right = halfW;
        this.camera.top = halfH;
        this.camera.bottom = -halfH;
        // Ortho allows a negative near plane. Zoom/pan moves the camera through
        // perimeter trees; a tiny positive near slices their canopies. Pulling near
        // behind the camera keeps those trees intact without changing framing.
        this.camera.near = -Math.max(distance * 4, maxDim);
        this.camera.far = Math.max(distance * 20, maxDim * 10);

        this.setCameraTransform(cfg, distance, allowLookAt);
        this.camera.updateProjectionMatrix();
    }

    setCameraTransform (cfg, distance, allowLookAt = false)
    {
        if (cfg.viewMode === 'isometric')
        {
            const dir = cfg.isometricDirection ?? { x: 1, y: 1, z: 1 };
            const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
            const scale = distance / len;

            this.camera.position.set(
                dir.x * scale + this.positionOffset.x,
                dir.y * scale + this.positionOffset.y,
                dir.z * scale + this.positionOffset.z
            );

            if (this.fixedQuaternion && !allowLookAt)
            {
                this.camera.quaternion.copy(this.fixedQuaternion);
            }
            else
            {
                this.camera.lookAt(
                    cfg.focusOffset.x,
                    cfg.focusOffset.y,
                    cfg.focusOffset.z
                );
            }
            return;
        }

        this.camera.position.set(
            this.positionOffset.x,
            distance * cfg.heightFactor + this.positionOffset.y,
            distance * cfg.depthFactor + this.positionOffset.z
        );

        if (cfg.useManualRotation)
        {
            this.camera.rotation.set(
                THREE.MathUtils.degToRad(cfg.rotation.x),
                THREE.MathUtils.degToRad(cfg.rotation.y),
                THREE.MathUtils.degToRad(cfg.rotation.z)
            );
        }
        else if (this.fixedQuaternion && !allowLookAt)
        {
            this.camera.quaternion.copy(this.fixedQuaternion);
        }
        else
        {
            this.camera.lookAt(
                cfg.focusOffset.x,
                cfg.focusOffset.y,
                cfg.focusOffset.z
            );
        }
    }

    setAspect (aspect)
    {
        this.aspect = aspect;

        if (!this.isOrthographic())
        {
            this.camera.aspect = aspect;
        }

        this.apply();
    }

    breakTween ()
    {
        const resolve = this.transition?.resolve;

        this.transition = null;
        resolve?.();
    }

    zoomTo (rawTarget, duration = 1500)
    {
        return new Promise((resolve) => {
            this.viewTargetRaw = rawTarget;
            const target = resolveCameraTarget(rawTarget, this.scene);

            this.transition = {
                fromZoom: this.zoomFactor,
                toZoom: target.zoomFactor,
                fromOffset: cloneOffset(this.positionOffset),
                toOffset: cloneOffset(target.positionOffset),
                duration,
                elapsed: 0,
                resolve,
            };

            this.scene.soundManager?.playCameraZoom(this.transition.fromZoom, this.transition.toZoom);
        });
    }

    onResize ({ orientationChanged = false, orientation = null } = {})
    {
        if (orientationChanged)
        {
            this.breakTween();

            const target = resolveCameraTarget(this.viewTargetRaw, this.scene, orientation);
            this.zoomFactor = target.zoomFactor;
            this.positionOffset = cloneOffset(target.positionOffset);
            this.apply();
            return;
        }

        const target = resolveCameraTarget(this.viewTargetRaw, this.scene, orientation);

        if (this.transition)
        {
            this.transition.toZoom = target.zoomFactor;
            this.transition.toOffset = cloneOffset(target.positionOffset);
        }
        else
        {
            this.zoomFactor = target.zoomFactor;
            this.positionOffset = cloneOffset(target.positionOffset);
        }

        this.apply();
    }

    update (deltaMs)
    {
        if (!this.transition)
        {
            return;
        }

        const t = this.transition;
        t.elapsed += deltaMs;
        const progress = Math.min(t.elapsed / t.duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        this.zoomFactor = THREE.MathUtils.lerp(t.fromZoom, t.toZoom, eased);
        this.positionOffset.x = THREE.MathUtils.lerp(t.fromOffset.x, t.toOffset.x, eased);
        this.positionOffset.y = THREE.MathUtils.lerp(t.fromOffset.y, t.toOffset.y, eased);
        this.positionOffset.z = THREE.MathUtils.lerp(t.fromOffset.z, t.toOffset.z, eased);
        this.apply();

        if (progress >= 1)
        {
            const resolve = t.resolve;

            this.transition = null;
            resolve();
        }
    }
}
