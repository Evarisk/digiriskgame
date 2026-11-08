import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

// Node implementation of the browser API used by Three's binary exporter.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

const root = new T.Group();
root.name = 'PreventeurGuy';

// Palette fidèle aux planches guy-face_profil.png, Guy_action sans EPI.png et Guy_action avec EPI.png
const mat = (color, roughness = 0.65, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const skin = mat('#f2b88c', 0.68);
const hairMat = mat('#8c5327', 0.72);
const browMat = mat('#5a3417', 0.7);
const templeGrey = mat('#9aa3b2', 0.4, 0.3);
const sweaterBlue = mat('#586592', 0.72);
const vestYellow = mat('#eef568', 0.52);
const vestTrim = mat('#2a303c', 0.65);
const reflective = mat('#c8d0da', 0.3, 0.35);
const pantsMat = mat('#8c92a4', 0.75);
const bootMat = mat('#3a3d42', 0.62);
const soleMat = mat('#222428', 0.85);
const bootYellow = mat('#eab308', 0.5);
const dark = mat('#1d1f24', 0.55);
const mouthMat = mat('#7c2d26', 0.65);
const white = mat('#ffffff', 0.45);
// EPI (casque jaune, lunettes, casque antibruit orange/noir, porte-bloc)
const helmetYellow = mat('#facc15', 0.38);
const earmuffOrange = mat('#ea580c', 0.48);
const gloveGrey = mat('#64748b', 0.65);
const clipboardMat = mat('#475569', 0.6);

function ball(parent, name, material, position, scale, rotation = [0, 0, 0]) {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 16), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function cyl(parent, name, material, rTop, rBot, height, position, rotation = [0, 0, 0]) {
  const mesh = new T.Mesh(new T.CylinderGeometry(rTop, rBot, height, 20), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function tube(parent, name, points, radii, material) {
  const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p)));
  const geo = new T.TubeGeometry(curve, 24, 1, 12, false);
  const pos = geo.attributes.position;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const center = curve.getPointAt(t);
    const f = t * (radii.length - 1);
    const r = T.MathUtils.lerp(radii[Math.floor(f)], radii[Math.min(Math.floor(f) + 1, radii.length - 1)], f % 1);
    for (let j = 0; j <= 12; j++) {
      const k = i * 13 + j;
      const v = new T.Vector3().fromBufferAttribute(pos, k).sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, material);
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function relief(parent, name, material, shape, position, depth = 0.018, bevel = 0.01, rotation = [0, 0, 0]) {
  const geo = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 20,
    steps: 1,
  });
  const mesh = new T.Mesh(geo, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

// ==================== TORSE & GILET HAUTE VISIBILITÉ ====================
const torso = new T.Group();
torso.name = 'Torso';
torso.position.set(0, 0.96, 0);
root.add(torso);

ball(torso, 'Pelvis', pantsMat, [0, -0.15, 0], [0.165, 0.12, 0.115]);
cyl(torso, 'SweaterTorso', sweaterBlue, 0.165, 0.15, 0.42, [0, 0.08, 0]);
cyl(torso, 'SafetyVest', vestYellow, 0.172, 0.158, 0.41, [0, 0.075, 0.003]);
cyl(torso, 'VestZipper', vestTrim, 0.008, 0.008, 0.34, [0, 0.04, 0.166]);
ball(torso, 'SweaterCollarV', sweaterBlue, [0, 0.25, 0.055], [0.075, 0.068, 0.09]);
cyl(torso, 'Neck', skin, 0.046, 0.052, 0.11, [0, 0.33, 0]);

// Deux bandes réfléchissantes grises horizontales (conformes à guy-face_profil.png)
cyl(torso, 'ReflectiveBand_Low', reflective, 0.166, 0.162, 0.036, [0, -0.02, 0.003]);
cyl(torso, 'ReflectiveBand_High', reflective, 0.171, 0.168, 0.036, [0, 0.08, 0.003]);

// ==================== TÊTE & VISAGE DE GUY (Hauteur totale = 1,75 m exactement) ====================
const head = new T.Group();
head.name = 'Head';
head.position.set(0, 1.43, 0);
root.add(head);

// Visage allongé caractéristique de Guy
ball(head, 'FaceOval', skin, [0, 0.04, 0], [0.105, 0.155, 0.115]);
ball(head, 'Chin', skin, [0, -0.065, 0.012], [0.082, 0.075, 0.088]);

// Nez rond proéminent de profil (guy-face_profil.png)
ball(head, 'NoseBridge', skin, [0, 0.025, 0.118], [0.024, 0.036, 0.035]);
ball(head, 'NoseTip', skin, [0, 0.012, 0.138], [0.03, 0.026, 0.034]);

// Oreilles arrondies et yeux verticaux expressifs
for (const s of [-1, 1]) {
  ball(head, `Ear_${s}`, skin, [s * 0.112, 0.02, -0.005], [0.028, 0.046, 0.026], [0, -s * 0.2, 0]);
  ball(head, `Eye_${s}`, dark, [s * 0.036, 0.055, 0.108], [0.012, 0.024, 0.008]);
  ball(head, `EyeShine_${s}`, white, [s * 0.034, 0.062, 0.115], [0.004, 0.006, 0.004]);

  const brow = new T.Shape();
  brow.moveTo(s * 0.014, 0.095);
  brow.quadraticCurveTo(s * 0.038, 0.112, s * 0.062, 0.098);
  brow.quadraticCurveTo(s * 0.038, 0.102, s * 0.014, 0.088);
  brow.closePath();
  relief(head, `Brow_${s}`, browMat, brow, [0, 0, 0.106], 0.008, 0.004);

  // Petite barrette/branche grise sur la tempe (visible sur guy-face_profil.png)
  const templeBar = new T.Mesh(new T.BoxGeometry(0.008, 0.008, 0.045), templeGrey);
  templeBar.name = `TempleBar_${s}`;
  templeBar.position.set(s * 0.104, 0.072, 0.015);
  head.add(templeBar);
}

// Bouche souriante discrète
const smile = new T.Shape();
smile.moveTo(-0.038, -0.042);
smile.quadraticCurveTo(0, -0.055, 0.038, -0.042);
smile.quadraticCurveTo(0, -0.048, -0.038, -0.042);
relief(head, 'MouthLine', mouthMat, smile, [0, 0, 0.104], 0.006, 0.003);

// Chevelure brune avec les 3 houppettes latérales (sommet exactement à y = 1.75 m !)
ball(head, 'HairBack', hairMat, [0, 0.09, -0.025], [0.114, 0.135, 0.118]);
ball(head, 'HairCrown', hairMat, [-0.01, 0.155, 0.005], [0.11, 0.075, 0.11]);
for (const s of [-1, 1]) {
  ball(head, `HairSide_${s}`, hairMat, [s * 0.102, 0.08, -0.005], [0.025, 0.075, 0.065]);
}
// Les 3 mèches arrondies emblématiques de Guy (culminent à y = 1.43 + 0.32 = 1.75 m)
tube(head, 'HairTuft_1', [[-0.02, 0.18, 0.02], [0.02, 0.26, 0.03], [0.045, 0.305, 0.02]], [0.045, 0.038, 0.015], hairMat);
tube(head, 'HairTuft_2', [[0.01, 0.17, 0.03], [0.065, 0.235, 0.04], [0.105, 0.265, 0.03]], [0.042, 0.036, 0.014], hairMat);
tube(head, 'HairTuft_3', [[0.03, 0.145, 0.04], [0.085, 0.185, 0.05], [0.125, 0.2, 0.04]], [0.038, 0.032, 0.012], hairMat);

// Équipements EPI sur la tête (casque jaune + casque antibruit + lunettes — activables dans la visionneuse)
const ppeHead = new T.Group();
ppeHead.name = 'PPE_Head';
ppeHead.visible = false;
head.add(ppeHead);
ball(ppeHead, 'PPE_HelmetDome', helmetYellow, [0, 0.16, 0], [0.128, 0.105, 0.138]);
cyl(ppeHead, 'PPE_HelmetBrim', helmetYellow, 0.132, 0.138, 0.014, [0, 0.115, 0.018], [0.08, 0, 0]);
for (const s of [-1, 1]) {
  ball(ppeHead, `PPE_EarCup_${s}`, dark, [s * 0.122, 0.025, -0.005], [0.028, 0.048, 0.036]);
  ball(ppeHead, `PPE_EarRing_${s}`, earmuffOrange, [s * 0.116, 0.025, -0.005], [0.024, 0.042, 0.032]);
}

// ==================== BRAS, AVANT-BRAS, MAINS & PORTE-BLOC DUER ====================
for (const side of [-1, 1]) {
  const s = side;
  const tag = s < 0 ? 'L' : 'R';

  const arm = new T.Group();
  arm.name = `Arm_${tag}`;
  arm.position.set(s * 0.195, 1.2, 0);
  root.add(arm);

  ball(arm, `Shoulder_${tag}`, sweaterBlue, [0, -0.015, 0], [0.052, 0.056, 0.052]);
  cyl(arm, `UpperArm_${tag}`, sweaterBlue, 0.046, 0.042, 0.25, [s * 0.015, -0.135, 0], [0, 0, -s * 0.06]);

  const forearm = new T.Group();
  forearm.name = `Forearm_${tag}`;
  forearm.position.set(s * 0.025, -0.26, 0);
  arm.add(forearm);

  ball(forearm, `Elbow_${tag}`, sweaterBlue, [0, 0, 0], [0.042, 0.042, 0.042]);
  cyl(forearm, `LowerArm_${tag}`, sweaterBlue, 0.041, 0.036, 0.23, [0, -0.115, 0.01], [0.08, 0, 0]);

  // Main
  ball(forearm, `Hand_${tag}`, skin, [0, -0.26, 0.022], [0.038, 0.052, 0.026]);
  ball(forearm, `Thumb_${tag}`, skin, [-s * 0.034, -0.25, 0.04], [0.016, 0.03, 0.016], [0.25, 0, s * 0.35]);
  for (let i = 0; i < 4; i++) {
    ball(forearm, `Finger_${tag}_${i}`, skin, [(i - 1.5) * 0.016, -0.305, 0.026], [0.01, 0.028, 0.011]);
  }

  // Gant EPI (masqué par défaut, activable avec le bouton EPI)
  ball(forearm, `PPE_Glove_${tag}`, gloveGrey, [0, -0.265, 0.022], [0.042, 0.062, 0.03]).visible = false;

  if (s < 0) {
    const tablet = new T.Group();
    tablet.name = 'Tablet_DUER';
    tablet.position.set(0.035, -0.25, 0.085);
    tablet.rotation.set(-0.35, 0.25, 0.15);
    forearm.add(tablet);

    const board = new T.Mesh(new T.BoxGeometry(0.18, 0.25, 0.014), clipboardMat);
    board.name = 'ClipboardBody';
    tablet.add(board);

    const clip = new T.Mesh(new T.BoxGeometry(0.07, 0.026, 0.02), templeGrey);
    clip.position.set(0, 0.115, 0.006);
    tablet.add(clip);

    const sheet = new T.Mesh(new T.BoxGeometry(0.15, 0.21, 0.004), white);
    sheet.position.set(0, -0.005, 0.008);
    tablet.add(sheet);
  }
}

// ==================== JAMBES DROITES & CHAUSSURES DE SÉCURITÉ À LISERÉ JAUNE ====================
for (const side of [-1, 1]) {
  const s = side;
  const tag = s < 0 ? 'L' : 'R';

  const leg = new T.Group();
  leg.name = `Leg_${tag}`;
  leg.position.set(s * 0.088, 0.8, 0);
  root.add(leg);

  ball(leg, `Hip_${tag}`, pantsMat, [0, 0, 0], [0.072, 0.072, 0.072]);
  cyl(leg, `Thigh_${tag}`, pantsMat, 0.072, 0.064, 0.36, [0, -0.18, 0]);

  const knee = new T.Group();
  knee.name = `Knee_${tag}`;
  knee.position.set(0, -0.36, 0);
  leg.add(knee);

  ball(knee, `KneeJoint_${tag}`, pantsMat, [0, 0, 0], [0.063, 0.063, 0.063]);
  cyl(knee, `Shin_${tag}`, pantsMat, 0.063, 0.056, 0.34, [0, -0.17, 0]);

  const ankle = new T.Group();
  ankle.name = `Ankle_${tag}`;
  ankle.position.set(0, -0.34, 0);
  knee.add(ankle);

  // Chaussure montante gris anthracite avec liseré jaune sécurité (guy-face_profil.png)
  cyl(ankle, `BootCollar_${tag}`, bootMat, 0.056, 0.06, 0.055, [0, -0.015, 0]);
  ball(ankle, `BootUpper_${tag}`, bootMat, [0, -0.048, 0.032], [0.064, 0.052, 0.11]);
  ball(ankle, `BootToe_${tag}`, bootMat, [0, -0.058, 0.095], [0.062, 0.045, 0.068]);
  cyl(ankle, `BootYellowTrim_${tag}`, bootYellow, 0.066, 0.068, 0.009, [0, -0.078, 0.038]);
  cyl(ankle, `BootSole_${tag}`, soleMat, 0.068, 0.07, 0.022, [0, -0.09, 0.038]);
}

// ==================== ÉCHANTILLONNAGE DES ANIMATIONS ====================
function sampleClip(name, duration, steps, poseFn) {
  const times = [];
  for (let i = 0; i <= steps; i++) times.push((i / steps) * duration);
  const channels = new Map();

  for (let i = 0; i <= steps; i++) {
    const t = times[i];
    const phase = (i / steps) * Math.PI * 2;
    const pose = poseFn(phase, t);
    for (const [nodeName, tr] of Object.entries(pose)) {
      if (!channels.has(nodeName)) {
        channels.set(nodeName, { pos: [], quat: [], scale: [], hasPos: false, hasQuat: false, hasScale: false });
      }
      const ch = channels.get(nodeName);
      const obj = root.getObjectByName(nodeName);
      if (tr.pos) {
        ch.hasPos = true;
        ch.pos.push(tr.pos[0], tr.pos[1], tr.pos[2]);
      } else if (obj) {
        ch.pos.push(obj.position.x, obj.position.y, obj.position.z);
      }
      if (tr.rot) {
        ch.hasQuat = true;
        const q = new T.Quaternion().setFromEuler(new T.Euler(tr.rot[0], tr.rot[1], tr.rot[2], 'XYZ'));
        ch.quat.push(q.x, q.y, q.z, q.w);
      } else if (obj) {
        ch.quat.push(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
      }
      if (tr.scale) {
        ch.hasScale = true;
        ch.scale.push(tr.scale[0], tr.scale[1], tr.scale[2]);
      } else if (obj) {
        ch.scale.push(obj.scale.x, obj.scale.y, obj.scale.z);
      }
    }
  }

  const tracks = [];
  for (const [nodeName, ch] of channels.entries()) {
    if (ch.hasPos) tracks.push(new T.VectorKeyframeTrack(`${nodeName}.position`, times, ch.pos));
    if (ch.hasQuat) tracks.push(new T.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, ch.quat));
    if (ch.hasScale) tracks.push(new T.VectorKeyframeTrack(`${nodeName}.scale`, times, ch.scale));
  }
  return new T.AnimationClip(name, duration, tracks);
}

const idle = sampleClip('Idle', 2.4, 32, (phi) => {
  const b = Math.sin(phi);
  return {
    Torso: {
      pos: [0, 0.96 + 0.01 * b, 0],
      rot: [0.015 * b, 0.04 * Math.sin(phi), 0.01 * Math.cos(phi)],
    },
    Head: {
      pos: [0, 1.43 + 0.012 * Math.sin(phi - 0.2), 0],
      rot: [0.02 * Math.cos(phi), 0.08 * Math.sin(phi), 0.02 * Math.sin(phi)],
    },
    Arm_L: {
      pos: [-0.195, 1.2 + 0.01 * b, 0],
      rot: [-0.28 + 0.03 * b, 0.12, -0.06],
    },
    Forearm_L: {
      rot: [-0.65 + 0.04 * b, 0.2, 0],
    },
    Arm_R: {
      pos: [0.195, 1.2 + 0.01 * b, 0],
      rot: [0.04 * b, -0.05, 0.05],
    },
    Forearm_R: {
      rot: [-0.18 + 0.03 * b, 0, 0],
    },
  };
});

const inspect = sampleClip('Inspect', 2.4, 36, (phi) => {
  const lift = Math.sin(phi * 0.5);
  const wave = Math.sin(phi * 2);
  return {
    Torso: {
      pos: [0, 0.96 + 0.015 * Math.sin(phi), 0],
      rot: [-0.03 * lift, 0.1 * Math.sin(phi), -0.03 * lift],
    },
    Head: {
      pos: [0, 1.43 + 0.015 * Math.sin(phi), 0.015 * lift],
      rot: [0.12 * Math.max(0, -Math.sin(phi)) - 0.04 * Math.max(0, Math.sin(phi)), -0.14 * Math.sin(phi), 0.04 * wave * lift],
    },
    Arm_L: {
      pos: [-0.195, 1.2 + 0.015 * lift, 0.02 * lift],
      rot: [-0.55 * lift - 0.25 * (1 - lift), 0.28 * lift, -0.08],
    },
    Forearm_L: {
      rot: [-1.05 * lift - 0.65 * (1 - lift), 0.35 * lift, 0.1 * lift],
    },
    Arm_R: {
      pos: [0.195, 1.21 + 0.02 * lift, 0.02 * lift],
      rot: [-0.85 * lift, -0.15 * lift, 0.48 * lift + 0.18 * wave * lift],
    },
    Forearm_R: {
      rot: [-0.85 * lift - 0.18 * (1 - lift), 0, 0.28 * wave * lift],
    },
  };
});

function humanLegWalk(phase, side) {
  const swing = Math.sin(phase);
  const pass = Math.cos(phase);
  const lift = Math.max(0, pass);
  const stance = Math.max(0, -pass);

  const hipRx = -0.52 * swing - 0.08 * lift;
  const hipRy = -side * 0.04 * swing;
  const hipRz = side * 0.02 * lift;
  const kneeRx = 0.68 * lift + 0.12 * stance * Math.max(0, swing);
  const ankleRx = -0.25 * lift + 0.2 * stance * Math.max(0, -swing) - 0.1 * Math.max(0, swing);

  return {
    leg: {
      pos: [side * 0.088, 0.8 + 0.024 * Math.cos(2 * phase), 0.02 * swing],
      rot: [hipRx, hipRy, hipRz],
    },
    knee: {
      rot: [kneeRx, 0, 0],
    },
    ankle: {
      rot: [ankleRx, 0, 0],
    },
  };
}

const walk = sampleClip('Walk', 0.96, 36, (phi) => {
  const left = humanLegWalk(phi, -1);
  const right = humanLegWalk(phi + Math.PI, 1);
  const bounce = Math.cos(2 * phi);
  const sway = Math.sin(phi);

  return {
    Torso: {
      pos: [0.016 * sway, 0.96 + 0.025 * bounce, 0.01 * Math.sin(2 * phi)],
      rot: [0.05 + 0.018 * Math.sin(2 * phi), -0.09 * sway, -0.035 * sway],
    },
    Head: {
      pos: [0.012 * sway, 1.43 + 0.026 * Math.cos(2 * phi - 0.25), 0.015],
      rot: [0.02 * Math.sin(2 * phi - 0.3), 0.06 * sway, 0.025 * sway],
    },
    Arm_L: {
      pos: [-0.195, 1.2 + 0.022 * bounce, -0.015 * sway],
      rot: [0.36 * sway - 0.18, 0.08, -0.06],
    },
    Forearm_L: {
      rot: [-0.52 - 0.16 * Math.max(0, -sway), 0.18, 0],
    },
    Arm_R: {
      pos: [0.195, 1.2 + 0.022 * bounce, 0.015 * sway],
      rot: [-0.44 * sway - 0.06, -0.08, 0.06],
    },
    Forearm_R: {
      rot: [-0.28 - 0.26 * Math.max(0, sway), 0, 0],
    },
    Leg_L: left.leg,
    Knee_L: left.knee,
    Ankle_L: left.ankle,
    Leg_R: right.leg,
    Knee_R: right.knee,
    Ankle_R: right.ankle,
  };
});

const binary = await new GLTFExporter().parseAsync(root, { binary: true, animations: [idle, inspect, walk] });

for (const dir of ['personnages/preventeur-guy', 'public/models/personnages/preventeur-guy']) {
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/preventeur-guy-v1.glb`, Buffer.from(binary));
}

for (const part of ['controls', 'loaders', 'utils']) {
  await mkdir(`public/models/personnages/preventeur-guy/viewer/${part}`, { recursive: true });
}
for (const [source, target] of [
  ['build/three.module.js', 'three.module.js'],
  ['examples/jsm/controls/OrbitControls.js', 'controls/OrbitControls.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'utils/BufferGeometryUtils.js'],
  ['LICENSE', 'LICENSE'],
]) {
  await copyFile(`node_modules/three/${source}`, `public/models/personnages/preventeur-guy/viewer/${target}`);
}

const loaded = await new GLTFLoader().parseAsync(binary, '');
if (loaded.animations.some((clip) => !clip.tracks.length)) throw new Error('Animation vide');
const mixer = new T.AnimationMixer(loaded.scene);
for (const clip of loaded.animations) {
  mixer.stopAllAction();
  mixer.clipAction(clip).play();
  mixer.update(0.25);
}
let meshes = 0;
let triangles = 0;
loaded.scene.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  }
});
console.log(
  JSON.stringify({
    character: 'PreventeurGuy',
    bytes: binary.byteLength,
    meshes,
    triangles,
    animations: loaded.animations.map((a) => ({ name: a.name, duration: Number(a.duration.toFixed(2)), tracks: a.tracks.length })),
    bounds: new T.Box3().setFromObject(loaded.scene).getSize(new T.Vector3()).toArray().map((v) => Number(v.toFixed(3))),
  })
);
