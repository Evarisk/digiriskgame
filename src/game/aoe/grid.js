/**
 * Grille de déplacement (cases de 1 unité) : cases bloquées par les bâtiments et les arbres, recherche de chemin A*
 * à 8 voisins puis lissage en ligne droite. Aucune dépendance : exécutable sous Node.
 */
import { MAP_HALF } from './config.js';

export const GRID = MAP_HALF * 2;

export const cellOf = (x, z) => [Math.max(0, Math.min(GRID - 1, Math.floor(x + MAP_HALF))), Math.max(0, Math.min(GRID - 1, Math.floor(z + MAP_HALF)))];
export const centerOf = (cx, cz) => [cx - MAP_HALF + 0.5, cz - MAP_HALF + 0.5];

export function createGrid() {
  return new Uint8Array(GRID * GRID);
}

/** Bloque (ou libère) un rectangle aligné [x0, z0, x1, z1] en coordonnées de scène. */
export function markRect(grid, rect, value = 1) {
  const [ax, az] = cellOf(rect[0], rect[1]);
  const [bx, bz] = cellOf(rect[2] - 0.001, rect[3] - 0.001);
  for (let z = az; z <= bz; z += 1) for (let x = ax; x <= bx; x += 1) grid[z * GRID + x] = value;
}

export const blocked = (grid, cx, cz) => cx < 0 || cz < 0 || cx >= GRID || cz >= GRID || grid[cz * GRID + cx] === 1;

/** Case libre la plus proche d'un point (recherche en anneaux). */
export function nearestFree(grid, x, z, maxRing = 12) {
  const [cx, cz] = cellOf(x, z);
  if (!blocked(grid, cx, cz)) return [cx, cz];
  for (let r = 1; r <= maxRing; r += 1) {
    let best = null;
    let bestD = Infinity;
    for (let dz = -r; dz <= r; dz += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (blocked(grid, nx, nz)) continue;
        const [wx, wz] = centerOf(nx, nz);
        const d = (wx - x) ** 2 + (wz - z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = [nx, nz];
        }
      }
    }
    if (best) return best;
  }
  return null;
}

/** Ligne de vue entre deux points sur la grille (pas de demi-case). */
function clearLine(grid, ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d * 2);
  for (let i = 1; i < n; i += 1) {
    const t = i / n;
    const [cx, cz] = cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
    if (blocked(grid, cx, cz)) return false;
  }
  return true;
}

/** Tas binaire minimal (file de priorité de l'A*). */
class Heap {
  constructor() {
    this.items = [];
  }
  push(node, f) {
    const a = this.items;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
  get size() {
    return this.items.length;
  }
}

const DIRS = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Chemin de (fx, fz) vers (tx, tz) : liste de points de passage en coordonnées de scène (le dernier = destination
 * ajustée sur une case libre), ou null. Les diagonales ne coupent pas les angles des obstacles.
 */
export function findPath(grid, fx, fz, tx, tz, maxNodes = 24000) {
  const start = nearestFree(grid, fx, fz, 4);
  const goal = nearestFree(grid, tx, tz, 14);
  if (!start || !goal) return null;
  const [gx, gz] = goal;
  const end = blocked(grid, ...cellOf(tx, tz)) ? centerOf(gx, gz) : [tx, tz];
  if (clearLine(grid, fx, fz, end[0], end[1])) return [end];
  const key = (x, z) => z * GRID + x;
  const g = new Map();
  const came = new Map();
  const closed = new Set();
  const heap = new Heap();
  const h = (x, z) => {
    const dx = Math.abs(x - gx);
    const dz = Math.abs(z - gz);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  const sk = key(start[0], start[1]);
  g.set(sk, 0);
  heap.push(sk, h(start[0], start[1]));
  let found = false;
  let expanded = 0;
  while (heap.size) {
    const k = heap.pop();
    if (closed.has(k)) continue;
    closed.add(k);
    const x = k % GRID;
    const z = (k - x) / GRID;
    if (x === gx && z === gz) {
      found = true;
      break;
    }
    expanded += 1;
    if (expanded > maxNodes) break;
    for (const [dx, dz, cost] of DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (blocked(grid, nx, nz)) continue;
      if (dx && dz && (blocked(grid, x + dx, z) || blocked(grid, x, z + dz))) continue;
      const nk = key(nx, nz);
      if (closed.has(nk)) continue;
      const ng = g.get(k) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, k);
        heap.push(nk, ng + h(nx, nz));
      }
    }
  }
  if (!found) return null;
  // Reconstruction puis lissage (on saute les points visibles en ligne droite)
  const cells = [];
  for (let k = key(gx, gz); k !== undefined; k = came.get(k)) {
    const x = k % GRID;
    cells.push(centerOf(x, (k - x) / GRID));
    if (k === sk) break;
  }
  cells.reverse();
  cells[cells.length - 1] = end;
  const out = [];
  let from = [fx, fz];
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(grid, from[0], from[1], cells[j][0], cells[j][1])) j -= 1;
    out.push(cells[j]);
    from = cells[j];
    i = j + 1;
  }
  return out;
}
