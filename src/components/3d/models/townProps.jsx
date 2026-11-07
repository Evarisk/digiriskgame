import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Ball, Car, Van, Truck, DYNAMIC, getMaterial, noRaycast, seeded } from './kit';
import { canvasTexture } from './civicProps';
import { Leaves } from './natureProps';
import { LodPerson, useDistanceLod, forgetLimbs } from './personLod';
import { digiriskPoster } from './cardGameProps';
import { visit, bodies } from '../../../services/visitState';
import { LANE, stepTraffic } from '../../../services/trafficLogic';

/**
 * La ville autour de la mairie, pour l'éditeur de site : toitures à deux pans des bâtiments techniques,
 * bandeaux vitrés, enseignes, maisons de ville à commerces (boulangerie, café, pharmacie, tabac-presse,
 * fleuriste, boucherie), terrasse de café, abribus, circulation animée, école et loisirs (préau, structure
 * de jeux, marelle, enfants qui jouent), cour des services techniques (alvéoles de matériaux, benne), point
 * de tri, mobilier urbain (panneau d'affichage, boîte aux lettres, corbeille, arceaux à vélos, haie).
 * Origine au sol, face à +Z, 1 unité ≈ 1,5 m.
 */

const ALU = '#a7aeb5';
const IRON = '#2b3138';
const STONE = '#e3d8c3';

/* ------------------------------------------------------------------ */
/* Bâtiments : toiture, bandeau vitré, enseigne                         */
/* ------------------------------------------------------------------ */

const gableCache = new Map();
/** Pignon triangulaire (base `depth`, hauteur `height`, épaisseur 0,2) dans le plan YZ. */
function gableGeometry(depth, height) {
  const key = `${depth}|${height}`;
  if (!gableCache.has(key)) {
    const shape = new THREE.Shape();
    shape.moveTo(-depth / 2, 0);
    shape.lineTo(depth / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    geo.translate(-0.1, 0, 0);
    gableCache.set(key, geo);
  }
  return gableCache.get(key);
}

/**
 * Toiture à deux pans en bac acier (faîtage selon X) posée sur les murs : nervures, faîtière, plaques
 * translucides d'éclairage zénithal, pignons fermés (couleur des murs), gouttières en bas de pente.
 * Origine : dessus des murs (`elevation` : hauteur des murs, conservé pour compatibilité).
 */
export function GableRoof({ width = 20, depth = 16, height = 2.4, color = '#6b7480', gable = '#9aa8b8', elevation = 4.4, skylights = 1 }) {
  const ov = 0.35;
  const half = depth / 2;
  const angle = Math.atan2(height, half);
  const run = half + ov;
  const slope = run / Math.cos(angle);
  const eaveY = height - run * Math.tan(angle);
  const span = width + 2 * ov;
  const ribs = Math.floor(span / 0.34);
  const lights = skylights > 0 ? Math.max(1, Math.floor(width / 4)) : 0;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[0, (height + eaveY) / 2, (side * run) / 2]} rotation={[side * angle, 0, 0]}>
          <Box size={[span, 0.05, slope]} color={color} metal={0.45} rough={0.5} />
          {Array.from({ length: ribs }, (_, i) => (
            <Box key={i} size={[0.035, 0.03, slope]} position={[-span / 2 + 0.17 + i * 0.34, 0.035, 0]} color={color} metal={0.5} rough={0.42} shadow={false} />
          ))}
          {Array.from({ length: lights }, (_, i) => (
            <Box key={`l${i}`} size={[1.1, 0.02, slope * 0.5]} position={[-width / 2 + (i + 0.5) * (width / lights), 0.04, 0]} color="#dce7ee" opacity={0.75} rough={0.2} shadow={false} />
          ))}
          {/* Gouttière en bas de pente */}
          <Cylinder position={[0, -0.06, side * (slope / 2)]} rotation={[0, 0, Math.PI / 2]} radius={0.065} height={span} segments={10} color={ALU} metal={0.6} rough={0.4} />
        </group>
      ))}
      <Box size={[span, 0.09, 0.32]} position={[0, height + 0.04, 0]} color={color} metal={0.5} rough={0.42} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={gableGeometry(depth, height)} material={getMaterial({ color: gable, roughness: 0.75, metalness: 0.1 })} position={[s * (width / 2 - 0.1), 0, 0]} castShadow receiveShadow raycast={noRaycast} />
      ))}
    </group>
  );
}

/** Bandeau vitré (menuiserie aluminium, vitrage teinté, meneaux tous les 1,2), posé contre une façade (face +Z). */
export function RibbonWindows({ length = 6, height = 0.9 }) {
  const n = Math.max(1, Math.round(length / 1.2));
  return (
    <group>
      <Box size={[length + 0.1, height + 0.1, 0.05]} position={[0, height / 2, 0.025]} color="#59616a" metal={0.6} rough={0.4} />
      <Box size={[length, height, 0.02]} position={[0, height / 2, 0.056]} color="#2c3a46" metal={0.6} rough={0.1} />
      {Array.from({ length: n + 1 }, (_, i) => (
        <Box key={i} size={[0.045, height, 0.04]} position={[-length / 2 + (i * length) / n, height / 2, 0.07]} color="#59616a" metal={0.6} rough={0.4} />
      ))}
      <Box size={[length, 0.035, 0.04]} position={[0, height * 0.62, 0.07]} color="#59616a" metal={0.6} rough={0.4} />
      <Box size={[length + 0.18, 0.04, 0.14]} position={[0, -0.02, 0.07]} color={ALU} metal={0.6} rough={0.4} />
    </group>
  );
}

/** Texte sur une ligne ajusté à la largeur disponible (taille de police réduite si besoin). */
function fitText(ctx, text, x, y, maxWidth, size, font) {
  const family = font.includes('serif') ? 'Georgia, serif' : 'Arial, sans-serif';
  const weight = font.replace('serif', '').trim();
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 8) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

/**
 * Enseigne murale (texte = libellé de l'élément) : `municipal` (panneau bleu marine, bande tricolore,
 * lettres blanches), `stone` (plaque de pierre gravée, ancienne école). Face +Z.
 */
export function WallSign({ text = 'SERVICES TECHNIQUES', width = 6, style = 0 }) {
  const stone = style === 1;
  const height = width * (stone ? 0.14 : 0.12);
  const map = canvasTexture(`enseigne|${style}|${text}`, 1024, Math.round(1024 * (height / width)), (ctx, w, h) => {
    if (stone) {
      ctx.fillStyle = '#e6dcc7';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b9ab90';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      fitText(ctx, text.toUpperCase(), w / 2 + 2, h / 2 + 3, w - 80, h * 0.5, 'bold serif');
      ctx.fillStyle = '#5a4a32';
      fitText(ctx, text.toUpperCase(), w / 2, h / 2, w - 80, h * 0.5, 'bold serif');
    } else {
      ctx.fillStyle = '#1d3557';
      ctx.fillRect(0, 0, w, h);
      ['#1f3f8f', '#f4f4f0', '#c8323a'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(18 + i * 16, 14, 16, h - 28);
      });
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(ctx, text.toUpperCase(), w / 2 + 34, h / 2 + 2, w - 140, h * 0.5, '800');
      ctx.fillStyle = '#e8772e';
      ctx.fillRect(110, h - 16, w - 140, 5);
    }
  });
  return (
    <group>
      <Box size={[width + 0.06, height + 0.06, 0.05]} position={[0, height / 2, 0.025]} color={stone ? '#cbbd9f' : '#c5ccd3'} metal={stone ? 0 : 0.5} rough={0.5} />
      <Box size={[width, height, 0.02]} position={[0, height / 2, 0.06]} map={map} rough={0.6} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Maisons de ville et commerces                                       */
/* ------------------------------------------------------------------ */

export const SHOPS = [
  null,
  { name: 'BOULANGERIE · PÂTISSERIE', color: '#6e4426', stripes: ['#f3e7cf', '#6e4426'], goods: ['#c98a43', '#e2b46a', '#a5642c', '#f0d9a6'] },
  { name: 'CAFÉ DE LA MAIRIE', color: '#6f1d22', stripes: ['#f4efe6', '#8f2a2e'], goods: ['#3b2a20', '#c9b79a', '#7a5a3a', '#e9e1d2'] },
  { name: 'PHARMACIE', color: '#1d6847', stripes: ['#e8f1ec', '#1d6847'], goods: ['#f2f2f2', '#8fc7a8', '#d9e8f2', '#2f8f5f'] },
  { name: 'TABAC · PRESSE', color: '#1f355f', stripes: ['#eef0f4', '#1f355f'], goods: ['#c8323a', '#e8c547', '#3d7cc9', '#f2f2f2'] },
  { name: 'FLEURISTE', color: '#3d6338', stripes: ['#f1efe4', '#5b8a45'], goods: ['#d9477a', '#f2b134', '#c8323a', '#f4f1ea'] },
  { name: 'BOUCHERIE · CHARCUTERIE', color: '#7d1f28', stripes: ['#f4efe6', '#a3272f'], goods: ['#b4373d', '#e6c7b0', '#8a2a2a', '#f1e3d3'] },
  { name: 'COIFFURE', color: '#2f2f35', stripes: ['#f2f2f2', '#2f2f35'], goods: ['#e8e6e1', '#3a3a40', '#c9a27a', '#f2f2f2'] },
  { name: 'LIBRAIRIE · PAPETERIE', color: '#24486b', stripes: ['#eef2f6', '#24486b'], goods: ['#c8323a', '#3d7cc9', '#e8c547', '#4caf6a'] },
  { name: 'ÉPICERIE · PRIMEUR', color: '#4b6b2a', stripes: ['#f3efe2', '#5f8a33'], goods: ['#d9473f', '#f2b134', '#7fb046', '#e57a2e'] },
];
const FACADES = ['#e9dcc3', '#dcc8a6', '#efe6d6', '#d4c0a0', '#e6d3bb', '#cfd3cf'];
const SHUTTERS = ['#5b7f8f', '#6d8a5a', '#8f4a3a', '#7d8a96', '#3f5f7a', '#a39477'];
const FLOOR = 2; // hauteur d'étage d'une maison de ville (3 m)

const tileMaterials = new Map();
/** Couverture en tuiles (rangs ondulés) ou en ardoises, texture répétée selon la taille du pan. */
function roofMaterial(slate, width, length) {
  const key = `${slate}|${width}|${length}`;
  if (!tileMaterials.has(key)) {
    const base = canvasTexture(`couverture|${slate}`, 128, 128, (ctx, w, h) => {
      ctx.fillStyle = slate ? '#4f5a66' : '#a2512f';
      ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < 8; row += 1) {
        const y = row * 16;
        for (let col = 0; col < 8; col += 1) {
          const x = col * 16 + (row % 2 ? 8 : 0);
          const g = ctx.createLinearGradient(0, y, 0, y + 16);
          g.addColorStop(0, slate ? '#5d6976' : '#b9603a');
          g.addColorStop(1, slate ? '#3e4751' : '#86401f');
          ctx.fillStyle = g;
          ctx.fillRect(x + 1, y + 1, 14, 14);
        }
      }
    });
    const map = base.clone();
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(width / 1.2, length / 1.2);
    map.needsUpdate = true;
    tileMaterials.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: slate ? 0.15 : 0 }));
  }
  return tileMaterials.get(key);
}

/** Store banne rayé (texture aux couleurs du commerce). */
function awningMap(shop) {
  return canvasTexture(`store|${shop.stripes.join()}`, 256, 64, (ctx, w, h) => {
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = shop.stripes[i % 2];
      ctx.fillRect(i * 16, 0, 16, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, h - 10, w, 10);
  });
}

/** Enseigne en bandeau au-dessus de la vitrine. */
function shopSignMap(shop) {
  return canvasTexture(`commerce|${shop.name}`, 1024, 128, (ctx, w, h) => {
    ctx.fillStyle = shop.color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#f6efe0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, shop.name, w / 2, h / 2 + 3, w - 60, 66, 'bold serif');
  });
}

/** Fenêtre d'étage : encadrement, vitrage, petits bois, appui, volets battants ouverts, garde-corps éventuel. */
function HouseWindow({ x, y, shutter, rail }) {
  const w = 0.62;
  const h = 0.95;
  return (
    <group position={[x, y, 0]}>
      <Box size={[w + 0.14, h + 0.14, 0.05]} position={[0, h / 2, 0.02]} color={STONE} rough={0.8} />
      <Box size={[w, h, 0.03]} position={[0, h / 2, 0.04]} color="#33414d" metal={0.5} rough={0.12} />
      <Box size={[0.035, h, 0.04]} position={[0, h / 2, 0.06]} color="#f2f0ea" rough={0.5} />
      <Box size={[w, 0.03, 0.04]} position={[0, h * 0.6, 0.06]} color="#f2f0ea" rough={0.5} />
      <Box size={[w + 0.22, 0.05, 0.13]} position={[0, -0.02, 0.06]} color={STONE} rough={0.8} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2 + 0.2), h / 2, 0.06]} rotation={[0, -s * 0.25, 0]}>
          <Box size={[0.34, h, 0.03]} color={shutter} rough={0.7} />
          {[-0.3, 0, 0.3].map((yy) => (
            <Box key={yy} size={[0.3, 0.02, 0.012]} position={[0, yy * h, 0.02]} color={shutter} rough={0.6} />
          ))}
        </group>
      ))}
      {rail && (
        <group position={[0, 0.02, 0.14]}>
          <Box size={[w + 0.1, 0.03, 0.03]} position={[0, 0.36, 0]} color={IRON} metal={0.5} rough={0.5} />
          {Array.from({ length: 7 }, (_, i) => (
            <Box key={i} size={[0.018, 0.36, 0.018]} position={[-0.33 + i * 0.11, 0.18, 0]} color={IRON} metal={0.5} rough={0.5} />
          ))}
        </group>
      )}
    </group>
  );
}

/**
 * Maison de ville mitoyenne (façade +Z à z = 0, profondeur 5) : enduit coloré, soubassement, bandeaux,
 * corniche, fenêtres à volets, toit à deux pans en tuiles ou ardoises avec cheminée et lucarne ; au
 * rez-de-chaussée un commerce (`shop` 1 à 6 : vitrine éclairée garnie, porte vitrée, store banne, enseigne,
 * croix verte de la pharmacie, carotte du tabac) ou une porte d'entrée.
 */
export function TownHouse({ width = 6, floors = 3, shop = 0, facade = 0, slate = 0, seed = 0 }) {
  const D = 5;
  const H = floors * FLOOR + 0.25;
  const color = FACADES[facade % FACADES.length];
  const shutter = SHUTTERS[(facade + Math.floor(seed * 6)) % SHUTTERS.length];
  const info = SHOPS[shop] || null;
  const cols = Math.max(1, Math.floor((width - 0.6) / 1.55));
  const xs = Array.from({ length: cols }, (_, i) => (i - (cols - 1) / 2) * ((width - 0.8) / Math.max(cols, 1)));
  const roofH = 1.7;
  const ov = 0.25;
  const angle = Math.atan2(roofH, D / 2);
  const slope = (D / 2 + ov) / Math.cos(angle);
  const dark = new THREE.Color(color).multiplyScalar(0.8).getStyle();
  return (
    <group>
      {/* Corps de bâtiment, soubassement, bandeaux d'étage, corniche */}
      <Box size={[width, H, D]} position={[0, H / 2, -D / 2]} color={color} rough={0.9} />
      <Box size={[width + 0.02, 0.45, 0.06]} position={[0, 0.225, 0.03]} color={dark} rough={0.85} />
      {Array.from({ length: floors - 1 }, (_, f) => (
        <Box key={f} size={[width + 0.02, 0.09, 0.07]} position={[0, (f + 1) * FLOOR + 0.05, 0.035]} color={STONE} rough={0.8} />
      ))}
      <Box size={[width + 0.12, 0.2, 0.24]} position={[0, H - 0.1, 0.06]} color={STONE} rough={0.8} />
      {/* Fenêtres des étages */}
      {Array.from({ length: floors - 1 }, (_, f) => xs.map((x, i) => <HouseWindow key={`${f}${i}`} x={x} y={(f + 1) * FLOOR + 0.45} shutter={shutter} rail={f === 0 && (i + Math.floor(seed * 3)) % 2 === 0} />))}
      {/* Toit à deux pans, pignons, cheminée, lucarne */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={roofMaterial(slate, width + 0.3, slope)} position={[0, H + (roofH - (ov * roofH) / (D / 2)) / 2, -D / 2 + (side * (D / 2 + ov)) / 2]} rotation={[side * angle, 0, 0]} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[width + 0.3, 0.07, slope]} />
        </mesh>
      ))}
      <Box size={[width + 0.3, 0.08, 0.22]} position={[0, H + roofH + 0.02, -D / 2]} color={slate ? '#3e4751' : '#7d3a1d'} rough={0.7} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={gableGeometry(D, roofH)} material={getMaterial({ color, roughness: 0.9, metalness: 0 })} position={[s * (width / 2 - 0.1), H, -D / 2]} castShadow receiveShadow raycast={noRaycast} />
      ))}
      <group position={[width / 2 - 0.7 - seeded(seed * 9) * (width - 1.6), H + roofH * 0.55, -D / 2 - 0.9]}>
        <Box size={[0.5, 1.3, 0.4]} position={[0, 0.4, 0]} color={dark} rough={0.85} />
        <Box size={[0.6, 0.08, 0.5]} position={[0, 1.06, 0]} color={STONE} rough={0.8} />
        {[-0.1, 0.1].map((x) => (
          <Cylinder key={x} position={[x, 1.16, 0]} radius={0.05} height={0.14} color="#9a5a3a" rough={0.8} />
        ))}
      </group>
      {floors >= 3 && (
        <group position={[xs[0], H + 0.2, -0.55]}>
          <Box size={[0.8, 0.85, 0.9]} position={[0, 0.42, 0]} color={color} rough={0.9} />
          <Box size={[0.5, 0.6, 0.02]} position={[0, 0.4, 0.46]} color="#33414d" metal={0.5} rough={0.12} />
          <group position={[0, 0.85, 0]} rotation={[0, 0, 0]}>
            <Box size={[0.95, 0.06, 1.0]} position={[0, 0.02, 0]} color={slate ? '#4f5a66' : '#a2512f'} rough={0.8} />
          </group>
        </group>
      )}
      {/* Rez-de-chaussée */}
      {info ? (
        <group>
          {/* Devanture en bois peint : vitrine éclairée garnie de produits, porte vitrée, enseigne, store banne */}
          <Box size={[width - 0.3, 1.75, 0.08]} position={[0, 0.95, 0.04]} color={info.color} rough={0.6} />
          <Box size={[width - 1.6, 1.15, 0.03]} position={[-0.45, 1.05, 0.09]} color="#cfdbe2" opacity={0.35} metal={0.5} rough={0.08} shadow={false} />
          <Box size={[width - 1.7, 1.1, 0.02]} position={[-0.45, 1.05, -0.05]} color="#f3dcae" glow={0.28} rough={0.8} />
          {[0.62, 0.95, 1.3].map((y, r) =>
            Array.from({ length: Math.max(2, Math.floor((width - 1.9) / 0.32)) }, (_, i) => (
              <Box key={`${r}${i}`} size={[0.22, 0.14 + seeded(seed * 3 + i + r * 7) * 0.08, 0.12]} position={[-0.45 - (width - 2.1) / 2 + 0.15 + i * 0.32, y + 0.08, 0.0]} color={info.goods[(i + r) % info.goods.length]} rough={0.6} />
            ))
          )}
          <Box size={[0.75, 1.55, 0.04]} position={[width / 2 - 0.75, 0.85, 0.1]} color="#cfdbe2" opacity={0.4} metal={0.5} rough={0.08} shadow={false} />
          <Box size={[0.04, 0.3, 0.05]} position={[width / 2 - 1.0, 0.85, 0.13]} color="#c9b178" metal={0.8} rough={0.3} />
          <Box size={[width - 0.2, 0.36, 0.06]} position={[0, 1.95, 0.08]} map={shopSignMap(info)} rough={0.6} />
          <group position={[0, 1.78, 0.12]} rotation={[0.45, 0, 0]}>
            <Box size={[width - 0.3, 0.02, 0.95]} position={[0, 0, 0.47]} map={awningMap(info)} rough={0.85} />
            <Box size={[width - 0.3, 0.16, 0.01]} position={[0, -0.07, 0.95]} map={awningMap(info)} rough={0.85} />
          </group>
          {shop === 3 && (
            // Croix verte lumineuse en drapeau
            <group position={[width / 2 - 0.15, 2.4, 0.35]}>
              <Box size={[0.05, 0.05, 0.3]} position={[0, 0, -0.15]} color={IRON} metal={0.5} rough={0.5} />
              <Box size={[0.06, 0.5, 0.17]} position={[0, 0, 0.1]} color="#22c55e" glow={1.6} shadow={false} />
              <Box size={[0.06, 0.17, 0.5]} position={[0, 0, 0.1]} color="#22c55e" glow={1.6} shadow={false} />
            </group>
          )}
          {shop === 4 && (
            // Carotte rouge du bureau de tabac
            <group position={[width / 2 - 0.15, 2.45, 0.35]}>
              <Box size={[0.05, 0.05, 0.3]} position={[0, 0, -0.15]} color={IRON} metal={0.5} rough={0.5} />
              <Box size={[0.06, 0.55, 0.22]} position={[0, 0, 0.1]} color="#c8323a" glow={0.5} />
            </group>
          )}
        </group>
      ) : (
        <group>
          {/* Porte d'entrée à imposte et fenêtre(s) à volets */}
          <Box size={[0.95, 1.85, 0.06]} position={[xs[xs.length - 1], 0.93, 0.03]} color={STONE} rough={0.8} />
          <Box size={[0.75, 1.5, 0.04]} position={[xs[xs.length - 1], 0.8, 0.06]} color={shutter} rough={0.55} />
          <Box size={[0.75, 0.25, 0.03]} position={[xs[xs.length - 1], 1.68, 0.06]} color="#33414d" metal={0.5} rough={0.12} />
          {xs.slice(0, -1).map((x) => (
            <HouseWindow key={x} x={x} y={0.6} shutter={shutter} />
          ))}
        </group>
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Terrasse de café, abribus, circulation                               */
/* ------------------------------------------------------------------ */

/** Terrasse de café : guéridons ronds, chaises bistrot, parasols, tasses ; `tables` en rangée selon X. */
export function CafeTerrace({ tables = 4, color = '#6f1d22' }) {
  const xs = Array.from({ length: tables }, (_, i) => (i - (tables - 1) / 2) * 1.25);
  return (
    <group>
      {xs.map((x, i) => (
        <group key={x} position={[x, 0, 0]}>
          <Cylinder position={[0, 0.01, 0]} radius={0.14} height={0.02} color={IRON} metal={0.6} rough={0.4} />
          <Cylinder position={[0, 0.25, 0]} radius={0.018} height={0.48} color={IRON} metal={0.6} rough={0.4} />
          <Cylinder position={[0, 0.49, 0]} radius={0.26} height={0.02} segments={24} color="#e8e3d8" rough={0.4} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.42, 0, 0]} rotation={[0, s * -Math.PI / 2, 0]}>
              {/* Chaise bistrot : assise tressée, dossier cintré, pieds */}
              <Box size={[0.3, 0.03, 0.28]} position={[0, 0.3, 0]} color="#b38b55" rough={0.8} />
              <Box size={[0.3, 0.26, 0.03]} position={[0, 0.46, -0.14]} color="#b38b55" rough={0.8} />
              {[[-0.13, -0.12], [0.13, -0.12], [-0.13, 0.12], [0.13, 0.12]].map(([lx, lz]) => (
                <Cylinder key={`${lx}${lz}`} position={[lx, 0.15, lz]} radius={0.012} height={0.3} color={IRON} metal={0.5} rough={0.5} />
              ))}
            </group>
          ))}
          {[-0.08, 0.1].map((cx) => (
            <group key={cx} position={[cx, 0.5, cx * 0.5]}>
              <Cylinder position={[0, 0.003, 0]} radius={0.04} height={0.005} color="#f4f1ea" rough={0.4} />
              <Cylinder position={[0, 0.028, 0]} radius={0.022} top={1.1} height={0.045} color="#f4f1ea" rough={0.4} />
            </group>
          ))}
          {i % 2 === 0 && (
            <group position={[0.62, 0, 0]}>
              <Cylinder position={[0, 0.85, 0]} radius={0.02} height={1.7} color="#d9d4c8" rough={0.5} />
              <Cylinder position={[0, 1.66, 0]} radius={1.05} top={0.04} height={0.36} segments={8} color={color} rough={0.85} />
              <Cylinder position={[0, 1.47, 0]} radius={1.06} height={0.06} segments={8} openEnded color={color} rough={0.85} />
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

/** Abribus vitré : toit, banc, affiche publicitaire (jeu de cartes DigiRisk), poteau d'arrêt. Ouvert vers +Z. */
export function BusShelter() {
  return (
    <group>
      {[[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.4], [1.1, 0.4]].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.05, 1.6, 0.05]} position={[x, 0.8, z]} color={IRON} metal={0.6} rough={0.4} />
      ))}
      <Box size={[2.5, 0.06, 1.15]} position={[0, 1.63, -0.02]} color="#3a434c" metal={0.4} rough={0.4} />
      <Box size={[2.4, 0.03, 1.05]} position={[0, 1.6, -0.02]} color="#c9dbe6" opacity={0.6} rough={0.1} shadow={false} />
      <Box size={[2.2, 1.35, 0.02]} position={[0, 0.85, -0.45]} color="#c9dbe6" opacity={0.3} metal={0.4} rough={0.05} shadow={false} />
      <Box size={[0.02, 1.35, 0.8]} position={[-1.1, 0.85, -0.02]} color="#c9dbe6" opacity={0.3} metal={0.4} rough={0.05} shadow={false} />
      {/* Affiche rétroéclairée côté droit */}
      <group position={[1.1, 0.85, -0.02]}>
        <Box size={[0.08, 1.4, 0.82]} color="#2f363d" metal={0.4} rough={0.4} />
        <mesh material={digiriskPoster()} position={[0.042, 0, 0]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.56, 1.3]} />
        </mesh>
      </group>
      <Box size={[1.6, 0.04, 0.3]} position={[-0.1, 0.32, -0.28]} color="#8a6a45" rough={0.7} />
      {[-0.7, 0.5].map((x) => (
        <Box key={x} size={[0.04, 0.3, 0.25]} position={[x, 0.16, -0.28]} color={IRON} metal={0.5} rough={0.5} />
      ))}
      {/* Poteau d'arrêt et plaque */}
      <group position={[-1.6, 0, 0.45]}>
        <Cylinder position={[0, 1.1, 0]} radius={0.03} height={2.2} color={IRON} metal={0.5} rough={0.5} />
        <Box size={[0.5, 0.32, 0.03]} position={[0, 2.0, 0]} map={busStopMap()} rough={0.5} />
      </group>
    </group>
  );
}
const busStopMap = () =>
  canvasTexture('arret-bus', 256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d3557';
    ctx.fillRect(0, 0, w, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUS', w / 2, 42);
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText('Mairie', w / 2, 100);
    ctx.font = '22px Arial, sans-serif';
    ctx.fillText('Lignes 2 · 5', w / 2, 138);
  });

const CAR_COLORS = ['#3d6ea8', '#eef0f1', '#b03a2e', '#c9ccd0', '#2b3f66', '#c8b89a', '#4a4f55', '#6c7a5c', '#1c1e21', '#8a2f36', '#9fb3c8', '#d9d2c3'];
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _x = new THREE.Vector3();

/**
 * Circulation sur une rue (selon X, longueur `length`) : deux voies de sens opposés (à droite : +X en +Z),
 * voitures et fourgons à vitesse de ville. Chacun garde ses distances avec le véhicule qui le précède,
 * ralentit aux passages piétons (`crossings` : abscisses locales), freine et s'arrête devant le visiteur ou un
 * piéton engagé sur sa voie, puis repart en accélérant doucement ; les roues tournent selon la distance
 * parcourue. Les véhicules sont des corps mobiles : le visiteur ne les traverse pas.
 */
export function Traffic({ length = 90, count = 8, seed = 0, crossings = [] }) {
  const cars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const dir = i % 2 ? -1 : 1;
        const k = Math.floor(i / 2);
        const perLane = Math.ceil(count / 2);
        return {
          id: `circulation-${seed.toFixed(5)}-${i}`,
          dir,
          offset: ((k + seeded(seed * 5 + i) * 0.35) / perLane) * length,
          color: CAR_COLORS[(i * 3 + Math.floor(seed * 10)) % CAR_COLORS.length],
          van: i % 5 === 4,
          truck: i % 7 === 6,
          cruise: (dir > 0 ? 4.6 : 4.2) * (0.92 + seeded(seed * 9 + i) * 0.16),
          odometer: { d: 0 },
        };
      }),
    [count, length, seed]
  );
  const rootRef = useRef();
  const refs = useRef([]);
  const state = useRef(null);
  if (!state.current || state.current.length !== cars.length) state.current = cars.map((c) => ({ s: c.offset, v: c.cruise }));
  useEffect(() => () => cars.forEach((c) => bodies.delete(c.id)), [cars]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const root = rootRef.current;
    if (!root) return;
    // Obstacles sur la chaussée, dans le repère de la rue : le visiteur et les piétons
    const obstacles = [];
    const local = (x, z) => {
      _w.set(x, 0, z);
      root.worldToLocal(_w);
      if (Math.abs(_w.z) < 2.6 && Math.abs(_w.x) < length / 2 + 4) obstacles.push({ x: _w.x, z: _w.z });
    };
    if (visit.active && visit.level === 0) local(visit.x, visit.z);
    bodies.forEach((b) => {
      if (b.kind === 'npc' && (b.level || 0) === 0) local(b.x, b.z);
    });
    const st = state.current;
    const xs = stepTraffic(cars, st, obstacles, dt, length, crossings);
    cars.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.x = xs[i];
      c.odometer.d = st[i].d || 0;
      // Emprise au sol pour les collisions du visiteur (rectangle orienté dans le monde)
      g.getWorldPosition(_w);
      g.getWorldQuaternion(_q);
      _x.set(1, 0, 0).applyQuaternion(_q);
      const flat = Math.hypot(_x.x, _x.z) || 1;
      bodies.set(c.id, { kind: 'car', x: _w.x, z: _w.z, ux: _x.x / flat, uz: _x.z / flat, hl: c.truck ? 1.98 : c.van ? 1.68 : 1.55, hw: c.truck ? 0.74 : 0.62, level: 0 });
    });
  });
  return (
    <group ref={rootRef}>
      {cars.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} userData={DYNAMIC} position={[0, 0, c.dir > 0 ? LANE : -LANE]} rotation={[0, c.dir > 0 ? 0 : Math.PI, 0]}>
          {c.truck ? <Truck model="delivery" color="#eef0f1" odometer={c.odometer} /> : c.van ? <Van color="#f4f5f6" odometer={c.odometer} /> : <Car color={c.color} odometer={c.odometer} />}
        </group>
      ))}
    </group>
  );
}

/**
 * Marquage d'une rue (selon X, largeur `width`) : ligne médiane discontinue (tirets de 3 m), ligne de rive
 * continue côté −Z, ligne de stationnement discontinue côté +Z (`parking`) ; interrompu aux passages piétons
 * (`crossings` : abscisses locales) ; la ligne de rive s'interrompt au débouché d'une voie (`junction`, 999 : aucun).
 */
export function RoadMarkings({ length = 90, width = 5, crossings = [], parking = 1, junction = 999 }) {
  const clear = (x) => crossings.every((c) => Math.abs(x - c) > 1.7);
  const paint = '#e6e8e6';
  const dashes = (z, dash, gap, w) => {
    const out = [];
    for (let x = -length / 2 + 0.4; x + dash < length / 2; x += dash + gap) {
      if (clear(x) && clear(x + dash)) out.push(<Box key={`${z}|${x.toFixed(2)}`} size={[dash, 0.006, w]} position={[x + dash / 2, 0, z]} color={paint} rough={0.7} shadow={false} />);
    }
    return out;
  };
  // Ligne continue découpée autour des passages piétons
  const cuts = [...crossings.map((c) => [c, 1.7]), ...(junction < 900 ? [[junction, 3.0]] : [])].filter(([c]) => Math.abs(c) < length / 2).sort((a, b) => a[0] - b[0]);
  const pieces = [];
  let from = -length / 2;
  cuts.forEach(([c, half]) => {
    pieces.push([from, c - half]);
    from = c + half;
  });
  pieces.push([from, length / 2]);
  return (
    <group position={[0, 0.016, 0]}>
      {dashes(0, 2, 3, 0.09)}
      {pieces
        .filter(([a, b]) => b - a > 0.2)
        .map(([a, b]) => (
          <Box key={`rive${a}`} size={[b - a, 0.006, 0.08]} position={[(a + b) / 2, 0, -(width / 2 - 0.3)]} color={paint} rough={0.7} shadow={false} />
        ))}
      {parking > 0 && dashes(width / 2 - 1.08, 1, 1, 0.08)}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* École et loisirs                                                     */
/* ------------------------------------------------------------------ */

/** Préau ouvert (poteaux, charpente, couverture en zinc à un pan), banc filant au fond. `length` selon X. */
export function Preau({ length = 8, depth = 3.6 }) {
  const n = Math.max(2, Math.round(length / 2.6) + 1);
  const xs = Array.from({ length: n }, (_, i) => -length / 2 + (i * length) / (n - 1));
  return (
    <group>
      {xs.map((x) => (
        <group key={x}>
          <Box size={[0.16, 2.3, 0.16]} position={[x, 1.15, depth / 2 - 0.1]} color="#8b5e3c" rough={0.75} />
          <Box size={[0.16, 2.7, 0.16]} position={[x, 1.35, -depth / 2 + 0.1]} color="#8b5e3c" rough={0.75} />
          <Box size={[0.12, 0.22, depth + 0.2]} position={[x, 2.45, 0]} rotation={[-0.11, 0, 0]} color="#7a5032" rough={0.75} />
        </group>
      ))}
      <Box size={[length + 0.6, 0.07, depth + 0.7]} position={[0, 2.62, 0]} rotation={[-0.11, 0, 0]} color="#8f9aa3" metal={0.5} rough={0.4} />
      <Box size={[length, 0.05, 0.35]} position={[0, 0.32, -depth / 2 + 0.3]} color="#a57a4f" rough={0.7} />
      {xs.map((x) => (
        <Box key={`b${x}`} size={[0.05, 0.3, 0.3]} position={[x, 0.15, -depth / 2 + 0.3]} color={IRON} metal={0.5} rough={0.5} />
      ))}
    </group>
  );
}

/** Structure de jeux : plateforme sur poteaux, toit, toboggan, échelle, panneau d'escalade, garde-corps. */
export function PlayStructure() {
  const wood = '#a57a4f';
  return (
    <group>
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z]) => (
        <Box key={`${x}${z}`} size={[0.1, 1.9, 0.1]} position={[x, 0.95, z]} color={wood} rough={0.75} />
      ))}
      <Box size={[1.1, 0.06, 1.1]} position={[0, 0.8, 0]} color={wood} rough={0.75} />
      <Cylinder position={[0, 2.12, 0]} radius={0.95} top={0.02} height={0.5} segments={4} rotation={[0, Math.PI / 4, 0]} color="#c8323a" rough={0.6} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[1.0, 0.4, 0.04]} position={[0, 1.05, s * 0.5]} color="#3d7cc9" rough={0.6} />
      ))}
      {/* Toboggan vers +X */}
      <group position={[0.55, 0.8, 0]} rotation={[0, 0, -0.62]}>
        <Box size={[1.45, 0.04, 0.42]} position={[0.72, 0, 0]} color="#f2b134" rough={0.4} />
        {[-1, 1].map((s) => (
          <Box key={s} size={[1.45, 0.12, 0.03]} position={[0.72, 0.06, s * 0.21]} color="#f2b134" rough={0.4} />
        ))}
      </group>
      {/* Échelle côté −X */}
      <group position={[-0.62, 0, 0]}>
        {[-0.2, 0.2].map((z) => (
          <Box key={z} size={[0.05, 1.0, 0.05]} position={[-0.15, 0.45, z]} rotation={[0, 0, -0.3]} color={wood} rough={0.75} />
        ))}
        {[0.15, 0.35, 0.55, 0.75].map((y) => (
          <Box key={y} size={[0.04, 0.04, 0.4]} position={[-0.27 + y * 0.3, y, 0]} color={wood} rough={0.75} />
        ))}
      </group>
    </group>
  );
}

/** Marelle tracée à la craie sur le sol de la cour. */
export function Hopscotch() {
  const map = canvasTexture('marelle', 128, 384, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(250,250,245,0.92)';
    ctx.fillStyle = 'rgba(250,250,245,0.92)';
    ctx.lineWidth = 4;
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    const cells = [[1, 0], [2, 0], [3, 0], [4, 1], [6, 2], [7, 0], [8, 1], [10, 2]];
    let y = h - 10;
    cells.forEach(([n, type]) => {
      if (type === 1) {
        ctx.strokeRect(w / 2 - 60, y - 44, 60, 44);
        ctx.strokeRect(w / 2, y - 44, 60, 44);
        ctx.fillText(String(n), w / 2 - 30, y - 14);
        ctx.fillText(String(n + 1), w / 2 + 30, y - 14);
      } else if (type === 2) {
        ctx.beginPath();
        ctx.arc(w / 2, y - 20, 34, Math.PI, 0);
        ctx.stroke();
        ctx.fillText(n === 10 ? 'CIEL' : String(n), w / 2, y - 14);
      } else {
        ctx.strokeRect(w / 2 - 30, y - 44, 60, 44);
        ctx.fillText(String(n), w / 2, y - 14);
      }
      y -= 44;
    });
  });
  map.premultiplyAlpha = false;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={noRaycast}>
      <planeGeometry args={[0.85, 2.5]} />
      <meshStandardMaterial map={map} transparent depthWrite={false} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

const KID_TOPS = ['#d9473f', '#f2b134', '#3d7cc9', '#4caf6a', '#9c5bd1', '#ef7aa1', '#2bb3b1', '#f07f3c'];
const KID_PANTS = ['#2c3e66', '#4a4a4a', '#6b4f3a', '#33506e'];

/**
 * Enfants qui jouent dans la cour (jeu du loup) : chacun court sur sa boucle, à son rythme, dans un sens ou
 * dans l'autre, jambes et bras qui battent, petit rebond ; un enfant compte, adossé, en tournant la tête.
 */
export function PlayingChildren({ count = 6, spread = 3, seed = 0 }) {
  const kids = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k) => seeded(seed * 17 + i * 3.3 + k);
        const radius = spread * (0.35 + r(1) * 0.6);
        return {
          variant: (i * 3 + 1) % 8,
          colors: { top: KID_TOPS[(i + Math.floor(seed * 8)) % KID_TOPS.length], pants: KID_PANTS[i % KID_PANTS.length], shoes: '#2a2a2a' },
          radius,
          squash: 0.6 + r(2) * 0.35,
          w: ((1.2 + r(3) * 0.8) / radius) * (i % 2 ? 1 : -1),
          phase: r(4) * Math.PI * 2,
          counter: i === count - 1,
          limbs: {},
        };
      }),
    [count, spread, seed]
  );
  const roots = useRef([]);
  const rootRef = useRef();
  const close = useDistanceLod(rootRef, (near) => !near && kids.forEach((k) => forgetLimbs(k.limbs)));
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + seed * 40;
    kids.forEach((k, i) => {
      const g = roots.current[i];
      if (!g) return;
      const { leftLeg, rightLeg, leftArm, rightArm, leftShin, rightShin, leftArmFore, rightArmFore, head } = k.limbs;
      if (k.counter) {
        // L'enfant qui compte, les mains devant les yeux puis qui regarde autour de lui
        g.position.set(0, 0, -spread * 0.15);
        const peek = Math.max(0, Math.sin(t * 0.5));
        if (leftArm) leftArm.rotation.x = -0.9 * (1 - peek);
        if (rightArm) rightArm.rotation.x = -0.9 * (1 - peek);
        if (leftArmFore) leftArmFore.rotation.x = -1.9 * (1 - peek);
        if (rightArmFore) rightArmFore.rotation.x = -1.9 * (1 - peek);
        if (head) head.rotation.y = Math.sin(t * 1.3) * 0.7 * peek;
        return;
      }
      const a = k.phase + t * k.w;
      const x = Math.cos(a) * k.radius;
      const z = Math.sin(a) * k.radius * k.squash;
      const dx = -Math.sin(a) * k.radius * k.w;
      const dz = Math.cos(a) * k.radius * k.squash * k.w;
      g.position.set(x, Math.abs(Math.sin(t * 9 + i)) * 0.04, z);
      g.rotation.y = Math.atan2(dx, dz);
      const s = Math.sin(t * 9 + i);
      if (leftLeg) leftLeg.rotation.x = -s * 0.75;
      if (rightLeg) rightLeg.rotation.x = s * 0.75;
      if (leftShin) leftShin.rotation.x = 0.2 + Math.max(0, Math.cos(t * 9 + i)) * 0.9;
      if (rightShin) rightShin.rotation.x = 0.2 + Math.max(0, -Math.cos(t * 9 + i)) * 0.9;
      if (leftArm) leftArm.rotation.x = s * 0.7;
      if (rightArm) rightArm.rotation.x = -s * 0.7;
      if (leftArmFore) leftArmFore.rotation.x = -0.9;
      if (rightArmFore) rightArmFore.rotation.x = -0.9;
    });
  });
  return (
    <group ref={rootRef}>
      {kids.map((k, i) => (
        <group key={i} ref={(el) => (roots.current[i] = el)} userData={DYNAMIC}>
          <group scale={[0.62, 0.62, 0.62]}>
            <LodPerson close={close} outfit="office" variant={k.variant} colors={k.colors} limbs={k.limbs} />
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Services techniques, tri, mobilier urbain                           */
/* ------------------------------------------------------------------ */

/** Alvéoles de stockage en blocs béton (sable, gravier, sel de déneigement), tas de matériaux. */
export function MaterialBays() {
  const heaps = [['#cdb58a', 'Sable'], ['#9a958c', 'Gravier'], ['#ebe8e1', 'Sel']];
  return (
    <group>
      {[-1.5, -0.5, 0.5, 1.5].map((x) =>
        [0, 1, 2].map((row) => (
          <Box key={`${x}${row}`} size={[0.4, 0.4, 2.0]} position={[x * 1.6, 0.2 + row * 0.4, 0]} color="#b8b4ac" rough={0.95} />
        ))
      )}
      {[0, 1, 2].map((row) => (
        <Box key={`back${row}`} size={[4.8, 0.4, 0.4]} position={[0, 0.2 + row * 0.4, -0.8]} color="#aeaaa2" rough={0.95} />
      ))}
      {heaps.map(([color], i) => (
        <group key={color} position={[(i - 1) * 1.6, 0, 0.05]}>
          <Ball shape="dodeca" scale={[1.4, 1.6, 1.7]} position={[0, -0.05, -0.15]} color={color} rough={1} />
          <Ball shape="dodeca" scale={[0.9, 0.7, 1.0]} position={[0.15, -0.05, 0.55]} color={color} rough={1} />
        </group>
      ))}
    </group>
  );
}

/** Benne à gravats (caisson évasé jaune, gravats). */
export function Skip() {
  return (
    <group>
      <group position={[0, 0.5, 0]} scale={[1, 1, 0.62]}>
        <Cylinder radius={1.05} top={1.35} height={0.8} segments={4} rotation={[0, Math.PI / 4, 0]} color="#d9a521" metal={0.35} rough={0.6} />
      </group>
      {[-0.7, 0.7].map((x) => (
        <Box key={x} size={[0.08, 0.1, 1.1]} position={[x, 0.06, 0]} color="#2b2b2b" rough={0.8} />
      ))}
      {[[-0.4, 0.1], [0.1, -0.15], [0.45, 0.12], [0, 0.2]].map(([x, z], i) => (
        <Ball key={i} shape="dodeca" radius={0.22} position={[x, 0.85, z]} color={['#8d8a84', '#7a5a3a', '#a9a59c', '#5f5b55'][i]} rough={1} />
      ))}
    </group>
  );
}

/** Point d'apport volontaire : colonnes verre (vert), emballages (jaune), papiers (bleu), sur dalle. */
export function RecyclingPoint() {
  const columns = [['#3f7d4a', 'Verre'], ['#e0b52a', 'Emballages'], ['#3768a6', 'Papiers']];
  return (
    <group>
      <Box size={[3.6, 0.08, 1.4]} position={[0, 0.04, 0]} color="#bdb9b1" rough={0.95} />
      {columns.map(([color], i) => (
        <group key={color} position={[(i - 1) * 1.15, 0.08, 0]}>
          <Cylinder position={[0, 0.65, 0]} radius={0.5} top={0.85} height={1.3} segments={20} color={color} rough={0.55} />
          <Ball scale={[0.86, 0.36, 0.86]} position={[0, 1.3, 0]} color={color} rough={0.55} />
          <Cylinder position={[0, 1.5, 0]} radius={0.06} height={0.12} color="#2b2b2b" rough={0.6} />
          <Cylinder position={[0, 1.05, 0.43]} rotation={[Math.PI / 2, 0, 0]} radius={0.09} height={0.05} color="#1c1c1c" rough={0.6} />
          <Box size={[0.42, 0.28, 0.02]} position={[0, 0.6, 0.49]} color="#f4f4f0" rough={0.5} />
        </group>
      ))}
    </group>
  );
}

/** Tas de déchets verts (branches coupées, feuillage). */
export function GreenWasteHeap() {
  return (
    <group>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <Cylinder key={i} position={[Math.cos(a) * 0.5, 0.25 + (i % 3) * 0.12, Math.sin(a) * 0.4]} rotation={[Math.sin(a) * 0.9, a, 1.2 + (i % 4) * 0.2]} radius={0.035} top={0.6} height={1.3} segments={6} color="#6b4f35" rough={0.9} />;
      })}
      <Leaves position={[0, 0.45, 0]} scale={[1.6, 0.8, 1.3]} color="#6a7d3e" />
      <Leaves position={[0.5, 0.3, 0.3]} scale={[0.8, 0.5, 0.7]} color="#7f8a45" />
      <Leaves position={[-0.55, 0.3, -0.2]} scale={[0.8, 0.55, 0.8]} color="#5d6f37" />
    </group>
  );
}

/** Panneau d'affichage municipal vitré (avis à la population, conseil municipal, arrêtés). */
export function NoticeBoard() {
  const map = canvasTexture('affichage-municipal', 512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#2c4a3a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f4f1ea';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('AFFICHAGE MUNICIPAL', w / 2, 30);
    const notices = [['AVIS À LA POPULATION', '#fffdf6'], ['CONSEIL MUNICIPAL', '#f6f1e2'], ['ARRÊTÉ DU MAIRE', '#fffdf6'], ['ÉTAT CIVIL', '#eef2f6'], ['URBANISME', '#fffdf6'], ['FÊTE DE LA COMMUNE', '#fbe8d6']];
    notices.forEach(([title, bg], i) => {
      const x = 16 + (i % 3) * 164;
      const y = 48 + Math.floor(i / 3) * 134;
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, 152, 124);
      ctx.fillStyle = '#1d3557';
      ctx.font = 'bold 12px Arial, sans-serif';
      ctx.fillText(title, x + 76, y + 20);
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      for (let l = 0; l < 7; l += 1) ctx.fillRect(x + 12, y + 34 + l * 12, 128 - (l % 3) * 18, 4);
      ctx.fillStyle = '#c8323a';
      ctx.beginPath();
      ctx.arc(x + 76, y + 4, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  return (
    <group>
      {[-0.68, 0.68].map((x) => (
        <Box key={x} size={[0.07, 1.9, 0.07]} position={[x, 0.95, 0]} color="#2b3e33" metal={0.4} rough={0.5} />
      ))}
      <Box size={[1.4, 0.92, 0.08]} position={[0, 1.36, 0]} color="#2b3e33" metal={0.4} rough={0.5} />
      <Box size={[1.28, 0.8, 0.01]} position={[0, 1.36, 0.045]} map={map} rough={0.7} />
      <Box size={[1.3, 0.82, 0.01]} position={[0, 1.36, 0.055]} color="#d8e6ee" opacity={0.2} metal={0.5} rough={0.05} shadow={false} />
      <Box size={[1.5, 0.06, 0.18]} position={[0, 1.85, 0.02]} color="#2b3e33" metal={0.4} rough={0.5} />
    </group>
  );
}

/** Boîte aux lettres jaune sur poteau. */
export function PostBox() {
  return (
    <group>
      <Cylinder position={[0, 0.45, 0]} radius={0.04} height={0.9} color={IRON} metal={0.5} rough={0.5} />
      <Box size={[0.42, 0.5, 0.3]} position={[0, 1.1, 0]} color="#f2c230" metal={0.3} rough={0.45} />
      <Cylinder position={[0, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]} radius={0.21} height={0.3} segments={16} color="#f2c230" metal={0.3} rough={0.45} />
      <Box size={[0.26, 0.03, 0.02]} position={[0, 1.22, 0.155]} color="#1c1c1c" rough={0.6} />
      <Box size={[0.3, 0.12, 0.01]} position={[0, 1.02, 0.152]} color="#1d3a7a" rough={0.5} />
    </group>
  );
}

/** Corbeille de rue (fût vert foncé ajouré sur poteau, couvercle). */
export function LitterBin() {
  return (
    <group>
      <Cylinder position={[0, 0.45, -0.12]} radius={0.035} height={0.9} color={IRON} metal={0.5} rough={0.5} />
      <Cylinder position={[0, 0.62, 0.05]} radius={0.2} height={0.55} segments={16} openEnded color="#2e4a3a" metal={0.4} rough={0.5} />
      <Cylinder position={[0, 0.36, 0.05]} radius={0.19} height={0.02} segments={16} color="#2e4a3a" metal={0.4} rough={0.5} />
      <Cylinder position={[0, 0.9, 0.05]} radius={0.21} top={0.6} height={0.06} segments={16} color="#2e4a3a" metal={0.4} rough={0.5} />
    </group>
  );
}

/** Vélo (≈ 1,7 m) vu de profil, roues dans le plan XY, avant vers +X. */
const WHEEL = new THREE.TorusGeometry(0.22, 0.015, 6, 24);
function Bicycle({ color = '#3d7cc9' }) {
  const wheel = WHEEL;
  return (
    <group>
      {[-0.36, 0.36].map((x) => (
        <mesh key={x} geometry={wheel} material={getMaterial({ color: '#1c1c1c', roughness: 0.7, metalness: 0 })} position={[x, 0.23, 0]} raycast={noRaycast} />
      ))}
      <Box size={[0.5, 0.025, 0.025]} position={[0, 0.42, 0]} rotation={[0, 0, 0.05]} color={color} metal={0.5} rough={0.4} />
      <Box size={[0.025, 0.38, 0.025]} position={[-0.12, 0.33, 0]} rotation={[0, 0, -0.25]} color={color} metal={0.5} rough={0.4} />
      <Box size={[0.45, 0.025, 0.025]} position={[-0.15, 0.24, 0]} rotation={[0, 0, 0.35]} color={color} metal={0.5} rough={0.4} />
      <Box size={[0.025, 0.42, 0.025]} position={[0.3, 0.42, 0]} rotation={[0, 0, 0.3]} color={color} metal={0.5} rough={0.4} />
      <Box size={[0.03, 0.02, 0.36]} position={[0.24, 0.62, 0]} color="#2b2b2b" rough={0.6} />
      <Box size={[0.14, 0.03, 0.06]} position={[-0.17, 0.53, 0]} color="#1c1c1c" rough={0.7} />
    </group>
  );
}

/** Arceaux à vélos et vélos garés. */
export function BikeRack({ bikes = 3 }) {
  return (
    <group>
      {[-0.9, -0.3, 0.3, 0.9].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Box size={[0.04, 0.7, 0.04]} position={[0, 0.35, -0.3]} color={ALU} metal={0.7} rough={0.35} />
          <Box size={[0.04, 0.7, 0.04]} position={[0, 0.35, 0.3]} color={ALU} metal={0.7} rough={0.35} />
          <Box size={[0.04, 0.04, 0.64]} position={[0, 0.7, 0]} color={ALU} metal={0.7} rough={0.35} />
        </group>
      ))}
      {Array.from({ length: Math.min(4, bikes) }, (_, i) => (
        <group key={i} position={[-0.9 + i * 0.6 + 0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <Bicycle color={['#3d7cc9', '#c8323a', '#4caf6a', '#2b2b2b'][i]} />
        </group>
      ))}
    </group>
  );
}

/** Haie taillée (feuillage dense sur `length`). */
export function Hedge({ length = 4 }) {
  const n = Math.max(2, Math.round(length / 0.55));
  return (
    <group>
      <Box size={[length, 0.7, 0.5]} position={[0, 0.35, 0]} color="#3f6532" rough={0.95} />
      {Array.from({ length: n }, (_, i) => (
        <Leaves key={i} position={[-length / 2 + (i + 0.5) * (length / n), 0.62, 0]} scale={[0.7, 0.42, 0.62]} color={i % 2 ? '#47703a' : '#3d6431'} />
      ))}
    </group>
  );
}
