import { elementBox, ELEMENT_KINDS } from './editorCatalog';
import {
  FLOOR_Y,
  LEVEL_HEIGHT,
  MAX_LEVELS,
  buildingLevels,
  groundHeightAt,
  levelOf,
  levelOffset,
  pointInPolygon,
  polygonEdges,
  projectOnSegment,
  rectCorners,
  rotatePoint,
  segmentLength,
  stairFlights,
  stairHeightAt,
  wallSpans,
} from './editorScene';

/**
 * Physique de la visite en première personne de l'éditeur (sans rendu, testable hors navigateur) :
 * collisions au sol (2D) contre les façades des bâtiments (hors portes), les murs et cloisons, les garde-corps
 * des escaliers et l'emprise des éléments — seulement ceux du niveau où se trouve le visiteur — et hauteur
 * du sol suivi : le plus haut des planchers (terrain, dalles, étages hors trémies, marches) à portée de pas.
 */

export const RADIUS = 0.3;
export const STEP_UP = 0.35; // hauteur franchie d'un pas (seuils, marches)
// Les marches débordent un peu de la volée : aucune bande sans plancher entre la dernière marche et le palier
const RAMP_MARGIN = 0.12;
const FLAT_KINDS = new Set(['floorzone', 'pallet', 'carton']);

/** Niveau du visiteur d'après la hauteur de ses pieds (bascule aux deux tiers d'une volée). */
export const levelAt = (feet) => Math.max(0, Math.min(MAX_LEVELS - 1, Math.floor((feet - FLOOR_Y + 0.9) / LEVEL_HEIGHT)));

/**
 * Monde de la visite : obstacles par niveau — segments épais (façades par niveau, murs, garde-corps des
 * escaliers, valables du niveau `lo` au niveau `hi`) et boîtes orientées (éléments) —, planchers d'étage
 * percés de leurs trémies, et volées d'escalier.
 */
export function buildWorld(scene) {
  const segments = [];
  const addRun = (a, b, thickness, doors, lo, hi = lo) => {
    const length = segmentLength(a, b);
    if (length < 0.01) return;
    const ux = (b[0] - a[0]) / length;
    const uz = (b[1] - a[1]) / length;
    wallSpans(length, doors).solids.forEach(({ from, to }) => {
      segments.push({ a: [a[0] + ux * from, a[1] + uz * from], b: [a[0] + ux * to, a[1] + uz * to], half: thickness / 2, lo, hi });
    });
  };
  scene.buildings.forEach((building) => {
    const levels = buildingLevels(building);
    polygonEdges(building.polygon).forEach(([a, b], i) => {
      for (let k = 0; k < levels; k += 1) {
        const doors = building.doors.filter((d) => d.edge === i && Math.min(levelOf(d), levels - 1) === k);
        addRun(a, b, building.wallThickness, doors, k);
      }
    });
  });
  scene.walls.forEach((wall) => addRun(wall.a, wall.b, wall.thickness, wall.door ? [wall.door] : [], levelOf(wall)));

  // Escaliers : flancs fermés sur la volée et autour de la trémie, dos plein au départ, garde-corps au bout de la trémie
  const flights = stairFlights(scene);
  flights.forEach((f) => {
    const at = (lx, lz) => rotatePoint([f.position[0] + lx, f.position[1] + lz], f.rotation, f.position);
    const [w, l] = [f.width / 2, f.length / 2];
    const rail = (p, q, lo, hi) => segments.push({ a: at(...p), b: at(...q), half: 0.04, lo, hi });
    rail([-w, -l], [-w, l + 0.07], f.level, f.level + 1);
    rail([w, -l], [w, l + 0.07], f.level, f.level + 1);
    rail([-w, -l], [w, -l], f.level, f.level);
    rail([-w, l + 0.07], [w, l + 0.07], f.level + 1, f.level + 1);
  });

  const boxes = scene.elements
    // Éléments plats ou posés en hauteur / plaqués sur une façade (toiture, fronton, fenêtres), escaliers : pas de boîte
    .filter((el) => !FLAT_KINDS.has(el.kind) && !ELEMENT_KINDS[el.kind]?.overhead && !ELEMENT_KINDS[el.kind]?.stairs)
    .map((el) => {
      const { size, center } = elementBox(el);
      return { position: el.position, rotation: el.rotation, half: [size[0] / 2, size[2] / 2], offset: [center[0], center[2]], level: levelOf(el) };
    });

  // Trémies de la visite : l'emprise exacte des volées (la marge de 2 cm du rendu n'ouvre pas de vide)
  const openings = flights.map((f) => ({ level: f.level + 1, polygon: rectCorners(f.position, [f.width, f.length], f.rotation) }));
  const floors = scene.buildings
    .filter((b) => buildingLevels(b) > 1)
    .map((b) => ({
      polygon: b.polygon,
      levels: Array.from({ length: buildingLevels(b) - 1 }, (_, i) => i + 1)
        .filter((k) => levelOffset(k) < b.height - 0.3)
        .map((k) => ({ y: FLOOR_Y + levelOffset(k), holes: openings.filter((o) => o.level === k).map((o) => o.polygon) })),
    }));
  return { segments, boxes, floors, flights, byLevel: new Map() };
}

/** Obstacles valables au niveau `level` (mis en cache). */
export function obstaclesAt(world, level) {
  if (!world.byLevel.has(level)) {
    world.byLevel.set(level, {
      segments: world.segments.filter((s) => s.lo <= level && level <= s.hi),
      boxes: world.boxes.filter((b) => b.level === level),
    });
  }
  return world.byLevel.get(level);
}

/**
 * Sol sous le point p : le plus haut des planchers à portée de pas depuis `feet` (sinon le plus bas : chute).
 * Sur l'emprise d'une volée, jamais sous les marches (l'escalier est plein) : on reste sur la volée.
 */
export function floorAt(scene, world, p, feet) {
  let best = -Infinity;
  let lowest = Infinity;
  const consider = (h) => {
    if (h <= feet + STEP_UP && h > best) best = h;
    if (h < lowest) lowest = h;
  };
  consider(groundHeightAt(scene, p[0], p[1]));
  world.floors.forEach((f) => {
    if (!pointInPolygon(p, f.polygon)) return;
    f.levels.forEach(({ y, holes }) => {
      if (!holes.some((hole) => pointInPolygon(p, hole))) consider(y);
    });
  });
  let onFlight = -Infinity;
  world.flights.forEach((f) => {
    const h = stairHeightAt(f, p, RAMP_MARGIN);
    if (h !== null) consider(h);
    const inside = stairHeightAt(f, p);
    if (inside !== null) onFlight = Math.max(onFlight, inside);
  });
  const floor = best > -Infinity ? best : lowest;
  return Math.max(floor, onFlight);
}

/** Repousse le cercle (x, z) hors des obstacles. */
export function resolve(p, { segments, boxes }) {
  for (let pass = 0; pass < 3; pass += 1) {
    segments.forEach((s) => {
      const { point, dist } = projectOnSegment(p, s.a, s.b);
      const min = RADIUS + s.half;
      if (dist < min) {
        const nx = dist > 1e-5 ? (p[0] - point[0]) / dist : 1;
        const nz = dist > 1e-5 ? (p[1] - point[1]) / dist : 0;
        p[0] = point[0] + nx * min;
        p[1] = point[1] + nz * min;
      }
    });
    boxes.forEach((b) => {
      // Repère local de la boîte : rotation inverse autour de la position de l'élément
      const [lx, lz] = rotatePoint(p, -b.rotation, b.position);
      const cx = b.position[0] + b.offset[0];
      const cz = b.position[1] + b.offset[1];
      const qx = Math.max(cx - b.half[0], Math.min(cx + b.half[0], lx));
      const qz = Math.max(cz - b.half[1], Math.min(cz + b.half[1], lz));
      const dist = Math.hypot(lx - qx, lz - qz);
      if (dist >= RADIUS) return;
      let nx;
      let nz;
      if (dist > 1e-5) {
        nx = lx + ((lx - qx) / dist) * (RADIUS - dist);
        nz = lz + ((lz - qz) / dist) * (RADIUS - dist);
      } else {
        // Centre dans la boîte : sortie par le côté le plus proche
        const exits = [
          [cx - b.half[0] - RADIUS - lx, 0],
          [cx + b.half[0] + RADIUS - lx, 0],
          [0, cz - b.half[1] - RADIUS - lz],
          [0, cz + b.half[1] + RADIUS - lz],
        ].sort((u, v) => Math.hypot(...u) - Math.hypot(...v))[0];
        nx = lx + exits[0];
        nz = lz + exits[1];
      }
      [p[0], p[1]] = rotatePoint([nx, nz], b.rotation, b.position);
    });
  }
  return p;
}

/**
 * Un pas de déplacement de (dx, dz) : petits pas successifs (pas de cloison fine traversée), collisions du
 * niveau courant, sol suivi à chaque pas. Modifie `pos` et renvoie la nouvelle hauteur des pieds.
 */
export function walkStep(scene, world, pos, feet, dx, dz) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  let h = feet;
  for (let i = 0; i < steps; i += 1) {
    pos[0] += dx / steps;
    pos[1] += dz / steps;
    resolve(pos, obstaclesAt(world, levelAt(h)));
    h = floorAt(scene, world, pos, h);
  }
  return h;
}
