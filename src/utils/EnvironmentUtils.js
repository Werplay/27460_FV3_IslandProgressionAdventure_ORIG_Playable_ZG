import * as THREE from 'three';
import { getModelPlacement } from '../config/fbxModels.js';

function mergeRotation (base, override)
{
    const b = base ?? { x: 0, y: 0, z: 0 };
    const o = override ?? {};

    return {
        x: o.x ?? b.x ?? 0,
        y: o.y ?? b.y ?? 0,
        z: o.z ?? b.z ?? 0,
    };
}

function expandMeshBounds (box, mesh)
{
    mesh.updateWorldMatrix(true, false);

    if (mesh.isSkinnedMesh)
    {
        mesh.skeleton?.update();

        if (!mesh.geometry.boundingBox)
        {
            mesh.geometry.computeBoundingBox();
        }

        if (mesh.geometry.boundingBox)
        {
            const meshBox = mesh.geometry.boundingBox.clone();
            meshBox.applyMatrix4(mesh.matrixWorld);
            box.union(meshBox);
            return true;
        }
    }

    box.expandByObject(mesh);
    return true;
}

export function getMeshesBoundingBox (object)
{
    const box = new THREE.Box3();
    let hasMesh = false;

    object.traverse((child) => {
        if (!child.isMesh)
        {
            return;
        }

        if (expandMeshBounds(box, child))
        {
            hasMesh = true;
        }
    });

    if (!hasMesh)
    {
        box.setFromObject(object);
    }

    return box;
}

function getScaleMeasure (size, scaleMode)
{
    switch (scaleMode)
    {
        case 'x':
            return Math.max(size.x, 0.001);
        case 'y':
        case 'height':
            return Math.max(size.y, 0.001);
        case 'z':
            return Math.max(size.z, 0.001);
        case 'xz':
            return Math.max(size.x, size.z, 0.001);
        case 'max':
        default:
            return Math.max(size.x, size.y, size.z, 0.001);
    }
}

function applyModelScale (model, { scale, worldSize, scaleMode })
{
    if (scale != null)
    {
        if (typeof scale === 'number')
        {
            model.scale.setScalar(scale);
        }
        else
        {
            model.scale.set(
                scale.x ?? 1,
                scale.y ?? 1,
                scale.z ?? 1
            );
        }

        return;
    }

    const box = getMeshesBoundingBox(model);

    if (!isValidBoundingBox(box))
    {
        model.scale.setScalar(worldSize * 0.01);
        return;
    }

    const size = box.getSize(new THREE.Vector3());
    const measureDim = getScaleMeasure(size, scaleMode);
    model.scale.setScalar(worldSize / measureDim);
}

function isValidBoundingBox (box)
{
    if (box.isEmpty())
    {
        return false;
    }

    const size = box.getSize(new THREE.Vector3());

    return Number.isFinite(size.x)
        && Number.isFinite(size.y)
        && Number.isFinite(size.z)
        && (size.x > 0 || size.y > 0 || size.z > 0);
}

function updateSkinnedMeshes (object)
{
    object.traverse((child) => {
        if (child.isSkinnedMesh)
        {
            child.frustumCulled = false;
            child.skeleton?.update();
        }
    });
}

export function placeModelOnGround (model, {
    position = { x: 0, y: 0, z: 0 },
    rotation = { x: 0, y: 0, z: 0 },
    worldSize = 1,
    scaleMode = 'max',
    scale = null,
})
{
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    updateSkinnedMeshes(model);

    applyModelScale(model, { scale, worldSize, scaleMode });

    model.rotation.set(
        THREE.MathUtils.degToRad(rotation.x ?? 0),
        THREE.MathUtils.degToRad(rotation.y ?? 0),
        THREE.MathUtils.degToRad(rotation.z ?? 0)
    );
    model.updateMatrixWorld(true);
    updateSkinnedMeshes(model);

    const placedBox = getMeshesBoundingBox(model);
    const center = placedBox.getCenter(new THREE.Vector3());

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= placedBox.min.y;
    model.position.x += position.x;
    model.position.y += position.y;
    model.position.z += position.z;
    model.updateMatrixWorld(true);
    updateSkinnedMeshes(model);
}

export function preparePlotOnGround (plot, cellWorldSize)
{
    plot.position.set(0, 0, 0);
    plot.scale.set(1, 1, 1);
    plot.updateMatrixWorld(true);

    const box = getMeshesBoundingBox(plot);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z, 0.001);
    const scale = cellWorldSize / maxDim;

    plot.scale.setScalar(scale);
    plot.updateMatrixWorld(true);

    const scaledBox = getMeshesBoundingBox(plot);
    const center = scaledBox.getCenter(new THREE.Vector3());

    plot.position.x -= center.x;
    plot.position.z -= center.z;
    plot.position.y -= scaledBox.min.y;

    const scaledSize = scaledBox.getSize(new THREE.Vector3());

    return {
        width: scaledSize.x,
        depth: scaledSize.z,
    };
}

function resolveGridSpacing (spacing, cellSize)
{
    if (spacing == null)
    {
        return { x: cellSize.width, z: cellSize.depth };
    }

    if (typeof spacing === 'number')
    {
        return { x: spacing, z: spacing };
    }

    return {
        x: spacing.x ?? cellSize.width,
        z: spacing.z ?? cellSize.depth,
    };
}

export function createModelGrid (template, gridConfig)
{
    const placement = getModelPlacement(gridConfig.modelKey) ?? {};
    const rotation = mergeRotation(placement.rotation, gridConfig.rotation);
    const scaleMode = gridConfig.scaleMode ?? placement.scaleMode ?? 'max';

    const probe = template.clone(true);
    placeModelOnGround(probe, {
        position: { x: 0, y: 0, z: 0 },
        rotation,
        worldSize: gridConfig.cellWorldSize ?? 1,
        scaleMode,
        scale: gridConfig.scale ?? null,
    });

    const probeSize = getMeshesBoundingBox(probe).getSize(new THREE.Vector3());
    const cellSize = { width: probeSize.x, depth: probeSize.z };
    const spacing = resolveGridSpacing(gridConfig.spacing, cellSize);

    const group = new THREE.Group();
    group.name = gridConfig.id || 'modelGrid';
    group.position.set(
        gridConfig.position.x,
        gridConfig.position.y,
        gridConfig.position.z
    );

    let placed = 0;

    for (let row = 0; row < gridConfig.rows; row++)
    {
        for (let col = 0; col < gridConfig.columns; col++)
        {
            if (placed >= gridConfig.count)
            {
                break;
            }

            const instance = template.clone(true);
            const offsetX = (col - (gridConfig.columns - 1) / 2) * spacing.x;
            const offsetZ = (row - (gridConfig.rows - 1) / 2) * spacing.z;

            placeModelOnGround(instance, {
                position: { x: offsetX, y: 0, z: offsetZ },
                rotation,
                worldSize: gridConfig.cellWorldSize ?? 1,
                scaleMode,
                scale: gridConfig.scale ?? null,
            });
            group.add(instance);
            placed++;
        }
    }

    return group;
}

function seededRandom (seed)
{
    let state = seed % 2147483647;
    if (state <= 0) state += 2147483646;

    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}

function applyGroundDecalMaterial (mesh)
{
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((material) => {
        if (!material) return;

        material.transparent = false;
        material.alphaTest = material.alphaTest || 0.5;
        material.depthWrite = true;
        material.polygonOffset = true;
        material.polygonOffsetFactor = 2;
        material.polygonOffsetUnits = 4;
        material.needsUpdate = true;
    });
}

function applyVegetationMaterial (mesh)
{
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    materials.forEach((material) => {
        if (!material) return;

        material.transparent = false;
        material.alphaTest = material.alphaTest || 0.5;
        material.depthWrite = true;
        material.needsUpdate = true;
    });
}

function resolveWorldSize (worldSize, rand)
{
    if (worldSize && typeof worldSize === 'object')
    {
        const min = worldSize.min ?? 0.5;
        const max = worldSize.max ?? min;

        return min + rand() * (max - min);
    }

    return worldSize ?? 0.5;
}

function distanceXZ (ax, az, bx, bz)
{
    const dx = ax - bx;
    const dz = az - bz;

    return Math.sqrt(dx * dx + dz * dz);
}

function isInsideRect (x, z, rect)
{
    return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

function collidesWithExclusions (x, z, radius, exclusions)
{
    for (const zone of exclusions)
    {
        if (zone.type === 'rect')
        {
            if (isInsideRect(x, z, zone))
            {
                return true;
            }
        }
        else if (distanceXZ(x, z, zone.x, zone.z) < zone.radius + radius)
        {
            return true;
        }
    }

    return false;
}

function collidesWithPlaced (x, z, radius, placed, minSpacing)
{
    for (const point of placed)
    {
        if (distanceXZ(x, z, point.x, point.z) < point.radius + radius + minSpacing)
        {
            return true;
        }
    }

    return false;
}

function matchesPlacementZone (x, z, scatterConfig)
{
    const placement = scatterConfig.placement ?? 'random';

    if (placement === 'random')
    {
        return true;
    }

    const center = scatterConfig.farmCenter ?? { x: 0, z: 0 };
    const distance = distanceXZ(x, z, center.x, center.z);
    const innerRadius = scatterConfig.innerRadius ?? 0;
    const outerRadius = scatterConfig.outerRadius ?? Infinity;

    if (placement === 'perimeter')
    {
        return distance >= innerRadius;
    }

    if (placement === 'ring')
    {
        return distance >= innerRadius && distance <= outerRadius;
    }

    return true;
}

function pickModelKey (scatterConfig, rand)
{
    if (scatterConfig.modelKeys?.length)
    {
        const index = Math.floor(rand() * scatterConfig.modelKeys.length);

        return scatterConfig.modelKeys[index];
    }

    return scatterConfig.modelKey;
}

function resolveAxisRotation (axisConfig, rand, fallback = 0)
{
    if (axisConfig == null)
    {
        return fallback;
    }

    if (typeof axisConfig === 'number')
    {
        return axisConfig;
    }

    return axisConfig.min + rand() * (axisConfig.max - axisConfig.min);
}

function resolveScatterRotation (scatterConfig, rand, modelPlacement = {})
{
    const base = {
        ...(scatterConfig.rotation ?? { x: 0, y: 0, z: 0 }),
        ...(modelPlacement.rotation ?? {}),
    };

    return {
        x: resolveAxisRotation(modelPlacement.rotationX ?? scatterConfig.rotationX, rand, base.x ?? 0),
        y: resolveAxisRotation(modelPlacement.rotationY ?? scatterConfig.rotationY, rand, base.y ?? 0),
        z: resolveAxisRotation(modelPlacement.rotationZ ?? scatterConfig.rotationZ, rand, base.z ?? 0),
    };
}

function resolveModelScatterSettings (scatterConfig, modelKey, rand, getModelPlacement)
{
    const modelPlacement = getModelPlacement?.(modelKey) ?? {};

    return {
        rotation: resolveScatterRotation(scatterConfig, rand, modelPlacement),
        worldSize: resolveWorldSize(modelPlacement.worldSize ?? scatterConfig.worldSize, rand),
        scaleMode: modelPlacement.scaleMode ?? scatterConfig.scaleMode ?? 'max',
        scale: modelPlacement.scale ?? scatterConfig.scale ?? null,
    };
}

function buildScatterTargets (scatterConfig, getModelPlacement)
{
    if (scatterConfig.modelKeys?.length)
    {
        const targets = scatterConfig.modelKeys.map((modelKey) => {
            const placement = getModelPlacement?.(modelKey);

            return {
                modelKey,
                count: placement?.count ?? scatterConfig.modelCounts?.[modelKey] ?? null,
            };
        });

        if (targets.every((target) => target.count != null && target.count > 0))
        {
            return targets;
        }
    }

    if (scatterConfig.modelKey)
    {
        const placement = getModelPlacement?.(scatterConfig.modelKey);

        return [{
            modelKey: scatterConfig.modelKey,
            count: placement?.count ?? scatterConfig.count ?? 10,
        }];
    }

    if (scatterConfig.modelKeys?.length)
    {
        return [{
            modelKey: null,
            count: scatterConfig.count ?? 10,
            modelKeys: scatterConfig.modelKeys,
        }];
    }

    return [{ modelKey: null, count: scatterConfig.count ?? 10 }];
}

const GROUND_PATH_MODELS = new Set(['road', 'roadCorner', 'rubblePath']);

function getPropExclusionZone (prop)
{
    if (prop.exclusionRect)
    {
        return { type: 'rect', ...prop.exclusionRect };
    }

    if (GROUND_PATH_MODELS.has(prop.modelKey))
    {
        const halfLength = (prop.worldSize ?? 10) / 2 + 0.6;
        const halfWidth = prop.exclusionHalfWidth ?? 1.3;
        const rotY = Math.abs((prop.rotation?.y ?? 0) % 180);
        const alongX = rotY > 45 && rotY < 135;

        if (alongX)
        {
            return {
                type: 'rect',
                minX: prop.position.x - halfLength,
                maxX: prop.position.x + halfLength,
                minZ: prop.position.z - halfWidth,
                maxZ: prop.position.z + halfWidth,
            };
        }

        return {
            type: 'rect',
            minX: prop.position.x - halfWidth,
            maxX: prop.position.x + halfWidth,
            minZ: prop.position.z - halfLength,
            maxZ: prop.position.z + halfLength,
        };
    }

    let radius = (prop.exclusionRadius ?? (prop.worldSize ?? 1) * 0.65) + 0.75;

    if (prop.exclusionRadius == null)
    {
        radius = Math.min(radius, 4.5);
    }

    return {
        type: 'circle',
        x: prop.position.x,
        z: prop.position.z,
        radius,
    };
}

export function shouldUsePlacementExclusions (scatterConfig)
{
    if (scatterConfig.avoidPlacement === false)
    {
        return false;
    }

    if (scatterConfig.avoidPlacement === true)
    {
        return true;
    }

    return scatterConfig.layer === 'vegetation';
}

export function buildPlacementExclusions (environmentConfig)
{
    const exclusions = [];

    (environmentConfig.excludeRects ?? []).forEach((rect) => {
        exclusions.push({ type: 'rect', ...rect });
    });

    (environmentConfig.props ?? []).forEach((prop) => {
        exclusions.push(getPropExclusionZone(prop));
    });

    (environmentConfig.grids ?? []).forEach((grid) => {
        const halfWidth = ((grid.columns ?? 1) - 1) * (grid.spacing ?? grid.cellWorldSize ?? 1) * 0.5
            + (grid.cellWorldSize ?? 1) * 0.6;
        const halfDepth = ((grid.rows ?? 1) - 1) * (grid.spacing ?? grid.cellWorldSize ?? 1) * 0.5
            + (grid.cellWorldSize ?? 1) * 0.6;

        exclusions.push({
            type: 'rect',
            minX: grid.position.x - halfWidth,
            maxX: grid.position.x + halfWidth,
            minZ: grid.position.z - halfDepth,
            maxZ: grid.position.z + halfDepth,
        });
    });

    return exclusions;
}

export function createScatteredProps (template, scatterConfig, options = {})
{
    const group = new THREE.Group();
    group.name = scatterConfig.id || 'scatter';

    const rand = seededRandom(scatterConfig.seed ?? 1);
    const bounds = scatterConfig.bounds;
    const groundSink = scatterConfig.groundSink ?? 0.02;
    const exclusions = options.exclusions ?? [];
    const minSpacing = scatterConfig.minSpacing ?? 0;
    const getTemplate = options.getTemplate ?? (() => template);
    const layer = scatterConfig.layer ?? 'decal';
    const placed = [];
    const targets = buildScatterTargets(scatterConfig, options.getModelPlacement);
    const totalCount = targets.reduce((sum, target) => sum + target.count, 0);
    const maxAttempts = scatterConfig.maxAttempts ?? totalCount * 40;

    let attempts = 0;

    for (const target of targets)
    {
        let created = 0;

        while (created < target.count && attempts < maxAttempts)
        {
            attempts++;

            const x = bounds.minX + rand() * (bounds.maxX - bounds.minX);
            const z = bounds.minZ + rand() * (bounds.maxZ - bounds.minZ);
            const modelKey = target.modelKey ?? pickModelKey(
                { modelKeys: target.modelKeys ?? scatterConfig.modelKeys },
                rand
            );
            const modelSettings = resolveModelScatterSettings(
                scatterConfig,
                modelKey,
                rand,
                options.getModelPlacement
            );
            const worldSize = modelSettings.worldSize;
            const footprint = worldSize * 0.45;

            if (!matchesPlacementZone(x, z, scatterConfig))
            {
                continue;
            }

            if (collidesWithExclusions(x, z, footprint, exclusions))
            {
                continue;
            }

            if (collidesWithPlaced(x, z, footprint, placed, minSpacing))
            {
                continue;
            }

            const instance = getTemplate(modelKey);

            if (!instance)
            {
                continue;
            }

            placeModelOnGround(instance, {
                position: {
                    x,
                    y: layer === 'decal'
                        ? (scatterConfig.position?.y ?? 0) - groundSink
                        : (scatterConfig.position?.y ?? 0.05),
                    z,
                },
                rotation: modelSettings.rotation,
                worldSize: modelSettings.worldSize,
                scaleMode: modelSettings.scaleMode,
                scale: modelSettings.scale,
            });

            group.add(instance);
            placed.push({ x, z, radius: footprint });
            created++;
        }
    }

    group.traverse((child) => {
        if (child.isMesh)
        {
            child.renderOrder = scatterConfig.renderOrder ?? (layer === 'decal' ? 1 : 1.5);

            if (layer === 'decal')
            {
                applyGroundDecalMaterial(child);
            }
            else
            {
                applyVegetationMaterial(child);
            }
        }
    });

    return group;
}
