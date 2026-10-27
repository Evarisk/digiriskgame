import React from 'react';
import { Box, Cylinder, Ball, PALETTE, DYNAMIC } from './kit';

/**
 * Personnages low-poly articulés (≈ 1,75 m => 1,17 unité), face à +Z.
 * Tenues métiers : bureau, ouvrier EPI, soudeur, peintre (combinaison + masque), cariste, logisticien.
 * Poses : stand | sit | work (bras vers l'avant) | type (assis au clavier) | carry.
 * `limbs` (objet mutable) reçoit les groupes bras/jambes pour l'animation de marche.
 */

export const OUTFITS = {
  office: { top: '#3b82f6', pants: '#1f2937', shoes: '#111827', vest: null, helmet: null },
  officeAlt: { top: '#f1f5f9', pants: '#334155', shoes: '#3f2a1d', vest: null, helmet: null },
  worker: { top: '#1d4ed8', pants: '#1e3a8a', shoes: '#111827', vest: '#facc15', helmet: '#f8fafc' },
  welder: { top: '#7c4a2d', pants: '#1f2937', shoes: '#111827', vest: null, helmet: null, mask: 'welding', gloves: '#a16207' },
  painter: { top: '#f8fafc', pants: '#f8fafc', shoes: '#111827', vest: null, helmet: null, mask: 'respirator', hood: '#f8fafc', gloves: '#2563eb' },
  driver: { top: '#334155', pants: '#1f2937', shoes: '#111827', vest: '#f97316', helmet: '#facc15' },
  logistics: { top: '#0f766e', pants: '#1f2937', shoes: '#111827', vest: '#f97316', helmet: null },
};

const SKINS = ['#f1c8a5', '#d9a47a', '#a8714d', '#7b4a2f'];
const HAIRS = ['#2b1d14', '#5b3a22', '#c9a15b', '#111111', '#7f7f7f'];

export function Person({ outfit = 'worker', pose = 'stand', variant = 0, colors, limbs, ...rest }) {
  const o = { ...(OUTFITS[outfit] || OUTFITS.worker), ...colors };
  const skin = SKINS[variant % SKINS.length];
  const hair = HAIRS[(variant * 3 + 1) % HAIRS.length];
  const seated = pose === 'sit' || pose === 'type';
  // Angles épaule / coude (rad) : bras le long du corps, au clavier, au poste ou portant une charge
  const [shoulder, elbow] = { type: [-0.35, -1.3], work: [-0.55, -0.9], carry: [-0.3, -1.27] }[pose] || [0, -0.1];
  const hipY = seated ? 0.33 : 0.56;
  const bodyY = hipY - 0.56;

  const setLimb = (key) => (el) => {
    if (limbs && el) limbs[key] = el;
  };
  // Membres animés : marqués pour que MergeStatic fusionne leurs pièces dans leur propre repère
  const limbData = limbs ? DYNAMIC : undefined;

  const leg = (side, key) => (
    <group ref={setLimb(key)} userData={limbData} position={[side * 0.065, hipY, 0]} rotation={[seated ? -Math.PI / 2 : 0, 0, 0]}>
      <Box position={[0, -0.135, 0]} size={[0.1, 0.27, 0.11]} color={o.pants} rough={0.8} />
      <group position={[0, -0.27, 0]} rotation={[seated ? Math.PI / 2 : 0, 0, 0]}>
        <Box position={[0, -0.12, 0]} size={[0.088, 0.24, 0.095]} color={o.pants} rough={0.8} />
        <Box position={[0, -0.255, 0.025]} size={[0.095, 0.05, 0.15]} color={o.shoes} rough={0.6} />
      </group>
    </group>
  );

  const arm = (side, key) => (
    <group ref={setLimb(key)} userData={limbData} position={[side * 0.165, 0.95 + bodyY, 0]} rotation={[shoulder, 0, side * 0.06]}>
      <Box position={[0, -0.11, 0]} size={[0.072, 0.22, 0.08]} color={o.top} rough={0.75} />
      <group position={[0, -0.22, 0]} rotation={[elbow, 0, 0]}>
        <Box position={[0, -0.1, 0]} size={[0.064, 0.2, 0.072]} color={o.top} rough={0.75} />
        <Box position={[0, -0.225, 0]} size={[0.06, 0.065, 0.045]} color={o.gloves || skin} rough={0.6} />
      </group>
    </group>
  );

  return (
    <group {...rest}>
      {leg(-1, 'leftLeg')}
      {leg(1, 'rightLeg')}
      {/* Bassin & torse */}
      <Box position={[0, hipY + 0.03, 0]} size={[0.24, 0.1, 0.14]} color={o.pants} rough={0.8} />
      <Box position={[0, 0.8 + bodyY, 0]} size={[0.27, 0.34, 0.15]} color={o.top} rough={0.75} />
      {o.vest && (
        <group position={[0, 0.79 + bodyY, 0]}>
          <Box size={[0.285, 0.3, 0.162]} color={o.vest} rough={0.6} glow={0.12} />
          <Box position={[0, -0.06, 0]} size={[0.29, 0.03, 0.166]} color="#e5e7eb" glow={0.35} shadow={false} />
          <Box position={[0, 0.03, 0]} size={[0.29, 0.03, 0.166]} color="#e5e7eb" glow={0.35} shadow={false} />
        </group>
      )}
      {outfit === 'welder' && <Box position={[0, 0.66 + bodyY, 0.08]} size={[0.24, 0.42, 0.02]} color="#8b5a2b" rough={0.9} />}
      {arm(-1, 'leftArm')}
      {arm(1, 'rightArm')}
      {/* Cou & tête */}
      <Cylinder position={[0, 1.0 + bodyY, 0]} radius={0.035} height={0.06} color={skin} rough={0.6} />
      <Ball position={[0, 1.085 + bodyY, 0]} radius={0.085} color={skin} rough={0.6} />
      {!o.helmet && !o.hood && <Ball position={[0, 1.11 + bodyY, -0.01]} scale={[0.178, 0.13, 0.18]} color={hair} rough={0.9} />}
      <Box position={[-0.03, 1.095 + bodyY, 0.082]} size={[0.018, 0.012, 0.006]} color="#111827" shadow={false} />
      <Box position={[0.03, 1.095 + bodyY, 0.082]} size={[0.018, 0.012, 0.006]} color="#111827" shadow={false} />
      {o.helmet && (
        <group position={[0, 1.12 + bodyY, 0]}>
          <Ball position={[0, 0.02, 0]} scale={[0.2, 0.15, 0.21]} color={o.helmet} rough={0.35} />
          <Cylinder position={[0, -0.005, 0.02]} radius={0.115} height={0.012} segments={14} color={o.helmet} rough={0.35} />
        </group>
      )}
      {o.hood && <Ball position={[0, 1.1 + bodyY, -0.005]} scale={[0.195, 0.2, 0.19]} color={o.hood} rough={0.9} />}
      {o.mask === 'welding' && (
        <group position={[0, 1.09 + bodyY, 0.07]}>
          <Box size={[0.17, 0.19, 0.05]} color="#1f2937" rough={0.5} />
          <Box position={[0, 0.02, 0.026]} size={[0.1, 0.035, 0.004]} color="#0ea5e9" glow={0.6} shadow={false} />
        </group>
      )}
      {o.mask === 'respirator' && (
        <group position={[0, 1.065 + bodyY, 0.08]}>
          <Box size={[0.08, 0.06, 0.04]} color="#4b5563" rough={0.6} />
          <Cylinder position={[-0.045, -0.01, 0.01]} rotation={[Math.PI / 2, 0, 0]} radius={0.022} height={0.03} color="#db2777" />
          <Cylinder position={[0.045, -0.01, 0.01]} rotation={[Math.PI / 2, 0, 0]} radius={0.022} height={0.03} color="#db2777" />
          <Box position={[0, 0.06, -0.005]} size={[0.15, 0.05, 0.01]} color="#bae6fd" opacity={0.6} shadow={false} />
        </group>
      )}
      {pose === 'carry' && <Box position={[0, 0.82 + bodyY, 0.24]} size={[0.26, 0.2, 0.2]} color={PALETTE.carton} rough={0.85} />}
    </group>
  );
}
