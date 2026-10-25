import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * Étape 3 — Assets 3D Low-Poly procéduraux pour chaque archétype d'Unité de Travail (UT)
 * Remplace les simples cubes du mode "Boîtes blanches" par des équipements métiers reconnaissables.
 */
export default function WorkstationProps({ archetype, riskColor, isCritical }) {
  const sparkRef = useRef();
  const beaconRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (sparkRef.current) {
      const s = 0.8 + Math.sin(t * 18) * 0.35;
      sparkRef.current.scale.set(s, s, s);
    }
    if (beaconRef.current) {
      beaconRef.current.rotation.y = t * 4;
    }
  });

  return (
    <group position={[0, 0.08, 0]}>
      {archetype === 'office_desk' && <OfficeDeskMesh accent={riskColor} />}
      {archetype === 'tech_office' && <TechOfficeMesh accent={riskColor} />}
      {archetype === 'welding' && <WeldingStationMesh accent={riskColor} sparkRef={sparkRef} />}
      {archetype === 'forklift' && <ForkliftZoneMesh accent={riskColor} />}
      {archetype === 'paint_booth' && <PaintBoothMesh accent={riskColor} />}
      {archetype === 'chemical_tank' && <ChemicalTankMesh accent={riskColor} />}
      {archetype === 'logistics_dock' && <LogisticsDockMesh accent={riskColor} />}

      {/* Gyrophare d'alerte 3D si cotation critique (>= 81) */}
      {isCritical && (
        <group position={[1.7, 1.85, -1.3]} ref={beaconRef}>
          <mesh>
            <cylinderGeometry args={[0.16, 0.2, 0.28, 12]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2.2} />
          </mesh>
          <pointLight color="#ef4444" intensity={1.8} distance={4.5} />
        </group>
      )}
    </group>
  );
}

function OfficeDeskMesh({ accent }) {
  return (
    <group>
      {/* Bureau principal */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[2.2, 0.1, 1.1]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>
      <mesh position={[-0.95, 0.27, 0]} castShadow>
        <boxGeometry args={[0.12, 0.54, 1.0]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <mesh position={[0.95, 0.27, 0]} castShadow>
        <boxGeometry args={[0.12, 0.54, 1.0]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* Écran PC */}
      <mesh position={[0, 0.88, -0.25]} castShadow>
        <boxGeometry args={[0.85, 0.48, 0.06]} />
        <meshStandardMaterial color="#0f172a" emissive={accent} emissiveIntensity={0.35} />
      </mesh>
      {/* Chaise ergonomique */}
      <mesh position={[0, 0.38, 0.72]} castShadow>
        <boxGeometry args={[0.52, 0.1, 0.52]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.68, 0.94]} castShadow>
        <boxGeometry args={[0.5, 0.55, 0.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
}

function TechOfficeMesh({ accent }) {
  return (
    <group>
      <OfficeDeskMesh accent={accent} />
      {/* Baie serveur latérale */}
      <mesh position={[1.55, 0.85, -0.4]} castShadow>
        <boxGeometry args={[0.7, 1.7, 0.7]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[1.55, 1.15, -0.04]}>
        <boxGeometry args={[0.5, 0.08, 0.02]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[1.55, 0.9, -0.04]}>
        <boxGeometry args={[0.5, 0.08, 0.02]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}

function WeldingStationMesh({ accent, sparkRef }) {
  return (
    <group>
      {/* Établi métallique lourd */}
      <mesh position={[-0.3, 0.58, 0]} castShadow>
        <boxGeometry args={[2.4, 0.16, 1.3]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[-1.3, 0.28, 0]} castShadow>
        <boxGeometry args={[0.2, 0.56, 1.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.7, 0.28, 0]} castShadow>
        <boxGeometry args={[0.2, 0.56, 1.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* Bras robot / poste à souder */}
      <mesh position={[1.35, 0.65, -0.3]} castShadow>
        <boxGeometry args={[0.75, 1.3, 0.75]} />
        <meshStandardMaterial color="#ea580c" roughness={0.4} />
      </mesh>
      {/* Pièce usinée + halo de soudure */}
      <mesh position={[-0.2, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.32, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.2, 1.02, 0]} ref={sparkRef}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial color="#fde047" emissive="#f97316" emissiveIntensity={2.5} />
      </mesh>
      {/* Écran de protection soudure */}
      <mesh position={[-0.3, 0.9, 0.95]}>
        <boxGeometry args={[2.2, 1.4, 0.06]} />
        <meshStandardMaterial color={accent} transparent opacity={0.38} />
      </mesh>
    </group>
  );
}

function ForkliftZoneMesh({ accent }) {
  return (
    <group>
      {/* Rack de palettes */}
      <mesh position={[-1.25, 0.95, -0.7]} castShadow>
        <boxGeometry args={[1.6, 1.9, 0.8]} />
        <meshStandardMaterial color="#d97706" wireframe={false} roughness={0.5} />
      </mesh>
      {/* Chariot élévateur (Cariste) */}
      <group position={[0.75, 0, 0.25]}>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.25, 0.62, 0.88]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.35} />
        </mesh>
        {/* Cabine arceau */}
        <mesh position={[-0.1, 0.98, 0]} castShadow>
          <boxGeometry args={[0.85, 0.65, 0.8]} />
          <meshStandardMaterial color="#1e293b" wireframe />
        </mesh>
        {/* Mât & fourches */}
        <mesh position={[0.7, 0.85, 0]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.65]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[1.05, 0.2, 0]} castShadow>
          <boxGeometry args={[0.7, 0.08, 0.6]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      </group>
    </group>
  );
}

function PaintBoothMesh({ accent }) {
  return (
    <group>
      {/* Cabine vitrée / tunnel de peinture */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[2.8, 1.9, 1.8]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.32} />
      </mesh>
      {/* Arche structurelle */}
      <mesh position={[0, 1.95, 0]} castShadow>
        <boxGeometry args={[2.9, 0.18, 1.9]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {/* Pièces suspendues sur convoyeur */}
      <mesh position={[-0.65, 1.1, 0]} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.35]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh position={[0.65, 1.1, 0]} castShadow>
        <boxGeometry args={[0.55, 0.85, 0.35]} />
        <meshStandardMaterial color="#818cf8" metalness={0.5} roughness={0.2} />
      </mesh>
    </group>
  );
}

function ChemicalTankMesh({ accent }) {
  return (
    <group>
      {/* Cuves cylindriques de traitement / dépotage */}
      <mesh position={[-0.85, 0.95, -0.2]} castShadow>
        <cylinderGeometry args={[0.65, 0.65, 1.8, 20]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.75, 0.8, -0.2]} castShadow>
        <cylinderGeometry args={[0.55, 0.55, 1.5, 20]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Anneau lumineux de niveau */}
      <mesh position={[-0.85, 1.35, -0.2]}>
        <cylinderGeometry args={[0.68, 0.68, 0.14, 20]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
      {/* Fûts chimiques */}
      <mesh position={[0.4, 0.4, 0.85]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.75, 14]} />
        <meshStandardMaterial color="#eab308" />
      </mesh>
      <mesh position={[1.0, 0.4, 0.85]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.75, 14]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function LogisticsDockMesh({ accent }) {
  return (
    <group>
      {/* Conteneur maritime / fret */}
      <mesh position={[-0.45, 0.85, -0.25]} castShadow>
        <boxGeometry args={[2.2, 1.55, 1.25]} />
        <meshStandardMaterial color="#0284c7" roughness={0.5} />
      </mesh>
      {/* Caisses & colis */}
      <mesh position={[1.2, 0.42, 0.45]} castShadow>
        <boxGeometry args={[0.75, 0.75, 0.75]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>
      <mesh position={[1.2, 1.02, 0.45]} castShadow>
        <boxGeometry args={[0.55, 0.5, 0.55]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    </group>
  );
}
