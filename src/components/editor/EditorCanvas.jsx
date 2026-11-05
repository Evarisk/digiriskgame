import React, { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Line } from '@react-three/drei';
import { StudioEnvironment } from '../3d/DigitalTwinCanvas';
import SkyDome, { SKY_HORIZON } from '../3d/SkyDome';
import { getTexture } from '../3d/models/textures';
import { Person } from '../3d/models/people';
import ElementModel from './ElementModel';
import EditorNpc from './EditorNpc';
import EditorWalk from './EditorWalk';
import EditorPostFx from './EditorPostFx';
import { CustomBuilding, InteriorWall, Surface, Walkway, PrefabBuilding, Outline, Label, SELECT_COLOR, HOVER_COLOR, LOW_WALL } from './EditorStructures';
import { elementBox, SHAPE_PRESETS, PREFAB_DEFAULT_SIZE, ELEMENT_KINDS } from '../../services/editorCatalog';
import {
  FLOOR_Y,
  MAX_LEVELS,
  levelOf,
  levelOffset,
  storeyHeightAt,
  stairOpeningsByBuilding,
  windowOpeningsByBuilding,
  groundHeightAt,
  moveItem,
  contentsOf,
  updateItem,
  insertVertex,
  removeVertex,
  findItem,
  rectCorners,
  rotatePoint,
  snapPoint,
  snapValue,
  polygonEdges,
  projectOnSegment,
  segmentLength,
  sceneBounds,
  toMeters,
  footprintOf,
  stretchAxes,
  stretchItem,
} from '../../services/editorScene';

/**
 * Vue 3D de l'éditeur de site : rendu de la scène, sélection et déplacement à la souris, poignées
 * (sommets des bâtiments et des sols, extrémités des murs, points de trajet des PNJ) et outils de
 * tracé (placement, contour polygonal, segments, trajet). Les clics des outils sont reçus par un plan
 * invisible au niveau du sol ; hors mode Sélection, les objets n'interceptent pas le pointeur.
 */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const BOX_EDGES = new THREE.EdgesGeometry(UNIT_BOX);
const UP = new THREE.Vector3(0, 1, 0);
const DRAG_THRESHOLD = 4; // px avant qu'un appui devienne un déplacement
const SNAP_RADIUS = 0.45; // aimantation aux sommets existants (unités)

/* ------------------------------------------------------------------ */
/* Position du curseur au sol (partagée par les aperçus des outils)    */
/* ------------------------------------------------------------------ */

let cursorPoint = null;
const cursorListeners = new Set();
function setCursor(point) {
  if (point === cursorPoint || (point && cursorPoint && point[0] === cursorPoint[0] && point[1] === cursorPoint[1])) return;
  cursorPoint = point;
  cursorListeners.forEach((notify) => notify());
}
function useCursor() {
  return useSyncExternalStore(
    (notify) => {
      cursorListeners.add(notify);
      return () => cursorListeners.delete(notify);
    },
    () => cursorPoint
  );
}

/**
 * Aimantation d'un point : sommet existant le plus proche (contours, murs), sinon arête la plus proche,
 * sinon grille. `skip(ref, index)` exclut le sommet en cours de déplacement.
 */
export function snapToScene(p, scene, step, skip = () => false) {
  const vertices = [];
  const edges = [];
  scene.buildings.forEach((b) => {
    b.polygon.forEach((v, i) => !skip(b.id, i) && vertices.push(v));
    edges.push(...polygonEdges(b.polygon));
  });
  scene.surfaces.forEach((s) => s.polygon.forEach((v, i) => !skip(s.id, i) && vertices.push(v)));
  scene.prefabs.forEach((m) => vertices.push(...footprintOf('prefabs', m)));
  scene.walls.forEach((w) => {
    if (!skip(w.id, 'a')) vertices.push(w.a);
    if (!skip(w.id, 'b')) vertices.push(w.b);
    edges.push([w.a, w.b]);
  });
  let best = null;
  let bestD = SNAP_RADIUS;
  vertices.forEach((v) => {
    const d = Math.hypot(v[0] - p[0], v[1] - p[1]);
    if (d < bestD) {
      best = v;
      bestD = d;
    }
  });
  if (best) return [...best];
  let edgeBest = null;
  let edgeD = SNAP_RADIUS * 0.7;
  edges.forEach(([a, b]) => {
    const proj = projectOnSegment(p, a, b);
    if (proj.dist < edgeD) {
      // Le long de l'arête, on garde un pas régulier depuis son origine
      const length = segmentLength(a, b);
      const t = step && length > 0 ? Math.min(1, Math.max(0, snapValue(proj.t * length, step) / length)) : proj.t;
      edgeBest = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      edgeD = proj.dist;
    }
  });
  return edgeBest || snapPoint(p, step);
}

/* ------------------------------------------------------------------ */
/* Objets posés                                                         */
/* ------------------------------------------------------------------ */

function BoxOutline({ size, center, color }) {
  return (
    <lineSegments geometry={BOX_EDGES} position={center} scale={[size[0] + 0.08, size[1] + 0.08, size[2] + 0.08]} renderOrder={10}>
      <lineBasicMaterial color={color} depthTest={false} transparent />
    </lineSegments>
  );
}

const PlacedElement = memo(function PlacedElement({ element, y, bind, highlight, showLabel, upperHidden }) {
  const { size, center } = elementBox(element);
  return (
    <group position={[element.position[0], y, element.position[1]]} rotation={[0, (element.rotation * Math.PI) / 180, 0]}>
      <ElementModel element={element} upperHidden={upperHidden} />
      <mesh geometry={UNIT_BOX} visible={false} position={center} scale={size} {...bind} />
      {highlight && <BoxOutline size={size} center={center} color={highlight} />}
      {showLabel && element.label && <Label position={[center[0], size[1] + 0.6, center[2]]} tone="element">{element.label}</Label>}
    </group>
  );
});

const MemoBuilding = memo(CustomBuilding);
const MemoPrefab = memo(PrefabBuilding);
const MemoWall = memo(InteriorWall);
const MemoSurface = memo(Surface);
const MemoWalkway = memo(Walkway);

/* ------------------------------------------------------------------ */
/* Poignées                                                             */
/* ------------------------------------------------------------------ */

function Handle({ position, onPointerDown, onDoubleClick, kind = 'vertex', title, scale = 1 }) {
  const [hover, setHover] = useState(false);
  const size = kind === 'insert' ? 0.16 : 0.24;
  const color = kind === 'insert' ? '#a7f3d0' : kind === 'route' ? '#fbbf24' : kind === 'stretch' ? '#38bdf8' : '#f8fafc';
  return (
    <mesh
      position={position}
      scale={scale}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
      renderOrder={12}
      userData={{ title }}
    >
      {kind === 'insert' ? (
        <octahedronGeometry args={[size, 0]} />
      ) : kind === 'stretch' ? (
        <boxGeometry args={[0.42, 0.42, 0.42]} />
      ) : (
        <sphereGeometry args={[size, 14, 10]} />
      )}
      <meshBasicMaterial color={hover ? (kind === 'stretch' ? '#f8fafc' : SELECT_COLOR) : color} depthTest={false} transparent opacity={0.95} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/* Aperçus des outils                                                   */
/* ------------------------------------------------------------------ */

function CursorMark({ point, y = 0.03 }) {
  if (!point) return null;
  return (
    <mesh position={[point[0], y, point[1]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={11}>
      <ringGeometry args={[0.16, 0.24, 24]} />
      <meshBasicMaterial color={SELECT_COLOR} depthTest={false} transparent opacity={0.9} />
    </mesh>
  );
}

/** Contour polygonal d'un modèle de forme ou d'emprise posé au curseur, tourné de `rotation` degrés. */
function placedPolygon(polygon, at, rotation) {
  return polygon.map((p) => rotatePoint([p[0] + at[0], p[1] + at[1]], rotation, at));
}

function PlaceGhost({ tool, scene }) {
  const point = useCursor();
  if (!point) return null;
  const { what } = tool;
  const rotation = tool.rotation || 0;
  const y = groundHeightAt(scene, point[0], point[1]);
  if (what.list === 'buildings') {
    return <Outline points={placedPolygon(SHAPE_PRESETS[what.preset].polygon, point, rotation)} y={0.05} color={SELECT_COLOR} />;
  }
  if (what.list === 'prefabs') {
    const [w, d] = PREFAB_DEFAULT_SIZE[what.archetype];
    return <Outline points={rectCorners(point, [w, d], rotation)} y={0.05} color={SELECT_COLOR} />;
  }
  if (what.list === 'npcs') {
    return (
      <group position={[point[0], y, point[1]]} rotation={[0, (rotation * Math.PI) / 180, 0]}>
        <Person outfit={what.outfit} />
        <CursorMark point={[0, 0]} y={0.03} />
      </group>
    );
  }
  const ghost = { id: 'ghost', kind: what.kind, position: point, rotation, ...what.patch };
  const { size, center } = elementBox(ghost);
  return (
    <group position={[point[0], y, point[1]]} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      <ElementModel element={ghost} />
      <BoxOutline size={size} center={center} color={SELECT_COLOR} />
    </group>
  );
}

function LengthTag({ a, b }) {
  const mid = [(a[0] + b[0]) / 2, 0.6, (a[1] + b[1]) / 2];
  return (
    <Label position={mid} tone="measure">
      {toMeters(segmentLength(a, b)).toLocaleString('fr-FR')} m
    </Label>
  );
}

function PolygonPreview({ tool }) {
  const point = useCursor();
  const pts = tool.points;
  const all = point ? [...pts, point] : pts;
  const closing = point && pts.length >= 3 && Math.hypot(point[0] - pts[0][0], point[1] - pts[0][1]) < 0.6;
  return (
    <>
      {all.length >= 2 && <Outline points={all} y={0.06} color={SELECT_COLOR} closed={pts.length >= 3} />}
      {pts.map((p, i) => (
        <CursorMark key={i} point={p} y={0.05} />
      ))}
      {point && pts.length > 0 && <LengthTag a={pts[pts.length - 1]} b={point} />}
      {closing && <Label position={[pts[0][0], 1.1, pts[0][1]]} tone="measure">Fermer le contour</Label>}
      <CursorMark point={point} />
    </>
  );
}

function SegmentPreview({ tool }) {
  const point = useCursor();
  return (
    <>
      {tool.start && point && (
        <>
          <Line points={[[tool.start[0], 0.08, tool.start[1]], [point[0], 0.08, point[1]]]} color={SELECT_COLOR} lineWidth={3} depthTest={false} renderOrder={11} />
          <LengthTag a={tool.start} b={point} />
        </>
      )}
      <CursorMark point={tool.start} y={0.05} />
      <CursorMark point={point} />
    </>
  );
}

function RoutePreview({ npc }) {
  const point = useCursor();
  if (!npc || !point) return <CursorMark point={point} />;
  const last = npc.route.length ? npc.route[npc.route.length - 1] : npc.position;
  return (
    <>
      <Line points={[[last[0], 0.1, last[1]], [point[0], 0.1, point[1]]]} color="#f59e0b" lineWidth={2.5} dashed dashSize={0.3} gapSize={0.2} depthTest={false} renderOrder={11} />
      <CursorMark point={point} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Caméra                                                               */
/* ------------------------------------------------------------------ */

function framePose(center, radius) {
  const [cx, cz] = center;
  return { target: new THREE.Vector3(cx, 0, cz), position: new THREE.Vector3(cx + radius * 0.15, radius * 1.0 + 8, cz + radius * 1.25 + 10) };
}

function CameraRig({ focus, enabled }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const goal = useRef(null);

  useEffect(() => {
    if (!focus) return;
    const pose = framePose(focus.center, focus.radius);
    if (focus.instant) {
      camera.position.copy(pose.position);
      controlsRef.current?.target.copy(pose.target);
      goal.current = null;
    } else goal.current = pose;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // Retour de la visite : la caméra orbitale vise le point du sol au centre de l'écran
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    const controls = controlsRef.current;
    const resumed = enabled && !wasEnabled.current;
    wasEnabled.current = enabled;
    if (!resumed || !controls) return;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    if (dir.y > -0.05) return;
    const t = -camera.position.y / dir.y;
    controls.target.set(camera.position.x + dir.x * t, 0, camera.position.z + dir.z * t);
    controls.update();
  }, [enabled, camera]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !goal.current) return;
    // Approche exponentielle indépendante de la cadence d'affichage
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    controls.target.lerp(goal.current.target, k);
    camera.position.lerp(goal.current.position, k);
    if (camera.position.distanceTo(goal.current.position) < 0.2) goal.current = null;
    controls.update();
  });

  if (!enabled) return null;
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minDistance={3}
      maxDistance={260}
      onStart={() => {
        goal.current = null;
      }}
    />
  );
}

function SunLight({ center, radius }) {
  const ref = useRef();
  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    light.target.position.set(center[0], 0, center[1]);
    light.target.updateMatrixWorld();
    const r = radius + 12;
    Object.assign(light.shadow.camera, { left: -r, right: r, top: r, bottom: -r, far: 400 });
    light.shadow.camera.updateProjectionMatrix();
  }, [center, radius]);
  return (
    <directionalLight
      ref={ref}
      castShadow
      color="#fff2df"
      position={[center[0] + 40, 70, center[1] + 34]}
      intensity={1.65}
      shadow-mapSize={[4096, 4096]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Scène                                                                */
/* ------------------------------------------------------------------ */

function EditorScene({ scene, selection, tool, view, walking, onSelect, onCommit, onPreview, onCheckpoint, onToolAction, focus }) {
  const { camera, gl, controls } = useThree();
  const [hovered, setHovered] = useState(null);
  const latest = useRef({});
  latest.current = { scene, onSelect, onCommit, onPreview, onCheckpoint, tool, view, controls };
  const drag = useRef(null);
  const editing = tool.mode === 'select' && !walking;

  // Arrondi de l'emprise : le ciel, le soleil et le terrain ne sont recalculés qu'aux changements notables
  const bounds = sceneBounds(scene);
  const roundTo = (v, s) => Math.round(v / s) * s;
  const cx = roundTo(bounds.center[0], 10);
  const cz = roundTo(bounds.center[1], 10);
  const radius = roundTo(bounds.radius, 10);
  const center = useMemo(() => [cx, cz], [cx, cz]);
  const skySite = useMemo(() => ({ center: [cx, cz], radius }), [cx, cz, radius]);
  // Le bord du terrain se fond dans la brume de l'horizon
  const fogNear = 90 + radius;
  const fogFar = 220 + radius * 2;
  const groundSize = 2 * (fogFar + 120);

  const groundAt = useMemo(() => (x, z) => groundHeightAt(scene, x, z), [scene]);
  // Sol de chaque niveau (personnages : une fonction stable par niveau tant que la scène ne change pas)
  const groundOfLevel = useMemo(
    () => Array.from({ length: MAX_LEVELS }, (_, level) => (x, z) => groundHeightAt(scene, x, z) + levelOffset(level)),
    [scene]
  );

  /* ---- Niveaux : niveau affiché (null : tous), coupe de la vue, objets modifiables ---- */
  const viewLevel = walking ? null : view.level ?? null;
  const lowWalls = view.lowWalls && !walking;
  // Murs arasés sans niveau choisi : on travaille au rez-de-chaussée
  const cutLevel = viewLevel ?? (lowWalls ? 0 : null);
  // Coupe absolue des cloisons et murs isolés en vue arasée (au-dessus d'appui du niveau coupé)
  const wallCut = cutLevel != null && lowWalls ? FLOOR_Y + levelOffset(cutLevel) + LOW_WALL : Infinity;
  const shownLevel = (item) => cutLevel == null || levelOf(item) <= cutLevel;
  // Un niveau choisi : seuls ses objets (et les bâtiments, qui portent tous les niveaux) se sélectionnent
  const interactive = (list, item) => {
    if (viewLevel == null || list === 'buildings') return true;
    if (list === 'prefabs' || list === 'surfaces') return viewLevel === 0;
    return levelOf(item) === viewLevel;
  };
  // Plan des outils à la hauteur du niveau choisi (sous son plancher, comme le terrain sous les dalles)
  const planeY = levelOffset(viewLevel || 0);
  // Trémies des escaliers et baies des fenêtres de façade, par bâtiment (chaînes : les bâtiments mémoïsés ne
  // sont redessinés que si leurs percements changent)
  const openings = useMemo(() => {
    const byBuilding = stairOpeningsByBuilding(scene);
    return Object.fromEntries(Object.entries(byBuilding).map(([id, holes]) => [id, JSON.stringify(holes)]));
  }, [scene]);
  const windowBays = useMemo(() => {
    const byBuilding = windowOpeningsByBuilding(scene);
    return Object.fromEntries(Object.entries(byBuilding).map(([id, bays]) => [id, JSON.stringify(bays)]));
  }, [scene]);

  /** Point du plan horizontal de hauteur `y` sous le pointeur (coordonnées écran). */
  const groundFromClient = (clientX, clientY, y = 0) => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(new THREE.Plane(UP, -y), new THREE.Vector3());
    return hit ? [hit.x, hit.z] : null;
  };

  const endDrag = useRef(null);
  const startDrag = (e, spec) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { scene: base, onSelect: select, controls: orbit } = latest.current;
    select(spec.ref);
    // Glissement dans le plan du niveau de l'objet : le pointeur reste sur l'objet
    const planeAt = levelOffset(levelOf(findItem(base, spec.ref)));
    const start = groundFromClient(e.nativeEvent.clientX, e.nativeEvent.clientY, planeAt);
    if (!start) return;
    drag.current = {
      ...spec,
      start,
      planeAt,
      base,
      client: [e.nativeEvent.clientX, e.nativeEvent.clientY],
      carried: spec.type === 'move' ? contentsOf(base, spec.ref) : [],
      active: false,
    };
    if (orbit) orbit.enabled = false;

    const onMove = (ev) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(ev.clientX - d.client[0], ev.clientY - d.client[1]) < DRAG_THRESHOLD) return;
        d.active = true;
        latest.current.onCheckpoint();
        // Ajout d'un sommet au milieu d'une arête : inséré au début du glissement
        if (d.type === 'insert') {
          d.base = updateItem(d.base, d.ref, (item) => insertVertex(item, d.edge));
          d.type = 'vertex';
          d.index = d.edge + 1;
        }
        document.body.style.cursor = 'grabbing';
      }
      const p = groundFromClient(ev.clientX, ev.clientY, d.planeAt);
      if (!p) return;
      const step = latest.current.view.snap;
      let next;
      if (d.type === 'move') {
        next = moveItem(d.base, d.ref, snapValue(p[0] - d.start[0], step), snapValue(p[1] - d.start[1], step), d.carried);
      } else if (d.type === 'stretch') {
        next = updateItem(d.base, d.ref, (item) => stretchItem(d.ref.list, item, d.handle, p, step));
      } else {
        const q = snapToScene(p, d.base, step, (id, key) => id === d.ref.id && key === d.index);
        if (d.type === 'vertex') {
          next = updateItem(d.base, d.ref, (item) => ({ polygon: item.polygon.map((v, i) => (i === d.index ? q : v)) }));
        } else if (d.type === 'end') {
          next = updateItem(d.base, d.ref, { [d.index]: q });
        } else if (d.type === 'route') {
          next = updateItem(d.base, d.ref, (item) => ({ route: item.route.map((v, i) => (i === d.index ? q : v)) }));
        }
      }
      if (next) latest.current.onPreview(next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      // Simple clic sur un losange vert : le sommet est ajouté sur place
      const d = drag.current;
      if (d && !d.active && d.type === 'insert') latest.current.onCommit(updateItem(d.base, d.ref, (item) => insertVertex(item, d.edge)));
      endDrag.current = null;
      if (latest.current.controls) latest.current.controls.enabled = true;
      document.body.style.cursor = '';
      drag.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    endDrag.current = onUp;
  };
  useEffect(() => () => endDrag.current?.(), []);

  // Gestionnaires stables par objet (les objets mémoïsés ne sont pas redessinés à chaque modification)
  const binds = useRef(new Map());
  const bindFor = (list, id, item) => {
    if (!editing || !interactive(list, item)) return undefined;
    const key = `${list}:${id}`;
    if (!binds.current.has(key)) {
      const ref = { list, id };
      binds.current.set(key, {
        onPointerDown: (e) => startDrag(e, { type: 'move', ref }),
        onClick: (e) => e.stopPropagation(),
        onPointerOver: (e) => {
          e.stopPropagation();
          setHovered(key);
        },
        onPointerOut: () => setHovered((h) => (h === key ? null : h)),
      });
    }
    return binds.current.get(key);
  };
  useEffect(() => {
    if (!editing) setHovered(null);
  }, [editing]);

  const isSelected = (list, id) => selection?.list === list && selection.id === id;
  const highlightOf = (list, id) => (isSelected(list, id) ? SELECT_COLOR : editing && hovered === `${list}:${id}` ? HOVER_COLOR : null);
  const labels = view.labels && !walking;

  /* ---- Outils : clic et survol du plan au sol ---- */
  const toolPoint = (e) => {
    const p = [e.point.x, e.point.z];
    const step = view.snap;
    return tool.mode === 'place' ? snapPoint(p, step) : snapToScene(p, scene, step);
  };
  const planeHandlers = {
    // En étage, le plan des outils masque ce qui est dessous (sols extérieurs, rez-de-chaussée)
    onPointerDown: (e) => {
      if (planeY > 0) e.stopPropagation();
    },
    onPointerMove: (e) => {
      if (tool.mode !== 'select' && !walking) setCursor(toolPoint(e));
    },
    onPointerOut: () => setCursor(null),
    onClick: (e) => {
      if (e.delta > DRAG_THRESHOLD || walking) return;
      if (tool.mode === 'select') onSelect(null);
      else onToolAction('click', toolPoint(e));
    },
    onDoubleClick: (e) => {
      if (tool.mode === 'polygon' && !walking) onToolAction('finish', toolPoint(e));
    },
  };
  useEffect(() => {
    if (tool.mode === 'select') setCursor(null);
  }, [tool.mode]);

  /* ---- Poignées de l'objet sélectionné ---- */
  const selected = findItem(scene, selection);
  const handles = [];
  if (editing && selected) {
    const ref = selection;
    const axes = stretchAxes(ref.list, selected);
    // Poignées au niveau de l'objet
    const lift = levelOffset(levelOf(selected));
    if (axes) {
      // Poignées d'étirement : milieux des bords et coins (le bord opposé reste en place)
      const [w, d] = [axes.x?.size || 0, axes.z?.size || 0];
      const y = (ref.list === 'prefabs' ? FLOOR_Y : groundAt(...selected.position)) + lift + 0.2;
      const sides = axes.z ? [-1, 0, 1] : [0];
      [-1, 0, 1].forEach((sx) =>
        sides.forEach((sz) => {
          if ((!sx && !sz) || (sx && !axes.x)) return;
          const at = rotatePoint([selected.position[0] + (sx * w) / 2, selected.position[1] + (sz * d) / 2], selected.rotation, selected.position);
          handles.push(
            <Handle
              key={`s${sx}${sz}`}
              kind="stretch"
              scale={ref.list === 'prefabs' ? 1.6 : 1}
              position={[at[0], y, at[1]]}
              onPointerDown={(e) => startDrag(e, { type: 'stretch', ref, handle: [sx, sz] })}
            />
          );
        })
      );
    }
    if (selected.polygon) {
      const y = (ref.list === 'buildings' ? FLOOR_Y : 0) + 0.12;
      selected.polygon.forEach((v, i) =>
        handles.push(
          <Handle
            key={`v${i}`}
            position={[v[0], y, v[1]]}
            onPointerDown={(e) => startDrag(e, { type: 'vertex', ref, index: i })}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onCommit(updateItem(scene, ref, (item) => removeVertex(item, i)));
            }}
          />
        )
      );
      polygonEdges(selected.polygon).forEach(([a, b], i) =>
        handles.push(
          <Handle
            key={`m${i}`}
            kind="insert"
            position={[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]}
            onPointerDown={(e) => startDrag(e, { type: 'insert', ref, edge: i })}
          />
        )
      );
    } else if (selected.a) {
      const y = groundAt(...itemMid(selected)) + lift + 0.12;
      const up = ref.list === 'walls' ? Math.min(selected.height, storeyHeightAt(scene, itemMid(selected), levelOf(selected))) * 0.5 : 0;
      ['a', 'b'].forEach((key) =>
        handles.push(<Handle key={key} position={[selected[key][0], y + up, selected[key][1]]} onPointerDown={(e) => startDrag(e, { type: 'end', ref, index: key })} />)
      );
    } else if (ref.list === 'npcs') {
      selected.route.forEach((v, i) =>
        handles.push(
          <Handle
            key={`r${i}`}
            kind="route"
            position={[v[0], groundAt(v[0], v[1]) + lift + 0.12, v[1]]}
            onPointerDown={(e) => startDrag(e, { type: 'route', ref, index: i })}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onCommit(updateItem(scene, ref, (item) => ({ route: item.route.filter((_, k) => k !== i) })));
            }}
          />
        )
      );
    }
  }

  const routeNpc = tool.mode === 'route' ? scene.npcs.find((n) => n.id === tool.npcId) : null;

  return (
    <>
      <color attach="background" args={[SKY_HORIZON]} />
      <fog attach="fog" args={[SKY_HORIZON, fogNear, fogFar]} />
      <SkyDome site={skySite} scale={Math.max(1, radius / 45)} />
      {/* Lumière naturelle : ciel clair, sol ocre (rebond chaud), soleil légèrement doré */}
      <ambientLight intensity={0.42} />
      <hemisphereLight args={['#e8eef6', '#6e5c45', 0.6]} />
      <SunLight center={center} radius={radius} />
      {view.fx && <EditorPostFx />}
      <StudioEnvironment />
      <CameraRig focus={focus} enabled={!walking} />

      {/* Terrain et plan des outils */}
      {/* Terrain repoussé en profondeur derrière les sols extérieurs (eux-mêmes décalés, voir Surface) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} receiveShadow raycast={() => null}>
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial
          color="#ffffff"
          map={getTexture('grass', groundSize / 4, groundSize / 4)}
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={40}
          polygonOffsetUnits={80}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, planeY, cz]} visible={false} {...planeHandlers}>
        <planeGeometry args={[groundSize, groundSize]} />
      </mesh>
      {view.grid && !walking && (
        // Mailles de 1 m et repères tous les 10 m (1 unité = 1,5 m) ; en étage, juste au-dessus du plancher
        <Grid
          position={[cx, planeY > 0 ? FLOOR_Y + planeY + 0.014 : 0.014, cz]}
          args={[groundSize, groundSize]}
          cellSize={2 / 3}
          cellThickness={0.4}
          cellColor="#3d6b45"
          sectionSize={20 / 3}
          sectionThickness={0.9}
          sectionColor="#5f9a6a"
          fadeDistance={70 + radius}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      {scene.surfaces.map((s, i) => (
        <MemoSurface key={s.id} surface={s} level={i} bind={bindFor('surfaces', s.id, s)} highlight={highlightOf('surfaces', s.id)} />
      ))}
      {scene.walkways.filter(shownLevel).map((w) => (
        <MemoWalkway key={w.id} walkway={w} y={groundAt(...itemMid(w)) + levelOffset(w.level)} bind={bindFor('walkways', w.id, w)} highlight={highlightOf('walkways', w.id)} />
      ))}
      {scene.buildings.map((b) => (
        <MemoBuilding
          key={b.id}
          building={b}
          bind={bindFor('buildings', b.id, b)}
          highlight={highlightOf('buildings', b.id)}
          showRoof={view.roofs}
          lowWalls={lowWalls}
          cutLevel={cutLevel}
          openings={openings[b.id] || ''}
          windows={windowBays[b.id] || ''}
          showLabel={labels}
        />
      ))}
      {scene.prefabs.map((p) => (
        <MemoPrefab key={p.id} prefab={p} bind={bindFor('prefabs', p.id, p)} highlight={highlightOf('prefabs', p.id)} showRoof={view.roofs && cutLevel == null} showLabel={labels} />
      ))}
      {scene.walls.filter(shownLevel).map((w) => {
        const level = levelOf(w);
        const y0 = groundAt(...itemMid(w)) + levelOffset(level);
        return (
          <MemoWall
            key={w.id}
            wall={w}
            y0={y0}
            // En étage, la cloison part du plancher (noyée de 5 cm) ; au rez-de-chaussée, du terrain
            base={level ? y0 - 0.05 : 0}
            maxHeight={storeyHeightAt(scene, itemMid(w), level)}
            cut={wallCut}
            bind={bindFor('walls', w.id, w)}
            highlight={highlightOf('walls', w.id)}
          />
        );
      })}
      {/* Murs arasés (vue de dessus) : les éléments posés en partie haute (toitures, fenêtres, fronton, lustres,
          tableaux) sont masqués ; un niveau choisi masque les niveaux supérieurs et les toitures */}
      {scene.elements
        .filter((el) => shownLevel(el) && !(lowWalls && ELEMENT_KINDS[el.kind]?.upper) && !(cutLevel != null && ELEMENT_KINDS[el.kind]?.roof))
        .map((el) => (
          <PlacedElement
            key={el.id}
            element={el}
            y={groundAt(el.position[0], el.position[1]) + levelOffset(el.level)}
            bind={bindFor('elements', el.id, el)}
            highlight={highlightOf('elements', el.id)}
            showLabel={labels}
            upperHidden={cutLevel != null && levelOf(el) >= cutLevel}
          />
        ))}
      {scene.npcs.map((n, i) =>
        shownLevel(n) ? (
          <EditorNpc
            key={n.id}
            npc={n}
            animate={view.animate || walking}
            groundAt={groundOfLevel[Math.min(MAX_LEVELS - 1, levelOf(n))]}
            bind={bindFor('npcs', n.id, n)}
            highlight={highlightOf('npcs', n.id)}
            showLabel={labels}
            showRoute={view.routes && !walking}
            phase={(i * 0.37) % 1}
          />
        ) : null
      )}

      {handles}
      {/* Aperçus des outils dans le plan du niveau choisi */}
      <group position={[0, planeY, 0]}>
        {!walking && tool.mode === 'place' && <PlaceGhost tool={tool} scene={scene} />}
        {!walking && tool.mode === 'polygon' && <PolygonPreview tool={tool} />}
        {!walking && tool.mode === 'segment' && <SegmentPreview tool={tool} />}
        {!walking && tool.mode === 'route' && <RoutePreview npc={routeNpc} />}
      </group>

      {walking && <EditorWalk scene={scene} />}
    </>
  );
}

function itemMid(item) {
  return [(item.a[0] + item.b[0]) / 2, (item.a[1] + item.b[1]) / 2];
}

export default function EditorCanvas(props) {
  return (
    <div className="editor-canvas" onContextMenu={(e) => e.preventDefault()}>
      {/* Résolution plafonnée à 1,5 × sur les écrans haute densité, téléphones compris (fluidité) */}
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [40, 60, 90], fov: 45, near: 0.3, far: 900 }} onPointerMissed={() => {}}>
        <EditorScene {...props} />
      </Canvas>
    </div>
  );
}
