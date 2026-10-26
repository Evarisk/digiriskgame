import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  PALETTE,
  Box,
  Cylinder,
  Profile,
  Corrugated,
  FloorZone,
  SafetySign,
  Extinguisher,
  Carton,
  LoadedPallet,
  PalletRack,
  PalletJack,
  Shelving,
  Lifebuoy,
  Van,
  Wheel,
  Tube,
  DYNAMIC,
} from './kit';
import { Person } from './people';

/**
 * Postes du Groupement « Logistique » — emprise X ±2,2 / Z ±1,8, sol en y = 0.
 * `accent` = couleur de cotation DigiRisk (marquage de la zone de manœuvre).
 */

function ParkingBay({ width, depth, position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <Box position={[0, 0.006, 0]} size={[width, 0.012, depth]} color="#374151" rough={0.95} shadow={false} receive />
      {[-depth / 2, depth / 2].map((z) => (
        <Box key={z} position={[0, 0.014, z]} size={[width, 0.006, 0.06]} color="#f8fafc" shadow={false} />
      ))}
    </group>
  );
}

/** Roll-conteneur grillagé chargé de colis. */
function RollContainer(props) {
  return (
    <group {...props}>
      <Box position={[0, 0.08, 0]} size={[0.5, 0.04, 0.55]} color={PALETTE.darkSteel} />
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
        <React.Fragment key={`${sx}${sz}`}>
          <Wheel position={[sx * 0.2, 0.04, sz * 0.22]} radius={0.04} width={0.03} />
          <Box position={[sx * 0.24, 0.6, sz * 0.26]} size={[0.02, 1.05, 0.02]} color={PALETTE.steel} metal={0.7} />
        </React.Fragment>
      ))}
      {[0.4, 0.75, 1.1].map((y) => (
        <React.Fragment key={y}>
          <Box position={[0, y, -0.26]} size={[0.5, 0.015, 0.015]} color={PALETTE.steel} metal={0.7} shadow={false} />
          <Box position={[-0.24, y, 0]} size={[0.015, 0.015, 0.54]} color={PALETTE.steel} metal={0.7} shadow={false} />
          <Box position={[0.24, y, 0]} size={[0.015, 0.015, 0.54]} color={PALETTE.steel} metal={0.7} shadow={false} />
        </React.Fragment>
      ))}
      <Carton position={[-0.08, 0.1, -0.08]} size={[0.28, 0.25, 0.3]} />
      <Carton position={[0.1, 0.1, 0.12]} size={[0.22, 0.2, 0.24]} color="#b7794a" />
      <Carton position={[0.0, 0.35, -0.05]} size={[0.3, 0.2, 0.3]} color="#d1a066" />
    </group>
  );
}

/** Scooter de livraison avec top-case. */
function DeliveryScooter({ color = '#2563eb', ...rest }) {
  return (
    <group {...rest}>
      <Wheel position={[0.45, 0.13, 0]} radius={0.13} width={0.07} />
      <Wheel position={[-0.4, 0.13, 0]} radius={0.13} width={0.07} />
      <Box position={[0.0, 0.22, 0]} size={[0.6, 0.08, 0.24]} color={PALETTE.graphite} />
      <Box position={[-0.3, 0.38, 0]} size={[0.4, 0.26, 0.28]} color={color} metal={0.4} rough={0.35} />
      <Box position={[-0.3, 0.53, 0]} size={[0.38, 0.06, 0.24]} color={PALETTE.rubber} />
      <Box position={[0.38, 0.45, 0]} rotation={[0, 0, -0.35]} size={[0.08, 0.55, 0.22]} color={color} metal={0.4} rough={0.35} />
      <Box position={[0.47, 0.74, 0]} size={[0.04, 0.04, 0.5]} color={PALETTE.graphite} />
      <Box position={[0.52, 0.6, 0]} size={[0.02, 0.06, 0.1]} color="#fef9c3" glow={1.4} shadow={false} />
      <Box position={[-0.55, 0.68, 0]} size={[0.3, 0.26, 0.34]} color="#f8fafc" rough={0.4} />
      <Box position={[-0.55, 0.68, 0.172]} size={[0.2, 0.08, 0.004]} color={color} shadow={false} />
    </group>
  );
}

/** Coursiers : fourgon de livraison, scooter, étagères de colis, roll-conteneur. */
export function Courier({ accent }) {
  return (
    <group>
      <ParkingBay position={[-0.55, 0, -0.55]} width={3.5} depth={1.6} />
      <Van position={[-0.55, 0, -0.55]} color="#f8fafc" stripe="#0891b2" />
      <Shelving position={[1.55, 0, -1.55]} width={1.2} depth={0.4} height={1.3} levels={3} seed={5} />
      <DeliveryScooter position={[1.35, 0, 0.85]} rotation={[0, 0.5, 0]} color="#0891b2" />
      <RollContainer position={[-0.2, 0, 1.15]} />
      <RollContainer position={[0.45, 0, 1.2]} rotation={[0, 0.2, 0]} />
      <FloorZone position={[-0.55, 0, -0.55]} width={3.7} depth={1.8} color={accent} />
      <Person outfit="logistics" variant={0} pose="carry" position={[1.0, 0, 0.0]} rotation={[0, -Math.PI / 2, 0]} />
      <SafetySign kind="warning" position={[-2.05, 0, 1.2]} />
      <Extinguisher position={[2.1, 0, 0.2]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Fret aérien                                                          */
/* ------------------------------------------------------------------ */

/** Conteneur aérien ULD type LD3 (profil à pan coupé) sur dolly. */
function UldOnDolly({ curtain = '#0891b2', ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.3, 0]} size={[1.25, 0.08, 1.05]} color={PALETTE.darkSteel} metal={0.5} />
      {[-0.45, 0.45].map((x) =>
        [-0.42, 0.42].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.12, z]} radius={0.12} width={0.08} />)
      )}
      <Box position={[0.8, 0.22, 0]} size={[0.4, 0.04, 0.05]} color={PALETTE.darkSteel} />
      <group position={[0.08, 0.34, 0]}>
        <Profile
          points={[[-0.5, 0], [0.5, 0], [0.5, 1.05], [-0.8, 1.05], [-0.8, 0.42]]}
          depth={0.98}
          color="#cbd5e1"
          metal={0.65}
          rough={0.35}
        />
        <Box position={[-0.05, 0.5, 0.495]} size={[0.95, 0.9, 0.01]} color={curtain} rough={0.8} shadow={false} />
        {[0.2, 0.5, 0.8].map((y) => (
          <Box key={y} position={[-0.05, y, 0.502]} size={[0.97, 0.025, 0.006]} color="#facc15" shadow={false} />
        ))}
      </group>
    </group>
  );
}

/** Tracteur à bagages. */
function BaggageTug({ color = '#facc15', ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.3, 0]} size={[0.9, 0.3, 0.7]} color={color} metal={0.3} rough={0.4} />
      <Box position={[0.28, 0.5, 0]} size={[0.3, 0.12, 0.66]} color={color} metal={0.3} rough={0.4} />
      <Box position={[-0.1, 0.52, 0]} size={[0.25, 0.08, 0.35]} color={PALETTE.rubber} />
      <Box position={[-0.22, 0.65, 0]} size={[0.05, 0.28, 0.35]} color={PALETTE.rubber} />
      <Cylinder position={[0.12, 0.66, 0]} rotation={[0, 0, 0.9]} radius={0.08} height={0.02} color={PALETTE.rubber} />
      <Cylinder position={[0.05, 0.85, 0.25]} radius={0.04} height={0.06} color="#f97316" glow={1.6} shadow={false} />
      {[0.3, -0.3].map((x) =>
        [-0.36, 0.36].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.15, z]} radius={0.15} width={0.1} />)
      )}
    </group>
  );
}

/** Manche à air (aéroport). */
function Windsock(props) {
  const sockRef = useRef();
  useFrame(({ clock }) => {
    if (sockRef.current) sockRef.current.rotation.y = 0.4 + Math.sin(clock.getElapsedTime() * 0.7) * 0.25;
  });
  return (
    <group {...props}>
      <Cylinder position={[0, 1.1, 0]} radius={0.025} height={2.2} color="#e5e7eb" metal={0.5} />
      <group ref={sockRef} userData={DYNAMIC} position={[0, 2.15, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <Cylinder
            key={i}
            position={[0.1 + i * 0.13, -0.02 - i * 0.015, 0]}
            rotation={[0, 0, -Math.PI / 2 - 0.12]}
            radius={0.1 - i * 0.015}
            height={0.13}
            top={(0.1 - (i + 1) * 0.015) / (0.1 - i * 0.015)}
            openEnded
            doubleSide
            color={i % 2 ? '#f8fafc' : '#f97316'}
          />
        ))}
      </group>
    </group>
  );
}

/** Convoyeur de colis animé. */
function ParcelConveyor({ length = 3.4, ...rest }) {
  const parcelsRef = useRef([]);
  const parcels = useMemo(() => [0, 0.25, 0.5, 0.75].map((offset, i) => ({ offset, size: [0.26 + (i % 2) * 0.08, 0.18 + (i % 3) * 0.04, 0.26] })), []);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    parcelsRef.current.forEach((p, i) => {
      if (p) p.position.x = -length / 2 + 0.2 + (((t * 0.12 + parcels[i].offset) % 1) * (length - 0.4));
    });
  });
  return (
    <group {...rest}>
      <Box position={[0, 0.5, 0]} size={[length, 0.06, 0.45]} color={PALETTE.rubber} rough={0.85} />
      {[-0.24, 0.24].map((z) => (
        <Box key={z} position={[0, 0.52, z]} size={[length, 0.1, 0.03]} color="#0891b2" metal={0.4} />
      ))}
      {[-length / 2 + 0.15, 0, length / 2 - 0.15].map((x) => (
        <Box key={x} position={[x, 0.24, 0]} size={[0.05, 0.48, 0.4]} color={PALETTE.darkSteel} metal={0.5} />
      ))}
      {parcels.map((p, i) => (
        <group key={i} ref={(el) => (parcelsRef.current[i] = el)} userData={DYNAMIC} position={[0, 0.53, 0]}>
          <Carton size={p.size} color={i % 2 ? '#b7794a' : '#c08a4f'} />
        </group>
      ))}
    </group>
  );
}

/** Fret aérien : conteneurs ULD sur dollies, tracteur, convoyeur de colis, manche à air. */
export function AirFreight({ accent }) {
  return (
    <group>
      <FloorZone position={[-0.2, 0, 0.35]} width={4.1} depth={1.6} color={accent} />
      <ParcelConveyor position={[-0.35, 0, -1.45]} length={3.4} />
      <UldOnDolly position={[-1.35, 0, 0.35]} />
      <UldOnDolly position={[0.15, 0, 0.35]} curtain="#f97316" />
      <BaggageTug position={[1.45, 0, 0.35]} />
      <Person outfit="driver" variant={3} pose="type" position={[1.38, 0.22, 0.35]} rotation={[0, Math.PI / 2, 0]} colors={{ vest: '#facc15' }} />
      <Person outfit="logistics" variant={2} pose="work" position={[-0.6, 0, 1.25]} rotation={[0, Math.PI, 0]} colors={{ helmet: '#f8fafc' }} />
      <Windsock position={[1.95, 0, -1.4]} />
      <SafetySign kind="warning" position={[2.0, 0, 1.45]} />
      <Extinguisher position={[-2.1, 0, -0.6]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Transport maritime                                                   */
/* ------------------------------------------------------------------ */

/** Conteneur maritime 20' (bardage ondulé, portes à crémones), longueur selon X. */
function ShippingContainer({ color = '#1d4ed8', length = 3.6, height = 1.5, width = 1.35, ...rest }) {
  const dark = '#0f172a';
  return (
    <group {...rest}>
      <Box position={[0, height / 2, 0]} size={[length - 0.04, height - 0.06, width - 0.1]} color={color} metal={0.4} rough={0.5} />
      <Corrugated position={[0, height / 2, width / 2 - 0.035]} size={[length - 0.12, height - 0.12, 0.035]} waves={28} color={color} />
      <Corrugated position={[0, height / 2, -width / 2 + 0.035]} rotation={[0, Math.PI, 0]} size={[length - 0.12, height - 0.12, 0.035]} waves={28} color={color} />
      <Box position={[0, height - 0.01, 0]} size={[length - 0.1, 0.02, width - 0.1]} color={color} metal={0.4} rough={0.5} />
      {/* Pièces de coin */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) =>
        [0.05, height - 0.05].map((y) => (
          <Box key={`${sx}${sz}${y}`} position={[sx * (length / 2 - 0.06), y, sz * (width / 2 - 0.06)]} size={[0.12, 0.1, 0.12]} color={dark} />
        ))
      )}
      {/* Portes et barres de verrouillage */}
      <Box position={[length / 2 - 0.01, height / 2, 0]} size={[0.02, height - 0.12, width - 0.12]} color={color} metal={0.4} rough={0.5} />
      <Box position={[length / 2 + 0.002, height / 2, 0]} size={[0.01, height - 0.14, 0.012]} color={dark} shadow={false} />
      {[-0.42, -0.18, 0.18, 0.42].map((z) => (
        <Cylinder key={z} position={[length / 2 + 0.02, height / 2, z * width]} radius={0.015} height={height - 0.18} color="#94a3b8" metal={0.8} />
      ))}
      {[-0.3, 0.3].map((z) => (
        <Box key={z} position={[length / 2 + 0.03, height * 0.45, z * width]} size={[0.02, 0.12, 0.04]} color={dark} />
      ))}
      <Box position={[0, height * 0.72, width / 2 + 0.005]} size={[0.8, 0.14, 0.004]} color="#f8fafc" shadow={false} />
    </group>
  );
}

/** Bitte d'amarrage avec aussière. */
function MooringBollard(props) {
  return (
    <group {...props}>
      <Cylinder position={[0, 0.04, 0]} radius={0.22} height={0.08} color="#334155" metal={0.5} />
      <Cylinder position={[0, 0.25, 0]} radius={0.11} height={0.42} color="#111827" metal={0.5} rough={0.4} />
      <Cylinder position={[0, 0.48, 0]} radius={0.16} height={0.06} color="#111827" metal={0.5} />
      <Tube points={[[0.1, 0.3, 0.05], [0.4, 0.06, 0.3], [0.9, 0.02, 0.35], [1.3, 0.03, 0.2]]} radius={0.03} color="#d6c08f" rough={0.9} />
    </group>
  );
}

/** Transport bateaux : conteneur 20', quai avec bitte d'amarrage, bouée, palettes en attente. */
export function SeaFreight({ accent }) {
  return (
    <group>
      <ShippingContainer position={[-0.25, 0, -0.95]} color="#1d4ed8" />
      {/* Bord de quai */}
      <Box position={[0, 0.03, 1.62]} size={[4.4, 0.06, 0.25]} color="#9ca3af" rough={0.9} />
      <Box position={[0, 0.07, 1.5]} size={[4.4, 0.02, 0.05]} color={PALETTE.safetyYellow} shadow={false} />
      <MooringBollard position={[-1.5, 0, 1.45]} />
      <group position={[1.95, 0, 1.3]}>
        <Box position={[0, 0.55, 0]} size={[0.05, 1.1, 0.05]} color={PALETTE.darkSteel} />
        <Box position={[0, 0.95, 0.04]} size={[0.32, 0.32, 0.03]} color="#f8fafc" />
        <Lifebuoy position={[0, 0.95, 0.08]} radius={0.14} />
      </group>
      <LoadedPallet position={[0.0, 0, 0.6]} load={0.55} color="#9ca3af" />
      <LoadedPallet position={[0.9, 0, 0.6]} load={0.4} />
      <PalletJack position={[-0.9, 0, 0.55]} rotation={[0, 0.3, 0]} />
      <Person outfit="logistics" variant={4} pose="work" position={[-1.55, 0, 0.72]} rotation={[0, Math.PI / 2 + 0.3, 0]} colors={{ helmet: '#f8fafc' }} />
      <Person outfit="logistics" variant={1} position={[1.2, 0, 1.25]} rotation={[0, -2.3, 0]} colors={{ top: '#1e3a8a' }} />
      <FloorZone position={[-0.25, 0, -0.95]} width={3.8} depth={1.55} color={accent} />
      <SafetySign kind="warning" position={[2.05, 0, -0.1]} />
      <Extinguisher position={[2.1, 0, 0.45]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Stockage / magasin (repli « Logistique »)                            */
/* ------------------------------------------------------------------ */

/** Banderoleuse : plateau tournant + mât. */
function StretchWrapper(props) {
  const plateRef = useRef();
  useFrame((_, delta) => {
    if (plateRef.current) plateRef.current.rotation.y += delta * 1.2;
  });
  return (
    <group {...props}>
      <Cylinder position={[0, 0.05, 0]} radius={0.62} height={0.1} segments={28} color="#64748b" metal={0.4} />
      <group ref={plateRef} userData={DYNAMIC} position={[0, 0.1, 0]}>
        <LoadedPallet load={0.6} />
      </group>
      <Box position={[0.75, 0.85, 0]} size={[0.15, 1.7, 0.2]} color="#0891b2" metal={0.4} />
      <Box position={[0.62, 0.6, 0]} size={[0.14, 0.25, 0.18]} color="#e5e7eb" />
      <Cylinder position={[0.56, 0.6, 0]} radius={0.04} height={0.24} color="#e0f2fe" opacity={0.7} />
    </group>
  );
}

export function WarehouseStorage({ accent }) {
  return (
    <group>
      <PalletRack position={[-0.45, 0, -1.42]} bays={3} levels={3} levelHeight={0.62} seed={9} />
      <FloorZone position={[-0.45, 0, -1.42]} width={2.95} depth={0.75} color={accent} />
      <StretchWrapper position={[1.35, 0, -0.95]} />
      <LoadedPallet position={[-1.2, 0, 0.45]} load={0.5} />
      <LoadedPallet position={[-0.25, 0, 0.45]} load={0.35} color="#9ca3af" />
      <PalletJack position={[0.6, 0, 0.9]} rotation={[0, -0.4, 0]} />
      <Person outfit="logistics" variant={3} pose="work" position={[-0.02, 0, 0.62]} rotation={[0, Math.PI / 2 - 0.4, 0]} />
      <SafetySign kind="warning" position={[2.0, 0, 1.4]} />
      <Extinguisher position={[-2.1, 0, 1.2]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}
