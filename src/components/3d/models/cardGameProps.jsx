import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Jeu de cartes sécurité Evarisk / DigiRisk posé sur un bureau : la boîte fermée, debout, et un éventail de
 * cartes à plat tourné vers les visiteurs (+Z). Mêmes visuels que la boîte 3D du projet « jeu-de-cartes-3d »
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
      {/* Boîte debout, face tournée vers les visiteurs */}
      <mesh geometry={box} material={mats.box} position={[-0.045, (BOX[1] * MM) / 2, -0.02]} rotation={[0, 0.35, 0]} castShadow receiveShadow />
      {/* Éventail : cartes pivotant autour de leur bord inférieur, la carte du centre au-dessus */}
      <group position={[0.025, 0, 0.035]}>
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
