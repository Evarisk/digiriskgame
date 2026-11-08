import * as T from 'three';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

/**
 * Prépare et anime le vrai modèle 3D de Riskick (Riskick-grand-10cm.glb) :
 * - Mise à l'échelle à 1/3 de la taille de Guy / d'un humain (1,75 m / 3 = 0,5833 m, soit ×5,8333 par rapport aux 10 cm d'origine)
 * - Rigging squelettique glTF 2.0 (SkinnedMesh : Root, Torso, Head, Arm_R, Arm_L, Leg_R, Ankle_R, Leg_L, Ankle_L)
 *   avec lissage Laplacien des poids sur le graphe de maillage (0 couture, textures originales intactes)
 * - Animations embarquées : Idle (Au repos), Taunt (Provocation), Walk (Marche), Run (Course)
 */

const HUMAN_HEIGHT = 1.75; // Guy / humain dans le jeu = 1,75 m
const TARGET_HEIGHT = HUMAN_HEIGHT / 3; // Riskick = 1/3 de la taille de Guy (≈ 0,5833 m)

const srcBuf = await readFile('personnages/riskick/Riskick-grand-10cm.glb');
const jsonLen = srcBuf.readUInt32LE(12);
const json = JSON.parse(srcBuf.subarray(20, 20 + jsonLen).toString('utf8'));
const binChunkHeader = 20 + jsonLen;
const binLen = srcBuf.readUInt32LE(binChunkHeader);
const origBin = Buffer.from(srcBuf.subarray(binChunkHeader + 8, binChunkHeader + 8 + binLen));

const prim = json.meshes[0].primitives[0];
const posAcc = json.accessors[prim.attributes.POSITION];
const posBv = json.bufferViews[posAcc.bufferView];
const posByteOffset = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);
const vertexCount = posAcc.count;

const indAcc = json.accessors[prim.indices];
const indBv = json.bufferViews[indAcc.bufferView];
const indByteOffset = (indBv.byteOffset || 0) + (indAcc.byteOffset || 0);
const indexCount = indAcc.count;

// Lecture des positions (en coordonnées d'origine 0..0.10 m pour le calcul anatomique)
const rawPos = new Float32Array(origBin.buffer, origBin.byteOffset + posByteOffset, vertexCount * 3);
const indices = new Uint32Array(origBin.buffer, origBin.byteOffset + indByteOffset, indexCount);

const origHeight = posAcc.max[1] - posAcc.min[1];
const S = TARGET_HEIGHT / origHeight; // ≈ 5.833333

// ==================== 1. SOUDURE SPATIALE & GRAPHE DE VOISINAGE ====================
// Regroupe les sommets co-localisés (coutures UV) pour garantir des poids 100 % identiques sur les coutures
const quantKey = (x, y, z) => `${Math.round(x * 1e5)}_${Math.round(y * 1e5)}_${Math.round(z * 1e5)}`;
const uniqueMap = new Map();
const vertToUnique = new Int32Array(vertexCount);
const uniqueCoords = [];

for (let i = 0; i < vertexCount; i++) {
  const x = rawPos[i * 3];
  const y = rawPos[i * 3 + 1];
  const z = rawPos[i * 3 + 2];
  const k = quantKey(x, y, z);
  let u = uniqueMap.get(k);
  if (u === undefined) {
    u = uniqueCoords.length;
    uniqueMap.set(k, u);
    uniqueCoords.push([x, y, z]);
  }
  vertToUnique[i] = u;
}

const uniqueCount = uniqueCoords.length;
const neighbors = Array.from({ length: uniqueCount }, () => []);
const addEdge = (a, b) => {
  if (a === b) return;
  const listA = neighbors[a];
  if (!listA.includes(b)) listA.push(b);
  const listB = neighbors[b];
  if (!listB.includes(a)) listB.push(a);
};

for (let t = 0; t < indexCount; t += 3) {
  const u0 = vertToUnique[indices[t]];
  const u1 = vertToUnique[indices[t + 1]];
  const u2 = vertToUnique[indices[t + 2]];
  addEdge(u0, u1);
  addEdge(u1, u2);
  addEdge(u2, u0);
}

// ==================== 2. DÉFINITION DU SQUELETTE (9 OS) ====================
// Indices des os dans skin.joints :
// 0: Root, 1: Torso, 2: Head, 3: Arm_R, 4: Arm_L, 5: Leg_R, 6: Ankle_R, 7: Leg_L, 8: Ankle_L
const BONES = [
  { name: 'Root', parent: -1, world: [0, 0, 0], local: [0, 0, 0], children: [1, 5, 7] },
  { name: 'Torso', parent: 0, world: [0, 0.0215 * S, 0], local: [0, 0.0215 * S, 0], children: [2, 3, 4] },
  { name: 'Head', parent: 1, world: [-0.002 * S, 0.0455 * S, 0.002 * S], local: [-0.002 * S, 0.024 * S, 0.002 * S], children: [] },
  { name: 'Arm_R', parent: 1, world: [-0.0145 * S, 0.0365 * S, 0.004 * S], local: [-0.0145 * S, 0.015 * S, 0.004 * S], children: [] },
  { name: 'Arm_L', parent: 1, world: [0.0125 * S, 0.0375 * S, -0.005 * S], local: [0.0125 * S, 0.016 * S, -0.005 * S], children: [] },
  { name: 'Leg_R', parent: 0, world: [-0.0145 * S, 0.0205 * S, 0.003 * S], local: [-0.0145 * S, 0.0205 * S, 0.003 * S], children: [6] },
  { name: 'Ankle_R', parent: 5, world: [-0.0225 * S, 0.0055 * S, 0.008 * S], local: [-0.008 * S, -0.015 * S, 0.005 * S], children: [] },
  { name: 'Leg_L', parent: 0, world: [0.0105 * S, 0.0205 * S, -0.006 * S], local: [0.0105 * S, 0.0205 * S, -0.006 * S], children: [8] },
  { name: 'Ankle_L', parent: 7, world: [0.01 * S, 0.0055 * S, -0.009 * S], local: [-0.0005 * S, -0.015 * S, -0.003 * S], children: [] },
];

const numBones = BONES.length;

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Poids initiaux par sommet unique (9 composantes par sommet)
let weights = new Float32Array(uniqueCount * numBones);

for (let u = 0; u < uniqueCount; u++) {
  const [x, y, z] = uniqueCoords[u];
  const base = u * numBones;

  // Séparation anatomique
  const isRightHand = x < -0.0165 && y >= 0.0235 && y < 0.0535 && (y < 0.0435 || z > 0.0045);
  const isLeftArm = x > 0.0135 && y >= 0.0225 && y < 0.0435;

  if (y < 0.0225 && !isRightHand && !isLeftArm) {
    // Jambes et pieds (fusion douce avec le torse entre y = 0.0185 et y = 0.0225)
    const wTorso = smoothstep(0.0185, 0.0225, y);
    const wLegTotal = 1 - wTorso;
    const isLeft = x >= -0.0052;
    const wAnkle = 1 - smoothstep(0.0055, 0.0105, y);
    const wHip = 1 - wAnkle;

    weights[base + 1] = wTorso;
    if (isLeft) {
      weights[base + 7] = wLegTotal * wHip;
      weights[base + 8] = wLegTotal * wAnkle;
    } else {
      weights[base + 5] = wLegTotal * wHip;
      weights[base + 6] = wLegTotal * wAnkle;
    }
  } else if (isRightHand) {
    const wArm = smoothstep(-0.015, -0.019, x);
    weights[base + 3] = wArm;
    weights[base + 1] = 1 - wArm;
  } else if (isLeftArm) {
    const wArm = smoothstep(0.0125, 0.0165, x);
    weights[base + 4] = wArm;
    weights[base + 1] = 1 - wArm;
  } else if (y >= 0.044) {
    const wHead = smoothstep(0.044, 0.0485, y);
    weights[base + 2] = wHead;
    weights[base + 1] = 1 - wHead;
  } else {
    weights[base + 1] = 1;
  }
}

// Lissage Laplacien sur le graphe de maillage (les parties non connectées comme les 2 jambes ou main/joue restent isolées)
let nextWeights = new Float32Array(uniqueCount * numBones);
for (let iter = 0; iter < 8; iter++) {
  for (let u = 0; u < uniqueCount; u++) {
    const nb = neighbors[u];
    const base = u * numBones;
    if (!nb.length) {
      for (let b = 0; b < numBones; b++) nextWeights[base + b] = weights[base + b];
      continue;
    }
    for (let b = 0; b < numBones; b++) {
      let sum = 0;
      for (let k = 0; k < nb.length; k++) sum += weights[nb[k] * numBones + b];
      nextWeights[base + b] = 0.55 * weights[base + b] + 0.45 * (sum / nb.length);
    }
  }
  const tmp = weights;
  weights = nextWeights;
  nextWeights = tmp;
}

// Extraction des 4 meilleurs os par sommet du maillage (JOINTS_0 et WEIGHTS_0)
const jointsArray = new Uint8Array(vertexCount * 4);
const weightsArray = new Float32Array(vertexCount * 4);

for (let i = 0; i < vertexCount; i++) {
  const u = vertToUnique[i];
  const base = u * numBones;
  const pairs = [];
  for (let b = 0; b < numBones; b++) {
    const w = weights[base + b];
    if (w > 1e-4) pairs.push([b, w]);
  }
  pairs.sort((a, b) => b[1] - a[1]);
  while (pairs.length < 4) pairs.push([0, 0]);
  const top4 = pairs.slice(0, 4);
  const total = top4[0][1] + top4[1][1] + top4[2][1] + top4[3][1] || 1;
  for (let k = 0; k < 4; k++) {
    jointsArray[i * 4 + k] = top4[k][0];
    weightsArray[i * 4 + k] = top4[k][1] / total;
  }
}

// ==================== 3. MISE À L'ÉCHELLE 1/3 DU MAILLAGE ====================
for (let i = 0; i < vertexCount * 3; i++) {
  rawPos[i] *= S;
}
posAcc.min = posAcc.min.map((v) => v * S);
posAcc.max = posAcc.max.map((v) => v * S);

// ==================== 4. MATRICES INVERSE BIND & ANIMATIONS ====================
const ibmArray = new Float32Array(numBones * 16);
for (let b = 0; b < numBones; b++) {
  const [wx, wy, wz] = BONES[b].world;
  const m = new T.Matrix4().makeTranslation(-wx, -wy, -wz);
  m.toArray(ibmArray, b * 16);
}

// Nœuds glTF : 0 = Mesh, 1..9 = Bones (boneIdx + 1)
json.nodes = [
  { name: 'Riskick', mesh: 0, skin: 0 },
  ...BONES.map((b) => {
    const node = {
      name: b.name,
      translation: b.local,
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    };
    if (b.children.length) node.children = b.children.map((c) => c + 1);
    return node;
  }),
];
json.scenes[0].nodes = [0, 1];

// Aide pour construire les données binaires supplémentaires alignées sur 4 octets
const extraChunks = [];
let currentByteOffset = origBin.byteLength;

function appendBufferView(typedArray, target) {
  const pad = (4 - (currentByteOffset % 4)) % 4;
  if (pad > 0) {
    extraChunks.push(Buffer.alloc(pad));
    currentByteOffset += pad;
  }
  const buf = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const bvIndex = json.bufferViews.length;
  const bv = { buffer: 0, byteOffset: currentByteOffset, byteLength: buf.byteLength };
  if (target) bv.target = target;
  json.bufferViews.push(bv);
  extraChunks.push(buf);
  currentByteOffset += buf.byteLength;
  return bvIndex;
}

function appendAccessor(typedArray, componentType, count, type, target, minMax = null) {
  const bvIndex = appendBufferView(typedArray, target);
  const accIndex = json.accessors.length;
  const acc = { bufferView: bvIndex, componentType, count, type };
  if (minMax) {
    acc.min = minMax.min;
    acc.max = minMax.max;
  }
  json.accessors.push(acc);
  return accIndex;
}

const jointsAccIdx = appendAccessor(jointsArray, 5121, vertexCount, 'VEC4', 34962);
const weightsAccIdx = appendAccessor(weightsArray, 5126, vertexCount, 'VEC4', 34962);
const ibmAccIdx = appendAccessor(ibmArray, 5126, numBones, 'MAT4', undefined);

prim.attributes.JOINTS_0 = jointsAccIdx;
prim.attributes.WEIGHTS_0 = weightsAccIdx;

json.skins = [
  {
    name: 'RiskickArmature',
    inverseBindMatrices: ibmAccIdx,
    skeleton: 1,
    joints: BONES.map((_, idx) => idx + 1),
  },
];

// Échantillonnage d'un clip d'animation vers la structure glTF 2.0
function buildGltfAnimation(name, duration, steps, poseFn) {
  const times = new Float32Array(steps + 1);
  for (let i = 0; i <= steps; i++) times[i] = (i / steps) * duration;
  const timeAccIdx = appendAccessor(times, 5126, steps + 1, 'SCALAR', undefined, {
    min: [0],
    max: [duration],
  });

  const boneTracks = new Map();
  for (let i = 0; i <= steps; i++) {
    const phi = (i / steps) * Math.PI * 2;
    const pose = poseFn(phi, times[i]);
    for (const [boneName, tr] of Object.entries(pose)) {
      const boneIdx = BONES.findIndex((b) => b.name === boneName);
      if (boneIdx < 0) continue;
      if (!boneTracks.has(boneIdx)) {
        boneTracks.set(boneIdx, {
          pos: new Float32Array((steps + 1) * 3),
          quat: new Float32Array((steps + 1) * 4),
          scale: new Float32Array((steps + 1) * 3),
          hasPos: false,
          hasQuat: false,
          hasScale: false,
        });
      }
      const ch = boneTracks.get(boneIdx);
      const baseLocal = BONES[boneIdx].local;
      if (tr.dPos) {
        ch.hasPos = true;
        ch.pos[i * 3] = baseLocal[0] + tr.dPos[0] * S;
        ch.pos[i * 3 + 1] = baseLocal[1] + tr.dPos[1] * S;
        ch.pos[i * 3 + 2] = baseLocal[2] + tr.dPos[2] * S;
      } else {
        ch.pos[i * 3] = baseLocal[0];
        ch.pos[i * 3 + 1] = baseLocal[1];
        ch.pos[i * 3 + 2] = baseLocal[2];
      }
      if (tr.rot) {
        ch.hasQuat = true;
        const q = new T.Quaternion().setFromEuler(new T.Euler(tr.rot[0], tr.rot[1], tr.rot[2], 'XYZ'));
        ch.quat[i * 4] = q.x;
        ch.quat[i * 4 + 1] = q.y;
        ch.quat[i * 4 + 2] = q.z;
        ch.quat[i * 4 + 3] = q.w;
      } else {
        ch.quat[i * 4 + 3] = 1;
      }
      if (tr.scale) {
        ch.hasScale = true;
        ch.scale[i * 3] = tr.scale[0];
        ch.scale[i * 3 + 1] = tr.scale[1];
        ch.scale[i * 3 + 2] = tr.scale[2];
      } else {
        ch.scale[i * 3] = 1;
        ch.scale[i * 3 + 1] = 1;
        ch.scale[i * 3 + 2] = 1;
      }
    }
  }

  const samplers = [];
  const channels = [];
  for (const [boneIdx, ch] of boneTracks.entries()) {
    const targetNode = boneIdx + 1;
    if (ch.hasPos) {
      const outAcc = appendAccessor(ch.pos, 5126, steps + 1, 'VEC3', undefined);
      const sIdx = samplers.length;
      samplers.push({ input: timeAccIdx, interpolation: 'LINEAR', output: outAcc });
      channels.push({ sampler: sIdx, target: { node: targetNode, path: 'translation' } });
    }
    if (ch.hasQuat) {
      const outAcc = appendAccessor(ch.quat, 5126, steps + 1, 'VEC4', undefined);
      const sIdx = samplers.length;
      samplers.push({ input: timeAccIdx, interpolation: 'LINEAR', output: outAcc });
      channels.push({ sampler: sIdx, target: { node: targetNode, path: 'rotation' } });
    }
    if (ch.hasScale) {
      const outAcc = appendAccessor(ch.scale, 5126, steps + 1, 'VEC3', undefined);
      const sIdx = samplers.length;
      samplers.push({ input: timeAccIdx, interpolation: 'LINEAR', output: outAcc });
      channels.push({ sampler: sIdx, target: { node: targetNode, path: 'scale' } });
    }
  }
  return { name, samplers, channels };
}

// 1. Animation Walk (Marche complète articulée)
function legCycle(phase, side) {
  const swing = Math.sin(phase); // > 0 : jambe vers l'avant (+Z)
  const pass = Math.cos(phase); // > 0 : pied levé qui passe vers l'avant
  const lift = Math.max(0, pass);
  const stance = Math.max(0, -pass);

  return {
    leg: {
      dPos: [side * 0.0005 * lift, 0.0038 * lift - 0.0008 * stance, 0.0028 * swing],
      rot: [-0.55 * swing + 0.05 * lift, -side * 0.08 * swing, side * 0.035 * lift],
    },
    ankle: {
      dPos: [0, 0.001 * lift, 0],
      rot: [-0.24 * lift + 0.28 * Math.max(0, -swing) * stance - 0.1 * Math.max(0, swing), 0, -side * 0.03 * lift],
    },
  };
}

const walkAnim = buildGltfAnimation('Walk', 0.88, 36, (phi) => {
  const right = legCycle(phi, -1); // Leg_R est du côté -X
  const left = legCycle(phi + Math.PI, 1); // Leg_L est du côté +X
  const bounce = Math.cos(2 * phi);
  const sway = Math.sin(phi);

  return {
    Torso: {
      dPos: [0.0012 * sway, 0.0022 * bounce, 0.0008 * Math.sin(2 * phi)],
      rot: [0.08 + 0.025 * Math.sin(2 * phi), -0.14 * sway, -0.065 * sway],
      scale: [1 - 0.012 * bounce, 1 + 0.02 * bounce, 1 - 0.012 * bounce],
    },
    Head: {
      dPos: [0, 0.001 * Math.cos(2 * phi - 0.35), 0],
      rot: [-0.03 + 0.035 * Math.sin(2 * phi - 0.4), 0.1 * Math.sin(phi - 0.25), 0.055 * Math.sin(phi - 0.2)],
    },
    Arm_R: {
      rot: [0.38 * sway, -0.12 * sway, 0.08 * Math.cos(phi)],
    },
    Arm_L: {
      rot: [-0.36 * sway, -0.1 * sway, -0.06 * Math.cos(phi)],
    },
    Leg_R: right.leg,
    Ankle_R: right.ankle,
    Leg_L: left.leg,
    Ankle_L: left.ankle,
  };
});

// 2. Animation Idle (Au repos : respiration, regard espiègle, main levée qui invite au danger)
const idleAnim = buildGltfAnimation('Idle', 2.4, 32, (phi) => {
  const b = Math.sin(phi);
  return {
    Torso: {
      dPos: [0, 0.0008 * b, 0],
      rot: [0.02 * b, 0.05 * Math.sin(phi), 0.02 * Math.cos(phi)],
      scale: [1 - 0.01 * b, 1 + 0.018 * b, 1 - 0.01 * b],
    },
    Head: {
      rot: [0.025 * Math.cos(phi), 0.09 * Math.sin(phi), 0.035 * Math.sin(phi)],
    },
    Arm_R: {
      rot: [0.06 * b, 0.05 * Math.cos(phi), 0.07 * b],
    },
    Arm_L: {
      rot: [-0.03 * b, 0, -0.03 * b],
    },
  };
});

// 3. Animation Taunt (Provocation : « Tu remets à demain ? Moi, je reste ! »)
const tauntAnim = buildGltfAnimation('Taunt', 2.0, 32, (phi) => {
  const hop = Math.abs(Math.sin(phi * 2));
  const wave = Math.sin(phi * 2);
  return {
    Torso: {
      dPos: [0, 0.0028 * hop, 0],
      rot: [-0.05 * hop, 0.14 * Math.sin(phi), 0.055 * wave],
      scale: [1 + 0.02 * hop, 1 - 0.018 * Math.cos(phi * 2), 1],
    },
    Head: {
      rot: [-0.06 * hop, -0.18 * Math.sin(phi), 0.08 * wave],
    },
    Arm_R: {
      rot: [-0.18 + 0.22 * wave, 0.14 * Math.sin(phi), 0.18 * Math.sin(phi * 2)],
    },
    Arm_L: {
      rot: [0.1 * wave, 0, -0.08 * hop],
    },
    Leg_R: {
      dPos: [0, 0.0018 * hop, 0],
      rot: [-0.1 * hop, 0, -0.04 * hop],
    },
    Leg_L: {
      dPos: [0, 0.0018 * hop, 0],
      rot: [-0.1 * hop, 0, 0.04 * hop],
    },
  };
});

json.animations = [idleAnim, tauntAnim, walkAnim];
json.buffers[0].byteLength = currentByteOffset;

// Assemblage du nouveau fichier GLB binaire (JSON + BIN alignés sur 4 octets)
let jsonStr = JSON.stringify(json);
const jsonPad = (4 - (Buffer.byteLength(jsonStr, 'utf8') % 4)) % 4;
jsonStr += ' '.repeat(jsonPad);
const jsonBuf = Buffer.from(jsonStr, 'utf8');

const binPad = (4 - (currentByteOffset % 4)) % 4;
if (binPad > 0) {
  extraChunks.push(Buffer.alloc(binPad));
  currentByteOffset += binPad;
}
const finalBinBuf = Buffer.concat([origBin, ...extraChunks]);

const totalLength = 12 + 8 + jsonBuf.byteLength + 8 + finalBinBuf.byteLength;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(totalLength, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuf.byteLength, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(finalBinBuf.byteLength, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

const glbOut = Buffer.concat([header, jsonHeader, jsonBuf, binHeader, finalBinBuf]);

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
    character: 'Riskick (modèle 3D officiel Riskick-grand-10cm.glb)',
    humanHeight: HUMAN_HEIGHT,
    riskickHeight: Number(TARGET_HEIGHT.toFixed(4)),
    ratio: '1/3',
    scaleFactor: Number(S.toFixed(4)),
    vertices: vertexCount,
    triangles: indexCount / 3,
    bones: BONES.map((b) => b.name),
    animations: json.animations.map((a) => ({ name: a.name, channels: a.channels.length })),
    bytes: glbOut.byteLength,
  })
);
