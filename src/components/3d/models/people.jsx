import React from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Box, Cylinder, Ball, PALETTE, DYNAMIC, getMaterial, noRaycast } from './kit';
import { canvasTexture } from './civicProps';
import { Wheelbarrow } from './natureProps';

/**
 * Personnages articulés aux proportions réelles (≈ 1,75 m => 1,17 unité, tête de 23 cm), face à +Z.
 * - Corps : torse modelé section par section (large et plat aux épaules, taille marquée, pente douce vers le
 *   cou ; le haut des bras y est noyé comme une couture de manche), membres aux profils musclés, mains à doigts.
 * - Surfaces vivantes : chaque vêtement a sa texture (trame, plis, coutures, boutons, poches, revers, chemise
 *   et cravate peintes, poignets, pli du pantalon, ourlet, bandes réfléchissantes) ; tête sculptée (mâchoire,
 *   menton, arcade, pommettes), nez et oreilles en relief, cheveux en volume calés sur la coupe peinte ; visage
 *   peint en haute définition (iris strié, paupières, sourcils poil à poil, sillons, lèvres, grain de peau).
 * - Mains : paume arrondie, quatre doigts en deux phalanges et pouce ; paumes vers le bas au clavier.
 * - Huit apparences (carnation, coiffure, lunettes, barbe) et vêtements de ville de couleurs variées.
 * Tenues : bureau, costume, maire (écharpe tricolore), ouvrier EPI, jardinier, soudeur, peintre, cariste,
 * logisticien. Poses : stand | sit | work (bras vers l'avant) | type (assis au clavier) | meet (assis à une table,
 * avant-bras posés dessus) | carry.
 * `limbs` (objet mutable) reçoit les groupes animables : bras, avant-bras (`leftArmFore`, `rightArmFore`),
 * jambes, tibias (`leftShin`, `rightShin`), tête et paupières (`eyes`, visibles le temps d'un clignement).
 * Squelette inchangé (hanches, épaules, cou, longueur des membres) : les personnages assis restent à leur place.
 */

/** Angles épaule / coude (rad) de chaque pose : bras le long du corps, au clavier, au poste ou portant une charge. */
// meet : assis à une table de réunion (plateau à 0,55), avant-bras posés dessus, mains à plat
const POSE_ARMS = { type: [-0.35, -1.3], meet: [-0.4, -1.45], work: [-0.55, -0.9], carry: [-0.3, -1.27], sit: [-0.25, -0.95] };
export const armAngles = (pose) => POSE_ARMS[pose] || [0, -0.1];

export const OUTFITS = {
  office: { garment: 'shirt', top: '#d9e2ec', pants: '#2e3440', shoes: '#2b2118' },
  officeAlt: { garment: 'jacket', top: '#3b4150', pants: '#3b4150', shoes: '#16181d' },
  mayor: { garment: 'jacket', top: '#2a303b', pants: '#2a303b', shoes: '#141519', sash: true },
  worker: { garment: 'work', top: '#36455c', pants: '#2c3a4f', shoes: '#1c1c1c', vest: '#d6de3a', helmet: '#f2f2f2' },
  gardener: { garment: 'work', top: '#4a5e3a', pants: '#3d4434', shoes: '#4a3424', gloves: '#7a6440', cap: '#43552f' },
  welder: { garment: 'work', top: '#5b4636', pants: '#2b2b2b', shoes: '#1c1c1c', mask: 'welding', gloves: '#8a6a3c' },
  painter: { garment: 'coverall', top: '#eef0f2', pants: '#eef0f2', shoes: '#1c1c1c', mask: 'respirator', hood: '#eef0f2', gloves: '#3a5a8c' },
  driver: { garment: 'work', top: '#3d4552', pants: '#2b2f36', shoes: '#1c1c1c', vest: '#e8772e', helmet: '#e3c52a' },
  logistics: { garment: 'work', top: '#2f5355', pants: '#2b2f36', shoes: '#1c1c1c', vest: '#e8772e' },
};

// Vêtements de ville : couleurs variées d'une personne à l'autre (quand aucune couleur n'est imposée)
const SHIRTS = ['#d9e2ec', '#eceeef', '#e6d8d2', '#d8d1c1', '#cfdacf', '#dde3ea', '#ebe4d7', '#d2dae6'];
const TROUSERS = ['#2e3440', '#3a3a3a', '#45403a', '#2b3240', '#3d3a36', '#33363d', '#2a2f38', '#4a4740'];
const JACKETS = ['#3b4150', '#2f3a4f', '#4a4238', '#3a3f3d', '#30343c', '#4a3d3d', '#2d3540', '#40444a'];
const TIES = ['#6d2732', '#2c3e5c', '#3f5a46', '#5a4a6e', '#7a5a2a', '#3a3a44', '#6d2732', '#2c3e5c'];
const SHIRT_WHITE = '#f2f2ef';

const SKINS = ['#e6c0a0', '#cf9d7a', '#a7714f', '#6e4631'];
const HAIRS = { dark: '#2a1d15', brown: '#5a3d27', chestnut: '#74482a', blond: '#b8955c', black: '#161311', grey: '#8f8e8a' };
const IRISES = ['#4a3426', '#41617a', '#4f6140', '#2a1d14'];

/** Apparences : peau, coiffure, cheveux, yeux, lunettes, barbe (ou barbe naissante), silhouette féminine. */
const LOOKS = [
  { skin: 0, hair: 'short', color: 'brown', iris: 0, stubble: true },
  { skin: 1, hair: 'bob', color: 'chestnut', iris: 2, female: true },
  { skin: 0, hair: 'receding', color: 'grey', iris: 1, glasses: true },
  { skin: 2, hair: 'long', color: 'dark', iris: 0, female: true },
  { skin: 3, hair: 'short', color: 'black', iris: 3, stubble: true },
  { skin: 0, hair: 'bun', color: 'blond', iris: 1, female: true },
  { skin: 1, hair: 'short', color: 'brown', iris: 2, glasses: true, beard: true },
  { skin: 2, hair: 'ponytail', color: 'dark', iris: 0, female: true },
];

/** Couleur éclaircie (k > 0) ou assombrie (k < 0). */
function shade(hex, k) {
  const c = new THREE.Color(hex);
  return `#${(k >= 0 ? c.lerp(new THREE.Color('#ffffff'), k) : c.lerp(new THREE.Color('#000000'), -k)).getHexString()}`;
}

/** Suite pseudo-aléatoire déterministe (mêmes textures à chaque chargement). */
function rng(seed) {
  let s = (Math.floor(seed * 9973) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/* ------------------------------------------------------------------ */
/* Géométries du corps                                                  */
/* ------------------------------------------------------------------ */

const SEGMENTS_FULL = 28;

/**
 * Surface lissée passant par des sections superelliptiques [y, demi-largeur, demi-profondeur, décalage avant],
 * couture au dos ; coordonnées de texture : u autour (0,5 devant), v de bas en haut.
 */
function loftGeometry(rings, { capBottom = false, capTop = false, segments: SEGMENTS = SEGMENTS_FULL } = {}) {
  const pos = [];
  const uv = [];
  const index = [];
  const y0 = rings[0][0];
  const y1 = rings[rings.length - 1][0];
  const row = SEGMENTS + 1;
  rings.forEach(([y, w, d, zc = 0]) => {
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const a = -Math.PI / 2 + (i / SEGMENTS) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(w * Math.sign(c) * Math.abs(c) ** 0.83, y, zc + d * Math.sign(s) * Math.abs(s) ** 0.83);
      uv.push(i / SEGMENTS, (y - y0) / (y1 - y0));
    }
  });
  for (let k = 0; k < rings.length - 1; k += 1) {
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = k * row + i;
      const c = a + row;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  if (capBottom) {
    const center = pos.length / 3;
    pos.push(0, y0, rings[0][3] || 0);
    uv.push(0.5, 0);
    for (let i = 0; i < SEGMENTS; i += 1) index.push(center, i, i + 1);
  }
  if (capTop) {
    const center = pos.length / 3;
    const top = (rings.length - 1) * row;
    pos.push(0, y1, rings[rings.length - 1][3] || 0);
    uv.push(0.5, 1);
    for (let i = 0; i < SEGMENTS; i += 1) index.push(center, top + i + 1, top + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // Couture du dos : normales moyennées (pas de ligne d'ombre)
  const n = geometry.attributes.normal;
  for (let k = 0; k < rings.length; k += 1) {
    const a = k * row;
    const b = a + SEGMENTS;
    const x = (n.getX(a) + n.getX(b)) / 2;
    const y = (n.getY(a) + n.getY(b)) / 2;
    const z = (n.getZ(a) + n.getZ(b)) / 2;
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  return geometry;
}

/** Membre tourné (profil [rayon, y] de bas en haut), couture au dos. */
const limb = (profile, k = 1) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * k, y)), 18, Math.PI);

// Sections du torse (y au-dessus des hanches) : bassin (pantalon) puis buste jusqu'au cou
const BODIES = {
  male: {
    // Bassin arrondi en dessous (entrejambe galbé entre les cuisses, pas de fond plat)
    seat: [[-0.095, 0.03, 0.026], [-0.089, 0.066, 0.048], [-0.079, 0.088, 0.062], [-0.064, 0.099, 0.071], [-0.02, 0.118, 0.08], [0.03, 0.115, 0.077], [0.062, 0.113, 0.075]],
    top: [
      [0.052, 0.113, 0.075],
      [0.14, 0.11, 0.076, 0.004],
      [0.22, 0.114, 0.085, 0.008],
      [0.29, 0.12, 0.086, 0.008],
      [0.335, 0.142, 0.08, 0.005],
      [0.37, 0.156, 0.07],
      [0.392, 0.15, 0.064],
      [0.408, 0.118, 0.058],
      [0.423, 0.07, 0.048],
      [0.437, 0.036, 0.034],
    ],
    belt: [[0.038, 0.12, 0.082], [0.072, 0.119, 0.081]],
    // Col : bande étroite autour du cou, 5 mm au-dessus du buste (pas de faces confondues)
    collar: [[0.426, 0.068, 0.05], [0.437, 0.044, 0.04], [0.45, 0.032, 0.032]],
    armX: 0.13,
    limbs: 1,
  },
  female: {
    seat: [[-0.095, 0.032, 0.027], [-0.089, 0.07, 0.05], [-0.079, 0.093, 0.064], [-0.064, 0.105, 0.073], [-0.02, 0.126, 0.084], [0.03, 0.118, 0.077], [0.066, 0.101, 0.069]],
    top: [
      [0.056, 0.101, 0.069],
      [0.14, 0.1, 0.07, 0.004],
      [0.22, 0.108, 0.088, 0.012],
      [0.29, 0.112, 0.084, 0.008],
      [0.335, 0.132, 0.076, 0.004],
      [0.37, 0.146, 0.066],
      [0.392, 0.14, 0.06],
      [0.408, 0.11, 0.055],
      [0.423, 0.066, 0.046],
      [0.437, 0.034, 0.032],
    ],
    belt: [[0.044, 0.116, 0.079], [0.074, 0.107, 0.075]],
    collar: [[0.426, 0.065, 0.048], [0.437, 0.042, 0.038], [0.45, 0.031, 0.031]],
    armX: 0.122,
    limbs: 0.93,
  },
};

// Gilet : buste agrandi de 9 mm, de la taille à la poitrine
const vestRings = (top) => top.filter(([y]) => y >= 0.05 && y <= 0.336).map(([y, w, d, zc = 0]) => [y, w + 0.009, d + 0.009, zc]);

const UPPER_ARM = [[0.025, -0.225], [0.027, -0.19], [0.031, -0.12], [0.033, -0.06], [0.031, -0.025], [0.018, -0.008], [0.001, -0.002]];
const FOREARM = [[0.018, -0.21], [0.02, -0.19], [0.026, -0.13], [0.028, -0.08], [0.026, -0.03], [0.016, -0.008], [0.001, -0.002]];
const THIGH = [[0.041, -0.275], [0.045, -0.23], [0.054, -0.12], [0.058, -0.05], [0.055, -0.01], [0.035, 0.012], [0.001, 0.02]];
const SHIN = [[0.031, -0.25], [0.033, -0.22], [0.04, -0.12], [0.042, -0.06], [0.04, -0.015], [0.026, 0.006], [0.001, 0.012]];

const geometryCache = new Map();
function bodyGeometry(sex, part) {
  const key = `${sex}|${part}`;
  if (!geometryCache.has(key)) {
    const b = BODIES[sex];
    const make = {
      seat: () => loftGeometry(b.seat, { capBottom: true }),
      top: () => loftGeometry(b.top, { capTop: true }),
      belt: () => loftGeometry(b.belt),
      collar: () => loftGeometry(b.collar),
      vest: () => loftGeometry(vestRings(b.top)),
      upper: () => limb(UPPER_ARM, b.limbs),
      fore: () => limb(FOREARM, b.limbs),
      thigh: () => limb(THIGH, b.limbs),
      shin: () => limb(SHIN, b.limbs),
    }[part];
    geometryCache.set(key, make());
  }
  return geometryCache.get(key);
}

// Articulations, chignons : 16 × 12 suffisent (352 triangles au lieu de 720)
const SPHERE = new THREE.SphereGeometry(0.5, 16, 12);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Crâne sculpté à partir d'une sphère (le visage peint garde ses repères) : mâchoire qui s'affine vers le
 * menton, menton marqué, nuque, occiput plein, arcade sourcilière, pommettes. `inflate` agrandit la forme
 * (calotte des cheveux posée par-dessus).
 */
export function sculptedHead(inflate = 1) {
  const geo = new THREE.SphereGeometry(0.5, 44, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    let x = pos.getX(i) * 2;
    const y = pos.getY(i) * 2;
    let z = pos.getZ(i) * 2;
    const low = smoothstep(0, -1, y);
    x *= 1 - 0.26 * low * low;
    if (z < 0) z *= 1 - 0.3 * low;
    else z *= 1 - 0.06 * low * low;
    if (y > 0 && z < 0) z *= 1 + 0.07 * y;
    const front = smoothstep(0.55, 0.95, z);
    if (y > 0.08 && y < 0.34) z += 0.035 * front * Math.max(0, 1 - Math.abs(x) * 1.3) * Math.sin(((y - 0.08) / 0.26) * Math.PI);
    if (y > -0.24 && y < 0.04 && z > 0.35) x *= 1 + 0.035 * smoothstep(0.45, 0.85, Math.abs(x));
    if (y < -0.55 && z > 0.2) z += 0.05 * smoothstep(-0.55, -0.85, y) * smoothstep(0.2, 0.6, z);
    pos.setXYZ(i, (x / 2) * inflate, (y / 2) * inflate, (z / 2) * inflate);
  }
  geo.computeVertexNormals();
  return geo;
}

const HEAD_GEOMETRY = sculptedHead();
const HEAD_SCALE = [0.152, 0.19, 0.168];
const HEAD_CENTER = 0.095;
// Tête ramenée à 23 cm de haut (repère du visage inchangé, mis à l'échelle autour du cou)
const HEAD_GROUP = [0.69, 0.8, 0.79];
const CAP = new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const RING = new THREE.TorusGeometry(0.0145, 0.0015, 6, 18);
const EYE_THETA = 0.466 * Math.PI;
const EYE_SPREAD = 0.385;

function headPoint(theta, dphi, lift = 1) {
  const phi = Math.PI / 2 + dphi;
  return [
    -Math.cos(phi) * Math.sin(theta) * (HEAD_SCALE[0] / 2) * lift,
    HEAD_CENTER + Math.cos(theta) * (HEAD_SCALE[1] / 2) * lift,
    Math.sin(phi) * Math.sin(theta) * (HEAD_SCALE[2] / 2) * lift,
  ];
}

/* ------------------------------------------------------------------ */
/* Textures des vêtements (dessinées une fois, en couleurs réelles)      */
/* ------------------------------------------------------------------ */

/** Trame du tissu : bruit fin et motif (toile, sergé, grosse toile de travail). */
function grain(ctx, w, h, amount, pattern, seed) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let p = 0;
      if (pattern === 'twill') p = ((x + y) & 3) < 2 ? -5 : 3;
      else if (pattern === 'canvas') p = (((x >> 1) ^ (y >> 1)) & 1) ? -6 : 4;
      else if (pattern === 'plain') p = (x ^ y) & 1 ? -3 : 2;
      const n = (r() - 0.5) * amount + p;
      const i = (y * w + x) * 4;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Plis : traînées verticales douces, plus sombres ou plus claires. */
function folds(ctx, w, h, count, seed, strength = 0.1) {
  const r = rng(seed + 0.31);
  for (let k = 0; k < count; k += 1) {
    const x = r() * w;
    const fw = w * (0.025 + r() * 0.05);
    const light = r() < 0.35;
    const c = light ? '255,255,255' : '0,0,0';
    const a = light ? strength * 0.5 : strength;
    const g = ctx.createLinearGradient(x - fw, 0, x + fw, 0);
    g.addColorStop(0, `rgba(${c},0)`);
    g.addColorStop(0.5, `rgba(${c},${a})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    const y0 = r() * h * 0.25;
    ctx.fillRect(x - fw, y0, fw * 2, h - y0);
  }
}

/** Plis horizontaux courbes (coude, genou, cheville). */
function creases(ctx, w, y0, y1, count, seed, alpha = 0.16) {
  const r = rng(seed + 0.77);
  ctx.lineWidth = 1.4;
  for (let k = 0; k < count; k += 1) {
    const y = y0 + r() * (y1 - y0);
    const x = r() * w;
    const len = w * (0.15 + r() * 0.25);
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.quadraticCurveTo(x, y + (r() - 0.5) * 6, x + len / 2, y + (r() - 0.5) * 4);
    ctx.stroke();
  }
}

function stroke(ctx, pts, color, width, dash = null) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const PATTERN = { shirt: 'plain', jacket: 'twill', work: 'canvas', coverall: 'plain' };

/**
 * Buste (u autour, 0,5 devant ; v de la ceinture au cou) : chemise (patte, boutons, poche), veste de costume
 * (chemise et cravate dans l'encolure, revers, boutons, poches), veste de travail (fermeture, poches de
 * poitrine, surpiqûres), combinaison ; écharpe tricolore portée de l'épaule droite à la hanche gauche.
 */
function paintTorso(ctx, w, h, { garment, color, tie, sash }) {
  const cx = w / 2;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 10, PATTERN[garment], color.length + garment.length);
  folds(ctx, w, h, garment === 'jacket' ? 5 : 8, garment.length, garment === 'jacket' ? 0.07 : 0.1);
  // Coutures de côté et ombre sous le col
  [0.25, 0.75].forEach((u) => stroke(ctx, [[u * w, 0], [u * w, h]], 'rgba(0,0,0,0.13)', 1.5));
  const nape = ctx.createLinearGradient(0, 0, 0, h * 0.08);
  nape.addColorStop(0, 'rgba(0,0,0,0.18)');
  nape.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = nape;
  ctx.fillRect(0, 0, w, h * 0.08);

  if (garment === 'shirt') {
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(cx - 5, 0, 10, h);
    stroke(ctx, [[cx - 5, 0], [cx - 5, h]], 'rgba(0,0,0,0.12)', 1);
    for (let v = 0.1; v < 0.9; v += 0.13) dot(ctx, cx, (1 - v) * h, 2.6, '#f8f8f6');
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(w * 0.43 - 16, h * 0.26, 30, 34);
    stroke(ctx, [[w * 0.43 - 16, h * 0.29], [w * 0.43 + 14, h * 0.29]], 'rgba(0,0,0,0.14)', 1);
  }
  if (garment === 'jacket') {
    // Encolure : chemise blanche et cravate
    ctx.fillStyle = SHIRT_WHITE;
    ctx.beginPath();
    ctx.moveTo(cx - 20, 0);
    ctx.lineTo(cx, h * 0.52);
    ctx.lineTo(cx + 20, 0);
    ctx.fill();
    ctx.fillStyle = tie;
    ctx.beginPath();
    ctx.moveTo(cx - 4, h * 0.05);
    ctx.lineTo(cx + 4, h * 0.05);
    ctx.lineTo(cx + 7, h * 0.42);
    ctx.lineTo(cx, h * 0.49);
    ctx.lineTo(cx - 7, h * 0.42);
    ctx.fill();
    ctx.fillStyle = shade(tie, -0.25);
    ctx.fillRect(cx - 5, 0, 10, h * 0.06);
    // Revers
    [-1, 1].forEach((s) => {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.moveTo(cx + s * 20, 0);
      ctx.lineTo(cx + s * 44, h * 0.3);
      ctx.lineTo(cx + s * 3, h * 0.55);
      ctx.lineTo(cx, h * 0.52);
      ctx.fill();
      stroke(ctx, [[cx + s * 20, 0], [cx + s * 44, h * 0.3], [cx + s * 3, h * 0.55]], 'rgba(0,0,0,0.38)', 2);
    });
    // Boutons, poches à rabat, poche de poitrine, fente du dos
    dot(ctx, cx, h * 0.63, 3.2, 'rgba(0,0,0,0.6)');
    dot(ctx, cx, h * 0.77, 3.2, 'rgba(0,0,0,0.6)');
    [-1, 1].forEach((s) => {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(cx + s * w * 0.1 - 20, h * 0.8, 40, 4);
    });
    stroke(ctx, [[w * 0.41 - 13, h * 0.34], [w * 0.41 + 13, h * 0.33]], 'rgba(0,0,0,0.3)', 2.5);
    stroke(ctx, [[1, h * 0.8], [1, h]], 'rgba(0,0,0,0.3)', 2);
  }
  if (garment === 'work' || garment === 'coverall') {
    // Fermeture éclair, poches de poitrine à rabat, surpiqûres
    ctx.fillStyle = '#a5aaae';
    ctx.fillRect(cx - 2, h * 0.02, 4, h * 0.98);
    for (let y = h * 0.04; y < h; y += 5) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(cx - 2, y, 4, 1);
    }
    [-1, 1].forEach((s) => {
      if (garment === 'coverall' && s > 0) return;
      const px = cx + s * w * 0.1;
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(px - 17, h * 0.24, 34, 40);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.fillRect(px - 17, h * 0.24, 34, 10);
      dot(ctx, px, h * 0.24 + 6, 2, 'rgba(0,0,0,0.45)');
      stroke(ctx, [[px - 15, h * 0.24 + 13], [px + 15, h * 0.24 + 13]], 'rgba(255,255,255,0.22)', 1, [3, 3]);
    });
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, h * 0.93, w, h * 0.07);
  }
  if (sash) {
    // Écharpe tricolore : de l'épaule droite (u ≈ 0,66 devant, 0,84 derrière) à la hanche gauche, bleu côté col
    const band = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const nx = -(y1 - y0) / len;
      const ny = (x1 - x0) / len;
      const up = ny > 0 ? -1 : 1; // côté col : vers le haut de l'image
      [['#1f3f8f', -1], [SHIRT_WHITE, 0], ['#c42b34', 1]].forEach(([c, k]) => {
        const o = k * up * 9;
        stroke(ctx, [[x0 + nx * o, y0 + ny * o], [x1 + nx * o, y1 + ny * o]], c, 9.5);
      });
    };
    band(w * 0.67, -h * 0.03, w * 0.3, h * 1.02);
    band(w * 0.84, -h * 0.03, w * 1.02, h * 0.5);
    band(-w * 0.02, h * 0.5, w * 0.16, h * 1.02);
    // Nœud et franges dorés à la hanche
    dot(ctx, w * 0.31, h * 0.92, 9, '#c9a227');
    dot(ctx, w * 0.31, h * 0.92, 4, '#e2c55a');
  }
}

/** Manche (u autour, v du poignet vers l'épaule) : plis, coude, poignet de chemise ou de travail. */
function paintSleeve(ctx, w, h, { garment, color, part }) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 10, PATTERN[garment], part.length + color.length * 0.1);
  folds(ctx, w, h, 4, part.length + 0.5, 0.09);
  if (part === 'fore') {
    creases(ctx, w, 0, h * 0.14, 4, 1.3);
    if (garment === 'shirt') {
      stroke(ctx, [[0, h * 0.9], [w, h * 0.9]], 'rgba(0,0,0,0.18)', 1.5);
      dot(ctx, w * 0.42, h * 0.95, 2, '#f8f8f6');
    }
    if (garment === 'jacket') {
      ctx.fillStyle = SHIRT_WHITE;
      ctx.fillRect(0, h * 0.94, w, h * 0.06);
      stroke(ctx, [[0, h * 0.935], [w, h * 0.935]], 'rgba(0,0,0,0.4)', 1.5);
    }
    if (garment === 'work' || garment === 'coverall') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, h * 0.9, w, h * 0.1);
    }
  } else {
    creases(ctx, w, h * 0.85, h, 4, 2.1);
    stroke(ctx, [[0, h * 0.03], [w, h * 0.03]], 'rgba(0,0,0,0.12)', 1.2);
  }
}

/** Jambe de pantalon : pli marqué, poches (cuisse), plis du genou, ourlet (tibia). */
function paintLeg(ctx, w, h, { color, part }) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 9, 'twill', part.length + 3.3);
  folds(ctx, w, h, 5, part.length + 1.7, 0.09);
  // Pli du pantalon devant et derrière
  [0.5, 0.0, 1.0].forEach((u) => {
    stroke(ctx, [[u * w - 1.5, 0], [u * w - 1.5, h]], 'rgba(255,255,255,0.09)', 1.2);
    stroke(ctx, [[u * w + 1.2, 0], [u * w + 1.2, h]], 'rgba(0,0,0,0.12)', 1.2);
  });
  if (part === 'thigh') {
    [0.3, 0.7].forEach((u) => stroke(ctx, [[u * w, 0], [u * w + (u < 0.5 ? -8 : 8), h * 0.2]], 'rgba(0,0,0,0.3)', 1.6));
    creases(ctx, w, h * 0.86, h, 4, 4.1, 0.14);
  } else {
    creases(ctx, w, 0, h * 0.12, 4, 5.3, 0.14);
    creases(ctx, w, h * 0.78, h * 0.9, 3, 6.7, 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, h * 0.94, w, h * 0.06);
  }
}

/** Bassin : braguette et poches arrière. */
function paintSeat(ctx, w, h, { color }) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 9, 'twill', 8.8);
  stroke(ctx, [[w / 2 + 4, 0], [w / 2 + 4, h * 0.7], [w / 2, h * 0.85]], 'rgba(0,0,0,0.28)', 1.4);
  [0.1, 0.9].forEach((u) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(u * w - 12, h * 0.08, 24, h * 0.42);
  });
}

/** Gilet haute visibilité : deux bandes réfléchissantes, fermeture devant. */
function paintVest(ctx, w, h, { color }) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 8, 'plain', 4.4);
  folds(ctx, w, h, 5, 9.1, 0.07);
  [0.75, 0.4].forEach((y) => {
    ctx.fillStyle = '#d4d8db';
    ctx.fillRect(0, h * y, w, h * 0.09);
    ctx.fillStyle = '#eef0f1';
    ctx.fillRect(0, h * y, w, h * 0.022);
    stroke(ctx, [[0, h * (y + 0.09)], [w, h * (y + 0.09)]], 'rgba(0,0,0,0.18)', 1);
  });
  stroke(ctx, [[w / 2, 0], [w / 2, h]], 'rgba(0,0,0,0.35)', 2);
}

const materialCache = new Map();
function clothMaterial(key, w, h, paint, spec, roughness = 0.86) {
  if (!materialCache.has(key)) {
    const map = canvasTexture(`cloth|${key}`, w, h, (ctx, cw, ch) => paint(ctx, cw, ch, spec));
    materialCache.set(key, new THREE.MeshStandardMaterial({ map, roughness, metalness: 0 }));
  }
  return materialCache.get(key);
}

/* ------------------------------------------------------------------ */
/* Tête : visage peint                                                   */
/* ------------------------------------------------------------------ */

const HAIRLINES = {
  short: { front: 0.31, side: 0.44, back: 0.6 },
  bob: { front: 0.3, side: 0.62, back: 0.7 },
  long: { front: 0.3, side: 0.66, back: 0.86 },
  bun: { front: 0.3, side: 0.45, back: 0.6 },
  ponytail: { front: 0.3, side: 0.45, back: 0.6 },
  receding: { front: 0.35, side: 0.46, back: 0.62 },
};

/** Limite basse de la chevelure (fraction de la hauteur de la texture, 0 = sommet) autour de la tête (u, 0,25 devant). */
function hairFraction(line, u) {
  const b = (1 - Math.cos((u - 0.25) * Math.PI * 2)) / 2; // 0 devant, 1 derrière
  return b < 0.5 ? line.front + (line.side - line.front) * (b / 0.5) : line.side + (line.back - line.side) * ((b - 0.5) / 0.5);
}

const shellCache = new Map();
/**
 * Calotte des cheveux : le crâne sculpté agrandi de 5,5 %, réduit à la zone de la coupe peinte (lisière 2 % en
 * retrait de la peinture : aucun liseré de peau). Donne l'épaisseur et la lisière de la chevelure.
 */
function hairShell(style) {
  if (!shellCache.has(style)) {
    const line = HAIRLINES[style] || HAIRLINES.short;
    // Épaisseur selon la coupe : ras pour les cheveux courts, gonflée pour le carré et les cheveux longs
    const geo = sculptedHead({ bob: 1.1, long: 1.085, receding: 1.04 }[style] || 1.055);
    const uv = geo.attributes.uv;
    const src = geo.index.array;
    const keep = (i) => 1 - uv.getY(i) < hairFraction(line, uv.getX(i)) - 0.02;
    const index = [];
    for (let k = 0; k < src.length; k += 3) {
      if (keep(src[k]) && keep(src[k + 1]) && keep(src[k + 2])) index.push(src[k], src[k + 1], src[k + 2]);
    }
    geo.setIndex(index);
    shellCache.set(style, geo);
  }
  return shellCache.get(style);
}

function paintHead(ctx, w, h, look) {
  const skin = SKINS[look.skin];
  const hair = HAIRS[look.color];
  const line = HAIRLINES[look.hair] || HAIRLINES.short;
  const cx = w * 0.25;
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, w, h);
  // Grain de peau sur toute la texture (en pixels réels : le dessin est agrandi ×2)
  grain(ctx, ctx.canvas.width, ctx.canvas.height, 8, 'none', look.skin + 1.7);

  const eyeY = h * 0.466;
  const eyeDx = (EYE_SPREAD / (Math.PI * 2)) * w;
  // Modelé : orbites, pommettes, joues, ombre sous le menton
  [-1, 1].forEach((s) => {
    const sock = ctx.createRadialGradient(cx + s * eyeDx, eyeY - 2, 3, cx + s * eyeDx, eyeY - 2, 20);
    sock.addColorStop(0, 'rgba(80, 40, 30, 0.1)');
    sock.addColorStop(1, 'rgba(80, 40, 30, 0)');
    ctx.fillStyle = sock;
    ctx.fillRect(cx + s * eyeDx - 22, eyeY - 24, 44, 44);
    const cheek = ctx.createRadialGradient(cx + s * 30, h * 0.58, 2, cx + s * 30, h * 0.58, 18);
    cheek.addColorStop(0, 'rgba(190, 95, 85, 0.12)');
    cheek.addColorStop(1, 'rgba(190, 95, 85, 0)');
    ctx.fillStyle = cheek;
    ctx.fillRect(cx + s * 30 - 20, h * 0.58 - 20, 40, 40);
    const bone = ctx.createRadialGradient(cx + s * 34, h * 0.52, 1, cx + s * 34, h * 0.52, 12);
    bone.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
    bone.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = bone;
    ctx.fillRect(cx + s * 34 - 14, h * 0.52 - 14, 28, 28);
  });
  const chin = ctx.createLinearGradient(0, h * 0.72, 0, h * 0.86);
  chin.addColorStop(0, 'rgba(60, 30, 20, 0)');
  chin.addColorStop(1, 'rgba(60, 30, 20, 0.24)');
  ctx.fillStyle = chin;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // Barbe naissante : fin semis sombre sur la mâchoire
  if (look.stubble) {
    const r = rng(look.skin + 5.5);
    ctx.fillStyle = shade(hair, -0.1);
    for (let i = 0; i < 700; i += 1) {
      const a = r() * Math.PI * 2;
      const rr = Math.sqrt(r());
      const x = cx + Math.cos(a) * rr * 46;
      const y = h * 0.7 + Math.sin(a) * rr * 30;
      if (y < h * 0.6 || (Math.abs(x - cx) < 14 && Math.abs(y - h * 0.654) < 6)) continue;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Sillons du nez à la bouche, creux au-dessus de la lèvre
  ctx.strokeStyle = 'rgba(90, 45, 30, 0.14)';
  ctx.lineWidth = 1.6;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(cx + s * 9, h * 0.55);
    ctx.quadraticCurveTo(cx + s * 17, h * 0.6, cx + s * 14, h * 0.665);
    ctx.stroke();
  });
  ctx.strokeStyle = 'rgba(90, 45, 30, 0.12)';
  ctx.lineWidth = 1;
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.moveTo(cx + s * 2.5, h * 0.575);
    ctx.lineTo(cx + s * 3, h * 0.635);
    ctx.stroke();
  });

  // Chevelure
  const bottom = (u) => hairFraction(line, u) * h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, bottom(x / w));
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 320; i += 1) {
    const x = (i * 97.13) % w;
    const y = ((i * 53.71) % (h * 0.9)) + 2;
    ctx.strokeStyle = i % 2 ? shade(hair, 0.14) : shade(hair, -0.22);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + ((i % 5) - 2) * 1.5, y + 9);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (look.beard) {
    ctx.fillStyle = shade(hair, 0.05);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.72, 46, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.6, 40, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sourcils : trait de fond et poils obliques
  ctx.strokeStyle = shade(hair, -0.3);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  [-1, 1].forEach((s) => {
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(cx + s * (eyeDx - 12), h * 0.392);
    ctx.quadraticCurveTo(cx + s * eyeDx, h * 0.372, cx + s * (eyeDx + 13), h * 0.394);
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 14; k += 1) {
      const t = k / 13;
      const x = cx + s * (eyeDx - 12 + t * 25);
      const y = h * (0.392 - Math.sin(t * Math.PI) * 0.018) + (t < 0.4 ? 1 : 0);
      ctx.beginPath();
      ctx.moveTo(x, y + 1.6);
      ctx.lineTo(x + s * 2.2, y - 1.6);
      ctx.stroke();
    }
    ctx.lineWidth = 2.4;
  });
  ctx.globalAlpha = 1;
  // Yeux en amande, regard détendu : la paupière supérieure couvre le haut de l'iris (pas d'yeux ronds
  // écarquillés), blanc de l'œil cassé et ombré sous la paupière, coin externe à peine relevé
  [-1, 1].forEach((s) => {
    const ex = cx + s * eyeDx;
    const X = (x) => ex + s * x; // x < 0 : côté nez
    const iris = IRISES[look.iris];
    const eyeShape = () => {
      ctx.beginPath();
      ctx.moveTo(X(-10), eyeY + 0.9);
      ctx.bezierCurveTo(X(-5.5), eyeY - 4.1, X(4.5), eyeY - 4.3, X(10), eyeY - 0.2);
      ctx.bezierCurveTo(X(6), eyeY + 3.3, X(-5), eyeY + 3.6, X(-10), eyeY + 0.9);
      ctx.closePath();
    };
    ctx.save();
    eyeShape();
    ctx.fillStyle = '#e4ddd3';
    ctx.fill();
    ctx.clip();
    // Iris (haut caché par la paupière), stries, cercle sombre, pupille, petit reflet
    const iy = eyeY + 0.3;
    dot(ctx, ex + s * 0.3, iy, 4.3, iris);
    ctx.strokeStyle = shade(iris, 0.3);
    ctx.lineWidth = 0.45;
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(ex + s * 0.3 + Math.cos(a) * 2, iy + Math.sin(a) * 2);
      ctx.lineTo(ex + s * 0.3 + Math.cos(a) * 4, iy + Math.sin(a) * 4);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(ex + s * 0.3, iy, 4.3, 0, Math.PI * 2);
    ctx.stroke();
    dot(ctx, ex + s * 0.3, iy, 1.7, '#141110');
    dot(ctx, ex + s * 0.3 - 1.3, iy - 1.2, 0.7, 'rgba(255,255,255,0.75)');
    // Coin interne rosé, ombre portée de la paupière sur le haut de l'œil
    dot(ctx, X(-8.6), eyeY + 0.9, 2, 'rgba(200, 125, 115, 0.5)');
    const lid = ctx.createLinearGradient(0, eyeY - 4, 0, eyeY + 0.5);
    lid.addColorStop(0, 'rgba(60, 32, 24, 0.45)');
    lid.addColorStop(1, 'rgba(60, 32, 24, 0)');
    ctx.fillStyle = lid;
    ctx.fillRect(ex - 11, eyeY - 5, 22, 6);
    ctx.restore();
    // Bord des cils (plus marqué vers l'extérieur), paupière inférieure discrète, pli de la paupière
    ctx.strokeStyle = '#2a1d17';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(-9.5), eyeY + 0.6);
    ctx.bezierCurveTo(X(-5.5), eyeY - 4.1, X(4.5), eyeY - 4.3, X(10.3), eyeY - 0.4);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = 'rgba(70, 40, 30, 0.32)';
    ctx.beginPath();
    ctx.moveTo(X(-9.5), eyeY + 1.2);
    ctx.bezierCurveTo(X(-5), eyeY + 3.9, X(6), eyeY + 3.6, X(9.8), eyeY + 0.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90, 50, 40, 0.24)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(X(-8.5), eyeY - 2.6);
    ctx.bezierCurveTo(X(-4.5), eyeY - 7.2, X(4.5), eyeY - 7.4, X(10), eyeY - 3);
    ctx.stroke();
    // Paupière supérieure légèrement plus foncée que la peau (volume, regard posé)
    ctx.fillStyle = 'rgba(110, 60, 45, 0.08)';
    ctx.beginPath();
    ctx.moveTo(X(-9.5), eyeY + 0.6);
    ctx.bezierCurveTo(X(-5.5), eyeY - 4.1, X(4.5), eyeY - 4.3, X(10.3), eyeY - 0.4);
    ctx.bezierCurveTo(X(4.5), eyeY - 7.4, X(-4.5), eyeY - 7.2, X(-9.5), eyeY + 0.6);
    ctx.fill();
  });
  // Nez
  ctx.strokeStyle = 'rgba(90, 45, 30, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 4, h * 0.48);
  ctx.quadraticCurveTo(cx + 6, h * 0.53, cx + 3, h * 0.555);
  ctx.stroke();
  ctx.fillStyle = 'rgba(70, 35, 25, 0.16)';
  [-1, 1].forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(cx + s * 4, h * 0.557, 2.1, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // Lèvres
  const lips = shade(skin, -0.28);
  ctx.fillStyle = lips;
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.652, 11, 2.6, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(lips, 0.12);
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.656, 9, 3.2, 0, 0, Math.PI);
  ctx.fill();
  ctx.strokeStyle = shade(lips, -0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - 11.5, h * 0.648);
  ctx.quadraticCurveTo(cx, h * 0.661, cx + 11.5, h * 0.648);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90, 45, 30, 0.18)';
  ctx.lineWidth = 0.9;
  [-1, 1].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(cx + k * 12, h * 0.643);
    ctx.quadraticCurveTo(cx + k * 13.6, h * 0.65, cx + k * 12.8, h * 0.657);
    ctx.stroke();
  });
  // Reflet de la lèvre inférieure, ombre sous la lèvre
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.ellipse(cx + 1, h * 0.663, 4.5, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(90, 45, 30, 0.1)';
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.684, 8, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (look.beard) {
    ctx.fillStyle = shade(hair, 0.05);
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.628, 13, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

const headMaterials = new Map();
function headMaterial(index) {
  if (!headMaterials.has(index)) {
    // Texture deux fois plus fine : dessin dans un repère 512 × 256 agrandi ×2
    const map = canvasTexture(`person-head-v4-${index}`, 1024, 512, (ctx) => {
      ctx.scale(2, 2);
      paintHead(ctx, 512, 256, LOOKS[index]);
    });
    headMaterials.set(index, new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 }));
  }
  return headMaterials.get(index);
}

const hairMaterials = new Map();
/** Cheveux en volume : mèches peintes. */
function hairMaterial(color) {
  if (!hairMaterials.has(color)) {
    const map = canvasTexture(`person-hair-${color}`, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      const r = rng(color.length + 2.2);
      for (let i = 0; i < 260; i += 1) {
        const x = r() * w;
        const y = r() * h;
        ctx.strokeStyle = r() < 0.5 ? shade(color, 0.15) : shade(color, -0.25);
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 4, y + 10 + r() * 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    hairMaterials.set(color, new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0 }));
  }
  return hairMaterials.get(color);
}

const shellMaterials = new Map();
/** Calotte des cheveux : mèches fines partant du sommet, reflets et ombres. */
function hairShellMaterial(color) {
  if (!shellMaterials.has(color)) {
    const map = canvasTexture(`person-hair-shell-${color}`, 512, 256, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      const r = rng(color.length * 3.1 + 0.7);
      ctx.lineCap = 'round';
      for (let i = 0; i < 1500; i += 1) {
        const x = r() * w;
        const y = r() * h * 0.92 - 8;
        const len = 12 + r() * 30;
        ctx.strokeStyle = r() < 0.42 ? shade(color, 0.16 + r() * 0.12) : shade(color, -0.2 - r() * 0.14);
        ctx.globalAlpha = 0.3 + r() * 0.35;
        ctx.lineWidth = 0.7 + r() * 0.9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + (r() - 0.5) * 6, y + len / 2, x + (r() - 0.5) * 9, y + len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    shellMaterials.set(color, new THREE.MeshStandardMaterial({ map, roughness: 0.68, metalness: 0 }));
  }
  return shellMaterials.get(color);
}

function HairVolume({ style, color }) {
  const part = (position, scale, rotation) => <mesh geometry={SPHERE} material={hairMaterial(color)} position={position} scale={scale} rotation={rotation} raycast={noRaycast} />;
  switch (style) {
    case 'long':
      // Longueurs tombant dans le dos (le dessus est porté par la calotte)
      return part([0, -0.02, -0.058], [0.15, 0.22, 0.07]);
    case 'bun':
      return part([0, 0.168, -0.072], [0.07, 0.07, 0.07]);
    case 'ponytail':
      return part([0, 0.07, -0.1], [0.044, 0.13, 0.044], [0.35, 0, 0]);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Mains                                                                */
/* ------------------------------------------------------------------ */

// Main allégée (≈ 600 triangles au lieu de 2 100) : à 5 cm de long, une découpe plus fine ne se voit pas
const PALM = new RoundedBoxGeometry(0.022, 0.052, 0.05, 1, 0.008);
const capsules = new Map();
function capsule(radius, length) {
  const key = `${radius}|${length}`;
  if (!capsules.has(key)) capsules.set(key, new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 2), 2, 5));
  return capsules.get(key);
}
// Doigts de l'auriculaire (arrière) à l'index (avant) : position sur la paume, longueur, flexion
const FINGERS = [
  { z: -0.018, length: 0.034, curl: 0.32 },
  { z: -0.006, length: 0.042, curl: 0.26 },
  { z: 0.006, length: 0.045, curl: 0.22 },
  { z: 0.018, length: 0.04, curl: 0.18 },
];

/**
 * Main au poignet (origine), paume tournée vers la cuisse (−X pour la main droite) : paume arrondie, quatre doigts
 * en deux phalanges de longueurs différentes, légèrement repliés, et pouce opposable vers l'avant.
 */
function Hand({ side, color, palmDown, scale = 1 }) {
  const mat = getMaterial({ color, roughness: 0.6, metalness: 0 });
  // Sans ombre portée : à cette taille elle ne se voit pas, mais elle se redessinerait à chaque image
  const piece = (geometry, props) => <mesh geometry={geometry} material={mat} raycast={noRaycast} {...props} />;
  // Flexion vers la paume ; doigts presque tendus au-dessus du clavier (paume vers le bas)
  const bend = (k) => -side * k * (palmDown ? 0.4 : 1);
  return (
    <group rotation={[0, palmDown ? -side * Math.PI * 0.5 : 0, 0]} scale={scale}>
      {piece(PALM, { position: [0, -0.026, 0] })}
      {FINGERS.map((f) => {
        const a = f.length * 0.56;
        const b = f.length - a;
        return (
          <group key={f.z} position={[-side * 0.002, -0.05, f.z]} rotation={[0, 0, bend(f.curl)]}>
            {piece(capsule(0.0062, a), { position: [0, -a / 2, 0] })}
            <group position={[0, -a + 0.003, 0]} rotation={[0, 0, bend(f.curl * 1.3)]}>
              {piece(capsule(0.0056, b), { position: [0, -b / 2, 0] })}
            </group>
          </group>
        );
      })}
      {/* Pouce : départ sur l'avant de la paume, orienté vers l'avant et vers la paume */}
      <group position={[-side * 0.004, -0.016, 0.022]} rotation={[-0.5, 0, bend(0.4)]}>
        {piece(capsule(0.0074, 0.026), { position: [0, -0.013, 0] })}
        <group position={[0, -0.024, 0]} rotation={[0, 0, bend(0.35)]}>
          {piece(capsule(0.0066, 0.022), { position: [0, -0.011, 0] })}
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Version légère (de loin)                                              */
/* ------------------------------------------------------------------ */

/**
 * Personnage vu de loin (quelques dizaines de pixels de haut) : même squelette, mêmes couleurs de tenue, de peau
 * et de cheveux, mêmes poses, mais moins de 1 000 triangles (au lieu de ≈ 12 700) et uniquement des matériaux
 * mutualisés sans texture — MergeStatic le réduit à un seul maillage (un dessin par image, un dans la carte
 * d'ombre). Membres articulés conservés : `limbs` reste utilisable (jeu de stratégie, vu de haut).
 */
export const PersonDetail = React.createContext(false);

const LITE_SEGMENTS = 9;
const LITE_BOX = new THREE.BoxGeometry(1, 1, 1);
const LITE_SPHERE = new THREE.SphereGeometry(0.5, 10, 7);
const LITE_BALL = new THREE.SphereGeometry(0.5, 7, 5);
const LITE_DOME = new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
const LITE_NECK = new THREE.CylinderGeometry(0.026, 0.026, 0.08, 6, 1, true);
const liteLimb = (profile, k = 1) => new THREE.LatheGeometry([0, 2, 3, 5, 6].map((i) => new THREE.Vector2(profile[i][0] * k, profile[i][1])), 6, Math.PI);
const liteCache = new Map();
function liteGeometry(sex, part) {
  const key = `${sex}|${part}`;
  if (!liteCache.has(key)) {
    const b = BODIES[sex];
    const pick = (rings, idx) => idx.map((i) => rings[Math.min(i, rings.length - 1)]);
    const vest = vestRings(b.top);
    const make = {
      seat: () => loftGeometry(pick(b.seat, [0, 2, 4, 6]), { capBottom: true, segments: LITE_SEGMENTS }),
      top: () => loftGeometry(pick(b.top, [0, 2, 4, 5, 7, 9]), { capTop: true, segments: LITE_SEGMENTS }),
      vest: () => loftGeometry(pick(vest, [0, Math.floor(vest.length / 2), vest.length - 1]), { segments: LITE_SEGMENTS }),
      upper: () => liteLimb(UPPER_ARM, b.limbs),
      fore: () => liteLimb(FOREARM, b.limbs),
      thigh: () => liteLimb(THIGH, b.limbs),
      shin: () => liteLimb(SHIN, b.limbs),
    }[part];
    liteCache.set(key, make());
  }
  return liteCache.get(key);
}

function PersonLite({ outfit, pose, variant, colors, limbs, rest }) {
  const lookIndex = ((variant % LOOKS.length) + LOOKS.length) % LOOKS.length;
  const look = LOOKS[lookIndex];
  const tint = colors?.top ? {} : outfit === 'office' ? { top: SHIRTS[lookIndex], pants: TROUSERS[lookIndex] } : outfit === 'officeAlt' ? { top: JACKETS[lookIndex], pants: JACKETS[lookIndex] } : {};
  const o = { ...(OUTFITS[outfit] || OUTFITS.worker), ...tint, ...colors };
  const sex = look.female ? 'female' : 'male';
  const body = BODIES[sex];
  const skin = SKINS[look.skin];
  const hair = HAIRS[look.color];
  const seated = pose === 'sit' || pose === 'type' || pose === 'meet';
  const [shoulder, elbow] = armAngles(pose);
  const hipY = seated ? 0.33 : 0.56;
  const neckY = hipY + 0.44;
  const headwear = o.helmet || o.hood;
  const setLimb = (key) => (el) => {
    if (limbs && el) limbs[key] = el;
  };
  const limbData = limbs ? DYNAMIC : undefined;
  const piece = (geometry, color, props = {}, roughness = 0.85) => (
    <mesh geometry={geometry} material={getMaterial({ color, roughness, metalness: 0 })} castShadow receiveShadow raycast={noRaycast} {...props} />
  );
  const leg = (side, key) => (
    <group ref={setLimb(key)} userData={limbData} position={[side * 0.062, hipY, 0]} rotation={[seated ? -Math.PI / 2 : 0, 0, 0]}>
      {piece(liteGeometry(sex, 'thigh'), o.pants)}
      <group ref={setLimb(key === 'leftLeg' ? 'leftShin' : 'rightShin')} userData={limbData} position={[0, -0.27, 0]} rotation={[seated ? Math.PI / 2 : 0, 0, 0]}>
        {piece(liteGeometry(sex, 'shin'), o.pants)}
        {piece(LITE_BOX, o.shoes, { position: [0, -0.255, 0.035], scale: [0.084, 0.06, 0.18] }, 0.5)}
      </group>
    </group>
  );
  const arm = (side, key) => (
    <group ref={setLimb(key)} userData={limbData} position={[side * body.armX, hipY + 0.39, 0]} rotation={[shoulder, 0, side * 0.05]}>
      {piece(liteGeometry(sex, 'upper'), o.top)}
      <group ref={setLimb(`${key}Fore`)} userData={limbData} position={[0, -0.22, 0]} rotation={[elbow, 0, 0]}>
        {piece(liteGeometry(sex, 'fore'), o.top)}
        {piece(LITE_BOX, o.gloves || skin, { position: [0, -0.235, 0], scale: [0.03 * body.limbs, 0.07 * body.limbs, 0.05 * body.limbs] }, 0.6)}
      </group>
    </group>
  );
  return (
    <group {...rest}>
      {leg(-1, 'leftLeg')}
      {leg(1, 'rightLeg')}
      {piece(liteGeometry(sex, 'seat'), o.pants, { position: [0, hipY, 0] })}
      {piece(liteGeometry(sex, 'top'), o.top, { position: [0, hipY, 0] })}
      {o.vest && piece(liteGeometry(sex, 'vest'), o.vest, { position: [0, hipY, 0] }, 0.6)}
      {arm(-1, 'leftArm')}
      {arm(1, 'rightArm')}
      {piece(LITE_NECK, skin, { position: [0, neckY + 0.005, 0] }, 0.62)}
      <group ref={setLimb('head')} userData={limbData} position={[0, neckY, 0]}>
        <group scale={HEAD_GROUP}>
          {piece(LITE_SPHERE, skin, { position: [0, HEAD_CENTER, 0], scale: HEAD_SCALE }, 0.62)}
          {!headwear && (
            <>
              {/* Chevelure : calotte inclinée vers l'arrière (front dégagé), longueurs selon la coupe */}
              {piece(LITE_DOME, o.cap || hair, { position: [0, HEAD_CENTER + 0.004, -0.008], rotation: [-0.42, 0, 0], scale: [0.165, 0.2, 0.18] }, 0.8)}
              {!o.cap && look.hair === 'long' && piece(LITE_BALL, hair, { position: [0, -0.02, -0.058], scale: [0.15, 0.22, 0.07] }, 0.8)}
              {!o.cap && look.hair === 'bob' && piece(LITE_BALL, hair, { position: [0, 0.07, -0.02], scale: [0.17, 0.13, 0.16] }, 0.8)}
              {!o.cap && look.hair === 'bun' && piece(LITE_BALL, hair, { position: [0, 0.168, -0.072], scale: [0.07, 0.07, 0.07] }, 0.8)}
              {!o.cap && look.hair === 'ponytail' && piece(LITE_BALL, hair, { position: [0, 0.07, -0.1], scale: [0.044, 0.13, 0.044], rotation: [0.35, 0, 0] }, 0.8)}
            </>
          )}
          {o.helmet && piece(LITE_DOME, o.helmet, { position: [0, 0.125, 0], scale: [0.2, 0.17, 0.21] }, 0.35)}
          {o.hood && piece(LITE_BALL, o.hood, { position: [0, 0.1, -0.005], scale: [0.19, 0.22, 0.2] }, 0.9)}
          {o.mask === 'welding' && piece(LITE_BOX, '#1f2937', { position: [0, 0.09, 0.075], scale: [0.17, 0.19, 0.05] }, 0.5)}
          {o.mask === 'respirator' && piece(LITE_BOX, '#4b5563', { position: [0, 0.065, 0.082], scale: [0.08, 0.06, 0.04] }, 0.6)}
        </group>
      </group>
      {pose === 'carry' &&
        (outfit === 'gardener' ? (
          <group position={[0, 0, 0.87]}>
            <group position={[0, 0.13, 0.36]} rotation={[0.18, 0, 0]}>
              <group position={[0, -0.13, -0.36]}>
                <Wheelbarrow />
              </group>
            </group>
          </group>
        ) : (
          <Box position={[0, hipY + 0.26, 0.24]} size={[0.26, 0.2, 0.2]} color={PALETTE.carton} rough={0.85} />
        ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Personnage                                                           */
/* ------------------------------------------------------------------ */

/**
 * `lite` : version légère (de loin). Sans `lite`, le contexte `PersonDetail` décide (un élément éloigné y passe
 * ses personnages, voir ElementModel).
 */
export function Person({ lite, ...props }) {
  const far = React.useContext(PersonDetail);
  const { outfit = 'worker', pose = 'stand', variant = 0, colors, limbs, ...rest } = props;
  if (lite ?? far) return <PersonLite outfit={outfit} pose={pose} variant={variant} colors={colors} limbs={limbs} rest={rest} />;
  return <PersonFull {...props} />;
}

function PersonFull({ outfit = 'worker', pose = 'stand', variant = 0, colors, limbs, ...rest }) {
  const lookIndex = ((variant % LOOKS.length) + LOOKS.length) % LOOKS.length;
  const look = LOOKS[lookIndex];
  const base = OUTFITS[outfit] || OUTFITS.worker;
  // Vêtements de ville : couleur propre à chaque apparence, sauf couleur imposée
  const tint = colors?.top ? {} : outfit === 'office' ? { top: SHIRTS[lookIndex], pants: TROUSERS[lookIndex] } : outfit === 'officeAlt' ? { top: JACKETS[lookIndex], pants: JACKETS[lookIndex] } : {};
  const o = { ...base, ...tint, ...colors };
  const garment = o.garment || 'work';
  const sex = look.female ? 'female' : 'male';
  const body = BODIES[sex];
  const skin = SKINS[look.skin];
  const hair = HAIRS[look.color];
  const seated = pose === 'sit' || pose === 'type' || pose === 'meet';
  const [shoulder, elbow] = armAngles(pose);
  const hipY = seated ? 0.33 : 0.56;
  const neckY = hipY + 0.44;
  const hands = o.gloves || skin;
  const headwear = o.helmet || o.hood;
  const tie = TIES[lookIndex];

  const torsoMat = clothMaterial(`torso|${garment}|${o.top}|${garment === 'jacket' ? tie : ''}|${o.sash ? 1 : 0}`, 512, 256, paintTorso, { garment, color: o.top, tie, sash: o.sash }, garment === 'jacket' ? 0.8 : 0.86);
  const upperMat = clothMaterial(`upper|${garment}|${o.top}`, 128, 128, paintSleeve, { garment, color: o.top, part: 'upper' });
  const foreMat = clothMaterial(`fore|${garment}|${o.top}`, 128, 128, paintSleeve, { garment, color: o.top, part: 'fore' });
  const thighMat = clothMaterial(`thigh|${o.pants}`, 128, 128, paintLeg, { color: o.pants, part: 'thigh' });
  const shinMat = clothMaterial(`shin|${o.pants}`, 128, 128, paintLeg, { color: o.pants, part: 'shin' });
  const seatMat = clothMaterial(`seat|${o.pants}`, 256, 64, paintSeat, { color: o.pants });
  const vestMat = o.vest ? clothMaterial(`vest|${o.vest}`, 512, 256, paintVest, { color: o.vest }, 0.6) : null;
  const collarColor = garment === 'jacket' ? SHIRT_WHITE : garment === 'shirt' ? shade(o.top, 0.15) : o.top;

  const setLimb = (key) => (el) => {
    if (limbs && el) limbs[key] = el;
  };
  // Membres animés : marqués pour que MergeStatic fusionne leurs pièces dans leur propre repère
  const limbData = limbs ? DYNAMIC : undefined;
  const part = (geometry, material, props = {}) => <mesh geometry={geometry} material={material} castShadow receiveShadow raycast={noRaycast} {...props} />;

  const leg = (side, key) => (
    <group ref={setLimb(key)} userData={limbData} position={[side * 0.062, hipY, 0]} rotation={[seated ? -Math.PI / 2 : 0, 0, 0]}>
      {part(bodyGeometry(sex, 'thigh'), thighMat)}
      <group ref={setLimb(key === 'leftLeg' ? 'leftShin' : 'rightShin')} userData={limbData} position={[0, -0.27, 0]} rotation={[seated ? Math.PI / 2 : 0, 0, 0]}>
        {part(SPHERE, shinMat, { scale: [0.08 * body.limbs, 0.08 * body.limbs, 0.08 * body.limbs] })}
        {part(bodyGeometry(sex, 'shin'), shinMat)}
        {/* Chaussure : empeigne galbée et semelle */}
        <Ball scale={[0.084, 0.062, 0.18]} position={[0, -0.25, 0.035]} color={o.shoes} rough={0.45} />
        <Box position={[0, -0.271, 0.035]} size={[0.08, 0.016, 0.172]} color={shade(o.shoes, -0.35)} rough={0.7} />
      </group>
    </group>
  );

  const arm = (side, key) => (
    <group ref={setLimb(key)} userData={limbData} position={[side * body.armX, hipY + 0.39, 0]} rotation={[shoulder, 0, side * 0.05]}>
      {part(bodyGeometry(sex, 'upper'), upperMat)}
      <group ref={setLimb(`${key}Fore`)} userData={limbData} position={[0, -0.22, 0]} rotation={[elbow, 0, 0]}>
        {part(SPHERE, upperMat, { scale: [0.05 * body.limbs, 0.05 * body.limbs, 0.05 * body.limbs] })}
        {part(bodyGeometry(sex, 'fore'), foreMat)}
        {/* Main au poignet ; paumes vers le bas au clavier, au poste et en portant */}
        <group position={[0, -0.2, 0]}>
          <Hand side={side} color={hands} palmDown={pose === 'type' || pose === 'meet' || pose === 'work' || pose === 'carry'} scale={body.limbs} />
        </group>
        {limbs && side > 0 && (
          // Accessoires de la main droite, montrés le temps d'une action (téléphone consulté, tasse de café) ;
          // l'animation les garde à plat ou debout quel que soit l'angle du bras
          <>
            <group ref={setLimb('phone')} userData={limbData} visible={false} position={[-0.014, -0.25, 0.014]}>
              <Box size={[0.034, 0.006, 0.066]} color="#1c1f24" rough={0.35} metal={0.3} shadow={false} />
              <Box size={[0.03, 0.002, 0.058]} position={[0, 0.0035, 0]} color="#5d8fc9" glow={0.45} shadow={false} />
            </group>
            <group ref={setLimb('cup')} userData={limbData} visible={false} position={[-0.03, -0.245, 0.012]}>
              <Cylinder radius={0.021} top={1.12} height={0.05} color="#f4f1ea" rough={0.4} shadow={false} />
              <Cylinder position={[0, 0.0255, 0]} radius={0.0215} height={0.002} color="#4a2c1a" rough={0.3} shadow={false} />
            </group>
          </>
        )}
      </group>
    </group>
  );

  return (
    <group {...rest}>
      {leg(-1, 'leftLeg')}
      {leg(1, 'rightLeg')}
      {/* Bassin, ceinture et boucle, buste */}
      {part(bodyGeometry(sex, 'seat'), seatMat, { position: [0, hipY, 0] })}
      {part(bodyGeometry(sex, 'belt'), getMaterial({ color: '#2a211b', roughness: 0.5, metalness: 0.05 }), { position: [0, hipY, 0], castShadow: false })}
      <Box size={[0.026, 0.02, 0.006]} position={[0, hipY + 0.055, body.belt[0][2] + 0.003]} color="#b8ac90" metal={0.7} rough={0.35} />
      {part(bodyGeometry(sex, 'top'), torsoMat, { position: [0, hipY, 0] })}
      {vestMat && part(bodyGeometry(sex, 'vest'), vestMat, { position: [0, hipY, 0] })}
      {part(bodyGeometry(sex, 'collar'), getMaterial({ color: collarColor, roughness: 0.8, metalness: 0 }), { position: [0, hipY, 0], castShadow: false })}
      {outfit === 'welder' && <Box position={[0, hipY + 0.1, 0.1]} size={[0.22, 0.42, 0.015]} color="#7a5230" rough={0.9} />}
      {arm(-1, 'leftArm')}
      {arm(1, 'rightArm')}
      {/* Cou */}
      <Cylinder position={[0, neckY + 0.005, 0]} radius={0.026} height={0.08} color={skin} rough={0.62} />
      {/* Tête (pivot au cou : regard, hochements), ramenée à 23 cm de haut */}
      <group ref={setLimb('head')} userData={limbData} position={[0, neckY, 0]}>
        <group scale={HEAD_GROUP}>
          <mesh geometry={HEAD_GEOMETRY} material={headMaterial(lookIndex)} position={[0, HEAD_CENTER, 0]} scale={HEAD_SCALE} raycast={noRaycast} />
          {/* Nez : arête inclinée, bout arrondi, ailes et narines */}
          <Ball shape="low" scale={[0.011, 0.03, 0.012]} position={[0, 0.093, 0.0838]} rotation={[-0.3, 0, 0]} color={shade(skin, -0.02)} rough={0.6} />
          <Ball shape="low" scale={[0.017, 0.015, 0.016]} position={[0, 0.0795, 0.0902]} color={shade(skin, -0.03)} rough={0.58} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Ball shape="low" scale={[0.011, 0.011, 0.012]} position={[s * 0.0088, 0.0768, 0.0856]} color={shade(skin, -0.06)} rough={0.62} />
              <Ball shape="low" scale={[0.0045, 0.002, 0.004]} position={[s * 0.0042, 0.0733, 0.0884]} color={shade(skin, -0.38)} rough={0.9} />
            </group>
          ))}
          {/* Oreilles : pavillon, conque creusée (plus sombre), lobe */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.075, 0.09, -0.004]} rotation={[0, s * 0.25, 0]}>
              <Ball shape="low" scale={[0.016, 0.044, 0.028]} color={shade(skin, -0.05)} rough={0.7} />
              <Ball shape="low" scale={[0.004, 0.024, 0.015]} position={[s * 0.0068, 0.002, 0.002]} color={shade(skin, -0.24)} rough={0.8} />
              <Ball shape="low" scale={[0.012, 0.013, 0.012]} position={[0, -0.02, 0.004]} color={shade(skin, -0.03)} rough={0.7} />
            </group>
          ))}
          {limbs && (
            // Paupières : visibles le temps d'un clignement seulement
            <group ref={setLimb('eyes')} userData={limbData} visible={false}>
              {[-1, 1].map((s) => {
                const p = headPoint(EYE_THETA, s * EYE_SPREAD, 1.03);
                return <Ball key={s} scale={[0.023, 0.011, 0.006]} position={p} rotation={[0, Math.atan2(p[0], p[2]), 0]} color={shade(skin, -0.08)} rough={0.65} />;
              })}
            </group>
          )}
          {look.glasses && !o.mask && (
            <group position={[0, HEAD_CENTER + 0.0101, 0.087]}>
              {[-1, 1].map((s) => (
                <mesh key={s} geometry={RING} material={getMaterial({ color: '#23272f', roughness: 0.4, metalness: 0.5 })} position={[s * 0.0284, 0, 0]} raycast={noRaycast} />
              ))}
              <Box size={[0.025, 0.003, 0.003]} position={[0, 0.003, 0]} color="#23272f" metal={0.5} rough={0.4} />
              {[-1, 1].map((s) => (
                <group key={s}>
                  <Box size={[0.03, 0.0025, 0.0025]} position={[s * 0.057, 0.003, -0.004]} color="#23272f" metal={0.5} rough={0.4} />
                  <Box size={[0.0025, 0.0025, 0.07]} position={[s * 0.0745, 0.003, -0.04]} color="#23272f" metal={0.5} rough={0.4} />
                </group>
              ))}
            </group>
          )}
          {!headwear && (
            <>
              {/* Calotte des cheveux : épaisseur réelle, lisière calée sur la coupe peinte */}
              <mesh geometry={hairShell(look.hair)} material={hairShellMaterial(hair)} position={[0, HEAD_CENTER, 0]} scale={HEAD_SCALE} castShadow raycast={noRaycast} />
              {!o.cap && <HairVolume style={look.hair} color={hair} />}
            </>
          )}
          {o.cap && !headwear && (
            // Casquette de jardinier : calotte (couvre le sommet du crâne) et visière
            <group position={[0, 0.128, 0]}>
              <mesh geometry={CAP} material={getMaterial({ color: o.cap, roughness: 0.85, metalness: 0 })} scale={[0.182, 0.152, 0.194]} raycast={noRaycast} />
              <Box size={[0.115, 0.008, 0.075]} position={[0, 0.002, 0.11]} rotation={[0.12, 0, 0]} color={shade(o.cap, -0.15)} rough={0.85} />
            </group>
          )}
          {o.helmet && (
            <group position={[0, 0.125, 0]}>
              <mesh geometry={CAP} material={getMaterial({ color: o.helmet, roughness: 0.35, metalness: 0 })} scale={[0.2, 0.17, 0.21]} raycast={noRaycast} />
              <Cylinder position={[0, 0.002, 0.018]} radius={0.114} height={0.012} segments={18} color={o.helmet} rough={0.35} />
            </group>
          )}
          {o.hood && <Ball position={[0, 0.1, -0.005]} scale={[0.19, 0.22, 0.2]} color={o.hood} rough={0.9} />}
          {o.mask === 'welding' && (
            <group position={[0, 0.09, 0.075]}>
              <Box size={[0.17, 0.19, 0.05]} color="#1f2937" rough={0.5} />
              <Box position={[0, 0.02, 0.026]} size={[0.1, 0.035, 0.004]} color="#0ea5e9" glow={0.6} shadow={false} />
            </group>
          )}
          {o.mask === 'respirator' && (
            <group position={[0, 0.065, 0.082]}>
              <Box size={[0.08, 0.06, 0.04]} color="#4b5563" rough={0.6} />
              <Cylinder position={[-0.045, -0.01, 0.01]} rotation={[Math.PI / 2, 0, 0]} radius={0.022} height={0.03} color="#9f2a4f" />
              <Cylinder position={[0.045, -0.01, 0.01]} rotation={[Math.PI / 2, 0, 0]} radius={0.022} height={0.03} color="#9f2a4f" />
              <Box position={[0, 0.06, -0.005]} size={[0.15, 0.05, 0.01]} color="#bae6fd" opacity={0.6} shadow={false} />
            </group>
          )}
        </group>
      </group>
      {pose === 'carry' &&
        (outfit === 'gardener' ? (
          // Jardinier : pousse une brouette, soulevée autour de l'axe de la roue (poignées dans les mains)
          <group position={[0, 0, 0.87]}>
            <group position={[0, 0.13, 0.36]} rotation={[0.18, 0, 0]}>
              <group position={[0, -0.13, -0.36]}>
                <Wheelbarrow />
              </group>
            </group>
          </group>
        ) : (
          <Box position={[0, hipY + 0.26, 0.24]} size={[0.26, 0.2, 0.2]} color={PALETTE.carton} rough={0.85} />
        ))}
    </group>
  );
}
