import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Person } from './models/people';
import MergeStatic from './models/MergeStatic';
import { buildRoundedIndustrialCurve } from './roundedPath';
import { traffic } from './traffic';

const Y_INDOOR = 0.18;
const Y_OUTDOOR = 0.04;
const WALK_SPEED = 3.2; // vitesse de marche apparente moyenne (unités / s) pour un facteur de 1

/** File de priorité minimale (tas binaire) pour le plus court chemin. */
function createHeap() {
  const items = [];
  const swap = (i, j) => ([items[i], items[j]] = [items[j], items[i]]);
  return {
    get size() {
      return items.length;
    },
    push(item) {
      items.push(item);
      for (let i = items.length - 1; i > 0; ) {
        const parent = (i - 1) >> 1;
        if (items[parent][0] <= items[i][0]) break;
        swap(i, parent);
        i = parent;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) {
        items[0] = last;
        for (let i = 0; ; ) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < items.length && items[l][0] < items[m][0]) m = l;
          if (r < items.length && items[r][0] < items[m][0]) m = r;
          if (m === i) break;
          swap(i, m);
          i = m;
        }
      }
      return top;
    },
  };
}

/**
 * Plus court chemin sur le réseau des couloirs piétons (plan du site), d'un poste à un autre :
 * couloirs intérieurs, portes, couloirs le long de la voirie et passages piétons. Au seuil d'une
 * porte, l'opérateur passe de la dalle du bâtiment au pavé extérieur.
 */
function walkRoute(graph, from, to) {
  if (!graph || from === undefined || to === undefined || from === to) return null;
  const dist = new Map([[from, 0]]);
  const prev = new Map();
  const heap = createHeap();
  heap.push([0, from]);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (u === to) break;
    if (d > dist.get(u)) continue;
    for (const { to: v, w, sill } of graph.adjacency[u]) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, { node: u, sill });
        heap.push([nd, v]);
      }
    }
  }
  if (!prev.has(to)) return null;

  const path = [to];
  const sills = [];
  for (let n = to; prev.has(n); n = prev.get(n).node) {
    sills.unshift(prev.get(n).sill);
    path.unshift(prev.get(n).node);
  }
  const waypoints = [];
  path.forEach((id, i) => {
    if (i > 0 && sills[i - 1]) waypoints.push([sills[i - 1][0], Y_INDOOR, sills[i - 1][1]]);
    const n = graph.nodes[id];
    waypoints.push([n.x, n.indoor ? Y_INDOOR : Y_OUTDOOR, n.z]);
  });
  return waypoints;
}

// Opérateurs du site de démonstration ; sur un autre DUER, leurs trajets relient automatiquement
// des postes de bâtiments différents
const PERSONAS = [
  { id: 'agent-1', name: 'Marc (Chef d’Atelier)', role: 'Production ↔ Études', helmetColor: '#f59e0b', suitColor: '#2563eb', from: 'UT14', to: 'UT8', pace: 1.05, phaseOffset: 0.0 },
  { id: 'agent-2', name: 'Sophie (Ingénieure HSE)', role: 'Audit Sécurité Peinture ↔ Admin', helmetColor: '#10b981', suitColor: '#0f766e', from: 'UT3', to: 'UT4', pace: 0.92, phaseOffset: 0.35 },
  { id: 'agent-3', name: 'Karim (Cariste / Flux)', role: 'Cariste ↔ Fret Aérien', helmetColor: '#ef4444', suitColor: '#ea580c', from: 'UT17', to: 'UT12', pace: 1.1, phaseOffset: 0.65 },
  { id: 'agent-4', name: 'Léa (Support & Réseau)', role: 'IT ↔ Cabine Peinture', helmetColor: '#38bdf8', suitColor: '#4f46e5', from: 'UT7', to: 'UT18', pace: 0.96, phaseOffset: 0.18 },
  { id: 'agent-5', name: 'Thomas (Logistique / VRP)', role: 'Coursiers ↔ Commerciaux VRP', helmetColor: '#eab308', suitColor: '#7c3aed', from: 'UT11', to: 'UT5', pace: 0.88, phaseOffset: 0.5 },
];

/**
 * Étape 4 — Cinématique des flux & Déplacements d'agents humanoïdes animés
 * Les opérateurs circulent exclusivement le long des couloirs piétons balisés (verts/jaunes),
 * franchissent les portes piétonnes des bâtiments et traversent sur les passages piétons.
 */
export default function WorkerAgents({
  buildings = [],
  site,
  showPaths = true,
  agentsEnabled = true,
  speedMultiplier = 1,
  onSelectUt,
  showLabels = true,
}) {
  const agentRoutes = useMemo(() => {
    const allWorkUnits = buildings.flatMap((b) => b.workUnits || []);
    if (allWorkUnits.length < 2 || !site?.walkGraph) return [];

    const findUt = (ref) => allWorkUnits.find((u) => u.ref?.toLowerCase() === ref.toLowerCase());
    // Repli : postes de deux bâtiments différents (ou deux postes du même s'il n'y en a qu'un)
    const staffed = buildings.filter((b) => b.workUnits?.length);
    const autoPair = (i) => {
      const a = staffed[(i * 2) % staffed.length];
      const b = staffed[(i * 2 + 1) % staffed.length];
      const fromUt = a.workUnits[(i * 3) % a.workUnits.length];
      const toUt = b.workUnits.find((u, k) => u !== fromUt && k >= (i * 5 + 1) % b.workUnits.length) || allWorkUnits.find((u) => u !== fromUt);
      return [fromUt, toUt];
    };

    return PERSONAS.flatMap((persona, i) => {
      const preferred = [findUt(persona.from), findUt(persona.to)];
      const [fromUt, toUt] = preferred[0] && preferred[1] ? preferred : autoPair(i);
      const waypoints = walkRoute(site.walkGraph, fromUt?.layout3D?.walkNode, toUt?.layout3D?.walkNode);
      if (!waypoints) return [];

      const curve = buildRoundedIndustrialCurve(waypoints, 0.42);
      const length = curve.getLength();
      const points = curve
        .getSpacedPoints(Math.max(96, Math.round(length * 2)))
        .map((pt) => new THREE.Vector3(pt.x, pt.y + 0.04, pt.z));
      return [
        {
          ...persona,
          fromUt,
          toUt,
          // Cycles aller-retour par seconde : vitesse de marche constante quelle que soit la longueur
          speed: (WALK_SPEED * persona.pace) / (2 * Math.max(length, 1)),
          variant: i,
          vestColor: i === 2 ? '#f97316' : '#facc15',
          curve,
          points,
        },
      ];
    });
  }, [buildings, site]);

  if (!agentsEnabled) return null;

  return (
    <group>
      {agentRoutes.map((route) => (
        <React.Fragment key={route.id}>
          {showPaths && (
            <Line
              points={route.points}
              color={route.helmetColor}
              lineWidth={2.2}
              dashed
              dashSize={0.5}
              gapSize={0.3}
              transparent
              opacity={0.8}
            />
          )}
          <AnimatedHumanoidAgent
            route={route}
            speedMultiplier={speedMultiplier}
            onSelectUt={onSelectUt}
            showLabels={showLabels}
          />
        </React.Fragment>
      ))}
    </group>
  );
}

function AnimatedHumanoidAgent({ route, speedMultiplier, onSelectUt, showLabels }) {
  const groupRef = useRef();
  const limbs = useRef({}).current;
  const bodyRef = useRef();

  // Position partagée avec les véhicules du site (ils s'arrêtent devant l'opérateur)
  useEffect(() => {
    traffic.pedestrians.set(route.id, groupRef.current.position);
    return () => traffic.pedestrians.delete(route.id);
  }, [route.id]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime() * route.speed * speedMultiplier + route.phaseOffset;

    // Cycle aller-retour fluide avec léger temps d'arrêt (idle) aux postes A et B
    const rawPingPong = (Math.sin(elapsed * Math.PI * 2) + 1) / 2;
    const clampedT = THREE.MathUtils.smoothstep(rawPingPong, 0.05, 0.95);

    // Vélocité instantanée pour savoir si le personnage marche ou est en pause "idle"
    const isIdle = rawPingPong < 0.06 || rawPingPong > 0.94;

    const pos = route.curve.getPointAt(clampedT);
    groupRef.current.position.copy(pos);

    // Orientation dans le sens de la marche le long du couloir balisé
    const delta = Math.cos(elapsed * Math.PI * 2) >= 0 ? 0.012 : -0.012;
    const lookT = THREE.MathUtils.clamp(clampedT + delta, 0, 1);
    const targetPos = route.curve.getPointAt(lookT);
    if (targetPos.distanceToSquared(pos) > 0.00005) {
      groupRef.current.lookAt(targetPos.x, pos.y, targetPos.z);
    }

    // Animation procédurale : Walk cycle vs Idle breathing
    const animTime = clock.getElapsedTime() * 9 * speedMultiplier;
    const { leftArm, rightArm, leftLeg, rightLeg } = limbs;
    if (isIdle) {
      if (leftArm) leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, 0.15);
      if (rightArm) rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, 0.15);
      if (leftLeg) leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, 0.15);
      if (rightLeg) rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, 0.15);
      if (bodyRef.current) bodyRef.current.position.y = Math.sin(clock.getElapsedTime() * 3) * 0.015;
    } else {
      const swing = Math.sin(animTime) * 0.6;
      if (leftArm) leftArm.rotation.x = swing;
      if (rightArm) rightArm.rotation.x = -swing;
      if (leftLeg) leftLeg.rotation.x = -swing * 0.8;
      if (rightLeg) rightLeg.rotation.x = swing * 0.8;
      if (bodyRef.current) bodyRef.current.position.y = Math.abs(Math.cos(animTime)) * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {/* Opérateur articulé avec EPI (casque et gilet aux couleurs de l'agent) ; corps et membres
            fusionnés séparément (les membres restent animés) */}
        <MergeStatic deps={[route.variant, route.suitColor, route.helmetColor, route.vestColor]}>
          <Person
            outfit="worker"
            variant={route.variant}
            colors={{ top: route.suitColor, helmet: route.helmetColor, vest: route.vestColor }}
            limbs={limbs}
          />
        </MergeStatic>
      </group>

      {/* Badge flottant de l'agent avec son trajet UT A <-> UT B */}
      {showLabels && (
        <Html position={[0, 1.65, 0]} center distanceFactor={28} zIndexRange={[5, 0]}>
          <div
            className="agent-floating-pill"
            onClick={(e) => {
              e.stopPropagation();
              if (route.fromUt && onSelectUt) onSelectUt(route.fromUt);
            }}
            title="Cliquer pour inspecter l'Unité de Travail de départ"
          >
            <span
              className="agent-dot"
              style={{ backgroundColor: route.helmetColor }}
            />
            <span className="agent-name">{route.name}</span>
            <span className="agent-route">
              {route.fromUt?.ref} ↔ {route.toUt?.ref}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
