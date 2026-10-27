import React, { useEffect, useMemo, useRef } from 'react';
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
  SafetyShower,
  Extinguisher,
  Barrel,
  IBCTank,
  Pallet,
  Lifebuoy,
  Wheel,
  getMaterial,
  noRaycast,
  DYNAMIC,
} from './kit';
import { Person } from './people';

/**
 * Postes « Atelier Peinture » : traitement de surface, chimie et effluents.
 * Emprise X ±2,2 / Z ±1,8, sol en y = 0 ; `accent` = couleur de cotation DigiRisk.
 */

const PANEL = '#e5e7eb';
const STEEL = { color: PALETTE.steel, metal: 0.8, rough: 0.3 };
const POWDER = '#2563eb';

/** Pièce suspendue à un crochet : brute (acier) ou peinte (poudre). */
function HangingPart({ painted, width = 0.24, height = 0.3 }) {
  return (
    <group>
      <Box position={[0, -0.25, 0]} size={[0.012, 0.5, 0.012]} color={PALETTE.graphite} shadow={false} />
      <Box position={[0, -0.5, 0]} size={[0.36, 0.015, 0.015]} color={PALETTE.graphite} shadow={false} />
      {[-0.1, 0.1].map((x) => (
        <Box
          key={x}
          position={[x, -0.52 - height / 2, 0]}
          size={[width * 0.6, height, 0.02]}
          color={painted ? POWDER : '#a8b3bf'}
          metal={painted ? 0.2 : 0.85}
          rough={painted ? 0.45 : 0.3}
        />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Cabine de peinture poudre                                            */
/* ------------------------------------------------------------------ */

export function PaintBooth({ accent }) {
  const cloudMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#93c5fd', emissive: '#3b82f6', emissiveIntensity: 0.3, transparent: true, opacity: 0.2, depthWrite: false }),
    []
  );
  useEffect(() => () => cloudMaterial.dispose(), [cloudMaterial]);
  const gunsRef = useRef();
  const hangersRef = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    cloudMaterial.opacity = 0.16 + Math.sin(t * 2.4) * 0.07;
    if (gunsRef.current) gunsRef.current.position.y = 0.95 + Math.sin(t * 1.3) * 0.35;
    hangersRef.current.forEach((h, i) => {
      if (!h) return;
      const x = -2.1 + (((t * 0.22 + i / 3) % 1) * 4.2);
      h.position.x = x;
      h.children[0].visible = x < -0.3;
      h.children[1].visible = x >= -0.3;
    });
  });
  return (
    <group>
      <FloorZone position={[-0.3, 0, -0.45]} width={3.0} depth={2.1} color={accent} />
      {/* Cabine ouverte en façade */}
      <group position={[-0.3, 0, -0.5]}>
        <Box position={[0, 0.03, 0]} size={[2.4, 0.06, 1.5]} color="#475569" receive />
        <Box position={[0, 0.9, -0.73]} size={[2.4, 1.8, 0.05]} color={PANEL} rough={0.4} />
        <Box position={[0, 0.8, -0.69]} size={[2.0, 1.2, 0.02]} color="#64748b" rough={0.8} />
        {/* Parois latérales avec fente de passage des pièces et des pistolets */}
        {[-1.2, 1.2].map((x) =>
          [-0.44, 0.44].map((z) => (
            <Box key={`${x}${z}`} position={[x, 0.9, z]} size={[0.05, 1.8, 0.62]} color={PANEL} rough={0.4} />
          ))
        )}
        <Box position={[0, 1.8, -0.4]} size={[2.45, 0.05, 0.7]} color={PANEL} rough={0.4} />
        <Box position={[0, 1.8, 0.42]} size={[2.45, 0.05, 0.66]} color={PANEL} rough={0.4} />
        <Box position={[0, 1.65, 0.74]} size={[2.45, 0.3, 0.04]} color={PALETTE.safetyYellow} />
        {/* Nuage de poudre animé */}
        <mesh position={[0, 0.9, -0.1]} scale={[1.7, 1.0, 0.9]} material={cloudMaterial} raycast={noRaycast} userData={{ noCollide: true }}>
          <sphereGeometry args={[0.5, 16, 12]} />
        </mesh>
      </group>
      {/* Convoyeur aérien traversant la cabine */}
      <Box position={[0, 2.05, -0.5]} size={[4.3, 0.08, 0.06]} color={PALETTE.darkSteel} metal={0.6} />
      {[-2.1, 2.1].map((x) => (
        <Box key={x} position={[x, 1.03, -0.5]} size={[0.07, 2.06, 0.07]} color={PALETTE.darkSteel} metal={0.6} />
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(el) => (hangersRef.current[i] = el)} userData={DYNAMIC} position={[0, 2.02, -0.5]}>
          <group userData={DYNAMIC}>
            <HangingPart painted={false} />
          </group>
          <group userData={DYNAMIC}>
            <HangingPart painted />
          </group>
        </group>
      ))}
      {/* Réciprocateur et pistolets automatiques */}
      <group position={[1.1, 0, -0.5]}>
        <Box position={[0, 0.03, 0]} size={[0.4, 0.06, 0.4]} color={PALETTE.darkSteel} />
        <Box position={[0.08, 0.9, 0]} size={[0.14, 1.8, 0.14]} color="#cbd5e1" metal={0.4} />
        <group ref={gunsRef} userData={DYNAMIC} position={[0, 0.95, 0]}>
          <Box size={[0.2, 0.14, 0.22]} color={PALETTE.safetyYellow} />
          {[-0.06, 0.06].map((z) => (
            <Cylinder key={z} position={[-0.25, 0, z]} rotation={[0, 0, Math.PI / 2]} radius={0.025} height={0.35} {...STEEL} />
          ))}
        </group>
      </group>
      {/* Cyclone de récupération et gaine d'aspiration */}
      <group position={[1.75, 0, -1.35]}>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
          <Box key={`${sx}${sz}`} position={[sx * 0.18, 0.45, sz * 0.18]} size={[0.04, 0.9, 0.04]} color={PALETTE.darkSteel} />
        ))}
        <Cylinder position={[0, 0.85, 0]} rotation={[Math.PI, 0, 0]} radius={0.27} height={0.45} top={0.15} color={PANEL} metal={0.3} />
        <Cylinder position={[0, 1.38, 0]} radius={0.27} height={0.6} color={PANEL} metal={0.3} />
        <Cylinder position={[0, 1.75, 0]} radius={0.08} height={0.15} color={PALETTE.darkSteel} />
      </group>
      <Tube points={[[0.6, 1.85, -1.1], [1.1, 2.0, -1.25], [1.5, 1.85, -1.35]]} radius={0.09} color="#cbd5e1" metal={0.5} rough={0.35} />
      {/* Centrale d'alimentation poudre */}
      <group position={[1.55, 0, 0.75]}>
        <Box position={[0, 0.4, 0]} size={[0.6, 0.8, 0.5]} color={PANEL} rough={0.45} />
        <Cylinder position={[0, 0.95, 0]} radius={0.22} height={0.3} top={1.3} color="#cbd5e1" metal={0.3} />
        <Box position={[0.1, 0.62, 0.252]} size={[0.25, 0.14, 0.005]} color="#22c55e" glow={0.9} shadow={false} />
        <Box position={[-0.18, 0.6, 0.255]} size={[0.06, 0.06, 0.01]} color="#dc2626" glow={0.5} shadow={false} />
      </group>
      <Tube points={[[1.4, 0.9, 0.6], [1.3, 1.1, 0.1], [1.15, 0.95, -0.3]]} radius={0.015} color="#94a3b8" />
      <Tube points={[[1.6, 0.9, 0.6], [1.5, 1.2, 0.1], [1.15, 1.0, -0.4]]} radius={0.015} color="#94a3b8" />
      <SafetySign kind="warning" position={[-2.0, 0, 0.9]} />
      <SafetySign kind="mandatory" position={[-2.0, 0, 1.45]} />
      <Extinguisher position={[0.5, 0, 1.55]} />
      {/* Peintre en combinaison avec pistolet manuel */}
      <group position={[-0.75, 0, 0.55]} rotation={[0, Math.PI, 0]}>
        <Person outfit="painter" variant={1} pose="work" />
        <Cylinder position={[0.12, 0.76, 0.33]} rotation={[Math.PI / 2, 0, 0]} radius={0.02} height={0.22} color="#cbd5e1" metal={0.6} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Four de polymérisation                                               */
/* ------------------------------------------------------------------ */

export function CuringOven({ accent }) {
  const glowRef = useRef();
  useFrame(({ clock }) => {
    if (glowRef.current) glowRef.current.material.emissiveIntensity = 1.6 + Math.sin(clock.getElapsedTime() * 2) * 0.4;
  });
  return (
    <group>
      <FloorZone position={[0, 0, -0.55]} width={4.0} depth={1.9} color={accent} />
      <group position={[0, 0, -0.6]}>
        <Box position={[0, 0.8, 0]} size={[3.4, 1.6, 1.3]} color="#9ca3af" metal={0.4} rough={0.5} />
        {[-1.2, -0.6, 0, 0.6, 1.2].map((x) => (
          <Box key={x} position={[x, 0.8, 0.652]} size={[0.015, 1.6, 0.01]} color="#6b7280" shadow={false} />
        ))}
        {/* Bouche d'entrée incandescente */}
        <Box position={[-1.705, 0.85, 0]} size={[0.02, 1.0, 0.6]} color="#1f2937" />
        <mesh ref={glowRef} userData={DYNAMIC} position={[-1.72, 0.85, 0]} rotation={[0, -Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.5, 0.85]} />
          <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={1.8} />
        </mesh>
        {/* Brûleur et cheminée */}
        <Box position={[0.9, 1.78, -0.2]} size={[0.8, 0.36, 0.6]} color="#64748b" metal={0.4} />
        <Cylinder position={[1.2, 2.1, -0.35]} radius={0.1} height={0.7} color="#475569" metal={0.5} />
        <Cylinder position={[1.2, 2.47, -0.35]} radius={0.16} height={0.06} color="#334155" />
        {/* Armoire de régulation */}
        <Box position={[-0.9, 0.55, 0.75]} size={[0.5, 0.9, 0.2]} color={PANEL} />
        <Box position={[-0.9, 0.75, 0.855]} size={[0.25, 0.12, 0.005]} color="#f97316" glow={1.2} shadow={false} />
      </group>
      <Box position={[0, 2.05, -0.6]} size={[4.3, 0.08, 0.06]} color={PALETTE.darkSteel} metal={0.6} />
      <HazardBar position={[0, 0.03, 0.2]} length={3.4} segments={16} height={0.04} />
      <SafetySign kind="warning" position={[1.9, 0, 0.9]} />
      <Extinguisher position={[-2.0, 0, 1.0]} />
      <Person outfit="worker" variant={2} pose="work" position={[-0.9, 0, 0.62]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Accrochage / décrochage sur convoyeur aérien en boucle              */
/* ------------------------------------------------------------------ */

export function HangingLine({ accent }) {
  const hangerCount = 8;
  const curve = useMemo(() => {
    const straight = 1.3;
    const r = 0.62;
    const pts = [];
    for (let i = 0; i < 28; i += 1) {
      const u = i / 28;
      const perimeter = 4 * straight + 2 * Math.PI * r;
      let s = u * perimeter;
      let p;
      if (s < 2 * straight) p = [-straight + s, r];
      else if ((s -= 2 * straight) < Math.PI * r) p = [straight + Math.sin(s / r) * r, Math.cos(s / r) * r];
      else if ((s -= Math.PI * r) < 2 * straight) p = [straight - s, -r];
      else {
        s -= 2 * straight;
        p = [-straight - Math.sin(s / r) * r, -Math.cos(s / r) * r];
      }
      pts.push(new THREE.Vector3(p[0], 0, p[1]));
    }
    return new THREE.CatmullRomCurve3(pts, true);
  }, []);
  const railGeometry = useMemo(() => new THREE.TubeGeometry(curve, 96, 0.04, 8, true), [curve]);
  useEffect(() => () => railGeometry.dispose(), [railGeometry]);

  const hangersRef = useRef([]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    hangersRef.current.forEach((h, i) => {
      if (!h) return;
      curve.getPointAt((t * 0.035 + i / hangerCount) % 1, tmp);
      h.position.set(tmp.x, 0, tmp.z);
      // Pièces brutes à l'accrochage (côté avant), peintes au retour (côté arrière)
      h.children[0].visible = tmp.z > 0;
      h.children[1].visible = tmp.z <= 0;
    });
  });

  return (
    <group>
      <FloorZone position={[0, 0, -0.25]} width={4.1} depth={1.9} color={accent} />
      {/* Portiques supports */}
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[x, 0, -0.25]}>
          {[-0.85, 0.85].map((z) => (
            <Box key={z} position={[0, 1.05, z]} size={[0.08, 2.1, 0.08]} color={PALETTE.darkSteel} metal={0.6} />
          ))}
          <Box position={[0, 2.1, 0]} size={[0.1, 0.1, 1.8]} color={PALETTE.darkSteel} metal={0.6} />
        </group>
      ))}
      <group position={[0, 1.95, -0.25]}>
        <mesh geometry={railGeometry} material={getMaterial({ color: PALETTE.safetyYellow, metalness: 0.4, roughness: 0.45 })} castShadow raycast={noRaycast} />
        {Array.from({ length: hangerCount }, (_, i) => (
          <group key={i} ref={(el) => (hangersRef.current[i] = el)} userData={DYNAMIC}>
            <group userData={DYNAMIC}>
              <HangingPart painted={false} />
            </group>
            <group userData={DYNAMIC}>
              <HangingPart painted />
            </group>
          </group>
        ))}
      </group>
      {/* Plateforme opérateur antidérapante */}
      <group position={[0, 0, 1.05]}>
        <Box position={[0, 0.07, 0]} size={[2.4, 0.14, 0.6]} color="#334155" rough={0.95} receive />
        <HazardBar position={[0, 0.145, -0.29]} length={2.4} segments={12} height={0.012} thickness={0.04} />
        <Person outfit="worker" variant={0} pose="work" position={[-0.6, 0.14, 0.05]} rotation={[0, Math.PI, 0]} colors={{ vest: null, helmet: null, gloves: '#16a34a' }} />
        <Person outfit="worker" variant={3} pose="work" position={[0.65, 0.14, 0.05]} rotation={[0, Math.PI, 0]} colors={{ vest: null, helmet: null, gloves: '#16a34a' }} />
      </group>
      {/* Chariots de pièces brutes / bacs de pièces peintes */}
      <group position={[-1.8, 0, 1.25]}>
        <Box position={[0, 0.12, 0]} size={[0.6, 0.04, 0.45]} color={PALETTE.darkSteel} />
        {[-0.2, 0.2].map((x) => (
          <Wheel key={x} position={[x, 0.05, 0.2]} radius={0.05} width={0.03} />
        ))}
        {[-0.18, -0.06, 0.06, 0.18].map((x) => (
          <Box key={x} position={[x, 0.35, 0]} size={[0.02, 0.4, 0.4]} color="#a8b3bf" metal={0.85} rough={0.3} />
        ))}
      </group>
      <group position={[1.8, 0, 1.25]}>
        <Box position={[0, 0.17, 0]} size={[0.6, 0.34, 0.45]} color="#475569" />
        <Box position={[0, 0.35, 0]} size={[0.5, 0.04, 0.36]} color={POWDER} />
      </group>
      <SafetySign kind="mandatory" position={[-2.05, 0, -1.4]} />
      <Extinguisher position={[2.1, 0, -1.35]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Station d'épuration                                                  */
/* ------------------------------------------------------------------ */

function Guardrail({ length = 1, axis = 'x', ...rest }) {
  const posts = Math.max(2, Math.round(length / 0.45) + 1);
  return (
    <group {...rest}>
      {Array.from({ length: posts }, (_, i) => {
        const o = -length / 2 + (i * length) / (posts - 1);
        return <Box key={i} position={axis === 'x' ? [o, 0.3, 0] : [0, 0.3, o]} size={[0.03, 0.6, 0.03]} color={PALETTE.safetyYellow} />;
      })}
      {[0.32, 0.6].map((y) => (
        <Box key={y} position={[0, y, 0]} size={axis === 'x' ? [length, 0.03, 0.03] : [0.03, 0.03, length]} color={PALETTE.safetyYellow} />
      ))}
    </group>
  );
}

function Pump(props) {
  return (
    <group {...props}>
      <Box position={[0, 0.04, 0]} size={[0.55, 0.08, 0.28]} color={PALETTE.darkSteel} />
      <Cylinder position={[-0.1, 0.2, 0]} rotation={[0, 0, Math.PI / 2]} radius={0.1} height={0.3} color="#2563eb" metal={0.4} />
      <Cylinder position={[0.17, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} radius={0.11} height={0.12} color="#6b7280" metal={0.6} />
      <Cylinder position={[0.17, 0.38, 0]} radius={0.04} height={0.22} color="#6b7280" metal={0.6} />
    </group>
  );
}

export function Wastewater({ accent }) {
  const bridgeRef = useRef();
  const bubblesRef = useRef([]);
  const bubbles = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ x: 0.8 + (i % 4) * 0.33, z: -1.25 + Math.floor(i / 4) * 0.45 + (i % 2) * 0.12, phase: i * 0.7 })),
    []
  );
  useFrame(({ clock }, delta) => {
    if (bridgeRef.current) bridgeRef.current.rotation.y += delta * 0.18;
    const t = clock.getElapsedTime();
    bubblesRef.current.forEach((b, i) => {
      if (b) b.position.y = 0.6 + Math.abs(Math.sin(t * 2.2 + bubbles[i].phase)) * 0.05;
    });
  });
  return (
    <group>
      {/* Clarificateur circulaire à pont racleur tournant */}
      <group position={[-0.9, 0, -0.1]}>
        <Cylinder position={[0, 0.35, 0]} radius={1.2} height={0.7} segments={40} color="#9ca3af" rough={0.9} />
        <Cylinder position={[0, 0.705, 0]} radius={1.1} height={0.02} segments={40} color="#1f6f78" metal={0.3} rough={0.12} shadow={false} />
        <Cylinder position={[0, 0.712, 0]} radius={1.06} height={0.012} segments={40} openEnded doubleSide color="#94a3b8" shadow={false} />
        <Cylinder position={[0, 0.85, 0]} radius={0.1} height={0.32} color="#cbd5e1" metal={0.4} />
        <group ref={bridgeRef} userData={DYNAMIC} position={[0, 0.98, 0]}>
          <Box position={[0.6, 0, 0]} size={[1.25, 0.06, 0.2]} color="#2563eb" metal={0.4} />
          {[-0.09, 0.09].map((z) => (
            <Box key={z} position={[0.6, 0.18, z]} size={[1.2, 0.025, 0.025]} color={PALETTE.safetyYellow} />
          ))}
          {[0.1, 0.5, 0.9, 1.15].map((x) => (
            <Box key={x} position={[x, 0.09, 0]} size={[0.02, 0.18, 0.2]} color={PALETTE.safetyYellow} shadow={false} />
          ))}
          <Box position={[0.75, -0.17, 0]} size={[0.7, 0.28, 0.02]} color="#334155" metal={0.4} />
          <Box position={[1.2, -0.12, 0]} size={[0.16, 0.18, 0.22]} color="#1d4ed8" metal={0.4} />
        </group>
        <Lifebuoy position={[-0.95, 0.95, 0.85]} rotation={[0, 0.8, 0]} />
        <Cylinder position={[-0.98, 0.75, 0.88]} radius={0.02} height={0.6} color={PALETTE.darkSteel} />
      </group>
      {/* Bassin d'aération */}
      <group>
        <Box position={[1.35, 0.3, -1.55]} size={[1.5, 0.6, 0.08]} color="#9ca3af" rough={0.9} />
        <Box position={[1.35, 0.3, -0.05]} size={[1.5, 0.6, 0.08]} color="#9ca3af" rough={0.9} />
        <Box position={[0.64, 0.3, -0.8]} size={[0.08, 0.6, 1.5]} color="#9ca3af" rough={0.9} />
        <Box position={[2.06, 0.3, -0.8]} size={[0.08, 0.6, 1.5]} color="#9ca3af" rough={0.9} />
        <Box position={[1.35, 0.55, -0.8]} size={[1.36, 0.02, 1.42]} color="#3f7f6a" metal={0.2} rough={0.15} shadow={false} />
        {bubbles.map((b, i) => (
          <mesh key={i} ref={(el) => (bubblesRef.current[i] = el)} userData={DYNAMIC} position={[b.x, 0.6, b.z]} raycast={noRaycast}>
            <sphereGeometry args={[0.035, 8, 6]} />
            <meshStandardMaterial color="#f0fdfa" roughness={0.3} />
          </mesh>
        ))}
        <Guardrail position={[1.35, 0.6, -0.02]} length={1.5} />
        <Guardrail position={[2.08, 0.6, -0.8]} length={1.5} axis="z" />
      </group>
      {/* Pompes de relevage et tuyauteries */}
      <Pump position={[0.95, 0, 0.85]} />
      <Pump position={[1.65, 0, 0.85]} />
      <Tube points={[[1.12, 0.48, 0.85], [1.1, 0.75, 0.4], [1.0, 0.75, -0.3], [0.95, 0.62, -0.45]]} radius={0.04} color="#16a34a" metal={0.3} />
      <Tube points={[[1.82, 0.48, 0.85], [1.6, 0.85, 0.6], [0.3, 0.9, 0.5], [-0.2, 0.78, 0.25]]} radius={0.04} color="#16a34a" metal={0.3} />
      {/* Armoire de commande */}
      <group position={[2.0, 0, 1.45]} rotation={[0, -Math.PI / 2, 0]}>
        <Box position={[0, 0.45, 0]} size={[0.5, 0.9, 0.22]} color="#d1d5db" metal={0.3} />
        <Box position={[-0.12, 0.7, 0.115]} size={[0.05, 0.05, 0.01]} color="#22c55e" glow={1.5} shadow={false} />
        <Box position={[0, 0.7, 0.115]} size={[0.05, 0.05, 0.01]} color="#f59e0b" glow={0.3} shadow={false} />
      </group>
      <FloorZone width={4.3} depth={3.5} color={accent} />
      <Person outfit="worker" variant={4} position={[1.3, 0, 1.4]} rotation={[0, Math.PI, 0]} colors={{ top: '#0f766e', vest: '#facc15' }} />
      <SafetySign kind="warning" position={[0.2, 0, 1.5]} />
      <SafetySign kind="prohibition" position={[0.55, 0, 1.5]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Aire de dépotage                                                     */
/* ------------------------------------------------------------------ */

function StorageTank({ color = '#f8fafc', band = '#f97316', ...rest }) {
  return (
    <group {...rest}>
      <Cylinder position={[0, 0.82, 0]} radius={0.42} height={1.5} segments={24} color={color} rough={0.35} metal={0.2} />
      <Ball position={[0, 1.57, 0]} scale={[0.84, 0.28, 0.84]} color={color} rough={0.35} />
      <Cylinder position={[0, 1.15, 0]} radius={0.425} height={0.1} segments={24} color={band} />
      {[-0.06, 0.06].map((x) => (
        <Box key={x} position={[0.44, 0.85, x]} size={[0.02, 1.6, 0.02]} color={PALETTE.darkSteel} metal={0.6} />
      ))}
      {[0.3, 0.55, 0.8, 1.05, 1.3, 1.55].map((y) => (
        <Box key={y} position={[0.44, y, 0]} size={[0.02, 0.02, 0.12]} color={PALETTE.darkSteel} metal={0.6} />
      ))}
      <Box position={[-0.3, 0.8, 0.3]} rotation={[0, -0.8, 0]} size={[0.025, 1.1, 0.025]} color="#bae6fd" opacity={0.6} shadow={false} />
      <Box position={[0.3, 0.8, 0.3]} rotation={[0, 0.8, Math.PI / 4]} size={[0.16, 0.16, 0.01]} color="#dc2626" shadow={false} />
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
        <Box key={`${sx}${sz}`} position={[sx * 0.28, 0.04, sz * 0.28]} size={[0.06, 0.08, 0.06]} color={PALETTE.darkSteel} />
      ))}
    </group>
  );
}

export function Unloading({ accent }) {
  return (
    <group>
      {/* Cuvette de rétention */}
      <group position={[-0.75, 0, -0.75]}>
        <Box position={[0, 0.02, 0]} size={[2.8, 0.04, 2.0]} color="#6b7280" rough={0.95} receive />
        {[[0, -0.98, 2.8, 0.06], [0, 0.98, 2.8, 0.06]].map(([x, z, w, d]) => (
          <Box key={z} position={[x, 0.15, z]} size={[w, 0.3, d]} color="#9ca3af" rough={0.9} />
        ))}
        {[-1.38, 1.38].map((x) => (
          <Box key={x} position={[x, 0.15, 0]} size={[0.06, 0.3, 2.0]} color="#9ca3af" rough={0.9} />
        ))}
        <StorageTank position={[-0.65, 0, -0.2]} />
        <StorageTank position={[0.45, 0, -0.2]} band="#facc15" />
        {/* Collecteur de dépotage et vannes */}
        <Cylinder position={[-0.1, 0.4, 0.62]} rotation={[0, 0, Math.PI / 2]} radius={0.04} height={2.4} color="#64748b" metal={0.6} />
        {[-0.9, -0.1, 0.7].map((x, i) => (
          <group key={x} position={[x, 0.4, 0.62]}>
            <Cylinder position={[0, 0.12, 0]} radius={0.02} height={0.22} color="#64748b" metal={0.6} />
            <Cylinder position={[0, 0.24, 0]} radius={0.08} height={0.02} segments={12} color={i === 1 ? '#facc15' : '#dc2626'} />
          </group>
        ))}
      </group>
      {/* Citerne mobile en cours de dépotage */}
      <group position={[-0.4, 0, 1.15]}>
        <Box position={[0, 0.3, 0]} size={[2.3, 0.08, 0.5]} color={PALETTE.graphite} metal={0.5} />
        <Cylinder position={[0, 0.72, 0]} rotation={[0, 0, Math.PI / 2]} radius={0.38} height={2.1} segments={24} color="#e2e8f0" metal={0.75} rough={0.25} />
        {[-0.6, 0.1, 0.8].map((x) => (
          <Cylinder key={x} position={[x, 1.1, 0]} radius={0.08} height={0.05} color={PALETTE.darkSteel} metal={0.6} />
        ))}
        <Box position={[0.1, 1.12, 0]} size={[1.9, 0.02, 0.2]} color={PALETTE.darkSteel} metal={0.6} shadow={false} />
        {[-0.65, -0.95].map((x) => (
          <React.Fragment key={x}>
            <Wheel position={[x, 0.22, 0.3]} radius={0.22} width={0.12} />
            <Wheel position={[x, 0.22, -0.3]} radius={0.22} width={0.12} />
          </React.Fragment>
        ))}
        <Box position={[0.9, 0.15, 0]} size={[0.04, 0.3, 0.3]} color={PALETTE.darkSteel} />
        <Box position={[1.25, 0.3, 0]} size={[0.3, 0.05, 0.06]} color={PALETTE.darkSteel} />
      </group>
      <Tube points={[[-1.3, 0.55, 1.0], [-1.5, 0.12, 0.6], [-1.6, 0.5, 0.0], [-1.65, 0.85, -0.13]]} radius={0.035} color={PALETTE.rubber} />
      {/* IBC, kit absorbant, douche de sécurité */}
      <IBCTank position={[1.6, 0, -1.3]} />
      <IBCTank position={[1.6, 0, -0.45]} liquid="#fde68a" />
      <group position={[1.55, 0, 0.45]}>
        <Box position={[0, 0.22, 0]} size={[0.5, 0.44, 0.35]} color={PALETTE.safetyYellow} />
        <Box position={[0, 0.45, 0]} size={[0.52, 0.04, 0.37]} color="#ca8a04" />
      </group>
      <SafetyShower position={[1.95, 0, 1.3]} rotation={[0, -Math.PI / 2, 0]} />
      <FloorZone position={[-0.4, 0, 1.15]} width={2.6} depth={0.9} color={accent} />
      <Person outfit="painter" variant={2} pose="work" position={[-1.75, 0, 0.45]} rotation={[0, Math.PI, 0]} colors={{ top: '#16a34a', pants: '#166534', hood: null, gloves: '#111827' }} />
      <SafetySign kind="warning" position={[0.9, 0, 1.55]} />
      <Extinguisher position={[0.9, 0, 0.9]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Stockage de produits chimiques (repli « Peinture / Chimie »)        */
/* ------------------------------------------------------------------ */

function SafetyCabinet({ color = PALETTE.safetyYellow, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.6, 0]} size={[0.7, 1.2, 0.4]} color={color} metal={0.3} rough={0.45} />
      <Box position={[0, 0.6, 0.202]} size={[0.01, 1.1, 0.005]} color={PALETTE.graphite} shadow={false} />
      <Box position={[0, 0.9, 0.206]} rotation={[0, 0, Math.PI / 4]} size={[0.14, 0.14, 0.006]} color="#dc2626" shadow={false} />
      <Box position={[0, 0.9, 0.21]} rotation={[0, 0, Math.PI / 4]} size={[0.1, 0.1, 0.004]} color="#f8fafc" shadow={false} />
      <Cylinder position={[0.2, 1.3, -0.1]} radius={0.04} height={0.2} color={PALETTE.steel} metal={0.7} />
    </group>
  );
}

export function ChemicalStorage({ accent }) {
  return (
    <group>
      <FloorZone width={4.0} depth={3.2} color={accent} />
      <SafetyCabinet position={[-1.5, 0, -1.5]} />
      <SafetyCabinet position={[-0.7, 0, -1.5]} color="#2563eb" />
      {/* Bac de rétention avec fûts */}
      <group position={[0.85, 0, -1.2]}>
        <Box position={[0, 0.14, 0]} size={[1.0, 0.28, 0.75]} color={PALETTE.safetyYellow} metal={0.3} />
        <Box position={[0, 0.285, 0]} size={[0.96, 0.01, 0.71]} color={PALETTE.graphite} shadow={false} />
        {[[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]].map(([x, z], i) => (
          <Barrel key={`${x}${z}`} position={[x, 0.29, z]} scale={[0.95, 0.95, 0.95]} color={['#2563eb', '#111827', '#dc2626', '#16a34a'][i]} />
        ))}
      </group>
      <IBCTank position={[1.6, 0, 0.6]} rotation={[0, -Math.PI / 2, 0]} liquid="#bbf7d0" />
      <group position={[0.2, 0, 0.75]}>
        <Pallet />
        {[[-0.25, -0.12], [0.0, -0.12], [0.25, -0.12], [-0.12, 0.13], [0.13, 0.13]].map(([x, z]) => (
          <group key={`${x}${z}`} position={[x, 0.1, z]}>
            <Box position={[0, 0.14, 0]} size={[0.2, 0.28, 0.13]} color="#e5e7eb" rough={0.5} />
            <Box position={[0.05, 0.31, 0]} size={[0.04, 0.05, 0.04]} color="#2563eb" />
          </group>
        ))}
      </group>
      <SafetyShower position={[-1.95, 0, 0.9]} rotation={[0, Math.PI / 2, 0]} />
      <Person outfit="worker" variant={1} pose="carry" position={[-0.6, 0, 0.4]} rotation={[0, -0.6, 0]} colors={{ helmet: null }} />
      <SafetySign kind="warning" position={[-1.0, 0, 1.45]} />
      <SafetySign kind="mandatory" position={[-0.6, 0, 1.45]} />
      <Extinguisher position={[2.1, 0, -0.4]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}
