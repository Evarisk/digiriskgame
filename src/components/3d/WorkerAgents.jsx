import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { Person } from './models/people';
import { getBuildingDoorZ } from './models/buildingShells';

/**
 * Construit une trajectoire industrielle lisse (segments rectilignes strictement centrés
 * dans les couloirs piétons + virages à 90° arrondis par courbes de Bézier quadratiques).
 */
function buildRoundedIndustrialCurve(rawWaypoints, cornerRadius = 0.42) {
  const pts = [];
  for (const p of rawWaypoints) {
    const v = new THREE.Vector3(p[0], p[1], p[2]);
    if (!pts.length || pts[pts.length - 1].distanceTo(v) > 0.05) {
      pts.push(v);
    }
  }

  const curvePath = new THREE.CurvePath();
  if (pts.length < 2) {
    curvePath.add(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(1, 0, 0)));
    return curvePath;
  }

  let currentStart = pts[0].clone();

  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const corner = pts[i];
    const next = pts[i + 1];

    const vIn = new THREE.Vector3().subVectors(corner, prev);
    const vOut = new THREE.Vector3().subVectors(next, corner);
    const lenIn = vIn.length();
    const lenOut = vOut.length();
    const r = Math.min(cornerRadius, lenIn * 0.42, lenOut * 0.42);

    if (r > 0.04) {
      const enterPt = corner.clone().addScaledVector(vIn.normalize(), -r);
      const exitPt = corner.clone().addScaledVector(vOut.normalize(), r);
      if (currentStart.distanceTo(enterPt) > 0.02) {
        curvePath.add(new THREE.LineCurve3(currentStart, enterPt));
      }
      curvePath.add(new THREE.QuadraticBezierCurve3(enterPt, corner.clone(), exitPt));
      currentStart = exitPt;
    } else if (currentStart.distanceTo(corner) > 0.02) {
      curvePath.add(new THREE.LineCurve3(currentStart, corner.clone()));
      currentStart = corner.clone();
    }
  }

  const lastPt = pts[pts.length - 1];
  if (currentStart.distanceTo(lastPt) > 0.02) {
    curvePath.add(new THREE.LineCurve3(currentStart, lastPt));
  }

  curvePath.arcLengthDivisions = 360;
  curvePath.updateArcLengths();
  return curvePath;
}

/**
 * Calcule le cheminement interne d'une Unité de Travail jusqu'au seuil extérieur
 * de la porte choisie (`'side'` = porte piétonne latérale, `'south'` = porte principale Sud).
 */
function getBuildingExitWaypoints(ut, building, doorType = 'side') {
  if (!ut?.layout3D?.worldPosition || !building?.layout3D?.position) {
    const [wx, , wz] = ut?.layout3D?.worldPosition || [0, 0.18, 0];
    return [[wx, 0.18, wz + 1.8]];
  }

  const [bx, , bz] = building.layout3D.position;
  const [w, , d] = building.layout3D.size;
  const [ox] = building.layout3D.outward || [Math.sign(bx) || 1, Math.sign(bz) || 1];
  const [ux, , uz] = ut.layout3D.localPosition;
  const worldUx = bx + ux;
  const worldUz = bz + uz;

  const doorZ = getBuildingDoorZ(d);
  const sideWorldZ = bz + doorZ;
  const sideDoorInnerX = bx - ox * (w / 2 - 0.55);
  const sideDoorOuterX = bx - ox * (w / 2 + 0.55);
  const outdoorCorrX = ox > 0 ? 6.2 : bz < 0 ? -4.25 : -6.2;

  const southDoorInnerZ = bz + d / 2 - 0.55;
  const southDoorOuterZ = bz + d / 2 + 0.55;
  const outdoorSouthZ = bz < 0 ? (bx < 0 ? -3.25 : -5.4) : bz + d / 2 + 1.1;

  const yIn = 0.18;
  const yOut = 0.04;

  // Bâtiment à 1 rangée (ex. GP2 Production, depth = 11.4)
  if (d < 14) {
    const startPt = [worldUx, yIn, worldUz + 2.1];
    const onCorridor = [worldUx, yIn, sideWorldZ];
    if (doorType === 'south') {
      return [
        startPt,
        onCorridor,
        [bx, yIn, sideWorldZ],
        [bx, yIn, southDoorInnerZ],
        [bx, yOut, southDoorOuterZ],
        [bx, yOut, outdoorSouthZ],
      ];
    }
    return [
      startPt,
      onCorridor,
      [sideDoorInnerX, yIn, sideWorldZ],
      [sideDoorOuterX, yOut, sideWorldZ],
      [outdoorCorrX, yOut, sideWorldZ],
    ];
  }

  // Bâtiment à 2 rangées (ex. GP1 Bureaux, GP3 Peinture, GP4 Logistique, depth = 16.8)
  const frontWorldZ = bz + (d / 2 - 1.6); // bz + 6.8
  const isThreeCols = (building.children?.length || 0) > 4;
  const aisleX = isThreeCols ? (ux < 0 ? bx - 3.1 : bx + 3.1) : bx;

  if (uz < 0) {
    // Poste du 1er rang (arrière) : accès direct sur le couloir transversal central (sideWorldZ)
    const startPt = [worldUx, yIn, worldUz + 2.05];
    const onCentralCorridor = [worldUx, yIn, sideWorldZ];
    if (doorType === 'side') {
      return [
        startPt,
        onCentralCorridor,
        [sideDoorInnerX, yIn, sideWorldZ],
        [sideDoorOuterX, yOut, sideWorldZ],
        [outdoorCorrX, yOut, sideWorldZ],
      ];
    }
    return [
      startPt,
      onCentralCorridor,
      [aisleX, yIn, sideWorldZ],
      [aisleX, yIn, frontWorldZ],
      [bx, yIn, frontWorldZ],
      [bx, yIn, southDoorInnerZ],
      [bx, yOut, southDoorOuterZ],
      [bx, yOut, outdoorSouthZ],
    ];
  }

  // Poste du 2e rang (avant) : accès sur le couloir avant Sud (frontWorldZ)
  const startPt = [worldUx, yIn, worldUz + 2.1];
  const onFrontCorridor = [worldUx, yIn, frontWorldZ];
  if (doorType === 'south') {
    return [
      startPt,
      onFrontCorridor,
      [bx, yIn, frontWorldZ],
      [bx, yIn, southDoorInnerZ],
      [bx, yOut, southDoorOuterZ],
      [bx, yOut, outdoorSouthZ],
    ];
  }
  return [
    startPt,
    onFrontCorridor,
    [aisleX, yIn, frontWorldZ],
    [aisleX, yIn, sideWorldZ],
    [sideDoorInnerX, yIn, sideWorldZ],
    [sideDoorOuterX, yOut, sideWorldZ],
    [outdoorCorrX, yOut, sideWorldZ],
  ];
}

/**
 * Étape 4 — Cinématique des flux & Déplacements d'agents humanoïdes animés
 * Les opérateurs circulent exclusivement le long des couloirs piétons balisés (verts/jaunes),
 * franchissent les portes piétonnes des bâtiments et traversent sur les passages piétons.
 */
export default function WorkerAgents({
  allWorkUnits = [],
  buildings = [],
  showPaths = true,
  agentsEnabled = true,
  speedMultiplier = 1,
  onSelectUt,
  showLabels = true,
}) {
  const agentRoutes = useMemo(() => {
    if (!allWorkUnits.length) return [];

    const findUt = (refOrKeyword) =>
      allWorkUnits.find(
        (u) =>
          u.ref?.toLowerCase() === refOrKeyword.toLowerCase() ||
          u.label?.toLowerCase().includes(refOrKeyword.toLowerCase())
      ) || allWorkUnits[0];

    const findBuildingForUt = (ut) =>
      buildings.find(
        (b) => b.ref === ut?.parentBuildingRef || b.children?.some((c) => c.id === ut?.id)
      ) || buildings[0];

    const yOut = 0.04;

    const pairs = [
      {
        id: 'agent-1',
        name: 'Marc (Chef d’Atelier)',
        role: 'Production ↔ Études',
        helmetColor: '#f59e0b',
        suitColor: '#2563eb',
        fromUt: findUt('UT14'), // Soudeurs et chaudronnerie (GP2)
        toUt: findUt('UT8'),    // Bureau d'études (GP1)
        fromDoor: 'side',       // Porte latérale Ouest GP2
        toDoor: 'south',        // Porte principale Sud GP1
        outdoorWaypoints: [
          [6.2, yOut, -5.4],
          [-4.25, yOut, -5.4],
          [-4.25, yOut, -3.25],
        ],
        speed: 0.055,
        phaseOffset: 0.0,
      },
      {
        id: 'agent-2',
        name: 'Sophie (Ingénieure HSE)',
        role: 'Audit Sécurité Peinture ↔ Admin',
        helmetColor: '#10b981',
        suitColor: '#0f766e',
        fromUt: findUt('UT3'),  // Accrochage - Décrochage (GP3 Peinture)
        toUt: findUt('UT4'),    // Administratif et finance (GP1 Bureaux)
        fromDoor: 'side',       // Porte latérale Est GP3
        toDoor: 'side',         // Porte latérale Est GP1
        outdoorWaypoints: [
          [-6.2, yOut, -3.25],
          [-4.25, yOut, -3.25],
        ],
        speed: 0.048,
        phaseOffset: 0.35,
      },
      {
        id: 'agent-3',
        name: 'Karim (Cariste / Flux)',
        role: 'Cariste ↔ Fret Aérien',
        helmetColor: '#ef4444',
        suitColor: '#ea580c',
        fromUt: findUt('UT17'), // Cariste (GP2 Production)
        toUt: findUt('UT12'),   // Fret aérien (GP4 Logistique)
        fromDoor: 'south',      // Porte principale Sud GP2
        toDoor: 'side',         // Porte latérale Ouest GP4
        outdoorWaypoints: [
          [6.2, yOut, -5.4],
        ],
        speed: 0.058,
        phaseOffset: 0.65,
      },
      {
        id: 'agent-4',
        name: 'Léa (Support & Réseau)',
        role: 'IT ↔ Cabine Peinture',
        helmetColor: '#38bdf8',
        suitColor: '#4f46e5',
        fromUt: findUt('UT7'),  // Assistance informatique (GP1 Bureaux)
        toUt: findUt('UT18'),   // Cabine de peinture poudre (GP3 Peinture)
        fromDoor: 'south',      // Porte principale Sud GP1
        toDoor: 'side',         // Porte latérale Est GP3
        outdoorWaypoints: [
          [-6.2, yOut, -3.25],
        ],
        speed: 0.05,
        phaseOffset: 0.18,
      },
      {
        id: 'agent-5',
        name: 'Thomas (Logistique / VRP)',
        role: 'Coursiers ↔ Commerciaux VRP',
        helmetColor: '#eab308',
        suitColor: '#7c3aed',
        fromUt: findUt('UT11'), // Coursiers (GP4 Logistique)
        toUt: findUt('UT5'),    // Commerciaux VRP (GP1 Bureaux)
        fromDoor: 'side',       // Porte latérale Ouest GP4
        toDoor: 'side',         // Porte latérale Est GP1
        outdoorWaypoints: [
          [6.2, yOut, 5.4],
          [-6.2, yOut, 5.4],
          [-6.2, yOut, -3.25],
          [-4.25, yOut, -3.25],
        ],
        speed: 0.046,
        phaseOffset: 0.5,
      },
    ];

    return pairs.map((p, i) => {
      const fromBuilding = findBuildingForUt(p.fromUt);
      const toBuilding = findBuildingForUt(p.toUt);

      const exitWaypoints = getBuildingExitWaypoints(p.fromUt, fromBuilding, p.fromDoor);
      const entryWaypoints = getBuildingExitWaypoints(p.toUt, toBuilding, p.toDoor).slice().reverse();
      const allWaypoints = [...exitWaypoints, ...(p.outdoorWaypoints || []), ...entryWaypoints];

      const curve = buildRoundedIndustrialCurve(allWaypoints, 0.42);
      const points = curve.getSpacedPoints(96).map((pt) => new THREE.Vector3(pt.x, pt.y + 0.04, pt.z));

      return {
        ...p,
        variant: i,
        vestColor: i === 2 ? '#f97316' : '#facc15',
        curve,
        points,
      };
    });
  }, [allWorkUnits, buildings]);

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
        {/* Opérateur articulé avec EPI (casque et gilet aux couleurs de l'agent) */}
        <Person
          outfit="worker"
          variant={route.variant}
          colors={{ top: route.suitColor, helmet: route.helmetColor, vest: route.vestColor }}
          limbs={limbs}
        />
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
