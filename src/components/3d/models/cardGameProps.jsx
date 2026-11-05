import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Box, Cylinder, noRaycast } from './kit';

/**
 * Jeu de cartes sécurité Evarisk / DigiRisk présenté sur un bureau, tourné vers les visiteurs (+Z) : présentoir
 * imprimé « DigiRisk — Jeu de cartes » (boîte, cartes, accroche), trois boîtes debout dans son plateau et un
 * éventail de cartes à plat ; kakémono assorti (DigiRiskBanner). Mêmes visuels que la boîte 3D du projet « jeu-de-cartes-3d »
 * (patron imprimé de la boîte et planche des cartes, réduits à 1600 px dans public/models/jeu-de-cartes/),
 * aux dimensions réelles : boîte 65 × 99 × 19,5 mm, cartes 62 × 88 mm à coins arrondis. Origine au pied.
 */

const MM = 1 / 1500; // unités de scène par millimètre (1 unité ≈ 1,5 m)
const ASSETS = './models/jeu-de-cartes/';

// Patron de la boîte : pixels de l'image d'origine (3200 × 2988), rectangles [x0, x1, y0, y1] de chaque face
const PATRON = [3200, 2988];
const PX = 65 / 1104; // mm par pixel du patron
const BOX = [1104 * PX, 1688 * PX, 331 * PX]; // largeur (face), hauteur, épaisseur (tranches)
const FACES = {
  face: [1736, 2839, 642, 2330],
  dos: [298, 1403, 642, 2330],
  tranche1: [1403, 1736, 642, 2330], // côté gauche vu de face (entre le dos et la face)
  tranche2: [2839, 3169, 642, 2330],
  couvercle: [298, 1403, 311, 642],
  fond: [298, 1403, 2330, 2661],
};

// Planche des cartes : 10 colonnes × 6 lignes, verso commun en case 55
const CARD = { w: 62.1, h: 87.8, t: 0.28, r: 3.2 };
const COLS = 10;
const ROWS = 6;
const BACK = 55;
// Éventail présenté aux visiteurs, de gauche à droite : D♥ « Évaluer les risques », A♥ DigiRisk.org,
// joker DigiRisk au centre, A♠ DigiQuali, R♥ « Enlever le danger »
const FAN = [11, 0, 53, 26, 12];
const FAN_SPREAD = 0.42; // rad entre le centre et les cartes du bord

let shared = null;
/** Textures et matériaux partagés par tous les jeux de cartes de la scène (chargés une seule fois). */
function materials() {
  if (!shared) {
    const loader = new THREE.TextureLoader();
    const load = (name) => {
      const texture = loader.load(ASSETS + name);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      return texture;
    };
    shared = {
      box: new THREE.MeshStandardMaterial({ map: load('boite-patron.jpg'), roughness: 0.42, metalness: 0 }),
      card: new THREE.MeshStandardMaterial({ map: load('planche-cartes.jpg'), color: '#f4f1ea', roughness: 0.55, metalness: 0 }),
      edge: new THREE.MeshStandardMaterial({ color: '#e7e3da', roughness: 0.7, metalness: 0 }),
    };
  }
  return shared;
}

/**
 * Boîte fermée : chaque face du pavé reçoit sa pièce du patron. Coordonnées de texture de BoxGeometry : u de
 * gauche à droite vu de l'extérieur, v vers le haut ; dessus et dessous ont le bord du dos à l'arrière (−Z) et
 * le côté x = 298 du patron à droite (+X), comme une fois la boîte pliée.
 */
function boxGeometry() {
  const geometry = new THREE.BoxGeometry(BOX[0] * MM, BOX[1] * MM, BOX[2] * MM);
  const uv = geometry.attributes.uv;
  // Ordre des faces de BoxGeometry : +X, −X, +Y, −Y, +Z, −Z (4 sommets chacune)
  const order = [
    ['tranche2', false, false],
    ['tranche1', false, false],
    ['couvercle', true, true],
    ['fond', true, true],
    ['face', false, false],
    ['dos', false, false],
  ];
  order.forEach(([name, flat, horizontal], face) => {
    const [x0, x1, y0, y1] = FACES[name];
    for (let k = 0; k < 4; k += 1) {
      const i = face * 4 + k;
      const u = uv.getX(i);
      const v = uv.getY(i);
      // Dessus / dessous : x = 298 du patron à droite (+X), comme le dos vu de l'arrière
      const x = flat ? x1 - u * (x1 - x0) : x0 + u * (x1 - x0);
      // Côtés : haut de l'image en haut. Dessus (v = 1 à l'arrière) : bord commun avec le dos (y1) à l'arrière ;
      // dessous (v = 0 à l'arrière) : bord commun avec le dos (y0) à l'arrière — dans les deux cas y = y0 + v (y1 − y0)
      const y = horizontal ? y0 + v * (y1 - y0) : y0 + (1 - v) * (y1 - y0);
      uv.setXY(i, x / PATRON[0], 1 - y / PATRON[1]);
    }
  });
  uv.needsUpdate = true;
  return geometry;
}

function cardShape() {
  const { w, h, r } = CARD;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/**
 * Carte n° `cell` couchée à plat (recto vers le haut, haut de la carte vers −Z) : recto pris dans sa case de la
 * planche, verso commun ; tranches à part (groupe 1).
 */
function cardGeometry(cell) {
  const geometry = new THREE.ExtrudeGeometry(cardShape(), { depth: CARD.t, bevelEnabled: false, curveSegments: 4 });
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const nz = nor.getZ(i);
    if (Math.abs(nz) < 0.5) continue;
    let u = (pos.getX(i) + CARD.w / 2) / CARD.w;
    const v = (pos.getY(i) + CARD.h / 2) / CARD.h;
    let k = cell;
    if (nz < 0) {
      k = BACK;
      u = 1 - u;
    }
    uv.setXY(i, ((k % COLS) + u) / COLS, 1 - (Math.floor(k / COLS) + 1 - v) / ROWS);
  }
  uv.needsUpdate = true;
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(MM, MM, MM);
  return geometry;
}

export function DigiRiskCardGame() {
  const mats = materials();
  const box = useMemo(boxGeometry, []);
  const cards = useMemo(() => FAN.map(cardGeometry), []);
  useEffect(
    () => () => {
      box.dispose();
      cards.forEach((g) => g.dispose());
    },
    [box, cards]
  );
  const half = (FAN.length - 1) / 2;
  return (
    <group>
      {/* Présentoir de bureau incliné, imprimé aux couleurs du jeu, et sa béquille */}
      <group position={[0, 0, -0.03]} rotation={[-0.2, 0, 0]}>
        <Box size={[0.19, 0.242, 0.004]} position={[0, 0.121, 0]} color="#e5e7eb" rough={0.8} />
        <mesh geometry={DISPLAY_FACE} material={counterDisplay()} position={[0, 0.121, 0.0025]} raycast={noRaycast} />
      </group>
      <Box size={[0.012, 0.19, 0.004]} position={[0, 0.088, -0.07]} rotation={[0.42, 0, 0]} color="#c7ccd1" rough={0.8} />
      {/* Plateau : trois boîtes debout, face aux visiteurs */}
      <Box size={[0.19, 0.008, 0.06]} position={[0, 0.004, 0.035]} color={NAVY} rough={0.6} />
      <Box size={[0.19, 0.022, 0.004]} position={[0, 0.011, 0.066]} color={ORANGE} rough={0.6} />
      {[-0.056, 0, 0.056].map((x) => (
        <mesh key={x} geometry={box} material={mats.box} position={[x, 0.008 + (BOX[1] * MM) / 2, 0.035]} castShadow receiveShadow />
      ))}
      {/* Éventail : cartes pivotant autour de leur bord inférieur, la carte du centre au-dessus */}
      <group position={[0, 0, 0.16]}>
        {cards.map((geometry, i) => {
          const k = (i - half) / half;
          const lift = (half - Math.abs(i - half)) * (CARD.t + 0.6) * MM;
          return (
            <group key={FAN[i]} rotation={[0, -k * FAN_SPREAD, 0]}>
              <mesh geometry={geometry} material={[mats.card, mats.edge]} position={[0, lift, (-CARD.h / 2) * MM]} castShadow receiveShadow />
            </group>
          );
        })}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Visuels imprimés DigiRisk : présentoir de bureau et kakémono          */
/* ------------------------------------------------------------------ */

const NAVY = '#1d3557';
const ORANGE = '#e8772e';
const images = new Map();
/** Charge une image du jeu une seule fois ; `ready(img)` est appelé dès qu'elle est disponible. */
function withImage(name, ready) {
  let entry = images.get(name);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false, queue: [] };
    img.onload = () => {
      entry.loaded = true;
      entry.queue.forEach((f) => f(img));
      entry.queue = [];
    };
    img.src = ASSETS + name;
    images.set(name, entry);
  }
  if (entry.loaded) ready(entry.img);
  else entry.queue.push(ready);
}

/** Face avant de la boîte (pièce « face » du patron), hauteur `height`, inclinée de `angle`, avec ombre portée. */
function drawBoxFace(ctx, img, x, y, height, angle = 0) {
  const k = img.width / PATRON[0];
  const [x0, x1, y0, y1] = FACES.face;
  const width = (height * (x1 - x0)) / (y1 - y0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(img, x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, -width / 2, -height / 2, width, height);
  ctx.restore();
}

/** Carte n° `cell` de la planche, coins arrondis, centrée en (x, y), inclinée de `angle`. */
function drawCard(ctx, img, cell, x, y, height, angle = 0) {
  const cw = img.width / COLS;
  const ch = img.height / ROWS;
  const width = height * (CARD.w / CARD.h);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, height * 0.04);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  ctx.drawImage(img, (cell % COLS) * cw, Math.floor(cell / COLS) * ch, cw, ch, -width / 2, -height / 2, width, height);
  ctx.restore();
}

/** Titre DigiRisk (« Digi » blanc, « Risk » orange) centré en (x, y). */
function brand(ctx, x, y, size) {
  ctx.font = `800 ${size}px Arial, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const a = ctx.measureText('Digi').width;
  const b = ctx.measureText('Risk').width;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Digi', x - (a + b) / 2, y);
  ctx.fillStyle = ORANGE;
  ctx.fillText('Risk', x - (a + b) / 2 + a, y);
}

function centered(ctx, text, x, y, font, color) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const promoTextures = new Map();
/** Visuel imprimé (présentoir ou kakémono), redessiné quand les images du jeu sont chargées. */
function promoTexture(key, w, h, layout) {
  if (!promoTextures.has(key)) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const paint = (box, cards) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, NAVY);
      bg.addColorStop(1, '#0e1d31');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      layout(ctx, w, h, box, cards);
      texture.needsUpdate = true;
    };
    paint(null, null);
    withImage('boite-patron.jpg', (box) => withImage('planche-cartes.jpg', (cards) => paint(box, cards)));
    promoTextures.set(key, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.55, metalness: 0 }));
  }
  return promoTextures.get(key);
}

// Présentoir de bureau (19 × 24 cm visibles) : titre, boîte, éventail de cartes, accroche
const counterDisplay = () =>
  promoTexture('cartes-presentoir', 512, 656, (ctx, w, h, box, cards) => {
    brand(ctx, w / 2, 92, 82);
    ctx.fillStyle = ORANGE;
    ctx.fillRect(w * 0.2, 112, w * 0.6, 5);
    centered(ctx, 'JEU DE CARTES', w / 2, 168, '800 46px Arial, sans-serif', ORANGE);
    centered(ctx, 'Sécurité au travail', w / 2, 208, '600 30px Arial, sans-serif', '#ffffff');
    if (box) drawBoxFace(ctx, box, 168, 392, 290, -0.07);
    if (cards) [26, 53, 0].forEach((cell, i) => drawCard(ctx, cards, cell, 330 + i * 52, 400 + Math.abs(i - 1) * 10, 188, -0.2 + i * 0.2));
    centered(ctx, 'Évaluer les risques · Enlever le danger', w / 2, 586, '600 22px Arial, sans-serif', '#ffffff');
    centered(ctx, 'digirisk.org', w / 2, 630, '800 30px Arial, sans-serif', ORANGE);
  });

// Kakémono (85 × 200 cm)
const bannerVisual = () =>
  promoTexture('cartes-kakemono', 420, 990, (ctx, w, h, box, cards) => {
    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, 0, w, 14);
    brand(ctx, w / 2, 118, 86);
    centered(ctx, 'JEU DE CARTES', w / 2, 182, '800 44px Arial, sans-serif', ORANGE);
    centered(ctx, 'SÉCURITÉ AU TRAVAIL', w / 2, 222, '700 26px Arial, sans-serif', '#ffffff');
    if (box) drawBoxFace(ctx, box, w / 2, 430, 330, 0);
    if (cards) FAN.forEach((cell, i) => drawCard(ctx, cards, cell, w / 2 + (i - 2) * 62, 720 + Math.abs(i - 2) * 14, 200, (i - 2) * 0.16));
    centered(ctx, 'Évaluer les risques', w / 2, 880, '700 28px Arial, sans-serif', '#ffffff');
    centered(ctx, 'Enlever le danger', w / 2, 916, '700 28px Arial, sans-serif', '#ffffff');
    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, h - 58, w, 58);
    centered(ctx, 'digirisk.org', w / 2, h - 18, '800 34px Arial, sans-serif', '#ffffff');
  });

const DISPLAY_FACE = new THREE.PlaneGeometry(0.186, 0.238);
const BANNER_FACE = new THREE.PlaneGeometry(0.565, 1.332);

/**
 * Kakémono DigiRisk (85 × 200 cm) sur son pied enrouleur : titre, boîte du jeu, éventail de cartes, accroche
 * et adresse du site. Face à +Z, origine au sol.
 */
export function DigiRiskBanner() {
  return (
    <group>
      <Box size={[0.6, 0.04, 0.14]} position={[0, 0.02, 0]} color="#b9c0c7" metal={0.7} rough={0.35} />
      {[-0.26, 0.26].map((x) => (
        <Box key={x} size={[0.04, 0.012, 0.3]} position={[x, 0.006, 0]} color="#9aa2aa" metal={0.7} rough={0.35} />
      ))}
      <Cylinder position={[0, 0.72, -0.03]} radius={0.007} height={1.36} color="#9aa2aa" metal={0.7} rough={0.35} />
      <mesh geometry={BANNER_FACE} material={bannerVisual()} position={[0, 0.71, 0.005]} castShadow raycast={noRaycast} />
      <Box size={[0.575, 0.012, 0.012]} position={[0, 0.006 + 1.376, 0.004]} color="#b9c0c7" metal={0.7} rough={0.35} />
      <Box size={[0.565, 1.332, 0.002]} position={[0, 0.71, 0.003]} color="#e5e7eb" rough={0.8} />
    </group>
  );
}

/** Affiche DigiRisk du jeu de cartes (même visuel que le kakémono), pour l'abribus. */
export const digiriskPoster = () => bannerVisual();
