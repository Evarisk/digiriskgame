import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  PALETTE,
  Box,
  Cylinder,
  Ball,
  Profile,
  Corrugated,
  HazardBar,
  Bollard,
  Car,
  Tree,
  PalletRack,
  SafetySign,
  SafetyGuardrail,
  Wheel,
  seeded,
  noRaycast,
  DYNAMIC,
} from './kit';
import { getTexture } from './textures';
import { shellFinish } from '../../../services/skins';
import { sideDoorZ } from '../../../services/siteLayout';

/**
 * Enveloppes architecturales des Groupements DigiRisk (vue « maison de poupée ») :
 * mur du fond plein et détaillé, façade avant et côtés ouverts ou bas pour garder
 * les Unités de Travail visibles. Les annexes extérieures (parking, quais, cheminée,
 * cuves) sont placées du côté `outward` (vers l'extérieur du campus).
 *
 * Repère : origine au centre de la fondation, dessus de dalle en y = Y0.
 * Bande libre derrière les UT ≈ 4 unités, devant ≈ 3 unités.
 */

const Y0 = 0.16;
const FRAME = '#334155';

/** Hauteur d'affichage de l'enseigne HTML au-dessus de chaque type de bâtiment. */
export const SHELL_HEADER_HEIGHT = {
  office: 10.4,
  factory: 7.6,
  paint: 6.6,
  logistics: 6.4,
  yard: 5.6,
};

/**
 * Coordonnée Z locale de la porte piétonne latérale (côté voie d'accès) : alignée sur l'allée
 * transversale la plus centrale du bâtiment, quel que soit son nombre de rangées de postes.
 */
export function getBuildingDoorZ(depth) {
  return sideDoorZ(depth);
}

export default function BuildingShell({ archetype, ...props }) {
  if (archetype === 'office') return <OfficeShell {...props} />;
  if (archetype === 'paint') return <PaintShell {...props} />;
  if (archetype === 'logistics') return <WarehouseShell {...props} />;
  if (archetype === 'yard') return <YardShell {...props} />;
  return <FactoryShell {...props} />;
}

/* ------------------------------------------------------------------ */
/* Éléments communs                                                     */
/* ------------------------------------------------------------------ */

/**
 * Poteaux périphériques + poutres de rive latérales. La façade avant reste sans poutre
 * haute : elle passerait devant les UT quand la caméra cible un poste du premier rang.
 * Le poteau éventuel tombant dans l'ouverture de la porte latérale (`sideDoorZ`) est omis.
 */
function StructuralFrame({
  width,
  depth,
  height,
  step = 4.2,
  color = FRAME,
  sideDoorSide = 0,
  sideDoorZ = null,
}) {
  const nz = Math.max(1, Math.round((depth - 0.5) / step));
  const zs = Array.from({ length: nz + 1 }, (_, i) => -depth / 2 + 0.25 + (i * (depth - 0.5)) / nz);
  return (
    <group>
      {zs.map((z) =>
        [-1, 1].map((sx) => {
          if (sx === sideDoorSide && sideDoorZ !== null && Math.abs(z - sideDoorZ) < 1.15) {
            return null;
          }
          return (
            <Box
              key={`${z}${sx}`}
              position={[sx * (width / 2 - 0.25), Y0 + height / 2, z]}
              size={[0.3, height, 0.3]}
              color={color}
              metal={0.5}
              rough={0.4}
            />
          );
        })
      )}
      {[-1, 1].map((sx) => (
        <Box key={`r${sx}`} position={[sx * (width / 2 - 0.25), Y0 + height - 0.18, 0]} size={[0.26, 0.36, depth - 0.5]} color={color} metal={0.5} rough={0.4} />
      ))}
      {/* Projecteurs LED fixés sur les poteaux, orientés vers l'intérieur */}
      {zs.slice(1, -1).map((z) =>
        [-1, 1].map((sx) => (
          <group key={`l${z}${sx}`} position={[sx * (width / 2 - 0.5), Y0 + height - 0.9, z]}>
            <Box position={[-sx * 0.05, 0, 0]} size={[0.24, 0.1, 0.34]} color="#1f2937" metal={0.5} />
            <Box position={[-sx * 0.05, -0.055, 0]} size={[0.2, 0.012, 0.3]} color="#fef9c3" glow={1.6} shadow={false} />
          </group>
        ))
      )}
      {/* Descentes d'eaux pluviales aux angles arrière */}
      {[-1, 1].map((sx) => (
        <Cylinder key={`d${sx}`} position={[sx * (width / 2 + 0.06), Y0 + height / 2, -depth / 2 + 0.12]} radius={0.06} height={height} segments={8} color="#6b7280" metal={0.5} />
      ))}
    </group>
  );
}

/**
 * Portique de porte piétonne industrielle (ouverture réelle dans le mur, vantail ouvert à 80°,
 * hublot vitré, barre anti-panique, linteau zébré, bloc BAES lumineux « SORTIE », potelets
 * et panneau d'obligation piéton).
 */
function IndustrialDoorway({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 2.0,
  height = 2.35,
  themeColor = '#f59e0b',
  doubleLeaf = false,
  withGuardrails = false,
  guardrailSpan = 3.0,
}) {
  const halfW = width / 2;
  const leafW = doubleLeaf ? (width - 0.26) / 2 : Math.min(0.95, width - 0.3);

  return (
    <group position={position} rotation={rotation}>
      {/* Montants et linteau métalliques du portique */}
      {[-1, 1].map((sx) => (
        <Box
          key={`post-${sx}`}
          position={[sx * (halfW - 0.07), height / 2, 0]}
          size={[0.14, height, 0.22]}
          color="#1e293b"
          metal={0.6}
          rough={0.35}
        />
      ))}
      <Box position={[0, height - 0.09, 0]} size={[width + 0.06, 0.18, 0.26]} color="#1e293b" metal={0.6} rough={0.35} />
      <Box position={[0, height + 0.04, 0]} size={[width + 0.08, 0.08, 0.28]} color={themeColor} glow={0.35} shadow={false} />
      <HazardBar position={[0, height + 0.13, 0]} length={width + 0.08} segments={8} height={0.09} thickness={0.24} />

      {/* Bloc autonome d'éclairage de sécurité (BAES vert « SORTIE / PIÉTONS ») double face */}
      {[-1, 1].map((sz) => (
        <group key={`baes-${sz}`} position={[0, height - 0.26, sz * 0.14]}>
          <Box size={[0.52, 0.18, 0.04]} color="#16a34a" glow={1.5} shadow={false} />
          <Box position={[-0.1, 0, sz * 0.024]} size={[0.1, 0.11, 0.005]} color="#f8fafc" glow={0.9} shadow={false} />
          <Box position={[0.1, 0, sz * 0.024]} size={[0.16, 0.035, 0.005]} color="#f8fafc" glow={0.9} shadow={false} />
        </group>
      ))}

      {/* Vantail / Vantaux de porte ouverts vers l'intérieur (sans collision pour laisser le passage libre) */}
      {(doubleLeaf ? [-1, 1] : [-1]).map((sx) => (
        <group
          key={`leaf-${sx}`}
          position={[sx * (halfW - 0.12), 0, -0.05]}
          rotation={[0, sx * 1.38, 0]}
          userData={{ noCollide: true }}
        >
          <Box
            position={[-sx * (leafW / 2), (height - 0.22) / 2, 0]}
            size={[leafW, height - 0.22, 0.045]}
            color="#475569"
            metal={0.55}
            rough={0.38}
          />
          {/* Hublot vitré vertical */}
          <Box
            position={[-sx * (leafW * 0.55), height * 0.58, 0]}
            size={[0.22, 0.62, 0.055]}
            color="#bae6fd"
            opacity={0.5}
            metal={0.8}
            rough={0.1}
            shadow={false}
          />
          {/* Barre anti-panique */}
          <Box
            position={[-sx * (leafW * 0.5), 0.98, 0.035]}
            size={[leafW * 0.72, 0.04, 0.04]}
            color="#ef4444"
            metal={0.6}
            shadow={false}
          />
        </group>
      ))}

      {/* Potelets de protection (dehors, au sol et non sur la dalle) et panneau d'obligation piétons */}
      <Bollard position={[-(halfW + 0.24), -Y0, 0.36]} height={0.72} />
      <Bollard position={[halfW + 0.24, -Y0, 0.36]} height={0.72} />
      <SafetySign kind="mandatory" position={[halfW + 0.26, 0, -0.25]} height={1.25} size={0.26} />

      {/* Garde-corps latéraux en façade avant pour canaliser le flux vers la porte */}
      {withGuardrails &&
        [-1, 1].map((sx) => (
          <SafetyGuardrail
            key={`gr-${sx}`}
            position={[sx * (halfW + 0.35 + guardrailSpan / 2), 0, 0]}
            length={guardrailSpan}
            height={0.78}
            axis="x"
          />
        ))}
    </group>
  );
}

/** Équipements muraux sur la face intérieure du mur du fond (porte de service, issue de secours, RIA, armoire électrique). */
function WallFixtures({ width, depth, side = -1 }) {
  const z = -depth / 2 + 0.33;
  const at = (offset) => side * (width / 2 - offset);
  return (
    <group>
      {/* Porte de service + bloc lumineux « sortie de secours » */}
      <group position={[at(1.6), Y0, z]}>
        <Box position={[0, 0.72, 0]} size={[0.75, 1.44, 0.05]} color="#64748b" metal={0.5} rough={0.4} />
        <Box position={[0.26, 0.72, 0.04]} size={[0.12, 0.03, 0.03]} color="#e5e7eb" metal={0.8} />
        <Box position={[0, 1.66, 0.03]} size={[0.42, 0.16, 0.05]} color="#16a34a" glow={1.4} />
        <Box position={[-0.08, 1.66, 0.06]} size={[0.08, 0.1, 0.005]} color="#f8fafc" glow={0.8} shadow={false} />
        <Box position={[0.08, 1.66, 0.06]} size={[0.12, 0.03, 0.005]} color="#f8fafc" glow={0.8} shadow={false} />
      </group>
      {/* Robinet d'incendie armé */}
      <group position={[at(2.9), Y0 + 1.0, z]}>
        <Box size={[0.55, 0.6, 0.16]} color={PALETTE.fireRed} metal={0.3} />
        <Cylinder position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]} radius={0.2} height={0.1} segments={18} color="#7f1d1d" />
        <Cylinder position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} radius={0.06} height={0.06} color="#e5e7eb" metal={0.7} />
        <Box position={[0, 0.42, 0.03]} size={[0.28, 0.2, 0.02]} color={PALETTE.fireRed} glow={0.3} />
      </group>
      {/* Armoire électrique + panneau danger */}
      <group position={[at(4.2), Y0, z]}>
        <Box position={[0, 0.85, 0]} size={[0.8, 1.7, 0.3]} color="#cbd5e1" metal={0.4} rough={0.45} />
        <Box position={[0, 0.85, 0.152]} size={[0.01, 1.6, 0.004]} color="#64748b" shadow={false} />
        <Cylinder position={[0, 1.25, 0.16]} rotation={[-Math.PI / 2, 0, 0]} radius={0.1} height={0.01} segments={3} color={PALETTE.safetyYellow} />
        <Box position={[0.25, 1.1, 0.16]} size={[0.06, 0.06, 0.01]} color="#22c55e" glow={1.5} shadow={false} />
        <Box position={[0, 1.95, -0.05]} size={[0.3, 0.5, 0.2]} color="#475569" metal={0.5} />
      </group>
    </group>
  );
}

/** Bandeau d'enseigne lumineux aux couleurs du Groupement. */
function SignBand({ width, y, z, themeColor, highlight }) {
  return (
    <mesh position={[0, y, z]} raycast={noRaycast}>
      <boxGeometry args={[width, 0.45, 0.3]} />
      <meshStandardMaterial color={themeColor} emissive={themeColor} emissiveIntensity={highlight ? 0.65 : 0.25} />
    </mesh>
  );
}

/**
 * Mur bas en bardage ondulé sur un côté (x = side * width/2).
 * Si `doorZ` est fourni, découpe une ouverture franche pour la porte piétonne.
 */
function LowSideWall({ side, width, depth, height = 1.3, color = '#64748b', doorZ = null, doorWidth = 2.0 }) {
  const zMin = -depth / 2 + 0.15;
  const zMax = depth / 2 - 0.15;

  if (doorZ === null) {
    return (
      <Corrugated
        position={[side * (width / 2 - 0.08), Y0 + height / 2, 0]}
        rotation={[0, (side * Math.PI) / 2, 0]}
        size={[depth - 0.3, height, 0.06]}
        waves={Math.round(depth * 3)}
        color={color}
      />
    );
  }

  const seg1End = doorZ - doorWidth / 2;
  const seg2Start = doorZ + doorWidth / 2;
  const len1 = Math.max(0, seg1End - zMin);
  const len2 = Math.max(0, zMax - seg2Start);

  return (
    <group>
      {len1 > 0.2 && (
        <Corrugated
          position={[side * (width / 2 - 0.08), Y0 + height / 2, (zMin + seg1End) / 2]}
          rotation={[0, (side * Math.PI) / 2, 0]}
          size={[len1, height, 0.06]}
          waves={Math.max(4, Math.round(len1 * 3))}
          color={color}
        />
      )}
      {len2 > 0.2 && (
        <Corrugated
          position={[side * (width / 2 - 0.08), Y0 + height / 2, (seg2Start + zMax) / 2]}
          rotation={[0, (side * Math.PI) / 2, 0]}
          size={[len2, height, 0.06]}
          waves={Math.max(4, Math.round(len2 * 3))}
          color={color}
        />
      )}
    </group>
  );
}

/** Panache de fumée animé (sphères qui montent, grossissent et s'estompent). */
function SmokePlume({ position, color = '#cbd5e1', puffs = 5 }) {
  const refs = useRef([]);
  const materials = useMemo(
    () => Array.from({ length: puffs }, () => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false, roughness: 1 })),
    [color, puffs]
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const life = (t * 0.16 + i / puffs) % 1;
      mesh.position.set(Math.sin(life * 3 + i) * 0.3 + life * 1.2, life * 3.2, Math.cos(life * 2 + i) * 0.2);
      mesh.scale.setScalar(0.35 + life * 1.1);
      materials[i].opacity = 0.42 * (1 - life);
    });
  });
  return (
    <group position={position} userData={{ noCollide: true }}>
      {materials.map((m, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} userData={DYNAMIC} material={m} raycast={noRaycast}>
          <icosahedronGeometry args={[0.5, 1]} />
        </mesh>
      ))}
    </group>
  );
}

/** Ventilateur de toiture avec pales en rotation. */
function RoofFan({ speed = 4, ...rest }) {
  const bladesRef = useRef();
  useFrame((_, delta) => {
    if (bladesRef.current) bladesRef.current.rotation.y += delta * speed;
  });
  return (
    <group {...rest}>
      <Box position={[0, 0.3, 0]} size={[1.0, 0.6, 1.0]} color="#9ca3af" metal={0.5} rough={0.4} />
      <Cylinder position={[0, 0.66, 0]} radius={0.42} height={0.12} segments={20} openEnded doubleSide color="#6b7280" metal={0.5} />
      <group ref={bladesRef} userData={DYNAMIC} position={[0, 0.66, 0]}>
        <Box size={[0.78, 0.02, 0.12]} color="#374151" metal={0.5} />
        <Box rotation={[0, Math.PI / 2, 0]} size={[0.78, 0.02, 0.12]} color="#374151" metal={0.5} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Zone extérieure : aire à ciel ouvert des UT rattachées à la racine   */
/* ------------------------------------------------------------------ */

function YardShell({ width, depth, themeColor, highlight }) {
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  return (
    <group>
      {/* Liseré de délimitation de l'aire */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box position={[0, Y0 + 0.012, s * (depth / 2 - 0.25)]} size={[width - 0.5, 0.01, 0.18]} color={PALETTE.safetyYellow} shadow={false} />
          <Box position={[s * (width / 2 - 0.25), Y0 + 0.012, 0]} size={[0.18, 0.01, depth - 0.5]} color={PALETTE.safetyYellow} shadow={false} />
        </group>
      ))}
      {/* Mâts d'éclairage aux angles, projecteurs tournés vers l'aire */}
      {corners.map(([sx, sz]) => (
        <group key={`${sx}${sz}`} position={[sx * (width / 2 - 0.5), Y0, sz * (depth / 2 - 0.5)]}>
          <Cylinder position={[0, 2.2, 0]} radius={0.06} height={4.4} color="#64748b" metal={0.6} />
          <Box position={[-sx * 0.2, 4.35, -sz * 0.2]} size={[0.5, 0.14, 0.3]} color="#1f2937" metal={0.5} />
          <Box position={[-sx * 0.2, 4.27, -sz * 0.2]} size={[0.44, 0.02, 0.26]} color="#fef9c3" glow={1.4} shadow={false} />
        </group>
      ))}
      {/* Panneau d'identification au fond de l'aire */}
      <group position={[0, Y0, -depth / 2 + 0.4]}>
        {[-1, 1].map((sx) => (
          <Box key={sx} position={[sx * 2.2, 1.1, 0]} size={[0.12, 2.2, 0.12]} color="#475569" metal={0.5} />
        ))}
        <SignBand width={4.8} y={2.0} z={0} themeColor={themeColor} highlight={highlight} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Bureaux : immeuble tertiaire vitré + plateau ouvert + parking        */
/* ------------------------------------------------------------------ */

/** Rangée de panneaux photovoltaïques inclinés (longueur selon X). */
function SolarRow({ count, ...rest }) {
  return (
    <group {...rest}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[i * 1.05, 0, 0]}>
          <Box position={[0, 0.3, 0]} rotation={[-0.38, 0, 0]} size={[0.98, 0.04, 0.7]} color="#1e3a8a" metal={0.7} rough={0.18} />
          <Box position={[0, 0.322, 0]} rotation={[-0.38, 0, 0]} size={[0.02, 0.006, 0.7]} color="#94a3b8" metal={0.8} shadow={false} />
          <Box position={[0, 0.15, -0.28]} size={[0.04, 0.3, 0.04]} color="#94a3b8" metal={0.7} />
        </group>
      ))}
    </group>
  );
}

/**
 * Immeuble tertiaire contemporain (R+2) : façade rideau en verre réfléchissant,
 * nez de dalle blancs, brise-soleil bois, noyau en pierre claire portant l'enseigne,
 * toiture végétalisée et panneaux solaires.
 */
function OfficeTower({ width, depth, themeColor, highlight, finish }) {
  const floors = 3;
  const floorH = 2.7;
  const towerH = floors * floorH;
  const towerD = 3.3;
  const towerW = width - 0.4;
  const front = towerD / 2;
  const coreW = 3.0;
  const coreX = -towerW / 2 + towerW * 0.62;
  const coreLeft = coreX - coreW / 2;
  const coreRight = coreX + coreW / 2;
  const f = shellFinish('office', finish);
  const glass = { color: f.glass, metal: 0.9, rough: 0.07 };
  const slab = f.slab;
  const wood = f.fins;

  const mullions = [];
  for (let x = -towerW / 2 + 1.2; x < towerW / 2 - 0.1; x += 1.2) {
    if (x < coreLeft - 0.1 || x > coreRight + 0.1) mullions.push(x);
  }
  const fins = [];
  for (let x = -towerW / 2 + 0.35; x < coreLeft - 0.3; x += 0.55) fins.push(x);
  const solarCount = Math.max(3, Math.floor((towerW / 2 - coreRight - 0.6) / 1.05));

  return (
    <group position={[0, 0, -depth / 2 + 0.2 + towerD / 2]}>
      {/* Volume vitré principal */}
      <Box position={[0, Y0 + towerH / 2, 0]} size={[towerW, towerH, towerD]} {...glass} receive />
      {/* Nez de dalle blancs ceinturant chaque niveau (corniche plus épaisse en tête) */}
      {Array.from({ length: floors + 1 }, (_, fIdx) => (
        <Box
          key={`s${fIdx}`}
          position={[0, Y0 + fIdx * floorH + (fIdx === floors ? 0.05 : 0), 0]}
          size={[towerW + 0.14, fIdx === floors ? 0.42 : 0.24, towerD + 0.14]}
          color={slab}
          rough={0.45}
        />
      ))}
      {/* Lignes d'éclairage des plafonds, visibles à travers le vitrage */}
      {Array.from({ length: floors }, (_, fIdx) => (
        <Box key={`l${fIdx}`} position={[0, Y0 + (fIdx + 1) * floorH - 0.32, front + 0.006]} size={[towerW - 0.3, 0.035, 0.01]} color="#e0f2fe" glow={0.9} shadow={false} />
      ))}
      {/* Meneaux de la façade rideau et des pignons */}
      {mullions.map((x) => (
        <Box key={`m${x}`} position={[x, Y0 + towerH / 2, front + 0.03]} size={[0.05, towerH, 0.06]} color="#cbd5e1" metal={0.7} rough={0.3} />
      ))}
      {[-1, 1].map((sx) =>
        [-0.8, 0.4].map((z) => (
          <Box key={`p${sx}${z}`} position={[sx * (towerW / 2 + 0.03), Y0 + towerH / 2, z]} size={[0.06, towerH, 0.05]} color="#cbd5e1" metal={0.7} rough={0.3} />
        ))
      )}
      {/* Brise-soleil verticaux en bois sur l'aile gauche */}
      {fins.map((x) => (
        <Box key={`b${x}`} position={[x, Y0 + towerH / 2 + 0.1, front + 0.26]} size={[0.07, towerH - 0.3, 0.38]} color={wood} rough={0.7} />
      ))}
      {/* Noyau de circulation en pierre claire, plus haut, avec enseigne */}
      <group position={[coreX, 0, 0.35]}>
        <Box position={[0, Y0 + (towerH + 1.4) / 2, 0]} size={[coreW, towerH + 1.4, towerD + 0.7]} map={getTexture('concrete', coreW / 2.5, (towerH + 1.4) / 2.5)} color={f.core} rough={0.75} />
        <Box position={[-0.7, Y0 + towerH / 2, towerD / 2 + 0.36]} size={[0.45, towerH - 0.8, 0.02]} {...glass} />
        <Box position={[0.75, Y0 + 1.1, towerD / 2 + 0.36]} size={[1.0, 2.0, 0.02]} {...glass} />
        <SignBand width={coreW - 0.5} y={Y0 + towerH + 0.75} z={towerD / 2 + 0.42} themeColor={themeColor} highlight={highlight} />
        <Cylinder position={[0.9, Y0 + towerH + 2.0, -0.6]} radius={0.035} height={1.2} color="#94a3b8" metal={0.7} />
        <Ball position={[0.9, Y0 + towerH + 2.62, -0.6]} radius={0.06} color="#ef4444" glow={2} shadow={false} />
      </group>
      {/* Toiture : acrotère, toiture végétalisée, panneaux solaires, centrale de traitement d'air */}
      <group position={[0, Y0 + towerH + 0.26, 0]}>
        <Box position={[(-towerW / 2 + coreLeft) / 2, 0.05, 0]} size={[coreLeft + towerW / 2 - 0.5, 0.1, towerD - 0.5]} map={getTexture('grass', 4, 1.2)} color="#a3e635" rough={0.95} />
        {[-1.5, -0.5].map((k) => (
          <Ball key={k} position={[-towerW / 2 + (coreLeft + towerW / 2) * (0.5 + k * 0.2), 0.18, 0.3 * k]} scale={[0.9, 0.3, 0.6]} shape="dodeca" color="#4d7c0f" flat />
        ))}
        <SolarRow count={solarCount} position={[coreRight + 0.8, 0, 0.55]} />
        <SolarRow count={solarCount} position={[coreRight + 0.8, 0, -0.65]} />
        <group position={[coreLeft - 1.2, 0, -0.6]}>
          <Box position={[0, 0.35, 0]} size={[1.4, 0.6, 0.9]} color="#d1d5db" metal={0.4} rough={0.4} />
          <Cylinder position={[0.3, 0.68, 0]} radius={0.28} height={0.06} color="#475569" />
        </group>
      </group>
    </group>
  );
}

function OfficeShell({ width, height, depth, themeColor, outward = [1, 1], showRoof, highlight, finish }) {
  const facadeZ = -depth / 2 + 3.5;
  const [ox] = outward;
  const doorZ = getBuildingDoorZ(depth);
  const doorWidth = 2.0;

  const parkingX = ox * (width / 2 + 3.4);
  const carSlots = Math.max(3, Math.floor((depth - 1) / 1.75));
  const carColors = ['#2563eb', '#e5e7eb', '#dc2626', '#334155', '#16a34a', '#f59e0b', '#94a3b8'];

  return (
    <group>
      {/* Immeuble de bureaux (R+2) au fond du plateau */}
      <OfficeTower width={width} depth={depth} themeColor={themeColor} highlight={highlight} finish={finish} />

      {/* Plateau ouvert : poteaux blancs, rives et parois vitrées latérales */}
      <StructuralFrame
        width={width}
        depth={depth}
        height={height}
        color="#e2e8f0"
        sideDoorSide={-ox}
        sideDoorZ={doorZ}
      />
      {[-1, 1].map((sx) => {
        const zStart = facadeZ + 0.15;
        const zEnd = depth / 2 - 0.15;
        if (sx === -ox) {
          // Découpe de la paroi vitrée côté voirie centrale pour la porte piétonne latérale
          const seg1End = doorZ - doorWidth / 2;
          const seg2Start = doorZ + doorWidth / 2;
          const len1 = Math.max(0, seg1End - zStart);
          const len2 = Math.max(0, zEnd - seg2Start);
          return (
            <group key={sx}>
              {len1 > 0.2 && (
                <>
                  <Box position={[sx * (width / 2 - 0.12), Y0 + height / 2, (zStart + seg1End) / 2]} size={[0.04, height - 0.4, len1]} color="#bae6fd" opacity={0.12} metal={0.6} rough={0.1} shadow={false} />
                  <Box position={[sx * (width / 2 - 0.12), Y0 + 1.0, (zStart + seg1End) / 2]} size={[0.06, 0.06, len1]} color="#e2e8f0" shadow={false} />
                </>
              )}
              {len2 > 0.2 && (
                <>
                  <Box position={[sx * (width / 2 - 0.12), Y0 + height / 2, (seg2Start + zEnd) / 2]} size={[0.04, height - 0.4, len2]} color="#bae6fd" opacity={0.12} metal={0.6} rough={0.1} shadow={false} />
                  <Box position={[sx * (width / 2 - 0.12), Y0 + 1.0, (seg2Start + zEnd) / 2]} size={[0.06, 0.06, len2]} color="#e2e8f0" shadow={false} />
                </>
              )}
            </group>
          );
        }
        return (
          <group key={sx}>
            <Box position={[sx * (width / 2 - 0.12), Y0 + height / 2, (facadeZ + depth / 2) / 2]} size={[0.04, height - 0.4, depth / 2 - facadeZ - 0.3]} color="#bae6fd" opacity={0.12} metal={0.6} rough={0.1} shadow={false} />
            <Box position={[sx * (width / 2 - 0.12), Y0 + 1.0, (facadeZ + depth / 2) / 2]} size={[0.06, 0.06, depth / 2 - facadeZ - 0.3]} color="#e2e8f0" shadow={false} />
          </group>
        );
      })}

      {/* Porte piétonne latérale côté allée centrale */}
      <IndustrialDoorway
        position={[-ox * (width / 2 - 0.12), Y0, doorZ]}
        rotation={[0, (-ox * Math.PI) / 2, 0]}
        width={doorWidth}
        themeColor={themeColor}
      />

      {/* Entrée principale Sud : auvent, portes vitrées coulissantes ouvertes, bloc BAES et jardinières */}
      <group position={[0, 0, depth / 2]}>
        <Box position={[0, Y0 + 2.4, 0.3]} size={[4.2, 0.14, 1.0]} color="#e2e8f0" rough={0.5} />
        <Box position={[0, Y0 + 2.48, 0.3]} size={[4.0, 0.02, 0.85]} color={themeColor} glow={0.35} shadow={false} />
        {[-1.9, 1.9].map((x) => (
          <Box key={x} position={[x, Y0 + 1.2, 0.7]} size={[0.1, 2.4, 0.1]} color="#e2e8f0" metal={0.5} />
        ))}
        {/* Dormant de la porte automatique et vantaux vitrés coulissés (ouverture centrale libre de 1,8 u) */}
        {[-0.95, 0.95].map((x) => (
          <Box key={`frame-${x}`} position={[x, Y0 + 1.1, -0.22]} size={[0.1, 2.2, 0.14]} color="#334155" metal={0.6} />
        ))}
        <Box position={[0, Y0 + 2.22, -0.22]} size={[3.4, 0.16, 0.18]} color="#334155" metal={0.6} />
        {/* Bloc lumineux BAES « SORTIE / ACCUEIL » au-dessus des portes coulissantes */}
        <Box position={[0, Y0 + 2.08, -0.11]} size={[0.52, 0.16, 0.04]} color="#16a34a" glow={1.5} shadow={false} />
        {[-1.35, 1.35].map((x) => (
          <group key={`glass-leaf-${x}`} position={[x, Y0 + 1.05, -0.25]} userData={{ noCollide: true }}>
            <Box size={[0.85, 2.1, 0.04]} color="#bae6fd" opacity={0.38} metal={0.6} rough={0.1} shadow={false} />
            <Box position={[0, 0, 0]} size={[0.87, 0.06, 0.05]} color="#e2e8f0" shadow={false} />
          </group>
        ))}
        {[-2.8, 2.8].map((x) => (
          <group key={x} position={[x, Y0, 0.42]}>
            <Box position={[0, 0.25, 0]} size={[1.2, 0.5, 0.5]} color="#9ca3af" rough={0.8} />
            <Ball position={[0, 0.65, 0]} scale={[1.1, 0.45, 0.42]} shape="dodeca" color="#16a34a" flat />
          </group>
        ))}
      </group>
      {showRoof && (
        <Box position={[0, Y0 + height + 0.1, (facadeZ + depth / 2) / 2]} size={[width + 0.3, 0.2, depth / 2 - facadeZ + 0.2]} color="#e2e8f0" opacity={0.55} shadow={false} />
      )}

      {/* Parking du personnel côté extérieur */}
      <group position={[parkingX, 0, 0]}>
        <Box position={[0, 0.012, 0]} size={[5.4, 0.024, depth]} map={getTexture('asphalt', 5.4 / 4, depth / 4)} rough={0.95} shadow={false} receive />
        {Array.from({ length: carSlots + 1 }, (_, i) => (
          <Box key={`l${i}`} position={[ox * 0.4, 0.03, -depth / 2 + 0.5 + i * 1.75]} size={[3.2, 0.006, 0.06]} color="#f8fafc" shadow={false} />
        ))}
        {Array.from({ length: carSlots }, (_, i) =>
          seeded(i * 3 + 1) > 0.3 ? (
            <Car
              key={`c${i}`}
              position={[ox * 0.4, 0.024, -depth / 2 + 1.375 + i * 1.75]}
              rotation={[0, ox > 0 ? Math.PI : 0, 0]}
              scale={[0.95, 0.95, 0.95]}
              color={carColors[i % carColors.length]}
            />
          ) : null
        )}
        {[-depth / 2 + 0.6, depth / 2 - 0.6].map((z) => (
          <Tree key={z} position={[-ox * 2.4, 0, z]} size={1.1} />
        ))}
        <SafetySign kind="firstaid" position={[-ox * 2.3, 0, 0]} height={1.6} size={0.5} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Usine de production : sheds, pont roulant, cheminée, silo            */
/* ------------------------------------------------------------------ */

function OverheadCrane({ width, depth, height }) {
  const bridgeRef = useRef();
  const trolleyRef = useRef();
  const span = width - 0.8;
  // Course limitée à la moitié arrière du hall : le pont ne masque jamais un poste ciblé par la caméra
  const zMin = -depth / 2 + 1.6;
  const zMax = 0;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (bridgeRef.current) bridgeRef.current.position.z = zMin + ((Math.sin(t * 0.12) + 1) / 2) * (zMax - zMin);
    if (trolleyRef.current) trolleyRef.current.position.x = Math.sin(t * 0.21 + 1) * (span / 2 - 1.2);
  });
  const railY = Y0 + height - 0.65;
  return (
    <group>
      {[-1, 1].map((sx) => (
        <Box key={sx} position={[sx * (width / 2 - 0.55), railY, 0]} size={[0.22, 0.28, depth - 0.6]} color="#475569" metal={0.6} rough={0.4} />
      ))}
      <group ref={bridgeRef} userData={DYNAMIC} position={[0, railY + 0.3, 0]}>
        <Box size={[span, 0.36, 0.3]} color={PALETTE.safetyYellow} metal={0.35} rough={0.45} />
        <Box position={[0, 0, 0.45]} size={[span, 0.36, 0.3]} color={PALETTE.safetyYellow} metal={0.35} rough={0.45} />
        {[-1, 1].map((sx) => (
          <group key={sx} position={[sx * (span / 2 - 0.25), -0.12, 0.22]}>
            <Box size={[0.5, 0.3, 1.0]} color="#ca8a04" metal={0.35} />
            <HazardBar position={[0, 0, 0.52]} length={0.5} segments={4} height={0.28} thickness={0.03} />
          </group>
        ))}
        <group ref={trolleyRef} userData={DYNAMIC} position={[0, 0.3, 0.22]}>
          <Box size={[0.8, 0.3, 0.9]} color="#ea580c" metal={0.35} />
          <Cylinder position={[0, -0.95, 0]} radius={0.015} height={1.6} color="#1f2937" />
          <Box position={[0, -1.82, 0]} size={[0.18, 0.18, 0.12]} color={PALETTE.safetyYellow} />
          <Cylinder position={[0, -1.97, 0]} rotation={[Math.PI / 2, 0, 0]} radius={0.06} height={0.03} color="#1f2937" />
        </group>
      </group>
    </group>
  );
}

function FactoryShell({ width, height, depth, themeColor, outward = [1, 1], showRoof, highlight, finish }) {
  const f = shellFinish('factory', finish);
  const wallMat = { map: getTexture(f.wall.map, 0.75, 0.75), color: f.wall.color };
  const teeth = Math.max(3, Math.round(width / 3.4));
  const toothW = width / teeth;
  const toothH = 1.4;
  const [ox] = outward;
  const doorZ = getBuildingDoorZ(depth);
  const doorWidth = 2.0;

  const wallProfile = useMemo(() => {
    const pts = [[-width / 2, 0], [width / 2, 0], [width / 2, height]];
    for (let i = teeth - 1; i >= 0; i -= 1) {
      const x0 = -width / 2 + i * toothW;
      pts.push([x0, height + toothH], [x0, height]);
    }
    return pts;
  }, [width, height, teeth, toothW]);

  const toothXs = Array.from({ length: teeth }, (_, i) => -width / 2 + i * toothW);

  return (
    <group>
      {/* Mur pignon du fond en brique, profil en sheds */}
      <Profile points={wallProfile} depth={0.3} position={[0, Y0, -depth / 2 + 0.15]} {...wallMat} rough={0.9} />
      {/* Verrières des sheds (faces verticales) */}
      {toothXs.map((x0) => (
        <Box key={`v${x0}`} position={[x0 + 0.08, Y0 + height + toothH / 2, -depth / 2 + 0.33]} size={[0.06, toothH - 0.15, 0.04]} color="#93c5fd" glow={0.25} metal={0.6} rough={0.2} shadow={false} />
      ))}
      {/* Bandeau de fenêtres hautes */}
      {Array.from({ length: Math.floor(width / 2.2) }, (_, i) => (
        <Box key={`w${i}`} position={[-width / 2 + 1.3 + i * 2.2, Y0 + height - 1.0, -depth / 2 + 0.32]} size={[1.5, 0.9, 0.04]} color="#1e3a5f" metal={0.8} rough={0.15} />
      ))}
      {/* Porte sectionnelle */}
      <group position={[ox * (width / 2 - 2.4), Y0, -depth / 2 + 0.32]}>
        <Box position={[0, 1.6, 0]} size={[2.6, 3.2, 0.04]} color="#9ca3af" metal={0.5} rough={0.4} />
        {Array.from({ length: 8 }, (_, i) => (
          <Box key={i} position={[0, 0.2 + i * 0.4, 0.025]} size={[2.6, 0.03, 0.01]} color="#6b7280" shadow={false} />
        ))}
        <HazardBar position={[0, 3.3, 0.04]} length={2.8} segments={10} height={0.12} thickness={0.04} />
      </group>
      <SignBand width={Math.min(9, width * 0.5)} y={Y0 + height - 0.3} z={-depth / 2 + 0.45} themeColor={themeColor} highlight={highlight} />
      <WallFixtures width={width} depth={depth} side={-ox} />

      {/* Charpente : poteaux et rives ; toiture en sheds uniquement si le toit est affiché */}
      <StructuralFrame
        width={width}
        depth={depth}
        height={height}
        color="#475569"
        sideDoorSide={-ox}
        sideDoorZ={doorZ}
      />
      {showRoof &&
        toothXs.map((x0) => {
          const len = Math.hypot(toothW, toothH);
          const angle = Math.atan2(-toothH, toothW);
          return (
            <group key={`t${x0}`}>
              <Box position={[x0 + toothW / 2, Y0 + height + toothH / 2, 0]} rotation={[0, 0, angle]} size={[len, 0.08, depth - 0.3]} color="#64748b" opacity={0.6} shadow={false} />
              <Box position={[x0 + 0.05, Y0 + height + toothH / 2, 0]} size={[0.04, toothH, depth - 0.3]} color="#93c5fd" opacity={0.35} shadow={false} />
            </group>
          );
        })}
      <LowSideWall side={-ox} width={width} depth={depth} height={1.4} color={f.lowWall} doorZ={doorZ} doorWidth={doorWidth} />
      <LowSideWall side={ox} width={width} depth={depth} height={1.4} color={f.lowWall} />

      {/* Porte piétonne latérale (côté allée centrale) & Porte piétonne principale Sud */}
      <IndustrialDoorway
        position={[-ox * (width / 2 - 0.08), Y0, doorZ]}
        rotation={[0, (-ox * Math.PI) / 2, 0]}
        width={doorWidth}
        themeColor={themeColor}
      />
      <IndustrialDoorway
        position={[0, Y0, depth / 2 - 0.12]}
        width={2.1}
        themeColor={themeColor}
        doubleLeaf
        withGuardrails
        guardrailSpan={3.2}
      />

      <OverheadCrane width={width} depth={depth} height={height} />

      {/* Cheminée en brique et silo côté extérieur */}
      <group position={[ox * (width / 2 + 1.0), 0, -depth / 2 + 1.3]}>
        <Cylinder position={[0, 5.5, 0]} radius={0.6} height={11} top={0.7} segments={20} map={f.chimney.map ? getTexture(f.chimney.map, 3, 9) : null} color={f.chimney.color} metal={f.chimney.metal} rough={0.9} />
        <Cylinder position={[0, 9.5, 0]} radius={0.46} height={0.35} segments={20} color="#1f2937" />
        <Cylinder position={[0, 10.9, 0]} radius={0.45} height={0.25} segments={20} color="#1f2937" />
        <Cylinder position={[0, 0.25, 0]} radius={0.8} height={0.5} segments={20} color="#6b7280" rough={0.9} />
        <SmokePlume position={[0, 11.2, 0]} />
      </group>
      <group position={[ox * (width / 2 + 1.4), 0, -depth / 2 + 4.0]}>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
          <Box key={`${sx}${sz}`} position={[sx * 0.55, 1.0, sz * 0.55]} size={[0.12, 2.0, 0.12]} color="#475569" metal={0.6} />
        ))}
        <Cylinder position={[0, 1.6, 0]} rotation={[Math.PI, 0, 0]} radius={0.85} height={1.2} top={0.2} segments={20} color="#cbd5e1" metal={0.5} rough={0.35} />
        <Cylinder position={[0, 3.6, 0]} radius={0.85} height={2.8} segments={20} color="#cbd5e1" metal={0.5} rough={0.35} />
        <Cylinder position={[0, 5.05, 0]} radius={0.87} height={0.12} segments={20} color={themeColor} glow={0.2} />
        <Box position={[0.88, 3.2, 0]} size={[0.04, 3.6, 0.3]} color="#475569" metal={0.6} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Atelier peinture / chimie : panneaux sandwich, extraction, cuves     */
/* ------------------------------------------------------------------ */

function PaintShell({ width, height, depth, themeColor, outward = [1, 1], showRoof, highlight, finish }) {
  const f = shellFinish('paint', finish);
  const [ox] = outward;
  const roofD = 2.4;
  const roofZ = -depth / 2 + roofD / 2 + 0.1;
  const stacks = Math.max(2, Math.round(width / 6));
  const doorZ = getBuildingDoorZ(depth);
  const doorWidth = 2.0;
  const zMin = -depth / 2 + 0.2;
  const zMax = depth / 2 - 0.2;
  const seg1End = doorZ - doorWidth / 2;
  const seg2Start = doorZ + doorWidth / 2;
  const len1 = Math.max(0, seg1End - zMin);
  const len2 = Math.max(0, zMax - seg2Start);

  return (
    <group>
      {/* Mur du fond en panneaux sandwich */}
      <Box position={[0, Y0 + height / 2, -depth / 2 + 0.15]} size={[width, height, 0.3]} map={getTexture('panel', width / 1.2, 1)} color={f.wall} rough={0.5} receive />
      <SignBand width={Math.min(8, width * 0.45)} y={Y0 + height - 0.4} z={-depth / 2 + 0.45} themeColor={themeColor} highlight={highlight} />
      <WallFixtures width={width} depth={depth} side={ox} />
      {/* Panneau ATEX sur le mur du fond */}
      <group position={[-ox * (width / 2 - 1.4), Y0 + 2.6, -depth / 2 + 0.32]}>
        <Box rotation={[0, 0, Math.PI / 4]} size={[0.75, 0.75, 0.02]} color={PALETTE.safetyBlack} />
        <Box position={[0, 0, 0.012]} rotation={[0, 0, Math.PI / 4]} size={[0.65, 0.65, 0.01]} color={PALETTE.safetyYellow} shadow={false} />
      </group>
      {/* Bande de toiture technique au-dessus du fond */}
      <Box position={[0, Y0 + height + 0.06, roofZ]} size={[width, 0.12, roofD]} color="#9ca3af" rough={0.6} />
      <Box position={[0, Y0 + height + 0.45, roofZ + 0.5]} size={[width - 2, 0.55, 0.55]} color="#e5e7eb" metal={0.5} rough={0.35} />
      {Array.from({ length: stacks }, (_, i) => {
        const x = -width / 2 + ((i + 0.5) * width) / stacks;
        return (
          <group key={i} position={[x, Y0 + height, roofZ - 0.4]}>
            <Cylinder position={[0, 1.6, 0]} radius={0.32} height={3.2} color="#cbd5e1" metal={0.6} rough={0.3} />
            <Cylinder position={[0, 3.45, 0]} radius={0.55} height={0.4} top={0} color="#94a3b8" metal={0.6} />
            <Cylinder position={[0, 2.6, 0]} radius={0.34} height={0.15} color={themeColor} glow={0.3} />
          </group>
        );
      })}
      <RoofFan position={[-width / 2 + 2.2, Y0 + height + 0.12, roofZ + 0.4]} />
      <RoofFan position={[width / 2 - 2.2, Y0 + height + 0.12, roofZ + 0.4]} speed={5} />
      {/* Ossature, murets latéraux avec couvertine zébrée (découpé côté porte latérale) */}
      <StructuralFrame
        width={width}
        depth={depth}
        height={height}
        color="#64748b"
        sideDoorSide={-ox}
        sideDoorZ={doorZ}
      />
      {/* Côté extérieur plein */}
      <group>
        <Box position={[ox * (width / 2 - 0.1), Y0 + 0.6, 0]} size={[0.2, 1.2, depth - 0.4]} color={f.muret} rough={0.5} />
        <HazardBar position={[ox * (width / 2 - 0.1), Y0 + 1.25, 0]} axis="z" length={depth - 0.4} segments={Math.round(depth * 1.5)} thickness={0.22} height={0.1} />
      </group>
      {/* Côté intérieur découpé autour de la porte piétonne */}
      <group>
        {len1 > 0.2 && (
          <>
            <Box position={[-ox * (width / 2 - 0.1), Y0 + 0.6, (zMin + seg1End) / 2]} size={[0.2, 1.2, len1]} color={f.muret} rough={0.5} />
            <HazardBar position={[-ox * (width / 2 - 0.1), Y0 + 1.25, (zMin + seg1End) / 2]} axis="z" length={len1} segments={Math.max(4, Math.round(len1 * 1.5))} thickness={0.22} height={0.1} />
          </>
        )}
        {len2 > 0.2 && (
          <>
            <Box position={[-ox * (width / 2 - 0.1), Y0 + 0.6, (seg2Start + zMax) / 2]} size={[0.2, 1.2, len2]} color={f.muret} rough={0.5} />
            <HazardBar position={[-ox * (width / 2 - 0.1), Y0 + 1.25, (seg2Start + zMax) / 2]} axis="z" length={len2} segments={Math.max(4, Math.round(len2 * 1.5))} thickness={0.22} height={0.1} />
          </>
        )}
      </group>

      {/* Porte piétonne latérale (côté allée centrale) & Porte piétonne principale Sud */}
      <IndustrialDoorway
        position={[-ox * (width / 2 - 0.1), Y0, doorZ]}
        rotation={[0, (-ox * Math.PI) / 2, 0]}
        width={doorWidth}
        themeColor={themeColor}
      />
      <IndustrialDoorway
        position={[0, Y0, depth / 2 - 0.12]}
        width={2.1}
        themeColor={themeColor}
        doubleLeaf
        withGuardrails
        guardrailSpan={3.2}
      />

      {showRoof && <Box position={[0, Y0 + height + 0.1, 0]} size={[width + 0.3, 0.2, depth + 0.3]} color="#e5e7eb" opacity={0.5} shadow={false} />}

      {/* Cuves extérieures sur rétention + poteau incendie */}
      <group position={[ox * (width / 2 + 2.3), 0, -depth / 2 + 3.0]}>
        <Box position={[0, 0.05, 0]} size={[3.0, 0.1, 4.6]} color="#6b7280" rough={0.95} receive />
        {[[-1.5, 0], [1.5, 0]].map(([x]) => (
          <Box key={x} position={[x, 0.3, 0]} size={[0.1, 0.5, 4.6]} color="#9ca3af" />
        ))}
        {[-2.3, 2.3].map((z) => (
          <Box key={z} position={[0, 0.3, z]} size={[3.0, 0.5, 0.1]} color="#9ca3af" />
        ))}
        {[-1.1, 1.1].map((z, i) => (
          <group key={z} position={[0, 0, z]}>
            <Cylinder position={[0, 1.9, 0]} radius={0.8} height={3.6} segments={24} color="#f1f5f9" rough={0.35} metal={0.2} />
            <Ball position={[0, 3.7, 0]} scale={[1.6, 0.4, 1.6]} color="#f1f5f9" rough={0.35} />
            <Cylinder position={[0, 2.6, 0]} radius={0.81} height={0.18} segments={24} color={i ? PALETTE.safetyYellow : '#f97316'} />
            <Box position={[0.82, 1.9, 0]} size={[0.04, 3.6, 0.3]} color="#475569" metal={0.6} />
          </group>
        ))}
      </group>
      <group position={[ox * (width / 2 + 0.8), 0, depth / 2 - 1.5]}>
        <Cylinder position={[0, 0.45, 0]} radius={0.16} height={0.9} color={PALETTE.fireRed} metal={0.3} rough={0.4} />
        <Ball position={[0, 0.92, 0]} radius={0.16} color={PALETTE.fireRed} />
        <Cylinder position={[0.18, 0.6, 0]} rotation={[0, 0, Math.PI / 2]} radius={0.06} height={0.14} color={PALETTE.fireRed} />
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Entrepôt logistique : bardage, racks grande hauteur, quais, camion   */
/* ------------------------------------------------------------------ */

function DockDoor({ open = false, ...rest }) {
  return (
    <group {...rest}>
      {/* Sas d'étanchéité (repère local : façade vers +Z) */}
      <Box position={[0, 1.55, 0.18]} size={[2.5, 0.35, 0.36]} color="#111827" />
      {[-1.1, 1.1].map((x) => (
        <Box key={x} position={[x, 0.9, 0.18]} size={[0.3, 1.8, 0.36]} color="#111827" />
      ))}
      {open ? (
        <Box position={[0, 0.9, 0.02]} size={[1.9, 1.7, 0.02]} color="#0b1120" />
      ) : (
        <>
          <Box position={[0, 0.9, 0.02]} size={[1.9, 1.7, 0.03]} color="#cbd5e1" metal={0.5} rough={0.4} />
          {Array.from({ length: 6 }, (_, i) => (
            <Box key={i} position={[0, 0.2 + i * 0.28, 0.04]} size={[1.9, 0.02, 0.01]} color="#94a3b8" shadow={false} />
          ))}
        </>
      )}
      {/* Niveleur et butoirs */}
      <Box position={[0, -0.1, 0.3]} size={[1.9, 0.08, 0.5]} color="#475569" metal={0.5} />
      {[-0.75, 0.75].map((x) => (
        <Box key={x} position={[x, -0.35, 0.12]} size={[0.25, 0.3, 0.2]} color="#111827" />
      ))}
      <Box position={[0.55, 1.95, 0.05]} size={[0.25, 0.12, 0.08]} color={open ? '#22c55e' : '#ef4444'} glow={1.6} shadow={false} />
    </group>
  );
}

function SemiTrailerTruck({ color = '#f8fafc', stripe = '#0891b2', ...rest }) {
  // Remorque à quai : arrière en x = 0, cabine vers +X
  const L = 6.0;
  return (
    <group {...rest}>
      <Box position={[L / 2, 1.45, 0]} size={[L, 1.9, 1.65]} color={color} rough={0.45} />
      <Box position={[L / 2, 1.0, 0.83]} size={[L - 0.6, 0.25, 0.01]} color={stripe} glow={0.15} shadow={false} />
      <Box position={[L / 2, 1.0, -0.83]} size={[L - 0.6, 0.25, 0.01]} color={stripe} glow={0.15} shadow={false} />
      <Box position={[L / 2, 0.42, 0]} size={[L - 0.2, 0.16, 1.2]} color="#1f2937" />
      {[0.9, 1.5, 2.1].map((x) =>
        [-0.62, 0.62].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.3, z]} radius={0.3} width={0.24} />)
      )}
      {/* Tracteur */}
      <group position={[L + 0.1, 0, 0]}>
        <Box position={[0.7, 0.45, 0]} size={[1.9, 0.3, 1.2]} color="#1f2937" />
        <Box position={[1.15, 1.3, 0]} size={[1.0, 1.5, 1.7]} color="#dc2626" metal={0.4} rough={0.35} />
        <Box position={[1.66, 1.6, 0]} size={[0.02, 0.6, 1.5]} color="#0b1220" metal={0.85} rough={0.12} />
        <Box position={[1.66, 0.75, 0]} size={[0.04, 0.3, 1.4]} color="#94a3b8" metal={0.7} />
        <Box position={[1.67, 0.75, 0.6]} size={[0.02, 0.12, 0.2]} color="#fef9c3" glow={1.4} shadow={false} />
        <Box position={[1.67, 0.75, -0.6]} size={[0.02, 0.12, 0.2]} color="#fef9c3" glow={1.4} shadow={false} />
        {[0.3, 1.25].map((x) =>
          [-0.68, 0.68].map((z) => <Wheel key={`${x}${z}`} position={[x, 0.32, z]} radius={0.32} width={0.25} />)
        )}
      </group>
    </group>
  );
}

function WarehouseShell({ width, height, depth, themeColor, outward = [1, 1], showRoof, highlight, finish }) {
  const [ox] = outward;
  const cladding = shellFinish('logistics', finish).cladding;
  const rackBays = Math.max(4, Math.floor((width - 1.4) / 1.15));
  const docks = Math.max(2, Math.min(4, Math.floor((depth - 2) / 3)));
  const dockZs = Array.from({ length: docks }, (_, i) => -depth / 2 + 2.2 + (i * (depth - 4.4)) / Math.max(1, docks - 1));
  const truckDock = Math.floor(docks / 2);
  const doorZ = getBuildingDoorZ(depth);
  const doorWidth = 2.0;

  return (
    <group>
      {/* Mur du fond en bardage ondulé */}
      <Corrugated position={[0, Y0 + height / 2, -depth / 2 + 0.12]} rotation={[0, Math.PI, 0]} size={[width - 0.1, height, 0.08]} waves={Math.round(width * 3)} color={cladding} />
      <Box position={[0, Y0 + height / 2, -depth / 2 + 0.2]} size={[width - 0.1, height, 0.06]} color="#475569" rough={0.7} />
      <SignBand width={Math.min(8, width * 0.45)} y={Y0 + height - 0.3} z={-depth / 2 + 0.4} themeColor={themeColor} highlight={highlight} />
      {/* Racks grande hauteur le long du mur du fond */}
      <PalletRack position={[0, Y0, -depth / 2 + 1.0]} bays={rackBays} bayWidth={1.15} levels={4} levelHeight={0.95} depth={0.9} seed={21} simple />

      {/* Façade de quais côté extérieur, toute hauteur */}
      <group position={[ox * (width / 2 - 0.12), 0, 0]} rotation={[0, (ox * Math.PI) / 2, 0]}>
        <Corrugated position={[0, Y0 + height / 2, 0]} size={[depth - 0.3, height, 0.08]} waves={Math.round(depth * 3)} color={cladding} />
        {/* Après rotation, l'axe X local suit -Z (côté droit) ou +Z (côté gauche) */}
        {dockZs.map((z, i) => (
          <DockDoor key={z} position={[-ox * z, Y0 + 0.6, 0.06]} open={i === truckDock} />
        ))}
        <Box position={[0, Y0 + 0.3, 0.6]} size={[depth - 0.3, 0.6, 1.2]} color="#9ca3af" rough={0.9} />
        <HazardBar position={[0, Y0 + 0.62, 1.2]} length={depth - 0.3} segments={Math.round(depth * 1.5)} height={0.04} thickness={0.08} />
      </group>
      <LowSideWall side={-ox} width={width} depth={depth} height={1.2} color={cladding} doorZ={doorZ} doorWidth={doorWidth} />
      <StructuralFrame
        width={width}
        depth={depth}
        height={height}
        color="#475569"
        sideDoorSide={-ox}
        sideDoorZ={doorZ}
      />

      {/* Porte piétonne latérale (côté allée centrale) & Porte piétonne principale Sud */}
      <IndustrialDoorway
        position={[-ox * (width / 2 - 0.08), Y0, doorZ]}
        rotation={[0, (-ox * Math.PI) / 2, 0]}
        width={doorWidth}
        themeColor={themeColor}
      />
      <IndustrialDoorway
        position={[0, Y0, depth / 2 - 0.12]}
        width={2.1}
        themeColor={themeColor}
        doubleLeaf
        withGuardrails
        guardrailSpan={3.2}
      />

      {showRoof && (
        <Box position={[0, Y0 + height + 0.1, 0]} size={[width + 0.3, 0.2, depth + 0.3]} color="#94a3b8" opacity={0.5} shadow={false} />
      )}

      {/* Semi-remorque à quai + marquage et potelets */}
      <SemiTrailerTruck
        position={[ox * (width / 2 + 1.25), 0, dockZs[truckDock]]}
        rotation={[0, ox > 0 ? 0 : Math.PI, 0]}
      />
      {dockZs.map((z) => (
        <group key={`b${z}`}>
          <Bollard position={[ox * (width / 2 + 1.5), 0, z - 1.35]} height={0.9} />
          <Bollard position={[ox * (width / 2 + 1.5), 0, z + 1.35]} height={0.9} />
          <Box position={[ox * (width / 2 + 4.5), 0.012, z - 1.35]} size={[6, 0.006, 0.08]} color="#f8fafc" shadow={false} />
          <Box position={[ox * (width / 2 + 4.5), 0.012, z + 1.35]} size={[6, 0.006, 0.08]} color="#f8fafc" shadow={false} />
        </group>
      ))}
    </group>
  );
}
