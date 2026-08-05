import Ground3JPG from 'assets/images/Ground3.webp';
import BuildingsJPG from 'assets/images/Buildings.webp';
import RoadsRocksJPG from 'assets/images/RoadsRocks.webp';
import CropsTexturePNG from 'assets/images/Crops_Texture.png';
// import { ACowAngusJPG } from '../../media/images_A_Cow_Angus.jpg.js';
import CMerryweatherClassicJPG from 'assets/images/C_Merryweather_Classic.webp';
import AChickenLeghornJPG from 'assets/images/A_Chicken_Leghorn.webp';
import VegetationPNG from 'assets/images/Vegetation.png';
import ACowShorthornJPG from 'assets/images/A_Cow_Shorthorn.webp';


/**
 * Register textures here after running `npm run base64`.
 *
 * aliases should match the filenames embedded in the FBX (from Unity export paths).
 * The loader remaps those paths to these base64 textures automatically.
 *
 * Material options (applied to any mesh using that texture key):
 *   alphaMode: 'cutout' | 'transparent'
 *   alphaCutoff: 0.5  — used with cutout (Unity alpha clip threshold)
 *   smoothness: 0.3   — optional PBR roughness override
 */
export const FBX_TEXTURES = [
    { key: 'ground3', data: Ground3JPG, aliases: ['Ground3.jpg'] },
    { key: 'buildings', data: BuildingsJPG, aliases: ['Buildings.jpg', 'Buildings_B'] },
    { key: 'roadsRocks', data: RoadsRocksJPG, aliases: ['RoadsRocks.jpg'] },
    { key: 'cropsTexture', data: CropsTexturePNG, aliases: ['Crops_Texture.png', 'CropsTexture.png'] },
    // { key: 'aCowAngus', data: ACowAngusJPG, aliases: ['A_Cow_Angus.jpg'] },
    { key: 'cMerryweatherClassic', data: CMerryweatherClassicJPG, aliases: ['C_Merryweather_Classic.jpg'] },
    { key: 'aChickenLeghorn', data: AChickenLeghornJPG, aliases: ['A_Chicken_Leghorn.jpg'] },
    { key: 'vegetation', data: VegetationPNG, aliases: ['Vegetation.png'], alphaMode: 'cutout' },
    { key: 'aCowShorthorn', data: ACowShorthornJPG, aliases: ['A_Cow_Shorthorn.jpg'] },
];
