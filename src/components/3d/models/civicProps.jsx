import React from 'react';
import * as THREE from 'three';
import { Box, Cylinder, Ball, seeded } from './kit';

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

/** Cadran d'horloge (chiffres romains, aiguilles à 10 h 10) : campanile, horloge comtoise. */
export const clockFace = () =>
  canvasTexture('clock-face', 256, 256, (ctx, w) => {
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
 * niveaux ; `firstLevel` : premier niveau percé (1 : pas de fenêtre au rez-de-chaussée, au-dessus d'une porte).
 */
export function FacadeWindows({ length = 12, floors = 2, firstLevel = 0, baseLevel = 0 }) {
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
            {storey > 0 && <Balconnet y={0} />}
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
  const face = clockFace();
  return (
    <group>
      <Box size={[1.6, 1.6, 1.6]} position={[0, 0.8, 0]} color={STONE} rough={0.85} />
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => (
        <group key={a} rotation={[0, a, 0]}>
          <Box size={[1.06, 1.06, 0.04]} position={[0, 0.86, 0.81]} map={face} rough={0.6} />
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

/* ------------------------------------------------------------------ */
/* Espace public                                                        */
/* ------------------------------------------------------------------ */

/** Mât (≈ 6,3 m) et drapeau tendu vers +X. */
export function Flagpole({ flag = 'fr' }) {
  return (
    <group>
      <Cylinder radius={0.16} height={0.14} position={[0, 0.07, 0]} color={STONE_DARK} rough={0.85} />
      <Cylinder radius={0.035} height={4.2} top={0.7} position={[0, 2.24, 0]} color={FRAME} metal={0.5} rough={0.35} />
      <Ball radius={0.07} position={[0, 4.38, 0]} color={GOLD} metal={0.8} rough={0.3} />
      <Box size={[1.2, 0.8, 0.02]} position={[0.62, 3.82, 0]} map={flag === 'eu' ? europeanFlag() : frenchFlag()} rough={0.8} />
    </group>
  );
}

/** Fontaine de place : bassin octogonal, colonne et vasque. */
export function Fountain() {
  return (
    <group>
      <Cylinder radius={1.3} height={0.45} segments={8} position={[0, 0.225, 0]} color={STONE_DARK} rough={0.85} />
      {/* Plan d'eau 4 cm au-dessus du bassin (pas de faces confondues) */}
      <Cylinder radius={1.15} height={0.04} segments={8} position={[0, 0.47, 0]} color="#38bdf8" metal={0.3} rough={0.1} glow={0.15} />
      <Cylinder radius={0.2} height={1.1} top={0.75} position={[0, 0.95, 0]} color={STONE} rough={0.85} />
      <Cylinder radius={0.55} height={0.14} top={1.2} position={[0, 1.5, 0]} color={STONE} rough={0.85} />
      <Cylinder radius={0.5} height={0.03} position={[0, 1.6, 0]} color="#7dd3fc" metal={0.3} rough={0.1} glow={0.2} />
      <Ball radius={0.12} position={[0, 1.72, 0]} color="#bae6fd" opacity={0.75} />
    </group>
  );
}

const FLOWERS = ['#dc2626', '#f472b6', '#facc15', '#a855f7', '#f97316', '#ffffff'];

/** Jardinière fleurie (bac de pierre ou de bois, terreau, feuillage et fleurs). */
export function Planter({ color = STONE_DARK }) {
  // Pseudo-aléatoire déterministe : même bouquet à chaque rendu
  let n = 0;
  const rand = () => seeded(7 + (n += 1));
  return (
    <group>
      <Box size={[1.6, 0.5, 0.6]} position={[0, 0.25, 0]} color={color} rough={0.85} />
      <Box size={[1.5, 0.04, 0.5]} position={[0, 0.5, 0]} color="#3f2a1d" rough={0.95} />
      {[-0.5, 0, 0.5].map((x) => (
        <Ball key={x} radius={0.24} position={[x, 0.62, 0]} color="#15803d" shape="dodeca" flat />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <Ball key={i} radius={0.06} position={[-0.68 + rand() * 1.36, 0.72 + rand() * 0.12, -0.18 + rand() * 0.36]} color={FLOWERS[i % FLOWERS.length]} />
      ))}
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
