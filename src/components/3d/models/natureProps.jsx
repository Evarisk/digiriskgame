import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Box, Cylinder, Ball, DYNAMIC, getMaterial, noRaycast, seeded } from './kit';
import { visit, bodies } from '../../../services/visitState';
import { newPigeon, stepPigeon } from '../../../services/pigeonLogic';

/**
 * Nature et vie de l'espace public pour l'éditeur de site : arbres d'alignement (tilleul au houppier en
 * grappes irrégulières, conifère étagé) dont le feuillage se balance au vent, et pigeons qui picorent et
 * marchent sur la place. Chaque instance varie selon `seed`. Origine au sol, 1 unité ≈ 1,5 m.
 */

const BARK = '#5b4a3c';
const GREENS = ['#4c7438', '#5a8443', '#43692f', '#66904c', '#3d5f2c'];
const NEEDLES = ['#2f5136', '#36593b', '#2a4830'];

/** Grappe de feuillage : icosaèdre subdivisé, bosselé de façon déterministe, ombré en douceur. */
const LEAF_CLUSTER = (() => {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(0.5, 2));
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const bump = 1 + 0.1 * Math.sin(v.x * 9.1 + v.y * 4.3) * Math.cos(v.z * 7.7 - v.y * 3.1) + 0.05 * Math.sin(v.y * 15);
    v.multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
})();

export function Leaves({ color, ...rest }) {
  return <mesh geometry={LEAF_CLUSTER} material={getMaterial({ color, roughness: 0.92, metalness: 0 })} castShadow receiveShadow raycast={noRaycast} {...rest} />;
}

/** Feuillage animé : léger balancement autour du haut du tronc, à un rythme propre à chaque arbre. */
function useSway(seed, amount = 0.012) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.z = Math.sin(t * 0.7 + seed * 6.3) * amount + Math.sin(t * 1.9 + seed * 2.1) * amount * 0.3;
    g.rotation.x = Math.sin(t * 0.53 + seed * 3.7) * amount * 0.8;
  });
  return ref;
}

/** Tilleul d'alignement (ou conifère avec `conifer`) : tronc, charpentières, houppier en grappes. */
export function ParkTree({ seed = 0, conifer = false }) {
  const r = (k) => seeded(seed * 17.31 + k * 3.7);
  const scale = 0.9 + r(1) * 0.25;
  const sway = useSway(seed, conifer ? 0.006 : 0.012);

  const clusters = useMemo(() => {
    if (conifer) return [];
    // Houppier : une grosse masse centrale et une couronne de grappes de tailles variées
    const list = [{ p: [0, 0.78, 0], s: [1.2, 0.95, 1.15], c: 0 }];
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + r(10 + i) * 0.6;
      const d = 0.42 + r(20 + i) * 0.22;
      const y = 0.45 + r(30 + i) * 0.65;
      const s = 0.55 + r(40 + i) * 0.35;
      list.push({ p: [Math.cos(a) * d, y, Math.sin(a) * d], s: [s * 1.1, s * 0.85, s], c: 1 + (i % 4) });
    }
    list.push({ p: [r(50) * 0.2 - 0.1, 1.25, r(51) * 0.2 - 0.1], s: [0.7, 0.55, 0.7], c: 3 });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, conifer]);

  if (conifer) {
    return (
      <group scale={[scale, scale, scale]}>
        <Cylinder position={[0, 0.5, 0]} radius={0.07} top={0.6} height={1.0} color={BARK} rough={0.95} />
        <group ref={sway} position={[0, 0.7, 0]} userData={DYNAMIC}>
          {[0, 1, 2, 3].map((i) => (
            <Cylinder
              key={i}
              position={[0, 0.25 + i * 0.5, 0]}
              radius={0.85 - i * 0.18}
              top={0.05}
              height={0.95 - i * 0.08}
              segments={12}
              color={NEEDLES[i % NEEDLES.length]}
              rough={0.95}
            />
          ))}
        </group>
      </group>
    );
  }

  return (
    <group scale={[scale, scale, scale]} rotation={[0, r(2) * Math.PI * 2, 0]}>
      {/* Tronc effilé et trois charpentières */}
      <Cylinder position={[0, 0.6, 0]} radius={0.075} top={0.62} height={1.2} color={BARK} rough={0.95} />
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + r(60 + i);
        return (
          <group key={i} position={[0, 1.08, 0]} rotation={[0, a, 0]}>
            <Cylinder position={[0.14, 0.22, 0]} rotation={[0, 0, -0.62]} radius={0.032} top={0.5} height={0.52} color={BARK} rough={0.95} />
          </group>
        );
      })}
      {/* Houppier animé (pivot au sommet du tronc) */}
      <group ref={sway} position={[0, 1.15, 0]} userData={DYNAMIC}>
        {clusters.map((c, i) => (
          <Leaves key={i} position={c.p} scale={c.s} color={GREENS[c.c % GREENS.length]} />
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Outils des jardiniers                                                */
/* ------------------------------------------------------------------ */

/**
 * Brouette (≈ 1,4 m) : roue à l'avant (+Z), caisse de tôle remplie de terreau et de plants, brancards vers
 * l'arrière (−Z, poignées à 0,6 m du sol : à hauteur des mains d'un jardinier qui la pousse).
 */
export function Wheelbarrow() {
  return (
    <group>
      {/* Roue */}
      <Cylinder position={[0, 0.13, 0.36]} rotation={[0, 0, Math.PI / 2]} radius={0.13} height={0.06} segments={18} color="#1e1f22" rough={0.8} />
      <Cylinder position={[0, 0.13, 0.36]} rotation={[0, 0, Math.PI / 2]} radius={0.05} height={0.065} color="#8f969c" metal={0.6} rough={0.4} />
      {/* Caisse évasée (60 × 85 cm en haut), terreau bombé et plants */}
      <group position={[0, 0.36, 0.08]} rotation={[0.08, 0, 0]}>
        <group scale={[1, 1, 1.4]}>
          <Cylinder radius={0.22} top={1.3} height={0.2} segments={4} rotation={[0, Math.PI / 4, 0]} color="#5f6e58" metal={0.4} rough={0.5} />
        </group>
        <Box size={[0.34, 0.035, 0.48]} position={[0, 0.115, 0]} color="#3b2a1e" rough={0.95} />
        {[[-0.08, 0.1], [0.07, -0.05], [-0.04, -0.14], [0.09, 0.14]].map(([x, z], i) => (
          <Ball key={i} radius={0.055} position={[x, 0.165, z]} color={GREENS[i % GREENS.length]} rough={0.9} />
        ))}
      </group>
      {/* Brancards (de l'axe de la roue aux poignées), poignées et béquilles */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[0.028, 0.028, 1.0]} position={[s * 0.17, 0.38, -0.1]} rotation={[0.35, 0, 0]} color="#3d4a39" metal={0.5} rough={0.45} />
          <Cylinder position={[s * 0.17, 0.566, -0.6]} rotation={[-(Math.PI / 2 - 0.35), 0, 0]} radius={0.02} height={0.12} color="#1e1f22" rough={0.7} />
          <Box size={[0.024, 0.41, 0.024]} position={[s * 0.15, 0.205, -0.18]} color="#3d4a39" metal={0.5} rough={0.45} />
        </group>
      ))}
    </group>
  );
}

/** Arrosoir de jardinier (≈ 40 cm), bec vers +Z. */
export function WateringCan({ color = '#4f6f46' }) {
  return (
    <group>
      <Cylinder position={[0, 0.1, 0]} radius={0.075} top={0.9} height={0.2} segments={16} color={color} metal={0.45} rough={0.4} />
      <Cylinder position={[0, 0.205, 0]} radius={0.06} height={0.012} segments={16} color={color} metal={0.45} rough={0.4} />
      {/* Bec et pomme d'arrosage */}
      <Cylinder position={[0, 0.16, 0.13]} rotation={[0.85, 0, 0]} radius={0.012} top={0.8} height={0.2} color={color} metal={0.45} rough={0.4} />
      <Cylinder position={[0, 0.235, 0.205]} rotation={[0.85, 0, 0]} radius={0.028} top={1.4} height={0.03} color="#9aa29a" metal={0.6} rough={0.35} />
      {/* Anse */}
      <Box size={[0.016, 0.016, 0.16]} position={[0, 0.27, -0.02]} color={color} metal={0.45} rough={0.4} />
      <Box size={[0.016, 0.07, 0.016]} position={[0, 0.235, -0.1]} color={color} metal={0.45} rough={0.4} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Pigeons                                                              */
/* ------------------------------------------------------------------ */

// Pigeon biset : manteau gris bleuté (plus ou moins sombre), poitrail rosé, cou irisé vert et violet
const PLUMAGES = [
  { body: '#8a929c', wing: '#9aa2ab', breast: '#8d878f' },
  { body: '#7c848e', wing: '#8d959e', breast: '#857e88' },
  { body: '#6b7178', wing: '#7a8088', breast: '#77707a' },
  { body: '#959ca5', wing: '#a5acb4', breast: '#958e96' },
];

/**
 * Pigeon (≈ 32 cm, face à +Z, pieds à l'origine) : corps dodu au poitrail bombé, cou irisé, petite tête (groupe
 * `head` animé : hochements), bec à cire blanche, œil orange, queue barrée de sombre, pattes rouges à doigts ;
 * ailes repliées à deux barres noires au sol (`folded`), ailes déployées pour le vol (`spread`, deux pivots
 * d'épaule `leftWing` / `rightWing` qui battent), pattes rentrées en vol (`legs`).
 */
function Pigeon({ plumage, parts }) {
  const { body, wing, breast } = plumage;
  const ref = (key) => (el) => {
    if (el) parts[key] = el;
  };
  return (
    <group ref={ref('body')} userData={DYNAMIC}>
      {/* Pattes et doigts */}
      <group ref={ref('legs')} userData={DYNAMIC}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.018, 0, 0.012]}>
            <Cylinder position={[0, 0.017, 0]} radius={0.0055} height={0.034} color="#b14b4b" rough={0.6} />
            {[-0.5, 0, 0.5].map((a) => (
              <Box key={a} size={[0.004, 0.003, 0.026]} position={[Math.sin(a) * 0.01, 0.0015, Math.cos(a) * 0.01]} rotation={[0, a, 0]} color="#a44444" rough={0.6} />
            ))}
          </group>
        ))}
      </group>
      <group position={[0, -0.012, 0]}>
        {/* Corps incliné (avant relevé), poitrail */}
        <Ball scale={[0.085, 0.078, 0.15]} position={[0, 0.088, -0.008]} rotation={[-0.32, 0, 0]} color={body} rough={0.75} />
        <Ball scale={[0.078, 0.078, 0.072]} position={[0, 0.098, 0.04]} color={breast} rough={0.75} />
        {/* Ailes repliées, deux barres noires, rémiges sombres (au sol) */}
        <group ref={ref('folded')} userData={DYNAMIC}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.036, 0.1, -0.022]} rotation={[-0.22, 0, s * 0.14]}>
              <Ball scale={[0.028, 0.052, 0.13]} color={wing} rough={0.75} />
              <Ball scale={[0.03, 0.014, 0.028]} position={[s * 0.003, -0.004, -0.012]} color="#26282c" rough={0.8} />
              <Ball scale={[0.03, 0.014, 0.026]} position={[s * 0.003, -0.008, -0.042]} color="#26282c" rough={0.8} />
              <Ball scale={[0.022, 0.024, 0.07]} position={[0, -0.006, -0.075]} color="#3f444b" rough={0.75} />
            </group>
          ))}
        </group>
        {/* Ailes déployées (en vol) : pivot à l'épaule, rémiges sombres au bout, barres alaires */}
        <group ref={ref('spread')} userData={DYNAMIC} visible={false}>
          {[-1, 1].map((s) => (
            <group key={s} ref={ref(s < 0 ? 'leftWing' : 'rightWing')} userData={DYNAMIC} position={[s * 0.03, 0.108, 0]}>
              <Ball scale={[0.25, 0.014, 0.11]} position={[s * 0.12, 0, -0.008]} color={wing} rough={0.75} />
              <Ball scale={[0.12, 0.012, 0.085]} position={[s * 0.23, -0.002, -0.03]} rotation={[0, s * 0.35, 0]} color="#3f444b" rough={0.75} />
              <Box size={[0.13, 0.016, 0.012]} position={[s * 0.1, 0.001, -0.025]} color="#26282c" rough={0.8} />
              <Box size={[0.12, 0.016, 0.012]} position={[s * 0.1, 0.001, -0.045]} color="#26282c" rough={0.8} />
            </group>
          ))}
        </group>
        {/* Queue dans le prolongement du dos (pointe vers le bas), bande terminale sombre */}
        <Box size={[0.056, 0.012, 0.085]} position={[0, 0.062, -0.122]} rotation={[-0.22, 0, 0]} color={body} rough={0.75} />
        <Box size={[0.057, 0.013, 0.02]} position={[0, 0.053, -0.16]} rotation={[-0.22, 0, 0]} color="#2c3035" rough={0.75} />
        {/* Cou irisé (vert et violet) */}
        <Ball scale={[0.05, 0.066, 0.05]} position={[0, 0.132, 0.05]} color="#5a6e66" metal={0.3} rough={0.4} />
        <Ball scale={[0.044, 0.036, 0.04]} position={[0, 0.118, 0.056]} color="#6a5c70" metal={0.3} rough={0.4} />
        {/* Tête : hochements à la marche, picorement */}
        <group ref={ref('head')} position={[0, 0.155, 0.065]} userData={DYNAMIC}>
          <Ball scale={[0.042, 0.042, 0.048]} position={[0, 0.008, 0.008]} color={body} rough={0.75} />
          <Cylinder position={[0, 0.004, 0.04]} rotation={[Math.PI / 2, 0, 0]} radius={0.006} top={0.2} height={0.022} color="#2b2a2a" rough={0.5} />
          <Ball scale={[0.013, 0.007, 0.01]} position={[0, 0.01, 0.03]} color="#e6e2da" rough={0.7} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Ball radius={0.0055} position={[s * 0.019, 0.013, 0.018]} color="#d9761f" rough={0.3} />
              <Ball radius={0.0028} position={[s * 0.0235, 0.013, 0.02]} color="#0d0d0d" rough={0.2} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

const _local = new THREE.Vector3();

/**
 * Groupe de pigeons sur la place (comportement : services/pigeonLogic.js) : au sol ils marchent par à-coups en
 * hochant la tête, picorent, regardent autour d'eux et s'écartent des passants ; quand le visiteur approche à
 * moins de 3 m, ils montent presque à la verticale, s'éloignent au-dessus des toits, reviennent et redescendent
 * en spirale sur leur coin dégagé, jamais près du visiteur ni à travers un bâtiment.
 */
export function Pigeons({ count = 6, spread = 1.4, seed = 0 }) {
  const birds = useMemo(() => {
    const r = (k) => seeded(seed * 3.1 + k);
    return Array.from({ length: count }, (_, i) => {
      const a = r(i * 7.1) * Math.PI * 2;
      const d = r(i * 3.3) * spread * 0.8;
      return {
        plumage: PLUMAGES[i % PLUMAGES.length],
        state: newPigeon(Math.cos(a) * d, Math.sin(a) * d, r(i * 5.7) * Math.PI * 2, r(i * 2.9) * 2, r(i)),
        speed: 0.14 + r(i * 9.9) * 0.08,
        rand: (k) => r(i * 13.37 + k),
        parts: {},
      };
    });
  }, [count, spread, seed]);
  const rootRef = useRef();
  const roots = useRef([]);
  const tick = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();
    tick.current += 1;
    const root0 = rootRef.current;
    if (!root0) return;
    // Visiteur et passants dans le repère du groupe (rez-de-chaussée)
    let threat = null;
    if (visit.active && visit.level === 0) {
      _local.set(visit.x, 0, visit.z);
      root0.worldToLocal(_local);
      threat = { x: _local.x, z: _local.z };
    }
    const walkers = [];
    bodies.forEach((bd) => {
      if (bd.kind !== 'npc' || (bd.level || 0) !== 0) return;
      _local.set(bd.x, 0, bd.z);
      root0.worldToLocal(_local);
      if (Math.hypot(_local.x, _local.z) < spread + 3) walkers.push({ x: _local.x, z: _local.z });
    });
    birds.forEach((b, i) => {
      const root = roots.current[i];
      const { body, head, legs, folded, spread: wings, leftWing, rightWing } = b.parts;
      if (!root || !body || !head) return;
      stepPigeon(b, { threat, walkers, dt, t, tick: tick.current, spread, index: i });
      const s = b.state;
      root.position.set(s.x, s.y, s.z);
      root.rotation.y += Math.atan2(Math.sin(s.heading - root.rotation.y), Math.cos(s.heading - root.rotation.y)) * Math.min(1, dt * (s.flying ? 8 : 6));
      if (folded) folded.visible = !s.flying;
      if (wings) wings.visible = s.flying;
      if (legs) legs.visible = s.legs !== false;
      if (s.flying) {
        body.rotation.set(s.pitch || 0, 0, 0);
        head.position.set(0, 0.155, 0.065);
        head.rotation.set(0.25, 0, 0);
        if (leftWing) leftWing.rotation.z = -(s.beat || 0);
        if (rightWing) rightWing.rotation.z = s.beat || 0;
      } else {
        // Corps : léger dandinement en marchant, bascule pour picorer ; tête : hochement, plongée, coups d'œil
        body.rotation.set((s.peck || 0) * 0.5, 0, s.mode === 'walk' ? Math.sin(s.step * Math.PI) * 0.06 : 0);
        head.position.set(0, 0.155 - (s.peck || 0) * 0.02, 0.065 + (s.bob || 0));
        head.rotation.set((s.peck || 0) * 0.7, s.look || 0, 0);
      }
    });
  });

  return (
    <group ref={rootRef}>
      {birds.map((b, i) => (
        <group key={i} ref={(el) => (roots.current[i] = el)} userData={DYNAMIC}>
          <Pigeon plumage={b.plumage} parts={b.parts} />
        </group>
      ))}
    </group>
  );
}
