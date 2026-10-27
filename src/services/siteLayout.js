import { detectBuildingArchetype } from './archetypes';
import { DEFAULT_DEMO_RISKSIGNS, enrichRiskSign } from '../data/signalisationCategories';
import { resolveBuildingSkin, resolveWorkUnitSkin } from './skins';
import { statsFromRisks } from './digiriskApi';

/**
 * Plan 3D du site, conçu pour un nombre quelconque de Groupements (GP) et d'Unités de Travail (UT) :
 * - chaque GP de premier niveau est un bâtiment ; ses UT sont rangées en grille presque carrée,
 *   chaque sous-groupement commençant une nouvelle rangée et formant une zone repérée au sol ;
 * - les UT rattachées directement à la racine sont regroupées dans une zone extérieure ;
 * - les bâtiments forment des îlots en grille presque carrée, séparés par des voies, autour du
 *   rond-point central (origine) : avenue d'entrée Nord-Sud en x = 0 (portail au sud) et voie
 *   principale Est-Ouest en z = 0. Chaque îlot est aligné sur ces deux axes, ses annexes
 *   (parking, quais, cuves...) tournées vers l'extérieur.
 *
 * Repère : 1 unité ≈ 1,5 m ; façades des bâtiments ouvertes vers +Z.
 */

const CELL_W = 6.2;
const CELL_D = 5.4;
const PAD_X = 2.6;
const PAD_Z = 3.0;
const UT_SIZE = [4.8, 2.2, 4.0];
const BUILDING_HEIGHT = 4.8;

export const AVENUE_WIDTH = 6.5; // avenue d'entrée Nord-Sud (x = 0)
export const STREET_WIDTH = 5.5; // voie principale Est-Ouest (z = 0) et voies secondaires
const SETBACK = 2.6; // recul entre la chaussée et l'emprise d'un îlot (éclairage + couloir piéton)
const LANE = 1.6; // axe du couloir piéton extérieur, depuis le bord de chaussée
const HUB_CROSSWALK = { alongX: 8.2, alongZ: 8.0 }; // passages piétons au-delà de l'anneau du rond-point
const FENCE_MARGIN = 3.5;
const MIN_SITE = [67, 47]; // emprise minimale de l'enceinte (X, Z)
const ROAD_OFFSET = 9.5; // axe de la route départementale, au-delà du portail
const ROAD_WIDTH = 6;

/** Rond-point central : îlot, axe et bord extérieur de l'anneau de circulation, dégagement des couloirs piétons. */
export const HUB = { island: 4.4, lane: 5.8, ring: 7.2, clear: 8.1 };

/**
 * Semi-remorque de livraison (repère du modèle : arrière de la remorque en x = 0, avant vers +X) :
 * recul au quai, essieux de la remorque, pivot d'attelage, tracteur et son essieu moteur.
 */
export const TRUCK = { dockGap: 1.25, bogie: 1.5, kingpin: 5.6, tractor: 6.1, axle: 6.4, front: 7.8 };
const TRUCK_TURN = 2.4; // rayon des virages de la semi-remorque
const HUB_APPROACH = 11.5; // début de l'entrée / fin de la sortie du rond-point, depuis son centre
const HUB_EASE = Math.PI / 12; // l'anneau est rejoint (et quitté) 15° au-delà du point d'insertion

// Débord des annexes extérieures côté `outward` (parking, quais et manœuvre du camion, cuves, cheminée)
const OUTWARD_MARGIN = { office: 6.6, factory: 2.6, paint: 4.4, logistics: 11.2, yard: 0.6 };
const SIDE_MARGIN = 0.6;
const BACK_MARGIN = 0.6;
const FRONT_MARGIN = 1.2; // auvent et jardinières de l'entrée des bureaux

const isGroup = (node) => node.elementType === 'groupment';
const ownUnits = (group) => group.children.filter((c) => !isGroup(c));
const subGroups = (group) => group.children.filter(isGroup);

/** Copie de l'arborescence avec ses signalisations et le parent direct de chaque élément (fil d'Ariane). */
function cloneTree(node, signsByElement, parent = null) {
  const directRiskSigns = signsByElement[node.id] || node.directRiskSigns || [];
  const copy = {
    ...node,
    directRiskSigns,
    parentBuildingRef: parent?.ref,
    parentBuildingLabel: parent?.label,
  };
  copy.children = (node.children || []).map((child) => cloneTree(child, signsByElement, copy));
  copy.allRiskSigns = [...directRiskSigns, ...copy.children.flatMap((c) => c.allRiskSigns)];
  return copy;
}

/**
 * Grille des postes d'un bâtiment. Les UT directes viennent en premier, puis celles de chaque
 * sous-groupement (parcours en profondeur), chaque section sur ses propres rangées.
 */
function layoutInterior(block) {
  const units = [];
  let largestSection = 0;
  const collect = (group) => {
    const own = ownUnits(group);
    units.push(...own);
    largestSection = Math.max(largestSection, own.length);
    subGroups(group).forEach(collect);
  };
  collect(block);
  const cols = Math.max(2, Math.min(Math.ceil(Math.sqrt(units.length)), largestSection));

  const cells = [];
  const zones = [];
  let row = 0;
  const place = (group, level) => {
    const firstRow = row;
    const own = ownUnits(group);
    own.forEach((ut, i) => cells.push({ ut, col: i % cols, row: row + Math.floor(i / cols) }));
    row += Math.ceil(own.length / cols);
    subGroups(group).forEach((sub) => place(sub, level + 1));
    if (level > 0 && row > firstRow) zones.push({ group, level, firstRow, lastRow: row - 1 });
  };
  place(block, 0);

  const rows = Math.max(1, row);
  return {
    units,
    cells,
    zones,
    cols,
    rows,
    width: Math.max(13, cols * CELL_W + PAD_X * 2),
    depth: Math.max(11, rows * CELL_D + PAD_Z * 2),
  };
}

/**
 * Répartit des bandes (colonnes ou rangées d'îlots) de part et d'autre de l'axe principal, placé avant
 * la bande `split` : bandes [split, n) du côté positif, [0, split) du côté négatif, une voie entre deux
 * bandes. Renvoie l'intervalle de chaque bande et la position de chaque voie (indexée par frontière).
 */
function allocate(sizes, split, mainWidth, streetWidth) {
  const bands = new Array(sizes.length);
  const streets = { [split]: 0 };
  let cursor = mainWidth / 2 + SETBACK;
  for (let i = split; i < sizes.length; i += 1) {
    bands[i] = [cursor, cursor + sizes[i]];
    cursor += sizes[i];
    if (i < sizes.length - 1) {
      streets[i + 1] = cursor + SETBACK + streetWidth / 2;
      cursor = streets[i + 1] + streetWidth / 2 + SETBACK;
    }
  }
  cursor = -(mainWidth / 2 + SETBACK);
  for (let i = split - 1; i >= 0; i -= 1) {
    bands[i] = [cursor - sizes[i], cursor];
    cursor -= sizes[i];
    if (i > 0) {
      streets[i] = cursor - SETBACK - streetWidth / 2;
      cursor = streets[i] - streetWidth / 2 - SETBACK;
    }
  }
  return { bands, streets };
}

/**
 * Coordonnée Z locale de la porte piétonne latérale d'un bâtiment : sur l'allée transversale
 * la plus centrale entre deux rangées de postes, ou sur l'allée de façade s'il n'y a qu'une rangée.
 */
export function sideDoorZ(depth) {
  const rows = Math.max(1, Math.round((depth - 2 * PAD_Z) / CELL_D));
  if (rows === 1) return depth / 2 - 1.6;
  const gap = Math.floor(rows / 2) - 1;
  return (gap + 0.5 - (rows - 1) / 2) * CELL_D + 0.4;
}

/**
 * Quais de l'entrepôt (coordonnées Z locales, croissantes) et quai de la semi-remorque : le plus proche
 * de la voie qui borde l'îlot côté rond-point (`oz` : côté extérieur de l'îlot en Z).
 */
export function warehouseDocks(depth, oz = 1) {
  const count = Math.max(2, Math.min(4, Math.floor((depth - 2) / 3)));
  const zs = Array.from({ length: count }, (_, i) => -depth / 2 + 2.2 + (i * (depth - 4.4)) / Math.max(1, count - 1));
  return { zs, truck: oz > 0 ? 0 : count - 1 };
}

/** Facteur d'échelle de la scène selon l'emprise du site (1 pour le site de démonstration à 4 bâtiments). */
export function siteScale(site) {
  return Math.max(1, (site?.radius || 0) / 45);
}

/** Graphe des cheminements piétons ; les nœuds sont dédoublonnés par position. */
function createWalkGraph() {
  const nodes = [];
  const keys = new Map();
  const edges = [];
  const node = (x, z, indoor, extra = {}) => {
    const key = `${Math.round(x * 100)}:${Math.round(z * 100)}:${indoor ? 1 : 0}`;
    if (!keys.has(key)) {
      keys.set(key, nodes.length);
      nodes.push({ id: nodes.length, x, z, indoor, ...extra });
    }
    return keys.get(key);
  };
  const edge = (a, b, kind, extra = {}) => {
    if (a !== b) edges.push({ a, b, kind, ...extra });
  };
  /** Relie dans l'ordre des nœuds alignés selon `axis`, sauf à travers les coupures (voies croisées). */
  const chain = (ids, axis, kind, extra = {}, cuts = []) => {
    const pos = (id) => (axis === 'x' ? nodes[id].x : nodes[id].z);
    const sorted = [...new Set(ids)].sort((p, q) => pos(p) - pos(q));
    for (let i = 1; i < sorted.length; i += 1) {
      const mid = (pos(sorted[i - 1]) + pos(sorted[i])) / 2;
      if (!cuts.some(([a, b]) => mid > a && mid < b)) edge(sorted[i - 1], sorted[i], kind, extra);
    }
  };
  return { nodes, edges, node, edge, chain };
}

/**
 * Couloirs intérieurs d'un bâtiment : une allée transversale devant chaque rangée de postes,
 * des allées Nord-Sud entre les colonnes, un embranchement jusqu'au-devant de chaque poste,
 * la porte latérale (côté voie d'accès) et la porte principale en façade.
 */
function interiorWalkways(g, p) {
  const { cols, rows, width, depth, cells } = p.interior;
  const building = p.block.id;
  const localX = (col) => (col - (cols - 1) / 2) * CELL_W;
  const localZ = (row) => (row - (rows - 1) / 2) * CELL_D + 0.4;
  const frontZ = depth / 2 - 1.6;
  const corridorZ = (row) => (row < rows - 1 ? localZ(row) + CELL_D / 2 : frontZ);
  const doorZ = sideDoorZ(depth);
  const at = (lx, lz, extra) => g.node(p.cx + lx, p.cz + lz, true, { building, ...extra });
  const corridors = new Map();
  const aisles = new Map();
  const addTo = (map, key, id) => {
    const k = key.toFixed(3);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(id);
  };

  for (const { ut, col, row } of cells) {
    const junction = at(localX(col), corridorZ(row));
    const stand = at(localX(col), localZ(row) + 2.1, { stand: true });
    g.edge(junction, stand, 'branch', { building });
    addTo(corridors, corridorZ(row), junction);
    ut.layout3D.walkNode = stand;
  }
  if (rows > 1) {
    for (let j = 0; j < cols - 1; j += 1) {
      const ax = (j + 0.5 - (cols - 1) / 2) * CELL_W;
      for (let row = 0; row < rows; row += 1) {
        const id = at(ax, corridorZ(row));
        addTo(corridors, corridorZ(row), id);
        addTo(aisles, ax, id);
      }
    }
  }

  // Porte latérale (seuil intérieur -> extérieur) et porte principale en façade
  const sideIn = at(-p.ox * (width / 2 - 0.9), doorZ);
  addTo(corridors, doorZ, sideIn);
  const sideOut = g.node(p.cx - p.ox * (width / 2 + 0.6), p.cz + doorZ, false);
  g.edge(sideIn, sideOut, 'door', { building, sill: [p.cx - p.ox * (width / 2), p.cz + doorZ] });
  const frontJunction = at(0, frontZ);
  addTo(corridors, frontZ, frontJunction);
  const frontIn = at(0, depth / 2 - 0.9);
  g.edge(frontJunction, frontIn, 'corridor', { building });
  const frontOut = g.node(p.cx, p.cz + depth / 2 + 0.6, false);
  g.edge(frontIn, frontOut, 'door', { building, sill: [p.cx, p.cz + depth / 2] });

  corridors.forEach((ids) => g.chain(ids, 'x', 'corridor', { building }));
  aisles.forEach((ids) => g.chain(ids, 'z', 'corridor', { building }));
  return { sideOut, frontOut };
}

/**
 * Couloirs extérieurs : de chaque côté de chaque voie (îlots entourés), interrompus aux carrefours
 * où ils se rejoignent (en diagonale autour de l'anneau du rond-point) ; passages piétons de part et
 * d'autre de chaque carrefour ; raccordement des portes de chaque bâtiment au couloir le plus proche.
 */
function outdoorWalkways(g, streets, extent, plans, doors) {
  const ns = streets.filter((s) => s.axis === 'z');
  const ew = streets.filter((s) => s.axis === 'x');
  const off = (s) => s.width / 2 + LANE;
  // Autour du rond-point, un couloir s'arrête au cercle de dégagement de l'anneau
  const hubReach = (lateral) => Math.sqrt(Math.max(0, HUB.clear ** 2 - lateral ** 2));
  const cut = (s, cross) => {
    const half = s.main && cross.main ? Math.max(off(cross), hubReach(off(s))) : off(cross);
    const at = cross.axis === 'z' ? cross.x : cross.z;
    return [at - half, at + half];
  };
  const lanes = [
    ...ns.flatMap((s) =>
      [-1, 1].map((side) => ({ axis: 'z', at: s.x + side * off(s), street: s, side, from: extent.minZ, to: extent.maxZ, cuts: ew.map((e) => cut(s, e)), ids: [] }))
    ),
    ...ew.flatMap((s) =>
      [-1, 1].map((side) => ({ axis: 'x', at: s.z + side * off(s), street: s, side, from: extent.minX, to: extent.maxX, cuts: ns.map((n) => cut(s, n)), ids: [] }))
    ),
  ];
  const stop = (lane, t) => {
    const id = lane.axis === 'z' ? g.node(lane.at, t, false) : g.node(t, lane.at, false);
    lane.ids.push(id);
    return id;
  };
  const laneOf = (street, side) => lanes.find((l) => l.street === street && l.side === side);
  for (const lane of lanes) {
    stop(lane, lane.from);
    stop(lane, lane.to);
    for (const [a, b] of lane.cuts) {
      if (a > lane.from && a < lane.to) stop(lane, a);
      if (b > lane.from && b < lane.to) stop(lane, b);
    }
  }
  // Couloirs du rond-point raccordés en diagonale, par-delà l'anneau, dans chaque quart
  const hubNs = ns.find((s) => s.main);
  const hubEw = ew.find((s) => s.main);
  if (hubNs && hubEw) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = stop(laneOf(hubNs, sx), hubEw.z + sz * hubReach(off(hubNs)));
        const b = stop(laneOf(hubEw, sz), hubNs.x + sx * hubReach(off(hubEw)));
        g.edge(a, b, 'lane');
      }
    }
  }

  const crosswalks = [];
  for (const n of ns) {
    for (const e of ew) {
      const hub = n.main && e.main;
      for (const s of [-1, 1]) {
        // Traversée de la voie Nord-Sud, au nord et au sud du carrefour
        const z = e.z + s * (hub ? HUB_CROSSWALK.alongZ : off(e) + 0.8);
        if (z > extent.minZ && z < extent.maxZ) {
          g.edge(stop(laneOf(n, -1), z), stop(laneOf(n, 1), z), 'crosswalk', { road: { axis: 'z', at: n.x, half: n.width / 2 } });
          crosswalks.push({ x: n.x, z, across: 'x', width: n.width - 0.6, street: n });
        }
        // Traversée de la voie Est-Ouest, à l'ouest et à l'est du carrefour
        const x = n.x + s * (hub ? HUB_CROSSWALK.alongX : off(n) + 0.8);
        if (x > extent.minX && x < extent.maxX) {
          g.edge(stop(laneOf(e, -1), x), stop(laneOf(e, 1), x), 'crosswalk', { road: { axis: 'x', at: e.z, half: e.width / 2 } });
          crosswalks.push({ x, z: e.z, across: 'z', width: e.width - 0.6, street: e });
        }
      }
    }
  }

  for (const p of plans) {
    const { sideOut, frontOut } = doors.get(p);
    // Porte latérale -> couloir de la voie d'accès, côté bâtiment
    const access = ns.find((s) => Math.abs(s.x - p.accessX) < 0.01);
    g.edge(sideOut, stop(laneOf(access, -p.block.layout3D.access.side), g.nodes[sideOut].z), 'link');
    // Porte de façade -> couloir nord de la première voie au sud, sinon simple dégagement
    const front = g.nodes[frontOut];
    const ahead = ew.filter((e) => e.z > front.z).sort((a, b) => a.z - b.z)[0];
    if (ahead) g.edge(frontOut, stop(laneOf(ahead, -1), front.x), 'link');
    else g.edge(frontOut, g.node(front.x, front.z + 1.1, false), 'link');
  }

  for (const lane of lanes) g.chain(lane.ids, lane.axis, 'lane', {}, lane.cuts);
  return crosswalks;
}

/**
 * Listes prêtes au rendu (bandes et dalles de jonction) et graphe de déplacement des opérateurs.
 * Les seuils de porte sont coupés au nu de la dalle : partie intérieure zébrée à hauteur du sol
 * du bâtiment, partie extérieure posée sur le pavé (jamais en surplomb).
 */
function walkwayRendering(g, buildings) {
  const local = new Map(buildings.map((b) => [b.id, { strips: [], nodes: [] }]));
  const outdoor = { strips: [], nodes: [] };
  const xz = (n) => [n.x, n.z];
  const toLocal = (b, [x, z]) => [x - b.layout3D.position[0], z - b.layout3D.position[2]];
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const degree = g.nodes.map(() => []);

  for (const e of g.edges) {
    const a = g.nodes[e.a];
    const b = g.nodes[e.b];
    degree[e.a].push([b.x - a.x, b.z - a.z]);
    degree[e.b].push([a.x - b.x, a.z - b.z]);
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (e.kind === 'corridor' || e.kind === 'branch') {
      const owner = byId.get(e.building);
      local.get(e.building).strips.push({ from: toLocal(owner, xz(a)), to: toLocal(owner, xz(b)), arrows: e.kind === 'corridor' && length > 2.6 });
    } else if (e.kind === 'door') {
      const owner = byId.get(e.building);
      local.get(e.building).strips.push({ from: toLocal(owner, xz(a)), to: toLocal(owner, e.sill), zebra: true });
      outdoor.strips.push({ from: e.sill, to: xz(b), arrows: false });
    } else if (e.kind === 'crosswalk') {
      // Accès au passage piéton : du couloir jusqu'au bord de chaussée, de chaque côté
      for (const n of [a, b]) {
        const sign = Math.sign((e.road.axis === 'z' ? n.x : n.z) - e.road.at);
        const edge = e.road.at + sign * e.road.half;
        outdoor.strips.push({ from: xz(n), to: e.road.axis === 'z' ? [edge, n.z] : [n.x, edge], arrows: false });
      }
    } else {
      outdoor.strips.push({ from: xz(a), to: xz(b), arrows: e.kind === 'lane' && length > 2.6 });
    }
  }

  // Dalles de jonction aux croisements, angles et extrémités (pas sur un alignement simple)
  g.nodes.forEach((n, i) => {
    const dirs = degree[i];
    if (n.stand || !dirs.length) return;
    if (dirs.length === 2) {
      const [[ax, az], [bx, bz]] = dirs;
      if (Math.abs(ax * bz - az * bx) < 1e-6 * Math.hypot(ax, az) * Math.hypot(bx, bz)) return;
    }
    if (n.indoor) local.get(n.building).nodes.push(toLocal(byId.get(n.building), xz(n)));
    else outdoor.nodes.push(xz(n));
  });

  // Graphe de déplacement : voisins pondérés par la distance
  const adjacency = g.nodes.map(() => []);
  for (const e of g.edges) {
    const a = g.nodes[e.a];
    const b = g.nodes[e.b];
    const w = Math.hypot(b.x - a.x, b.z - a.z);
    adjacency[e.a].push({ to: e.b, w, sill: e.sill });
    adjacency[e.b].push({ to: e.a, w, sill: e.sill });
  }
  return { local, outdoor, graph: { nodes: g.nodes, adjacency } };
}

/** Élargit symétriquement un intervalle jusqu'à une taille minimale. */
function grow(min, max, size) {
  const extra = Math.max(0, size - (max - min)) / 2;
  return [min - extra, max + extra];
}

/** Côté droit d'une direction [dx, dz] (circulation à droite). */
const rightOf = ([dx, dz]) => [-dz, dx];
/** Décalage de l'axe d'une file de circulation depuis l'axe de la voie. */
const laneOffset = (street) => street.width / 4;

/**
 * Traversée du rond-point (sens giratoire : îlot à gauche), du bras `a` au bras `b` (vecteurs unitaires
 * du centre vers chaque bras) : entrée dans la file de droite, arc de l'anneau, sortie dans la file de droite.
 */
function roundabout(hub, a, laneIn, b, laneOut) {
  const nIn = rightOf([-a[0], -a[1]]);
  const nOut = rightOf(b);
  const point = (u, n, offset, t) => [hub[0] + u[0] * t + n[0] * offset, hub[1] + u[1] * t + n[1] * offset];
  const insertion = (u, n, offset) => {
    const [x, z] = point(u, n, offset, Math.sqrt(HUB.lane ** 2 - offset ** 2));
    return Math.atan2(z - hub[1], x - hub[0]);
  };
  const thetaIn = insertion(a, nIn, laneIn);
  let thetaOut = insertion(b, nOut, laneOut);
  while (thetaOut >= thetaIn) thetaOut -= 2 * Math.PI;
  const from = thetaIn - HUB_EASE;
  const to = thetaOut + HUB_EASE;
  const steps = Math.ceil((from - to) / (Math.PI / 6));
  const angles = from > to ? Array.from({ length: steps + 1 }, (_, i) => from - (i * (from - to)) / steps) : [(thetaIn + thetaOut) / 2];
  return [
    point(a, nIn, laneIn, HUB_APPROACH),
    ...angles.map((t) => [hub[0] + HUB.lane * Math.cos(t), hub[1] + HUB.lane * Math.sin(t)]),
    point(b, nOut, laneOut, HUB_APPROACH),
  ];
}

/**
 * Trajets de la semi-remorque d'un entrepôt (polylignes de l'essieu moteur dans le plan XZ, virages
 * arrondis au rendu). Départ du quai le plus proche de la voie bordant l'îlot côté rond-point, par
 * l'annexe des quais ; voie jusqu'à l'avenue, rond-point, portail, puis route départementale vers
 * l'ouest. Retour par l'autre file, passage devant le quai et marche arrière (`dock`, parcouru à
 * rebours). Chaque trajet commence par les essieux de la remorque, à l'arrêt dans l'alignement.
 * `rings` : pour chaque trajet, indices [entrée, sortie] des points de traversée du rond-point
 * (clignotants).
 */
function deliveryRoutes(p, street, oz, site) {
  const { hub, gate, road } = site;
  const avenue = site.streets.find((s) => s.axis === 'z' && s.main);
  const { ox } = p;
  const { zs, truck } = warehouseDocks(p.interior.depth, oz);
  const wall = p.cx + (ox * p.interior.width) / 2;
  const dockZ = p.cz + zs[truck];
  const start = [wall + ox * (TRUCK.dockGap + TRUCK.bogie), dockZ];
  const stripX = wall + ox * (TRUCK.dockGap + TRUCK.axle + TRUCK_TURN); // allée de manœuvre de l'annexe
  const beyond = [stripX, dockZ + oz * (TRUCK_TURN + TRUCK.axle - TRUCK.bogie + 0.4)];
  const laneE = laneOffset(street);
  const laneA = laneOffset(avenue);
  const laneR = road.width / 4;
  const away = road.from + 12;
  const rings = { outbound: [], inbound: [] };
  const ring = (route, key, ...arms) => {
    const pts = roundabout(hub, ...arms);
    rings[key].push([route.length, route.length + pts.length - 1]);
    route.push(...pts);
  };

  // Aller : file vers l'avenue sur la voie de l'îlot, puis file sud de l'avenue
  const outZ = street.z + rightOf([-ox, 0])[1] * laneE;
  const southX = gate.x + rightOf([0, 1])[0] * laneA;
  const outbound = [start, [stripX, dockZ], [stripX, outZ]];
  if (street.main) {
    ring(outbound, 'outbound', [ox, 0], laneE, [0, 1], laneA);
  } else {
    outbound.push([southX, outZ]);
    if (street.z < hub[1]) ring(outbound, 'outbound', [0, -1], laneA, [0, 1], laneA);
  }
  outbound.push([southX, road.z - laneR], [away, road.z - laneR]);

  // Retour : file nord de l'avenue, puis file vers l'entrepôt sur la voie de l'îlot
  const inZ = street.z + rightOf([ox, 0])[1] * laneE;
  const northX = gate.x + rightOf([0, -1])[0] * laneA;
  const inbound = [[away - 4, road.z + laneR], [northX, road.z + laneR]];
  if (street.main) {
    ring(inbound, 'inbound', [0, 1], laneA, [ox, 0], laneE);
  } else {
    if (street.z < hub[1]) ring(inbound, 'inbound', [0, 1], laneA, [0, -1], laneA);
    inbound.push([northX, inZ]);
  }
  inbound.push([stripX, inZ], beyond);

  return { id: p.block.id, outbound, inbound, dock: [start, [stripX, dockZ], beyond], rings };
}

/**
 * Positionne l'arborescence DUER dans la scène 3D et calcule le plan du site.
 * `skins` : choix des Paramètres (archétype de chaque GP, modèle de chaque UT), indexés par identifiant.
 */
export function layoutTwin(hierarchy, skins = {}) {
  if (!hierarchy) return hierarchy;

  const rawSigns = hierarchy.rawRiskSigns?.length ? hierarchy.rawRiskSigns : DEFAULT_DEMO_RISKSIGNS;
  const signsByElement = {};
  for (const s of rawSigns) {
    const enriched = enrichRiskSign(s);
    if (!signsByElement[enriched.fkElement]) signsByElement[enriched.fkElement] = [];
    signsByElement[enriched.fkElement].push(enriched);
  }
  const root = hierarchy.rootEntity ? cloneTree(hierarchy.rootEntity, signsByElement) : null;

  // Îlots : un bâtiment par GP de premier niveau, puis la zone extérieure des UT rattachées à la racine
  const blocks = root ? subGroups(root) : [];
  const rootUnits = root ? ownUnits(root) : [];
  if (rootUnits.length) {
    const allRisks = rootUnits.flatMap((u) => u.allRisks || []);
    blocks.push({
      id: `yard-${root.id}`,
      ref: 'EXT',
      label: 'Zone extérieure',
      description: '',
      elementType: 'groupment',
      isYard: true,
      selectTarget: root, // un clic sur la zone sélectionne l'entité mère
      children: rootUnits,
      directRisks: [],
      allRisks,
      stats: statsFromRisks(allRisks),
      directRiskSigns: [],
      allRiskSigns: rootUnits.flatMap((u) => u.allRiskSigns),
    });
  }

  const plans = blocks.map((block, idx) => {
    const interior = layoutInterior(block);
    const skin = block.isYard
      ? { autoArchetype: 'yard', archetype: 'yard', finish: undefined, themeColor: '#64748b' }
      : resolveBuildingSkin(skins, block.id, detectBuildingArchetype({ label: block.label, children: interior.units }, idx));
    interior.units.forEach((ut) => Object.assign(ut, resolveWorkUnitSkin(skins, ut, skin.archetype)));
    return { block, interior, skin };
  });

  // Grille d'îlots presque carrée, remplie rangée par rangée du nord au sud, d'ouest en est
  const C = Math.max(1, Math.ceil(Math.sqrt(plans.length)));
  const R = Math.max(1, Math.ceil(plans.length / C));
  const L = Math.floor(C / 2); // colonnes à l'ouest de l'avenue
  const M = Math.max(1, Math.floor(R / 2)); // rangées au nord de la voie principale

  plans.forEach((p, i) => {
    p.col = i % C;
    p.row = Math.floor(i / C);
    p.ox = p.col >= L ? 1 : -1;
    const annex = OUTWARD_MARGIN[p.skin.archetype] ?? 2;
    p.left = p.ox < 0 ? annex : SIDE_MARGIN;
    p.right = p.ox > 0 ? annex : SIDE_MARGIN;
    p.fw = p.interior.width + p.left + p.right;
    p.fd = p.interior.depth + BACK_MARGIN + FRONT_MARGIN;
  });
  const colW = Array.from({ length: C }, (_, c) => Math.max(0, ...plans.filter((p) => p.col === c).map((p) => p.fw)));
  const rowD = Array.from({ length: R }, (_, r) => Math.max(0, ...plans.filter((p) => p.row === r).map((p) => p.fd)));
  const xs = allocate(colW, L, AVENUE_WIDTH, STREET_WIDTH);
  const zs = allocate(rowD, M, STREET_WIDTH, STREET_WIDTH);

  plans.forEach((p) => {
    const [x0, x1] = xs.bands[p.col];
    const [z0, z1] = zs.bands[p.row];
    const fx = p.col >= L ? x0 : x1 - p.fw;
    const fz = p.row >= M ? z0 : z1 - p.fd;
    p.footprint = { minX: fx, maxX: fx + p.fw, minZ: fz, maxZ: fz + p.fd };
    p.cx = fx + p.left + p.interior.width / 2;
    p.cz = fz + BACK_MARGIN + p.interior.depth / 2;
    // Voie Nord-Sud bordant l'îlot côté avenue (accès des opérateurs)
    p.accessX = p.col >= L ? xs.streets[p.col] : xs.streets[p.col + 1];
  });

  // Enceinte : îlots + carrefour central, marge de clôture, emprise minimale
  const [minX, maxX] = grow(
    Math.min(-AVENUE_WIDTH / 2, xs.bands[0][0]) - FENCE_MARGIN,
    Math.max(AVENUE_WIDTH / 2, xs.bands[C - 1][1]) + FENCE_MARGIN,
    MIN_SITE[0]
  );
  const [minZ, maxZ] = grow(
    Math.min(-STREET_WIDTH / 2, zs.bands[0][0]) - FENCE_MARGIN,
    Math.max(STREET_WIDTH / 2, zs.bands[R - 1][1]) + FENCE_MARGIN,
    MIN_SITE[1]
  );
  const fence = { minX, maxX, minZ, maxZ };

  // Voirie : voies Nord-Sud (avenue prolongée jusqu'à la route départementale) et Est-Ouest, carrefours
  const streets = [
    ...Object.entries(xs.streets).map(([b, x]) => {
      const main = Number(b) === L;
      return { axis: 'z', x, width: main ? AVENUE_WIDTH : STREET_WIDTH, from: minZ, to: maxZ + (main ? ROAD_OFFSET : 0), main };
    }),
    ...Object.entries(zs.streets).map(([b, z]) => ({ axis: 'x', z, width: STREET_WIDTH, from: minX, to: maxX, main: Number(b) === M })),
  ];
  const intersections = streets
    .filter((s) => s.axis === 'z')
    .flatMap((ns) => streets.filter((s) => s.axis === 'x').map((ew) => ({ x: ns.x, z: ew.z, hub: ns.main && ew.main, ns, ew })));
  const lots = [];
  for (let r = 0; r < R; r += 1) {
    for (let c = 0; c < C; c += 1) {
      lots.push({
        minX: xs.bands[c][0],
        maxX: xs.bands[c][1],
        minZ: zs.bands[r][0],
        maxZ: zs.bands[r][1],
        occupied: plans.some((p) => p.col === c && p.row === r),
      });
    }
  }

  // Coordonnées monde des bâtiments, zones de sous-groupement et UT ; couloirs intérieurs
  const walkGraph = createWalkGraph();
  const doors = new Map();
  const allWorkUnitsWorld = [];
  const buildings = plans.map((p) => {
    const { block, interior, skin } = p;
    const { cols, rows, width, depth } = interior;
    const localX = (col) => (col - (cols - 1) / 2) * CELL_W;
    const localZ = (row) => (row - (rows - 1) / 2) * CELL_D + 0.4;
    const focus = {
      position: [p.cx, 0, p.cz],
      radius: Math.max(width, depth) / 2,
      spawn: { x: p.cx, z: p.cz + depth / 2 + 2.4, yaw: 0 },
    };

    block.layout3D = {
      position: [p.cx, 0, p.cz],
      size: [width, BUILDING_HEIGHT, depth],
      themeColor: skin.themeColor,
      archetype: skin.archetype,
      autoArchetype: skin.autoArchetype,
      finish: skin.finish,
      // Côté extérieur (annexes) et voie d'accès côté avenue
      outward: [p.ox, p.row >= M ? 1 : -1],
      access: { x: p.accessX, side: p.col >= L ? -1 : 1 },
      focus,
    };

    block.workUnits = interior.cells.map(({ ut, col, row }) => {
      const local = [localX(col), 0.15, localZ(row)];
      const world = [p.cx + local[0], 0.15, p.cz + local[2]];
      ut.layout3D = {
        localPosition: local,
        worldPosition: world,
        size: UT_SIZE,
        focus: { position: world, radius: 2.4, spawn: { x: world[0], z: world[2] + 2.7, yaw: 0 } },
      };
      allWorkUnitsWorld.push(ut);
      return ut;
    });
    doors.set(p, interiorWalkways(walkGraph, p));

    block.zones = interior.zones.map(({ group, level, firstRow, lastRow }) => {
      const inset = 0.2 + 0.35 * (level - 1);
      const lz = (localZ(firstRow) + localZ(lastRow)) / 2;
      const size = [cols * CELL_W + 1.2 - inset * 2, UT_SIZE[1], (lastRow - firstRow + 1) * CELL_D - inset * 2];
      const world = [p.cx, 0, p.cz + lz];
      group.layout3D = {
        localPosition: [0, 0, lz],
        position: world,
        size,
        level,
        themeColor: skin.themeColor,
        // Apparition dans l'allée latérale, face à la zone
        focus: { position: world, radius: Math.max(size[0], size[2]) / 2, spawn: { x: p.cx - width / 2 + 1.5, z: world[2], yaw: -Math.PI / 2 } },
      };
      return group;
    });

    // Sous-groupements sans UT : la caméra cible leur bâtiment
    const visit = (group) =>
      subGroups(group).forEach((sub) => {
        if (!sub.layout3D) sub.layout3D = { focus };
        visit(sub);
      });
    visit(block);
    return block;
  });

  // Couloirs piétons extérieurs sur l'emprise bâtie (îlots + carrefour central)
  const nsOffsets = streets.filter((s) => s.axis === 'z').map((s) => [s.x, s.width / 2 + LANE]);
  const ewOffsets = streets.filter((s) => s.axis === 'x').map((s) => [s.z, s.width / 2 + LANE]);
  const extent = {
    minX: Math.min(xs.bands[0][0], ...nsOffsets.map(([x, o]) => x - o)),
    maxX: Math.max(xs.bands[C - 1][1], ...nsOffsets.map(([x, o]) => x + o)),
    minZ: Math.min(zs.bands[0][0], ...ewOffsets.map(([z, o]) => z - o)),
    maxZ: Math.max(zs.bands[R - 1][1], ...ewOffsets.map(([z, o]) => z + o)),
  };
  const crosswalks = outdoorWalkways(walkGraph, streets, extent, plans, doors);
  const walk = walkwayRendering(walkGraph, buildings);
  buildings.forEach((b) => {
    b.layout3D.walkways = walk.local.get(b.id);
  });

  const elementsById = {};
  const index = (node) => {
    elementsById[node.id] = node;
    node.children.forEach(index);
  };
  if (root) {
    root.layout3D = { position: [0, 0, 0] };
    index(root);
  }
  buildings.forEach((b) => {
    elementsById[b.id] = b;
  });

  const center = [(minX + maxX) / 2, (minZ + maxZ) / 2];
  const radius = Math.hypot(maxX - minX, maxZ - minZ) / 2;
  // Route départementale devant le portail, prolongée jusque dans le brouillard (départ et retour des camions)
  const roadHalf = radius + 110 * siteScale({ radius });
  const site = {
    hub: [0, 0],
    fence,
    gate: { x: 0, z: maxZ },
    road: { z: maxZ + ROAD_OFFSET, width: ROAD_WIDTH, from: center[0] - roadHalf, to: center[0] + roadHalf },
    streets,
    intersections,
    crosswalks,
    walkways: walk.outdoor,
    walkGraph: walk.graph,
    lots,
    footprints: plans.map((p) => p.footprint),
    center,
    radius,
  };
  // Une semi-remorque par entrepôt, sur la voie qui borde son îlot côté rond-point
  site.deliveries = plans
    .filter((p) => p.skin.archetype === 'logistics')
    .map((p) => {
      const z = zs.streets[p.row >= M ? p.row : p.row + 1];
      const street = streets.find((s) => s.axis === 'x' && Math.abs(s.z - z) < 0.01);
      return deliveryRoutes(p, street, p.row >= M ? 1 : -1, site);
    });

  return {
    ...hierarchy,
    rootEntity: root,
    buildings,
    allWorkUnitsWorld,
    elementsById,
    site,
  };
}
