import { forwardRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { guideTo, useExplorer } from './explorerStore';

/**
 * Mains du préventeur tenant une tablette DigiRisk, affichées au premier plan de la vue.
 * L'écran (texture canvas) guide la mission : avancement, prochain poste à inspecter (direction et
 * distance), puis l'élément visé et l'action possible.
 * Rendu sans test de profondeur pour ne jamais passer derrière un mur proche.
 * La position est recopiée depuis la caméra par FirstPersonExplorer (après sa mise à jour).
 */

const SCREEN_W = 512;
const SCREEN_H = 336;

function kindLabel(element) {
  if (element.elementType === 'workunit') return 'Unité de travail';
  // Seule l'entité mère n'a pas de parent dans l'arborescence positionnée
  if (!element.parentBuildingRef) return 'Entité';
  return element.layout3D?.level ? 'Sous-groupement' : 'Groupement';
}

const FONT = 'Inter, system-ui, sans-serif';

/** Texte tronqué avec points de suspension à une largeur donnée. */
function fit(ctx, text, maxWidth) {
  let out = String(text || '');
  if (ctx.measureText(out).width <= maxWidth) return out;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

/** Pastille de référence teintée par la cotation (renvoie sa largeur). */
function refBadge(ctx, element, cotationMode, x, y, h = 38) {
  const scale = cotationMode === 'brute' ? element.stats?.scaleBrute : element.stats?.scaleResiduelle;
  ctx.font = `bold 24px ${FONT}`;
  const w = ctx.measureText(element.ref || '').width + 22;
  ctx.fillStyle = scale?.color || '#475569';
  ctx.fillRect(x, y - h / 2, w, h);
  ctx.strokeStyle = scale?.borderBadge || '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y - h / 2, w, h);
  ctx.fillStyle = scale?.textColor || '#ffffff';
  ctx.fillText(element.ref || '', x + 11, y + 1);
  return w;
}

/** Flèche de direction (vers le haut = droit devant), tournée de l'angle relatif au regard. */
function arrow(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(18, 14);
  ctx.lineTo(0, 5);
  ctx.lineTo(-18, 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawScreen(ctx, { target, nextUt, guide, cotationMode, inspectedCount, total, isInspected }) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  // En-tête : mission et avancement
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, SCREEN_W, 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText('VISITE DE SÉCURITÉ', 18, 26);
  ctx.textAlign = 'right';
  ctx.fillText(`${inspectedCount} / ${total} postes`, SCREEN_W - 18, 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.fillRect(18, 60, SCREEN_W - 36, 10);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(18, 60, total ? ((SCREEN_W - 36) * inspectedCount) / total : 0, 10);

  // Objectif : prochain poste à inspecter
  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText('OBJECTIF', 18, 92);
  if (!nextUt) {
    const finished = total > 0 && inspectedCount >= total;
    ctx.fillStyle = finished ? '#22c55e' : '#cbd5e1';
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(finished ? '✓ Mission accomplie !' : total ? 'Recherche du prochain poste…' : 'Aucun poste à inspecter', 18, 132);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `20px ${FONT}`;
    if (finished) ctx.fillText('Tous les postes ont été inspectés.', 18, 166);
  } else {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `20px ${FONT}`;
    ctx.fillText('Allez inspecter ce poste :', 18, 118);
    const w = refBadge(ctx, nextUt, cotationMode, 18, 152);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(fit(ctx, nextUt.label, SCREEN_W - 120 - w), 30 + w, 153);
    if (guide) {
      arrow(ctx, SCREEN_W - 46, 140, guide.angle, '#38bdf8');
      ctx.fillStyle = '#38bdf8';
      ctx.font = `bold 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`${guide.meters} m`, SCREEN_W - 46, 178);
      ctx.textAlign = 'left';
    }
  }

  // Viseur : élément visé et action possible
  ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.fillRect(18, 196, SCREEN_W - 36, 2);
  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText('VISEUR', 18, 220);
  if (!target) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `21px ${FONT}`;
    ctx.fillText('Approchez-vous du poste et pointez-le', 18, 256);
    ctx.fillText('avec le viseur (rond au centre de l’écran).', 18, 288);
    return;
  }
  const residual = cotationMode !== 'brute';
  const score = residual ? target.stats?.maxResiduelle : target.stats?.maxBrute;
  const w = refBadge(ctx, target, cotationMode, 18, 256, 34);
  ctx.fillStyle = '#f8fafc';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(fit(ctx, `${target.label} · ${score ?? '—'}/100`, SCREEN_W - 48 - w), 30 + w, 257);
  ctx.font = `bold 22px ${FONT}`;
  if (target.elementType !== 'workunit') {
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`${kindLabel(target)} · [E] voir la fiche`, 18, 304);
  } else if (isInspected) {
    ctx.fillStyle = '#22c55e';
    ctx.fillText('✓ Poste déjà inspecté · [E] revoir', 18, 304);
  } else {
    ctx.fillStyle = '#facc15';
    ctx.fillText('Appuyez sur [E] pour inspecter ce poste', 18, 304);
  }
}

const InspectorTablet = forwardRef(function InspectorTablet({ cotationMode, inspectedIds, total }, ref) {
  const target = useExplorer((st) => st.target);

  const { texture, materials } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // Hors test de profondeur et dans la file transparente (dessinée en dernier, triée par renderOrder) :
    // la tablette passe devant tout, y compris la balise de mission qui traverse les murs
    const overlay = { depthTest: false, depthWrite: false, transparent: true };
    return {
      texture: tex,
      materials: {
        body: new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.5, metalness: 0.4, ...overlay }),
        screen: new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...overlay }),
        sleeve: new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.85, ...overlay }),
        band: new THREE.MeshStandardMaterial({ color: '#e5e7eb', emissive: '#94a3b8', emissiveIntensity: 0.4, roughness: 0.4, ...overlay }),
        glove: new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.8, ...overlay }),
      },
    };
  }, []);
  useEffect(
    () => () => {
      texture.dispose();
      Object.values(materials).forEach((m) => m.dispose());
    },
    [texture, materials]
  );

  const nextUt = useExplorer((st) => st.nextUt);
  const player = useExplorer((st) => st.player);
  const guide = guideTo(player, nextUt);
  const guideKey = guide ? `${guide.meters}|${Math.round(guide.angle * 20)}` : '';
  const inspectedCount = inspectedIds?.size || 0;
  const isInspected = Boolean(target && inspectedIds?.has(target.id));
  useEffect(() => {
    drawScreen(texture.image.getContext('2d'), { target, nextUt, guide, cotationMode, inspectedCount, total, isInspected });
    texture.needsUpdate = true;
    // Redessin uniquement quand l'affichage change (flèche arrondie à 3°)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texture, target, nextUt, guideKey, cotationMode, inspectedCount, total, isInspected]);

  // Ordre de rendu explicite : manches, tablette, écran, puis gants par-dessus
  const part = (material, order, geometry, props) => (
    <mesh material={material} renderOrder={order} frustumCulled={false} {...props}>
      {geometry}
    </mesh>
  );

  return (
    <group ref={ref} userData={{ noCollide: true }} visible={false}>
      {/* Tablette entièrement visible en bas à droite, peu inclinée, assez grande pour lire l'écran */}
      <group position={[0.22, -0.12, -0.32]} rotation={[-0.32, -0.26, -0.02]} scale={0.95}>
        {/* Avant-bras sous la tablette, mains tenant le bord inférieur sans masquer l'écran */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.085, -0.1, 0.0]} rotation={[0.9, 0, side * -0.25]}>
            {part(materials.sleeve, 1000, <cylinderGeometry args={[0.03, 0.036, 0.22, 12]} />, { position: [0, -0.1, 0] })}
            {part(materials.band, 1001, <cylinderGeometry args={[0.0305, 0.0315, 0.018, 12]} />, { position: [0, -0.05, 0] })}
          </group>
        ))}
        {part(materials.body, 1002, <boxGeometry args={[0.2, 0.135, 0.008]} />)}
        {part(materials.screen, 1003, <planeGeometry args={[0.186, 0.122]} />, { position: [0, 0, 0.0045] })}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.078, -0.09, 0.004]}>
            {part(materials.glove, 1004, <boxGeometry args={[0.026, 0.062, 0.03]} />, { rotation: [0, 0, side * 0.2] })}
            {part(materials.glove, 1004, <boxGeometry args={[0.018, 0.04, 0.012]} />, { position: [-side * 0.016, 0.012, 0.012], rotation: [0, 0, side * 0.9] })}
          </group>
        ))}
      </group>
    </group>
  );
});

export default InspectorTablet;
