import * as THREE from 'three';
import { ENVIRONMENT_CONFIG } from '../config/environmentConfig.js';
import { CAMERA_CONFIG } from '../config/cameraConfig.js';
import { getModelPlacement } from '../config/fbxModels.js';
import { getFBXModel, getFBXModelMeta } from '../utils/LoadBase64FBX.js';
import { createGroundPlane } from './createGroundPlane.js';
import {
    buildPlacementExclusions,
    createModelGrid,
    createScatteredProps,
    placeModelOnGround,
    shouldUsePlacementExclusions,
} from '../utils/EnvironmentUtils.js';

const GROUND_SURFACE_MODELS = new Set(['road', 'roadCorner', 'rubblePath']);

/** Paths sit on the map plane — offset + no cast stops self-shadow banding on flat tris. */
function applyGroundSurfaceMaterial (mesh)
{
    mesh.castShadow = false;
    mesh.receiveShadow = true;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((material) => {
        if (!material) return;

        material.polygonOffset = true;
        material.polygonOffsetFactor = -4;
        material.polygonOffsetUnits = -8;
        material.needsUpdate = true;
    });
}
import { CameraController } from './CameraController.js';
import { setupModelAnimation, updateModelAnimations } from './ModelAnimations.js';
import { TimelineAnimationController } from './TimelineAnimationController.js';

export class ThreeSceneManager
{
    constructor (phaserScene)
    {
        this.scene = phaserScene;
        this.environment = { map: null, props: {}, grids: {}, scatters: {}, root: null, groundY: 0 };
        this.animationMixers = [];
        this.animationControllers = {};
        this.viewWidth = window.innerWidth;
        this.viewHeight = window.innerHeight;
    }

    setup ()
    {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        // Inserted BEFORE the Phaser canvas rather than appended, so natural DOM order
        // puts Three below Phaser without an explicit z-index. Ad-network validators
        // inject their own feedback elements at z-index auto; any positive z-index here
        // would paint over them and hide the banner.
        document.body.insertBefore(this.canvas, document.body.firstChild);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.viewWidth, this.viewHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.threeScene = new THREE.Scene();
        this.aspect = this.viewWidth / this.viewHeight;
        this.camera = this.createCamera(this.aspect);
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        this.addLights();
        this.addShadowGround();
        this.spawnEnvironment();

        this.cameraController = new CameraController(this.camera, this.modelMaxDim, this.aspect, this.scene);
        this.cameraController.apply();
        this.applyEnvironmentScreenOffset();
    }

    createCamera (aspect)
    {
        if (CAMERA_CONFIG.projection === 'orthographic')
        {
            return new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10000);
        }

        return new THREE.PerspectiveCamera(CAMERA_CONFIG.fov, aspect, 0.1, 10000);
    }

    addLights ()
    {
        this.threeScene.add(new THREE.AmbientLight(0xffffff, 1.2));

        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(10, 40, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -20;
        sun.shadow.camera.right = 20;
        sun.shadow.camera.top = 20;
        sun.shadow.camera.bottom = -20;
        // Offset depth samples so surfaces don't self-shadow (shadow acne / diagonal banding).
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.04;
        this.threeScene.add(sun);
        this.threeScene.add(new THREE.DirectionalLight(0xffffff, 1));
    }

    addShadowGround ()
    {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.ShadowMaterial({ opacity: 0.25 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        ground.name = 'shadowGround';
        this.shadowGround = ground;
    }

    spawnEnvironment ()
    {
        const cfg = ENVIRONMENT_CONFIG;
        const offset = cfg.containerOffset ?? { x: 0, y: 0, z: 0 };

        this.environmentGroup = new THREE.Group();
        this.environmentGroup.name = 'environment';
        this.environmentGroup.position.set(offset.x, offset.y, offset.z);
        this.threeScene.add(this.environmentGroup);

        if (this.shadowGround)
        {
            this.environmentGroup.add(this.shadowGround);
        }

        this.environment.root = this.environmentGroup;
        this.baseContainerOffset = { ...offset };

        const ground = createGroundPlane(this.scene, cfg.map);

        if (ground)
        {
            this.environmentGroup.add(ground.mesh);
            this.environment.map = ground.mesh;
            this.modelMaxDim = ground.worldSize;
        }
        else
        {
            this.modelMaxDim = CAMERA_CONFIG.targetSize;
        }

        (cfg.scatters ?? []).forEach((scatter) => {
            const exclusions = shouldUsePlacementExclusions(scatter)
                ? buildPlacementExclusions(cfg)
                : [];
            const getTemplate = (modelKey) => {
                const key = modelKey ?? scatter.modelKey;

                return key ? getFBXModel(this.scene, key) : null;
            };
            const template = scatter.modelKey ? getTemplate(scatter.modelKey) : null;

            if (!template && !scatter.modelKeys?.length)
            {
                return;
            }

            const group = createScatteredProps(template, scatter, {
                exclusions,
                getTemplate,
                getModelPlacement,
            });
            this.environmentGroup.add(group);
            this.environment.scatters[scatter.id] = group;
        });

        cfg.props.forEach((prop) => {
            const model = getFBXModel(this.scene, prop.modelKey);
            if (!model) return;

            model.traverse((child) => {
                if (child.isMesh)
                {
                    child.renderOrder = 2;

                    if (GROUND_SURFACE_MODELS.has(prop.modelKey))
                    {
                        applyGroundSurfaceMaterial(child);
                    }
                }
            });

            const surfaceLift = GROUND_SURFACE_MODELS.has(prop.modelKey) ? 0.06 : 0;
            const position = {
                ...prop.position,
                y: (prop.position?.y ?? 0) + surfaceLift,
            };

            this.environmentGroup.add(model);
            placeModelOnGround(model, {
                position,
                rotation: prop.rotation,
                worldSize: prop.worldSize ?? 1,
                scaleMode: prop.scaleMode ?? 'max',
                scale: prop.scale ?? null,
            });
            this.environment.props[prop.id] = model;
            this.bindPropAnimation(model, prop);
        });

        cfg.grids.forEach((grid) => {
            const template = getFBXModel(this.scene, grid.modelKey);
            if (!template) return;

            const group = createModelGrid(template, grid);
            group.traverse((child) => {
                if (child.isMesh)
                {
                    child.renderOrder = 2;
                }
            });
            this.environmentGroup.add(group);
            this.environment.grids[grid.id] = group;
        });
    }

    applyEnvironmentScreenOffset ()
    {
        if (!this.environmentGroup) return;

        const cfg = ENVIRONMENT_CONFIG;
        const base = this.baseContainerOffset ?? { x: 0, y: 0, z: 0 };
        const screen = cfg.containerScreenOffset ?? { x: 0, y: 0 };

        this.environmentGroup.position.set(base.x, base.y, base.z);

        if (screen.x || screen.y)
        {
            this.environmentGroup.position.add(
                this.screenPixelsToWorldShift(screen.x, screen.y)
            );
        }

        if (this.environment.map)
        {
            const groundPos = new THREE.Vector3();
            this.environment.map.getWorldPosition(groundPos);
            this.environment.groundY = groundPos.y;
        }
        else
        {
            this.environment.groundY = base.y;
        }
    }

    screenPixelsToWorldShift (dx, dy)
    {
        const camera = this.camera;
        const height = this.viewHeight || 1;
        let scale;

        if (camera.isOrthographicCamera)
        {
            scale = (camera.top - camera.bottom) / height;
        }
        else
        {
            const focus = new THREE.Vector3(
                CAMERA_CONFIG.focusOffset.x,
                CAMERA_CONFIG.focusOffset.y,
                CAMERA_CONFIG.focusOffset.z
            );
            const distance = camera.position.distanceTo(focus);
            scale = 2 * Math.tan((camera.fov * Math.PI) / 360) * distance / height;
        }

        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);

        return new THREE.Vector3()
            .add(right.multiplyScalar(dx * scale))
            .add(up.multiplyScalar(-dy * scale));
    }

    bindPropAnimation (model, prop)
    {
        const animConfig = prop.animation ?? getFBXModelMeta(this.scene, prop.modelKey)?.animation;

        if (!animConfig)
        {
            return;
        }

        const result = setupModelAnimation(model, animConfig);

        if (result instanceof TimelineAnimationController)
        {
            this.animationControllers[prop.id] = result;
            this.animationMixers.push(result.getMixer());
            return;
        }

        if (result)
        {
            this.animationMixers.push(result);
            return;
        }

        console.warn(`No animation clips found on prop "${prop.id}" (${prop.modelKey})`);
    }

    playPropAnimationState (propId, stateName, options = {})
    {
        const controller = this.animationControllers[propId]
            ?? this.environment.props[propId]?.userData?.timelineAnimation;

        if (!controller)
        {
            console.warn(`No timeline animation on prop "${propId}"`);
            return false;
        }

        return controller.playState(stateName, options);
    }

    render ()
    {
        this.renderer.render(this.threeScene, this.camera);
    }

    update (deltaMs)
    {
        this.cameraController?.update(deltaMs);
        this.applyEnvironmentScreenOffset();
        updateModelAnimations(this.animationMixers, deltaMs);
    }

    resize (width, height, phaserRect, { orientationChanged = false, orientation = null } = {})
    {
        this.viewWidth = width;
        this.viewHeight = height;
        this.aspect = width / height;
        this.renderer.setSize(width, height);

        // Snap zoom/offset for the new orientation before updating aspect/frustum.
        if (orientationChanged)
        {
            this.cameraController?.onResize({ orientationChanged, orientation });
        }

        this.cameraController?.setAspect(this.aspect);

        if (!orientationChanged)
        {
            this.cameraController?.onResize({ orientationChanged, orientation });
        }

        this.applyEnvironmentScreenOffset();
    }

    getPropScreenPosition (propId, worldOffset = { x: 0, y: 0, z: 0 })
    {
        const prop = this.environment.props[propId];
        if (!prop)
        {
            return {
                x: this.scene.scale.width * 0.5,
                y: this.scene.scale.height * 0.5,
            };
        }

        const worldPos = new THREE.Vector3();
        prop.getWorldPosition(worldPos);
        worldPos.x += worldOffset.x;
        worldPos.y += worldOffset.y;
        worldPos.z += worldOffset.z;
        return this.worldToPhaser(worldPos);
    }

    /**
     * Axis-aligned screen rect covering a prop's world AABB.
     * Used for forgiving drop / tap hit tests on animals & buildings.
     */
    getPropScreenBounds (propId)
    {
        const prop = this.environment.props[propId];
        const fallback = this.getPropScreenPosition(propId);

        if (!prop)
        {
            return {
                minX: fallback.x,
                maxX: fallback.x,
                minY: fallback.y,
                maxY: fallback.y,
                centerX: fallback.x,
                centerY: fallback.y,
            };
        }

        const box = new THREE.Box3().setFromObject(prop);
        if (box.isEmpty())
        {
            return {
                minX: fallback.x,
                maxX: fallback.x,
                minY: fallback.y,
                maxY: fallback.y,
                centerX: fallback.x,
                centerY: fallback.y,
            };
        }

        const corners = [
            new THREE.Vector3(box.min.x, box.min.y, box.min.z),
            new THREE.Vector3(box.min.x, box.min.y, box.max.z),
            new THREE.Vector3(box.min.x, box.max.y, box.min.z),
            new THREE.Vector3(box.min.x, box.max.y, box.max.z),
            new THREE.Vector3(box.max.x, box.min.y, box.min.z),
            new THREE.Vector3(box.max.x, box.min.y, box.max.z),
            new THREE.Vector3(box.max.x, box.max.y, box.min.z),
            new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const corner of corners)
        {
            const screen = this.worldToPhaser(corner);
            minX = Math.min(minX, screen.x);
            maxX = Math.max(maxX, screen.x);
            minY = Math.min(minY, screen.y);
            maxY = Math.max(maxY, screen.y);
        }

        return {
            minX,
            maxX,
            minY,
            maxY,
            centerX: (minX + maxX) * 0.5,
            centerY: (minY + maxY) * 0.5,
        };
    }

    worldToPhaser (worldPos)
    {
        const point = worldPos.isVector3
            ? worldPos.clone()
            : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);

        const projected = point.project(this.camera);
        const phaserScene = this.scene;
        return {
            x: ((projected.x + 1) / 2) * phaserScene.scale.width,
            y: ((-projected.y + 1) / 2) * phaserScene.scale.height,
        };
    }

    phaserToWorldOnPlane (phaserX, phaserY, planeY = null)
    {
        const phaserScene = this.scene;
        const ndcX = (phaserX / phaserScene.scale.width) * 2 - 1;
        const ndcY = -((phaserY / phaserScene.scale.height) * 2 - 1);
        const y = planeY ?? this.environment.groundY ?? 0;

        this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
        this.groundPlane.constant = -y;

        const hit = new THREE.Vector3();
        return this.raycaster.ray.intersectPlane(this.groundPlane, hit) ? hit : null;
    }
}
