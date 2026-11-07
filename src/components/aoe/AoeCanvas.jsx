import React, { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import SkyDome, { SKY_HORIZON } from '../3d/SkyDome';
import ElementModel from '../editor/ElementModel';
import { CustomBuilding } from '../editor/EditorStructures';
import { getTexture } from '../3d/models/textures';
import { LodPerson, useDistanceLod, forgetLimbs } from '../3d/models/personLod';
import { createElement, levelOffset } from '../../services/editorScene';
import { BUILDINGS, MAP_HALF, NODES } from '../../game/aoe/config.js';
import { footprint, FOG_N, exploredAt } from '../../game/aoe/engine.js';
import { prefabScene } from './aoePrefabs';
import { store, useAoeRevision, setUi } from './aoeStore';
import { select, clearSelection, orderTo, placeAt, snap, ghostValid } from './aoeOrders';
import { tutoMark } from './aoeTutorial';

/**
 * Scène 3D de Cité Prévention : caméra de jeu de stratégie (vue plongeante, défilement au clavier, à la molette
 * et au bouton du milieu), terrain, bâtiments préfaits de l'éditeur (en chantier puis terminés), ressources,
 * agents animés, dangers signalés, état du document unique au-dessus de chaque unité de travail, brouillard
 * d'exploration et aperçu de pose. Clic gauche : sélectionner ; clic droit : ordre contextuel.
 */

const BOX = new THREE.BoxGeometry(1, 1, 1);
const NO_BIND = {};
const PITCH = 0.92; // inclinaison de la caméra (≈ 53°)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ */
/* Caméra                                                               */
/* ------------------------------------------------------------------ */

function RtsCamera() {
  const { camera, gl } = useThree();
  const keys = useRef(new Set());
  useEffect(() => {
    store.cam = camera;
    store.canvas = gl.domElement;
    const editable = (e) => e.target?.closest?.('input, textarea, select');
    const down = (e) => !editable(e) && keys.current.add(e.code);
    const up = (e) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    const wheel = (e) => {
      e.preventDefault();
      store.camera.d = clamp(store.camera.d * (1 + Math.sign(e.deltaY) * 0.12), 20, 120);
    };
    let drag = null;
    const pd = (e) => {
      if (e.button !== 1) return;
      drag = [e.clientX, e.clientY];
      e.preventDefault();
    };
    const pm = (e) => {
      if (!drag) return;
      const k = store.camera.d / 700;
      store.camera.x = clamp(store.camera.x - (e.clientX - drag[0]) * k, -MAP_HALF, MAP_HALF);
      store.camera.z = clamp(store.camera.z - (e.clientY - drag[1]) * k * 1.4, -MAP_HALF, MAP_HALF + 10);
      drag = [e.clientX, e.clientY];
    };
    const pu = () => {
      drag = null;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    gl.domElement.addEventListener('wheel', wheel, { passive: false });
    gl.domElement.addEventListener('pointerdown', pd);
    window.addEventListener('pointermove', pm);
    window.addEventListener('pointerup', pu);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      gl.domElement.removeEventListener('wheel', wheel);
      gl.domElement.removeEventListener('pointerdown', pd);
      window.removeEventListener('pointermove', pm);
      window.removeEventListener('pointerup', pu);
    };
  }, [camera, gl]);
  useFrame((_, dt) => {
    const k = keys.current;
    const c = store.camera;
    const s = c.d * 0.9 * Math.min(dt, 0.05);
    if (k.has('KeyW') || k.has('KeyZ') || k.has('ArrowUp')) c.z -= s;
    if (k.has('KeyS') || k.has('ArrowDown')) c.z += s;
    if (k.has('KeyA') || k.has('KeyQ') || k.has('ArrowLeft')) c.x -= s;
    if (k.has('KeyD') || k.has('ArrowRight')) c.x += s;
    c.x = clamp(c.x, -MAP_HALF, MAP_HALF);
    c.z = clamp(c.z, -MAP_HALF, MAP_HALF + 10);
    // Glissement doux vers la cible (recentrage depuis la minicarte ou une notification)
    const p = camera.position;
    const tx = c.x;
    const ty = c.d * Math.sin(PITCH);
    const tz = c.z + c.d * Math.cos(PITCH);
    const a = Math.min(1, dt * 10);
    p.set(p.x + (tx - p.x) * a, p.y + (ty - p.y) * a, p.z + (tz - p.z) * a);
    camera.lookAt(p.x, 0, p.z - c.d * Math.cos(PITCH));
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Terrain                                                              */
/* ------------------------------------------------------------------ */

function Ground() {
  const grass = useMemo(() => getTexture('lawn', MAP_HALF / 3, MAP_HALF / 3), []);
  const paving = useMemo(() => getTexture('granite', 12, 6), []);
  const ghostPoint = (e) => [snap(e.point.x), snap(e.point.z)];
  return (
    <>
      {/* Carte de jeu, prolongée par une campagne plus sombre (hors limites) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[MAP_HALF * 6, MAP_HALF * 6]} />
        <meshStandardMaterial color="#5f7a4c" roughness={1} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={(e) => {
          if (e.delta > 6) return;
          if (store.ui.placing) placeAt(...ghostPoint(e), e.shiftKey);
          else if (!e.shiftKey) clearSelection();
        }}
        onContextMenu={(e) => {
          e.nativeEvent.preventDefault();
          if (store.ui.placing) setUi({ placing: null, ghost: null });
          else orderTo({ type: 'ground', point: [e.point.x, e.point.z] });
        }}
        onPointerMove={(e) => {
          if (!store.ui.placing) return;
          const [x, z] = ghostPoint(e);
          if (!store.ui.ghost || store.ui.ghost[0] !== x || store.ui.ghost[1] !== z) setUi({ ghost: [x, z] });
        }}
      >
        <planeGeometry args={[MAP_HALF * 2, MAP_HALF * 2]} />
        <meshStandardMaterial map={grass} color="#ffffff" roughness={0.95} />
      </mesh>
      {/* Place pavée devant l'hôtel de ville */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 12]} receiveShadow raycast={() => null}>
        <planeGeometry args={[34, 12]} />
        <meshStandardMaterial map={paving} color="#ffffff" roughness={0.85} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Bâtiments                                                            */
/* ------------------------------------------------------------------ */

function PrefabModel({ scene }) {
  return (
    <>
      {scene.buildings.map((b) => (
        <CustomBuilding key={b.id} building={b} bind={NO_BIND} showRoof={false} lowWalls={false} cutLevel={null} />
      ))}
      {scene.elements.map((el) => (
        <group key={el.id} position={[el.position[0], levelOffset(el.level), el.position[1]]} rotation={[0, (el.rotation * Math.PI) / 180, 0]}>
          <ElementModel element={el} />
        </group>
      ))}
    </>
  );
}

/** Chantier : dalle, échafaudage, volume qui monte avec l'avancement, barre de progression. */
function ConstructionSite({ id, w, d }) {
  const rise = useRef();
  const bar = useRef();
  const h = 3;
  useFrame(() => {
    const b = store.game?.buildings.find((x) => x.id === id);
    if (!b || !rise.current) return;
    const p = Math.max(0.04, b.progress);
    rise.current.scale.set(w - 0.4, h * p, d - 0.4);
    rise.current.position.y = (h * p) / 2;
    bar.current.scale.x = Math.max(0.01, b.progress) * (w * 0.8);
    bar.current.position.x = (-w * 0.8 + bar.current.scale.x) / 2;
  });
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.08, 0]} scale={[w, 0.16, d]} receiveShadow>
        <meshStandardMaterial color="#b9b2a5" roughness={0.9} />
      </mesh>
      <mesh ref={rise} geometry={BOX} castShadow>
        <meshStandardMaterial color="#e8dcc0" roughness={0.8} transparent opacity={0.75} />
      </mesh>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} geometry={BOX} position={[(sx * w) / 2, h / 2 + 0.3, (sz * d) / 2]} scale={[0.12, h + 0.6, 0.12]} castShadow>
          <meshStandardMaterial color="#c58b2b" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, h + 1.4, d / 2]}>
        <mesh geometry={BOX} scale={[w * 0.8, 0.22, 0.06]}>
          <meshBasicMaterial color="#1f2937" />
        </mesh>
        <mesh ref={bar} geometry={BOX} position={[0, 0, 0.04]} scale={[0.01, 0.18, 0.06]}>
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
    </group>
  );
}

/** Potager : terre et rangs de légumes dont la hauteur suit ce qui reste à récolter. */
function Field({ id, size, done }) {
  const rows = useRef();
  useFrame(() => {
    const b = store.game?.buildings.find((x) => x.id === id);
    if (!b || !rows.current) return;
    const k = done ? Math.max(0.15, b.fieldLeft / BUILDINGS.potager.field.amount) : 0.1;
    rows.current.scale.y = k;
  });
  const n = 5;
  return (
    <group>
      <mesh geometry={BOX} position={[0, 0.06, 0]} scale={[size[0] - 0.4, 0.12, size[1] - 0.4]} receiveShadow>
        <meshStandardMaterial color="#6b4a2f" roughness={1} />
      </mesh>
      <group ref={rows}>
        {Array.from({ length: n }, (_, i) => (
          <mesh key={i} geometry={BOX} position={[-size[0] / 2 + 0.9 + (i * (size[0] - 1.8)) / (n - 1), 0.35, 0]} scale={[0.45, 0.5, size[1] - 1.4]} castShadow>
            <meshStandardMaterial color={i % 2 ? '#5f8f3a' : '#76a548'} roughness={0.9} />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={BOX} position={[0, 0.3, (s * size[1]) / 2]} scale={[size[0], 0.6, 0.06]}>
          <meshStandardMaterial color="#8a6a45" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

const BuildingView = memo(function BuildingView({ id, kind, x, z, rot, done, variant }) {
  const scene = useMemo(() => prefabScene(kind, variant), [kind, variant]);
  const [w, d] = BUILDINGS[kind].size;
  const def = BUILDINGS[kind];
  const height = kind === 'mairie' ? 10 : kind === 'point' ? 2 : 6;
  return (
    <group position={[x, 0, z]} rotation={[0, (rot * Math.PI) / 180, 0]}>
      {def.field ? <Field id={id} size={[w, d]} done={done} /> : done ? <PrefabModel scene={scene} /> : <ConstructionSite id={id} w={w} d={d} />}
      <mesh
        geometry={BOX}
        visible={false}
        position={[0, height / 2, 0]}
        scale={[w, height, d]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 6) return;
          if (store.ui.placing) return;
          select(id);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          orderTo({ type: 'building', id });
        }}
      />
    </group>
  );
});

function Buildings() {
  useAoeRevision();
  const g = store.game;
  return g.buildings.map((b, i) => <BuildingView key={b.id} id={b.id} kind={b.kind} x={b.x} z={b.z} rot={b.rot} done={b.done} variant={(i * 7 + g.seed) % 11} />);
}

/* ------------------------------------------------------------------ */
/* Ressources de la carte                                               */
/* ------------------------------------------------------------------ */

const pickHandlers = (id) => ({
  onClick: (e) => {
    e.stopPropagation();
    if (e.delta > 6 || store.ui.placing) return;
    select(id);
  },
  onContextMenu: (e) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    orderTo({ type: 'node', id });
  },
});

const TreeView = memo(function TreeView({ id, x, z, variant }) {
  const element = useMemo(() => createElement(variant === 2 ? 'conifer' : 'tree', [0, 0], { rotation: (x * 37 + z * 11) % 360, id: `arbre-${id}` }), [id, x, z, variant]);
  return (
    <group position={[x, 0, z]}>
      <ElementModel element={element} />
      <mesh geometry={BOX} visible={false} position={[0, 1.6, 0]} scale={[1.6, 3.2, 1.6]} {...pickHandlers(id)} />
    </group>
  );
});

const SiteView = memo(function SiteView({ id, x, z, rot }) {
  const parts = useMemo(
    () => [createElement('cones_stock', [-1.2, -0.7], { rotation: 0 }), createElement('skip', [1.1, 0.4], { rotation: 0 }), createElement('sign_warning', [-2.2, 1.1], { rotation: 0, label: 'Chantier' })],
    []
  );
  return (
    <group position={[x, 0, z]} rotation={[0, (rot * Math.PI) / 180, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[6.4, 4.2]} />
        <meshStandardMaterial color="#3f4448" roughness={0.95} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {parts.map((el) => (
        <group key={el.id} position={[el.position[0], 0, el.position[1]]} rotation={[0, (el.rotation * Math.PI) / 180, 0]}>
          <ElementModel element={el} />
        </group>
      ))}
      <mesh geometry={BOX} visible={false} position={[0, 1, 0]} scale={[5.4, 2, 3.4]} {...pickHandlers(id)} />
    </group>
  );
});

const GardenView = memo(function GardenView({ id, x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Field id={null} size={[5, 5]} done />
      <mesh geometry={BOX} visible={false} position={[0, 0.5, 0]} scale={[5, 1, 5]} {...pickHandlers(id)} />
    </group>
  );
});

function Nodes() {
  useAoeRevision();
  const g = store.game;
  return g.nodes
    .filter((n) => n.amount > 0 && exploredAt(g, n.x, n.z))
    .map((n) =>
      n.kind === 'arbre' ? (
        <TreeView key={n.id} id={n.id} x={n.x} z={n.z} variant={n.variant} />
      ) : n.kind === 'chantier' ? (
        <SiteView key={n.id} id={n.id} x={n.x} z={n.z} rot={n.rot || 0} />
      ) : (
        <GardenView key={n.id} id={n.id} x={n.x} z={n.z} />
      )
    );
}

/* ------------------------------------------------------------------ */
/* Agents                                                               */
/* ------------------------------------------------------------------ */

const RING = new THREE.RingGeometry(0.42, 0.52, 32);
// La caméra du jeu est à 62 unités par défaut (20 à 120) : les agents restent articulés (jambes et bras animés)
// sur presque toute la plage de zoom ; seul le dézoom maximal les fige (ils ne font alors que quelques pixels).
// Vus de haut, leur visage ne se voit pas : version légère des personnages (≈ 10 fois moins de triangles)
const UNIT_LOD = { far: 125, near: 115 };
// Feuille d'heures (blanche) ou dossier de subvention (doré) que l'agent rapporte
const CARRY_COLORS = { heures: '#e8eef5', budget: '#e3b341' };

/** Tenue : agent non formé sans protections ; sensibilisé avec gilet et casque ; préventeur en gilet bleu. */
function outfitOf(type, sens) {
  if (type === 'preventeur') return { outfit: 'office', colors: { top: '#e8eef5', vest: '#1e88e5', helmet: '#ffffff' } };
  if (type === 'sst') return { outfit: 'worker', colors: { vest: '#d32f2f', helmet: '#ffffff' } };
  return sens ? { outfit: 'worker', colors: undefined } : { outfit: 'worker', colors: { vest: null, helmet: null } };
}

const AoeUnit = memo(function AoeUnit({ id, type, sens, variant }) {
  const root = useRef();
  const body = useRef();
  const ring = useRef();
  const carry = useRef();
  const limbs = useRef({}).current;
  const close = useDistanceLod(root, (near) => !near && forgetLimbs(limbs), UNIT_LOD);
  const { outfit, colors } = outfitOf(type, sens);
  const first = useRef(true);
  useFrame(({ clock }, dt) => {
    const u = store.game?.units.find((x) => x.id === id);
    const g = root.current;
    if (!u || !g) return;
    g.visible = !u.hidden;
    if (first.current) {
      g.position.set(u.x, 0, u.z);
      first.current = false;
    }
    const k = Math.min(1, dt * 10);
    g.position.x += (u.x - g.position.x) * k;
    g.position.z += (u.z - g.position.z) * k;
    let dh = u.heading - g.rotation.y;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    g.rotation.y += dh * Math.min(1, dt * 8);
    const t = clock.getElapsedTime() * 9 + variant;
    const { leftLeg, rightLeg, leftArm, rightArm, leftShin, rightShin, leftArmFore, rightArmFore } = limbs;
    const swing = u.moving ? Math.sin(t) : 0;
    const work = !u.moving && (u.working || u.evaluating || u.task?.kind === 'neutralize') ? Math.sin(t * 0.7) : 0;
    if (leftLeg) leftLeg.rotation.x = swing * 0.6;
    if (rightLeg) rightLeg.rotation.x = -swing * 0.6;
    if (leftShin) leftShin.rotation.x = u.moving ? 0.15 + Math.max(0, Math.cos(t)) * 0.6 : 0.05;
    if (rightShin) rightShin.rotation.x = u.moving ? 0.15 + Math.max(0, -Math.cos(t)) * 0.6 : 0.05;
    if (leftArm) leftArm.rotation.x = u.moving ? -swing * 0.45 : work ? -0.9 + work * 0.35 : 0;
    if (rightArm) rightArm.rotation.x = u.moving ? swing * 0.45 : work ? -0.9 - work * 0.35 : 0;
    if (leftArmFore) leftArmFore.rotation.x = work ? -0.8 : -0.1;
    if (rightArmFore) rightArmFore.rotation.x = work ? -0.8 : -0.1;
    if (body.current) body.current.position.y = u.moving ? Math.abs(Math.sin(t)) * 0.03 : 0;
    if (ring.current) ring.current.visible = store.ui.selection.includes(id);
    if (carry.current) {
      const c = u.carry?.amount > 0.5 ? u.carry.res : null;
      carry.current.visible = Boolean(c);
      if (c) carry.current.material.color.set(CARRY_COLORS[c]);
    }
  });
  return (
    <group ref={root}>
      <group ref={body}>
        <LodPerson close={close} lite outfit={outfit} colors={colors} variant={variant} limbs={limbs} />
      </group>
      <mesh ref={carry} geometry={BOX} position={[0, 0.78, 0.22]} scale={[0.28, 0.2, 0.2]} visible={false}>
        <meshStandardMaterial color="#8a5a2b" roughness={0.8} />
      </mesh>
      <mesh ref={ring} geometry={RING} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false} renderOrder={5}>
        <meshBasicMaterial color={type === 'preventeur' ? '#60a5fa' : '#fde047'} depthTest={false} transparent />
      </mesh>
      <mesh
        geometry={BOX}
        visible={false}
        position={[0, 0.7, 0]}
        scale={[0.9, 1.4, 0.9]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 6 || store.ui.placing) return;
          select(id, e.shiftKey);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
        }}
      />
    </group>
  );
});

function Units() {
  useAoeRevision();
  const g = store.game;
  return g.units.map((u, i) => <AoeUnit key={`${u.id}-${u.sens ? 1 : 0}`} id={u.id} type={u.type} sens={u.sens} variant={(i * 3 + g.seed) % 8} />);
}

/* ------------------------------------------------------------------ */
/* Dangers signalés, état du DU                                         */
/* ------------------------------------------------------------------ */

function canvasSprite(draw, w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let warningTexture = null;
const warning = () =>
  (warningTexture ||= canvasSprite((ctx, w) => {
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(w / 2, 10);
    ctx.lineTo(w - 10, w - 14);
    ctx.lineTo(10, w - 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 74px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', w / 2, w - 30);
  }));

const HazardView = memo(function HazardView({ id, x, z }) {
  const ring = useRef();
  const sign = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring.current) ring.current.scale.setScalar(1 + 0.18 * Math.sin(t * 5));
    if (sign.current) sign.current.position.y = 2 + 0.12 * Math.sin(t * 3);
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} geometry={RING} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={2.2}>
        <meshBasicMaterial color="#ef4444" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <sprite ref={sign} scale={[1.1, 1.1, 1.1]} position={[0, 2, 0]}>
        <spriteMaterial map={warning()} depthWrite={false} />
      </sprite>
      <mesh
        geometry={BOX}
        visible={false}
        position={[0, 1, 0]}
        scale={[1.6, 2.4, 1.6]}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta > 6) return;
          select(id);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault();
          orderTo({ type: 'hazard', id });
        }}
      />
    </group>
  );
});

function Hazards() {
  useAoeRevision();
  return store.game.hazards.filter((h) => h.revealed).map((h) => <HazardView key={h.id} id={h.id} x={h.x} z={h.z} />);
}

const badgeTextures = {};
const badge = (done) =>
  (badgeTextures[done] ||= canvasSprite(
    (ctx, w, h) => {
      ctx.fillStyle = done ? '#16a34a' : '#ea580c';
      ctx.beginPath();
      ctx.roundRect(4, 4, w - 8, h - 8, 22);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(done ? 'DU ✓' : 'DU ?', w / 2, h / 2 + 18);
    },
    192,
    96
  ));

/** Pastille au-dessus de chaque unité de travail : évaluée (vert) ou à évaluer (orange). */
function DuBadges() {
  useAoeRevision();
  const g = store.game;
  const items = [];
  Object.values(g.uts).forEach((ut) => {
    if (ut.kind === 'construction') return;
    let pos = null;
    let y = 4.5;
    if (ut.kind === 'building') {
      const b = g.buildings.find((x) => x.id === ut.refId);
      if (!b) return;
      pos = [b.x, b.z];
      y = b.kind === 'mairie' ? 14.5 : b.done ? 8.5 : 5;
    } else if (ut.kind === 'jardins') {
      if (!ut.active) return;
      const n = g.nodes.find((x) => x.kind === 'jardin');
      pos = n ? [n.x, n.z] : ut.pos;
      y = 3;
    } else {
      if (!ut.active && !g.nodes.some((n) => n.utId === ut.id && n.amount > 0 && exploredAt(g, n.x, n.z))) return;
      if (!g.nodes.some((n) => n.utId === ut.id && n.amount > 0)) return;
      pos = ut.pos;
      y = ut.name.startsWith('Chantier') ? 3.6 : 5.6;
    }
    if (!exploredAt(g, pos[0], pos[1])) return;
    if (!ut.active && ut.evaluated) return;
    items.push(
      <sprite key={ut.id} position={[pos[0], y, pos[1]]} scale={[1.9, 0.95, 1]} renderOrder={4}>
        <spriteMaterial map={badge(ut.evaluated)} depthWrite={false} transparent opacity={ut.active ? 1 : 0.55} />
      </sprite>
    );
  });
  return items;
}

/* ------------------------------------------------------------------ */
/* Brouillard, aperçu de pose                                           */
/* ------------------------------------------------------------------ */

function FogOfWar() {
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(FOG_N * FOG_N * 4), FOG_N, FOG_N, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.flipY = false;
    return t;
  }, []);
  const timer = useRef(1);
  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < 0.3 || !store.game) return;
    timer.current = 0;
    const { explored, visible } = store.game;
    const data = tex.image.data;
    for (let i = 0; i < FOG_N * FOG_N; i += 1) {
      data[i * 4] = 8;
      data[i * 4 + 1] = 12;
      data[i * 4 + 2] = 18;
      data[i * 4 + 3] = explored[i] ? (visible[i] ? 0 : 110) : 255;
    }
    tex.needsUpdate = true;
  });
  // Plan au-dessus du sol (les rangées de la texture suivent Z croissant)
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.25, 0]} renderOrder={3} raycast={() => null}>
      <planeGeometry args={[MAP_HALF * 2, MAP_HALF * 2]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function PlacementGhost() {
  const ref = useRef();
  const mat = useRef();
  useFrame(() => {
    const ui = store.ui;
    const g = ref.current;
    if (!g) return;
    g.visible = Boolean(ui.placing && ui.ghost);
    if (!g.visible) return;
    const [w, d] = footprint(ui.placing, ui.rot);
    g.position.set(ui.ghost[0], 0.6, ui.ghost[1]);
    g.scale.set(w, 1.2, d);
    mat.current.color.set(ghostValid(ui.ghost[0], ui.ghost[1]).ok ? '#22c55e' : '#ef4444');
  });
  return (
    <mesh ref={ref} geometry={BOX} visible={false} renderOrder={6} raycast={() => null}>
      <meshBasicMaterial ref={mat} transparent opacity={0.35} depthWrite={false} />
    </mesh>
  );
}

/** Contour de la sélection (bâtiment, ressource ou danger choisi). */
function SelectionOutline() {
  const ref = useRef();
  const edges = useMemo(() => new THREE.EdgesGeometry(BOX), []);
  useFrame(() => {
    const g = store.game;
    const l = ref.current;
    if (!g || !l) return;
    const id = store.ui.selection.length === 1 ? store.ui.selection[0] : null;
    const b = id && g.buildings.find((x) => x.id === id);
    const n = id && g.nodes.find((x) => x.id === id);
    const h = id && g.hazards.find((x) => x.id === id);
    l.visible = Boolean(b || n || h);
    if (b) {
      const [w, d] = footprint(b.kind, b.rot);
      l.position.set(b.x, 0.15, b.z);
      l.scale.set(w + 0.6, 0.3, d + 0.6);
    } else if (n) {
      const s = n.kind === 'chantier' ? [6.4, 0.3, 4.4] : n.kind === 'jardin' ? [5.6, 0.3, 5.6] : [2.2, 0.3, 2.2];
      l.position.set(n.x, 0.15, n.z);
      l.scale.set(...s);
    } else if (h) {
      l.position.set(h.x, 0.15, h.z);
      l.scale.set(2.6, 0.3, 2.6);
    }
  });
  return (
    <lineSegments ref={ref} geometry={edges} visible={false} renderOrder={7}>
      <lineBasicMaterial color="#fde047" depthTest={false} transparent />
    </lineSegments>
  );
}

/* ------------------------------------------------------------------ */
/* Didacticiel : flèche jaune au-dessus de ce qu'il faut cliquer         */
/* ------------------------------------------------------------------ */

const ARROW = new THREE.ConeGeometry(0.6, 1.5, 4);
const MARK_RING = new THREE.RingGeometry(0.85, 1.05, 40);

function TutorialMarker() {
  const group = useRef();
  const arrow = useRef();
  const ring = useRef();
  useFrame(({ clock }) => {
    const m = store.tuto ? tutoMark() : null;
    const g = group.current;
    if (!g) return;
    g.visible = Boolean(m);
    if (!m) return;
    const t = clock.getElapsedTime();
    // Taille à peu près constante à l'écran, quel que soit le zoom
    const s = clamp(store.camera.d / 48, 0.8, 2.4);
    arrow.current.scale.setScalar(s);
    arrow.current.position.set(m.x, m.y + 0.75 * s + Math.abs(Math.sin(t * 3.2)) * 0.9 * s, m.z);
    arrow.current.rotation.y = t * 1.5;
    ring.current.visible = m.ring !== false;
    ring.current.position.set(m.x, 0.32, m.z);
    ring.current.scale.setScalar((m.r || 1.3) * (1 + 0.12 * Math.sin(t * 4)));
  });
  return (
    <group ref={group} visible={false}>
      <group ref={arrow}>
        <mesh geometry={ARROW} rotation={[Math.PI, 0, 0]} renderOrder={9} raycast={() => null}>
          <meshBasicMaterial color="#facc15" depthTest={false} transparent />
        </mesh>
      </group>
      <mesh ref={ring} geometry={MARK_RING} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9} raycast={() => null}>
        <meshBasicMaterial color="#facc15" depthTest={false} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scène                                                                */
/* ------------------------------------------------------------------ */

function Sun() {
  const ref = useRef();
  useEffect(() => {
    const light = ref.current;
    light.target.position.set(0, 0, 0);
    light.target.updateMatrixWorld();
    Object.assign(light.shadow.camera, { left: -MAP_HALF - 10, right: MAP_HALF + 10, top: MAP_HALF + 10, bottom: -MAP_HALF - 10, far: 400 });
    light.shadow.camera.updateProjectionMatrix();
  }, []);
  return <directionalLight ref={ref} castShadow color="#fff2df" position={[60, 110, 70]} intensity={1.65} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} />;
}

const SKY_SITE = { center: [0, 0], radius: MAP_HALF };

function Scene() {
  useAoeRevision();
  if (!store.game) return null;
  return (
    <>
      <color attach="background" args={[SKY_HORIZON]} />
      <fog attach="fog" args={[SKY_HORIZON, 170, 380]} />
      <SkyDome site={SKY_SITE} scale={2} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#e8eef6', '#6e5c45', 0.6]} />
      <Sun />
      <RtsCamera />
      <Ground />
      <Buildings />
      <Nodes />
      <Units />
      <Hazards />
      <DuBadges />
      <FogOfWar />
      <PlacementGhost />
      <SelectionOutline />
      <TutorialMarker />
    </>
  );
}

export default function AoeCanvas() {
  return (
    <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 42, near: 0.5, far: 700, position: [0, 50, 60] }} onContextMenu={(e) => e.preventDefault()}>
      <Scene />
    </Canvas>
  );
}

export { NODES };
