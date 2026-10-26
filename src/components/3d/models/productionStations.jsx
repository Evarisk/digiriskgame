import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  PALETTE,
  Box,
  Cylinder,
  Ball,
  Tube,
  FloorZone,
  HazardBar,
  SafetySign,
  Extinguisher,
  Pallet,
  LoadedPallet,
  PalletRack,
  Barrel,
  GasBottle,
  Forklift,
  Wheel,
  seeded,
  DYNAMIC,
} from './kit';
import { Person } from './people';

/**
 * Postes de production (Groupement « Atelier / Production ») — emprise X ±2,2 / Z ±1,8, sol en y = 0.
 * `accent` = couleur de cotation DigiRisk, reprise sur le marquage au sol de la zone dangereuse.
 */

const MACHINE = PALETTE.machineGreen;
const STEEL = { color: PALETTE.steel, metal: 0.8, rough: 0.3 };

/** Établi bois / acier avec tiroirs. */
function Workbench({ width = 1.3, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.5, 0]} size={[width, 0.05, 0.55]} color={PALETTE.wood} rough={0.75} receive />
      <Box position={[width / 2 - 0.25, 0.24, 0]} size={[0.42, 0.46, 0.5]} color="#b91c1c" metal={0.4} rough={0.45} />
      {[0.1, 0.22, 0.34].map((y) => (
        <Box key={y} position={[width / 2 - 0.25, y, 0.252]} size={[0.3, 0.012, 0.01]} color={PALETTE.steel} shadow={false} />
      ))}
      <Box position={[-width / 2 + 0.04, 0.24, 0]} size={[0.05, 0.48, 0.5]} color={PALETTE.darkSteel} metal={0.5} />
      <Box position={[0, 0.1, 0]} size={[width - 0.1, 0.03, 0.45]} color={PALETTE.darkSteel} metal={0.5} />
    </group>
  );
}

/** Panneau à outils mural. */
function ToolBoard({ width = 1.2, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.9, 0]} size={[width, 0.6, 0.03]} color="#cbd5e1" rough={0.8} />
      {Array.from({ length: 7 }, (_, i) => (
        <Box
          key={i}
          position={[-width / 2 + 0.12 + i * ((width - 0.24) / 6), 0.85 + seeded(i + 3) * 0.15, 0.025]}
          size={[0.04, 0.16 + seeded(i) * 0.12, 0.02]}
          color={i % 3 === 0 ? '#dc2626' : PALETTE.darkSteel}
          metal={0.6}
          shadow={false}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Débit : scie à ruban horizontale + convoyeur à rouleaux             */
/* ------------------------------------------------------------------ */

function RollerConveyor({ length = 1.6, rollers = 7, ...rest }) {
  return (
    <group {...rest}>
      {[-0.19, 0.19].map((z) => (
        <Box key={z} position={[0, 0.5, z]} size={[length, 0.06, 0.04]} color={MACHINE} metal={0.4} />
      ))}
      {[-length / 2 + 0.1, length / 2 - 0.1].map((x) =>
        [-0.19, 0.19].map((z) => (
          <Box key={`${x}${z}`} position={[x, 0.24, z]} size={[0.05, 0.48, 0.05]} color={PALETTE.darkSteel} metal={0.5} />
        ))
      )}
      {Array.from({ length: rollers }, (_, i) => (
        <Cylinder
          key={i}
          position={[-length / 2 + 0.1 + (i * (length - 0.2)) / (rollers - 1), 0.53, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          radius={0.035}
          height={0.36}
          segments={10}
          {...STEEL}
        />
      ))}
    </group>
  );
}

export function SawCutting({ accent }) {
  const armRef = useRef();
  useFrame(({ clock }) => {
    if (!armRef.current) return;
    // Descente lente pendant la coupe puis remontée rapide
    const cycle = (clock.getElapsedTime() * 0.18) % 1;
    const k = cycle < 0.8 ? cycle / 0.8 : 1 - (cycle - 0.8) / 0.2;
    armRef.current.rotation.z = 0.32 - k * 0.27;
  });
  return (
    <group>
      <FloorZone position={[0.3, 0, 0]} width={1.9} depth={1.4} color={accent} />
      {/* Bâti de la scie */}
      <group position={[0.3, 0, 0]}>
        <Box position={[0, 0.25, 0]} size={[1.0, 0.5, 0.6]} color={MACHINE} metal={0.35} rough={0.5} />
        <Box position={[0, 0.52, 0]} size={[1.05, 0.05, 0.65]} color={PALETTE.graphite} metal={0.4} />
        <Box position={[0.1, 0.62, -0.12]} size={[0.25, 0.16, 0.08]} color={PALETTE.darkSteel} metal={0.6} />
        <Box position={[0.1, 0.62, 0.12]} size={[0.25, 0.16, 0.08]} color={PALETTE.darkSteel} metal={0.6} />
        {/* Archet pivotant (animé) */}
        <group ref={armRef} userData={DYNAMIC} position={[-0.5, 0.62, -0.25]}>
          <Box position={[0.6, 0.12, 0.25]} size={[1.25, 0.24, 0.1]} color={MACHINE} metal={0.35} rough={0.5} />
          <Cylinder position={[0.05, 0.12, 0.25]} rotation={[Math.PI / 2, 0, 0]} radius={0.2} height={0.14} color={MACHINE} metal={0.35} />
          <Cylinder position={[1.15, 0.12, 0.25]} rotation={[Math.PI / 2, 0, 0]} radius={0.2} height={0.14} color={MACHINE} metal={0.35} />
          <Box position={[0.6, -0.02, 0.25]} size={[1.0, 0.03, 0.02]} color={PALETTE.steel} metal={0.9} rough={0.2} />
          <Box position={[0.6, 0.0, 0.31]} size={[0.5, 0.08, 0.02]} color={PALETTE.safetyYellow} />
          <Cylinder position={[0.05, 0.36, 0.25]} radius={0.09} height={0.22} color="#334155" metal={0.5} />
        </group>
        <Box position={[0.42, 0.85, 0.3]} size={[0.16, 0.2, 0.08]} color={PALETTE.graphite} />
        <Cylinder position={[0.42, 0.92, 0.35]} rotation={[Math.PI / 2, 0, 0]} radius={0.03} height={0.03} color="#dc2626" glow={0.4} />
      </group>
      {/* Convoyeur d'amenage + barre en cours de débit */}
      <RollerConveyor position={[-1.35, 0, 0]} length={1.5} />
      <Cylinder position={[-0.75, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} radius={0.045} height={2.6} {...STEEL} />
      {/* Table de sortie et bac de pièces coupées */}
      <RollerConveyor position={[1.45, 0, 0]} length={0.6} rollers={4} />
      <group position={[1.55, 0, 0.95]}>
        <Box position={[0, 0.18, 0]} size={[0.6, 0.36, 0.45]} color="#2563eb" metal={0.3} />
        {[-0.15, 0, 0.15].map((x, i) => (
          <Cylinder key={x} position={[x, 0.38, (i - 1) * 0.08]} rotation={[0, 0, Math.PI / 2]} radius={0.045} height={0.3} {...STEEL} />
        ))}
      </group>
      {/* Rack cantilever de barres */}
      <group position={[-0.4, 0, -1.5]}>
        {[-1.2, 0.0, 1.2].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <Box position={[0, 0.6, -0.1]} size={[0.1, 1.2, 0.1]} color={PALETTE.rackBlue} metal={0.4} />
            <Box position={[0, 0.02, 0.05]} size={[0.12, 0.04, 0.5]} color={PALETTE.rackBlue} metal={0.4} />
            {[0.35, 0.7, 1.05].map((y) => (
              <Box key={y} position={[0, y, 0.12]} size={[0.06, 0.05, 0.42]} color={PALETTE.rackBlue} metal={0.4} />
            ))}
          </group>
        ))}
        {[0.35, 0.7, 1.05].map((y, l) =>
          [0.0, 0.11, 0.22].map((z, i) =>
            seeded(l * 3 + i) > 0.2 ? (
              <Cylinder key={`${y}${z}`} position={[0, y + 0.07, z]} rotation={[0, 0, Math.PI / 2]} radius={0.04} height={2.9} {...STEEL} />
            ) : null
          )
        )}
      </group>
      <Barrel position={[1.85, 0, -1.35]} color="#0ea5e9" />
      <Extinguisher position={[2.1, 0, -0.45]} rotation={[0, -Math.PI / 2, 0]} />
      <SafetySign kind="mandatory" position={[-2.0, 0, 1.4]} />
      <Person outfit="worker" variant={1} pose="work" position={[0.7, 0, 0.72]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cisaille guillotine                                                  */
/* ------------------------------------------------------------------ */

export function Shear({ accent }) {
  const bladeRef = useRef();
  useFrame(({ clock }) => {
    if (!bladeRef.current) return;
    const cycle = (clock.getElapsedTime() * 0.5) % 1;
    bladeRef.current.position.y = cycle < 0.15 ? 1.05 - (cycle / 0.15) * 0.12 : 0.93 + Math.min(1, (cycle - 0.15) / 0.3) * 0.12;
  });
  const body = PALETTE.machineBlue;
  return (
    <group>
      <FloorZone position={[0, 0, 0.35]} width={2.9} depth={1.1} color={accent} />
      <group position={[0, 0, -0.45]}>
        {/* Bâtis latéraux */}
        {[-1.12, 1.12].map((x) => (
          <Box key={x} position={[x, 0.6, 0]} size={[0.28, 1.2, 0.9]} color={body} metal={0.35} rough={0.45} />
        ))}
        {/* Table et tablier porte-lame mobile */}
        <Box position={[0, 0.3, 0]} size={[1.96, 0.6, 0.55]} color="#24497a" metal={0.35} rough={0.5} />
        <Box position={[0, 0.615, 0.05]} size={[2.0, 0.03, 0.6]} color={PALETTE.steel} metal={0.7} rough={0.3} />
        <group ref={bladeRef} userData={DYNAMIC} position={[0, 1.05, 0]}>
          <Box position={[0, 0, -0.05]} size={[2.1, 0.3, 0.3]} color={body} metal={0.35} rough={0.45} />
          <Box position={[0, -0.12, 0.12]} size={[2.0, 0.05, 0.04]} color={PALETTE.steel} metal={0.9} rough={0.2} />
          <Box position={[0, -0.04, 0.16]} size={[2.0, 0.14, 0.02]} color={PALETTE.safetyYellow} opacity={0.85} />
        </group>
        {/* Presse-tôles */}
        {Array.from({ length: 8 }, (_, i) => (
          <Cylinder key={i} position={[-0.84 + i * 0.24, 0.72, 0.15]} radius={0.035} height={0.16} color={PALETTE.graphite} metal={0.6} />
        ))}
        {/* Centrale hydraulique */}
        <Box position={[1.12, 1.32, -0.1]} size={[0.3, 0.24, 0.6]} color="#24497a" metal={0.35} />
        <Cylinder position={[1.12, 1.52, 0.05]} radius={0.09} height={0.18} color="#334155" metal={0.5} />
        {/* Bras supports avant + tôle en cours de coupe */}
        {[-0.6, 0.6].map((x) => (
          <Box key={x} position={[x, 0.6, 0.65]} size={[0.06, 0.06, 0.75]} color={PALETTE.darkSteel} metal={0.6} />
        ))}
        <Box position={[0, 0.645, 0.5]} size={[1.6, 0.012, 0.9]} color="#cbd5e1" metal={0.85} rough={0.25} />
        {/* Barrage immatériel (cellules de sécurité) */}
        {[-1.15, 1.15].map((x) => (
          <Box key={x} position={[x, 0.75, 1.05]} size={[0.05, 0.9, 0.05]} color={PALETTE.graphite} />
        ))}
        {[0.5, 0.75, 1.0].map((y) => (
          <Box key={y} position={[0, y, 1.05]} size={[2.25, 0.006, 0.006]} color="#ef4444" glow={2} opacity={0.55} shadow={false} />
        ))}
        {/* Pupitre de commande */}
        <group position={[1.6, 0, 0.6]}>
          <Box position={[0, 0.5, 0]} size={[0.05, 1.0, 0.05]} color={PALETTE.graphite} />
          <Box position={[0, 1.05, 0]} rotation={[-0.4, 0, 0]} size={[0.3, 0.22, 0.1]} color="#e5e7eb" />
          <Cylinder position={[-0.07, 1.08, 0.06]} rotation={[1.17, 0, 0]} radius={0.03} height={0.03} color="#dc2626" glow={0.5} />
          <Cylinder position={[0.07, 1.08, 0.06]} rotation={[1.17, 0, 0]} radius={0.025} height={0.03} color="#22c55e" glow={0.8} />
        </group>
        {/* Pédale */}
        <Box position={[0.3, 0.05, 1.2]} size={[0.25, 0.1, 0.3]} color={PALETTE.safetyYellow} />
        <Tube points={[[0.3, 0.05, 1.05], [0.5, 0.02, 0.8], [0.9, 0.02, 0.5]]} radius={0.012} />
      </group>
      {/* Stock de tôles et bac de pièces */}
      <group position={[-1.65, 0, -1.45]} rotation={[0, Math.PI / 2, 0]}>
        <Pallet />
        {[0, 1, 2, 3, 4].map((i) => (
          <Box key={i} position={[0, 0.115 + i * 0.022, 0]} size={[0.78, 0.018, 0.5]} color={i % 2 ? '#cbd5e1' : '#94a3b8'} metal={0.85} rough={0.25} />
        ))}
      </group>
      <group position={[1.75, 0, -1.5]}>
        <Box position={[0, 0.03, 0]} size={[0.6, 0.06, 0.45]} color={PALETTE.darkSteel} />
        {[[0, 0.28, 0.22], [0, 0.28, -0.22]].map(([x, y, z]) => (
          <Box key={z} position={[x, y, z]} size={[0.6, 0.5, 0.01]} color={PALETTE.steel} metal={0.6} opacity={0.6} />
        ))}
        <Box position={[0.3, 0.28, 0]} size={[0.01, 0.5, 0.45]} color={PALETTE.steel} metal={0.6} opacity={0.6} />
        <Box position={[0, 0.2, 0]} size={[0.55, 0.25, 0.4]} color="#cbd5e1" metal={0.8} rough={0.3} />
      </group>
      <SafetySign kind="warning" position={[-1.95, 0, 0.6]} />
      <Person outfit="worker" variant={2} pose="work" position={[-0.2, 0, 1.0]} rotation={[0, Math.PI, 0]} colors={{ helmet: '#facc15' }} />
      <SafetySign kind="mandatory" position={[-1.95, 0, 1.25]} />
      <Extinguisher position={[2.1, 0, 1.3]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Perceuse à colonne                                                   */
/* ------------------------------------------------------------------ */

function PillarDrill({ color = MACHINE, ...rest }) {
  const spindleRef = useRef();
  const quillRef = useRef();
  useFrame(({ clock }, delta) => {
    if (spindleRef.current) spindleRef.current.rotation.y += delta * 14;
    if (quillRef.current) {
      const t = clock.getElapsedTime();
      quillRef.current.position.y = -Math.max(0, Math.sin(t * 0.9)) * 0.1;
    }
  });
  return (
    <group {...rest}>
      <Box position={[0, 0.04, 0]} size={[0.5, 0.08, 0.7]} color={color} metal={0.35} rough={0.5} />
      <Cylinder position={[0, 0.8, -0.22]} radius={0.06} height={1.55} {...STEEL} />
      {/* Table de perçage + étau + pièce */}
      <Box position={[0, 0.72, -0.12]} size={[0.16, 0.12, 0.16]} color={color} metal={0.35} />
      <Cylinder position={[0, 0.78, 0.05]} radius={0.22} height={0.04} segments={20} color={color} metal={0.35} />
      <Box position={[0, 0.84, 0.05]} size={[0.2, 0.08, 0.12]} color={PALETTE.darkSteel} metal={0.6} />
      <Box position={[0, 0.9, 0.05]} size={[0.12, 0.05, 0.06]} {...STEEL} />
      {/* Tête, moteur et carter de courroie */}
      <Box position={[0, 1.42, -0.08]} size={[0.3, 0.34, 0.5]} color={color} metal={0.35} rough={0.5} />
      <Box position={[0, 1.63, -0.08]} size={[0.32, 0.08, 0.56]} color={color} metal={0.35} />
      <Cylinder position={[0, 1.55, -0.38]} rotation={[Math.PI / 2, 0, 0]} radius={0.1} height={0.22} color="#334155" metal={0.5} />
      {/* Arrêt d'urgence */}
      <Box position={[0.12, 1.45, 0.18]} size={[0.07, 0.07, 0.04]} color={PALETTE.safetyYellow} />
      <Cylinder position={[0.12, 1.45, 0.21]} rotation={[Math.PI / 2, 0, 0]} radius={0.028} height={0.03} color="#dc2626" glow={0.5} />
      {/* Leviers d'avance */}
      {[0, 1, 2].map((i) => {
        const a = (i * Math.PI * 2) / 3;
        return (
          <group key={i} position={[0.17, 1.38, 0.0]} rotation={[a, 0, 0]}>
            <Box position={[0.02, 0.1, 0]} size={[0.015, 0.2, 0.015]} {...STEEL} />
            <Ball position={[0.02, 0.21, 0]} radius={0.025} color={PALETTE.rubber} />
          </group>
        );
      })}
      {/* Fourreau, mandrin & foret en rotation */}
      <group ref={quillRef} userData={DYNAMIC}>
        <Cylinder position={[0, 1.2, 0.05]} radius={0.035} height={0.16} {...STEEL} />
        <group ref={spindleRef} userData={DYNAMIC} position={[0, 1.09, 0.05]}>
          <Cylinder radius={0.045} height={0.08} top={0.6} segments={8} color={PALETTE.darkSteel} metal={0.8} rough={0.3} />
          <Box position={[0.03, 0, 0]} size={[0.012, 0.06, 0.012]} {...STEEL} />
          <Cylinder position={[0, -0.09, 0]} radius={0.008} height={0.12} segments={6} {...STEEL} />
        </group>
      </group>
      {/* Écran de protection transparent */}
      <Box position={[0, 1.06, 0.2]} size={[0.22, 0.18, 0.008]} color="#bae6fd" opacity={0.35} shadow={false} />
      {/* Lampe de travail */}
      <Tube points={[[-0.15, 1.5, -0.1], [-0.25, 1.62, 0.05], [-0.12, 1.4, 0.18]]} radius={0.012} color={PALETTE.graphite} />
      <Cylinder position={[-0.12, 1.37, 0.18]} radius={0.05} height={0.06} top={0.6} color={PALETTE.graphite} />
      <Cylinder position={[-0.12, 1.335, 0.18]} radius={0.045} height={0.005} color="#fef3c7" glow={2} shadow={false} />
    </group>
  );
}

export function DrillPress({ accent }) {
  return (
    <group>
      <FloorZone position={[-0.6, 0, -0.55]} width={2.4} depth={1.3} color={accent} />
      <PillarDrill position={[-1.15, 0, -0.65]} />
      <PillarDrill position={[-0.1, 0, -0.65]} scale={[0.88, 0.88, 0.88]} color="#4b6b8a" />
      <Person outfit="worker" variant={0} pose="work" position={[-1.15, 0, -0.08]} rotation={[0, Math.PI, 0]} />
      <Workbench position={[1.3, 0, -1.4]} width={1.4} />
      <ToolBoard position={[1.3, 0, -1.72]} width={1.3} />
      {/* Étau d'établi */}
      <Box position={[0.85, 0.57, -1.35]} size={[0.16, 0.09, 0.12]} color="#2563eb" metal={0.4} />
      {/* Chariot de pièces */}
      <group position={[1.45, 0, 0.75]}>
        {[0.15, 0.55].map((y) => (
          <Box key={y} position={[0, y, 0]} size={[0.8, 0.03, 0.5]} color={PALETTE.darkSteel} metal={0.5} />
        ))}
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
          <group key={`${sx}${sz}`}>
            <Box position={[sx * 0.38, 0.35, sz * 0.23]} size={[0.03, 0.6, 0.03]} color={PALETTE.darkSteel} />
            <Wheel position={[sx * 0.38, 0.05, sz * 0.23]} radius={0.05} width={0.03} />
          </group>
        ))}
        {[-0.2, 0.1].map((x) => (
          <Box key={x} position={[x, 0.65, 0]} size={[0.26, 0.16, 0.36]} color="#2563eb" />
        ))}
        {[-0.25, 0, 0.25].map((x) => (
          <Box key={x} position={[x, 0.22, 0]} size={[0.16, 0.12, 0.16]} {...STEEL} />
        ))}
      </group>
      <SafetySign kind="mandatory" position={[-2.0, 0, 0.75]} />
      <SafetySign kind="prohibition" position={[-2.0, 0, 1.35]} />
      <Extinguisher position={[2.1, 0, -0.45]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Soudure & chaudronnerie                                              */
/* ------------------------------------------------------------------ */

function WeldingCurtain({ width = 0.9, height = 1.3, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, height / 2 + 0.1, 0]} size={[width - 0.04, height, 0.015]} color="#dc2626" opacity={0.5} glow={0.15} shadow={false} />
      {[-width / 2, width / 2].map((x) => (
        <group key={x}>
          <Cylinder position={[x, (height + 0.2) / 2, 0]} radius={0.02} height={height + 0.2} color={PALETTE.safetyYellow} metal={0.4} />
          <Box position={[x, 0.02, 0]} size={[0.05, 0.04, 0.4]} color={PALETTE.safetyYellow} />
        </group>
      ))}
      <Cylinder position={[0, height + 0.18, 0]} rotation={[0, 0, Math.PI / 2]} radius={0.015} height={width} color={PALETTE.safetyYellow} metal={0.4} />
    </group>
  );
}

function WeldingSparks({ position }) {
  const sparksRef = useRef([]);
  const coreRef = useRef();
  const lightRef = useRef();
  const sparks = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ seed: i * 1.37 })), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const flicker = 0.6 + Math.abs(Math.sin(t * 37)) * 0.7;
    if (coreRef.current) coreRef.current.scale.setScalar(flicker * 0.05);
    if (lightRef.current) lightRef.current.intensity = 1.2 + flicker * 1.6;
    sparksRef.current.forEach((s, i) => {
      if (!s) return;
      const life = (t * 1.6 + sparks[i].seed) % 1;
      const a = sparks[i].seed * 4.1;
      s.position.set(Math.cos(a) * life * 0.35, 0.08 * life - 0.6 * life * life, Math.sin(a) * life * 0.35);
      s.visible = life < 0.85;
    });
  });
  return (
    <group position={position}>
      <mesh ref={coreRef} userData={DYNAMIC} raycast={() => null}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color="#e0f2fe" />
      </mesh>
      {sparks.map((s, i) => (
        <mesh key={i} ref={(el) => (sparksRef.current[i] = el)} userData={DYNAMIC} raycast={() => null}>
          <boxGeometry args={[0.018, 0.018, 0.018]} />
          <meshBasicMaterial color={i % 3 ? '#fde047' : '#fb923c'} />
        </mesh>
      ))}
      <pointLight ref={lightRef} userData={DYNAMIC} color="#bfdbfe" distance={3.2} decay={2} intensity={2} />
    </group>
  );
}

export function Welding({ accent }) {
  return (
    <group>
      <FloorZone position={[-0.3, 0, -0.25]} width={2.6} depth={2.4} color={accent} />
      {/* Écrans de soudage en L */}
      <WeldingCurtain position={[-1.35, 0, -1.6]} />
      <WeldingCurtain position={[-0.4, 0, -1.6]} />
      <WeldingCurtain position={[-1.85, 0, -1.0]} rotation={[0, Math.PI / 2, 0]} />
      <WeldingCurtain position={[-1.85, 0, -0.05]} rotation={[0, Math.PI / 2, 0]} />
      {/* Table de soudage + assemblage mécano-soudé */}
      <group position={[-0.5, 0, -0.45]}>
        <Box position={[0, 0.55, 0]} size={[1.4, 0.06, 0.85]} color={PALETTE.graphite} metal={0.6} rough={0.4} receive />
        {[[-0.62, -0.36], [-0.62, 0.36], [0.62, -0.36], [0.62, 0.36]].map(([x, z]) => (
          <Box key={`${x}${z}`} position={[x, 0.26, z]} size={[0.07, 0.52, 0.07]} color={PALETTE.graphite} metal={0.6} />
        ))}
        <Box position={[0, 0.14, 0]} size={[1.3, 0.03, 0.75]} color={PALETTE.darkSteel} metal={0.5} />
        <Box position={[0, 0.63, -0.2]} size={[1.0, 0.1, 0.08]} {...STEEL} />
        <Box position={[0, 0.63, 0.2]} size={[1.0, 0.1, 0.08]} {...STEEL} />
        {[-0.4, 0.05, 0.45].map((x) => (
          <Box key={x} position={[x, 0.63, 0]} size={[0.08, 0.1, 0.32]} {...STEEL} />
        ))}
        <Box position={[0.45, 0.6, 0.32]} size={[0.18, 0.06, 0.08]} color="#16a34a" />
      </group>
      <WeldingSparks position={[-0.45, 0.7, -0.25]} />
      <Person outfit="welder" variant={3} pose="work" position={[-0.42, 0, 0.22]} rotation={[0, Math.PI, 0]} />
      {/* Poste de soudure sur chariot + bouteille de gaz */}
      <group position={[0.9, 0, -0.95]}>
        <Box position={[0, 0.15, 0]} size={[0.55, 0.04, 0.38]} color={PALETTE.darkSteel} metal={0.5} />
        <Wheel position={[0.22, 0.07, 0.18]} radius={0.07} width={0.04} />
        <Wheel position={[0.22, 0.07, -0.18]} radius={0.07} width={0.04} />
        <Box position={[-0.05, 0.36, 0]} size={[0.42, 0.38, 0.3]} color="#ea580c" metal={0.3} rough={0.45} />
        <Box position={[0.165, 0.4, 0]} size={[0.01, 0.12, 0.18]} color="#0f172a" />
        <Box position={[0.171, 0.42, 0]} size={[0.004, 0.06, 0.1]} color="#22c55e" glow={1.2} shadow={false} />
        <Box position={[-0.05, 0.6, 0]} size={[0.3, 0.03, 0.04]} color={PALETTE.rubber} />
        <GasBottle position={[-0.2, 0.17, -0.25]} color="#64748b" cap="#16a34a" />
      </group>
      <Tube points={[[1.08, 0.38, -0.85], [0.8, 0.12, -0.4], [0.2, 0.25, 0.2], [-0.25, 0.68, 0.05], [-0.42, 0.74, -0.2]]} radius={0.016} />
      {/* Bras d'aspiration des fumées */}
      <group position={[0.35, 0, -1.6]}>
        <Box position={[0, 0.03, 0]} size={[0.4, 0.06, 0.4]} color={PALETTE.darkSteel} />
        <Cylinder position={[0, 0.85, 0]} radius={0.06} height={1.7} color={PALETTE.safetyYellow} metal={0.3} />
        <Tube points={[[0, 1.7, 0], [-0.25, 1.82, 0.4], [-0.6, 1.55, 1.0], [-0.75, 1.25, 1.25]]} radius={0.065} color="#d4d4d8" rough={0.5} />
        <Cylinder position={[-0.75, 1.15, 1.25]} radius={0.17} height={0.2} top={0.4} color={PALETTE.safetyYellow} metal={0.3} />
      </group>
      {/* Chaudronnerie : virole roulée et stock de tôles */}
      <group position={[1.25, 0, 0.95]}>
        <Box position={[0, 0.06, 0]} size={[0.9, 0.12, 0.25]} color={PALETTE.darkSteel} />
        <Cylinder position={[0, 0.48, 0]} rotation={[0, 0, Math.PI / 2]} radius={0.36} height={0.85} openEnded doubleSide segments={24} {...STEEL} />
      </group>
      <group position={[-1.4, 0, 1.3]}>
        <Pallet />
        {[0, 1, 2].map((i) => (
          <Box key={i} position={[0, 0.12 + i * 0.03, 0]} size={[0.78, 0.025, 0.5]} color="#94a3b8" metal={0.85} rough={0.3} />
        ))}
      </group>
      <SafetySign kind="mandatory" position={[2.0, 0, -0.1]} />
      <SafetySign kind="warning" position={[2.0, 0, 0.35]} />
      <Extinguisher position={[2.1, 0, -1.55]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Usinage : centre d'usinage à commande numérique                      */
/* ------------------------------------------------------------------ */

function StackLight({ active = 'green', ...rest }) {
  const colors = [['#dc2626', 'red'], ['#f59e0b', 'orange'], ['#22c55e', 'green']];
  return (
    <group {...rest}>
      <Cylinder position={[0, 0.06, 0]} radius={0.015} height={0.12} color={PALETTE.graphite} />
      {colors.map(([c, name], i) => (
        <Cylinder key={name} position={[0, 0.16 + (2 - i) * 0.07, 0]} radius={0.035} height={0.065} color={c} glow={name === active ? 2 : 0.15} shadow={false} />
      ))}
    </group>
  );
}

export function Machining({ accent }) {
  const spindleRef = useRef();
  const tableRef = useRef();
  useFrame(({ clock }, delta) => {
    if (spindleRef.current) spindleRef.current.rotation.y += delta * 18;
    if (tableRef.current) tableRef.current.position.x = Math.sin(clock.getElapsedTime() * 0.6) * 0.22;
  });
  return (
    <group>
      <FloorZone position={[-0.45, 0, -0.55]} width={2.3} depth={1.7} color={accent} />
      <group position={[-0.5, 0, -0.75]}>
        {/* Carénage */}
        <Box position={[0, 0.12, 0]} size={[1.7, 0.24, 1.15]} color="#374151" metal={0.3} />
        <Box position={[0, 0.84, -0.3]} size={[1.7, 1.2, 0.55]} color="#d1d5db" metal={0.25} rough={0.45} />
        <Box position={[-0.8, 0.84, 0.2]} size={[0.1, 1.2, 0.5]} color="#d1d5db" metal={0.25} rough={0.45} />
        <Box position={[0.8, 0.84, 0.2]} size={[0.1, 1.2, 0.5]} color="#d1d5db" metal={0.25} rough={0.45} />
        <Box position={[0, 1.47, 0]} size={[1.72, 0.08, 1.17]} color="#374151" />
        {/* Porte vitrée coulissante */}
        <Box position={[0.2, 0.85, 0.45]} size={[1.0, 0.95, 0.03]} color="#93c5fd" opacity={0.28} shadow={false} />
        <Box position={[-0.3, 0.85, 0.46]} size={[0.05, 0.95, 0.04]} color="#6b7280" />
        <Box position={[0.7, 0.85, 0.46]} size={[0.05, 0.95, 0.04]} color="#6b7280" />
        <Box position={[0.2, 1.32, 0.46]} size={[1.05, 0.05, 0.04]} color="#6b7280" />
        <Box position={[-0.5, 0.85, 0.45]} size={[0.35, 0.95, 0.03]} color="#d1d5db" metal={0.25} />
        {/* Broche et table (visibles à travers la vitre) */}
        <Box position={[0.1, 1.15, -0.02]} size={[0.25, 0.35, 0.3]} color="#4b5563" metal={0.5} />
        <group ref={spindleRef} userData={DYNAMIC} position={[0.1, 0.93, -0.02]}>
          <Cylinder radius={0.05} height={0.12} top={0.7} segments={8} {...STEEL} />
          <Box position={[0.035, -0.04, 0]} size={[0.015, 0.06, 0.015]} {...STEEL} />
        </group>
        <group ref={tableRef} userData={DYNAMIC}>
          <Box position={[0.1, 0.58, 0.05]} size={[0.9, 0.08, 0.5]} color="#6b7280" metal={0.6} />
          <Box position={[0.1, 0.68, 0.05]} size={[0.22, 0.12, 0.22]} {...STEEL} />
        </group>
        {/* Pupitre CN orientable */}
        <group position={[1.05, 0, 0.35]}>
          <Box position={[0, 1.15, 0]} rotation={[0, -0.5, 0]} size={[0.4, 0.5, 0.08]} color="#1f2937" />
          <Box position={[0.014, 1.22, 0.042]} rotation={[0, -0.5, 0]} size={[0.3, 0.2, 0.004]} color="#38bdf8" glow={1} shadow={false} />
          <Box position={[-0.2, 1.3, -0.15]} rotation={[0, 0, 0.3]} size={[0.25, 0.05, 0.05]} color="#374151" />
        </group>
        <StackLight position={[0.75, 1.51, -0.45]} />
        {/* Convoyeur à copeaux & bac */}
        <Box position={[1.15, 0.45, -0.35]} rotation={[0, 0, 0.6]} size={[0.9, 0.18, 0.35]} color="#4b5563" metal={0.4} />
        <Box position={[1.55, 0.2, -0.35]} size={[0.45, 0.4, 0.5]} color="#1d4ed8" metal={0.3} />
      </group>
      <Person outfit="worker" variant={4} pose="work" position={[0.78, 0, 0.12]} rotation={[0, -2.79, 0]} colors={{ vest: null, top: '#334155', helmet: null }} />
      {/* Marbre de contrôle */}
      <group position={[1.4, 0, 0.75]}>
        <Box position={[0, 0.3, 0]} size={[0.7, 0.6, 0.5]} color={PALETTE.darkSteel} metal={0.4} />
        <Box position={[0, 0.65, 0]} size={[0.75, 0.1, 0.55]} color="#1f2937" rough={0.2} metal={0.2} />
        <Cylinder position={[0.15, 0.85, 0]} radius={0.02} height={0.3} {...STEEL} />
        <Box position={[0.15, 0.72, 0]} size={[0.12, 0.04, 0.1]} {...STEEL} />
        <Box position={[-0.15, 0.74, 0.05]} size={[0.16, 0.08, 0.16]} {...STEEL} />
      </group>
      <Barrel position={[-1.95, 0, 0.9]} color="#16a34a" />
      <SafetySign kind="mandatory" position={[-2.0, 0, 1.45]} />
      <Extinguisher position={[2.1, 0, -0.5]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cariste : chariot élévateur, racks à palettes, allées de circulation */
/* ------------------------------------------------------------------ */

function ConvexMirror(props) {
  return (
    <group {...props}>
      <Cylinder position={[0, 0.8, 0]} radius={0.025} height={1.6} color={PALETTE.safetyYellow} />
      <Cylinder position={[0, 1.65, 0.04]} rotation={[Math.PI / 2, 0, 0]} radius={0.2} height={0.04} color="#f97316" />
      <mesh position={[0, 1.65, 0.07]} scale={[0.36, 0.36, 0.08]} raycast={() => null}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={1} roughness={0.05} />
      </mesh>
    </group>
  );
}

export function ForkliftArea({ accent }) {
  const truckRef = useRef();
  const carriageRef = useRef();
  const beaconRef = useRef();
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const phase = (t * 0.12) % 1;
    // Approche du rack, levée, dépose, recul
    const approach = phase < 0.25 ? phase / 0.25 : phase < 0.75 ? 1 : 1 - (phase - 0.75) / 0.25;
    const lift = phase < 0.25 ? 0 : phase < 0.5 ? (phase - 0.25) / 0.25 : phase < 0.75 ? 1 - (phase - 0.5) / 0.25 : 0;
    if (truckRef.current) truckRef.current.position.z = 0.75 - THREE.MathUtils.smootherstep(approach, 0, 1) * 0.55;
    if (carriageRef.current) carriageRef.current.position.y = THREE.MathUtils.smootherstep(lift, 0, 1) * 0.62;
    if (beaconRef.current) beaconRef.current.rotation.y = t * 6;
  });
  return (
    <group>
      {/* Allée de circulation engins (jaune) et cheminement piéton (vert) */}
      <FloorZone position={[0.1, 0, 0.35]} width={1.5} depth={2.1} color={PALETTE.safetyYellow} />
      {[-1.55, -1.15, -0.75, -0.35, 0.05, 0.45, 0.85, 1.25, 1.65, 2.05].map((x) => (
        <Box key={x} position={[x, 0.008, 1.62]} size={[0.24, 0.012, 0.06]} color="#22c55e" shadow={false} />
      ))}
      <FloorZone position={[-0.25, 0, -1.42]} width={2.95} depth={0.75} color={accent} />
      <PalletRack position={[-0.25, 0, -1.42]} bays={3} levels={3} levelHeight={0.62} seed={4} />
      {/* Chariot élévateur animé (fourches vers le rack) */}
      <group ref={truckRef} userData={DYNAMIC} position={[0.1, 0, 0.75]}>
        <Forklift rotation={[0, Math.PI / 2, 0]} carriageRef={carriageRef} beaconRef={beaconRef} />
        <Person outfit="driver" variant={2} pose="type" position={[0, 0.33, 0.14]} rotation={[0, Math.PI, 0]} />
        {/* Blue spot de signalisation arrière */}
        <Cylinder position={[0, 0.006, 1.0]} radius={0.16} height={0.004} segments={20} color="#3b82f6" glow={2.2} opacity={0.75} shadow={false} />
      </group>
      {/* Pile de palettes vides */}
      <group position={[1.75, 0, -1.3]} rotation={[0, Math.PI / 2, 0]}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Pallet key={i} position={[0, i * 0.1, 0]} />
        ))}
      </group>
      {/* Poste de charge batteries */}
      <group position={[-1.85, 0, 0.6]}>
        <Box position={[0, 0.45, 0]} size={[0.35, 0.5, 0.25]} color="#e5e7eb" />
        <Box position={[0, 0.58, 0.13]} size={[0.15, 0.08, 0.005]} color="#22c55e" glow={1.2} shadow={false} />
        <Box position={[0, 0.1, 0]} size={[0.05, 0.2, 0.05]} color={PALETTE.graphite} />
        <Tube points={[[0.12, 0.3, 0.1], [0.4, 0.05, 0.3], [0.6, 0.05, 0.1]]} radius={0.018} />
        <SafetySign kind="warning" post={false} height={0.95} size={0.2} />
      </group>
      <LoadedPallet position={[1.7, 0, 0.55]} rotation={[0, 0.2, 0]} load={0.5} />
      <ConvexMirror position={[2.05, 0, 1.45]} rotation={[0, -Math.PI / 4, 0]} />
      <Person outfit="logistics" variant={1} position={[-1.2, 0, 1.62]} rotation={[0, Math.PI / 2, 0]} />
      <HazardBar position={[-0.25, 0.3, -0.95]} length={2.9} segments={14} />
      <Extinguisher position={[-2.1, 0, -0.2]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Atelier générique (repli)                                            */
/* ------------------------------------------------------------------ */

export function GenericWorkshop({ accent }) {
  return (
    <group>
      <FloorZone width={4.0} depth={3.2} color={accent} />
      <Workbench position={[-0.7, 0, -1.2]} width={1.6} />
      <Person outfit="worker" variant={3} pose="work" position={[-0.7, 0, -0.62]} rotation={[0, Math.PI, 0]} />
      <ToolBoard position={[-0.7, 0, -1.55]} width={1.5} />
      <Workbench position={[1.2, 0, -1.2]} width={1.1} />
      <LoadedPallet position={[1.4, 0, 0.8]} load={0.45} />
      <Barrel position={[-1.7, 0, 1.0]} color="#2563eb" />
      <Barrel position={[-1.25, 0, 1.15]} color="#16a34a" />
      <Extinguisher position={[2.1, 0, -0.2]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}
