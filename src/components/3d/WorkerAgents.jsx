import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Person } from './models/people';

/**
 * Étape 4 — Cinématique des flux & Déplacements d'agents humanoïdes animés
 * Les opérateurs circulent en boucle le long de courbes CatmullRom (splines)
 * reliant des points A (UT Atelier) et des points B (UT Bureau / Logistique),
 * avec cycle de marche procédural (balancement bras/jambes) et pause "idle" aux extrémités.
 */
export default function WorkerAgents({
  allWorkUnits = [],
  showPaths = true,
  agentsEnabled = true,
  speedMultiplier = 1,
  onSelectUt,
}) {
  // Construction automatique des trajectoires entre UT à partir des coordonnées réelles de l'API
  const agentRoutes = useMemo(() => {
    if (!allWorkUnits.length) return [];

    const findUt = (refOrKeyword) =>
      allWorkUnits.find(
        (u) =>
          u.ref?.toLowerCase() === refOrKeyword.toLowerCase() ||
          u.label?.toLowerCase().includes(refOrKeyword.toLowerCase())
      ) || allWorkUnits[0];

    const pairs = [
      {
        id: 'agent-1',
        name: 'Marc (Chef d’Atelier)',
        role: 'Production ↔ Études',
        helmetColor: '#f59e0b',
        suitColor: '#2563eb',
        fromUt: findUt('UT14'), // Soudeurs et chaudronnerie
        toUt: findUt('UT8'),    // Bureau d'études
        speed: 0.085,
        phaseOffset: 0.0,
        viaPoint: [0, 0.2, -12],
      },
      {
        id: 'agent-2',
        name: 'Sophie (Ingénieure HSE)',
        role: 'Audit Sécurité Peinture ↔ Admin',
        helmetColor: '#10b981',
        suitColor: '#0f766e',
        fromUt: findUt('UT3'),  // Accrochage - Décrochage (Peinture)
        toUt: findUt('UT4'),    // Administratif et finance
        speed: 0.075,
        phaseOffset: 0.35,
        viaPoint: [-17, 0.2, 0],
      },
      {
        id: 'agent-3',
        name: 'Karim (Cariste / Flux)',
        role: 'Cariste ↔ Fret Aérien',
        helmetColor: '#ef4444',
        suitColor: '#ea580c',
        fromUt: findUt('UT17'), // Cariste (Atelier 1)
        toUt: findUt('UT12'),   // Fret aérien (Logistique)
        speed: 0.095,
        phaseOffset: 0.65,
        viaPoint: [17, 0.2, 0],
      },
      {
        id: 'agent-4',
        name: 'Léa (Support & Réseau)',
        role: 'IT ↔ Cabine Peinture',
        helmetColor: '#38bdf8',
        suitColor: '#4f46e5',
        fromUt: findUt('UT7'),  // Assistance informatique
        toUt: findUt('UT18'),   // Cabine de peinture poudre
        speed: 0.07,
        phaseOffset: 0.18,
        viaPoint: [-4, 0.2, 2],
      },
      {
        id: 'agent-5',
        name: 'Thomas (Logistique / VRP)',
        role: 'Coursiers ↔ Commerciaux VRP',
        helmetColor: '#eab308',
        suitColor: '#7c3aed',
        fromUt: findUt('UT11'), // Coursiers
        toUt: findUt('UT5'),    // Commerciaux VRP
        speed: 0.08,
        phaseOffset: 0.5,
        viaPoint: [3, 0.2, 0],
      },
    ];

    return pairs.map((p, i) => {
      const start = p.fromUt?.layout3D?.worldPosition || [-10, 0.2, -10];
      const end = p.toUt?.layout3D?.worldPosition || [10, 0.2, 10];
      const mid = p.viaPoint || [(start[0] + end[0]) / 2, 0.2, (start[2] + end[2]) / 2];

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(start[0], 0.22, start[2] + 1.4),
        new THREE.Vector3(mid[0], 0.22, mid[2]),
        new THREE.Vector3(end[0], 0.22, end[2] + 1.4),
      ]);

      const points = curve.getPoints(48);
      return {
        ...p,
        variant: i,
        vestColor: i === 2 ? '#f97316' : '#facc15',
        curve,
        points,
      };
    });
  }, [allWorkUnits]);

  if (!agentsEnabled) return null;

  return (
    <group>
      {agentRoutes.map((route) => (
        <React.Fragment key={route.id}>
          {showPaths && (
            <Line
              points={route.points}
              color={route.helmetColor}
              lineWidth={2}
              dashed
              dashSize={0.55}
              gapSize={0.35}
              transparent
              opacity={0.65}
            />
          )}
          <AnimatedHumanoidAgent
            route={route}
            speedMultiplier={speedMultiplier}
            onSelectUt={onSelectUt}
          />
        </React.Fragment>
      ))}
    </group>
  );
}

function AnimatedHumanoidAgent({ route, speedMultiplier, onSelectUt }) {
  const groupRef = useRef();
  const limbs = useRef({}).current;
  const bodyRef = useRef();

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime() * route.speed * speedMultiplier + route.phaseOffset;

    // Cycle aller-retour fluide avec léger temps d'arrêt (idle) aux postes A et B
    const rawPingPong = (Math.sin(elapsed * Math.PI * 2) + 1) / 2;
    const clampedT = THREE.MathUtils.smoothstep(rawPingPong, 0.06, 0.94);

    // Vélocité instantanée pour savoir si le personnage marche ou est en pause "idle"
    const isIdle = rawPingPong < 0.07 || rawPingPong > 0.93;

    const pos = route.curve.getPointAt(clampedT);
    groupRef.current.position.copy(pos);

    // Orientation dans le sens de la marche
    const delta = Math.cos(elapsed * Math.PI * 2) >= 0 ? 0.02 : -0.02;
    const lookT = THREE.MathUtils.clamp(clampedT + delta, 0, 1);
    const targetPos = route.curve.getPointAt(lookT);
    if (targetPos.distanceToSquared(pos) > 0.0001) {
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
        {/* Opérateur articulé avec EPI (casque et gilet aux couleurs de l'agent) */}
        <Person
          outfit="worker"
          variant={route.variant}
          colors={{ top: route.suitColor, helmet: route.helmetColor, vest: route.vestColor }}
          limbs={limbs}
        />
      </group>

      {/* Badge flottant de l'agent avec son trajet UT A <-> UT B */}
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
    </group>
  );
}
