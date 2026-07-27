import * as THREE from 'three';
import { getFBXTextures } from '../utils/LoadBase64Textures.js';

/**
 * Textured ground plane (replaces mapOpt FBX).
 * @param {Phaser.Scene} phaserScene
 * @param {{
 *   textureKey?: string,
 *   size?: { width: number, depth: number },
 *   worldSize?: number,
 *   position?: { x: number, y: number, z: number },
 *   flipY?: boolean,
 *   repeat?: [number, number],
 * }} mapCfg
 * @returns {{ mesh: THREE.Mesh, worldSize: number } | null}
 */
export function createGroundPlane (phaserScene, mapCfg = {})
{
    const textureKey = mapCfg.textureKey ?? 'ground3';
    const source = getFBXTextures(phaserScene)[textureKey];

    if (!source)
    {
        console.warn(`Ground texture not found: ${textureKey}`);
        return null;
    }

    const tex = source.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = mapCfg.flipY !== false;

    if (mapCfg.repeat)
    {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(mapCfg.repeat[0], mapCfg.repeat[1]);
    }

    const worldSize = mapCfg.worldSize ?? 100;
    const width = mapCfg.size?.width ?? worldSize;
    const depth = mapCfg.size?.depth ?? worldSize;

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        new THREE.MeshPhongMaterial({
            map: tex,
            color: 0xffffff,
            side: THREE.DoubleSide,
        })
    );

    mesh.name = 'groundPlane';
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.renderOrder = 0;

    const offset = mapCfg.position ?? { x: 0, y: 0, z: 0 };
    mesh.position.set(offset.x, offset.y, offset.z);

    return { mesh, worldSize: Math.max(width, depth) };
}
