import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createTextureUrlModifier, getFBXTextures, getFBXTextureMaterialDefaults, resolveTextureKey } from './LoadBase64Textures.js';

const REGISTRY_KEY = 'fbxModels';
const MODEL_META_KEY = 'fbxModelMeta';
const ALIAS_KEY = 'fbxTextureAliases';

const TEXTURE_SLOTS = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
    'bumpMap',
    'displacementMap',
];

function base64ToBlobUrl (base64Data)
{
    const base64 = base64Data.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
    {
        bytes[i] = binary.charCodeAt(i);
    }

    const mimeType = base64Data.split(';')[0].split(':')[1];
    const blob = new Blob([bytes.buffer], { type: mimeType });

    return URL.createObjectURL(blob);
}

function normalizeTextureEntry (entry)
{
    if (typeof entry === 'string')
    {
        return { key: entry };
    }

    return entry;
}

function applyColorToMaterial (material, options)
{
    const hex = options.color.startsWith('#') ? options.color : `#${options.color}`;
    const smoothness = options.smoothness ?? 0.5;
    const roughness = 1 - smoothness;

    return new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: material?.transparent ?? false,
        opacity: material?.opacity ?? 1,
    });
}

function applyMeshMaterial (material, options, textureRegistry)
{
    if (options.color !== undefined)
    {
        return applyColorToMaterial(material, options);
    }

    const texture = textureRegistry[options.key];

    if (!texture)
    {
        return material;
    }

    return applyTextureToMaterial(material, texture, options);
}

function getTextureSourceUrl (texture)
{
    return texture?.image?.src || texture?.source?.data?.src || '';
}

function resolveMeshTextureKey (meshName, explicitTextures, textureRules, aliasMap)
{
    if (explicitTextures?.[meshName])
    {
        const entry = normalizeTextureEntry(explicitTextures[meshName]);

        if (entry.color !== undefined)
        {
            return null;
        }

        return entry.key;
    }

    if (textureRules)
    {
        for (const rule of textureRules)
        {
            const pattern = rule.match instanceof RegExp
                ? rule.match
                : new RegExp(rule.match, 'i');

            if (pattern.test(meshName))
            {
                return rule.key;
            }
        }
    }

    return resolveTextureKey(meshName, aliasMap);
}

/**
 * GLB/gltfpack often leaves meshes unnamed; useful names live on parents or materials.
 * Collect mesh name, parent chain, and material names for texture lookup.
 */
function getMeshTextureLookupNames (mesh)
{
    const names = [];
    const seen = new Set();

    const push = (name) => {
        if (!name || seen.has(name))
        {
            return;
        }

        seen.add(name);
        names.push(name);
    };

    push(mesh.name);

    let parent = mesh.parent;

    while (parent)
    {
        push(parent.name);
        parent = parent.parent;
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [ mesh.material ];

    materials.forEach((material) => {
        push(material?.name);
    });

    return names;
}

function findExplicitTextureEntry (explicitTextures, lookupNames)
{
    if (!explicitTextures)
    {
        return null;
    }

    for (const name of lookupNames)
    {
        if (explicitTextures[name])
        {
            return normalizeTextureEntry(explicitTextures[name]);
        }
    }

    return null;
}

function resolveMeshTextureOptions (mesh, scene, explicitTextures, textureRules)
{
    const aliasMap = scene.registry.get(ALIAS_KEY) || {};
    const textureRegistry = getFBXTextures(scene);
    const lookupNames = getMeshTextureLookupNames(mesh);

    let options = findExplicitTextureEntry(explicitTextures, lookupNames);

    if (!options)
    {
        for (const name of lookupNames)
        {
            const textureKey = resolveMeshTextureKey(
                name,
                null,
                textureRules,
                aliasMap
            );

            if (textureKey && textureRegistry[textureKey])
            {
                options = { key: textureKey, flipY: false };
                break;
            }
        }
    }

    if (!options)
    {
        return null;
    }

    if (options.color === undefined && !textureRegistry[options.key])
    {
        return null;
    }

    return mergeTextureOptions(scene, options);
}

function mergeTextureOptions (scene, options)
{
    if (!options?.key)
    {
        return options;
    }

    return {
        ...getFBXTextureMaterialDefaults(scene, options.key),
        ...options,
    };
}

function getAlphaMaterialProps (material, options)
{
    if (options.alphaMode === 'cutout')
    {
        return {
            transparent: false,
            alphaTest: options.alphaCutoff ?? 0.5,
            depthWrite: true,
        };
    }

    if (options.alphaMode === 'transparent' || options.alphaMode === 'fade')
    {
        return {
            transparent: true,
            depthWrite: false,
            opacity: options.opacity ?? material?.opacity ?? 0.8,
        };
    }

    return {
        transparent: material?.transparent ?? false,
        opacity: material?.opacity ?? 1,
    };
}

function applyTextureToMaterial (material, texture, options = {})
{
    const tex = texture.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    // glTF UVs require flipY = false. FBX atlas remaps often need flipY = true.
    tex.flipY = options.flipY !== undefined ? options.flipY : false;
    tex.needsUpdate = true;

    if (options.repeat)
    {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(options.repeat[0], options.repeat[1]);
    }

    const alphaProps = getAlphaMaterialProps(material, options);

    // glTF/gltfpack materials are often metallic PBR with no map. Our farm lighting
    // is ambient-heavy, so metallic Standard materials look invisible (shadow only).
    // Prefer Phong atlas materials like FBX, with glTF flipY.
    if (options.assignMapOnly)
    {
        return new THREE.MeshPhongMaterial({
            map: tex,
            color: 0xffffff,
            side: THREE.DoubleSide,
            shininess: 20,
            ...alphaProps,
        });
    }

    const materialProps = {
        map: tex,
        color: 0xffffff,
        side: THREE.DoubleSide,
        ...alphaProps,
    };

    if (options.smoothness !== undefined)
    {
        return new THREE.MeshStandardMaterial({
            ...materialProps,
            roughness: 1 - options.smoothness,
            metalness: 0,
            morphTargets: false,
            morphNormals: false,
        });
    }

    return new THREE.MeshPhongMaterial({
        ...materialProps,
    });
}

function assignMeshTextures (object, scene, explicitTextures, textureRules, format = 'fbx')
{
    const textureRegistry = getFBXTextures(scene);
    const isGltf = format === 'glb' || format === 'gltf';
    const fallbackEntry = isGltf
        ? getFirstAtlasTextureEntry(explicitTextures)
        : null;

    object.traverse((child) => {
        if (!child.isMesh)
        {
            return;
        }

        let options = resolveMeshTextureOptions(
            child,
            scene,
            explicitTextures,
            textureRules
        );

        // glTF meshes are often unnamed — fall back to the model's primary atlas.
        if (!options && fallbackEntry)
        {
            options = mergeTextureOptions(scene, fallbackEntry);
        }

        if (!options)
        {
            return;
        }

        if (isGltf)
        {
            options = {
                ...options,
                flipY: options.flipY === true ? true : false,
                assignMapOnly: true,
            };
        }

        if (Array.isArray(child.material))
        {
            child.material = child.material.map((material) => applyMeshMaterial(material, options, textureRegistry));
        }
        else
        {
            child.material = applyMeshMaterial(child.material, options, textureRegistry);
        }

        if (child.isSkinnedMesh)
        {
            child.frustumCulled = false;
        }
    });
}

function getFirstAtlasTextureEntry (explicitTextures)
{
    if (!explicitTextures)
    {
        return null;
    }

    for (const entry of Object.values(explicitTextures))
    {
        const normalized = normalizeTextureEntry(entry);

        if (normalized?.key)
        {
            return normalized;
        }
    }

    return null;
}

function remapMaterialTextures (material, aliasMap, textureRegistry)
{
    TEXTURE_SLOTS.forEach((slot) => {
        const tex = material[slot];

        if (!tex)
        {
            return;
        }

        const key = resolveTextureKey(getTextureSourceUrl(tex), aliasMap);

        if (key && textureRegistry[key])
        {
            material[slot] = textureRegistry[key];
        }
    });

    material.needsUpdate = true;
}

/**
 * Replace FBX-embedded texture references with bundled textures.
 * @param {import('three').Object3D} object
 * @param {Phaser.Scene} scene
 */
function remapEmbeddedTextures (object, scene)
{
    const aliasMap = scene.registry.get(ALIAS_KEY) || {};
    const textureRegistry = getFBXTextures(scene);

    object.traverse((child) => {
        if (!child.isMesh)
        {
            return;
        }

        const materials = Array.isArray(child.material) ? child.material : [ child.material ];

        materials.forEach((material) => {
            remapMaterialTextures(material, aliasMap, textureRegistry);
        });
    });
}

function applyModelTextures (object, scene, textures, textureRegistry, format = 'fbx')
{
    if (!textures)
    {
        return object;
    }

    const isGltf = format === 'glb' || format === 'gltf';

    object.traverse((child) => {
        if (!child.isMesh)
        {
            return;
        }

        const entry = findExplicitTextureEntry(textures, getMeshTextureLookupNames(child));

        if (!entry)
        {
            return;
        }

        let options = mergeTextureOptions(scene, entry);

        if (isGltf)
        {
            options = {
                ...options,
                flipY: options.flipY === true ? true : false,
                assignMapOnly: true,
            };
        }

        if (options.color !== undefined)
        {
            if (Array.isArray(child.material))
            {
                child.material = child.material.map((material) => applyColorToMaterial(material, options));
            }
            else
            {
                child.material = applyColorToMaterial(child.material, options);
            }

            return;
        }

        const texture = textureRegistry[options.key];

        if (!texture)
        {
            console.warn(`Texture not found: ${options.key} for mesh "${child.name}"`);
            return;
        }

        if (Array.isArray(child.material))
        {
            child.material = child.material.map((material) => applyTextureToMaterial(material, texture, options));
        }
        else
        {
            child.material = applyTextureToMaterial(child.material, texture, options);
        }
    });

    return object;
}

function logModelMeshes (object, modelKey)
{
    const meshInfo = [];

    object.traverse((child) => {
        if (child.isMesh)
        {
            meshInfo.push({
                mesh: child.name || '(unnamed)',
                parents: getMeshTextureLookupNames(child).filter((n) => n !== child.name),
                materials: (Array.isArray(child.material) ? child.material : [ child.material ])
                    .map((m) => m?.name || '(unnamed)'),
            });
        }
    });

    console.info(`Model "${modelKey}" mesh children:`, meshInfo);
}

function logModelAnimations (object, modelKey, animationConfig)
{
    if (!object.animations?.length)
    {
        if (animationConfig)
        {
            console.warn(`Model "${modelKey}" has no baked animation clips.`);
        }
        return;
    }

    console.info(`Model "${modelKey}" animations:`, object.animations.map((clip) => clip.name));
}

function stripMorphTargets (mesh)
{
    if (!mesh?.isMesh)
    {
        return;
    }

    mesh.morphTargetInfluences = undefined;
    mesh.morphTargetDictionary = undefined;

    if (mesh.geometry)
    {
        mesh.geometry.morphAttributes = {};
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [ mesh.material ];

    materials.forEach((material) => {
        if (!material)
        {
            return;
        }

        material.morphTargets = false;
        material.morphNormals = false;
        material.needsUpdate = true;
    });

    mesh.customDepthMaterial = undefined;
    mesh.customDistanceMaterial = undefined;
}

function sanitizeModelMorphs (object)
{
    object.traverse((child) => {
        stripMorphTargets(child);
    });
}

function prepareModel (object, { castShadow = true, stripMorphTargets: shouldStrip = false } = {})
{
    object.traverse((child) => {
        if (child.isMesh)
        {
            child.castShadow = castShadow;
            child.receiveShadow = true;

            if (child.isSkinnedMesh)
            {
                child.frustumCulled = false;
                child.skeleton?.update();
            }
        }
    });

    if (shouldStrip)
    {
        sanitizeModelMorphs(object);
    }

    return object;
}

function createFBXLoader (scene)
{
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(createTextureUrlModifier(scene));

    return new FBXLoader(manager);
}

function createGLTFLoader (scene)
{
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(createTextureUrlModifier(scene));

    // assets/models/*.glb ship EXT_meshopt_compression, which is a REQUIRED
    // extension — without the decoder the loader rejects the file outright.
    return new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
}

/**
 * Resolve model format from explicit `format` or the data URL MIME type.
 * @param {{ format?: string, data?: string }} entry
 * @returns {'fbx' | 'glb' | 'gltf'}
 */
export function resolveModelFormat (entry)
{
    const explicit = entry?.format?.toLowerCase?.();

    if (explicit === 'fbx' || explicit === 'glb' || explicit === 'gltf')
    {
        return explicit;
    }

    const data = entry?.data ?? '';
    const mime = data.split(';')[0].split(':')[1] ?? '';

    if (mime.includes('gltf-binary') || mime === 'model/gltf-binary')
    {
        return 'glb';
    }

    if (mime.includes('gltf+json') || mime === 'model/gltf+json')
    {
        return 'gltf';
    }

    return 'fbx';
}

function finalizeLoadedObject (object, animations = [])
{
    if (animations?.length)
    {
        object.animations = animations;
    }

    return object;
}

/**
 * Load one or more base64-encoded FBX / GLB / GLTF models into the scene registry.
 * Set `format: 'glb'` (or omit and use a GLB data URL MIME) to use GLTFLoader.
 * @param {Phaser.Scene} scene
 * @param {{ key: string, data: string, format?: 'fbx' | 'glb' | 'gltf', textures?: Record<string, string | { key: string, repeat?: [number, number], flipY?: boolean }>, textureRules?: { match: string | RegExp, key: string }[] }[]} models
 * @returns {Promise<Record<string, import('three').Group>>}
 */
export function LoadBase64FBX (scene, models)
{
    return new Promise((resolve, reject) => {
        if (!models?.length)
        {
            scene.registry.set(REGISTRY_KEY, {});
            scene.registry.set(MODEL_META_KEY, {});
            resolve({});
            return;
        }

        const textureRegistry = getFBXTextures(scene);
        const fbxLoader = createFBXLoader(scene);
        const gltfLoader = createGLTFLoader(scene);
        const registry = {};
        const modelMeta = {};
        let loaded = 0;
        let failed = false;

        const onModelReady = (key, object, { textures, textureRules, animation, stripMorphTargets, castShadow, format }) => {
            if (failed)
            {
                return;
            }

            prepareModel(object, { castShadow, stripMorphTargets });
            // logModelMeshes(object, key);
            // logModelAnimations(object, key, animation);
            remapEmbeddedTextures(object, scene);
            assignMeshTextures(object, scene, textures, textureRules, format);
            applyModelTextures(object, scene, textures, textureRegistry, format);

            if (stripMorphTargets)
            {
                sanitizeModelMorphs(object);
            }

            registry[key] = object;

            if (animation || stripMorphTargets)
            {
                modelMeta[key] = {
                    ...(animation ? { animation } : {}),
                    ...(stripMorphTargets ? { stripMorphTargets: true } : {}),
                };
            }

            loaded++;

            if (loaded === models.length)
            {
                scene.registry.set(REGISTRY_KEY, registry);
                scene.registry.set(MODEL_META_KEY, modelMeta);
                resolve(registry);
            }
        };

        const onModelError = (url, error) => {
            URL.revokeObjectURL(url);

            if (!failed)
            {
                failed = true;
                reject(error);
            }
        };

        models.forEach((entry) => {
            const {
                key,
                data,
                textures,
                textureRules,
                animation,
                stripMorphTargets,
                castShadow,
            } = entry;
            const format = resolveModelFormat(entry);
            const url = base64ToBlobUrl(data);
            const options = { textures, textureRules, animation, stripMorphTargets, castShadow, format };

            if (format === 'glb' || format === 'gltf')
            {
                gltfLoader.load(
                    url,
                    (gltf) => {
                        URL.revokeObjectURL(url);
                        const object = finalizeLoadedObject(gltf.scene, gltf.animations);
                        onModelReady(key, object, options);
                    },
                    undefined,
                    (error) => onModelError(url, error)
                );
                return;
            }

            fbxLoader.load(
                url,
                (object) => {
                    URL.revokeObjectURL(url);
                    onModelReady(key, object, options);
                },
                undefined,
                (error) => onModelError(url, error)
            );
        });
    });
}

function modelHasSkinnedMesh (object)
{
    let found = false;

    object.traverse((child) => {
        if (child.isSkinnedMesh)
        {
            found = true;
        }
    });

    return found;
}

/**
 * Clone a loaded FBX model from the registry for use in a Three.js scene.
 * @param {Phaser.Scene} scene
 * @param {string} key
 * @returns {import('three').Group | null}
 */
export function getFBXModel (scene, key)
{
    const registry = scene.registry.get(REGISTRY_KEY);

    if (!registry?.[key])
    {
        console.warn(`FBX model not found: ${key}`);
        return null;
    }

    const source = registry[key];
    const clone = modelHasSkinnedMesh(source)
        ? cloneSkinnedModel(source)
        : source.clone(true);

    clone.animations = source.animations;

    clone.traverse((child) => {
        if (child.isSkinnedMesh)
        {
            child.frustumCulled = false;
            child.skeleton?.update();
        }
    });

    const meta = getFBXModelMeta(scene, key);

    if (meta?.stripMorphTargets)
    {
        sanitizeModelMorphs(clone);
    }

    return clone;
}

/**
 * @param {Phaser.Scene} scene
 * @param {string} key
 * @returns {{ animation?: { clip?: string, loop?: boolean, timeScale?: number } } | null}
 */
export function getFBXModelMeta (scene, key)
{
    const meta = scene.registry.get(MODEL_META_KEY);

    return meta?.[key] ?? null;
}
