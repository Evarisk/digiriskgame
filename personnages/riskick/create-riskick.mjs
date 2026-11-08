import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

/**
 * Prépare le modèle 3D officiel de Riskick avec squelette Mixamo (Riskick-animated-mixamo.glb) :
 * - Mise à l'échelle exacte à 1/3 de la taille de Guy / d'un humain (1,75 m / 3 = 0,5833 m)
 *   appliquée sur le nœud racine `Armature` (échelle ×0,3431 par rapport aux 1,70 m du rig Mixamo)
 * - Conserve intégralement le maillage texturé (14 104 sommets), les 28 os Mixamo et les 8 animations :
 *   Walking, Running, Cheer_with_Both_Hands, Cheer_with_Both_Hands_1, _360_Power_Spin_Jump,
 *   Hang_and_Push_with_Foot, Knock_Down_1, Upside_Down_Rope_Hang_1
 */

const HUMAN_HEIGHT = 1.75; // Guy / humain dans le jeu = 1,75 m
const TARGET_HEIGHT = HUMAN_HEIGHT / 3; // Riskick = 1/3 de la taille de Guy (≈ 0,5833 m)

const srcBuf = await readFile('personnages/riskick/Riskick-animated-mixamo.glb');
const jsonLen = srcBuf.readUInt32LE(12);
const json = JSON.parse(srcBuf.subarray(20, 20 + jsonLen).toString('utf8'));
const binChunkHeader = 20 + jsonLen;
const binLen = srcBuf.readUInt32LE(binChunkHeader);
const origBin = srcBuf.subarray(binChunkHeader + 8, binChunkHeader + 8 + binLen);

const prim = json.meshes[0].primitives[0];
const posAcc = json.accessors[prim.attributes.POSITION];
const origHeight = posAcc.max[1] - posAcc.min[1]; // 1.70 m
const S = Number((TARGET_HEIGHT / origHeight).toFixed(6)); // ≈ 0.343137

// Applique l'échelle 1/3 sur le nœud racine Armature (parent du maillage Mesh0 et de mixamorig:Hips)
const rootNodeIdx = json.scenes[0].nodes[0];
json.nodes[rootNodeIdx].scale = [S, S, S];

let jsonStr = JSON.stringify(json);
const jsonPad = (4 - (Buffer.byteLength(jsonStr, 'utf8') % 4)) % 4;
jsonStr += ' '.repeat(jsonPad);
const jsonBuf = Buffer.from(jsonStr, 'utf8');

const totalLength = 12 + 8 + jsonBuf.byteLength + 8 + origBin.byteLength;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuf.byteLength, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(origBin.byteLength, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

const glbOut = Buffer.concat([header, jsonHeader, jsonBuf, binHeader, origBin]);

for (const dir of ['personnages/riskick', 'public/models/personnages/riskick', 'public/models/riskick']) {
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/riskick-v1.glb`, glbOut);
}

for (const baseDir of ['public/models/personnages/riskick/viewer', 'public/models/riskick/viewer']) {
  for (const part of ['controls', 'loaders', 'utils']) await mkdir(`${baseDir}/${part}`, { recursive: true });
  for (const [source, target] of [
    ['build/three.module.js', 'three.module.js'],
    ['examples/jsm/controls/OrbitControls.js', 'controls/OrbitControls.js'],
    ['examples/jsm/loaders/GLTFLoader.js', 'loaders/GLTFLoader.js'],
    ['examples/jsm/utils/BufferGeometryUtils.js', 'utils/BufferGeometryUtils.js'],
    ['LICENSE', 'LICENSE'],
  ]) {
    await copyFile(`node_modules/three/${source}`, `${baseDir}/${target}`);
  }
}

console.log(
  JSON.stringify({
    character: 'Riskick (Mixamo Skinned Model)',
    humanHeight: HUMAN_HEIGHT,
    riskickHeight: Number(TARGET_HEIGHT.toFixed(4)),
    ratio: '1/3',
    armatureScale: S,
    vertices: posAcc.count,
    joints: json.skins[0].joints.length,
    animations: json.animations.map((a) => a.name),
    bytes: glbOut.byteLength,
  })
);
