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

/** Le mode visite nécessite une souris (capture du pointeur) : indisponible sur écran tactile seul. */
export const EXPLORER_SUPPORTED =
  typeof window !== 'undefined' &&
  typeof Element !== 'undefined' &&
  'requestPointerLock' in Element.prototype &&
  (window.matchMedia?.('(any-pointer: fine)').matches ?? true);
