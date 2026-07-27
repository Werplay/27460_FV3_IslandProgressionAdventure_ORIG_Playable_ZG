import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const REGISTRY_KEY = 'fbxTextures';
const ALIAS_KEY = 'fbxTextureAliases';
const DATA_KEY = 'fbxTextureData';
const MATERIAL_DEFAULTS_KEY = 'fbxTextureMaterialDefaults';

const TEXTURE_MATERIAL_KEYS = [
    'alphaMode',
    'alphaCutoff',
    'smoothness',
];

function buildAliasMap (textures)
{
    const aliasMap = {};
    const dataMap = {};
    const materialDefaults = {};

    textures.forEach((entry) => {
        const { key, data, aliases = [] } = entry;
        dataMap[key] = data;

        const defaults = {};

        TEXTURE_MATERIAL_KEYS.forEach((prop) => {
            if (entry[prop] !== undefined)
            {
                defaults[prop] = entry[prop];
            }
        });

        if (Object.keys(defaults).length)
        {
            materialDefaults[key] = defaults;
        }

        const names = new Set([ key, ...aliases ]);

        names.forEach((name) => {
            const lower = name.toLowerCase();
            aliasMap[lower] = key;
            aliasMap[lower.replace(/\.[^.]+$/, '')] = key;
        });
    });

    return { aliasMap, dataMap, materialDefaults };
}

/**
 * Match an FBX-embedded texture path/filename to a registered texture key.
 * @param {string} url
 * @param {Record<string, string>} aliasMap
 * @returns {string | null}
 */
export function resolveTextureKey (url, aliasMap)
{
    if (!url)
    {
        return null;
    }

    const decoded = decodeURIComponent(url).toLowerCase();
    const filename = decoded.split('/').pop().split('?')[0];
    const basename = filename.replace(/\.[^.]+$/, '');

    if (aliasMap[filename])
    {
        return aliasMap[filename];
    }

    if (aliasMap[basename])
    {
        return aliasMap[basename];
    }

    for (const [ alias, key ] of Object.entries(aliasMap))
    {
        if (decoded.includes(alias))
        {
            return key;
        }
    }

    return null;
}

/**
 * Redirect FBXLoader texture requests to bundled base64 data URLs.
 * @param {Phaser.Scene} scene
 * @returns {(url: string) => string}
 */
export function createTextureUrlModifier (scene)
{
    const aliasMap = scene.registry.get(ALIAS_KEY) || {};
    const dataMap = scene.registry.get(DATA_KEY) || {};

    return (url) => {
        const key = resolveTextureKey(url, aliasMap);

        if (key && dataMap[key])
        {
            return dataMap[key];
        }

        return url;
    };
}

/**
 * Load one or more base64-encoded images as Three.js textures.
 * @param {Phaser.Scene} scene
 * @param {{ key: string, data: string, aliases?: string[], alphaMode?: 'cutout' | 'transparent', alphaCutoff?: number, smoothness?: number }[]} textures
 * @returns {Promise<Record<string, THREE.Texture>>}
 */
export function LoadBase64Textures (scene, textures)
{
    return new Promise((resolve, reject) => {
        const { aliasMap, dataMap, materialDefaults } = buildAliasMap(textures || []);
        scene.registry.set(ALIAS_KEY, aliasMap);
        scene.registry.set(DATA_KEY, dataMap);
        scene.registry.set(MATERIAL_DEFAULTS_KEY, materialDefaults);

        if (!textures?.length)
        {
            scene.registry.set(REGISTRY_KEY, {});
            resolve({});
            return;
        }

        const registry = {};
        let loaded = 0;
        let failed = false;

        textures.forEach(({ key, data }) => {
            loader.load(
                data,
                (texture) => {
                    if (failed)
                    {
                        return;
                    }

                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.flipY = false;
                    registry[key] = texture;
                    loaded++;

                    if (loaded === textures.length)
                    {
                        scene.registry.set(REGISTRY_KEY, registry);
                        resolve(registry);
                    }
                },
                undefined,
                (error) => {
                    if (!failed)
                    {
                        failed = true;
                        reject(error);
                    }
                }
            );
        });
    });
}

/**
 * @param {Phaser.Scene} scene
 * @returns {Record<string, THREE.Texture>}
 */
export function getFBXTextures (scene)
{
    return scene.registry.get(REGISTRY_KEY) || {};
}

/**
 * Default material options registered with a texture key in fbxTextures.js.
 * @param {Phaser.Scene} scene
 * @param {string} key
 * @returns {Record<string, unknown>}
 */
export function getFBXTextureMaterialDefaults (scene, key)
{
    const defaults = scene.registry.get(MATERIAL_DEFAULTS_KEY) || {};

    return defaults[key] ? { ...defaults[key] } : {};
}
