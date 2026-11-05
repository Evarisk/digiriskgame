import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Ball, DYNAMIC, getMaterial, noRaycast, seeded } from './kit';
import { Leaves } from './natureProps';

/**
 * Modèles « mairie et espace public » de l'éditeur de site : fenêtres de façade, toiture mansardée à
 * lucarnes, campanile à horloge, fronton « MAIRIE », mâts et drapeaux (France, Europe), fontaine,
 * jardinière fleurie, lanterne de ville et perron. Origine au sol, face à +Z, 1 unité ≈ 1,5 m.
 * Les inscriptions (fronton, cadran, drapeaux) sont dessinées sur des canvas mis en cache.
 */

const SLAB = 0.16; // dessus de dalle des bâtiments de l'éditeur (FLOOR_Y)
const LEVEL = 2.5; // hauteur d'un niveau (≈ 3,75 m)
const STONE = '#efe7d6';
const STONE_DARK = '#d8ccb4';
const SLATE = '#4b5563';
const ZINC = '#94a3b8';
const IRON = '#1f2937';
const GLASS = '#cfe8ff'; // vitrage clair des fenêtres de façade (translucide)
const DORMER_GLASS = '#1e3a5f'; // lucarnes : vitre sombre (pas de comble aménagé derrière)
const FRAME = '#f8fafc';
const GOLD = '#d4a017';

/* ------------------------------------------------------------------ */
/* Textures dessinées                                                   */
/* ------------------------------------------------------------------ */

const canvasTextures = new Map();

/** Texture dessinée une seule fois sur un canvas (`key` unique), partagée par tous les modèles. */
export function canvasTexture(key, width, height, paint) {
  if (!canvasTextures.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    canvasTextures.set(key, texture);
  }
  return canvasTextures.get(key);
}

function paintFrenchFlag(ctx, w, h, x = 0, y = 0) {
  ['#0055a4', '#ffffff', '#ef4135'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + (i * w) / 3, y, w / 3 + 1, h);
  });
}

const frenchFlag = () => canvasTexture('flag-fr', 192, 128, (ctx, w, h) => paintFrenchFlag(ctx, w, h));

const europeanFlag = () =>
  canvasTexture('flag-eu', 192, 128, (ctx, w, h) => {
    ctx.fillStyle = '#003399';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffcc00';
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const cx = w / 2 + Math.sin(a) * 40;
      const cy = h / 2 - Math.cos(a) * 40;
      ctx.beginPath();
      for (let k = 0; k < 10; k += 1) {
        const r = k % 2 ? 3.2 : 8;
        const b = (k / 10) * Math.PI * 2;
        ctx.lineTo(cx + Math.sin(b) * r, cy - Math.cos(b) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
  });

const mairieSign = () =>
  canvasTexture('sign-mairie', 1024, 196, (ctx, w, h) => {
    ctx.fillStyle = '#f3ecdc';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b9a77f';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    paintFrenchFlag(ctx, 72, 48, 40, 56);
    paintFrenchFlag(ctx, 72, 48, w - 112, 56);
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 112px Georgia, "Times New Roman", serif';
    ctx.fillText('MAIRIE', w / 2, 82);
    ctx.fillStyle = '#475569';
    ctx.font = '600 32px Georgia, "Times New Roman", serif';
    ctx.fillText('LIBERTÉ · ÉGALITÉ · FRATERNITÉ', w / 2, 160);
  });

/**
 * Cadran d'horloge (chiffres romains) : aiguilles peintes à 10 h 10 (horloge comtoise), ou sans aiguilles
 * (`hands` = false) pour le campanile, dont les aiguilles en relief donnent l'heure réelle.
 */
export const clockFace = (hands = true) =>
  canvasTexture(hands ? 'clock-face' : 'clock-face-bare', 256, 256, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = STONE;
    ctx.fillRect(0, 0, w, w);
    ctx.beginPath();
    ctx.arc(c, c, 112, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = IRON;
    ctx.stroke();
    for (let i = 0; i < 60; i += 1) {
      const a = (i / 60) * Math.PI * 2;
      const long = i % 5 === 0;
      ctx.lineWidth = long ? 6 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(a) * (long ? 84 : 94), c - Math.cos(a) * (long ? 84 : 94));
      ctx.lineTo(c + Math.sin(a) * 102, c - Math.cos(a) * 102);
      ctx.stroke();
    }
    ctx.fillStyle = IRON;
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    [['XII', 0], ['III', 3], ['VI', 6], ['IX', 9]].forEach(([label, hour]) => {
      const a = (hour / 12) * Math.PI * 2;
      ctx.fillText(label, c + Math.sin(a) * 64, c - Math.cos(a) * 64);
    });
    if (!hands) return;
    // Aiguilles à 10 h 10
    const hand = (angle, length, width) => {
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.sin(angle) * length, c - Math.cos(angle) * length);
      ctx.stroke();
    };
    hand(((10 + 10 / 60) / 12) * Math.PI * 2, 52, 10);
    hand((10 / 60) * Math.PI * 2, 82, 6);
    ctx.beginPath();
    ctx.arc(c, c, 9, 0, Math.PI * 2);
    ctx.fill();
  });

/**
 * Aiguilles en relief d'un cadran de campanile (repère du cadran, face vers +Z) : heure réelle du poste,
 * l'aiguille des minutes avance en continu.
 */
function ClockHands({ size }) {
  const hourRef = useRef();
  const minuteRef = useRef();
  useFrame(() => {
    const now = new Date();
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    const hours = (now.getHours() % 12) + minutes / 60;
    // Sens horaire vu de face (+Z) : rotation négative autour de Z
    if (minuteRef.current) minuteRef.current.rotation.z = -(minutes / 60) * Math.PI * 2;
    if (hourRef.current) hourRef.current.rotation.z = -(hours / 12) * Math.PI * 2;
  });
  const r = size / 2;
  return (
    <group>
      <group ref={hourRef} userData={DYNAMIC}>
        <Box size={[r * 0.07, r * 0.48, 0.012]} position={[0, r * 0.2, 0]} color={IRON} metal={0.5} rough={0.4} />
      </group>
      <group ref={minuteRef} userData={DYNAMIC}>
        <Box size={[r * 0.045, r * 0.74, 0.012]} position={[0, r * 0.31, 0.014]} color={IRON} metal={0.5} rough={0.4} />
      </group>
      <Cylinder rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.022]} radius={r * 0.05} height={0.012} color={IRON} metal={0.5} rough={0.4} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Façade et toiture                                                    */
/* ------------------------------------------------------------------ */

/** Garde-corps de fenêtre (balconnet en fer forgé). */
function Balconnet({ y }) {
  return (
    <group position={[0, y, 0.17]}>
      <Box size={[0.84, 0.035, 0.035]} position={[0, 0.34, 0]} color={IRON} metal={0.5} rough={0.5} />
      <Box size={[0.84, 0.03, 0.03]} position={[0, 0.02, 0]} color={IRON} metal={0.5} rough={0.5} />
      {[-0.36, -0.18, 0, 0.18, 0.36].map((x) => (
        <Box key={x} size={[0.022, 0.34, 0.022]} position={[x, 0.17, 0]} color={IRON} metal={0.5} rough={0.5} />
      ))}
    </group>
  );
}

/**
 * Rangée de fenêtres plaquée sur une façade (encadrement de pierre, vitrage, petits bois, appui, balconnet
 * aux étages, bandeau entre les niveaux). `length` : longueur de façade couverte ; `floors` : nombre de
 * niveaux ; `firstLevel` : premier niveau percé (1 : pas de fenêtre au rez-de-chaussée, au-dessus d'une porte) ;
 * `balconnet` : 0 pour des fenêtres d'étage sans garde-corps (derrière un balcon).
 */
export function FacadeWindows({ length = 12, floors = 2, firstLevel = 0, baseLevel = 0, balconnet = 1 }) {
  const spacing = 1.8;
  const count = Math.max(1, Math.floor((length + 0.3) / spacing));
  const xs = Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * spacing);
  const levels = [];
  for (let f = Math.min(firstLevel, floors - 1); f < floors; f += 1) levels.push(f);
  // `baseLevel` : niveau où la rangée est posée (fenêtres d'étage : balconnet et bandeau sous l'appui)
  const bandeaux = Array.from({ length: floors - 1 }, (_, i) => i + 1);
  if (baseLevel > 0) bandeaux.unshift(0);
  return (
    <group>
      {levels.map((f) => {
        const storey = f + baseLevel;
        const h = storey === 0 ? 1.3 : 1.2;
        return xs.map((x) => (
          <group key={`${f}:${x}`} position={[x, SLAB + 0.55 + f * LEVEL, 0]}>
            {/* Encadrement de pierre autour de la baie (la façade est percée derrière : voir windowOpeningsByBuilding) */}
            {[-1, 1].map((side) => (
              <Box key={side} size={[0.11, h + 0.18, 0.06]} position={[side * 0.415, h / 2, 0.03]} color={STONE_DARK} rough={0.85} />
            ))}
            <Box size={[0.72, 0.09, 0.06]} position={[0, h + 0.045, 0.03]} color={STONE_DARK} rough={0.85} />
            <Box size={[0.72, 0.09, 0.06]} position={[0, -0.045, 0.03]} color={STONE_DARK} rough={0.85} />
            {/* Vitrage clair : on voit l'intérieur depuis la rue et la rue depuis l'intérieur */}
            <Box size={[0.74, h + 0.02, 0.03]} position={[0, h / 2, 0.065]} color={GLASS} opacity={0.22} metal={0.6} rough={0.05} />
            <Box size={[0.045, h, 0.05]} position={[0, h / 2, 0.08]} color={FRAME} rough={0.5} />
            <Box size={[0.72, 0.045, 0.05]} position={[0, h * 0.62, 0.08]} color={FRAME} rough={0.5} />
            <Box size={[1.02, 0.07, 0.16]} position={[0, -0.02, 0.08]} color={STONE_DARK} rough={0.85} />
            {storey > 0 && balconnet > 0 && <Balconnet y={0} />}
          </group>
        ));
      })}
      {bandeaux.map((i) => (
        <Box key={`bandeau${i}`} size={[length, 0.14, 0.09]} position={[0, SLAB + i * LEVEL - 0.08, 0.045]} color={STONE_DARK} rough={0.85} />
      ))}
    </group>
  );
}

const MANSARD_TOP = 0.42;

/** Lucarne (fenêtre de toit) dont la face avant est à z = 0. */
function Dormer({ color }) {
  return (
    <group>
      <Box size={[0.66, 0.72, 0.8]} position={[0, 0.36, -0.4]} color={color} rough={0.6} metal={0.25} />
      <Box size={[0.5, 0.56, 0.04]} position={[0, 0.34, 0.01]} color={STONE} rough={0.8} />
      <Box size={[0.36, 0.42, 0.03]} position={[0, 0.34, 0.035]} color={DORMER_GLASS} metal={0.5} rough={0.15} />
      <Box size={[0.8, 0.07, 0.92]} position={[0, 0.76, -0.38]} color={ZINC} metal={0.6} rough={0.4} />
    </group>
  );
}

/**
 * Toiture mansardée (tronc de pyramide à quatre pans, terrasson en zinc) posée sur une corniche, avec des
 * lucarnes sur les longs pans. Origine : dessus des murs.
 */
export function MansardRoof({ width = 16, depth = 8, height = 2, color = SLATE }) {
  const s = Math.SQRT2; // le prisme unitaire à 4 côtés tourné de 45° a des côtés de 1 / √2
  const dormers = Math.max(0, Math.floor((width - 2) / 3.2));
  const xs = Array.from({ length: dormers }, (_, i) => (i - (dormers - 1) / 2) * 3.2);
  const f = 0.3; // hauteur relative des lucarnes sur le pan
  const zFace = depth / 2 - (depth / 2) * (1 - MANSARD_TOP) * f;
  return (
    <group>
      <Box size={[width + 0.4, 0.22, depth + 0.4]} position={[0, 0.11, 0]} color={STONE_DARK} rough={0.85} />
      <group position={[0, 0.22, 0]} scale={[width * s, 1, depth * s]}>
        <Cylinder radius={0.5} height={height} top={MANSARD_TOP} segments={4} position={[0, height / 2, 0]} rotation={[0, Math.PI / 4, 0]} color={color} rough={0.6} metal={0.25} flat />
      </group>
      <Box size={[width * MANSARD_TOP + 0.06, 0.07, depth * MANSARD_TOP + 0.06]} position={[0, 0.22 + height + 0.035, 0]} color={ZINC} metal={0.6} rough={0.4} />
      {[1, -1].map((side) => (
        <group key={side} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          {xs.map((x) => (
            <group key={x} position={[x, 0.22 + height * f - 0.1, zFace + 0.12]}>
              <Dormer color={color} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Campanile : base de pierre à quatre cadrans d'horloge, lanterne à cloche, flèche d'ardoise et épi doré. */
export function Belfry() {
  const face = clockFace(false);
  return (
    <group>
      <Box size={[1.6, 1.6, 1.6]} position={[0, 0.8, 0]} color={STONE} rough={0.85} />
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <Box size={[1.06, 1.06, 0.04]} position={[0, 0.86, 0.81]} map={face} rough={0.6} />
          {/* Aiguilles à l'heure réelle, 4 mm devant le cadran */}
          <group position={[0, 0.86, 0.84]}>
            <ClockHands size={0.93} />
          </group>
        </group>
      ))}
      <Box size={[1.85, 0.14, 1.85]} position={[0, 1.67, 0]} color={STONE_DARK} rough={0.85} />
      {[
        [-0.68, -0.68],
        [0.68, -0.68],
        [-0.68, 0.68],
        [0.68, 0.68],
      ].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.22, 1.05, 0.22]} position={[x, 2.26, z]} color={STONE} rough={0.85} />
      ))}
      <Cylinder radius={0.32} height={0.5} top={0.55} position={[0, 2.25, 0]} color="#8a6d3b" metal={0.7} rough={0.35} />
      <Box size={[1.85, 0.12, 1.85]} position={[0, 2.84, 0]} color={STONE_DARK} rough={0.85} />
      <group position={[0, 2.9, 0]} scale={[1.9 * Math.SQRT2, 1, 1.9 * Math.SQRT2]}>
        <Cylinder radius={0.5} height={1.5} top={0} segments={4} position={[0, 0.75, 0]} rotation={[0, Math.PI / 4, 0]} color={SLATE} rough={0.6} metal={0.25} flat />
      </group>
      <Cylinder radius={0.03} height={0.7} position={[0, 4.6, 0]} color={GOLD} metal={0.8} rough={0.3} />
      <Ball radius={0.09} position={[0, 4.42, 0]} color={GOLD} metal={0.8} rough={0.3} />
    </group>
  );
}

/** Fronton « MAIRIE » et devise républicaine, plaqué sur une façade. */
export function MairieSign() {
  return (
    <group>
      <Box size={[4.4, 0.92, 0.06]} position={[0, 0.46, 0.03]} color={STONE_DARK} rough={0.85} />
      <Box size={[4.2, 0.8, 0.04]} position={[0, 0.46, 0.07]} map={mairieSign()} rough={0.7} />
    </group>
  );
}

/**
 * Portail d'honneur d'un avant-corps (plaqué sur la façade, face à +Z, devant une baie de 1,6 × 2,35) :
 * encadrement à bossages, plate-bande et clé de voûte, imposte vitrée en éventail, vantaux de chêne ouverts
 * contre l'intérieur du mur ; balcon d'honneur en fer forgé sur consoles au-dessus ; à l'attique, corniche
 * et médaillons de part et d'autre de l'inscription. `width` : largeur de l'avant-corps.
 */
export function EntrancePortal({ width = 8 }) {
  const top = 2.35; // haut de la baie
  const wood = '#4a2e1c';
  const iron = { color: IRON, metal: 0.5, rough: 0.5 };
  // Imposte : petits bois rayonnant depuis le milieu de la traverse, arrêtés au cadre
  const rays = [0.35, 0.7, 1.05, Math.PI / 2, Math.PI - 1.05, Math.PI - 0.7, Math.PI - 0.35].map((a) => {
    const length = Math.min((top - 1.97) / Math.sin(a), 0.78 / Math.abs(Math.cos(a) || 1e-3));
    return { a, length };
  });
  return (
    <group>
      {/* Encadrement : socles, pilastres à bossages alternés */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.95, 0, 0]}>
          <Box size={[0.36, 0.22, 0.14]} position={[0, 0.11, 0.07]} color={STONE_DARK} rough={0.85} />
          {Array.from({ length: 7 }, (_, i) => (
            <Box key={i} size={[i % 2 ? 0.26 : 0.32, 0.26, i % 2 ? 0.1 : 0.12]} position={[s * (i % 2 ? -0.03 : 0), 0.22 + 0.15 + i * 0.3, i % 2 ? 0.05 : 0.06]} color={i % 2 ? STONE : STONE_DARK} rough={0.85} />
          ))}
        </group>
      ))}
      {/* Plate-bande à claveaux et clé de voûte saillante */}
      <Box size={[2.24, 0.3, 0.12]} position={[0, top + 0.15, 0.06]} color={STONE_DARK} rough={0.85} />
      {[-0.75, -0.42, 0.42, 0.75].map((x) => (
        <Box key={x} size={[0.012, 0.3, 0.004]} position={[x, top + 0.15, 0.122]} color="#b9ad95" rough={0.9} />
      ))}
      <Box size={[0.24, 0.42, 0.18]} position={[0, top + 0.17, 0.09]} color={STONE} rough={0.8} />
      {/* Imposte vitrée en éventail dans le haut de la baie */}
      <group position={[0, 0, -0.08]}>
        <Box size={[1.6, 0.06, 0.07]} position={[0, 1.97, 0]} color={wood} rough={0.6} />
        <Box size={[1.58, top - 1.97, 0.02]} position={[0, (top + 1.97) / 2, 0]} color={GLASS} opacity={0.3} metal={0.6} rough={0.05} />
        {rays.map(({ a, length }) => (
          <Box key={a} size={[0.022, length, 0.03]} position={[Math.cos(a) * (length / 2), 1.97 + Math.sin(a) * (length / 2), 0.01]} rotation={[0, 0, a - Math.PI / 2]} color={wood} rough={0.6} />
        ))}
        <Cylinder position={[0, 1.99, 0.01]} rotation={[Math.PI / 2, 0, 0]} radius={0.09} height={0.035} segments={16} color={wood} rough={0.6} />
      </group>
      {/* Vantaux ouverts, rabattus contre l'intérieur du mur (la baie reste libre) */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.19, 0, -0.37]}>
          <Box size={[0.78, 1.92, 0.05]} position={[0, 0.98, 0]} color={wood} rough={0.6} />
          {[0.55, 1.4].map((y) => (
            <Box key={y} size={[0.58, y > 1 ? 0.72 : 0.62, 0.016]} position={[0, y, 0.032]} color="#5a3923" rough={0.55} />
          ))}
          <Box size={[0.03, 0.14, 0.03]} position={[-s * 0.3, 1.02, 0.05]} color={GOLD} metal={0.8} rough={0.3} />
        </group>
      ))}
      {/* Balcon d'honneur sur consoles, garde-corps en fer forgé */}
      <group position={[0, 3.06, 0]}>
        <Box size={[3.3, 0.1, 0.56]} position={[0, 0.05, 0.28]} color={STONE} rough={0.8} />
        <Box size={[3.36, 0.04, 0.6]} position={[0, -0.02, 0.29]} color={STONE_DARK} rough={0.85} />
        {[-1.3, 0, 1.3].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <Box size={[0.16, 0.18, 0.44]} position={[0, -0.13, 0.22]} color={STONE_DARK} rough={0.85} />
            <Box size={[0.14, 0.2, 0.24]} position={[0, -0.32, 0.12]} color={STONE_DARK} rough={0.85} />
          </group>
        ))}
        <Box size={[3.24, 0.045, 0.045]} position={[0, 0.72, 0.52]} {...iron} />
        <Box size={[3.24, 0.03, 0.03]} position={[0, 0.16, 0.52]} {...iron} />
        {Array.from({ length: 25 }, (_, i) => -1.56 + i * 0.13).map((x) => (
          <Box key={x} size={[0.02, 0.56, 0.02]} position={[x, 0.44, 0.52]} {...iron} />
        ))}
        {[-1, 1].map((s) => (
          <group key={s}>
            <Box size={[0.045, 0.045, 0.5]} position={[s * 1.6, 0.72, 0.27]} {...iron} />
            {[0.14, 0.27, 0.4].map((z) => (
              <Box key={z} size={[0.02, 0.56, 0.02]} position={[s * 1.6, 0.44, z]} {...iron} />
            ))}
          </group>
        ))}
        {/* Motif central : volutes affrontées et médaillon doré */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.13, 0.44, 0.53]} rotation={[0, 0, s * 0.4]} geometry={SCROLL} material={getMaterial({ color: IRON, metalness: 0.5, roughness: 0.5 })} raycast={noRaycast} />
        ))}
        <Cylinder position={[0, 0.44, 0.54]} rotation={[Math.PI / 2, 0, 0]} radius={0.07} height={0.02} segments={18} color={GOLD} metal={0.8} rough={0.3} />
      </group>
      {/* Attique : corniche sous l'inscription, médaillons de pierre de part et d'autre */}
      <Box size={[width + 0.1, 0.14, 0.12]} position={[0, 4.74, 0.04]} color={STONE_DARK} rough={0.85} />
      <Box size={[width + 0.04, 0.05, 0.08]} position={[0, 4.64, 0.03]} color={STONE_DARK} rough={0.85} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (width / 2 - 0.85), 5.42, 0.02]}>
          <Ball scale={[0.62, 0.62, 0.08]} color={STONE_DARK} rough={0.85} />
          <Ball scale={[0.48, 0.48, 0.1]} position={[0, 0, 0.01]} color={STONE} rough={0.8} />
          {/* Couronne de laurier : deux branches qui se rejoignent en bas, ouverte en haut, rosette au centre */}
          {[0, Math.PI].map((ry) => (
            <mesh key={ry} geometry={WREATH} material={getMaterial({ color: '#b9ad95', roughness: 0.85, metalness: 0 })} position={[0, 0, 0.06]} rotation={[0, ry, -Math.PI / 2 + 0.1]} raycast={noRaycast} />
          ))}
          <Ball scale={[0.12, 0.12, 0.05]} position={[0, 0, 0.07]} color="#b9ad95" rough={0.85} />
        </group>
      ))}
    </group>
  );
}
// Volute du garde-corps (demi-anneau) et couronne de laurier sculptée des médaillons
const SCROLL = new THREE.TorusGeometry(0.11, 0.012, 6, 16, Math.PI * 1.5);
const WREATH = new THREE.TorusGeometry(0.17, 0.03, 8, 20, Math.PI * 0.82);

/* ------------------------------------------------------------------ */
/* Espace public                                                        */
/* ------------------------------------------------------------------ */

/** Mât (≈ 6,3 m) et drapeau tendu vers +X. */
/**
 * Drapeau qui flotte au vent : toile subdivisée dont les ondulations partent du mât (amplitude nulle au
 * guindant, croissante vers le battant), recalculée à chaque image. Repère : guindant au mât (x = 0).
 */
function WavingFlag({ map, width = 1.2, height = 0.8, seed = 0 }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, 18, 8);
    g.translate(width / 2, 0, 0);
    g.userData.rest = Float32Array.from(g.attributes.position.array);
    return g;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }), [map]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + seed * 4;
    const pos = geometry.attributes.position;
    const rest = geometry.userData.rest;
    for (let i = 0; i < pos.count; i += 1) {
      const x = rest[i * 3];
      const y = rest[i * 3 + 1];
      const k = x / width;
      pos.setZ(i, k * (Math.sin(x * 5.2 - t * 4.1 + y * 1.3) * 0.09 + Math.sin(x * 2.3 - t * 2.2) * 0.05));
      pos.setY(i, y - k * k * 0.05);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  });
  return <mesh geometry={geometry} material={material} castShadow userData={DYNAMIC} raycast={noRaycast} />;
}

export function Flagpole({ flag = 'fr' }) {
  return (
    <group>
      <Cylinder radius={0.16} height={0.14} position={[0, 0.07, 0]} color={STONE_DARK} rough={0.85} />
      <Cylinder radius={0.035} height={4.2} top={0.7} position={[0, 2.24, 0]} color={FRAME} metal={0.5} rough={0.35} />
      <Ball radius={0.07} position={[0, 4.38, 0]} color={GOLD} metal={0.8} rough={0.3} />
      <group position={[0.03, 3.82, 0]}>
        <WavingFlag map={flag === 'eu' ? europeanFlag() : frenchFlag()} seed={flag === 'eu' ? 1 : 0} />
      </group>
    </group>
  );
}

/**
 * Drapeau de l'Occitanie : croix occitane (croix de Toulouse) d'or sur fond rouge — quatre branches évasées,
 * terminées chacune par trois pommettes, et un anneau au centre.
 */
const occitanFlag = () =>
  canvasTexture('flag-oc', 192, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c4122f';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = h * 0.4;
    ctx.fillStyle = '#f2c300';
    for (let k = 0; k < 4; k += 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 2);
      // Branche évasée aux flancs incurvés
      ctx.beginPath();
      ctx.moveTo(0, -R * 0.09);
      ctx.quadraticCurveTo(R * 0.45, -R * 0.12, R * 0.8, -R * 0.44);
      ctx.lineTo(R * 0.8, R * 0.44);
      ctx.quadraticCurveTo(R * 0.45, R * 0.12, 0, R * 0.09);
      ctx.closePath();
      ctx.fill();
      // Trois pommettes au bout de la branche
      [-0.38, 0, 0.38].forEach((a) => {
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94, R * 0.12, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4122f';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
    ctx.fill();
  });

const BALCONY_FLAGS = { fr: () => frenchFlag(), eu: () => europeanFlag(), oc: () => occitanFlag() };

/**
 * Drapeau de balcon : support fixé au garde-corps (origine), hampe inclinée vers la rue (+Z) de `lean` radians,
 * pommeau doré, toile qui flotte le long de la hampe ; `side` : toile vers +X (0) ou vers −X (1).
 */
export function BalconyFlag({ flag = 'fr', lean = 0.65, side = 0 }) {
  return (
    <group>
      <Box size={[0.08, 0.12, 0.06]} position={[0, 0, -0.02]} color={IRON} metal={0.6} rough={0.4} />
      <group rotation={[lean, 0, 0]}>
        <Cylinder radius={0.017} height={1.55} position={[0, 0.77, 0]} color="#f2f0ea" metal={0.3} rough={0.4} />
        <Ball radius={0.035} position={[0, 1.57, 0]} color={GOLD} metal={0.8} rough={0.3} />
        <group position={[0, 1.15, 0]} rotation={[0, side ? Math.PI : 0, 0]}>
          <WavingFlag map={(BALCONY_FLAGS[flag] || BALCONY_FLAGS.fr)()} width={0.85} height={0.57} seed={flag === 'oc' ? 2 : flag === 'eu' ? 1 : side * 0.5 + 0.3} />
        </group>
      </group>
    </group>
  );
}

/** Texture de ruissellement (filets d'eau verticaux), déroulée en continu sur le rideau de la fontaine. */
const waterStreaks = () =>
  canvasTexture('water-streaks', 64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#a9c9d6';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i += 1) {
      const x = seeded(i * 3.1) * w;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + seeded(i * 7.3) * 0.5})`;
      ctx.fillRect(x, seeded(i * 5.7) * h, 1 + seeded(i) * 2, 10 + seeded(i * 9.1) * 40);
    }
  });

/** Eau qui coule : rideau de la vasque au bassin et jet central, texture déroulée vers le bas. */
function FountainWater() {
  const texture = useMemo(() => {
    const t = waterStreaks().clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, color: '#e6f3f8', transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.05, depthWrite: false, side: THREE.DoubleSide }),
    [texture]
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, dt) => {
    texture.offset.y = (texture.offset.y + Math.min(dt, 0.05) * 0.9) % 1;
  });
  return (
    <group userData={DYNAMIC}>
      {/* Rideau d'eau tombant du bord de la vasque dans le bassin */}
      {/* Du rebord de la vasque (rayon 0,66 à 1,57) au plan d'eau du bassin (0,49) */}
      <mesh position={[0, 1.03, 0]} material={material} userData={DYNAMIC} raycast={noRaycast}>
        <cylinderGeometry args={[0.68, 0.78, 1.08, 32, 1, true]} />
      </mesh>
      {/* Jet central au-dessus de la vasque */}
      <mesh position={[0, 1.8, 0]} material={material} userData={DYNAMIC} raycast={noRaycast}>
        <cylinderGeometry args={[0.025, 0.06, 0.38, 12, 1, true]} />
      </mesh>
    </group>
  );
}

/** Fontaine de place : bassin octogonal, colonne et vasque, eau qui coule. */
export function Fountain() {
  return (
    <group>
      <Cylinder radius={1.3} height={0.45} segments={8} position={[0, 0.225, 0]} color={STONE_DARK} rough={0.85} />
      {/* Plan d'eau 4 cm au-dessus du bassin (pas de faces confondues) : eau sombre et réfléchissante */}
      <Cylinder radius={1.15} height={0.04} segments={8} position={[0, 0.47, 0]} color="#4f7486" metal={0.35} rough={0.06} />
      <Cylinder radius={0.2} height={1.1} top={0.75} position={[0, 0.95, 0]} color={STONE} rough={0.85} />
      <Cylinder radius={0.55} height={0.14} top={1.2} position={[0, 1.5, 0]} color={STONE} rough={0.85} />
      <Cylinder radius={0.5} height={0.03} position={[0, 1.6, 0]} color="#5d8396" metal={0.35} rough={0.06} />
      <FountainWater />
    </group>
  );
}

// Fleurs aux teintes naturelles (géraniums, roses, lavande, soucis)
const FLOWERS = ['#b8323a', '#d98aa0', '#d9b64a', '#8a6bb0', '#d9773a', '#f2efe6'];

// Fleurons d'une ombelle de géranium (demi-boule de petites fleurs)
const FLORETS = [
  [0, 0.013, 0],
  [0.014, 0.005, 0],
  [-0.014, 0.005, 0],
  [0, 0.005, 0.014],
  [0, 0.005, -0.014],
  [0.01, 0.002, 0.01],
  [-0.01, 0.002, -0.01],
  [0.01, 0.002, -0.01],
  [-0.01, 0.002, 0.01],
];

/** Géranium : rosette de feuilles arrondies et ombelles de fleurs portées par des tiges. */
function Geranium({ position, color, rand }) {
  const light = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.28).getStyle();
  const leaves = Array.from({ length: 7 }, (_, k) => (k / 7) * Math.PI * 2 + rand() * 0.4);
  const umbels = [0, 1, 2].map((k) => ({ a: (k / 3) * Math.PI * 2 + rand(), d: 0.012 + rand() * 0.022, h: 0.09 + rand() * 0.06 }));
  return (
    <group position={position} rotation={[0, rand() * Math.PI * 2, 0]}>
      {leaves.map((a, k) => (
        <group key={`l${k}`} rotation={[0, -a, 0]}>
          <Ball shape="dodeca" scale={[0.068, 0.012, 0.058]} position={[0.036, 0.028 + (k % 2) * 0.014, 0]} rotation={[0, 0, 0.32]} color={k % 2 ? '#4d7a38' : '#5b8743'} rough={0.8} />
        </group>
      ))}
      {umbels.map((u, k) => (
        <group key={`u${k}`} position={[Math.cos(u.a) * u.d, 0, Math.sin(u.a) * u.d]}>
          <Cylinder position={[0, u.h / 2, 0]} radius={0.0035} height={u.h} segments={5} color="#5d7d3c" rough={0.8} />
          {FLORETS.map(([x, y, z], j) => (
            <Ball key={j} shape="icosa" radius={0.0105} position={[x, u.h + y, z]} color={j % 3 ? color : light} rough={0.65} />
          ))}
        </group>
      ))}
    </group>
  );
}

/** Touffe de lavande : coussin gris-vert d'où partent des tiges fines et des épis violets. */
function Lavender({ position, rand }) {
  return (
    <group position={position}>
      <Leaves position={[0, 0.035, 0]} scale={[0.15, 0.08, 0.15]} color="#7f9468" />
      {Array.from({ length: 11 }, (_, k) => {
        const a = (k / 11) * Math.PI * 2 + rand();
        const lean = 0.1 + rand() * 0.22;
        const h = 0.16 + rand() * 0.07;
        return (
          <group key={k} rotation={[Math.sin(a) * lean, 0, -Math.cos(a) * lean]}>
            <Cylinder position={[0, h / 2, 0]} radius={0.0025} height={h} segments={4} color="#7d9064" rough={0.85} />
            <Ball scale={[0.017, 0.058, 0.017]} position={[0, h + 0.022, 0]} color={k % 2 ? '#76659f' : '#8a77b8'} rough={0.75} />
          </group>
        );
      })}
    </group>
  );
}

/** Touffe de graminée : lames fines qui s'évasent en gerbe. */
function GrassTuft({ position, rand }) {
  return (
    <group position={position} rotation={[0, rand() * Math.PI, 0]}>
      {Array.from({ length: 14 }, (_, k) => {
        const a = (k / 14) * Math.PI * 2 + rand() * 0.5;
        const lean = 0.25 + rand() * 0.4;
        const h = 0.15 + rand() * 0.09;
        return (
          <group key={k} rotation={[0, -a, 0]}>
            <Box size={[0.008, h, 0.002]} position={[Math.sin(lean) * (h / 2), Math.cos(lean) * (h / 2), 0]} rotation={[0, 0, -lean]} color={k % 3 ? '#8ea35c' : '#b0b974'} rough={0.85} />
          </group>
        );
      })}
    </group>
  );
}

/**
 * Brin de lierre retombant d'un rebord (`side` : face +Z ou −Z) : feuilles alternées qui passent par-dessus le
 * couronnement puis descendent le long de la face.
 */
function IvyStrand({ position, side, count, rand }) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, k) => {
        const over = k < 2;
        const y = over ? 0.012 - k * 0.006 : -(k - 1) * 0.026;
        const z = side * (over ? k * 0.03 : 0.035 - Math.min(0.022, (k - 2) * 0.006));
        const x = (k % 2 ? 1 : -1) * (0.012 + rand() * 0.01);
        return (
          <Ball
            key={k}
            shape="dodeca"
            scale={[0.044, 0.038, 0.009]}
            position={[x, y, z]}
            rotation={[over ? side * 1.2 : side * 0.15, 0, (k % 2 ? 1 : -1) * 0.5]}
            color={k % 3 ? '#3e6431' : '#4d763b'}
            rough={0.7}
          />
        );
      })}
    </group>
  );
}

/**
 * Jardinière de pierre (1,6 × 0,6 m) : socle, corps à panneaux en creux, couronnement mouluré, terreau ; buis
 * taillés et lavande au centre, géraniums en bordure, graminées aux angles, lierre retombant sur les faces.
 * Bouquet et couleurs propres à chaque bac (`seed`).
 */
export function Planter({ color = STONE_DARK, seed = 0 }) {
  let n = 0;
  const rand = () => seeded(seed * 41.3 + 7 + (n += 1));
  const [L, D, H] = [1.6, 0.6, 0.5];
  const first = Math.floor(seed * 6);
  const palette = [0, 1, 2, 3, 4, 5].map((i) => FLOWERS[(i + first) % FLOWERS.length]).filter((c) => c !== '#8a6bb0');
  const darker = new THREE.Color(color).multiplyScalar(0.86).getStyle();
  const lighter = new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.25).getStyle();
  const soil = H + 0.027;
  return (
    <group>
      {/* Bac de pierre : socle, corps à panneaux en creux, couronnement mouluré */}
      <Box size={[L + 0.06, 0.06, D + 0.06]} position={[0, 0.03, 0]} color={darker} rough={0.85} />
      <Box size={[L, H - 0.12, D]} position={[0, 0.06 + (H - 0.12) / 2, 0]} color={color} rough={0.85} />
      {[-1, 1].map((side) =>
        [-0.39, 0.39].map((x) => <Box key={`${side}${x}`} size={[0.62, H - 0.26, 0.006]} position={[x, 0.06 + (H - 0.12) / 2, side * (D / 2 + 0.003)]} color={darker} rough={0.9} />)
      )}
      {[-1, 1].map((side) => (
        <Box key={side} size={[0.006, H - 0.26, D - 0.18]} position={[side * (L / 2 + 0.003), 0.06 + (H - 0.12) / 2, 0]} color={darker} rough={0.9} />
      ))}
      <Box size={[L + 0.04, 0.02, D + 0.04]} position={[0, H - 0.07, 0]} color={color} rough={0.85} />
      <Box size={[L + 0.09, 0.06, D + 0.09]} position={[0, H - 0.03, 0]} color={lighter} rough={0.8} />
      {/* Terreau entre les rebords, paillage clair par endroits */}
      <Box size={[L - 0.08, 0.03, D - 0.08]} position={[0, H + 0.012, 0]} color="#3b2a1e" rough={0.95} />
      {Array.from({ length: 14 }, (_, i) => (
        <Box key={`p${i}`} size={[0.03, 0.006, 0.014]} position={[-0.7 + rand() * 1.4, soil + 0.002, (rand() - 0.5) * 0.44]} rotation={[0, rand() * Math.PI, 0]} color="#6b4f36" rough={0.95} />
      ))}
      {/* Buis taillés en boule (trois masses chacun : silhouette irrégulière) */}
      {[-0.5, 0, 0.5].map((x, i) => (
        <group key={`buis${i}`} position={[x, soil, 0]}>
          <Leaves position={[0, 0.13, 0]} scale={[0.26, 0.24, 0.25]} color={i === 1 ? '#3f6532' : '#476f37'} />
          <Leaves position={[0.05, 0.19, 0.03]} scale={[0.15, 0.13, 0.14]} color="#4f7a3d" />
          <Leaves position={[-0.06, 0.1, -0.05]} scale={[0.16, 0.14, 0.15]} color="#3b5f2e" />
        </group>
      ))}
      {/* Lavande entre les buis */}
      {[-0.25, 0.25].map((x) => (
        <Lavender key={`lav${x}`} position={[x, soil, 0]} rand={rand} />
      ))}
      {/* Géraniums en bordure, devant et derrière */}
      {[-1, 1].map((side) =>
        [-0.6, -0.2, 0.2, 0.6].map((x, i) => (
          <Geranium key={`g${side}${i}`} position={[x + (rand() - 0.5) * 0.06, soil, side * 0.19]} color={palette[(i + (side > 0 ? 1 : 0)) % palette.length]} rand={rand} />
        ))
      )}
      {/* Graminées aux angles */}
      {[-1, 1].map((sx) => [-1, 1].map((sz) => <GrassTuft key={`h${sx}${sz}`} position={[sx * 0.73, soil, sz * 0.2]} rand={rand} />))}
      {/* Lierre retombant par-dessus le couronnement */}
      {[-1, 1].map((side) =>
        [-0.66, -0.3, 0.06, 0.42].map((x, i) => (
          <IvyStrand key={`ivy${side}${i}`} position={[x + (rand() - 0.5) * 0.12, H + 0.01, side * (D / 2 + 0.03)]} side={side} count={6 + Math.floor(rand() * 5)} rand={rand} />
        ))
      )}
    </group>
  );
}

/** Lanterne de ville (mât de fonte, lanterne vitrée). */
export function TownLamp({ color = IRON }) {
  return (
    <group>
      <Cylinder radius={0.13} height={0.35} top={0.6} position={[0, 0.175, 0]} color={color} metal={0.6} rough={0.4} />
      <Cylinder radius={0.05} height={2.4} top={0.7} position={[0, 1.55, 0]} color={color} metal={0.6} rough={0.4} />
      <Cylinder radius={0.13} height={0.05} position={[0, 2.77, 0]} color={color} metal={0.6} rough={0.4} />
      <Cylinder radius={0.17} height={0.38} top={1.35} segments={6} position={[0, 2.98, 0]} color="#fde68a" glow={1.6} opacity={0.9} shadow={false} />
      <Cylinder radius={0.25} height={0.2} top={0} segments={6} position={[0, 3.27, 0]} color={color} metal={0.6} rough={0.4} />
    </group>
  );
}

/** Perron de trois marches (du sol au dessus de dalle), devant une porte. */
export function Steps({ width = 3.4 }) {
  const rise = SLAB / 3;
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <Box key={i} size={[width - i * 0.12, rise, 1.05 - i * 0.33]} position={[0, rise * (i + 0.5), -0.165 * i]} color={i % 2 ? STONE : STONE_DARK} rough={0.85} receive />
      ))}
    </group>
  );
}
