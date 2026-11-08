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

const mat = (color, roughness = 0.65, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
const skin = mat('#eeb996', 0.68);
const cheekMat = mat('#e39b7a', 0.72);
const hairMat = mat('#6e4326', 0.72);
const browMat = mat('#4a2c18', 0.7);
const blueTop = mat('#245699', 0.72);
const shirtCollar = mat('#f4f7fb', 0.6);
const vestYellow = mat('#f2cc15', 0.52);
const vestTrim = mat('#1e293b', 0.65);
const reflective = mat('#dbe4ee', 0.28, 0.35);
const pantsMat = mat('#273549', 0.78);
const bootMat = mat('#2b211b', 0.65);
const soleMat = mat('#151210', 0.85);
const white = mat('#ffffff', 0.45);
const dark = mat('#1e242b', 0.55);
const irisMat = mat('#355c7d', 0.4);
const mouthMat = mat('#7c2d26', 0.65);
const badgeGreen = mat('#16a34a', 0.45);
const tabletFrame = mat('#1d3557', 0.4, 0.2);
const tabletScreen = mat('#e0f2fe', 0.25);
const orangeAccent = mat('#ed501b', 0.5);

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

function relief(parent, name, material, shape, position, depth = 0.02, bevel = 0.012, rotation = [0, 0, 0]) {
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

// Bassin / ceinture du pantalon
ball(torso, 'Pelvis', pantsMat, [0, -0.18, 0], [0.22, 0.14, 0.16]);
// Pull bleu sous le gilet
ball(torso, 'SweaterBase', blueTop, [0, 0.06, 0], [0.25, 0.28, 0.18]);
// Gilet jaune haute visibilité
ball(torso, 'SafetyVest', vestYellow, [0, 0.06, 0.005], [0.262, 0.265, 0.19]);
// Ouverture centrale zippée et col en V du gilet
cyl(torso, 'VestZipper', vestTrim, 0.012, 0.012, 0.38, [0, 0.02, 0.188]);
ball(torso, 'ShirtVNeck', shirtCollar, [0, 0.25, 0.09], [0.095, 0.075, 0.08]);
ball(torso, 'Neck', skin, [0, 0.33, 0.01], [0.075, 0.085, 0.075]);

// Bandes réfléchissantes grises sur le gilet
cyl(torso, 'ReflectiveBand_Low', reflective, 0.252, 0.238, 0.036, [0, -0.05, 0.005], [0, 0, 0]);
cyl(torso, 'ReflectiveBand_High', reflective, 0.258, 0.255, 0.036, [0, 0.08, 0.005], [0, 0, 0]);

// Badge Prévention (bouclier vert sur la poitrine gauche)
const shield = new T.Shape();
shield.moveTo(0, 0.055);
shield.lineTo(-0.045, 0.035);
shield.lineTo(-0.04, -0.02);
shield.quadraticCurveTo(0, -0.06, 0, -0.06);
shield.quadraticCurveTo(0, -0.06, 0.04, -0.02);
shield.lineTo(0.045, 0.035);
shield.closePath();
relief(torso, 'PreventionBadge', badgeGreen, shield, [0.11, 0.16, 0.172], 0.01, 0.005);

// ==================== TÊTE & COIFFURE HOUPPETTE (GUY) ====================
const head = new T.Group();
head.name = 'Head';
head.position.set(0, 1.48, 0.01);
root.add(head);

// Visage et mâchoire sympathique
ball(head, 'Skull', skin, [0, 0.02, 0], [0.22, 0.25, 0.22]);
ball(head, 'Jaw', skin, [0, -0.1, 0.03], [0.175, 0.14, 0.17]);
ball(head, 'Nose', skin, [0, -0.01, 0.225], [0.036, 0.048, 0.045], [-0.15, 0, 0]);

// Oreilles et joues
for (const s of [-1, 1]) {
  ball(head, `Ear_${s}`, skin, [s * 0.215, -0.01, -0.01], [0.038, 0.065, 0.045], [0, -s * 0.25, 0]);
  ball(head, `Cheek_${s}`, cheekMat, [s * 0.135, -0.055, 0.17], [0.048, 0.032, 0.02]);

  // Yeux expressifs et bienveillants
  ball(head, `Sclera_${s}`, white, [s * 0.082, 0.035, 0.192], [0.046, 0.056, 0.022]);
  ball(head, `Iris_${s}`, irisMat, [s * 0.08, 0.033, 0.208], [0.028, 0.036, 0.014]);
  ball(head, `Pupil_${s}`, dark, [s * 0.08, 0.033, 0.218], [0.015, 0.02, 0.009]);
  ball(head, `EyeShine_${s}`, white, [s * 0.08 - 0.008, 0.046, 0.225], [0.008, 0.01, 0.005]);

  // Sourcils arqués chaleureux
  const brow = new T.Shape();
  brow.moveTo(s * 0.035, 0.095);
  brow.quadraticCurveTo(s * 0.085, 0.135, s * 0.138, 0.098);
  brow.quadraticCurveTo(s * 0.085, 0.112, s * 0.035, 0.082);
  brow.closePath();
  relief(head, `Brow_${s}`, browMat, brow, [0, 0, 0.198], 0.012, 0.006);
}

// Sourire franc et rassurant
const smile = new T.Shape();
smile.moveTo(-0.085, -0.095);
smile.quadraticCurveTo(0, -0.125, 0.085, -0.095);
smile.quadraticCurveTo(0.065, -0.165, 0, -0.168);
smile.quadraticCurveTo(-0.065, -0.165, -0.085, -0.095);
relief(head, 'SmileMouth', mouthMat, smile, [0, 0, 0.198], 0.01, 0.006);

const teeth = new T.Shape();
teeth.moveTo(-0.068, -0.103);
teeth.quadraticCurveTo(0, -0.122, 0.068, -0.103);
teeth.lineTo(0.058, -0.128);
teeth.quadraticCurveTo(0, -0.14, -0.058, -0.128);
teeth.closePath();
relief(head, 'SmileTeeth', white, teeth, [0, 0, 0.205], 0.008, 0.004);

// Chevelure brune sculptée avec les mèches / houppette emblématiques du jeu de cartes Evarisk
ball(head, 'HairCap', hairMat, [0, 0.075, -0.025], [0.232, 0.225, 0.228]);
ball(head, 'HairBack', hairMat, [0, 0.01, -0.09], [0.21, 0.19, 0.15]);
for (const s of [-1, 1]) {
  ball(head, `HairSide_${s}`, hairMat, [s * 0.195, 0.04, 0.01], [0.06, 0.12, 0.12], [0, 0, s * 0.15]);
}
// Houppettes dynamiques sur le dessus et le front
tube(head, 'HairTuft_Center', [[0, 0.23, 0.08], [0.02, 0.34, 0.14], [0.05, 0.39, 0.11]], [0.085, 0.055, 0.005], hairMat);
tube(head, 'HairTuft_Left', [[-0.08, 0.22, 0.06], [-0.14, 0.32, 0.1], [-0.18, 0.35, 0.06]], [0.075, 0.048, 0.004], hairMat);
tube(head, 'HairTuft_Right', [[0.07, 0.22, 0.05], [0.15, 0.31, 0.08], [0.2, 0.33, 0.03]], [0.07, 0.045, 0.004], hairMat);
tube(head, 'HairTuft_Top', [[-0.02, 0.26, -0.01], [0.01, 0.37, -0.02], [0.04, 0.41, -0.06]], [0.08, 0.05, 0.004], hairMat);

// ==================== BRAS, AVANT-BRAS, MAINS & TABLETTE DUER ====================
for (const side of [-1, 1]) {
  const s = side;
  const tag = s < 0 ? 'L' : 'R';

  const arm = new T.Group();
  arm.name = `Arm_${tag}`;
  arm.position.set(s * 0.285, 1.15, 0);
  root.add(arm);

  // Épaule et haut du bras (manche bleue)
  ball(arm, `Shoulder_${tag}`, blueTop, [0, -0.02, 0], [0.078, 0.082, 0.078]);
  cyl(arm, `UpperArm_${tag}`, blueTop, 0.068, 0.058, 0.24, [s * 0.015, -0.13, 0], [0, 0, -s * 0.06]);

  // Coude et avant-bras articulés
  const forearm = new T.Group();
  forearm.name = `Forearm_${tag}`;
  forearm.position.set(s * 0.025, -0.25, 0);
  arm.add(forearm);

  ball(forearm, `Elbow_${tag}`, blueTop, [0, 0, 0], [0.058, 0.058, 0.058]);
  cyl(forearm, `LowerArm_${tag}`, blueTop, 0.056, 0.048, 0.21, [0, -0.105, 0.02], [0.12, 0, 0]);
  cyl(forearm, `Cuff_${tag}`, shirtCollar, 0.05, 0.05, 0.028, [0, -0.205, 0.032], [0.12, 0, 0]);

  // Main et doigts
  ball(forearm, `Hand_${tag}`, skin, [0, -0.255, 0.042], [0.052, 0.062, 0.038]);
  ball(forearm, `Thumb_${tag}`, skin, [-s * 0.045, -0.245, 0.068], [0.022, 0.036, 0.022], [0.3, 0, s * 0.4]);
  for (let i = 0; i < 4; i++) {
    ball(forearm, `Finger_${tag}_${i}`, skin, [(i - 1.5) * 0.022, -0.305, 0.048], [0.014, 0.032, 0.015]);
  }

  // Tablette / Dossier DUER DigiRisk dans la main gauche (s = -1 => Arm_L)
  if (s < 0) {
    const tablet = new T.Group();
    tablet.name = 'Tablet_DUER';
    tablet.position.set(0.04, -0.25, 0.11);
    tablet.rotation.set(-0.35, 0.25, 0.15);
    forearm.add(tablet);

    const board = new T.Mesh(new T.BoxGeometry(0.22, 0.29, 0.018), tabletFrame);
    board.name = 'TabletBody';
    tablet.add(board);

    const screen = new T.Mesh(new T.BoxGeometry(0.19, 0.25, 0.006), tabletScreen);
    screen.name = 'TabletScreen';
    screen.position.set(0, 0, 0.01);
    tablet.add(screen);

    // En-tête orange DigiRisk et lignes vertes d'évaluation DUER
    const header = new T.Mesh(new T.BoxGeometry(0.16, 0.035, 0.004), orangeAccent);
    header.position.set(0, 0.09, 0.014);
    tablet.add(header);
    for (let r = 0; r < 3; r++) {
      const row = new T.Mesh(new T.BoxGeometry(0.15, 0.024, 0.004), badgeGreen);
      row.position.set(0, 0.03 - r * 0.048, 0.014);
      tablet.add(row);
    }
  }
}

// ==================== JAMBES, GENOUX, CHEVILLES & CHAUSSURES DE SÉCURITÉ ====================
for (const side of [-1, 1]) {
  const s = side;
  const tag = s < 0 ? 'L' : 'R';

  const leg = new T.Group();
  leg.name = `Leg_${tag}`;
  leg.position.set(s * 0.115, 0.78, 0);
  root.add(leg);

  // Cuisse
  ball(leg, `Hip_${tag}`, pantsMat, [0, 0, 0], [0.095, 0.095, 0.095]);
  cyl(leg, `Thigh_${tag}`, pantsMat, 0.092, 0.076, 0.34, [0, -0.17, 0]);

  // Genou et tibia
  const knee = new T.Group();
  knee.name = `Knee_${tag}`;
  knee.position.set(0, -0.34, 0);
  leg.add(knee);

  ball(knee, `KneeJoint_${tag}`, pantsMat, [0, 0, 0], [0.076, 0.076, 0.076]);
  cyl(knee, `Shin_${tag}`, pantsMat, 0.074, 0.062, 0.32, [0, -0.16, 0]);

  // Cheville et chaussure de sécurité
  const ankle = new T.Group();
  ankle.name = `Ankle_${tag}`;
  ankle.position.set(0, -0.33, 0);
  knee.add(ankle);

  ball(ankle, `BootUpper_${tag}`, bootMat, [0, -0.04, 0.035], [0.078, 0.068, 0.125]);
  ball(ankle, `BootToe_${tag}`, bootMat, [0, -0.055, 0.105], [0.074, 0.055, 0.075]);
  cyl(ankle, `BootSole_${tag}`, soleMat, 0.078, 0.082, 0.028, [0, -0.095, 0.045]);
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

// 1. Au repos (Idle) : posture attentive, respiration douce, tablette DUER en main
const idle = sampleClip('Idle', 2.4, 32, (phi) => {
  const b = Math.sin(phi);
  return {
    Torso: {
      pos: [0, 0.96 + 0.01 * b, 0],
      rot: [0.015 * b, 0.04 * Math.sin(phi), 0.01 * Math.cos(phi)],
    },
    Head: {
      pos: [0, 1.48 + 0.012 * Math.sin(phi - 0.2), 0.01],
      rot: [0.02 * Math.cos(phi), 0.08 * Math.sin(phi), 0.02 * Math.sin(phi)],
    },
    Arm_L: {
      pos: [-0.285, 1.15 + 0.01 * b, 0],
      rot: [-0.28 + 0.03 * b, 0.12, -0.06],
    },
    Forearm_L: {
      rot: [-0.65 + 0.04 * b, 0.2, 0],
    },
    Arm_R: {
      pos: [0.285, 1.15 + 0.01 * b, 0],
      rot: [0.04 * b, -0.05, 0.05],
    },
    Forearm_R: {
      rot: [-0.18 + 0.03 * b, 0, 0],
    },
  };
});

// 2. Contrôle / Salut (Inspect) : Guy consulte sa tablette DUER et salue avec bienveillance
const inspect = sampleClip('Inspect', 2.4, 36, (phi) => {
  const lift = Math.sin(phi * 0.5); // 0 -> 1 -> 0 sur la durée du clip
  const wave = Math.sin(phi * 2);
  return {
    Torso: {
      pos: [0, 0.96 + 0.015 * Math.sin(phi), 0],
      rot: [-0.03 * lift, 0.1 * Math.sin(phi), -0.03 * lift],
    },
    Head: {
      pos: [0, 1.48 + 0.015 * Math.sin(phi), 0.015 * lift],
      rot: [0.12 * Math.max(0, -Math.sin(phi)) - 0.04 * Math.max(0, Math.sin(phi)), -0.14 * Math.sin(phi), 0.04 * wave * lift],
    },
    Arm_L: {
      pos: [-0.285, 1.15 + 0.015 * lift, 0.02 * lift],
      rot: [-0.55 * lift - 0.25 * (1 - lift), 0.28 * lift, -0.08],
    },
    Forearm_L: {
      rot: [-1.05 * lift - 0.65 * (1 - lift), 0.35 * lift, 0.1 * lift],
    },
    Arm_R: {
      pos: [0.285, 1.16 + 0.02 * lift, 0.02 * lift],
      rot: [-0.85 * lift, -0.15 * lift, 0.48 * lift + 0.18 * wave * lift],
    },
    Forearm_R: {
      rot: [-0.85 * lift - 0.18 * (1 - lift), 0, 0.28 * wave * lift],
    },
  };
});

// 3. Marche (Walk) : cycle de marche humain articulé (hanches, genoux, chevilles, bassin, bras, avant-bras, tête)
function humanLegWalk(phase, side) {
  const swing = Math.sin(phase); // > 0 : jambe vers l'avant (+Z)
  const pass = Math.cos(phase); // > 0 : jambe en oscillation vers l'avant
  const lift = Math.max(0, pass);
  const stance = Math.max(0, -pass);

  // Hanche : négatif = flexion vers l'avant (+Z), positif = extension vers l'arrière (-Z)
  const hipRx = -0.52 * swing - 0.08 * lift;
  const hipRy = -side * 0.04 * swing;
  const hipRz = side * 0.02 * lift;

  // Genou : flexion toujours positive (+X replie le tibia vers l'arrière -Z)
  const kneeRx = 0.68 * lift + 0.12 * stance * Math.max(0, swing);

  // Cheville : compense la flexion et déroule le pied au sol
  const ankleRx = -0.25 * lift + 0.2 * stance * Math.max(0, -swing) - 0.1 * Math.max(0, swing);

  return {
    leg: {
      pos: [side * 0.115, 0.78 + 0.025 * Math.cos(2 * phase), 0.02 * swing],
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
      pos: [0.018 * sway, 0.96 + 0.028 * bounce, 0.01 * Math.sin(2 * phi)],
      rot: [0.05 + 0.018 * Math.sin(2 * phi), -0.09 * sway, -0.035 * sway],
    },
    Head: {
      pos: [0.014 * sway, 1.48 + 0.03 * Math.cos(2 * phi - 0.25), 0.02],
      rot: [0.02 * Math.sin(2 * phi - 0.3), 0.06 * sway, 0.025 * sway],
    },
    Arm_L: {
      pos: [-0.285, 1.15 + 0.024 * bounce, -0.015 * sway],
      rot: [0.36 * sway - 0.18, 0.08, -0.06],
    },
    Forearm_L: {
      rot: [-0.52 - 0.16 * Math.max(0, -sway), 0.18, 0],
    },
    Arm_R: {
      pos: [0.285, 1.15 + 0.024 * bounce, 0.015 * sway],
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
