import React from 'react';
import * as THREE from 'three';
import { RenderTexture, PerspectiveCamera } from '@react-three/drei';
import { Box, Cylinder, Ball, FloorZone, Keyboard, getMaterial, seeded, noRaycast } from './kit';
import { canvasTexture, clockFace } from './civicProps';
import { Person } from './people';
import { marianneGeometry } from './marianneSculpture';

/* ------------------------------------------------------------------ */
/* Écrans des postes : logiciel DigiRisk affiché                         */
/* ------------------------------------------------------------------ */

/** Captures réelles de DigiRisk (public/models/digirisk-screens/), réparties entre les postes. */
const SCREEN_COUNT = 12;
const screenMaterials = new Map();
/** Dalle rétroéclairée (lisible dans une pièce sombre) affichant la capture n° `index` (toutes différentes à la suite). */
function screenMaterial(index) {
  const k = ((Math.round(index) % SCREEN_COUNT) + SCREEN_COUNT) % SCREEN_COUNT;
  if (!screenMaterials.has(k)) {
    const map = new THREE.TextureLoader().load(`./models/digirisk-screens/screen-${String(k + 1).padStart(2, '0')}.jpg`);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    screenMaterials.set(k, new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.75, roughness: 0.35, metalness: 0 }));
  }
  return screenMaterials.get(k);
}

/* ------------------------------------------------------------------ */
/* Documents posés sur les bureaux                                       */
/* ------------------------------------------------------------------ */

const INK = '#1f2a44';
const BODY =
  "Considérant que la sécurité des usagers et des agents doit être assurée en toutes circonstances, il convient de prendre les mesures nécessaires à la prévention des risques identifiés lors de l'évaluation annuelle et de les porter à la connaissance de l'ensemble des services municipaux.";

/** Texte justifié à gauche, coupé à la largeur `width` ; renvoie la hauteur suivante. */
function paragraph(ctx, text, x, y, width, lineHeight, maxLines = 99) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > width && line) {
      if (lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
      lines += 1;
      line = word;
    } else line = test;
  });
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
  return y + Math.min(lines + 1, maxLines) * lineHeight;
}

/** Signature manuscrite et tampon de la mairie. */
function signature(ctx, x, y, label) {
  ctx.fillStyle = INK;
  ctx.font = '11px Georgia, serif';
  ctx.fillText(label, x, y);
  ctx.strokeStyle = '#22306e';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 26);
  ctx.bezierCurveTo(x + 14, y + 4, x + 22, y + 34, x + 34, y + 16);
  ctx.bezierCurveTo(x + 44, y + 2, x + 50, y + 30, x + 66, y + 20);
  ctx.bezierCurveTo(x + 76, y + 14, x + 84, y + 24, x + 98, y + 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70, 80, 170, 0.75)';
  ctx.fillStyle = 'rgba(70, 80, 170, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 44, y + 18, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x - 44, y + 18, 19, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = 'bold 9px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MAIRIE', x - 44, y + 21);
  ctx.textAlign = 'left';
}

/** En-tête : République française et service émetteur. */
function letterhead(ctx, w, service) {
  ctx.fillStyle = '#1f3f8f';
  ctx.fillRect(18, 18, 5, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(23, 18, 5, 26);
  ctx.fillStyle = '#c42b34';
  ctx.fillRect(28, 18, 5, 26);
  ctx.fillStyle = INK;
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillText('RÉPUBLIQUE FRANÇAISE', 40, 27);
  ctx.font = '10px Arial, sans-serif';
  ctx.fillText(service, 40, 41);
  ctx.strokeStyle = '#c9ced8';
  ctx.beginPath();
  ctx.moveTo(18, 54);
  ctx.lineTo(w - 18, 54);
  ctx.stroke();
}

function title(ctx, w, text, y, size = 13) {
  ctx.fillStyle = INK;
  ctx.font = `bold ${size}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, y);
  ctx.textAlign = 'left';
}

const COTATIONS = [
  ['#94a3b8', 25],
  ['#f97316', 48],
  ['#ef4444', 66],
  ['#94a3b8', 31],
  ['#111827', 88],
  ['#f97316', 50],
];

/** Documents d'une mairie : arrêté, délibération, acte d'état civil, permis, document unique, plan d'action, courrier, budget. */
const DOCUMENTS = [
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Cabinet de la maire');
    title(ctx, w, 'ARRÊTÉ MUNICIPAL N° 2026-114', 84);
    ctx.font = 'italic 10px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('portant réglementation de la circulation — place de la Mairie', w / 2, 101);
    ctx.textAlign = 'left';
    ctx.font = '10px Georgia, serif';
    let y = 128;
    ['Le Maire de la commune,', 'Vu le Code général des collectivités territoriales,', 'Vu le Code de la route,'].forEach((t) => {
      ctx.fillText(t, 24, y);
      y += 15;
    });
    y = paragraph(ctx, BODY, 24, y + 4, w - 48, 14, 4);
    title(ctx, w, 'ARRÊTE', y + 18, 12);
    ctx.font = '10px Georgia, serif';
    y = paragraph(ctx, "Article 1 : la circulation des véhicules est interdite sur la place de la Mairie pendant la durée du salon, de 8 h à 19 h.", 24, y + 40, w - 48, 14);
    y = paragraph(ctx, 'Article 2 : la présente décision sera affichée en mairie et notifiée aux services de police municipale.', 24, y + 6, w - 48, 14);
    signature(ctx, w - 130, h0(ctx) - 70, 'La Maire,');
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Secrétariat général');
    title(ctx, w, 'EXTRAIT DU REGISTRE', 82, 12);
    title(ctx, w, 'DES DÉLIBÉRATIONS DU CONSEIL MUNICIPAL', 98, 11);
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText('Séance du 14 octobre 2026 — Délibération n° 2026/057', 24, 124);
    ctx.font = 'bold 10px Arial, sans-serif';
    paragraph(ctx, "Objet : mise à jour du Document unique d'évaluation des risques professionnels (DigiRisk)", 24, 146, w - 48, 14);
    ctx.font = '10px Georgia, serif';
    let y = paragraph(ctx, BODY, 24, 186, w - 48, 14, 5);
    y = paragraph(ctx, "Le conseil municipal, après en avoir délibéré, à l'unanimité, approuve le Document unique et le plan d'action annexés.", 24, y + 8, w - 48, 14);
    ctx.fillText('Présents : 19 — Votants : 23 — Pour : 23', 24, y + 14);
    signature(ctx, w - 130, h0(ctx) - 70, 'Pour extrait conforme,');
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Service de l’état civil');
    title(ctx, w, "EXTRAIT D'ACTE DE NAISSANCE", 86);
    const rows = [
      ['Nom', 'MARTIN'],
      ['Prénoms', 'Léa, Camille'],
      ['Née le', '3 mars 2026 à 14 h 20'],
      ['à', 'Hôpital de la commune'],
      ['Fille de', 'Thomas MARTIN'],
      ['et de', 'Inès DUBOIS'],
    ];
    rows.forEach(([label, value], i) => {
      const y = 126 + i * 30;
      ctx.fillStyle = '#5b6474';
      ctx.font = '10px Arial, sans-serif';
      ctx.fillText(label, 26, y);
      ctx.strokeStyle = '#c9ced8';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(90, y + 3);
      ctx.lineTo(w - 26, y + 3);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#22306e';
      ctx.font = 'italic 12px Georgia, serif';
      ctx.fillText(value, 96, y);
    });
    signature(ctx, w - 130, h0(ctx) - 70, "L'officier d'état civil,");
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Service urbanisme');
    title(ctx, w, 'DEMANDE DE PERMIS DE CONSTRUIRE', 84, 12);
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PC 034 172 26 A0012', w / 2, 102);
    ctx.textAlign = 'left';
    ['1. Identité du demandeur', '2. Terrain', '3. Nature des travaux', '4. Surface de plancher'].forEach((label, i) => {
      const y = 124 + i * 62;
      ctx.fillStyle = '#e6ebf3';
      ctx.fillRect(22, y, w - 44, 16);
      ctx.fillStyle = INK;
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.fillText(label, 28, y + 12);
      for (let k = 0; k < 3; k += 1) {
        ctx.strokeStyle = '#b8c0cc';
        ctx.strokeRect(28 + k * 84, y + 24, 76, 14);
        ctx.strokeRect(28 + k * 84, y + 24 + 18, 10, 10);
      }
      ctx.fillStyle = '#22306e';
      ctx.font = 'italic 10px Georgia, serif';
      ctx.fillText(['Dubois Marc', 'Section AB n° 214', 'Extension', '38 m²'][i], 32, y + 35);
      ctx.fillText('✓', 30, y + 51);
    });
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Document unique — DigiRisk');
    title(ctx, w, 'ÉVALUATION DES RISQUES', 82, 12);
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Unité de travail : WU1 Accueil du public', w / 2, 98);
    ctx.textAlign = 'left';
    const labels = ['Chute de plain-pied', 'Ambiance thermique', 'Agression verbale', 'Travail sur écran', 'Incendie', 'Manutention'];
    ctx.fillStyle = INK;
    ctx.fillRect(22, 112, w - 44, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Arial, sans-serif';
    ['Réf.', 'Risque', 'Cotation'].forEach((t, i) => ctx.fillText(t, [28, 72, w - 76][i], 124));
    labels.forEach((label, i) => {
      const y = 130 + i * 30;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#f1f4f8';
      ctx.fillRect(22, y, w - 44, 30);
      ctx.fillStyle = INK;
      ctx.font = 'bold 9px Arial, sans-serif';
      ctx.fillText(`RA${12 + i * 7}`, 28, y + 19);
      ctx.font = '10px Arial, sans-serif';
      ctx.fillText(label, 72, y + 19);
      const [color, value] = COTATIONS[i];
      ctx.fillStyle = color;
      ctx.fillRect(w - 76, y + 7, 46, 17);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Arial, sans-serif';
      ctx.fillText(String(value), w - 62, y + 20);
    });
    ctx.fillStyle = '#5b6474';
    ctx.font = 'italic 9px Arial, sans-serif';
    ctx.fillText('Échelle : 0-47 faible · 48-50 modéré · 51-80 élevé · 81-100 critique', 24, 330);
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Prévention des risques');
    title(ctx, w, "PLAN D'ACTION PRÉVENTION 2026", 84, 12);
    [
      ['Installer une rampe dans l’escalier d’honneur', 'mars', true],
      ['Former les agents à l’accueil difficile', 'avril', true],
      ['Remplacer les lampes du hall', 'mai', false],
      ['Vérifier les extincteurs (contrat annuel)', 'juin', true],
      ['Aménager les postes de l’état civil', 'sept.', false],
      ['Exercice d’évacuation incendie', 'oct.', false],
    ].forEach(([label, month, done], i) => {
      const y = 116 + i * 34;
      ctx.strokeStyle = INK;
      ctx.strokeRect(24, y - 10, 12, 12);
      if (done) {
        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillText('✓', 25, y + 1);
      }
      ctx.fillStyle = INK;
      ctx.font = '10px Arial, sans-serif';
      paragraph(ctx, label, 44, y, w - 110, 12, 2);
      ctx.fillStyle = '#5b6474';
      ctx.fillText(month, w - 52, y);
    });
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Service urbanisme');
    ctx.fillStyle = INK;
    ctx.font = '10px Georgia, serif';
    ctx.fillText('Le 18 octobre 2026', w - 130, 78);
    ctx.fillText('Objet : votre demande du 2 octobre', 24, 104);
    ctx.fillText('Madame, Monsieur,', 24, 132);
    let y = paragraph(ctx, BODY, 24, 152, w - 48, 14, 5);
    y = paragraph(ctx, "Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.", 24, y + 10, w - 48, 14);
    signature(ctx, w - 130, Math.max(y + 24, 300), "L'adjoint à l'urbanisme,");
  },
  (ctx, w) => {
    letterhead(ctx, w, 'Mairie — Service des finances');
    title(ctx, w, 'BUDGET PRIMITIF 2026', 82, 12);
    ctx.font = '10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Section de fonctionnement', w / 2, 98);
    ctx.textAlign = 'left';
    [
      ['011 Charges à caractère général', '1 284 500 €'],
      ['012 Charges de personnel', '3 912 000 €'],
      ['65 Autres charges de gestion', '642 300 €'],
      ['66 Charges financières', '118 400 €'],
      ['70 Produits des services', '486 900 €'],
      ['73 Impôts et taxes', '4 205 700 €'],
      ['74 Dotations et participations', '1 515 200 €'],
    ].forEach(([label, value], i) => {
      const y = 124 + i * 26;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#f1f4f8';
      ctx.fillRect(22, y - 14, w - 44, 26);
      ctx.fillStyle = INK;
      ctx.fillText(label, 28, y + 3);
      ctx.textAlign = 'right';
      ctx.fillText(value, w - 28, y + 3);
      ctx.textAlign = 'left';
    });
  },
];

/** Hauteur de la page en cours de dessin (canevas). */
const h0 = (ctx) => ctx.canvas.height;

const documentMaterials = new Map();
function documentMaterial(index) {
  const k = ((Math.round(index) % DOCUMENTS.length) + DOCUMENTS.length) % DOCUMENTS.length;
  if (!documentMaterials.has(k)) {
    const map = canvasTexture(`paper-document-${k}`, 300, 424, (ctx, w, h) => {
      ctx.fillStyle = '#fbfaf6';
      ctx.fillRect(0, 0, w, h);
      DOCUMENTS[k](ctx, w, h);
    });
    documentMaterials.set(k, new THREE.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 }));
  }
  return documentMaterials.get(k);
}

const PAPER_GEOMETRY = new THREE.PlaneGeometry(1, 1);

/** Feuille A4 (21 × 29,7 cm) posée à plat, haut de la page vers −Z, document n° `doc`. */
export function Paper({ doc = 0, ...rest }) {
  return (
    <group {...rest}>
      <mesh geometry={PAPER_GEOMETRY} material={documentMaterial(doc)} rotation={[-Math.PI / 2, 0, 0]} scale={[0.14, 0.198, 1]} receiveShadow raycast={noRaycast} />
    </group>
  );
}

/** Stylo posé à plat (corps bleu nuit, attache dorée). */
function Pen(props) {
  return (
    <group {...props}>
      <Cylinder rotation={[0, 0, Math.PI / 2]} radius={0.0045} height={0.12} color="#1d2a4a" metal={0.4} rough={0.35} />
      <Box size={[0.03, 0.002, 0.003]} position={[0.035, 0.005, 0]} color={GILT} metal={0.8} rough={0.3} />
    </group>
  );
}

const SCREEN_GEOMETRY = new THREE.PlaneGeometry(0.386, 0.222);

/** Écran plat de bureau à cadre fin et pied central, affichant DigiRisk (face vers +Z). */
export function OfficeMonitor({ screen = 0, ...rest }) {
  return (
    <group {...rest}>
      <Box size={[0.14, 0.008, 0.1]} position={[0, 0.004, 0]} color="#2a2d33" metal={0.4} rough={0.4} />
      <Box size={[0.03, 0.12, 0.014]} position={[0, 0.066, -0.022]} color="#2a2d33" metal={0.4} rough={0.4} />
      <Box size={[0.4, 0.236, 0.016]} position={[0, 0.16, 0]} color="#1a1c20" metal={0.3} rough={0.45} />
      <mesh geometry={SCREEN_GEOMETRY} material={screenMaterial(screen)} position={[0, 0.16, 0.0085]} raycast={noRaycast} />
    </group>
  );
}

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

/* Buste de Marianne : plâtre blanc sculpté d'un seul tenant, sur colonne de marbre moulurée */

const lathe = (profile, segments = 32) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);

// Colonne : base à tores, fût légèrement galbé, chapiteau mouluré
const COLUMN = lathe([[0, 0.06], [0.19, 0.06], [0.19, 0.085], [0.175, 0.1], [0.18, 0.115], [0.158, 0.13], [0.15, 0.15], [0.146, 0.42], [0.14, 0.66], [0.15, 0.675], [0.168, 0.69], [0.172, 0.705], [0.185, 0.72], [0, 0.72]]);
// Piédouche (petit pied tourné sous le buste)
const PIEDOUCHE = lathe([[0, 0], [0.075, 0], [0.075, 0.014], [0.058, 0.026], [0.038, 0.045], [0.036, 0.055], [0.048, 0.066], [0.066, 0.076], [0, 0.08]], 24);

/**
 * Buste de Marianne en plâtre blanc sur colonne de marbre (≈ 1,9 m au total). Le buste est une seule surface
 * sculptée (voir marianneSculpture.js) : visage serein au nez droit, arcades, paupières et lèvres modelées,
 * tête de trois quarts, bonnet phrygien plissé à pointe retombante et cocarde, chevelure ondulée et mèches
 * sur la nuque, cou et clavicules, péplum drapé retenu par une fibule ; plaque dorée « RF » sur le fût.
 */
export function MarianneBust() {
  const plaster = getMaterial({ color: PLASTER, roughness: 0.5, metalness: 0 });
  const marble = getMaterial({ color: MARBLE, roughness: 0.28, metalness: 0.08 });
  return (
    <group>
      {/* Colonne */}
      <Box size={[0.44, 0.06, 0.44]} position={[0, 0.03, 0]} color={MARBLE} rough={0.28} metal={0.08} />
      <mesh geometry={COLUMN} material={marble} castShadow receiveShadow raycast={noRaycast} />
      <Box size={[0.4, 0.05, 0.4]} position={[0, 0.745, 0]} color={MARBLE} rough={0.28} metal={0.08} />
      <Box size={[0.13, 0.08, 0.008]} position={[0, 0.5, 0.148]} map={plaqueRF()} metal={0.7} rough={0.35} />
      {/* Piédouche et buste sculpté (base du buste posée sur le piédouche) */}
      <mesh geometry={PIEDOUCHE} material={plaster} position={[0, 0.77, 0]} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={marianneGeometry()} material={plaster} position={[0, 0.84, 0]} castShadow receiveShadow raycast={noRaycast} />
    </group>
  );
}

// Plaque dorée « RF » gravée du fût
const plaqueRF = () =>
  canvasTexture('plaque-rf', 128, 80, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#c9a24a');
    g.addColorStop(0.5, '#e6c878');
    g.addColorStop(1, '#a8822f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7a5c1e';
    ctx.lineWidth = 3;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#5c4414';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('RF', w / 2, h / 2 + 15);
  });

/* Portrait officiel : la maire de la commune (même personnage 3D que dans son bureau) */

// Fond du portrait : boiseries et rayonnages à droite, drapeau tricolore drapé à gauche
const portraitBackdrop = () =>
  canvasTexture('portrait-fond', 256, 256, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, 0);
    bg.addColorStop(0, '#4a3b2a');
    bg.addColorStop(1, '#2e2419');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // Rayonnages de livres reliés
    for (let shelf = 0; shelf < 4; shelf += 1) {
      const y = 20 + shelf * 60;
      ctx.fillStyle = '#21180f';
      ctx.fillRect(110, y + 48, w - 110, 6);
      for (let x = 112; x < w; ) {
        const bw = 6 + ((x * 7 + shelf * 13) % 9);
        ctx.fillStyle = ['#5b2a20', '#2f3e2a', '#6b4a24', '#3a2a4a', '#7a5a2a'][(x + shelf) % 5];
        ctx.fillRect(x, y + 10 + ((x * 3) % 8), bw - 1, 38 - ((x * 3) % 8));
        x += bw;
      }
    }
    // Drapeau drapé (bandes bleu, blanc, rouge ondulées, ombre des plis)
    for (let y = 0; y < h; y += 2) {
      const wave = Math.sin(y * 0.06) * 6;
      [['#1f3f8f', 0], ['#efeee8', 34], ['#c8323a', 68]].forEach(([color, x]) => {
        ctx.fillStyle = color;
        ctx.fillRect(x + wave, y, 34, 2);
      });
      ctx.fillStyle = `rgba(0,0,0,${0.12 + 0.1 * Math.sin(y * 0.06 + 1.2)})`;
      ctx.fillRect(wave, y, 102, 2);
    }
    // Vignettage doux
    const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  });

/** Scène du portrait : buste de la maire de trois quarts, écharpe tricolore, éclairage de studio. */
function PortraitScene({ variant }) {
  return (
    <>
      <PerspectiveCamera makeDefault manual aspect={0.56 / 0.76} fov={22} position={[0.14, 1.07, 0.96]} rotation={[-0.05, 0.145, 0]} />
      <color attach="background" args={['#3b3227']} />
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#f3eee4', '#5a4a38', 0.55]} />
      <directionalLight position={[1.3, 1.9, 1.7]} intensity={1.5} color="#fff4e6" />
      <directionalLight position={[-1.4, 1.3, 0.9]} intensity={0.5} color="#dfe8ff" />
      <mesh position={[-0.05, 1.02, -0.55]}>
        <planeGeometry args={[1.1, 1.1]} />
        <meshBasicMaterial map={portraitBackdrop()} toneMapped={false} />
      </mesh>
      <group rotation={[0, 0.32, 0]}>
        <Person outfit="mayor" variant={variant} />
      </group>
    </>
  );
}

/**
 * Portrait officiel de la maire dans un cadre doré à moulure, accroché au mur (face à +Z) : la toile est un
 * rendu du personnage de la maire lui-même (`variant` : son apparence), calculé une fois.
 */
export function Portrait({ variant = 1 }) {
  return (
    <group>
      <Box size={[0.72, 0.92, 0.05]} position={[0, 0.46, 0.025]} color={GILT} metal={0.75} rough={0.35} />
      <Box size={[0.62, 0.82, 0.012]} position={[0, 0.46, 0.054]} color="#8a6a2c" metal={0.7} rough={0.4} />
      <mesh position={[0, 0.46, 0.0612]} userData={{ dynamic: true }} raycast={noRaycast}>
        <planeGeometry args={[0.56, 0.76]} />
        <meshStandardMaterial roughness={0.7} metalness={0}>
          <RenderTexture attach="map" width={420} height={570} frames={12}>
            <PortraitScene variant={variant} />
          </RenderTexture>
        </meshStandardMaterial>
      </mesh>
      {/* Cartel doré sous la toile */}
      <Box size={[0.16, 0.035, 0.006]} position={[0, 0.045, 0.06]} color={GILT} metal={0.8} rough={0.3} />
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

/** Grande table du conseil : plateau de noyer, tapis vert, pieds tournés, délibérations devant chaque place et registre. */
export function CouncilTable({ length = 4.5, seed = 0 }) {
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
        <group key={x} position={[(x + xs[i + 1]) / 2, 0.555, 0]}>
          {/* Documents de séance tournés vers chaque élu (délibération, budget, plan d'action) */}
          <Paper doc={[1, 7, 5, 4][(i + Math.floor(seed * 10)) % 4]} position={[0.02, 0, 0.28]} rotation={[0, 0.06, 0]} />
          <Paper doc={[1, 4, 7, 5][(i + Math.floor(seed * 10)) % 4]} position={[-0.02, 0, -0.28]} rotation={[0, Math.PI - 0.05, 0]} />
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
export function AntiqueDesk({ screens = 0, seed = 0 }) {
  const TOP = 0.52; // dessus du sous-main (écrans et clavier posés 2 mm au-dessus)
  const monitors = screens >= 2 ? [-0.2, 0.2] : screens === 1 ? [0.05] : [];
  // Écrans et documents propres à chaque bureau
  const pick = Math.floor(seed * 997);
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
          {monitors.map((x, i) => (
            <OfficeMonitor key={x} screen={pick + i * 5} position={[x, TOP, -0.15]} rotation={[0, monitors.length > 1 ? -x * 0.9 : 0, 0]} />
          ))}
          <Keyboard position={[0, TOP + 0.006, 0.08]} />
          {/* Dossier en cours, face à l'agent (côté +Z) */}
          <Paper doc={pick} position={[-0.33, 0.521, 0.09]} rotation={[0, 0.12, 0]} />
          <Pen position={[-0.24, 0.525, 0.16]} rotation={[0, 0.5, 0]} />
        </>
      ) : (
        <>
          <Paper doc={pick} position={[-0.06, 0.521, 0.05]} rotation={[0, 0.08, 0]} />
          <Paper doc={pick + 3} position={[-0.2, 0.5225, -0.02]} rotation={[0, -0.22, 0]} />
          <Pen position={[0.07, 0.525, 0.1]} rotation={[0, -0.4, 0]} />
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
export function WoodenCounter({ length = 2.4, screens = 0, seed = 0 }) {
  const pick = Math.floor(seed * 997);
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
      {/* Formulaire à remplir pour le public (lisible côté +Z) et stylo */}
      <Paper doc={2} position={[0.04, 0.753, 0.1]} rotation={[0, 0.1, 0]} />
      <Pen position={[0.18, 0.756, 0.12]} rotation={[0, -0.6, 0]} />
      {/* Poste de l'agent : derrière le vitrage, à côté de l'hygiaphone (ouverture centrale libre) */}
      {Array.from({ length: Math.min(screens, length > 1.6 ? 2 : 1) }, (_, i) => {
        const x = (i % 2 ? -1 : 1) * Math.min(0.6, length / 2 - 0.3);
        return (
          <group key={i} position={[x, 0.752, -0.1]} rotation={[0, Math.PI, 0]}>
            <OfficeMonitor screen={pick + i * 7} />
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
