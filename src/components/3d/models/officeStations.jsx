import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  PALETTE,
  Box,
  Cylinder,
  Ball,
  Desk,
  Monitor,
  Keyboard,
  OfficeChair,
  Workstation,
  FilingCabinet,
  Plant,
  Extinguisher,
  SafetySign,
  Car,
  Shelving,
  DYNAMIC,
} from './kit';
import { Person } from './people';

/** Poste de travail occupé : bureau équipé + collaborateur assis au clavier. */
function StaffedDesk({ position, rotation, outfit = 'office', variant = 0, colors, ...workstation }) {
  return (
    <group position={position} rotation={rotation}>
      <Workstation {...workstation} />
      <Person outfit={outfit} variant={variant} colors={colors} pose="type" position={[0, 0, 0.44]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

/**
 * Postes tertiaires (Groupement « Bureaux ») — emprise utile ≈ X ±2,2 / Z ±1,8, sol en y = 0.
 * Les éléments hauts sont placés au fond (-Z) pour laisser la vue dégagée depuis la caméra.
 */

function Carpet({ width = 4.2, depth = 3.5, color = '#273449', position = [0, 0, 0] }) {
  return <Box position={[position[0], 0.006, position[2]]} size={[width, 0.012, depth]} color={color} rough={0.95} shadow={false} receive />;
}

function Copier(props) {
  return (
    <group {...props}>
      <Box position={[0, 0.22, 0]} size={[0.42, 0.44, 0.38]} color="#e2e8f0" rough={0.5} />
      <Box position={[0, 0.5, 0]} size={[0.42, 0.12, 0.38]} color="#cbd5e1" rough={0.5} />
      <Box position={[0.08, 0.565, 0.14]} size={[0.12, 0.01, 0.06]} color="#38bdf8" glow={0.9} shadow={false} />
      <Box position={[-0.27, 0.4, 0]} size={[0.12, 0.02, 0.26]} color="#f8fafc" />
      {[0.1, 0.2, 0.3].map((y) => (
        <Box key={y} position={[0, y, 0.192]} size={[0.38, 0.006, 0.006]} color="#94a3b8" shadow={false} />
      ))}
    </group>
  );
}

function WaterCooler(props) {
  return (
    <group {...props}>
      <Box position={[0, 0.3, 0]} size={[0.2, 0.6, 0.2]} color="#f1f5f9" rough={0.5} />
      <Cylinder position={[0, 0.72, 0]} radius={0.08} height={0.24} color="#7dd3fc" opacity={0.7} rough={0.15} />
      <Box position={[0, 0.42, 0.105]} size={[0.06, 0.04, 0.02]} color="#2563eb" />
    </group>
  );
}

function PaperStack(props) {
  return <Box {...props} size={[0.16, 0.03, 0.22]} color="#f8fafc" shadow={false} />;
}

/** Administratif et finance : îlot de 4 bureaux, armoires, copieur, fontaine. */
export function AdminOffice() {
  return (
    <group>
      <Carpet position={[-0.6, 0, 0]} width={2.9} depth={2.5} />
      <group position={[-0.6, 0, 0]}>
        <StaffedDesk position={[-0.54, 0, 0.29]} chair="#1e3a8a" variant={0} />
        <Workstation position={[0.54, 0, 0.29]} chair="#1e3a8a" />
        <Workstation position={[-0.54, 0, -0.29]} rotation={[0, Math.PI, 0]} chair="#1e3a8a" screen="#60a5fa" />
        <StaffedDesk position={[0.54, 0, -0.29]} rotation={[0, Math.PI, 0]} chair="#1e3a8a" screen="#60a5fa" outfit="officeAlt" variant={2} />
        {/* Cloison acoustique centrale */}
        <Box position={[0, 0.66, 0]} size={[2.14, 0.3, 0.04]} color="#3b82f6" rough={0.95} />
        <PaperStack position={[-0.82, 0.515, 0.38]} />
        <PaperStack position={[0.3, 0.515, -0.4]} />
      </group>
      <FilingCabinet position={[1.05, 0, -1.55]} />
      <FilingCabinet position={[1.6, 0, -1.55]} color="#94a3b8" />
      <Copier position={[1.65, 0, -0.45]} rotation={[0, -Math.PI / 2, 0]} />
      <Person outfit="office" variant={3} position={[1.2, 0, -0.45]} rotation={[0, Math.PI / 2, 0]} colors={{ top: '#be185d' }} />
      <WaterCooler position={[1.25, 0, 1.45]} />
      <Plant position={[1.85, 0, 1.4]} />
      <Plant position={[-2.05, 0, -1.55]} size={0.8} />
      <Extinguisher position={[2.1, 0, -1.0]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/** Graphique de pilotage affiché sur grand écran (barres lumineuses). */
function KpiScreen({ bars = [0.35, 0.6, 0.45, 0.8, 0.55], ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.02, 0]} size={[0.45, 0.04, 0.35]} color={PALETTE.graphite} />
      <Box position={[0, 0.6, -0.05]} size={[0.05, 1.15, 0.05]} color={PALETTE.graphite} metal={0.5} />
      <Box position={[0, 1.15, 0]} size={[0.85, 0.5, 0.04]} color={PALETTE.rubber} />
      <Box position={[0, 1.15, 0.021]} size={[0.8, 0.45, 0.004]} color="#0b2545" glow={0.4} shadow={false} />
      {bars.map((h, i) => (
        <Box
          key={i}
          position={[-0.28 + i * 0.14, 0.96 + (h * 0.38) / 2, 0.026]}
          size={[0.08, h * 0.38, 0.004]}
          color={i === 3 ? '#22c55e' : '#38bdf8'}
          glow={1.2}
          shadow={false}
        />
      ))}
    </group>
  );
}

/** Commerciaux sédentaires : plateau de téléconseil, cloisons hautes, écran de pilotage. */
export function SalesOffice() {
  const seats = [-1.07, 0, 1.07];
  return (
    <group>
      <Carpet position={[-0.45, 0, 0]} width={3.6} depth={2.6} color="#2b2f4a" />
      <group position={[-0.45, 0, 0]}>
        {seats.map((x, i) => (
          <React.Fragment key={x}>
            {i !== 1 ? (
              <StaffedDesk position={[x, 0, 0.29]} chair="#7c3aed" screen="#a5b4fc" variant={i} outfit={i ? 'officeAlt' : 'office'} />
            ) : (
              <Workstation position={[x, 0, 0.29]} chair="#7c3aed" screen="#a5b4fc" />
            )}
            {i === 1 ? (
              <StaffedDesk position={[x, 0, -0.29]} rotation={[0, Math.PI, 0]} chair="#7c3aed" screen="#a5b4fc" variant={4} />
            ) : (
              <Workstation position={[x, 0, -0.29]} rotation={[0, Math.PI, 0]} chair="#7c3aed" screen="#a5b4fc" />
            )}
            {/* Casques téléphoniques */}
            <Box position={[x + 0.36, 0.52, 0.22]} size={[0.08, 0.03, 0.12]} color={PALETTE.rubber} />
            <Box position={[x - 0.36, 0.52, -0.22]} size={[0.08, 0.03, 0.12]} color={PALETTE.rubber} />
          </React.Fragment>
        ))}
        <Box position={[0, 0.74, 0]} size={[3.2, 0.48, 0.05]} color="#6d28d9" rough={0.95} />
        {[-1.6, -0.535, 0.535, 1.6].map((x) => (
          <Box key={x} position={[x, 0.66, 0]} size={[0.04, 0.32, 1.05]} color="#8b5cf6" rough={0.95} />
        ))}
      </group>
      <KpiScreen position={[1.75, 0, -1.25]} rotation={[0, -Math.PI / 4, 0]} />
      <Plant position={[1.9, 0, 1.45]} />
      <WaterCooler position={[-2.05, 0, 1.45]} />
      <Extinguisher position={[-2.1, 0, -1.5]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

/** Traceur grand format. */
function Plotter(props) {
  return (
    <group {...props}>
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box position={[0, 0.3, 0]} size={[0.05, 0.6, 0.05]} color={PALETTE.graphite} />
          <Box position={[0, 0.02, 0]} size={[0.06, 0.04, 0.4]} color={PALETTE.graphite} />
        </group>
      ))}
      <Box position={[0, 0.7, 0]} size={[1.3, 0.2, 0.3]} color="#e5e7eb" rough={0.45} />
      <Box position={[0.5, 0.81, 0.08]} size={[0.16, 0.02, 0.08]} color="#38bdf8" glow={1} shadow={false} />
      <Box position={[0, 0.5, 0.22]} rotation={[0.5, 0, 0]} size={[1.0, 0.4, 0.006]} color="#f8fafc" shadow={false} />
      <Box position={[0, 0.25, 0.25]} size={[1.1, 0.02, 0.25]} color={PALETTE.darkSteel} />
    </group>
  );
}

/** Imprimante 3D en cours d'impression (buse lumineuse animée). */
function Printer3D(props) {
  const nozzleRef = useRef();
  useFrame(({ clock }) => {
    if (!nozzleRef.current) return;
    const t = clock.getElapsedTime();
    nozzleRef.current.position.x = Math.sin(t * 2.2) * 0.1;
    nozzleRef.current.position.z = Math.cos(t * 3.1) * 0.08;
  });
  return (
    <group {...props}>
      <Box position={[0, 0.22, 0]} size={[0.5, 0.44, 0.45]} color="#475569" />
      <group position={[0, 0.44, 0]}>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
          <Box key={`${sx}${sz}`} position={[sx * 0.2, 0.22, sz * 0.18]} size={[0.025, 0.44, 0.025]} color={PALETTE.rubber} />
        ))}
        <Box position={[0, 0.44, 0]} size={[0.42, 0.025, 0.38]} color={PALETTE.rubber} />
        <Box position={[0, 0.22, 0]} size={[0.4, 0.42, 0.36]} color="#bae6fd" opacity={0.18} shadow={false} />
        <Box position={[0, 0.04, 0]} size={[0.3, 0.015, 0.28]} color="#334155" />
        <Cylinder position={[0, 0.1, 0]} radius={0.05} height={0.1} segments={10} color="#f97316" />
        <group ref={nozzleRef} userData={DYNAMIC} position={[0, 0.2, 0]}>
          <Box position={[0, 0.03, 0]} size={[0.07, 0.06, 0.07]} color={PALETTE.graphite} />
          <Ball position={[0, -0.01, 0]} radius={0.015} color="#fb923c" glow={2.5} shadow={false} />
        </group>
      </group>
    </group>
  );
}

/** Pièce prototype (engrenage) posée sur la table de revue. */
function Gear({ radius = 0.14, ...rest }) {
  const teeth = 12;
  return (
    <group {...rest}>
      <Cylinder radius={radius} height={0.045} segments={24} color={PALETTE.steel} metal={0.85} rough={0.25} />
      <Cylinder position={[0, 0.001, 0]} radius={radius * 0.3} height={0.05} segments={16} color={PALETTE.graphite} />
      {Array.from({ length: teeth }, (_, i) => {
        const a = (i / teeth) * Math.PI * 2;
        return (
          <Box key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]} rotation={[0, -a, 0]} size={[0.05, 0.045, 0.035]} color={PALETTE.steel} metal={0.85} rough={0.25} />
        );
      })}
    </group>
  );
}

/** Bureau d'études : stations CAO double écran, traceur, imprimante 3D, table de revue. */
export function DesignOffice() {
  return (
    <group>
      <Carpet position={[-0.4, 0, -0.1]} width={3.6} depth={3.2} color="#1f3a4a" />
      <StaffedDesk position={[-1.45, 0, -0.95]} screens={2} screen="#22d3ee" chair="#0f766e" variant={1} />
      <Workstation position={[-0.25, 0, -0.95]} screens={2} screen="#22d3ee" chair="#0f766e" />
      <Person outfit="officeAlt" variant={3} position={[-0.35, 0, 0.3]} rotation={[0, -0.9, 0]} colors={{ top: '#0f766e' }} />
      <Plotter position={[1.25, 0, -1.5]} />
      <Printer3D position={[1.65, 0, 0.55]} />
      {/* Table ronde de revue de conception */}
      <group position={[-0.85, 0, 0.95]}>
        <Cylinder position={[0, 0.48, 0]} radius={0.45} height={0.035} segments={28} color="#f1f5f9" rough={0.4} />
        <Cylinder position={[0, 0.24, 0]} radius={0.04} height={0.48} color={PALETTE.darkSteel} metal={0.6} />
        <Cylinder position={[0, 0.015, 0]} radius={0.22} height={0.03} color={PALETTE.darkSteel} metal={0.6} />
        <Gear position={[0.08, 0.52, -0.05]} />
        <Cylinder position={[-0.2, 0.52, 0.12]} rotation={[0, 0, Math.PI / 2]} radius={0.03} height={0.45} color="#f8fafc" />
        <OfficeChair position={[0, 0, 0.65]} color="#0f766e" />
        <OfficeChair position={[-0.62, 0, 0]} rotation={[0, -Math.PI / 2, 0]} color="#0f766e" />
        <OfficeChair position={[0.62, 0, 0]} rotation={[0, Math.PI / 2, 0]} color="#0f766e" />
      </group>
      <Plant position={[0.55, 0, 1.45]} size={0.9} />
      <Extinguisher position={[2.1, 0, -0.6]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/** Baie serveur avec LED clignotantes. */
function ServerRack({ seed = 0, ...rest }) {
  const ledsRef = useRef([]);
  const leds = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        y: 0.18 + i * 0.105,
        color: ['#22c55e', '#22c55e', '#38bdf8', '#f59e0b'][(i + seed) % 4],
        speed: 2 + ((i * 7 + seed * 3) % 9),
      })),
    [seed]
  );
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ledsRef.current.forEach((led, i) => {
      if (led) led.visible = Math.sin(t * leds[i].speed + i * 1.7) > -0.3;
    });
  });
  return (
    <group {...rest}>
      <Box position={[0, 0.665, 0]} size={[0.42, 1.33, 0.66]} color="#0f172a" metal={0.6} rough={0.35} />
      <Box position={[0, 0.665, 0.335]} size={[0.38, 1.26, 0.01]} color="#1e293b" metal={0.4} rough={0.2} opacity={0.85} />
      {leds.map((led, i) => (
        <mesh key={i} ref={(el) => (ledsRef.current[i] = el)} userData={DYNAMIC} position={[0.1, led.y, 0.342]} raycast={() => null}>
          <boxGeometry args={[0.1, 0.012, 0.004]} />
          <meshStandardMaterial color={led.color} emissive={led.color} emissiveIntensity={2} />
        </mesh>
      ))}
      {[0.25, 0.55, 0.85, 1.15].map((y) => (
        <Box key={y} position={[-0.08, y, 0.342]} size={[0.16, 0.06, 0.004]} color="#334155" shadow={false} />
      ))}
    </group>
  );
}

/** Assistance informatique : salle serveurs, chemin de câbles, climatisation, poste helpdesk. */
export function ItSupport() {
  return (
    <group>
      {/* Faux plancher technique */}
      <Box position={[-0.8, 0.02, -1.15]} size={[2.7, 0.04, 1.2]} color="#334155" receive />
      {[-1.9, -1.35, -0.8, -0.25, 0.3].map((x) => (
        <Box key={x} position={[x, 0.041, -1.15]} size={[0.01, 0.004, 1.2]} color="#475569" shadow={false} />
      ))}
      {[-1.3, -0.75, -0.2].map((x, i) => (
        <ServerRack key={x} position={[x - 0.35, 0.04, -1.3]} seed={i} />
      ))}
      {/* Chemin de câbles */}
      <Box position={[-1.1, 1.55, -1.3]} size={[1.8, 0.03, 0.3]} color={PALETTE.safetyYellow} metal={0.5} />
      {[-1.8, -1.3, -0.8, -0.3].map((x) => (
        <Box key={x} position={[x, 1.61, -1.3]} size={[0.02, 0.1, 0.3]} color={PALETTE.darkSteel} shadow={false} />
      ))}
      {/* Climatisation de précision */}
      <group position={[0.75, 0, -1.4]}>
        <Box position={[0, 0.6, 0]} size={[0.5, 1.2, 0.5]} color="#e2e8f0" rough={0.5} />
        {[0.3, 0.45, 0.6, 0.75, 0.9].map((y) => (
          <Box key={y} position={[0, y, 0.255]} size={[0.4, 0.02, 0.01]} color="#94a3b8" shadow={false} />
        ))}
        <Box position={[0.1, 1.05, 0.255]} size={[0.12, 0.06, 0.01]} color="#38bdf8" glow={1.1} shadow={false} />
      </group>
      <StaffedDesk position={[0.9, 0, 0.45]} screens={3} screen="#4ade80" chair="#1e293b" variant={2} colors={{ top: '#475569' }} />
      <Person outfit="office" variant={1} pose="work" position={[-1.0, 0.04, -0.6]} rotation={[0, Math.PI, 0]} colors={{ top: '#0369a1' }} />
      {/* Établi de maintenance PC */}
      <group position={[-1.2, 0, 0.75]}>
        <Desk width={1.2} top="#e2e8f0" />
        <Box position={[-0.3, 0.66, -0.05]} size={[0.14, 0.32, 0.34]} color={PALETTE.graphite} />
        <Box position={[-0.225, 0.66, -0.05]} size={[0.005, 0.26, 0.28]} color="#15803d" glow={0.2} shadow={false} />
        <Box position={[0.2, 0.505, 0.05]} size={[0.32, 0.015, 0.22]} color="#475569" />
        <Box position={[0.2, 0.6, -0.06]} rotation={[-0.3, 0, 0]} size={[0.32, 0.2, 0.012]} color="#38bdf8" glow={0.5} />
        <OfficeChair position={[0, 0, 0.45]} color="#1e293b" />
      </group>
      <Extinguisher position={[2.1, 0, -0.6]} rotation={[0, -Math.PI / 2, 0]} />
      <SafetySign kind="warning" position={[1.95, 0, 1.4]} />
    </group>
  );
}

/** Ordinateur portable ouvert, écran face à +Z. */
function Laptop(props) {
  return (
    <group {...props}>
      <Box position={[0, 0.006, 0]} size={[0.3, 0.012, 0.2]} color="#64748b" metal={0.6} rough={0.3} />
      <Box position={[0, 0.1, -0.1]} rotation={[-0.25, 0, 0]} size={[0.3, 0.2, 0.01]} color="#64748b" metal={0.6} rough={0.3} />
      <Box position={[0, 0.1, -0.094]} rotation={[-0.25, 0, 0]} size={[0.27, 0.17, 0.004]} color="#38bdf8" glow={0.6} shadow={false} />
    </group>
  );
}

/** Commerciaux VRP : véhicule de société sur place de parking, borne de recharge, poste nomade. */
export function RoadSales() {
  return (
    <group>
      {/* Place de parking marquée */}
      <Box position={[-0.7, 0.006, 0]} size={[3.1, 0.012, 1.7]} color="#374151" rough={0.95} shadow={false} receive />
      {[-0.85, 0.85].map((z) => (
        <Box key={z} position={[-0.7, 0.014, z]} size={[3.1, 0.006, 0.06]} color="#f8fafc" shadow={false} />
      ))}
      <Box position={[-2.25, 0.014, 0]} size={[0.06, 0.006, 1.76]} color="#f8fafc" shadow={false} />
      <Car position={[-0.75, 0, 0]} color="#2563eb" />
      {/* Borne de recharge */}
      <group position={[0.95, 0, -1.15]}>
        <Box position={[0, 0.42, 0]} size={[0.2, 0.84, 0.14]} color="#f8fafc" rough={0.4} />
        <Box position={[0, 0.66, 0.071]} size={[0.1, 0.1, 0.004]} color="#22c55e" glow={1.6} shadow={false} />
        <Box position={[0, 0.02, 0]} size={[0.3, 0.04, 0.24]} color={PALETTE.concrete} />
      </group>
      {/* Poste nomade avec ordinateur portable et valise */}
      <group position={[1.45, 0, 0.55]} rotation={[0, -Math.PI / 2, 0]}>
        <Desk width={1.0} top="#e7e5e4" />
        <Laptop position={[0, 0.5, -0.02]} />
        <OfficeChair position={[0, 0, 0.45]} color="#1e3a8a" />
        <Person outfit="officeAlt" variant={2} pose="type" position={[0, 0, 0.44]} rotation={[0, Math.PI, 0]} />
      </group>
      {/* Commercial de retour de tournée */}
      <Person outfit="office" variant={0} position={[-0.3, 0, 0.9]} rotation={[0, Math.PI * 0.85, 0]} colors={{ top: '#1e40af' }} />
      <group position={[1.9, 0, 1.45]}>
        <Box position={[0, 0.25, 0]} size={[0.26, 0.4, 0.14]} color="#1f2937" rough={0.6} />
        <Box position={[0, 0.55, 0]} size={[0.02, 0.22, 0.02]} color={PALETTE.steel} />
        <Box position={[0, 0.66, 0]} size={[0.12, 0.02, 0.02]} color={PALETTE.steel} />
      </group>
      <SafetySign kind="warning" position={[2.0, 0, -1.55]} />
      <Plant position={[1.95, 0, -0.35]} size={0.8} />
    </group>
  );
}

/** Kakémono enroulable. */
function RollUpBanner({ color = '#2563eb', ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.03, 0]} size={[0.42, 0.06, 0.12]} color={PALETTE.steel} metal={0.7} />
      <Box position={[0, 0.74, 0]} size={[0.4, 1.36, 0.01]} color="#f8fafc" />
      <Box position={[0, 1.15, 0.006]} size={[0.4, 0.4, 0.004]} color={color} shadow={false} />
      <Box position={[0, 0.5, 0.006]} size={[0.3, 0.06, 0.004]} color={color} shadow={false} />
    </group>
  );
}

/** Pièce exposée qui tourne sur son socle vitré. */
function TurningExhibit(props) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.6;
  });
  return (
    <group {...props}>
      <Box position={[0, 0.3, 0]} size={[0.42, 0.6, 0.42]} color="#f8fafc" rough={0.4} />
      <Box position={[0, 0.82, 0]} size={[0.4, 0.42, 0.4]} color="#e0f2fe" opacity={0.2} shadow={false} />
      <group ref={ref} userData={DYNAMIC} position={[0, 0.72, 0]}>
        <Gear radius={0.12} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}

/** Salons et représentation : stand d'exposition (cloisons, comptoir, kakémonos, écran, pièce exposée). */
export function TradeShow() {
  const brand = '#2563eb';
  return (
    <group>
      <Box position={[0, 0.01, 0]} size={[4.3, 0.02, 3.6]} color="#1e3a8a" rough={0.95} shadow={false} receive />
      {/* Cloisons en L et bandeau d'enseigne */}
      <Box position={[0, 0.85, -1.72]} size={[4.2, 1.7, 0.06]} color="#f1f5f9" rough={0.5} />
      <Box position={[-2.07, 0.85, -0.85]} size={[0.06, 1.7, 1.8]} color="#f1f5f9" rough={0.5} />
      <Box position={[0, 1.82, -1.7]} size={[4.2, 0.24, 0.1]} color={brand} glow={0.25} />
      <Box position={[-1.4, 1.82, -1.64]} size={[0.3, 0.18, 0.02]} color="#f8fafc" shadow={false} />
      <Cylinder position={[-1.4, 1.81, -1.625]} rotation={[-Math.PI / 2, 0, 0]} radius={0.07} height={0.01} segments={3} color="#f97316" />
      {/* Grand écran de démonstration */}
      <Box position={[0.7, 1.05, -1.67]} size={[1.15, 0.66, 0.04]} color={PALETTE.rubber} />
      <Box position={[0.7, 1.05, -1.648]} size={[1.08, 0.6, 0.004]} color="#1d4ed8" glow={0.7} shadow={false} />
      <Box position={[0.45, 1.12, -1.644]} size={[0.4, 0.25, 0.004]} color="#38bdf8" glow={1.2} shadow={false} />
      {/* Comptoir d'accueil */}
      <group position={[1.1, 0, 0.75]}>
        <Box position={[0, 0.36, 0]} size={[1.2, 0.72, 0.45]} color="#f8fafc" rough={0.4} />
        <Box position={[0, 0.36, 0.228]} size={[1.2, 0.5, 0.01]} color={brand} glow={0.2} shadow={false} />
        <Box position={[0, 0.735, 0]} size={[1.26, 0.03, 0.5]} color="#cbd5e1" rough={0.3} />
        <Box position={[-0.3, 0.76, -0.05]} size={[0.18, 0.02, 0.24]} color="#f8fafc" shadow={false} />
        <Person outfit="office" variant={2} position={[0.1, 0, -0.45]} colors={{ top: brand }} />
      </group>
      {/* Visiteurs du salon */}
      <Person outfit="officeAlt" variant={1} position={[1.0, 0, 1.45]} rotation={[0, Math.PI, 0]} />
      <Person outfit="office" variant={4} position={[-1.0, 0, 0.25]} rotation={[0, 2.45, 0]} colors={{ top: '#475569' }} />
      <RollUpBanner position={[-1.6, 0, -1.2]} rotation={[0, 0.5, 0]} color={brand} />
      <RollUpBanner position={[1.95, 0, -1.05]} rotation={[0, -0.6, 0]} color="#f97316" />
      <TurningExhibit position={[-0.55, 0, -0.35]} />
      {/* Mange-debout */}
      <group position={[-1.35, 0, 0.95]}>
        <Cylinder position={[0, 0.7, 0]} radius={0.3} height={0.03} segments={24} color="#f8fafc" />
        <Cylinder position={[0, 0.35, 0]} radius={0.03} height={0.7} color={PALETTE.steel} metal={0.8} />
        <Cylinder position={[0, 0.01, 0]} radius={0.18} height={0.02} color={PALETTE.steel} metal={0.8} />
        {[-0.45, 0.45].map((x) => (
          <group key={x} position={[x, 0, 0.15]}>
            <Cylinder position={[0, 0.48, 0]} radius={0.12} height={0.04} color={brand} />
            <Cylinder position={[0, 0.24, 0]} radius={0.02} height={0.48} color={PALETTE.steel} metal={0.8} />
          </group>
        ))}
      </group>
      <Plant position={[-1.85, 0, 1.45]} size={0.9} />
    </group>
  );
}

/** Salle de réunion / direction : table ovale, sièges, écran mural. */
export function MeetingRoom() {
  const chairs = [-0.6, 0, 0.6];
  return (
    <group>
      <Carpet width={3.8} depth={3.0} color="#2a3346" />
      <group position={[-0.2, 0, 0.1]}>
        <mesh position={[0, 0.48, 0]} scale={[2.3, 0.04, 1.0]} castShadow raycast={() => null}>
          <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
          <meshStandardMaterial color="#6b4f3a" roughness={0.4} />
        </mesh>
        <Box position={[-0.5, 0.24, 0]} size={[0.08, 0.46, 0.4]} color={PALETTE.darkSteel} metal={0.5} />
        <Box position={[0.5, 0.24, 0]} size={[0.08, 0.46, 0.4]} color={PALETTE.darkSteel} metal={0.5} />
        {chairs.map((x, i) => (
          <React.Fragment key={x}>
            <OfficeChair position={[x, 0, 0.72]} color="#334155" />
            <OfficeChair position={[x, 0, -0.72]} rotation={[0, Math.PI, 0]} color="#334155" />
            {i !== 1 && <Person outfit={i ? 'officeAlt' : 'office'} variant={i} pose="type" position={[x, 0, 0.7]} rotation={[0, Math.PI, 0]} />}
            {i === 1 && <Person outfit="office" variant={3} pose="type" position={[x, 0, -0.7]} colors={{ top: '#1f2937' }} />}
          </React.Fragment>
        ))}
        <Laptop position={[0.3, 0.5, 0.25]} />
        <Monitor position={[-0.4, 0.5, -0.2]} rotation={[0, 0.3, 0]} />
        <Keyboard position={[-0.4, 0.505, 0.0]} />
      </group>
      <KpiScreen position={[1.85, 0, -1.2]} rotation={[0, -Math.PI / 3, 0]} bars={[0.5, 0.65, 0.4, 0.75, 0.9]} />
      <Shelving position={[-1.4, 0, -1.6]} width={1.0} height={1.1} levels={3} seed={8} color="#cbd5e1" />
      <Plant position={[1.9, 0, 1.4]} />
    </group>
  );
}
