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
root.name = 'Riskick';

const mat = (color, roughness = 0.65) => new T.MeshStandardMaterial({ color, roughness });
const orange = mat('#ed501b', 0.78);
const dark = mat('#302b31', 0.72);
const yellow = mat('#ffbb08', 0.54);
const white = mat('#fff2d2');
const mouth = mat('#391b20');
const iris = mat('#a94410');

function ball(parent, name, material, position, scale) {
  const mesh = new T.Mesh(new T.SphereGeometry(1, 24, 16), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
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

// Sculpted outlines replace the old stacked oval eyes and round teeth.
function relief(parent, name, material, shape, position, depth = 0.025, bevel = 0.018) {
  const geo = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 24,
    steps: 1,
  });
  const mesh = new T.Mesh(geo, material);
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

// Torse articulé portant le corps et le badge de danger (!)
const torso = new T.Group();
torso.name = 'Torso';
torso.position.set(0, 0.79, 0);
root.add(torso);

ball(torso, 'Body', orange, [0, 0, 0], [0.39, 0.39, 0.29]);

const triangle = new T.Shape();
triangle.moveTo(0, 0.2);
triangle.lineTo(-0.195, -0.14);
triangle.quadraticCurveTo(-0.22, -0.18, -0.17, -0.18);
triangle.lineTo(0.17, -0.18);
triangle.quadraticCurveTo(0.22, -0.18, 0.195, -0.14);
triangle.lineTo(0, 0.2);
const badge = new T.Mesh(
  new T.ExtrudeGeometry(triangle, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, steps: 1 }),
  yellow
);
badge.name = 'WarningBadge';
badge.position.set(0, 0.01, 0.286);
torso.add(badge);
ball(torso, 'BadgeRivet_L', dark, [-0.145, -0.125, 0.326], [0.012, 0.012, 0.008]);
ball(torso, 'BadgeRivet_R', dark, [0.145, -0.125, 0.326], [0.012, 0.012, 0.008]);
ball(torso, 'ExclamationBar', dark, [0, 0.05, 0.332], [0.023, 0.074, 0.012]);
ball(torso, 'ExclamationDot', dark, [0, -0.06, 0.332], [0.025, 0.025, 0.012]);

const head = new T.Group();
head.name = 'Head';
head.position.set(0, 1.43, 0);
root.add(head);
ball(head, 'Face', orange, [0, 0, 0], [0.62, 0.43, 0.39]);
ball(head, 'Jaw', orange, [0, -0.21, 0.15], [0.46, 0.22, 0.24]);

// A curved grin, rising at both corners, with teeth hung from its upper lip.
const grin = new T.Shape();
grin.moveTo(-0.365, -0.13);
grin.bezierCurveTo(-0.18, -0.2, 0.19, -0.2, 0.365, -0.1);
grin.bezierCurveTo(0.29, -0.39, -0.27, -0.39, -0.365, -0.13);
relief(head, 'Smile', mouth, grin, [0, 0, 0.388], 0.018, 0.012);

const lip = new T.Shape();
lip.moveTo(-0.37, -0.115);
lip.bezierCurveTo(-0.16, -0.185, 0.19, -0.185, 0.37, -0.09);
lip.bezierCurveTo(0.21, -0.155, -0.15, -0.15, -0.37, -0.115);
relief(head, 'UpperLip', orange, lip, [0, 0, 0.418], 0.006, 0.008);

for (let i = 0; i < 7; i++) {
  const x = (i - 3) * 0.083;
  const y = -0.171 + 0.047 * (x / 0.28) ** 2;
  const tooth = new T.Shape();
  tooth.moveTo(-0.032, 0);
  tooth.lineTo(0.032, 0);
  tooth.quadraticCurveTo(0.03, -0.044, 0.012, -0.052);
  tooth.quadraticCurveTo(-0.022, -0.058, -0.032, -0.025);
  tooth.closePath();
  relief(head, `Tooth_${i}`, white, tooth, [x, y, 0.423], 0.009, 0.005);
}

for (const side of [-1, 1]) {
  const s = side;
  const tag = s < 0 ? 'L' : 'R';
  const eye = new T.Shape();
  eye.moveTo(s * 0.075, 0.045);
  eye.bezierCurveTo(s * 0.17, 0.06, s * 0.34, 0.13, s * 0.435, 0.16);
  eye.bezierCurveTo(s * 0.48, -0.115, s * 0.17, -0.18, s * 0.075, 0.045);
  relief(head, `Eye_${s}`, yellow, eye, [0, 0, 0.346], 0.038, 0.016);
  ball(head, `Iris_${s}`, iris, [s * 0.245, -0.015, 0.406], [0.063, 0.086, 0.02]);
  ball(head, `Pupil_${s}`, dark, [s * 0.245, -0.015, 0.424], [0.031, 0.065, 0.012]);
  ball(head, `EyeShine_${s}`, white, [s * 0.245 - 0.012, 0.012, 0.437], [0.014, 0.02, 0.007]);

  const brow = new T.Shape();
  brow.moveTo(s * 0.06, 0.055);
  brow.bezierCurveTo(s * 0.12, 0.11, s * 0.36, 0.23, s * 0.46, 0.2);
  brow.bezierCurveTo(s * 0.5, 0.12, s * 0.29, 0.08, s * 0.105, 0.015);
  brow.quadraticCurveTo(s * 0.065, 0.015, s * 0.06, 0.055);
  relief(head, `Brow_${s}`, dark, brow, [0, 0, 0.392], 0.04, 0.018);

  const hornPoints = [
    [s * 0.4, 0.25, -0.045],
    [s * 0.59, 0.4, -0.07],
    [s * 0.63, 0.59, -0.09],
    [s * 0.57, 0.72, -0.075],
  ];
  const horn = tube(head, `Horn_${s}`, hornPoints, [0.195, 0.16, 0.085, 0.002], dark);
  // Stripes share the horn's surface, eliminating the detached yellow tabs.
  const colors = [];
  const base = dark.color;
  const stripe = yellow.color;
  for (let ring = 0; ring <= 24; ring++) {
    for (let j = 0; j <= 12; j++) {
      const t = ring / 24;
      const band = (t > 0.48 && t < 0.57) || (t > 0.71 && t < 0.78);
      const c = band ? stripe : base;
      colors.push(c.r, c.g, c.b);
    }
  }
  horn.geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  horn.material = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

  tube(head, `CheekSpike_${s}`, [[s * 0.48, -0.04, -0.03], [s * 0.76, 0.035, -0.04]], [0.14, 0.001], orange);
  tube(head, `LowerCheekSpike_${s}`, [[s * 0.48, -0.16, -0.035], [s * 0.67, -0.15, -0.04]], [0.09, 0.001], orange);

  const arm = new T.Group();
  arm.name = `Arm_${tag}`;
  arm.position.set(s * 0.32, 0.99, 0);
  root.add(arm);
  tube(arm, `UpperArm_${s}`, [[0, 0, 0], [s * 0.2, -0.12, 0], [s * 0.23, -0.25, 0.105]], [0.135, 0.13, 0.11], orange);
  ball(arm, `Cuff_${s}`, dark, [s * 0.23, -0.26, 0.105], [0.14, 0.085, 0.135]);
  ball(arm, `Glove_${s}`, dark, [s * 0.24, -0.34, 0.15], [0.16, 0.155, 0.145]);
  for (let i = 0; i < 3; i++) {
    ball(arm, `Finger_${s}_${i}`, dark, [s * 0.24 + (i - 1) * 0.077, -0.395, 0.23], [0.05, 0.073, 0.055]);
  }
  ball(arm, `Thumb_${s}`, dark, [s * 0.115, -0.3, 0.225], [0.075, 0.095, 0.065]);

  const leg = new T.Group();
  leg.name = `Leg_${tag}`;
  leg.position.set(s * 0.21, 0.48, 0);
  root.add(leg);
  ball(leg, `LegMesh_${s}`, orange, [s * 0.015, -0.115, 0], [0.15, 0.2, 0.15]);

  // Cheville articulée pour dérouler le pied (attaque du talon, appui, poussée, levé d'orteils)
  const ankle = new T.Group();
  ankle.name = `Ankle_${tag}`;
  ankle.position.set(s * 0.035, -0.26, 0.02);
  leg.add(ankle);
  ball(ankle, `Foot_${s}`, dark, [0, -0.04, 0.085], [0.195, 0.13, 0.25]);
}

for (let i = -1; i <= 1; i++) {
  tube(head, `CrownSpike_${i}`, [[i * 0.17, 0.33, -0.08], [i * 0.18 + 0.06, 0.54 - Math.abs(i) * 0.05, -0.1]], [0.105, 0.001], orange);
}

/**
 * Échantillonne une animation fluide (positions, rotations complètes en quaternions, échelles)
 * compatible avec GLTFExporter.
 */
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

// 1. Animation Au repos (Idle) : respiration vivante, regard narquois gauche/droite
const idle = sampleClip('Idle', 2.4, 32, (phi) => {
  const breath = Math.sin(phi);
  const look = Math.sin(phi);
  return {
    Torso: {
      pos: [0, 0.79 + 0.014 * breath, 0],
      rot: [0.02 * breath, 0.04 * look, 0.015 * Math.cos(phi)],
    },
    Body: {
      scale: [0.39 * (1 - 0.012 * breath), 0.39 * (1 + 0.022 * breath), 0.29 * (1 - 0.01 * breath)],
    },
    Head: {
      pos: [0, 1.43 + 0.018 * Math.sin(phi - 0.25), 0],
      rot: [0.025 * Math.cos(phi), 0.09 * look, 0.03 * Math.sin(phi)],
    },
    Arm_L: {
      pos: [-0.32, 0.99 + 0.014 * breath, 0],
      rot: [0.04 * breath, 0, -0.03 * (1 + breath * 0.5)],
    },
    Arm_R: {
      pos: [0.32, 0.99 + 0.014 * breath, 0],
      rot: [-0.04 * breath, 0, 0.03 * (1 + breath * 0.5)],
    },
  };
});

// 2. Animation Provocation (Taunt) : rebond espiègle, bras levés, rire narquois
const taunt = sampleClip('Taunt', 2.0, 32, (phi) => {
  const hop = Math.abs(Math.sin(phi * 2));
  const wave = Math.sin(phi * 2);
  return {
    Torso: {
      pos: [0, 0.79 + 0.045 * hop, 0],
      rot: [-0.06 * hop, 0.14 * Math.sin(phi), 0.05 * wave],
    },
    Body: {
      scale: [0.39 * (1 + 0.025 * hop), 0.39 * (1 - 0.02 * Math.cos(phi * 2)), 0.29],
    },
    Head: {
      pos: [0, 1.43 + 0.05 * hop, 0.02 * hop],
      rot: [-0.08 * hop, -0.22 * Math.sin(phi), 0.08 * wave],
    },
    Arm_R: {
      pos: [0.32, 1.01 + 0.04 * hop, 0.02],
      rot: [-0.45 + 0.18 * wave, -0.15, 0.68 + 0.22 * Math.sin(phi * 2)],
    },
    Arm_L: {
      pos: [-0.32, 1.0 + 0.04 * hop, 0.02],
      rot: [-0.28 - 0.15 * wave, 0.12, -0.35 - 0.15 * Math.cos(phi * 2)],
    },
    Leg_L: {
      pos: [-0.21, 0.48 + 0.02 * hop, 0],
      rot: [-0.08 * hop, 0, -0.04 * hop],
    },
    Leg_R: {
      pos: [0.21, 0.48 + 0.02 * hop, 0],
      rot: [-0.08 * hop, 0, 0.04 * hop],
    },
  };
});

// 3. Animation Marche (Walk) : cycle de marche complet articulé (foulée, levé de pied, déroulé de cheville,
// rebond double-fréquence, dandinement du bassin/torse, balancement croisé des bras et suivi de la tête)
function legWalkTracks(phase, side) {
  const swing = Math.sin(phase); // > 0 : jambe vers l'avant (+Z), < 0 : jambe vers l'arrière (-Z)
  const pass = Math.cos(phase); // > 0 : phase d'oscillation (pied levé qui passe devant)
  const lift = Math.max(0, pass);
  const stance = Math.max(0, -pass);

  // Rotation de la hanche : négatif = jambe projetée vers l'avant (+Z)
  const hipRx = -0.62 * swing + 0.06 * lift;
  const hipRy = -side * 0.07 * swing;
  const hipRz = side * (0.03 + 0.04 * lift);

  // Déroulé de la cheville : attaque du talon en fin d'oscillation, poussée des orteils en fin d'appui
  const ankleRx = -0.22 * lift + 0.28 * Math.max(0, -swing) * stance - 0.12 * Math.max(0, swing);
  const ankleRz = -side * 0.03 * lift;

  return {
    leg: {
      pos: [side * (0.21 + 0.01 * lift), 0.48 + 0.075 * lift - 0.015 * stance, 0.04 * swing],
      rot: [hipRx, hipRy, hipRz],
    },
    ankle: {
      pos: [side * 0.035, -0.26 + 0.015 * lift, 0.02],
      rot: [ankleRx, 0, ankleRz],
    },
  };
}

const walk = sampleClip('Walk', 0.92, 36, (phi) => {
  const left = legWalkTracks(phi, -1);
  const right = legWalkTracks(phi + Math.PI, 1);

  // Rebond vertical à chaque pas (2 pas par cycle)
  const bounce = Math.cos(2 * phi);
  const bounceLag = Math.cos(2 * phi - 0.35);
  const sway = Math.sin(phi); // Transfert de poids gauche/droite

  return {
    Torso: {
      pos: [0.022 * sway, 0.79 + 0.038 * bounce, 0.015 * Math.sin(2 * phi)],
      rot: [0.085 + 0.025 * Math.sin(2 * phi), -0.13 * sway, -0.075 * sway],
    },
    Body: {
      scale: [0.39 * (1 - 0.016 * bounce), 0.39 * (1 + 0.026 * bounce), 0.29 * (1 - 0.014 * bounce)],
    },
    Head: {
      pos: [0.018 * sway, 1.43 + 0.044 * bounceLag, 0.03 + 0.012 * Math.sin(2 * phi)],
      rot: [0.03 + 0.035 * Math.sin(2 * phi - 0.4), 0.085 * Math.sin(phi - 0.25), 0.055 * Math.sin(phi - 0.2)],
    },
    // Balancement croisé des bras : bras droit avance quand jambe gauche avance (sin(phi) > 0 => rx < 0)
    Arm_L: {
      pos: [-0.32 + 0.015 * sway, 0.99 + 0.034 * bounce - 0.018 * sway, -0.025 * sway],
      rot: [0.54 * sway - 0.08, -0.14 * sway, -0.07 - 0.04 * Math.cos(phi)],
    },
    Arm_R: {
      pos: [0.32 + 0.015 * sway, 0.99 + 0.034 * bounce + 0.018 * sway, 0.025 * sway],
      rot: [-0.54 * sway - 0.08, -0.14 * sway, 0.07 + 0.04 * Math.cos(phi)],
    },
    Leg_L: left.leg,
    Ankle_L: left.ankle,
    Leg_R: right.leg,
    Ankle_R: right.ankle,
  };
});

const binary = await new GLTFExporter().parseAsync(root, { binary: true, animations: [idle, taunt, walk] });

for (const dir of ['personnages/riskick', 'public/models/personnages/riskick', 'public/models/riskick']) {
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/riskick-v1.glb`, Buffer.from(binary));
}

// Keep the standalone viewer usable in both development and exported builds.
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
    character: 'Riskick',
    bytes: binary.byteLength,
    meshes,
    triangles,
    animations: loaded.animations.map((a) => ({ name: a.name, duration: Number(a.duration.toFixed(2)), tracks: a.tracks.length })),
    bounds: new T.Box3().setFromObject(loaded.scene).getSize(new T.Vector3()).toArray().map((v) => Number(v.toFixed(3))),
  })
);
