import { forwardRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useExplorer } from './explorerStore';

/**
 * Mains du préventeur tenant une tablette DigiRisk, affichées au premier plan de la vue.
 * L'écran (texture canvas) résume l'élément visé : référence, libellé, cotation, avancement de la visite.
 * Rendu sans test de profondeur pour ne jamais passer derrière un mur proche.
 * La position est recopiée depuis la caméra par FirstPersonExplorer (après sa mise à jour).
 */

const SCREEN_W = 512;
const SCREEN_H = 336;

function kindLabel(element) {
  if (element.elementType === 'workunit') return 'Unité de travail';
  return element.children?.some((c) => c.elementType === 'groupment') ? 'Entité' : 'Groupement';
}

function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

function drawScreen(ctx, { target, cotationMode, inspectedCount, total, isInspected }) {
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, SCREEN_W, 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('DigiRisk · Visite', 18, 27);
  ctx.textAlign = 'right';
  ctx.fillText(`${inspectedCount}/${total} UT`, SCREEN_W - 18, 27);
  ctx.textAlign = 'left';

  if (!target) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '26px Inter, system-ui, sans-serif';
    ctx.fillText('Visez un poste de travail', 24, 150);
    ctx.fillText('pour afficher sa cotation.', 24, 190);
    return;
  }

  const residual = cotationMode !== 'brute';
  const score = residual ? target.stats?.maxResiduelle : target.stats?.maxBrute;
  const scale = residual ? target.stats?.scaleResiduelle : target.stats?.scaleBrute;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px Inter, system-ui, sans-serif';
  ctx.fillText(kindLabel(target), 24, 84);

  ctx.fillStyle = scale?.color || '#475569';
  ctx.fillRect(24, 104, 120, 46);
  ctx.strokeStyle = scale?.borderBadge || '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 104, 120, 46);
  ctx.fillStyle = scale?.textColor || '#ffffff';
  ctx.font = 'bold 28px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(target.ref || '', 84, 128);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 40px Inter, system-ui, sans-serif';
  ctx.fillText(score != null ? `${score}/100` : '—', 162, 128);

  ctx.font = '26px Inter, system-ui, sans-serif';
  wrap(ctx, target.label, SCREEN_W - 48, 2).forEach((line, i) => ctx.fillText(line, 24, 184 + i * 32));

  ctx.fillStyle = '#94a3b8';
  ctx.font = '22px Inter, system-ui, sans-serif';
  const risks = target.stats?.totalRisks ?? 0;
  ctx.fillText(`${risks} risque${risks > 1 ? 's' : ''} · ${scale?.shortLabel || ''}`, 24, 258);

  ctx.fillStyle = isInspected ? '#22c55e' : '#38bdf8';
  ctx.font = 'bold 24px Inter, system-ui, sans-serif';
  ctx.fillText(isInspected ? '✓ Déjà inspecté · [E] revoir' : '[E] Inspecter les risques', 24, 304);
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
    const overlay = { depthTest: false, depthWrite: false };
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

  const inspectedCount = inspectedIds?.size || 0;
  const isInspected = Boolean(target && inspectedIds?.has(target.id));
  useEffect(() => {
    drawScreen(texture.image.getContext('2d'), { target, cotationMode, inspectedCount, total, isInspected });
    texture.needsUpdate = true;
  }, [texture, target, cotationMode, inspectedCount, total, isInspected]);

  // Ordre de rendu explicite : manches, tablette, écran, puis gants par-dessus
  const part = (material, order, geometry, props) => (
    <mesh material={material} renderOrder={order} frustumCulled={false} {...props}>
      {geometry}
    </mesh>
  );

  return (
    <group ref={ref} userData={{ noCollide: true }} visible={false}>
      <group position={[0.15, -0.19, -0.32]} rotation={[-0.62, -0.3, -0.04]} scale={0.68}>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.105, -0.035, 0.06]} rotation={[0.9, 0, side * -0.25]}>
            {part(materials.sleeve, 1000, <cylinderGeometry args={[0.03, 0.036, 0.22, 12]} />, { position: [0, -0.1, 0] })}
            {part(materials.band, 1001, <cylinderGeometry args={[0.0305, 0.0315, 0.018, 12]} />, { position: [0, -0.05, 0] })}
          </group>
        ))}
        {part(materials.body, 1002, <boxGeometry args={[0.2, 0.135, 0.008]} />)}
        {part(materials.screen, 1003, <planeGeometry args={[0.186, 0.122]} />, { position: [0, 0, 0.0045] })}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.1, -0.022, 0.004]}>
            {part(materials.glove, 1004, <boxGeometry args={[0.026, 0.062, 0.03]} />, { rotation: [0, 0, side * 0.2] })}
            {part(materials.glove, 1004, <boxGeometry args={[0.018, 0.04, 0.012]} />, { position: [-side * 0.016, 0.012, 0.012], rotation: [0, 0, side * 0.9] })}
          </group>
        ))}
      </group>
    </group>
  );
});

export default InspectorTablet;
