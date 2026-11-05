import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Ball, DYNAMIC, seeded } from './kit';
import { canvasTexture } from './civicProps';
import { Person } from './people';

/**
 * Équipement des services techniques et de l'école pour l'éditeur de site : établi et panneau à outils,
 * piles de pneus, stock de cônes et de barrières de chantier, vestiaires, coin café, tondeuse autoportée,
 * râtelier d'outils de jardin, palette de sacs de terreau, enfants qui déjeunent à la cantine (animés).
 * Origine au sol, face à +Z (dos au mur côté −Z), 1 unité ≈ 1,5 m.
 */

const STEEL = '#8d969e';
const IRON = '#2b3138';
const WOOD = '#a57a4f';

/** Panneau perforé : silhouettes d'outils peintes (clés, marteaux, tournevis, scie, pinces). */
const pegboard = () =>
  canvasTexture('panneau-outils', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c9b48f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(70,55,35,0.35)';
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) ctx.fillRect(x, y, 3, 3);
    const tool = (x, y, l, wdt, color, angle = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.fillRect(-wdt / 2, 0, wdt, l);
      ctx.restore();
    };
    for (let k = 0; k < 7; k += 1) tool(30 + k * 16, 30, 70 + k * 6, 7, '#7c858d');
    for (let k = 0; k < 3; k += 1) {
      tool(170 + k * 34, 40, 90, 8, '#6b4a2a');
      ctx.fillStyle = '#3a3f45';
      ctx.fillRect(158 + k * 34, 34, 24, 14);
    }
    for (let k = 0; k < 6; k += 1) {
      tool(290 + k * 14, 36, 60, 6, ['#c8323a', '#e8c547', '#3d7cc9'][k % 3]);
      tool(290 + k * 14, 96, 30, 3, '#9aa2aa');
    }
    ctx.fillStyle = '#9aa2aa';
    ctx.beginPath();
    ctx.moveTo(390, 40);
    ctx.lineTo(490, 40);
    ctx.lineTo(490, 70);
    ctx.lineTo(390, 60);
    ctx.fill();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(470, 40, 26, 34);
    for (let k = 0; k < 4; k += 1) tool(400 + k * 22, 120, 60, 6, '#c8323a', 0.15);
    ctx.fillStyle = 'rgba(40,30,20,0.6)';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.fillText('CHAQUE OUTIL À SA PLACE', 24, h - 14);
  });

/** Établi de mécanicien (plateau bois, étau, caisse à outils rouge, perceuse) et panneau à outils au mur. */
export function ToolWall({ length = 2.4 }) {
  return (
    <group>
      <Box size={[length, 1.1, 0.04]} position={[0, 1.45, -0.32]} map={pegboard()} rough={0.8} />
      <Box size={[length + 0.06, 0.06, 0.62]} position={[0, 0.62, 0]} color={WOOD} rough={0.7} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.06, 0.6, 0.55]} position={[s * (length / 2 - 0.08), 0.3, 0]} color={IRON} metal={0.5} rough={0.45} />
      ))}
      <Box size={[length - 0.2, 0.04, 0.5]} position={[0, 0.16, 0]} color={IRON} metal={0.5} rough={0.45} />
      {/* Étau, caisse à outils, perceuse, chiffon */}
      <group position={[-length / 2 + 0.35, 0.65, 0.18]}>
        <Box size={[0.2, 0.08, 0.12]} position={[0, 0.04, 0]} color="#3d5a8c" metal={0.5} rough={0.4} />
        <Box size={[0.06, 0.1, 0.16]} position={[0.06, 0.12, 0]} color="#3d5a8c" metal={0.5} rough={0.4} />
        <Cylinder position={[0, 0.12, 0.12]} rotation={[Math.PI / 2, 0, 0]} radius={0.012} height={0.18} color={STEEL} metal={0.7} rough={0.3} />
      </group>
      <Box size={[0.42, 0.22, 0.24]} position={[length / 2 - 0.4, 0.76, -0.05]} color="#b3262c" metal={0.4} rough={0.4} />
      <Box size={[0.42, 0.02, 0.24]} position={[length / 2 - 0.4, 0.88, -0.05]} color="#8c1d22" metal={0.4} rough={0.4} />
      <group position={[0.1, 0.66, 0.08]} rotation={[0, 0.6, 0]}>
        <Box size={[0.2, 0.06, 0.06]} position={[0, 0.05, 0]} color="#e0a526" rough={0.5} />
        <Box size={[0.05, 0.12, 0.05]} position={[-0.05, 0.0, 0]} color="#2b2b2b" rough={0.6} />
      </group>
      <Box size={[0.22, 0.02, 0.16]} position={[-0.25, 0.66, 0.1]} rotation={[0, 0.3, 0]} color="#c9472f" rough={0.9} />
    </group>
  );
}

/** Piles de pneus (trois colonnes de hauteurs différentes). */
export function TireStack() {
  return (
    <group>
      {[[-0.42, 4], [0, 6], [0.42, 3]].map(([x, n]) =>
        Array.from({ length: n }, (_, i) => (
          <group key={`${x}${i}`} position={[x, 0.07 + i * 0.14, (i % 2) * 0.02]}>
            <Cylinder radius={0.21} height={0.13} segments={20} color="#1c1d20" rough={0.9} />
            <Cylinder radius={0.11} height={0.135} segments={14} color="#3a3d42" rough={0.8} />
          </group>
        ))
      )}
    </group>
  );
}

/** Stock de signalisation temporaire : cônes empilés, barrières de chantier rouge et blanc, panneaux « travaux ». */
export function ConesStock() {
  const cone = (x, z, n) =>
    Array.from({ length: n }, (_, i) => (
      <group key={`${x}${z}${i}`} position={[x, i * 0.06, z]}>
        <Box size={[0.3, 0.03, 0.3]} position={[0, 0.015, 0]} color="#1c1c1c" rough={0.8} />
        <Cylinder position={[0, 0.25, 0]} radius={0.12} top={0.18} height={0.46} segments={14} color="#ec6a1c" rough={0.6} />
        <Cylinder position={[0, 0.28, 0]} radius={0.085} top={0.85} height={0.08} segments={14} color="#f4f4f0" rough={0.5} />
      </group>
    ));
  return (
    <group>
      {cone(-0.75, 0.15, 5)}
      {cone(-0.4, -0.15, 4)}
      {cone(-0.75, -0.25, 3)}
      {/* Barrières de chantier appuyées contre le mur */}
      {[0, 1, 2].map((k) => (
        <group key={k} position={[0.45 + k * 0.05, 0, -0.3 + k * 0.07]} rotation={[-0.12, 0, 0]}>
          {[-0.55, 0.55].map((x) => (
            <Box key={x} size={[0.05, 0.85, 0.05]} position={[x, 0.42, 0]} color="#e6e6e2" metal={0.3} rough={0.5} />
          ))}
          {[0.35, 0.65].map((y) => (
            <Box key={y} size={[1.15, 0.16, 0.03]} position={[0, y, 0]} map={chantierStripes()} rough={0.6} />
          ))}
        </group>
      ))}
      {/* Panneau triangulaire « travaux » */}
      <group position={[1.15, 0, 0.1]} rotation={[-0.2, -0.4, 0]}>
        <Box size={[0.04, 0.5, 0.04]} position={[0, 0.25, 0]} color={STEEL} metal={0.5} rough={0.4} />
        <Cylinder position={[0, 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} radius={0.3} height={0.02} segments={3} color="#f0c419" rough={0.5} />
      </group>
    </group>
  );
}
const chantierStripes = () =>
  canvasTexture('barriere-chantier', 128, 32, (ctx, w, h) => {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 2 ? '#f4f4f0' : '#c8232c';
      ctx.beginPath();
      ctx.moveTo(i * 16, 0);
      ctx.lineTo(i * 16 + 16, 0);
      ctx.lineTo(i * 16 + 8, h);
      ctx.lineTo(i * 16 - 8, h);
      ctx.fill();
    }
  });

/** Vestiaires : rangée de casiers métalliques à aérations, banc. */
export function Lockers({ count = 6 }) {
  const w = 0.32;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const x = (i - (count - 1) / 2) * w;
        return (
          <group key={i} position={[x, 0, 0]}>
            <Box size={[w - 0.01, 1.2, 0.36]} position={[0, 0.6, -0.08]} color={['#5b7f9a', '#4f7189'][i % 2]} metal={0.45} rough={0.45} />
            {[0.9, 0.95, 1.0].map((y) => (
              <Box key={y} size={[w * 0.5, 0.012, 0.005]} position={[0, y, 0.1]} color="#2c3e4c" rough={0.6} shadow={false} />
            ))}
            <Box size={[0.02, 0.06, 0.02]} position={[w * 0.32, 0.6, 0.11]} color="#c4c8cd" metal={0.8} rough={0.3} shadow={false} />
          </group>
        );
      })}
      <Box size={[count * w, 0.04, 0.26]} position={[0, 0.3, 0.42]} color={WOOD} rough={0.7} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.04, 0.3, 0.22]} position={[s * (count * w * 0.45), 0.15, 0.42]} color={IRON} metal={0.5} rough={0.45} />
      ))}
    </group>
  );
}

/** Coin café des agents : table, quatre chaises, machine à café, réfrigérateur, tasses. */
export function CoffeeCorner() {
  return (
    <group>
      <Box size={[1.1, 0.04, 0.7]} position={[0, 0.5, 0.35]} color="#d9d2c3" rough={0.6} />
      <Cylinder position={[0, 0.25, 0.35]} radius={0.04} height={0.5} color={IRON} metal={0.5} rough={0.4} />
      {[[-0.55, 0.35, Math.PI / 2], [0.55, 0.35, -Math.PI / 2], [0, 0.85, Math.PI], [0, -0.15, 0]].map(([x, z, r], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, r, 0]}>
          <Box size={[0.32, 0.04, 0.32]} position={[0, 0.3, 0]} color="#3d6ea8" rough={0.6} />
          <Box size={[0.32, 0.3, 0.03]} position={[0, 0.47, -0.15]} color="#3d6ea8" rough={0.6} />
          <Cylinder position={[0, 0.15, 0]} radius={0.02} height={0.3} color={IRON} metal={0.5} rough={0.4} />
        </group>
      ))}
      {[[-0.2, 0.3], [0.15, 0.42]].map(([x, z]) => (
        <Cylinder key={x} position={[x, 0.545, z]} radius={0.025} top={1.1} height={0.05} color="#f4f1ea" rough={0.4} />
      ))}
      {/* Meuble bas, machine à café, réfrigérateur contre le mur */}
      <Box size={[0.9, 0.6, 0.4]} position={[1.25, 0.3, -0.3]} color="#e6e2da" rough={0.6} />
      <Box size={[0.26, 0.34, 0.26]} position={[1.1, 0.77, -0.32]} color="#22252a" metal={0.4} rough={0.35} />
      <Box size={[0.1, 0.05, 0.02]} position={[1.1, 0.84, -0.18]} color="#5d8fc9" glow={0.6} shadow={false} />
      <Box size={[0.55, 1.15, 0.5]} position={[2.05, 0.58, -0.27]} color="#f2f2f0" metal={0.2} rough={0.4} />
      <Box size={[0.03, 0.3, 0.03]} position={[1.84, 0.78, 0.0]} color="#9aa2aa" metal={0.7} rough={0.3} />
    </group>
  );
}

/** Tondeuse autoportée (carter de coupe, siège, volant, bac de ramassage). */
export function RidingMower({ color = '#3f7d3a' }) {
  return (
    <group>
      <Box size={[1.05, 0.28, 0.62]} position={[0.08, 0.36, 0]} color={color} metal={0.3} rough={0.5} />
      <Box size={[0.4, 0.18, 0.5]} position={[0.42, 0.56, 0]} color={color} metal={0.3} rough={0.5} />
      <Box size={[0.75, 0.1, 0.8]} position={[0.1, 0.16, 0]} color="#3a3d42" metal={0.4} rough={0.5} />
      <Box size={[0.3, 0.08, 0.32]} position={[-0.18, 0.56, 0]} color="#1c1c1c" rough={0.7} />
      <Box size={[0.06, 0.28, 0.32]} position={[-0.33, 0.7, 0]} color="#1c1c1c" rough={0.7} />
      <Cylinder position={[0.22, 0.72, 0]} rotation={[0, 0, 0.5]} radius={0.015} height={0.3} color={IRON} rough={0.5} />
      <Cylinder position={[0.15, 0.86, 0]} rotation={[0, 0, Math.PI / 2 - 0.5]} radius={0.09} height={0.02} segments={16} color="#1c1c1c" rough={0.6} />
      <Box size={[0.45, 0.4, 0.55]} position={[-0.68, 0.42, 0]} color="#2f4f2c" rough={0.7} />
      {[[0.42, 0.33, 0.13], [-0.32, 0.36, 0.2]].map(([x, z, r]) =>
        [-1, 1].map((s) => <Cylinder key={`${x}${s}`} position={[x, r, s * z]} rotation={[Math.PI / 2, 0, 0]} radius={r} height={0.12} segments={16} color="#1c1d20" rough={0.9} />)
      )}
    </group>
  );
}

/** Râtelier mural d'outils de jardin : râteaux, pelles, bêches, balais, débroussailleuses. */
export function GardenToolsRack({ length = 2.2 }) {
  const n = Math.max(4, Math.round(length / 0.22));
  return (
    <group>
      <Box size={[length, 0.08, 0.06]} position={[0, 1.55, -0.3]} color={WOOD} rough={0.7} />
      <Box size={[length, 0.06, 0.06]} position={[0, 0.4, -0.3]} color={WOOD} rough={0.7} />
      {Array.from({ length: n }, (_, i) => {
        const x = -length / 2 + 0.15 + (i * (length - 0.3)) / (n - 1);
        const kind = i % 4;
        return (
          <group key={i} position={[x, 0, -0.26]} rotation={[0.06, 0, 0]}>
            <Cylinder position={[0, 0.85, 0]} radius={0.015} height={1.4} color="#9c7a4c" rough={0.7} />
            {kind === 0 && <Box size={[0.32, 0.03, 0.05]} position={[0, 0.16, 0.02]} color={STEEL} metal={0.6} rough={0.4} />}
            {kind === 1 && <Box size={[0.2, 0.26, 0.03]} position={[0, 0.2, 0.02]} color="#4a4f55" metal={0.5} rough={0.45} />}
            {kind === 2 && <Box size={[0.36, 0.08, 0.06]} position={[0, 0.15, 0.03]} color="#b8432f" rough={0.7} />}
            {kind === 3 && (
              <group>
                <Box size={[0.12, 0.14, 0.12]} position={[0, 1.32, 0.05]} color="#e86a1c" rough={0.5} />
                <Cylinder position={[0, 0.12, 0.04]} rotation={[Math.PI / 2, 0, 0]} radius={0.08} height={0.03} segments={14} color="#e86a1c" rough={0.5} />
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** Palette de sacs de terreau et d'engrais. */
export function CompostBags() {
  return (
    <group>
      <Box size={[1.2, 0.12, 0.8]} position={[0, 0.06, 0]} color="#b08a5a" rough={0.8} />
      {Array.from({ length: 4 }, (_, row) =>
        [-0.3, 0.3].map((x) => (
          <Box key={`${row}${x}`} size={[0.56, 0.14, 0.75]} position={[x + (row % 2 ? 0.02 : -0.02), 0.19 + row * 0.14, 0]} color={row % 2 ? '#4f6f2f' : '#6b4a2a'} rough={0.75} />
        ))
      )}
    </group>
  );
}

const KID_TOPS = ['#d9473f', '#f2b134', '#3d7cc9', '#4caf6a', '#9c5bd1', '#ef7aa1', '#2bb3b1', '#f07f3c'];

/**
 * Enfants qui déjeunent à une table de cantine (même origine que la table) : trois de chaque côté, assis sur
 * les bancs, plateau, assiette et verre devant eux ; ils portent la fourchette à la bouche, boivent, se
 * tournent vers leurs voisins pour bavarder, chacun à son rythme.
 */
export function KidsLunch({ seed = 0 }) {
  const kids = useMemo(
    () =>
      [-1, 1].flatMap((side) =>
        [-0.58, 0, 0.58].map((x, k) => {
          const i = (side > 0 ? 3 : 0) + k;
          return {
            x,
            z: side * 0.5,
            facing: side > 0 ? Math.PI : 0,
            variant: (i * 3 + Math.floor(seed * 8)) % 8,
            colors: { top: KID_TOPS[(i + Math.floor(seed * 13)) % KID_TOPS.length], pants: ['#2c3e66', '#4a4a4a', '#6b4f3a'][i % 3], shoes: '#2a2a2a' },
            phase: seeded(seed * 7 + i) * 10,
            limbs: {},
          };
        })
      ),
    [seed]
  );
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    kids.forEach((k, i) => {
      const { rightArm, rightArmFore, head, eyes } = k.limbs;
      const u = t + k.phase;
      // Fourchette portée à la bouche par périodes, coups d'œil aux voisins
      const bite = Math.max(0, Math.sin(u * 1.3)) ** 3;
      if (rightArm) rightArm.rotation.x = -0.4 - 0.25 * bite;
      if (rightArmFore) rightArmFore.rotation.x = -1.45 - 0.9 * bite;
      if (head) head.rotation.set(0.12 - 0.1 * bite, Math.sin(u * 0.37 + i) ** 3 * 0.7, 0);
      if (eyes) eyes.visible = (u * 1.0) % (3.4 + (i % 3)) < 0.12;
    });
  });
  return (
    <group>
      {kids.map((k, i) => (
        <group key={i} position={[k.x, 0, k.z]} rotation={[0, k.facing, 0]}>
          {/* Plateau, assiette, verre (côté table) */}
          <group position={[0, 0.482, 0.3]}>
            <Box size={[0.3, 0.012, 0.22]} color="#c9cfd6" rough={0.5} />
            <Cylinder position={[0, 0.012, 0.01]} radius={0.075} height={0.012} segments={18} color="#f4f1ea" rough={0.4} />
            <Ball scale={[0.07, 0.03, 0.07]} position={[0.01, 0.022, 0.01]} color={['#d98a3a', '#8fb04a', '#d9473f'][i % 3]} rough={0.8} />
            <Cylinder position={[0.11, 0.035, -0.06]} radius={0.022} height={0.07} segments={12} color="#cfe3ef" opacity={0.6} rough={0.1} />
          </group>
          {/* Enfant assis (petit gabarit, rehaussé au niveau du banc) */}
          <group position={[0, 0.13, -0.02]} scale={[0.62, 0.62, 0.62]} userData={DYNAMIC}>
            <Person outfit="office" pose="meet" variant={k.variant} colors={k.colors} limbs={k.limbs} />
          </group>
        </group>
      ))}
    </group>
  );
}
