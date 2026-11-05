import React from 'react';
import { Box, Cylinder, Ball, FloorZone, Monitor, Keyboard, seeded } from './kit';
import { canvasTexture, clockFace } from './civicProps';

/**
 * Mobilier ancien et patrimoine (intérieurs d'une mairie du XVIIIᵉ siècle) pour l'éditeur de site :
 * buste de Marianne, portrait officiel, cheminée de marbre à trumeau, lustre à pampilles, horloge comtoise,
 * table du conseil, fauteuil de style, bureau ancien à lampe de banquier, guichet en bois, bibliothèque de
 * registres, coffre-fort, tapis, et zone d'unité de travail cotée (DigiRisk) sans mobilier moderne.
 * Origine au sol, face à +Z, 1 unité ≈ 1,5 m (un adulte ≈ 1,17 unité).
 */

const OAK = '#6b4423';
const WALNUT = '#4a2e18';
const GILT = '#b8913f';
const MARBLE = '#ece9e2';
const VELVET = '#7f1d1d';
const LEATHER = '#1f4d33';
const PLASTER = '#f4f1ea';

const rnd = (seed) => seeded(seed);

/* ------------------------------------------------------------------ */
/* Décor                                                                */
/* ------------------------------------------------------------------ */

/** Buste de Marianne (plâtre blanc, bonnet phrygien) sur colonne de marbre. */
export function MarianneBust() {
  return (
    <group>
      <Box size={[0.48, 0.06, 0.48]} position={[0, 0.03, 0]} color={MARBLE} rough={0.3} metal={0.1} />
      <Cylinder radius={0.17} height={0.66} segments={12} position={[0, 0.39, 0]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[0.44, 0.06, 0.44]} position={[0, 0.75, 0]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[0.2, 0.06, 0.01]} position={[0, 0.5, 0.172]} color={GILT} metal={0.8} rough={0.3} />
      <Ball scale={[0.38, 0.22, 0.22]} position={[0, 0.88, 0]} color={PLASTER} rough={0.55} />
      <Cylinder radius={0.055} height={0.12} position={[0, 1.0, 0]} color={PLASTER} rough={0.55} />
      <Ball radius={0.11} position={[0, 1.12, 0.01]} color={PLASTER} rough={0.55} />
      <Cylinder radius={0.12} height={0.13} top={0.55} position={[0, 1.23, -0.01]} rotation={[0.45, 0, 0]} color={PLASTER} rough={0.55} />
      <Ball radius={0.045} position={[0, 1.27, 0.08]} color={PLASTER} rough={0.55} />
    </group>
  );
}

// Portrait officiel générique (silhouette, écharpe tricolore) : aucun personnage réel
const portraitCanvas = () =>
  canvasTexture('portrait-officiel', 160, 220, (ctx, w, h) => {
    const bg = ctx.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h / 2, h * 0.7);
    bg.addColorStop(0, '#6b5a43');
    bg.addColorStop(1, '#2a2118');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.95, w * 0.46, h * 0.42, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.56);
    ctx.lineTo(w / 2, h * 0.7);
    ctx.lineTo(w * 0.58, h * 0.56);
    ctx.fill();
    ['#0055a4', '#ffffff', '#ef4135'].forEach((color, i) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(w * 0.2 + i * 7, h * 0.6);
      ctx.lineTo(w * 0.72 + i * 7, h);
      ctx.stroke();
    });
    ctx.fillStyle = '#d6b48c';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.4, w * 0.15, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f2a1d';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.31, w * 0.16, h * 0.06, 0, Math.PI, 0);
    ctx.fill();
  });

/** Portrait officiel dans un cadre doré, accroché au mur (face à +Z). */
export function Portrait() {
  return (
    <group>
      <Box size={[0.72, 0.92, 0.05]} position={[0, 0.46, 0.025]} color={GILT} metal={0.75} rough={0.35} />
      <Box size={[0.56, 0.76, 0.02]} position={[0, 0.46, 0.055]} map={portraitCanvas()} rough={0.8} />
    </group>
  );
}

/** Cheminée de marbre, foyer et bûches, trumeau à miroir doré, pendule et chandeliers. */
export function Fireplace() {
  return (
    <group>
      <Box size={[1.45, 0.04, 0.6]} position={[0, 0.02, 0.12]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[0.2, 0.74, 0.34]} position={[-0.58, 0.39, 0]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[0.2, 0.74, 0.34]} position={[0.58, 0.39, 0]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[0.96, 0.1, 0.3]} position={[0, 0.72, 0]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[1.4, 0.06, 0.4]} position={[0, 0.8, 0.02]} color={MARBLE} rough={0.3} metal={0.1} />
      <Box size={[0.96, 0.66, 0.04]} position={[0, 0.37, -0.15]} color="#1c1917" rough={0.95} />
      <Cylinder radius={0.05} height={0.6} position={[0, 0.1, -0.02]} rotation={[0, 0, Math.PI / 2]} color="#5b3a21" rough={0.95} />
      <Cylinder radius={0.045} height={0.55} position={[0, 0.18, -0.06]} rotation={[0, 0.3, Math.PI / 2]} color="#4a2e18" rough={0.95} />
      <Box size={[0.4, 0.04, 0.12]} position={[0, 0.06, 0.02]} color="#f97316" glow={1.4} shadow={false} />
      {/* Trumeau : cadre doré et miroir */}
      <Box size={[1.12, 1.25, 0.05]} position={[0, 1.48, -0.16]} color={GILT} metal={0.75} rough={0.35} />
      <Box size={[0.94, 1.06, 0.02]} position={[0, 1.47, -0.125]} color="#c7d2de" metal={0.9} rough={0.08} />
      <Box size={[0.5, 0.12, 0.05]} position={[0, 2.16, -0.16]} color={GILT} metal={0.75} rough={0.35} />
      {/* Pendule et chandeliers sur la tablette */}
      <Box size={[0.2, 0.24, 0.1]} position={[0, 0.95, 0.02]} color={GILT} metal={0.8} rough={0.3} />
      <Box size={[0.11, 0.11, 0.01]} position={[0, 0.97, 0.075]} map={clockFace()} rough={0.6} />
      {[-0.45, 0.45].map((x) => (
        <group key={x} position={[x, 0.83, 0.02]}>
          <Cylinder radius={0.03} height={0.2} top={0.5} position={[0, 0.1, 0]} color={GILT} metal={0.8} rough={0.3} />
          <Cylinder radius={0.012} height={0.08} position={[0, 0.24, 0]} color="#fffbeb" />
          <Ball radius={0.014} position={[0, 0.29, 0]} color="#fde68a" glow={2} shadow={false} />
        </group>
      ))}
    </group>
  );
}

/** Lustre à pampilles suspendu (bras dorés, bougies, gouttes de cristal) ; la chaîne monte de 0,7. */
export function Chandelier({ rod = 0.7 }) {
  const arms = 6;
  return (
    <group>
      {/* Tige de suspension, jusqu'au plafond */}
      <Cylinder radius={0.012} height={rod} position={[0, 0.5 + rod / 2, 0]} color={GILT} metal={0.8} rough={0.3} />
      <Cylinder radius={0.05} height={0.42} top={0.5} position={[0, 0.3, 0]} color={GILT} metal={0.8} rough={0.3} />
      <Ball radius={0.07} position={[0, 0.06, 0]} color={GILT} metal={0.8} rough={0.3} />
      {Array.from({ length: arms }, (_, i) => {
        const a = (i / arms) * Math.PI * 2;
        const [x, z] = [Math.sin(a) * 0.32, Math.cos(a) * 0.32];
        return (
          <group key={i}>
            <Box size={[0.025, 0.025, 0.32]} position={[x / 2, 0.16, z / 2]} rotation={[0, a, 0]} color={GILT} metal={0.8} rough={0.3} />
            <Cylinder radius={0.03} height={0.03} position={[x, 0.18, z]} color={GILT} metal={0.8} rough={0.3} />
            <Cylinder radius={0.012} height={0.09} position={[x, 0.24, z]} color="#fffbeb" />
            <Ball radius={0.018} position={[x, 0.3, z]} color="#fde68a" glow={2.2} shadow={false} />
            <Ball radius={0.022} position={[x * 0.75, 0.08, z * 0.75]} color="#e0f2fe" metal={0.3} rough={0.05} opacity={0.8} shadow={false} />
          </group>
        );
      })}
    </group>
  );
}

/** Horloge comtoise (caisse de chêne, cadran, balancier de laiton). */
export function GrandfatherClock() {
  return (
    <group>
      <Box size={[0.46, 0.12, 0.3]} position={[0, 0.06, 0]} color={WALNUT} rough={0.6} />
      <Box size={[0.38, 1.3, 0.24]} position={[0, 0.77, 0]} color={OAK} rough={0.55} />
      <Box size={[0.44, 0.42, 0.28]} position={[0, 1.6, 0]} color={OAK} rough={0.55} />
      <Box size={[0.5, 0.06, 0.32]} position={[0, 1.84, 0]} color={WALNUT} rough={0.6} />
      <Box size={[0.3, 0.3, 0.02]} position={[0, 1.6, 0.145]} map={clockFace()} rough={0.6} />
      <Box size={[0.22, 0.9, 0.01]} position={[0, 0.8, 0.125]} color="#bfdbfe" opacity={0.25} shadow={false} />
      <Box size={[0.012, 0.62, 0.012]} position={[0, 0.98, 0.1]} color={GILT} metal={0.8} rough={0.3} />
      <Cylinder radius={0.075} height={0.015} position={[0, 0.64, 0.1]} rotation={[Math.PI / 2, 0, 0]} color={GILT} metal={0.85} rough={0.25} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Mobilier                                                             */
/* ------------------------------------------------------------------ */

/** Grande table du conseil : plateau de noyer, tapis vert, pieds tournés, sous-main et registre. */
export function CouncilTable({ length = 4.5 }) {
  const legs = Math.max(2, Math.round(length / 1.6) + 1);
  const xs = Array.from({ length: legs }, (_, i) => -length / 2 + 0.12 + (i * (length - 0.24)) / (legs - 1));
  return (
    <group>
      {xs.map((x) =>
        [-0.38, 0.38].map((z) => <Cylinder key={`${x}${z}`} radius={0.04} height={0.44} top={0.65} position={[x, 0.22, z]} color={WALNUT} rough={0.5} />)
      )}
      <Box size={[length - 0.1, 0.1, 0.9]} position={[0, 0.44, 0]} color={WALNUT} rough={0.5} />
      <Box size={[length, 0.05, 1.0]} position={[0, 0.515, 0]} color={WALNUT} rough={0.45} />
      <Box size={[length - 0.16, 0.012, 0.86]} position={[0, 0.546, 0]} color="#14532d" rough={0.95} />
      {xs.slice(0, -1).map((x, i) => (
        <group key={x} position={[(x + xs[i + 1]) / 2, 0.561, 0]}>
          <Box size={[0.32, 0.006, 0.22]} position={[0, 0, 0.26]} color="#f5f0e6" rough={0.9} shadow={false} />
          <Box size={[0.32, 0.006, 0.22]} position={[0, 0, -0.26]} color="#f5f0e6" rough={0.9} shadow={false} />
        </group>
      ))}
      <Box size={[0.3, 0.06, 0.22]} position={[length / 2 - 0.4, 0.58, 0]} color="#7f1d1d" rough={0.7} />
    </group>
  );
}

/** Fauteuil de style Louis XVI (bois doré, velours rouge), assise face à +Z. */
export function StyleArmchair() {
  return (
    <group>
      {[
        [-0.17, 0.15],
        [0.17, 0.15],
        [-0.17, -0.15],
        [0.17, -0.15],
      ].map(([x, z]) => (
        <Cylinder key={`${x}${z}`} radius={0.022} height={0.28} top={0.6} position={[x, 0.14, z]} color={GILT} metal={0.6} rough={0.4} />
      ))}
      <Box size={[0.42, 0.06, 0.38]} position={[0, 0.3, 0]} color={GILT} metal={0.6} rough={0.4} />
      <Box size={[0.36, 0.05, 0.32]} position={[0, 0.345, 0.01]} color={VELVET} rough={0.85} />
      <Box size={[0.4, 0.42, 0.04]} position={[0, 0.57, -0.18]} color={GILT} metal={0.6} rough={0.4} />
      <Box size={[0.32, 0.34, 0.02]} position={[0, 0.57, -0.155]} color={VELVET} rough={0.85} />
      {[-0.2, 0.2].map((x) => (
        <Box key={x} size={[0.035, 0.035, 0.32]} position={[x, 0.46, -0.01]} color={GILT} metal={0.6} rough={0.4} />
      ))}
    </group>
  );
}

/** Bureau ancien à caissons (cuir vert, lampe de banquier, encrier, papiers) et son fauteuil, côté +Z. */
/**
 * Bureau ancien (caissons, sous-main de cuir, lampe de banquier) et son fauteuil, à +Z. `screens` : poste
 * informatique posé dessus (0 : écritoire et encrier, 1 ou 2 écrans avec clavier et souris).
 */
export function AntiqueDesk({ screens = 0 }) {
  const TOP = 0.52; // dessus du sous-main (écrans et clavier posés 2 mm au-dessus)
  const monitors = screens >= 2 ? [-0.2, 0.2] : screens === 1 ? [0.05] : [];
  return (
    <group>
      {[-0.38, 0.38].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box size={[0.32, 0.46, 0.56]} position={[0, 0.23, 0]} color={WALNUT} rough={0.5} />
          {[0.12, 0.28].map((y) => (
            <Box key={y} size={[0.24, 0.1, 0.01]} position={[0, y, 0.282]} color={OAK} rough={0.5} />
          ))}
        </group>
      ))}
      <Box size={[1.12, 0.05, 0.62]} position={[0, 0.485, 0]} color={WALNUT} rough={0.45} />
      <Box size={[0.9, 0.008, 0.44]} position={[0, 0.514, 0]} color={LEATHER} rough={0.9} />
      {monitors.length ? (
        <>
          {/* Poste informatique : écran(s) face au fauteuil, clavier et souris, dossier ouvert à côté */}
          {monitors.map((x) => (
            <Monitor key={x} position={[x, TOP, -0.15]} rotation={[0, monitors.length > 1 ? -x * 0.9 : 0, 0]} />
          ))}
          <Keyboard position={[0, TOP + 0.006, 0.08]} />
          <Box size={[0.2, 0.006, 0.27]} position={[-0.33, 0.524, 0.08]} color="#f5f0e6" rough={0.9} shadow={false} />
        </>
      ) : (
        <>
          <Box size={[0.24, 0.006, 0.32]} position={[-0.05, 0.527, 0.05]} color="#f5f0e6" rough={0.9} shadow={false} />
          <Box size={[0.06, 0.05, 0.06]} position={[0.2, 0.54, -0.15]} color="#111827" metal={0.4} rough={0.3} />
        </>
      )}
      {/* Lampe de banquier (place libre à côté d'un écran unique) */}
      {screens < 2 && (
        <group position={[-0.36, 0.51, -0.16]}>
          <Box size={[0.12, 0.02, 0.08]} position={[0, 0.01, 0]} color={GILT} metal={0.85} rough={0.25} />
          <Cylinder radius={0.01} height={0.22} position={[0, 0.12, 0]} color={GILT} metal={0.85} rough={0.25} />
          <Box size={[0.22, 0.06, 0.1]} position={[0, 0.24, 0.02]} color="#15803d" glow={0.5} rough={0.3} />
        </group>
      )}
      <group position={[0, 0, 0.5]} rotation={[0, Math.PI, 0]}>
        <StyleArmchair />
      </group>
    </group>
  );
}

/**
 * Guichet d'accueil en bois (soubassement à panneaux, vitrage à hygiaphone au centre), longueur réglable ;
 * `screens` : écran(s) et clavier côté agent (−Z), derrière le vitrage.
 */
export function WoodenCounter({ length = 2.4, screens = 0 }) {
  const panels = Math.max(1, Math.round(length / 0.6));
  const glassWidth = (length - 0.7) / 2;
  return (
    <group>
      <Box size={[length, 0.7, 0.5]} position={[0, 0.35, 0]} color={OAK} rough={0.55} />
      {Array.from({ length: panels }, (_, i) => (
        <Box key={i} size={[length / panels - 0.12, 0.46, 0.01]} position={[-length / 2 + (i + 0.5) * (length / panels), 0.36, 0.255]} color={WALNUT} rough={0.5} />
      ))}
      <Box size={[length + 0.06, 0.05, 0.58]} position={[0, 0.725, 0]} color={WALNUT} rough={0.45} />
      {[-length / 2 + 0.03, -0.35, 0.35, length / 2 - 0.03].map((x) => (
        <Box key={x} size={[0.05, 0.5, 0.05]} position={[x, 1.0, 0]} color={WALNUT} rough={0.45} />
      ))}
      <Box size={[length, 0.06, 0.06]} position={[0, 1.27, 0]} color={WALNUT} rough={0.45} />
      {glassWidth > 0.1 &&
        [-1, 1].map((side) => (
          <Box key={side} size={[glassWidth, 0.44, 0.01]} position={[side * (0.35 + glassWidth / 2), 1.0, 0]} color="#bfdbfe" opacity={0.25} shadow={false} />
        ))}
      <Box size={[0.4, 0.006, 0.28]} position={[0, 0.759, 0.05]} color="#f5f0e6" rough={0.9} shadow={false} />
      {/* Poste de l'agent : derrière le vitrage, à côté de l'hygiaphone (ouverture centrale libre) */}
      {Array.from({ length: Math.min(screens, length > 1.6 ? 2 : 1) }, (_, i) => {
        const x = (i % 2 ? -1 : 1) * Math.min(0.6, length / 2 - 0.3);
        return (
          <group key={i} position={[x, 0.752, -0.1]} rotation={[0, Math.PI, 0]}>
            <Monitor />
            <Keyboard position={[0, 0.006, 0.13]} />
          </group>
        );
      })}
    </group>
  );
}

const BINDINGS = ['#4a2e18', '#7f1d1d', '#1f4d33', '#1e293b', '#5b3a21', '#3f2a1d'];

/** Bibliothèque de chêne garnie de registres reliés (état civil, délibérations). */
export function RegisterShelf() {
  const levels = [0.12, 0.47, 0.82, 1.17];
  return (
    <group>
      <Box size={[0.05, 1.6, 0.36]} position={[-0.625, 0.8, 0]} color={OAK} rough={0.55} />
      <Box size={[0.05, 1.6, 0.36]} position={[0.625, 0.8, 0]} color={OAK} rough={0.55} />
      <Box size={[1.3, 0.05, 0.38]} position={[0, 1.62, 0]} color={WALNUT} rough={0.5} />
      <Box size={[1.2, 1.55, 0.02]} position={[0, 0.8, -0.17]} color={WALNUT} rough={0.6} />
      {levels.map((y, l) => (
        <group key={y}>
          <Box size={[1.2, 0.03, 0.34]} position={[0, y - 0.015, 0]} color={OAK} rough={0.55} />
          {Array.from({ length: 11 }, (_, i) => {
            const h = 0.24 + rnd(l * 19 + i) * 0.06;
            const color = BINDINGS[Math.floor(rnd(l * 7 + i * 3) * BINDINGS.length)];
            const x = -0.54 + i * 0.105;
            return (
              <group key={i} position={[x, y + h / 2, 0.01]}>
                <Box size={[0.085, h, 0.26]} color={color} rough={0.7} />
                {/* Filets dorés du dos, nettement en saillie (pas de faces confondues avec la reliure) */}
                <Box size={[0.07, 0.014, 0.012]} position={[0, h * 0.28, 0.136]} color={GILT} metal={0.7} rough={0.35} shadow={false} />
                <Box size={[0.07, 0.014, 0.012]} position={[0, -h * 0.28, 0.136]} color={GILT} metal={0.7} rough={0.35} shadow={false} />
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** Coffre-fort ancien (fonte vert sombre, filets dorés, molette et poignée). */
export function OldSafe() {
  return (
    <group>
      {[
        [-0.22, 0.18],
        [0.22, 0.18],
        [-0.22, -0.18],
        [0.22, -0.18],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.08, 0.06, 0.08]} position={[x, 0.03, z]} color="#111827" metal={0.5} />
      ))}
      <Box size={[0.56, 0.86, 0.5]} position={[0, 0.49, 0]} color="#1f3b2d" metal={0.45} rough={0.45} />
      <Box size={[0.46, 0.012, 0.01]} position={[0, 0.84, 0.252]} color={GILT} metal={0.8} rough={0.3} />
      <Box size={[0.46, 0.012, 0.01]} position={[0, 0.14, 0.252]} color={GILT} metal={0.8} rough={0.3} />
      <Box size={[0.012, 0.7, 0.01]} position={[-0.23, 0.49, 0.252]} color={GILT} metal={0.8} rough={0.3} />
      <Box size={[0.012, 0.7, 0.01]} position={[0.23, 0.49, 0.252]} color={GILT} metal={0.8} rough={0.3} />
      <Cylinder radius={0.06} height={0.03} position={[0, 0.56, 0.26]} rotation={[Math.PI / 2, 0, 0]} color={GILT} metal={0.85} rough={0.25} />
      <Box size={[0.16, 0.025, 0.03]} position={[0, 0.4, 0.265]} color={GILT} metal={0.85} rough={0.25} />
    </group>
  );
}

/** Tapis d'apparat (bordure dorée, champ rouge, médaillon). */
export function Carpet({ width = 3, depth = 2 }) {
  return (
    <group>
      {/* Couches espacées d'au moins 8 mm : pas de scintillement, même de loin */}
      <Box size={[width, 0.012, depth]} position={[0, 0.006, 0]} color="#a16207" rough={0.95} shadow={false} receive />
      <Box size={[width - 0.16, 0.012, depth - 0.16]} position={[0, 0.016, 0]} color="#7f1d1d" rough={0.95} shadow={false} receive />
      <Box size={[Math.min(width, depth) * 0.35, 0.012, Math.min(width, depth) * 0.35]} position={[0, 0.024, 0]} rotation={[0, Math.PI / 4, 0]} color="#b45309" rough={0.95} shadow={false} receive />
    </group>
  );
}

/**
 * Unité de travail DigiRisk sans mobilier : marquage au sol et voile de la couleur de cotation, borne
 * d'angle. Permet de coter un espace meublé à l'ancienne (accueil, salle du conseil…).
 */
export function WorkUnitZone({ width = 4.4, depth = 3.6, color = '#94a3b8' }) {
  return (
    <group>
      {/* Voile et bordure au-dessus des tapis (dessus à 3 cm) : aucune face confondue avec leurs couches */}
      <Box size={[width, 0.004, depth]} position={[0, 0.04, 0]} color={color} opacity={0.16} shadow={false} />
      <group position={[0, 0.05, 0]}>
        <FloorZone width={width} depth={depth} color={color} line={0.06} />
      </group>
      <group position={[-width / 2 + 0.15, 0, depth / 2 - 0.15]}>
        <Cylinder radius={0.03} height={0.55} position={[0, 0.275, 0]} color="#334155" metal={0.5} />
        <Box size={[0.22, 0.16, 0.03]} position={[0, 0.6, 0]} color={color} rough={0.6} />
      </group>
    </group>
  );
}
