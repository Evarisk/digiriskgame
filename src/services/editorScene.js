import {
  ELEMENT_KINDS,
  NPC_OUTFITS,
  NPC_POSES,
  NPC_ROUTE_MODES,
  RISK_LEVELS,
  PREFAB_SKINS,
  PREFAB_DEFAULT_SIZE,
  PREFAB_SIZE_RANGE,
  BUILDING_STYLES,
  FLOOR_STYLES,
  WALL_TYPES,
  DOOR_KINDS,
  SURFACE_MATERIALS,
  defaultParams,
} from './editorCatalog';
import { shellFinish } from './skins';

/**
 * Scène de l'éditeur de site (/edit) : modèle de données, géométrie, opérations et format JSON.
 *
 * Toutes les coordonnées sont des positions au sol [x, z] du monde, en unités de scène
 * (1 unité ≈ 1,5 m, comme le jumeau) ; les rotations sont en degrés autour de l'axe vertical.
 * Le JSON exporté est exactement l'état de l'éditeur :
 * - buildings : bâtiments personnalisés (contour polygonal, façades, portes) ;
 * - prefabs : bâtiments modèles du jumeau (bureaux, usine, peinture, entrepôt), position + rotation ;
 * - walls : murs intérieurs, cloisons, grillages (segments, avec porte éventuelle) ;
 * - surfaces : sols extérieurs (enrobé, pavés...) ; walkways : allées piétonnes ;
 * - elements : postes de travail, mobilier, équipements, véhicules, décor ;
 * - npcs : personnages, immobiles ou suivant un trajet.
 * Le contenu d'un bâtiment (murs, éléments, PNJ dont la position est dans son emprise) le suit
 * quand on le déplace ou le tourne.
 */

export const SCENE_FORMAT = 'digiriskgame-site';
export const SCENE_VERSION = 1;
export const UNIT_METERS = 1.5;
/** Dessus de dalle des bâtiments (le contenu d'un bâtiment est posé dessus). */
export const FLOOR_Y = 0.16;

export const LISTS = ['buildings', 'prefabs', 'surfaces', 'walkways', 'walls', 'elements', 'npcs'];
export const LIST_LABELS = {
  buildings: 'Bâtiments',
  prefabs: 'Bâtiments modèles',
  surfaces: 'Sols',
  walkways: 'Allées piétonnes',
  walls: 'Murs & cloisons',
  elements: 'Éléments',
  npcs: 'Personnages',
};

export const toMeters = (u) => Math.round(u * UNIT_METERS * 100) / 100;
export const fromMeters = (m) => m / UNIT_METERS;

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ------------------------------------------------------------------ */
/* Géométrie au sol                                                     */
/* ------------------------------------------------------------------ */

export const snapValue = (v, step) => (step ? Math.round(v / step) * step : v);
export const snapPoint = ([x, z], step) => [snapValue(x, step), snapValue(z, step)];
const round3 = (v) => Math.round(v * 1000) / 1000;
const roundPoint = ([x, z]) => [round3(x), round3(z)];

export function pointInPolygon([x, z], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(polygon) {
  let a = 0;
  polygon.forEach(([x1, z1], i) => {
    const [x2, z2] = polygon[(i + 1) % polygon.length];
    a += x1 * z2 - x2 * z1;
  });
  return a / 2;
}

/** Centre de gravité de la surface (repli sur la moyenne des sommets si le contour est dégénéré). */
export function polygonCentroid(polygon) {
  const area = polygonArea(polygon);
  if (Math.abs(area) < 1e-6) {
    const n = polygon.length || 1;
    return [polygon.reduce((s, p) => s + p[0], 0) / n, polygon.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cz = 0;
  polygon.forEach(([x1, z1], i) => {
    const [x2, z2] = polygon[(i + 1) % polygon.length];
    const f = x1 * z2 - x2 * z1;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  });
  return [cx / (6 * area), cz / (6 * area)];
}

/** Rotation d'un point au sol de `deg` degrés autour de `pivot`, dans le même sens que rotation.y. */
export function rotatePoint([x, z], deg, [px, pz]) {
  const a = (deg * Math.PI) / 180;
  const dx = x - px;
  const dz = z - pz;
  return [px + dx * Math.cos(a) + dz * Math.sin(a), pz - dx * Math.sin(a) + dz * Math.cos(a)];
}

/** Point du segment [a, b] le plus proche de p, et sa position relative t (0 en a, 1 en b). */
export function projectOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
  const q = [a[0] + dx * t, a[1] + dz * t];
  return { point: q, t, dist: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}

export const segmentLength = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Arêtes d'un contour fermé : [[a, b], ...]. */
export const polygonEdges = (polygon) => polygon.map((p, i) => [p, polygon[(i + 1) % polygon.length]]);

/** Coins de l'emprise rectangulaire d'un objet posé (bâtiment modèle, élément). */
export function rectCorners([x, z], [w, d], rotation = 0, [cx, cz] = [0, 0]) {
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([lx, lz]) => rotatePoint([x + cx + lx, z + cz + lz], rotation, [x, z]));
}

/**
 * Découpe d'un mur de longueur `length` par ses ouvertures (portes) : pleins et ouvertures,
 * en abscisses le long du mur. `doors` : [{ t (0..1, centre), width, kind }].
 */
export function wallSpans(length, doors = []) {
  const openings = doors
    .map((door) => {
      const width = Math.min(door.width, Math.max(0, length - 0.2));
      const center = Math.max(width / 2 + 0.05, Math.min(length - width / 2 - 0.05, door.t * length));
      return { from: center - width / 2, to: center + width / 2, door };
    })
    .filter((o) => o.to - o.from > 0.05)
    .sort((a, b) => a.from - b.from);
  const solids = [];
  let cursor = 0;
  openings.forEach((o) => {
    if (o.from > cursor + 0.01) solids.push({ from: cursor, to: o.from });
    cursor = Math.max(cursor, o.to);
  });
  if (cursor < length - 0.01) solids.push({ from: cursor, to: length });
  return { solids, openings };
}

/** Emprise au sol d'un bâtiment (personnalisé ou modèle). */
export function footprintOf(list, item) {
  if (list === 'buildings' || list === 'surfaces') return item.polygon;
  if (list === 'prefabs') return rectCorners(item.position, [item.width, item.depth], item.rotation);
  return null;
}

/** Hauteur du sol en (x, z) : dessus de dalle dans un bâtiment, 0 dehors. */
export function groundHeightAt(scene, x, z) {
  const p = [x, z];
  if (scene.buildings.some((b) => pointInPolygon(p, b.polygon))) return FLOOR_Y;
  if (scene.prefabs.some((b) => pointInPolygon(p, footprintOf('prefabs', b)))) return FLOOR_Y;
  return 0;
}

/* ------------------------------------------------------------------ */
/* Étages                                                               */
/* ------------------------------------------------------------------ */

/**
 * Niveaux : un bâtiment sur mesure a `levels` niveaux (rez-de-chaussée compris) de LEVEL_HEIGHT chacun ;
 * murs, allées, éléments et personnages portent leur `level` (0 = rez-de-chaussée, absent = 0) et sont posés
 * sur le plancher de ce niveau. Un escalier monte d'un niveau ; la trémie est découpée dans le plancher
 * d'arrivée. Les scènes sans étage restent identiques (aucun champ ajouté au JSON).
 */
export const LEVEL_HEIGHT = 2.5; // ≈ 3,75 m de plancher à plancher, comme les fenêtres de façade
export const MAX_LEVELS = 6;
/** Épaisseur des planchers d'étage (sous le dessus du sol du niveau). */
export const STOREY_SLAB = 0.2;

export const levelOf = (item) => (item && item.level) || 0;
export const levelOffset = (level) => (level || 0) * LEVEL_HEIGHT;
export const buildingLevels = (building) => Math.max(1, Math.min(MAX_LEVELS, Math.round(building.levels || 1)));

/** « Rez-de-chaussée », « 1er étage », « 2e étage »… (court : « RDC », « 1er », « 2e »). */
export function levelLabel(level, short = false) {
  if (!level) return short ? 'RDC' : 'Rez-de-chaussée';
  return `${level}${level === 1 ? 'er' : 'e'}${short ? '' : ' étage'}`;
}

/** Nombre de niveaux de la scène (au moins 1) : bâtiments à étages et objets posés en étage. */
export function sceneLevels(scene) {
  let n = 1;
  scene.buildings.forEach((b) => {
    n = Math.max(n, buildingLevels(b));
  });
  ['walls', 'walkways', 'elements', 'npcs'].forEach((list) =>
    scene[list].forEach((item) => {
      n = Math.max(n, levelOf(item) + 1);
    })
  );
  return Math.min(MAX_LEVELS, n);
}

/** Hauteur du sol du niveau `level` en (x, z). */
export function floorHeightAt(scene, x, z, level = 0) {
  return groundHeightAt(scene, x, z) + levelOffset(level);
}

/**
 * Hauteur libre au niveau `level` en (x, z) : sous le plancher de l'étage supérieur (cloisons noyées dans
 * le plancher, rien ne dépasse au-dessus) ou sous le toit au dernier niveau ; Infinity hors des bâtiments.
 */
export function storeyHeightAt(scene, [x, z], level = 0) {
  const building = scene.buildings.find((b) => pointInPolygon([x, z], b.polygon));
  if (!building) return Infinity;
  if (level < buildingLevels(building) - 1) return LEVEL_HEIGHT - 0.1;
  return Math.max(0.3, building.height - levelOffset(level) - 0.04);
}

/**
 * Volées d'escalier de la scène : chacune monte d'un niveau, de l'avant (+Z local, première marche) vers
 * l'arrière (−Z local, arrivée à l'étage). `base` : hauteur de la première marche.
 */
export function stairFlights(scene) {
  return scene.elements
    .filter((el) => ELEMENT_KINDS[el.kind]?.stairs)
    .map((el) => {
      const { width, length } = { ...defaultParams(el.kind), ...el.params };
      const level = levelOf(el);
      return { id: el.id, position: el.position, rotation: el.rotation, width, length, level, base: floorHeightAt(scene, el.position[0], el.position[1], level) };
    });
}

/** Trémie d'une volée (ouverture du plancher d'arrivée) : son emprise élargie de 2 cm de chaque côté. */
export const stairOpening = (flight) => rectCorners(flight.position, [flight.width + 0.04, flight.length + 0.04], flight.rotation);

/** Coordonnées d'un point dans le repère local d'une volée (origine au centre, X en travers, Z le long). */
export function stairLocal(flight, p) {
  const q = rotatePoint(p, -flight.rotation, flight.position);
  return [q[0] - flight.position[0], q[1] - flight.position[1]];
}

/**
 * Hauteur de la volée sous le point p (pente continue de la première marche à l'étage), null en dehors ;
 * `margin` élargit l'emprise (au-delà des extrémités, la hauteur reste celle du départ ou de l'arrivée).
 */
export function stairHeightAt(flight, p, margin = 0) {
  const [lx, lz] = stairLocal(flight, p);
  if (Math.abs(lx) > flight.width / 2 + margin || Math.abs(lz) > flight.length / 2 + margin) return null;
  return flight.base + LEVEL_HEIGHT * Math.min(1, Math.max(0, (flight.length / 2 - lz) / flight.length));
}

/* ------------------------------------------------------------------ */
/* Fenêtres de façade : percements des murs                             */
/* ------------------------------------------------------------------ */

/** Baie d'une fenêtre de façade (modèle FacadeWindows) : vitrage de 0,72 de large tous les 1,8, appui à 0,55. */
const FACADE_WINDOW = { spacing: 1.8, width: 0.72, sill: 0.55 };

/**
 * Percements des façades derrière les fenêtres posées contre un bâtiment (élément « Fenêtres de façade »
 * parallèle à une façade, du côté extérieur, à moins d'un demi-mur + 0,45) : on voit au travers. Résultat :
 * { [id du bâtiment]: { 'arête:niveau': [{ kind: 'window', t, width, sill, head }] } }, appui et linteau en
 * hauteur absolue. Les percements n'ouvrent pas de passage dans la visite (seules les portes en ouvrent).
 */
export function windowOpeningsByBuilding(scene) {
  const out = {};
  const rows = scene.elements.filter((el) => el.kind === 'facade_windows');
  if (!rows.length) return out;
  scene.buildings.forEach((building) => {
    if (BUILDING_STYLES[building.style]?.glass) return;
    const levels = buildingLevels(building);
    const reach = building.wallThickness / 2 + 0.45;
    polygonEdges(building.polygon).forEach(([a, b], edge) => {
      const length = segmentLength(a, b);
      if (length < 1) return;
      const d = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      rows.forEach((el) => {
        const r = (el.rotation * Math.PI) / 180;
        const n = [Math.sin(r), Math.cos(r)]; // face avant de la rangée (vers la rue)
        const u = [Math.cos(r), -Math.sin(r)]; // le long de la rangée
        if (Math.abs(u[0] * d[1] - u[1] * d[0]) > 0.02) return;
        const dist = (el.position[0] - a[0]) * n[0] + (el.position[1] - a[1]) * n[1];
        if (dist <= 0 || dist > reach) return;
        // La rangée regarde vers l'extérieur de cette façade
        const out1 = [mid[0] + n[0] * 0.05, mid[1] + n[1] * 0.05];
        const in1 = [mid[0] - n[0] * 0.05, mid[1] - n[1] * 0.05];
        if (pointInPolygon(out1, building.polygon) || !pointInPolygon(in1, building.polygon)) return;
        const { length: rowLength, floors, firstLevel } = { ...defaultParams(el.kind), ...el.params };
        const count = Math.max(1, Math.floor((rowLength + 0.3) / FACADE_WINDOW.spacing));
        const base = groundHeightAt(scene, el.position[0], el.position[1]) + levelOffset(levelOf(el));
        for (let f = Math.min(firstLevel, floors - 1); f < floors; f += 1) {
          const storey = levelOf(el) + f;
          if (storey >= levels) continue;
          const sill = base + FLOOR_Y + FACADE_WINDOW.sill + f * LEVEL_HEIGHT;
          const head = sill + (storey === 0 ? 1.3 : 1.2);
          for (let i = 0; i < count; i += 1) {
            const x = (i - (count - 1) / 2) * FACADE_WINDOW.spacing;
            const s = (el.position[0] + u[0] * x - a[0]) * d[0] + (el.position[1] + u[1] * x - a[1]) * d[1];
            if (s < FACADE_WINDOW.width / 2 + 0.05 || s > length - FACADE_WINDOW.width / 2 - 0.05) continue;
            out[building.id] ||= {};
            (out[building.id][`${edge}:${storey}`] ||= []).push({ kind: 'window', t: s / length, width: FACADE_WINDOW.width, sill, head });
          }
        }
      });
    });
  });
  return out;
}

/** Trémies par bâtiment : { [id du bâtiment]: { [niveau d'arrivée]: [contours] } }. */
export function stairOpeningsByBuilding(scene) {
  const out = {};
  stairFlights(scene).forEach((flight) => {
    const building = scene.buildings.find((b) => pointInPolygon(flight.position, b.polygon));
    const arrival = flight.level + 1;
    if (!building || arrival >= buildingLevels(building)) return;
    out[building.id] ||= {};
    (out[building.id][arrival] ||= []).push(stairOpening(flight).map(roundPoint));
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Création                                                            */
/* ------------------------------------------------------------------ */

export function emptyScene(name = 'Nouveau site') {
  return {
    format: SCENE_FORMAT,
    version: SCENE_VERSION,
    name,
    buildings: [],
    prefabs: [],
    surfaces: [],
    walkways: [],
    walls: [],
    elements: [],
    npcs: [],
  };
}

export function createBuilding(polygon, patch = {}) {
  const style = patch.style || 'bardage';
  return {
    id: uid('bat'),
    name: 'Bâtiment',
    polygon: polygon.map(roundPoint),
    height: 3.2,
    wallThickness: 0.24,
    style,
    wallColor: BUILDING_STYLES[style].color,
    floor: 'beton',
    floorColor: FLOOR_STYLES.beton.color,
    levels: 1,
    doors: [],
    ...patch,
  };
}

export function createPrefab(archetype, finish, position, patch = {}) {
  const [width, depth] = PREFAB_DEFAULT_SIZE[archetype] || [18, 16];
  return { id: uid('mod'), name: 'Bâtiment', archetype, finish, position: roundPoint(position), rotation: 0, width, depth, height: 4.8, flip: false, ...patch };
}

export function createWall(a, b, type = 'plein', patch = {}) {
  const def = WALL_TYPES[type] || WALL_TYPES.plein;
  return { id: uid('mur'), type, a: roundPoint(a), b: roundPoint(b), height: def.height, thickness: def.thickness, color: def.color, door: null, ...patch };
}

export function createSurface(polygon, material = 'asphalte', patch = {}) {
  return { id: uid('sol'), name: SURFACE_MATERIALS[material]?.label || 'Sol', polygon: polygon.map(roundPoint), material, ...patch };
}

export function createWalkway(a, b, patch = {}) {
  return { id: uid('all'), a: roundPoint(a), b: roundPoint(b), width: 0.8, zebra: false, ...patch };
}

export function createElement(kind, position, patch = {}) {
  const def = ELEMENT_KINDS[kind];
  const element = { id: uid('elt'), kind, position: roundPoint(position), rotation: 0 };
  if (def?.color) element.color = def.color;
  if (def?.params) element.params = defaultParams(kind);
  if (def?.risk) element.risk = 'low';
  return { ...element, ...patch };
}

const FIRST_NAMES = ['Camille', 'Julie', 'Karim', 'Lucas', 'Nadia', 'Hugo', 'Inès', 'Thomas', 'Sofia', 'Yanis', 'Léa', 'Mathis'];

export function createNpc(outfit, position, patch = {}) {
  const variant = Math.floor(Math.random() * 8);
  return {
    id: uid('pnj'),
    name: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)],
    outfit,
    pose: 'stand',
    variant,
    position: roundPoint(position),
    rotation: 0,
    route: [],
    routeMode: 'loop',
    speed: 1,
    ...patch,
  };
}

/* ------------------------------------------------------------------ */
/* Opérations (fonctions pures : chaque modification renvoie une nouvelle scène)                    */
/* ------------------------------------------------------------------ */

export function findItem(scene, ref) {
  return ref ? scene[ref.list]?.find((item) => item.id === ref.id) || null : null;
}

export function updateItem(scene, ref, patch) {
  return {
    ...scene,
    [ref.list]: scene[ref.list].map((item) => (item.id === ref.id ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item)),
  };
}

export function addItem(scene, list, item) {
  return { ...scene, [list]: [...scene[list], item] };
}

export function removeItem(scene, ref) {
  return { ...scene, [ref.list]: scene[ref.list].filter((item) => item.id !== ref.id) };
}

/** Point de référence d'un objet : centre de l'emprise, milieu d'un segment ou position. */
export function itemAnchor(list, item) {
  if (item.polygon) return polygonCentroid(item.polygon);
  if (item.a) return [(item.a[0] + item.b[0]) / 2, (item.a[1] + item.b[1]) / 2];
  return item.position;
}

/** Contenu d'un bâtiment : murs, allées, éléments et PNJ dont le point de référence est dans son emprise. */
export function contentsOf(scene, ref) {
  const item = findItem(scene, ref);
  const footprint = item && footprintOf(ref.list, item);
  if (!footprint || ref.list === 'surfaces') return [];
  const inside = (list, it) => pointInPolygon(itemAnchor(list, it), footprint);
  return ['walls', 'walkways', 'elements', 'npcs'].flatMap((list) =>
    scene[list].filter((it) => inside(list, it)).map((it) => ({ list, id: it.id }))
  );
}

function transformItem(item, mapPoint, deg = 0) {
  const next = { ...item };
  if (item.polygon) next.polygon = item.polygon.map((p) => roundPoint(mapPoint(p)));
  if (item.a) {
    next.a = roundPoint(mapPoint(item.a));
    next.b = roundPoint(mapPoint(item.b));
  }
  if (item.position) next.position = roundPoint(mapPoint(item.position));
  if (item.route) next.route = item.route.map((p) => roundPoint(mapPoint(p)));
  if (deg && typeof item.rotation === 'number') next.rotation = Math.round((((item.rotation + deg) % 360) + 360) % 360 * 100) / 100;
  return next;
}

function transformRefs(scene, refs, mapPoint, deg) {
  const byList = new Map();
  refs.forEach(({ list, id }) => {
    if (!byList.has(list)) byList.set(list, new Set());
    byList.get(list).add(id);
  });
  const next = { ...scene };
  byList.forEach((ids, list) => {
    next[list] = scene[list].map((item) => (ids.has(item.id) ? transformItem(item, mapPoint, deg) : item));
  });
  return next;
}

/** Déplace un objet (et le contenu d'un bâtiment) de (dx, dz). */
export function moveItem(scene, ref, dx, dz, carried = contentsOf(scene, ref)) {
  return transformRefs(scene, [ref, ...carried], ([x, z]) => [x + dx, z + dz], 0);
}

/** Tourne un objet (et le contenu d'un bâtiment) de `deg` degrés autour de son point de référence. */
export function rotateItem(scene, ref, deg) {
  const item = findItem(scene, ref);
  if (!item) return scene;
  const pivot = itemAnchor(ref.list, item);
  return transformRefs(scene, [ref, ...contentsOf(scene, ref)], (p) => rotatePoint(p, deg, pivot), deg);
}

/** Copie décalée d'un objet ; un bâtiment est copié avec son contenu. */
export function duplicateItem(scene, ref, offset = [2, 2]) {
  const item = findItem(scene, ref);
  if (!item) return { scene, ref: null };
  const copies = [ref, ...contentsOf(scene, ref)].map(({ list, id }) => {
    const source = findItem(scene, { list, id });
    const copy = transformItem(source, ([x, z]) => [x + offset[0], z + offset[1]]);
    copy.id = uid(id.split('-')[0]);
    if (copy.name && list === ref.list) copy.name = `${copy.name} (copie)`;
    return { list, item: copy };
  });
  let next = scene;
  copies.forEach(({ list, item: copy }) => {
    next = addItem(next, list, copy);
  });
  return { scene: next, ref: { list: ref.list, id: copies[0].item.id } };
}

/** Insère un sommet au milieu de l'arête `edge` d'un contour (les portes suivantes sont décalées). */
export function insertVertex(building, edge) {
  const polygon = [...building.polygon];
  const [a, b] = [polygon[edge], polygon[(edge + 1) % polygon.length]];
  polygon.splice(edge + 1, 0, roundPoint([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
  const doors = (building.doors || []).flatMap((door) => {
    if (door.edge < edge) return [door];
    if (door.edge > edge) return [{ ...door, edge: door.edge + 1 }];
    // Porte de l'arête coupée : elle reste sur la moitié qui contient son centre
    return door.t < 0.5 ? [{ ...door, t: door.t * 2 }] : [{ ...door, edge: edge + 1, t: (door.t - 0.5) * 2 }];
  });
  return { ...building, polygon, doors };
}

/** Supprime un sommet (au moins 3 restent) ; les portes des deux arêtes fusionnées disparaissent. */
export function removeVertex(building, index) {
  if (building.polygon.length <= 3) return building;
  const n = building.polygon.length;
  const polygon = building.polygon.filter((_, i) => i !== index);
  const before = (index - 1 + n) % n;
  const doors = (building.doors || []).flatMap((door) => {
    if (door.edge === index || door.edge === before) return [];
    return [{ ...door, edge: door.edge > index ? door.edge - 1 : door.edge }];
  });
  return { ...building, polygon, doors };
}

/* ------------------------------------------------------------------ */
/* Étirement et conversion des bâtiments du jumeau                      */
/* ------------------------------------------------------------------ */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Dimensions étirables d'un objet par axe local (x : largeur, z : profondeur) : taille actuelle,
 * `fit(taille)` (taille atteignable la plus proche) et `apply(objet, taille)`. null si rien ne s'étire.
 */
export function stretchAxes(list, item) {
  if (list === 'prefabs') {
    const axis = (key) => ({ size: item[key], fit: (s) => clamp(s, ...PREFAB_SIZE_RANGE), apply: (it, s) => ({ ...it, [key]: round3(s) }) });
    return { x: axis('width'), z: axis('depth') };
  }
  const def = list === 'elements' ? ELEMENT_KINDS[item.kind] : null;
  if (!def?.stretch) return null;
  const params = { ...defaultParams(item.kind), ...item.params };
  return Object.fromEntries(
    Object.entries(def.stretch).map(([axis, { key, unit, base = 0 }]) => {
      const p = def.params.find((q) => q.key === key);
      const [lo, hi] = p.meters ? [fromMeters(p.min), fromMeters(p.max)] : [p.min, p.max];
      // Réglage entier (travées d'un rack) : la taille avance par pas de `unit`
      const value = unit ? (s) => clamp(Math.round((s - base) / unit), lo, hi) : (s) => round3(clamp(s, lo, hi));
      const sizeOf = (v) => (unit ? v * unit + base : v);
      return [
        axis,
        {
          size: sizeOf(params[key]),
          fit: (s) => sizeOf(value(s)),
          apply: (it, s) => ({ ...it, params: { ...defaultParams(it.kind), ...it.params, [key]: value(s) } }),
        },
      ];
    })
  );
}

/**
 * Étire un objet par une poignée de bord ou de coin (`handle` = [sx, sz] : −1, 0 ou 1 par axe local)
 * jusqu'au point `p` du sol : le bord opposé reste en place et les tailles suivent le pas d'aimantation.
 */
export function stretchItem(list, item, handle, p, step) {
  const axes = stretchAxes(list, item);
  if (!axes) return item;
  const [ox, oz] = item.position;
  const q = rotatePoint(p, -item.rotation, item.position);
  const local = [q[0] - ox, q[1] - oz];
  const shift = [0, 0];
  let next = item;
  ['x', 'z'].forEach((axis, i) => {
    const side = handle[i];
    const spec = axes[axis];
    if (!side || !spec) return;
    const fixed = (-side * spec.size) / 2;
    const size = spec.fit(snapValue(side * (local[i] - fixed), step));
    shift[i] = fixed + (side * size) / 2;
    next = spec.apply(next, size);
  });
  return { ...next, position: roundPoint(rotatePoint([ox + shift[0], oz + shift[1]], item.rotation, item.position)) };
}

/** Façade d'un bâtiment sur mesure équivalente à la finition d'un bâtiment du jumeau. */
function prefabStyle(archetype, finish) {
  const f = shellFinish(archetype, finish);
  if (archetype === 'office') return { style: 'vitre', wallColor: BUILDING_STYLES.vitre.color };
  if (archetype === 'paint') return { style: 'enduit', wallColor: f.wall };
  if (archetype === 'logistics') return { style: 'bardage', wallColor: f.cladding };
  if (finish === 'brick') return { style: 'brique', wallColor: BUILDING_STYLES.brique.color };
  if (finish === 'concrete') return { style: 'beton', wallColor: BUILDING_STYLES.beton.color };
  return { style: 'bardage', wallColor: f.wall?.color || BUILDING_STYLES.bardage.color };
}

/**
 * Bâtiment sur mesure de même emprise, hauteur et teinte qu'un bâtiment du jumeau, pour en modifier
 * librement le contour, les façades et les ouvertures : entrée principale sur la façade avant (sud
 * avant rotation) et porte piétonne du côté des annexes.
 */
export function prefabToBuilding(prefab) {
  const polygon = rectCorners(prefab.position, [prefab.width, prefab.depth], prefab.rotation);
  const main = prefab.archetype === 'office' ? 'porte' : 'portail';
  return createBuilding(polygon, {
    name: prefab.name,
    height: prefab.height,
    ...prefabStyle(prefab.archetype, prefab.finish),
    doors: [
      { edge: 2, kind: main, t: 0.5, width: DOOR_KINDS[main].width },
      { edge: prefab.flip ? 3 : 1, kind: 'porte', t: 0.5, width: DOOR_KINDS.porte.width },
    ],
  });
}

/** Emprise globale de la scène (cadrage de la caméra) : centre et rayon. */
export function sceneBounds(scene) {
  const points = [
    ...scene.buildings.flatMap((b) => b.polygon),
    ...scene.surfaces.flatMap((s) => s.polygon),
    ...scene.prefabs.flatMap((p) => footprintOf('prefabs', p)),
    ...scene.walls.flatMap((w) => [w.a, w.b]),
    ...scene.elements.map((e) => e.position),
    ...scene.npcs.map((n) => n.position),
  ];
  if (!points.length) return { center: [0, 0], radius: 20 };
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  return { center: [(minX + maxX) / 2, (minZ + maxZ) / 2], radius: Math.max(12, Math.hypot(maxX - minX, maxZ - minZ) / 2) };
}

/* ------------------------------------------------------------------ */
/* Import / export JSON                                                 */
/* ------------------------------------------------------------------ */

const MAX_ITEMS = 2000;

function num(v, fallback, min = -1e4, max = 1e4) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
const text = (v, fallback, max = 80) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const oneOf = (v, choices, fallback) => (Object.prototype.hasOwnProperty.call(choices, v) ? v : fallback);

function color(v, fallback) {
  if (typeof v !== 'string') return fallback;
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
}

function point(v) {
  if (!Array.isArray(v) || v.length < 2) return null;
  const [x, z] = [Number(v[0]), Number(v[1])];
  return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= 1e4 && Math.abs(z) <= 1e4 ? roundPoint([x, z]) : null;
}

function polygonOf(v) {
  if (!Array.isArray(v)) return null;
  const pts = v.map(point).filter(Boolean).slice(0, 64);
  return pts.length >= 3 && Math.abs(polygonArea(pts)) > 0.01 ? pts : null;
}

function doorOf(v) {
  if (!v || typeof v !== 'object') return null;
  const kind = oneOf(v.kind, DOOR_KINDS, 'porte');
  return { kind, t: num(v.t, 0.5, 0, 1), width: num(v.width, DOOR_KINDS[kind].width, 0.4, 12) };
}

/** Lecture tolérante d'une liste : chaque entrée invalide est ignorée et signalée. */
function readList(raw, label, sanitize, warnings) {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push(`« ${label} » n’est pas une liste : ignoré.`);
    return [];
  }
  const ids = new Set();
  const items = [];
  let skipped = 0;
  raw.slice(0, MAX_ITEMS).forEach((entry) => {
    const item = entry && typeof entry === 'object' ? sanitize(entry) : null;
    if (!item) {
      skipped += 1;
      return;
    }
    if (ids.has(item.id)) item.id = uid(item.id.split('-')[0] || 'obj');
    ids.add(item.id);
    items.push(item);
  });
  if (skipped) warnings.push(`${label} : ${skipped} entrée(s) invalide(s) ignorée(s).`);
  if (raw.length > MAX_ITEMS) warnings.push(`${label} : seules les ${MAX_ITEMS} premières entrées sont lues.`);
  return items;
}

const idOf = (v, prefix) => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : uid(prefix));

/** Niveau d'un objet importé : écrit seulement au-dessus du rez-de-chaussée. */
function withLevel(item, v, max = MAX_LEVELS - 1) {
  const level = Math.round(num(v.level, 0, 0, max));
  if (level) item.level = level;
  return item;
}

const SANITIZERS = {
  buildings(v) {
    const polygon = polygonOf(v.polygon);
    if (!polygon) return null;
    const style = oneOf(v.style, BUILDING_STYLES, 'bardage');
    const floor = oneOf(v.floor, FLOOR_STYLES, 'beton');
    const levels = Math.round(num(v.levels, 1, 1, MAX_LEVELS));
    return {
      id: idOf(v.id, 'bat'),
      name: text(v.name, 'Bâtiment'),
      polygon,
      height: num(v.height, 3.2, 1, 20),
      wallThickness: num(v.wallThickness, 0.24, 0.05, 1.5),
      style,
      wallColor: color(v.wallColor, BUILDING_STYLES[style].color),
      floor,
      floorColor: color(v.floorColor, FLOOR_STYLES[floor].color),
      levels,
      // Ouvertures de façade : `level` = niveau percé (portes d'étage, passages entre bâtiments accolés)
      doors: (Array.isArray(v.doors) ? v.doors : [])
        .map((d) => {
          const door = doorOf(d);
          const edge = Math.round(Number(d?.edge));
          return door && edge >= 0 && edge < polygon.length ? withLevel({ edge, ...door }, d, levels - 1) : null;
        })
        .filter(Boolean),
    };
  },
  prefabs(v) {
    const position = point(v.position);
    const skin = PREFAB_SKINS.find((s) => s.archetype === v.archetype && s.finish === v.finish) || PREFAB_SKINS.find((s) => s.archetype === v.archetype);
    if (!position || !skin) return null;
    const [w, d] = PREFAB_DEFAULT_SIZE[skin.archetype];
    return {
      id: idOf(v.id, 'mod'),
      name: text(v.name, 'Bâtiment'),
      archetype: skin.archetype,
      finish: skin.finish,
      position,
      rotation: num(v.rotation, 0, -360, 360),
      width: num(v.width, w, ...PREFAB_SIZE_RANGE),
      depth: num(v.depth, d, ...PREFAB_SIZE_RANGE),
      height: num(v.height, 4.8, 3, 12),
      // Annexes (parking, quais, cuves) du côté gauche plutôt que droit
      flip: Boolean(v.flip),
    };
  },
  walls(v) {
    const [a, b] = [point(v.a), point(v.b)];
    if (!a || !b || segmentLength(a, b) < 0.05) return null;
    const type = oneOf(v.type, WALL_TYPES, 'plein');
    const def = WALL_TYPES[type];
    return withLevel(
      {
        id: idOf(v.id, 'mur'),
        type,
        a,
        b,
        height: num(v.height, def.height, 0.2, 20),
        thickness: num(v.thickness, def.thickness, 0.02, 1.5),
        color: color(v.color, def.color),
        door: doorOf(v.door),
      },
      v
    );
  },
  surfaces(v) {
    const polygon = polygonOf(v.polygon);
    if (!polygon) return null;
    const material = oneOf(v.material, SURFACE_MATERIALS, 'asphalte');
    return { id: idOf(v.id, 'sol'), name: text(v.name, SURFACE_MATERIALS[material].label), polygon, material };
  },
  walkways(v) {
    const [a, b] = [point(v.a), point(v.b)];
    if (!a || !b || segmentLength(a, b) < 0.05) return null;
    return withLevel({ id: idOf(v.id, 'all'), a, b, width: num(v.width, 0.8, 0.3, 4), zebra: Boolean(v.zebra) }, v);
  },
  elements(v) {
    const position = point(v.position);
    const def = ELEMENT_KINDS[v.kind];
    if (!position || !def) return null;
    const element = { id: idOf(v.id, 'elt'), kind: v.kind, position, rotation: num(v.rotation, 0, -360, 360) };
    if (def.color) element.color = color(v.color, def.color);
    if (def.params) {
      element.params = Object.fromEntries(
        def.params.map((p) => [p.key, num(v.params?.[p.key], p.default, p.meters ? fromMeters(p.min) : p.min, p.meters ? fromMeters(p.max) : p.max)])
      );
    }
    if (def.risk) element.risk = oneOf(v.risk, RISK_LEVELS, 'low');
    if (typeof v.label === 'string' && v.label.trim()) element.label = text(v.label, '');
    return withLevel(element, v);
  },
  npcs(v) {
    const position = point(v.position);
    if (!position) return null;
    return withLevel({
      id: idOf(v.id, 'pnj'),
      name: text(v.name, 'Personnage', 40),
      outfit: oneOf(v.outfit, NPC_OUTFITS, 'worker'),
      pose: oneOf(v.pose, NPC_POSES, 'stand'),
      variant: Math.round(num(v.variant, 0, 0, 99)),
      position,
      rotation: num(v.rotation, 0, -360, 360),
      route: (Array.isArray(v.route) ? v.route : []).map(point).filter(Boolean).slice(0, 64),
      routeMode: oneOf(v.routeMode, NPC_ROUTE_MODES, 'loop'),
      speed: num(v.speed, 1, 0.2, 3),
    }, v);
  },
};

/** Normalise un objet scène (import, brouillon) ; renvoie la scène et les avertissements de lecture. */
export function normalizeScene(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Le fichier ne contient pas une scène (objet JSON attendu).');
  if (raw.format !== undefined && raw.format !== SCENE_FORMAT) throw new Error(`Format « ${String(raw.format).slice(0, 40)} » non reconnu (attendu : ${SCENE_FORMAT}).`);
  if (Number(raw.version) > SCENE_VERSION) throw new Error(`Version ${raw.version} plus récente que l’éditeur (version ${SCENE_VERSION}).`);
  const warnings = [];
  const scene = emptyScene(text(raw.name, 'Site importé'));
  LISTS.forEach((list) => {
    scene[list] = readList(raw[list], LIST_LABELS[list], SANITIZERS[list], warnings);
  });
  // Point de départ de la visite (facultatif) : position au sol et orientation du regard
  const spawn = raw.spawn && typeof raw.spawn === 'object' ? point(raw.spawn.position) : null;
  if (spawn) scene.spawn = { position: spawn, rotation: num(raw.spawn.rotation, 0, -360, 360) };
  // Une porte de mur intérieur sans largeur valide est retirée par doorOf ; rien d'autre à relier
  return { scene, warnings };
}

export function parseScene(textContent) {
  let raw;
  try {
    raw = JSON.parse(textContent);
  } catch (error) {
    throw new Error(`JSON invalide : ${error.message}`);
  }
  return normalizeScene(raw);
}

export function serializeScene(scene) {
  const { format, version, name, ...lists } = scene;
  return JSON.stringify({ format: SCENE_FORMAT, version: SCENE_VERSION, name, unit: '1 unité = 1,5 m ; rotations en degrés', ...lists }, null, 2);
}

export function sceneFileName(scene) {
  const slug = (scene.name || 'site')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'site'}.json`;
}

/* ------------------------------------------------------------------ */
/* Brouillon local                                                      */
/* ------------------------------------------------------------------ */

const DRAFT_KEY = 'digiriskgame.editor.scene';

export function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? parseScene(raw).scene : null;
  } catch {
    return null;
  }
}

export function saveDraft(scene) {
  try {
    window.localStorage.setItem(DRAFT_KEY, serializeScene(scene));
  } catch {
    // Stockage indisponible (navigation privée, quota) : la scène reste exportable en JSON
  }
}
