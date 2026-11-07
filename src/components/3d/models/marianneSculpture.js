import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

/**
 * Buste de Marianne sculpté d'un seul tenant : la forme est décrite par une fonction de distance signée
 * (unions et soustractions adoucies d'ellipsoïdes, de capsules et de sphères), puis maillée par « marching
 * cubes » sur deux grilles (tête, bonnet et chevelure en fin ; épaules, drapé et cou plus grossièrement).
 * Pas de pièces assemblées : la surface est continue, les raccords sont fondus comme dans un plâtre.
 * Calculé une seule fois, à la première utilisation (aucun calcul à l'import).
 *
 * Repère du buste en centimètres réels : origine au milieu de la base du buste (découpe), y vers le haut,
 * z vers l'avant ; la géométrie rendue est convertie en unités de scène (1 unité ≈ 1,5 m).
 */

const CM = 1 / 150;

/* ------------------------------------------------------------------ */
/* Primitives de distance signée                                        */
/* ------------------------------------------------------------------ */

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Union adoucie (raccord de largeur k). */
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** Intersection / soustraction adoucie. */
const smax = (a, b, k) => -smin(-a, -b, k);

function sph(x, y, z, cx, cy, cz, r) {
  const dx = x - cx;
  const dy = y - cy;
  const dz = z - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}
/** Ellipsoïde (approximation usuelle k0 (k0 − 1) / k1). */
function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  const dz = (z - cz) / rz;
  const k0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ex = dx / rx;
  const ey = dy / ry;
  const ez = dz / rz;
  const k1 = Math.sqrt(ex * ex + ey * ey + ez * ez);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
}
/** Capsule effilée de A (rayon ra) à B (rayon rb). */
function taper(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const t = clamp01((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  const dx = pax - bax * t;
  const dy = pay - bay * t;
  const dz = paz - baz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
}
/** Mèche ondulée : suite de capsules effilées passant par les points donnés. */
function lock(x, y, z, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    d = smin(d, taper(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], a[3], b[3]), 0.5);
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* Tête (repère propre : origine au niveau des yeux, z vers le visage)  */
/* ------------------------------------------------------------------ */

const LOCKS = [
  // Accroche-cœurs devant les oreilles
  [[-6.5, -1.8, -2.2, 1.0], [-7.0, -4.0, -2.0, 0.8], [-6.7, -5.8, -1.7, 0.5]],
  [[6.5, -1.8, -2.2, 1.0], [7.0, -4.0, -2.0, 0.8], [6.7, -5.8, -1.7, 0.5]],
  // Mèches qui s'échappent du chignon sur la nuque
  [[-2.6, -8.0, -7.2, 1.15], [-3.3, -11.0, -7.2, 0.95], [-2.8, -14.0, -6.8, 0.75], [-3.4, -16.8, -6.2, 0.55]],
  [[2.6, -8.0, -7.2, 1.15], [3.3, -11.0, -7.2, 0.95], [2.8, -14.0, -6.8, 0.75], [3.4, -16.8, -6.2, 0.55]],
  [[0.0, -8.6, -7.6, 1.2], [0.5, -11.8, -7.7, 1.0], [-0.2, -14.8, -7.3, 0.8], [0.3, -17.4, -6.7, 0.55]],
];

function headSdf(x, y, z) {
  // Crâne, masse du visage (assez large pour un passage doux vers les tempes), menton, angles de la mâchoire,
  // pommettes discrètes, arcade sourcilière
  let d = ell(x, y, z, 0, 2.4, -1.4, 7.25, 8.7, 9.1);
  d = smin(d, ell(x, y, z, 0, -3.4, 1.6, 6.1, 7.4, 6.8), 4.0);
  d = smin(d, ell(x, y, z, 0, -9.3, 5.0, 2.5, 2.3, 2.4), 2.2);
  d = smin(d, sph(x, y, z, -4.7, -6.2, -0.6, 2.0), 3.0);
  d = smin(d, sph(x, y, z, 4.7, -6.2, -0.6, 2.0), 3.0);
  d = smin(d, ell(x, y, z, -4.2, -1.0, 4.4, 2.5, 1.7, 2.1), 3.2);
  d = smin(d, ell(x, y, z, 4.2, -1.0, 4.4, 2.5, 1.7, 2.1), 3.2);
  d = smin(d, taper(x, y, z, -4.0, 2.4, 5.9, 4.0, 2.4, 5.9, 1.0, 1.0), 2.4);
  // Oreilles (en grande partie sous les cheveux et le bonnet)
  for (const s of [-1, 1]) {
    if (s * x < 4.5 || y > 4 || y < -5 || z > 2.5 || z < -4) continue;
    let ear = ell(x, y, z, s * 7.0, -0.6, -0.7, 1.0, 2.8, 1.6);
    ear = smax(ear, -ell(x, y, z, s * 7.65, -0.7, -0.3, 0.55, 1.4, 0.8), 0.3);
    d = smin(d, ear, 0.8);
  }
  if (z > 2 && x > -7.5 && x < 7.5 && y > -12.5 && y < 5) {
    for (const s of [-1, 1]) {
      // Orbite peu profonde, globe de l'œil, paupière supérieure en bourrelet, paupière inférieure fine
      d = smax(d, -ell(x, y, z, s * 3.05, 0.25, 7.25, 1.75, 1.1, 1.15), 0.9);
      d = smin(d, sph(x, y, z, s * 3.05, 0.05, 5.75, 1.2), 0.2);
      d = smin(d, ell(x, y, z, s * 3.05, 0.52, 6.35, 1.65, 0.58, 0.88), 0.3);
      d = smin(d, ell(x, y, z, s * 3.1, -0.62, 6.2, 1.35, 0.32, 0.7), 0.25);
    }
    // Nez droit (dans le prolongement du front), bout arrondi, ailes, narines
    d = smin(d, taper(x, y, z, 0, 1.8, 7.4, 0, -3.3, 9.45, 0.78, 0.95), 0.9);
    d = smin(d, sph(x, y, z, 0, -3.55, 9.25, 1.1), 0.6);
    d = smin(d, ell(x, y, z, -1.25, -4.0, 8.05, 0.95, 0.75, 0.95), 0.5);
    d = smin(d, ell(x, y, z, 1.25, -4.0, 8.05, 0.95, 0.75, 0.95), 0.5);
    d = smax(d, -ell(x, y, z, -0.62, -4.55, 8.6, 0.36, 0.26, 0.55), 0.2);
    d = smax(d, -ell(x, y, z, 0.62, -4.55, 8.6, 0.36, 0.26, 0.55), 0.2);
    // Lèvres : lèvre supérieure en arc de Cupidon, lèvre inférieure pleine, fente, commissures,
    // philtrum, sillon sous la lèvre
    d = smin(d, ell(x, y, z, -0.5, -5.84, 7.98, 1.05, 0.56, 1.05), 0.45);
    d = smin(d, ell(x, y, z, 0.5, -5.84, 7.98, 1.05, 0.56, 1.05), 0.45);
    d = smin(d, ell(x, y, z, 0, -6.92, 7.82, 1.42, 0.74, 1.12), 0.55);
    d = smax(d, -ell(x, y, z, 0, -6.36, 8.75, 1.75, 0.09, 1.1), 0.12);
    d = smax(d, -sph(x, y, z, -1.85, -6.33, 7.6, 0.3), 0.25);
    d = smax(d, -sph(x, y, z, 1.85, -6.33, 7.6, 0.3), 0.25);
    d = smax(d, -taper(x, y, z, 0, -4.85, 8.75, 0, -5.35, 8.9, 0.16, 0.16), 0.2);
    d = smax(d, -ell(x, y, z, 0, -8.05, 8.4, 1.8, 0.45, 0.65), 0.5);
  }

  // Chevelure ondulée sous le bonnet (tempes, oreilles), relevée en chignon sur la nuque, jamais sur le visage
  let hair = ell(x, y, z, 0, 1.2, -2.2, 8.15, 9.2, 9.75);
  hair += 0.3 * Math.sin(Math.atan2(x, z) * 11 + y * 0.55);
  hair = smax(hair, Math.min(z - 4.6, 3.0 - y), 0.9);
  hair = smax(hair, -6.5 - y, 1.0);
  if (z < 0 && y < 0) {
    const nape = ell(x, y, z, 0, -6.4, -6.5, 5.4, 3.4, 3.2) + 0.25 * Math.sin(Math.atan2(x, -z) * 14 + y * 0.9);
    hair = smin(hair, nape, 1.2);
  }
  d = smin(d, hair, 0.6);
  if (y < -1 && z < 1) {
    for (const pts of LOCKS) {
      const a = pts[0];
      const b = pts[pts.length - 1];
      if (x < Math.min(a[0], b[0]) - 3 || x > Math.max(a[0], b[0]) + 3 || z < Math.min(a[2], b[2]) - 3.5 || z > Math.max(a[2], b[2]) + 3.5 || y > a[1] + 3) continue;
      d = smin(d, lock(x, y, z, pts), 0.6);
    }
  }

  // Bonnet phrygien : calotte (lisière plus haute sur le front qu'à la nuque), bourrelet, pointe souple qui
  // monte du sommet et retombe vers l'avant au-dessus du front, plis ; cocarde plissée sur le côté
  const rim = 1.2 + 0.36 * z;
  let cap = ell(x, y, z, 0, 3.2, -1.9, 8.75, 9.75, 10.45);
  cap = smax(cap, rim - y, 0.5);
  const band = smax(ell(x, y, z, 0, 3.2, -1.9, 9.15, 10.1, 10.85), Math.abs(y - rim - 0.8) - 0.8, 0.4);
  cap = smin(cap, band, 0.4);
  if (y > 2) {
    let tip = sph(x, y, z, 0, 9.0, -3.0, 6.8);
    tip = smin(tip, sph(x, y, z, 0.3, 12.6, -1.6, 5.3), 2.6);
    tip = smin(tip, sph(x, y, z, 0.7, 14.6, 1.4, 4.0), 2.3);
    tip = smin(tip, sph(x, y, z, 1.0, 14.3, 4.8, 3.0), 2.0);
    tip = smin(tip, sph(x, y, z, 1.2, 12.8, 7.6, 2.2), 1.6);
    tip = smin(tip, sph(x, y, z, 1.3, 10.9, 9.4, 1.5), 1.2);
    tip += 0.22 * Math.sin(Math.atan2(x - 0.5, z + 1.5) * 9 + y * 0.35) * smoothstep(7, 11, y);
    cap = smin(cap, tip, 1.8);
  }
  if (x < -6) {
    const r = Math.hypot(y - 4.8, z - 1.2);
    let cockade = ell(x, y, z, -9.1, 4.8, 1.2, 0.8, 2.3, 2.3) + 0.12 * Math.abs(Math.sin(Math.atan2(y - 4.8, z - 1.2) * 8)) * smoothstep(0.9, 2.1, r);
    cockade = smin(cockade, ell(x, y, z, -9.7, 4.8, 1.2, 0.55, 1.25, 1.25), 0.3);
    cockade = smin(cockade, sph(x, y, z, -10.0, 4.8, 1.2, 0.6), 0.3);
    cap = smin(cap, cockade, 0.35);
  }
  return smin(d, cap, 0.45);
}

/* ------------------------------------------------------------------ */
/* Buste (repère du buste)                                              */
/* ------------------------------------------------------------------ */

// Tête tournée de trois quarts, menton légèrement relevé, pivot au sommet du cou
const NECK_TOP = [0, 43, 0.6];
const HEAD_OFFSET = [0, 9, 2.5]; // du sommet du cou à l'origine du repère de la tête (non tourné)
const YAW = 0.3;
const PITCH = -0.08;
const cy = Math.cos(-YAW);
const sy = Math.sin(-YAW);
const cp = Math.cos(-PITCH);
const sp = Math.sin(-PITCH);
const HEAD_CENTER = [0, 52, 3]; // centre approximatif (tests de proximité)

function torsoSdf(x, y, z) {
  // Haut du cou : seuls le cou et les sterno-cléido-mastoïdiens comptent
  if (y > 34) {
    let n = taper(x, y, z, 0, 25, -0.8, NECK_TOP[0], NECK_TOP[1], NECK_TOP[2], 5.5, 4.6);
    if (z > -3) {
      n = smin(n, taper(x, y, z, -4.3, 40, -1.0, -1.4, 27.6, 4.4, 1.15, 1.0), 1.4);
      n = smin(n, taper(x, y, z, 4.3, 40, -1.0, 1.4, 27.6, 4.4, 1.15, 1.0), 1.4);
    }
    return n;
  }
  // Cage thoracique, trapèzes vers les épaules, deltoïdes, haut des bras, poitrine
  let d = ell(x, y, z, 0, 12.5, -0.5, 14.0, 15.5, 9.6);
  d = smin(d, taper(x, y, z, -5.5, 26.0, -1.4, -15.0, 23.4, -1.0, 5.0, 5.0), 4.0);
  d = smin(d, taper(x, y, z, 5.5, 26.0, -1.4, 15.0, 23.4, -1.0, 5.0, 5.0), 4.0);
  d = smin(d, sph(x, y, z, -16.2, 20.4, 0.0, 5.2), 3.0);
  d = smin(d, sph(x, y, z, 16.2, 20.4, 0.0, 5.2), 3.0);
  d = smin(d, taper(x, y, z, -17.0, 20.0, 0.2, -18.0, 4.0, 0.0, 4.9, 4.4), 2.5);
  d = smin(d, taper(x, y, z, 17.0, 20.0, 0.2, 18.0, 4.0, 0.0, 4.9, 4.4), 2.5);
  d = smin(d, ell(x, y, z, -5.6, 13.4, 6.2, 5.3, 4.9, 4.3), 3.5);
  d = smin(d, ell(x, y, z, 5.6, 13.4, 6.2, 5.3, 4.9, 4.3), 3.5);
  // Cou, sterno-cléido-mastoïdiens, clavicules, fourchette sternale
  d = smin(d, taper(x, y, z, 0, 25, -0.8, NECK_TOP[0], NECK_TOP[1], NECK_TOP[2], 5.5, 4.6), 4.5);
  if (y > 22 && z > -3 && Math.abs(x) < 15) {
    d = smin(d, taper(x, y, z, -4.3, 40, -1.0, -1.4, 27.6, 4.4, 1.15, 1.0), 1.4);
    d = smin(d, taper(x, y, z, 4.3, 40, -1.0, 1.4, 27.6, 4.4, 1.15, 1.0), 1.4);
    d = smin(d, taper(x, y, z, -2.0, 26.3, 5.3, -12.5, 27.4, 2.4, 0.75, 0.7), 1.6);
    d = smin(d, taper(x, y, z, 2.0, 26.3, 5.3, 12.5, 27.4, 2.4, 0.75, 0.7), 1.6);
    d = smax(d, -sph(x, y, z, 0, 27.6, 6.0, 1.5), 1.0);
  }
  // Découpe du buste : base arrondie qui remonte sur les côtés, bras tranchés
  // (distance divisée par la pente de la courbe de découpe : sinon un bloc proche paraîtrait loin → trou)
  return smax(d, (1.5 + 0.03 * x * x - y) / Math.sqrt(1 + 0.0036 * x * x), 1.2);
}

/** Péplum : tissu de 0,7 cm sur le corps, plis rayonnant depuis la fibule (épaule gauche), encolure en biais. */
function drapeSdf(x, y, z, body) {
  if (body > 3) return body;
  const fx = -12.6;
  const fy = 24.2;
  const r = Math.hypot(x - fx, y - fy);
  const folds = 0.34 * Math.sin(Math.atan2(y - fy, x - fx) * 10 + r * 0.22) * smoothstep(3.5, 10, r);
  // Encolure : de l'épaule gauche (couverte) au-dessus du sein droit, épaule droite nue
  const neckline = x < -9 ? 27.5 + (-9 - x) * 0.9 : 27.5 - 0.45 * (x + 9);
  const edge = y - neckline;
  let cloth = body - 0.7 - folds - 0.35 * Math.exp(-(edge * edge) / 0.6);
  cloth = smax(cloth, edge, 0.5);
  return Math.min(body, cloth);
}

/** Fibule ronde sur l'épaule gauche : disque, anneau et bouton. */
function fibulaSdf(x, y, z) {
  const cx = -12.6;
  const cyy = 24.2;
  const cz = 4.9;
  if (Math.abs(x - cx) > 3 || Math.abs(y - cyy) > 3 || Math.abs(z - cz) > 3) return 3;
  let d = ell(x, y, z, cx, cyy, cz, 1.7, 1.7, 0.6);
  const q = Math.hypot(x - cx, y - cyy) - 1.45;
  d = smin(d, Math.hypot(q, z - cz - 0.35) - 0.3, 0.2);
  return smin(d, sph(x, y, z, cx, cyy, cz + 0.45, 0.65), 0.25);
}

function bustSdf(x, y, z) {
  let d = 50;
  if (y < 47) {
    d = drapeSdf(x, y, z, torsoSdf(x, y, z));
    d = smin(d, fibulaSdf(x, y, z), 0.3);
  }
  // Tête (repère tourné autour du sommet du cou)
  const hx0 = x - HEAD_CENTER[0];
  const hy0 = y - HEAD_CENTER[1];
  const hz0 = z - HEAD_CENTER[2];
  const far = Math.sqrt(hx0 * hx0 + hy0 * hy0 + hz0 * hz0) - 24;
  if (far > 2) return Math.min(d, far);
  const qx = x - NECK_TOP[0];
  const qy = y - NECK_TOP[1];
  const qz = z - NECK_TOP[2];
  // Ry(−yaw) puis Rx(−pitch)
  const rx = qx * cy + qz * sy;
  const rz = -qx * sy + qz * cy;
  const ry = qy * cp - rz * sp;
  const rz2 = qy * sp + rz * cp;
  const h = headSdf(rx - HEAD_OFFSET[0], ry - HEAD_OFFSET[1], rz2 - HEAD_OFFSET[2]);
  return smin(d, h, 2.0);
}

/* ------------------------------------------------------------------ */
/* Maillage : marching cubes sur grille rectangulaire, grossier puis fin */
/* ------------------------------------------------------------------ */

const CORNERS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
];
const EDGES = [
  [0, 1],
  [1, 2],
  [3, 2],
  [0, 3],
  [4, 5],
  [5, 6],
  [7, 6],
  [4, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

/**
 * Maille la surface sdf = 0 dans la boîte [min, max] (cm) au pas h, en ajoutant sommets (unités de scène) et
 * triangles aux tableaux donnés. Les blocs de B³ cellules dont un coin est loin de la surface ne sont pas
 * évalués finement (le champ y garde le signe de la grille grossière).
 */
function polygonize(sdf, min, max, h, positions, indices) {
  const B = 2;
  const nx = Math.ceil((max[0] - min[0]) / h / B) * B;
  const ny = Math.ceil((max[1] - min[1]) / h / B) * B;
  const nz = Math.ceil((max[2] - min[2]) / h / B) * B;
  const sx = nx + 1;
  const sxy = sx * (ny + 1);
  const field = new Float32Array(sxy * (nz + 1));
  // Grille grossière : un nœud tous les B pas
  const bx = nx / B;
  const by = ny / B;
  const bz = nz / B;
  const coarse = new Float32Array((bx + 1) * (by + 1) * (bz + 1));
  const ci = (i, j, k) => i + (bx + 1) * (j + (by + 1) * k);
  for (let k = 0; k <= bz; k += 1) {
    for (let j = 0; j <= by; j += 1) {
      for (let i = 0; i <= bx; i += 1) coarse[ci(i, j, k)] = sdf(min[0] + i * B * h, min[1] + j * B * h, min[2] + k * B * h);
    }
  }
  // Blocs à détailler : si la surface traverse un bloc, chaque coin en est à moins d'une diagonale ; un seul
  // coin plus loin (avec une marge pour les ondulations, qui allongent un peu les distances) suffit à l'exclure
  const margin = 1.25 * B * h * Math.sqrt(3);
  const marked = new Uint8Array(bx * by * bz);
  const evaluated = new Uint8Array(field.length);
  for (let k = 0; k < bz; k += 1) {
    for (let j = 0; j < by; j += 1) {
      for (let i = 0; i < bx; i += 1) {
        let near = true;
        for (let c = 0; c < 8 && near; c += 1) {
          const v = coarse[ci(i + CORNERS[c][0], j + CORNERS[c][1], k + CORNERS[c][2])];
          if (Math.abs(v) > margin) near = false;
        }
        if (!near) continue;
        marked[i + bx * (j + by * k)] = 1;
        for (let kk = 0; kk <= B; kk += 1) {
          for (let jj = 0; jj <= B; jj += 1) {
            for (let ii = 0; ii <= B; ii += 1) {
              const gi = i * B + ii;
              const gj = j * B + jj;
              const gk = k * B + kk;
              const n = gi + sx * gj + sxy * gk;
              if (evaluated[n]) continue;
              evaluated[n] = 1;
              field[n] = sdf(min[0] + gi * h, min[1] + gj * h, min[2] + gk * h);
            }
          }
        }
      }
    }
  }
  // Nœuds non évalués : signe du coin grossier le plus proche (aucune surface dans leur bloc)
  for (let gk = 0; gk <= nz; gk += 1) {
    for (let gj = 0; gj <= ny; gj += 1) {
      for (let gi = 0; gi <= nx; gi += 1) {
        const n = gi + sx * gj + sxy * gk;
        if (!evaluated[n]) field[n] = coarse[ci(Math.round(gi / B), Math.round(gj / B), Math.round(gk / B))];
      }
    }
  }
  // Marching cubes dans les blocs détaillés ; sommets partagés par arête (maillage indexé)
  const edgeVertex = new Map();
  const vertexOn = (gi, gj, gk, axis, va, vb) => {
    const key = (gi + sx * gj + sxy * gk) * 3 + axis;
    let id = edgeVertex.get(key);
    if (id === undefined) {
      const t = va / (va - vb);
      const p = [min[0] + gi * h, min[1] + gj * h, min[2] + gk * h];
      p[axis] += t * h;
      id = positions.length / 3;
      positions.push(p[0] * CM, p[1] * CM, p[2] * CM);
      edgeVertex.set(key, id);
    }
    return id;
  };
  const vals = new Float32Array(8);
  const ids = new Int32Array(12);
  for (let k = 0; k < bz; k += 1) {
    for (let j = 0; j < by; j += 1) {
      for (let i = 0; i < bx; i += 1) {
        if (!marked[i + bx * (j + by * k)]) continue;
        for (let kk = 0; kk < B; kk += 1) {
          for (let jj = 0; jj < B; jj += 1) {
            for (let ii = 0; ii < B; ii += 1) {
              const gi = i * B + ii;
              const gj = j * B + jj;
              const gk = k * B + kk;
              let cube = 0;
              for (let c = 0; c < 8; c += 1) {
                const v = field[gi + CORNERS[c][0] + sx * (gj + CORNERS[c][1]) + sxy * (gk + CORNERS[c][2])];
                vals[c] = v;
                // Convention des tables (valeur basse = extérieur) : coin marqué s'il est hors de la matière
                if (v > 0) cube |= 1 << c;
              }
              const bits = edgeTable[cube];
              if (!bits) continue;
              for (let e = 0; e < 12; e += 1) {
                if (!(bits & (1 << e))) continue;
                const [a, b] = EDGES[e];
                const ca = CORNERS[a];
                const cb = CORNERS[b];
                const axis = ca[0] !== cb[0] ? 0 : ca[1] !== cb[1] ? 1 : 2;
                ids[e] = vertexOn(gi + ca[0], gj + ca[1], gk + ca[2], axis, vals[a], vals[b]);
              }
              const base = cube * 16;
              for (let t = 0; triTable[base + t] !== -1; t += 3) {
                indices.push(ids[triTable[base + t]], ids[triTable[base + t + 1]], ids[triTable[base + t + 2]]);
              }
            }
          }
        }
      }
    }
  }
}

let cached = null;
/**
 * Géométrie du buste (unités de scène, origine au milieu de la base du buste), calculée à la première
 * demande : tête, bonnet et chevelure au pas de 3,5 mm au-dessus du cou, buste et drapé au pas de 5,5 mm.
 */
export function marianneGeometry() {
  if (cached) return cached;
  const positions = [];
  const indices = [];
  const SPLIT = 37.5; // limite entre les deux grilles, au milieu du cou
  // Buste : la tranche haute est rognée (le cou y est légèrement aminci pour passer sous la grille fine)
  polygonize((x, y, z) => Math.max(bustSdf(x, y, z) + 0.06, y - SPLIT - 0.4), [-25, -0.5, -13], [25, SPLIT + 0.6, 14], 0.55, positions, indices);
  polygonize((x, y, z) => Math.max(bustSdf(x, y, z), SPLIT - y), [-13.5, SPLIT - 0.4, -14], [13.5, 71, 15.5], 0.35, positions, indices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // Au raccord des deux grilles (milieu du cou), normales prises sur la forme elle-même : pas de liseré
  const normal = geometry.attributes.normal;
  const e = 0.05;
  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3] / CM;
    const y = positions[i * 3 + 1] / CM;
    const z = positions[i * 3 + 2] / CM;
    if (Math.abs(y - SPLIT) > 1.2) continue;
    const gx = bustSdf(x + e, y, z) - bustSdf(x - e, y, z);
    const gy = bustSdf(x, y + e, z) - bustSdf(x, y - e, z);
    const gz = bustSdf(x, y, z + e) - bustSdf(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    normal.setXYZ(i, gx / l, gy / l, gz / l);
  }
  geometry.computeBoundingSphere();
  cached = geometry;
  return geometry;
}
