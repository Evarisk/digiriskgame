import { useSyncExternalStore } from 'react';

/**
 * État partagé du mode visite entre le contrôleur 3D (dans le Canvas) et le HUD DOM :
 * verrouillage du pointeur, élément visé, zone traversée et position du joueur (minicarte).
 */

const INITIAL = {
  locked: false,
  target: null, // élément DigiRisk visé (UT, groupement ou entité mère)
  zoneUt: null, // UT dans laquelle se trouve le joueur
  zoneBuilding: null, // groupement dans lequel se trouve le joueur
  player: null, // { x, z, yaw }
  nextUt: null, // prochain poste à inspecter (le plus proche non inspecté) : objectif de la mission
};

let state = INITIAL;
const listeners = new Set();

export const explorerStore = {
  canvas: null, // élément <canvas> WebGL, renseigné à la création du Canvas
  get: () => state,
  set(partial) {
    state = { ...state, ...partial };
    listeners.forEach((notify) => notify());
  },
  reset() {
    explorerStore.set({ ...INITIAL, locked: state.locked });
  },
  subscribe(notify) {
    listeners.add(notify);
    return () => listeners.delete(notify);
  },
  /** Capture la souris (doit être appelé depuis un geste utilisateur : clic, touche). */
  requestLock() {
    const canvas = explorerStore.canvas;
    if (!canvas || document.pointerLockElement === canvas) return;
    const pending = canvas.requestPointerLock();
    // Chrome refuse une nouvelle capture juste après une sortie par Échap : le HUD propose alors de recliquer
    if (pending?.catch) pending.catch(() => {});
  },
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('pointerlockchange', () => {
    const locked = Boolean(explorerStore.canvas) && document.pointerLockElement === explorerStore.canvas;
    if (locked !== state.locked) explorerStore.set({ locked });
  });
}

export function useExplorer(selector) {
  return useSyncExternalStore(explorerStore.subscribe, () => selector(state));
}

/**
 * Guidage du joueur vers un élément : distance en mètres (1 unité ≈ 1,5 m), angle par rapport au
 * regard (radians, positif = à gauche) et indication textuelle.
 */
export function guideTo(player, element) {
  const position = element?.layout3D?.worldPosition;
  if (!player || !position) return null;
  const dx = position[0] - player.x;
  const dz = position[2] - player.z;
  let angle = Math.atan2(-dx, -dz) - player.yaw;
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  const turn = Math.abs(angle) < 0.35 ? 'droit devant' : Math.abs(angle) > 2.4 ? 'derrière vous' : angle > 0 ? 'sur votre gauche' : 'sur votre droite';
  return { meters: Math.round(Math.hypot(dx, dz) * 1.5), angle, turn };
}

/** Le mode visite nécessite une souris (capture du pointeur) : indisponible sur écran tactile seul. */
export const EXPLORER_SUPPORTED =
  typeof window !== 'undefined' &&
  typeof Element !== 'undefined' &&
  'requestPointerLock' in Element.prototype &&
  (window.matchMedia?.('(any-pointer: fine)').matches ?? true);
