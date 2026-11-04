import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import { getMaterial, Cylinder, WalkwayStrip } from '../3d/models/kit';
import { getTexture } from '../3d/models/textures';
import BuildingShell from '../3d/models/buildingShells';
import { BUILDING_STYLES, FLOOR_STYLES, DOOR_KINDS, SURFACE_MATERIALS, PREFAB_THEME } from '../../services/editorCatalog';
import {
  FLOOR_Y,
  STOREY_SLAB,
  buildingLevels,
  levelOf,
  levelOffset,
  polygonEdges,
  polygonCentroid,
  segmentLength,
  wallSpans,
} from '../../services/editorScene';

/**
 * Structures de l'éditeur de site : bâtiments personnalisés (contour polygonal libre, façades percées de
 * portes, planchers d'étage, toit plat), bâtiments modèles du jumeau, murs intérieurs / cloisons / grillages,
 * sols extérieurs et allées piétonnes. `bind` porte les gestionnaires de pointeur des maillages cliquables
 * (sélection, déplacement). La vue peut être coupée à un niveau (`cutLevel`) : les murs s'arrêtent au plafond
 * de ce niveau, ou à hauteur d'appui (`lowWalls`) pour travailler en vue de dessus.
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
/** Hauteur des murs arasés (vue de dessus). */
export const LOW_WALL = 0.9;
const FRAME = '#334155';
const GLASS = { color: '#bae6fd', opacity: 0.26, metalness: 0.6, roughness: 0.1 };
export const SELECT_COLOR = '#38bdf8';
export const HOVER_COLOR = '#7dd3fc';

// Texture murale : une répétition tous les 3 unités (4,5 m), dans le repère du mur
const WALL_TILE = 3;

/**
 * Pavé de mur dont les coordonnées de texture suivent les dimensions réelles : la texture garde son échelle
 * sur les petits morceaux (trumeaux, linteaux, tranches) et reste continue d'un morceau à l'autre du même mur.
 */
function wallBoxGeometry(from, to, y0, y1, thickness) {
  const geo = new THREE.BoxGeometry(to - from, y1 - y0, thickness);
  const cx = (from + to) / 2;
  const cy = (y0 + y1) / 2;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) + cx;
    const y = pos.getY(i) + cy;
    const z = pos.getZ(i);
    if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / WALL_TILE, y / WALL_TILE);
    else if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / WALL_TILE, z / WALL_TILE);
    else uv.setXY(i, x / WALL_TILE, y / WALL_TILE);
  }
  uv.needsUpdate = true;
  return geo;
}

function TexturedSlab({ from, to, y0, y1, thickness, material, bind }) {
  const geometry = useMemo(() => wallBoxGeometry(from, to, y0, y1, thickness), [from, to, y0, y1, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (to - from < 0.01 || y1 - y0 < 0.01) return null;
  // Géométrie centrée : le maillage est placé au milieu du morceau de mur (comme Slab)
  return <mesh geometry={geometry} material={material} position={[(from + to) / 2, (y0 + y1) / 2, 0]} castShadow receiveShadow {...bind} />;
}

/** Pavé cliquable orienté le long d'un mur (repère local : X le long du mur, origine au début du mur). */
function Slab({ from, to, y0, y1, thickness, material, bind, shadow = true }) {
  if (to - from < 0.01 || y1 - y0 < 0.01) return null;
  return (
    <mesh
      geometry={UNIT_BOX}
      material={material}
      position={[(from + to) / 2, (y0 + y1) / 2, 0]}
      scale={[to - from, y1 - y0, thickness]}
      castShadow={shadow}
      receiveShadow
      {...bind}
    />
  );
}

/** Groupe orienté de a vers b (X local le long du segment). */
function Along({ a, b, children }) {
  const angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
  return (
    <group position={[a[0], 0, a[1]]} rotation={[0, angle, 0]}>
      {children}
    </group>
  );
}

/**
 * Encadrement d'une ouverture (montants et linteau) et rideau enroulé d'un portail. Les montants débordent
 * d'1 cm dans l'ouverture et la traverse d'1 cm sous le linteau : aucune face confondue avec le mur.
 */
function DoorFrame({ opening, y0, height, kind, thickness }) {
  const frame = getMaterial({ color: FRAME, metalness: 0.5, roughness: 0.4 });
  const { from, to } = opening;
  // Toujours un peu plus épais que le mur (1 cm de chaque côté)
  const t = Math.max(0.32, thickness + 0.02);
  return (
    <>
      <Slab from={from - 0.06} to={from + 0.01} y0={y0} y1={y0 + height} thickness={t} material={frame} shadow={false} />
      <Slab from={to - 0.01} to={to + 0.06} y0={y0} y1={y0 + height} thickness={t} material={frame} shadow={false} />
      <Slab from={from - 0.06} to={to + 0.06} y0={y0 + height - 0.01} y1={y0 + height + 0.08} thickness={t} material={frame} shadow={false} />
      {kind === 'portail' && (
        <Slab from={from} to={to} y0={y0 + height - 0.3} y1={y0 + height - 0.01} thickness={t + 0.08} material={getMaterial({ color: '#64748b', metalness: 0.5, roughness: 0.5 })} shadow={false} />
      )}
    </>
  );
}

/**
 * Mur rectiligne percé d'ouvertures : plein texturé, mur-rideau vitré, grillage ou muret.
 * `style` : { kind: 'solid' | 'glass' | 'fence', material, frame }. Les pleins vont de `base` au sommet ; les
 * ouvertures partent du sol `y0` ; `height` est la hauteur du mur au-dessus de `y0`, `top` (absolu) le coupe
 * (vue arasée ou coupée à un niveau : sans linteau ni encadrement sous la hauteur d'une porte).
 */
function WallRun({ a, b, base = 0, y0, height, top: cut = Infinity, thickness, doors, style, bind, extend = 0 }) {
  const length = segmentLength(a, b);
  const top = Math.min(y0 + height, cut);
  if (top - base < 0.01) return null;
  const low = top - y0 < 1.2;
  const { solids, openings } = wallSpans(length, doors);
  // Prolongement aux extrémités (angles des façades) sans toucher aux ouvertures
  const pieces = solids.map((s) => ({ from: s.from === 0 ? -extend : s.from, to: s.to === length ? length + extend : s.to }));
  const frame = getMaterial({ color: style.frame || FRAME, metalness: 0.5, roughness: 0.4 });

  return (
    <Along a={a} b={b}>
      {pieces.map((p) => {
        if (style.kind === 'glass') {
          const mullions = Math.max(1, Math.round((p.to - p.from) / 1.6));
          return (
            <group key={p.from}>
              <Slab from={p.from} to={p.to} y0={base} y1={Math.min(top, y0 + 0.32)} thickness={thickness} material={frame} bind={bind} />
              <Slab from={p.from} to={p.to} y0={y0 + 0.32} y1={top - 0.14} thickness={thickness * 0.35} material={getMaterial(GLASS)} bind={bind} shadow={false} />
              <Slab from={p.from} to={p.to} y0={top - 0.14} y1={top} thickness={thickness} material={frame} bind={bind} />
              {Array.from({ length: mullions + 1 }, (_, i) => {
                const x = p.from + ((p.to - p.from) * i) / mullions;
                return <Slab key={i} from={x - 0.03} to={x + 0.03} y0={y0 + 0.32} y1={top - 0.14} thickness={thickness * 0.7} material={frame} shadow={false} />;
              })}
            </group>
          );
        }
        if (style.kind === 'fence') {
          const posts = Math.max(1, Math.round((p.to - p.from) / 1.2));
          return (
            <group key={p.from}>
              <Slab from={p.from} to={p.to} y0={y0 + 0.05} y1={top - 0.05} thickness={0.02} material={style.material} bind={bind} shadow={false} />
              <Slab from={p.from} to={p.to} y0={top - 0.05} y1={top} thickness={0.05} material={frame} shadow={false} />
              {Array.from({ length: posts + 1 }, (_, i) => (
                <Cylinder key={i} position={[p.from + ((p.to - p.from) * i) / posts, (y0 + top) / 2, 0]} radius={0.03} height={top - y0} color={style.frame || FRAME} metal={0.5} />
              ))}
            </group>
          );
        }
        // Mur texturé : coordonnées de texture à l'échelle réelle (voir wallBoxGeometry)
        if (style.worldUv) return <TexturedSlab key={p.from} from={p.from} to={p.to} y0={base} y1={top} thickness={thickness} material={style.material} bind={bind} />;
        return <Slab key={p.from} from={p.from} to={p.to} y0={base} y1={top} thickness={thickness} material={style.material} bind={bind} />;
      })}
      {openings.map((o) => {
        const kind = o.door.kind || 'porte';
        if (kind === 'window') {
          // Baie de fenêtre (hauteurs absolues) : allège sous l'appui, linteau au-dessus ; le vitrage est porté
          // par l'élément « Fenêtres de façade » plaqué devant
          const Piece = style.worldUv ? TexturedSlab : Slab;
          const sill = Math.min(o.door.sill, top);
          return (
            <group key={`o${o.from}`}>
              {sill - base > 0.01 && <Piece from={o.from} to={o.to} y0={base} y1={sill} thickness={thickness} material={style.material} bind={bind} />}
              {top - o.door.head > 0.01 && <Piece from={o.from} to={o.to} y0={o.door.head} y1={top} thickness={thickness} material={style.material} bind={bind} />}
            </group>
          );
        }
        const doorHeight = Math.min(DOOR_KINDS[kind].height, height - 0.15);
        const lintel = !low && style.kind !== 'fence' && top - (y0 + doorHeight) > 0.05;
        const LintelSlab = style.worldUv ? TexturedSlab : Slab;
        return (
          <group key={`o${o.from}`}>
            {lintel && (
              <LintelSlab
                from={o.from}
                to={o.to}
                y0={y0 + doorHeight}
                y1={top}
                thickness={thickness}
                material={style.kind === 'glass' ? frame : style.material}
                bind={bind}
              />
            )}
            {!low && style.kind !== 'fence' && kind !== 'passage' && <DoorFrame opening={o} y0={y0} height={doorHeight} kind={kind} thickness={thickness} />}
          </group>
        );
      })}
    </Along>
  );
}

/** Contour au sol → géométrie extrudée (dalle, toit) ou plane (sol), dans le plan XZ ; `holes` : trémies. */
function usePolygonGeometry(polygon, depth, holes = null) {
  const key = JSON.stringify([polygon, holes]);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(polygon.map(([x, z]) => new THREE.Vector2(x, -z)));
    (holes || []).forEach((hole) => shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z)))));
    const geo = depth ? new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

function textured(spec, rx, ry, extra = {}) {
  return getMaterial({ color: spec.color, map: spec.map ? getTexture(spec.map, rx, ry) : null, roughness: 0.8, metalness: 0.15, ...extra });
}

/** Contour fermé de sélection / survol, posé au-dessus de la dalle. */
export function Outline({ points, y, color, closed = true, width = 2.5 }) {
  const pts = points.map(([x, z]) => [x, y, z]);
  if (closed) pts.push(pts[0]);
  return <Line points={pts} color={color} lineWidth={width} depthTest={false} renderOrder={10} />;
}

/** Étiquette HTML : taille fixe pour les bâtiments et les cotes, décroissante avec la distance sinon. */
export function Label({ position, children, tone = 'building' }) {
  const distanceFactor = { npc: 26, element: 20 }[tone];
  return (
    <Html position={position} center distanceFactor={distanceFactor} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className={`editor-label ${tone}`}>{children}</div>
    </Html>
  );
}

/**
 * Plancher d'étage : sol du niveau (revêtement du bâtiment) posé 2 cm au-dessus d'une dalle enduite, dont la
 * sous-face fait le plafond du niveau inférieur ; trémies des escaliers découpées dans les deux.
 */
function StoreyFloor({ polygon, holes, y, material, bind }) {
  const slab = usePolygonGeometry(polygon, STOREY_SLAB - 0.02, holes);
  const floor = usePolygonGeometry(polygon, 0, holes);
  return (
    <>
      <mesh geometry={slab} position={[0, y - STOREY_SLAB, 0]} material={getMaterial({ color: '#f3eee4', roughness: 0.9, metalness: 0 })} castShadow receiveShadow {...bind} />
      <mesh geometry={floor} position={[0, y, 0]} material={material} receiveShadow {...bind} />
    </>
  );
}

/**
 * Bâtiment personnalisé : dalle, façades le long du contour (portes par niveau), planchers d'étage, toit plat
 * facultatif. `cutLevel` (null : tous les niveaux) coupe les murs au plafond de ce niveau (au-dessus d'appui avec
 * `lowWalls`) et masque les planchers supérieurs ; `openings` : trémies des escaliers (JSON par niveau d'arrivée).
 */
export function CustomBuilding({ building, bind, highlight, showRoof, lowWalls, cutLevel = null, openings = '', windows = '', showLabel }) {
  const { polygon, height, wallThickness: t } = building;
  const levels = buildingLevels(building);
  const slab = usePolygonGeometry(polygon, FLOOR_Y);
  const roof = usePolygonGeometry(polygon, 0.18);
  const holes = useMemo(() => (openings ? JSON.parse(openings) : {}), [openings]);
  // Baies percées derrière les fenêtres de façade (JSON 'arête:niveau' → baies)
  const bays = useMemo(() => (windows ? JSON.parse(windows) : {}), [windows]);
  const styleDef = BUILDING_STYLES[building.style] || BUILDING_STYLES.bardage;
  const floorDef = FLOOR_STYLES[building.floor] || FLOOR_STYLES.beton;
  const floorMaterial = textured({ ...floorDef, color: building.floorColor }, 0.25, 0.25, { roughness: 0.65 });
  // Ouvertures par façade et par niveau (une porte d'étage ne perce que son niveau)
  const doorsByBand = (building.doors || []).reduce((acc, door) => {
    (acc[`${door.edge}:${Math.min(levelOf(door), levels - 1)}`] ||= []).push(door);
    return acc;
  }, {});
  const [cx, cz] = polygonCentroid(polygon);
  // Angles : les deux murs se prolongent d'une demi-épaisseur ; un mur sur deux est rentré d'1 cm (2 cm pour le
  // dernier d'un contour impair) pour qu'aucune face ne coïncide avec celle du voisin (scintillement des textures)
  const inset = (i) => 0.01 * (polygon.length % 2 && i === polygon.length - 1 ? 2 : i % 2);
  // Façade texturée : texture à l'échelle réelle (répétition 1, coordonnées calculées par pavé, continues d'un niveau à l'autre)
  const style = styleDef.glass
    ? { kind: 'glass', frame: building.wallColor }
    : { kind: 'solid', material: textured({ map: styleDef.map, color: building.wallColor }, 1, 1), worldUv: Boolean(styleDef.map) };

  // Coupe de la vue : murs arrêtés au plafond du niveau affiché (le dernier niveau reste entier), ou arasés
  const roofTop = FLOOR_Y + height;
  let cut = Infinity;
  if (cutLevel != null) {
    if (lowWalls) cut = FLOOR_Y + levelOffset(cutLevel) + LOW_WALL;
    else if (cutLevel < levels - 1) cut = FLOOR_Y + levelOffset(cutLevel + 1);
  }
  // Une bande de façade par niveau : ses pleins partent de son plancher (du terrain au rez-de-chaussée)
  const bands = Array.from({ length: levels }, (_, k) => {
    const y0 = FLOOR_Y + levelOffset(k);
    const bandTop = k === levels - 1 ? roofTop : Math.min(roofTop, FLOOR_Y + levelOffset(k + 1));
    return { k, y0, base: k === 0 ? 0 : y0, height: bandTop - y0 };
  }).filter((band) => band.height > 0.05);
  const floors = bands.filter((band) => band.k > 0 && band.y0 < roofTop - 0.3 && (cutLevel == null || band.k <= cutLevel));

  return (
    <group>
      <mesh geometry={slab} material={floorMaterial} receiveShadow {...bind} />
      {floors.map((band) => (
        <StoreyFloor key={band.k} polygon={polygon} holes={holes[band.k] || null} y={band.y0} material={floorMaterial} bind={bind} />
      ))}
      {polygonEdges(polygon).map(([a, b], i) =>
        bands.map((band) => (
          <WallRun
            key={`${i}:${band.k}`}
            a={a}
            b={b}
            base={band.base}
            y0={band.y0}
            height={band.height}
            top={cut}
            thickness={t - 2 * inset(i)}
            doors={[...(doorsByBand[`${i}:${band.k}`] || []), ...(bays[`${i}:${band.k}`] || [])]}
            style={style}
            bind={bind}
            extend={t / 2 - inset(i)}
          />
        ))
      )}
      {showRoof && cutLevel == null && (
        <mesh geometry={roof} position={[0, roofTop, 0]} material={getMaterial({ color: styleDef.roof, roughness: 0.7, metalness: 0.3 })} castShadow receiveShadow {...bind} />
      )}
      {highlight && <Outline points={polygon} y={FLOOR_Y + 0.03} color={highlight} />}
      {showLabel && <Label position={[cx, Math.min(roofTop, cut) + 1.1, cz]}>{building.name}</Label>}
    </group>
  );
}

const WALL_STYLE = {
  plein: (wall) => ({ kind: 'solid', material: getMaterial({ color: wall.color, roughness: 0.85 }) }),
  muret: (wall) => ({ kind: 'solid', material: getMaterial({ color: wall.color, map: getTexture('concrete', 1, 1), roughness: 0.9 }), worldUv: true }),
  vitre: (wall) => ({ kind: 'glass', frame: wall.color }),
  grillage: (wall) => ({ kind: 'fence', frame: wall.color, material: getMaterial({ color: '#94a3b8', opacity: 0.35, metalness: 0.6, roughness: 0.4, doubleSide: true }) }),
};

/**
 * Mur intérieur, cloison vitrée, grillage ou muret (segment a → b, porte facultative), posé sur le sol `y0` de
 * son niveau. `base` : bas des pleins (terrain au rez-de-chaussée, noyé dans le plancher en étage) ;
 * `maxHeight` : hauteur libre du niveau (la cloison s'arrête dans le plancher supérieur ou sous le toit) ;
 * `cut` : coupe absolue de la vue (murs arasés).
 */
export function InteriorWall({ wall, y0, base = 0, maxHeight = Infinity, cut = Infinity, bind, highlight }) {
  const style = (WALL_STYLE[wall.type] || WALL_STYLE.plein)(wall);
  const length = segmentLength(wall.a, wall.b);
  const height = Math.min(wall.height, maxHeight);
  const shown = Math.max(0, Math.min(y0 + height, cut) - y0);
  return (
    <group>
      <WallRun
        a={wall.a}
        b={wall.b}
        base={base}
        y0={y0}
        height={height}
        top={cut}
        thickness={wall.thickness}
        doors={wall.door ? [wall.door] : []}
        style={style}
        bind={bind}
        extend={wall.type === 'grillage' ? 0 : wall.thickness / 2}
      />
      {highlight && (
        <Along a={wall.a} b={wall.b}>
          <Outline
            points={[
              [-0.08, -wall.thickness / 2 - 0.08],
              [length + 0.08, -wall.thickness / 2 - 0.08],
              [length + 0.08, wall.thickness / 2 + 0.08],
              [-0.08, wall.thickness / 2 + 0.08],
            ]}
            y={y0 + shown + 0.04}
            color={highlight}
          />
        </Along>
      )}
    </group>
  );
}

const surfaceMaterials = new Map();
export const SURFACE_LEVELS = 12;

/**
 * Matériau d'un sol extérieur, repoussé en profondeur (polygon offset) d'autant moins que son rang est élevé :
 * les sols superposés, les allées, les marquages et la grille restent devant sans scintiller, quelle que
 * soit la distance de la caméra (quelques millimètres d'écart en hauteur n'y suffisent pas de loin).
 */
function surfaceMaterial(def, level) {
  const rank = level % SURFACE_LEVELS;
  const key = `${def.map}|${def.color}|${rank}`;
  if (!surfaceMaterials.has(key)) {
    const offset = 2 * (SURFACE_LEVELS - rank);
    surfaceMaterials.set(
      key,
      new THREE.MeshStandardMaterial({
        color: def.color,
        map: def.map ? getTexture(def.map, 0.25, 0.25) : null,
        roughness: 0.9,
        metalness: 0,
        polygonOffset: true,
        polygonOffsetFactor: offset,
        polygonOffsetUnits: offset * 2,
      })
    );
  }
  return surfaceMaterials.get(key);
}

/** Sol extérieur (enrobé, pavés, béton, gazon, résine). `level` ordonne les sols superposés. */
export function Surface({ surface, level, bind, highlight }) {
  const geometry = usePolygonGeometry(surface.polygon, 0);
  const def = SURFACE_MATERIALS[surface.material] || SURFACE_MATERIALS.asphalte;
  const y = 0.004 + (level % SURFACE_LEVELS) * 0.0012;
  return (
    <group>
      <mesh geometry={geometry} position={[0, y, 0]} material={surfaceMaterial(def, level)} receiveShadow {...bind} />
      {highlight && <Outline points={surface.polygon} y={y + 0.02} color={highlight} />}
    </group>
  );
}

/** Allée piétonne balisée (ou passage piéton zébré) ; boîte invisible pour la sélection. */
export function Walkway({ walkway, y, bind, highlight }) {
  const length = segmentLength(walkway.a, walkway.b);
  return (
    <group>
      <WalkwayStrip from={walkway.a} to={walkway.b} y={y + 0.006} width={walkway.width} zebra={walkway.zebra} />
      <Along a={walkway.a} b={walkway.b}>
        {/* Volume de sélection invisible (le raycasting ignore la visibilité) */}
        <mesh geometry={UNIT_BOX} visible={false} position={[length / 2, y + 0.03, 0]} scale={[length, 0.06, walkway.width]} {...bind} />
        {highlight && (
          <Outline
            points={[
              [0, -walkway.width / 2 - 0.06],
              [length, -walkway.width / 2 - 0.06],
              [length, walkway.width / 2 + 0.06],
              [0, walkway.width / 2 + 0.06],
            ]}
            y={y + 0.05}
            color={highlight}
          />
        )}
      </Along>
    </group>
  );
}

/** Bâtiment modèle du jumeau : fondation cliquable et enveloppe détaillée (annexes du côté choisi). */
export function PrefabBuilding({ prefab, bind, highlight, showRoof, showLabel }) {
  const { width, depth, height } = prefab;
  const theme = PREFAB_THEME[prefab.archetype] || '#3b82f6';
  return (
    <group position={[prefab.position[0], 0, prefab.position[1]]} rotation={[0, (prefab.rotation * Math.PI) / 180, 0]}>
      <mesh geometry={UNIT_BOX} position={[0, FLOOR_Y / 2, 0]} scale={[width, FLOOR_Y, depth]} material={getMaterial({ color: '#334155', roughness: 0.75, metalness: 0.15 })} receiveShadow {...bind} />
      <BuildingShell
        archetype={prefab.archetype}
        finish={prefab.finish}
        width={width}
        height={height}
        depth={depth}
        themeColor={theme}
        outward={[prefab.flip ? -1 : 1, 1]}
        showRoof={showRoof}
        highlight={Boolean(highlight)}
      />
      {highlight && (
        <Outline
          points={[
            [-width / 2, -depth / 2],
            [width / 2, -depth / 2],
            [width / 2, depth / 2],
            [-width / 2, depth / 2],
          ]}
          y={FLOOR_Y + 0.03}
          color={highlight}
        />
      )}
      {showLabel && <Label position={[0, height + 3, 0]}>{prefab.name}</Label>}
    </group>
  );
}
