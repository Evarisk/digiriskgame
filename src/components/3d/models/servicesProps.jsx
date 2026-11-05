import React from 'react';
import { Box, Cylinder, Wheel } from './kit';

/**
 * Équipements des services d'une commune pour l'éditeur de site : baie de brassage (réseau), restauration
 * collective (piano de cuisson et hotte, table inox, plonge, tables de cantine) et tracteur à épareuse.
 * Origine au sol, face à +Z, 1 unité ≈ 1,5 m.
 */

const INOX = '#cbd5e1';
const INOX_DARK = '#94a3b8';

/** Photocopieur multifonction (scanner, écran tactile, magasins papier), face à +Z. */
export function Copier() {
  return (
    <group>
      <Box size={[0.6, 0.62, 0.52]} position={[0, 0.31, 0]} color="#e5e7eb" rough={0.55} />
      {[0.14, 0.3, 0.46].map((y) => (
        <Box key={y} size={[0.52, 0.012, 0.01]} position={[0, y, 0.262]} color="#9ca3af" shadow={false} />
      ))}
      <Box size={[0.6, 0.16, 0.5]} position={[0, 0.7, -0.01]} color="#d1d5db" rough={0.5} />
      <Box size={[0.4, 0.02, 0.06]} position={[0, 0.69, 0.25]} color="#f8fafc" rough={0.7} />
      <Box size={[0.62, 0.05, 0.54]} position={[0, 0.805, -0.01]} color="#374151" rough={0.4} />
      <Box size={[0.2, 0.05, 0.12]} position={[0.17, 0.84, 0.22]} rotation={[-0.4, 0, 0]} color="#111827" rough={0.3} />
      <Box size={[0.17, 0.004, 0.09]} position={[0.17, 0.865, 0.232]} rotation={[-0.4, 0, 0]} color="#38bdf8" glow={0.6} shadow={false} />
      <Box size={[0.02, 0.02, 0.02]} position={[-0.24, 0.84, 0.24]} color="#22c55e" glow={1.2} shadow={false} />
    </group>
  );
}

/** Baie de brassage : armoire réseau vitrée, panneaux de brassage et voyants. */
export function ServerRack() {
  return (
    <group>
      <Box size={[0.6, 1.4, 0.6]} position={[0, 0.7, 0]} color="#111827" metal={0.5} rough={0.4} />
      {[0.35, 0.55, 0.75, 0.95, 1.15].map((y, i) => (
        <group key={y} position={[0, y, 0.27]}>
          <Box size={[0.48, 0.12, 0.03]} color="#1f2937" metal={0.4} rough={0.5} />
          {[-0.18, -0.1, -0.02, 0.06, 0.14].map((x, k) => (
            <Box key={x} size={[0.025, 0.025, 0.012]} position={[x, 0.02, 0.022]} color={(i + k) % 3 ? '#22c55e' : '#38bdf8'} glow={2} shadow={false} />
          ))}
        </group>
      ))}
      <Box size={[0.52, 1.25, 0.012]} position={[0, 0.72, 0.31]} color="#93c5fd" opacity={0.18} shadow={false} />
    </group>
  );
}

/** Piano de cuisson inox (feux, fours) et hotte d'extraction suspendue. */
export function KitchenRange() {
  return (
    <group>
      <Box size={[1.6, 0.58, 0.8]} position={[0, 0.29, 0]} color={INOX} metal={0.75} rough={0.3} />
      <Box size={[1.62, 0.03, 0.82]} position={[0, 0.595, 0]} color={INOX_DARK} metal={0.7} rough={0.35} />
      {[-0.55, -0.18, 0.18, 0.55].map((x) =>
        [-0.18, 0.18].map((z) => <Cylinder key={`${x}${z}`} radius={0.11} height={0.02} position={[x, 0.62, z]} color="#1f2937" metal={0.5} rough={0.5} />)
      )}
      {[-0.4, 0.4].map((x) => (
        <Box key={x} size={[0.6, 0.32, 0.01]} position={[x, 0.3, 0.405]} color="#1f2937" metal={0.5} rough={0.4} />
      ))}
      <Box size={[1.8, 0.3, 1.0]} position={[0, 1.55, -0.05]} color={INOX} metal={0.75} rough={0.3} />
      <Box size={[0.4, 0.5, 0.4]} position={[0, 1.95, -0.25]} color={INOX_DARK} metal={0.7} rough={0.35} />
    </group>
  );
}

/** Table de travail inox à étagère basse. */
export function InoxWorktable() {
  return (
    <group>
      {[-0.72, 0.72].map((x) =>
        [-0.28, 0.28].map((z) => <Box key={`${x}${z}`} size={[0.04, 0.58, 0.04]} position={[x, 0.29, z]} color={INOX_DARK} metal={0.7} rough={0.35} />)
      )}
      <Box size={[1.6, 0.04, 0.68]} position={[0, 0.6, 0]} color={INOX} metal={0.75} rough={0.3} />
      <Box size={[1.5, 0.02, 0.6]} position={[0, 0.16, 0]} color={INOX_DARK} metal={0.7} rough={0.35} />
      <Box size={[0.4, 0.06, 0.3]} position={[-0.4, 0.65, 0]} color="#f8fafc" rough={0.6} />
    </group>
  );
}

/** Plonge : bac inox à douchette et lave-vaisselle à capot. */
export function DishStation() {
  return (
    <group>
      <Box size={[1.0, 0.58, 0.7]} position={[-0.45, 0.29, 0]} color={INOX} metal={0.75} rough={0.3} />
      <Box size={[0.7, 0.1, 0.5]} position={[-0.45, 0.56, 0]} color={INOX_DARK} metal={0.7} rough={0.35} />
      <Cylinder radius={0.015} height={0.5} position={[-0.45, 0.85, -0.25]} color={INOX_DARK} metal={0.8} rough={0.3} />
      <Box size={[0.7, 0.62, 0.7]} position={[0.42, 0.31, 0]} color={INOX} metal={0.75} rough={0.3} />
      <Box size={[0.62, 0.5, 0.62]} position={[0.42, 0.88, 0]} color={INOX} metal={0.75} rough={0.3} />
      <Box size={[0.3, 0.04, 0.04]} position={[0.42, 1.1, 0.33]} color="#1f2937" metal={0.5} />
    </group>
  );
}

/** Table de cantine (plateau stratifié) et ses deux bancs, hauteur enfant. */
export function CanteenTable() {
  return (
    <group>
      <Box size={[1.8, 0.04, 0.6]} position={[0, 0.46, 0]} color="#fbbf24" rough={0.5} />
      {[-0.8, 0.8].map((x) => (
        <Box key={x} size={[0.05, 0.44, 0.5]} position={[x, 0.22, 0]} color="#475569" metal={0.5} rough={0.5} />
      ))}
      {[-0.5, 0.5].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Box size={[1.8, 0.04, 0.22]} position={[0, 0.28, 0]} color="#2563eb" rough={0.5} />
          <Box size={[0.05, 0.26, 0.18]} position={[-0.8, 0.13, 0]} color="#475569" metal={0.5} rough={0.5} />
          <Box size={[0.05, 0.26, 0.18]} position={[0.8, 0.13, 0]} color="#475569" metal={0.5} rough={0.5} />
        </group>
      ))}
    </group>
  );
}

/** Tracteur et épareuse (bras de fauchage replié sur le côté droit, rotor en bout). */
export function TractorMower({ color = '#15803d' }) {
  return (
    <group>
      <Box size={[1.5, 0.45, 0.62]} position={[0.25, 0.62, 0]} color={color} metal={0.3} rough={0.5} />
      <Box size={[0.75, 0.75, 0.8]} position={[-0.3, 1.2, 0]} color="#1f2937" metal={0.3} rough={0.4} />
      <Box size={[0.7, 0.62, 0.82]} position={[-0.3, 1.22, 0]} color="#93c5fd" opacity={0.3} shadow={false} />
      <Box size={[0.82, 0.06, 0.9]} position={[-0.3, 1.6, 0]} color={color} metal={0.3} rough={0.5} />
      <Cylinder radius={0.03} height={0.35} position={[0.7, 1.0, 0.15]} color="#111827" />
      <Wheel radius={0.42} width={0.28} position={[-0.35, 0.42, 0.48]} />
      <Wheel radius={0.42} width={0.28} position={[-0.35, 0.42, -0.48]} />
      <Wheel radius={0.26} width={0.18} position={[0.75, 0.26, 0.4]} />
      <Wheel radius={0.26} width={0.18} position={[0.75, 0.26, -0.4]} />
      {/* Épareuse : bras articulé et rotor de coupe */}
      <Box size={[0.12, 0.12, 0.9]} position={[-0.9, 0.9, -0.55]} rotation={[0.5, 0, 0]} color="#f97316" metal={0.4} rough={0.5} />
      <Box size={[0.1, 0.1, 0.8]} position={[-0.9, 0.7, -1.25]} rotation={[-0.6, 0, 0]} color="#f97316" metal={0.4} rough={0.5} />
      <Cylinder radius={0.14} height={0.7} position={[-0.9, 0.35, -1.55]} rotation={[0, 0, Math.PI / 2]} color="#f97316" metal={0.4} rough={0.5} />
    </group>
  );
}
