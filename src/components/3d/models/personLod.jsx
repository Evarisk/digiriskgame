import React, { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import MergeStatic from './MergeStatic';
import { Person } from './people';

/**
 * Niveau de détail des personnages selon la distance à la caméra. De près, un personnage est articulé (bras,
 * avant-bras, jambes et tête animés : une vingtaine de maillages) ; au-delà de LOD_FAR, il est fusionné en
 * quelques maillages, gestes figés — à cette distance il ne fait que quelques pixels — et redevient articulé
 * en deçà de LOD_NEAR (l'écart évite les allers-retours à la limite).
 */
export const LOD_FAR = 40;
export const LOD_NEAR = 34;
const tmp = new THREE.Vector3();

/**
 * Vrai tant que l'objet `ref` est assez près de la caméra ; `onChange(proche)` au changement. `far` / `near` :
 * seuils propres à une vue plus éloignée (vue plongeante du jeu de stratégie).
 */
export function useDistanceLod(ref, onChange, { far = LOD_FAR, near = LOD_NEAR } = {}) {
  const [close, setClose] = useState(true);
  const state = useRef(true);
  useFrame(({ camera }) => {
    const group = ref.current;
    if (!group) return;
    const d = camera.position.distanceTo(group.getWorldPosition(tmp));
    const next = state.current ? d < far : d < near;
    if (next === state.current) return;
    state.current = next;
    onChange?.(next);
    setClose(next);
  });
  return close;
}

/**
 * Personnage articulé de près (`limbs` reçoit ses membres animés) ; de loin, version légère fusionnée en un seul
 * maillage, gestes figés. `lite` : version légère même de près (vue de haut du jeu de stratégie, où le visage ne se
 * voit pas). Isolé : la fusion de l'élément qui le contient ne le touche pas, il refait la sienne à chaque
 * changement de niveau de détail.
 */
export function LodPerson({ close, limbs, lite = false, ...props }) {
  const light = lite || !close;
  return (
    <MergeStatic isolated key={close ? 'articule' : 'fusionne'} name={close ? 'personne:articulee' : 'personne:fusionnee'} deps={[props.outfit, props.pose, props.variant, close, light]}>
      <Person {...props} lite={light} limbs={close ? limbs : undefined} />
    </MergeStatic>
  );
}

/** Oublie les membres de la version articulée (la version fusionnée n'en a pas). */
export function forgetLimbs(limbs) {
  Object.keys(limbs).forEach((key) => delete limbs[key]);
}
