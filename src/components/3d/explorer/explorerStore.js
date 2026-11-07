import { useSyncExternalStore } from 'react';
import { prefersTouchControls, saveTouchPreference } from '../../../services/touchControls';

/**
 * État partagé du mode visite entre le contrôleur 3D (dans le Canvas) et le HUD DOM :
 * visite en cours ou en pause, commandes (souris ou joysticks), élément visé, zone traversée et position
 * du joueur (minicarte).
 */

const INITIAL = {
  // Visite en cours (sinon : carte de pause). Souris et clavier : souris capturée (Pointer Lock) ;
  // joysticks : après « Jouer », jusqu'à « Pause »
  locked: false,
  touch: false, // commandes tactiles : joysticks à l'écran (téléphone, tablette, Samsung DeX, ou au choix)
  target: null, // élément DigiRisk visé (UT, groupement ou entité mère)
  zoneUt: null, // UT dans laquelle se trouve le joueur
  zoneBuilding: null, // groupement dans lequel se trouve le joueur
  player: null, // { x, z, yaw }
  nextUt: null, // prochain poste à inspecter (le plus proche non inspecté) : objectif de la mission
};

let state = { ...INITIAL, touch: prefersTouchControls() };
const listeners = new Set();

export const explorerStore = {
  canvas: null, // élément <canvas> WebGL, renseigné à la création du Canvas
  actions: null, // { inspect, jump } : gestes du joueur, déclenchés par les boutons tactiles du HUD
  get: () => state,
  set(partial) {
    state = { ...state, ...partial };
    listeners.forEach((notify) => notify());
  },
  reset() {
    explorerStore.set({ ...INITIAL, locked: state.locked, touch: state.touch });
  },
  subscribe(notify) {
    listeners.add(notify);
    return () => listeners.delete(notify);
  },
  /**
   * Lance (ou reprend) la visite. Souris : capture du pointeur, à appeler depuis un geste utilisateur (clic,
   * touche) ; joysticks : la visite reprend directement.
   */
  requestLock() {
    if (state.touch) {
      if (!state.locked) explorerStore.set({ locked: true });
      return;
    }
    const canvas = explorerStore.canvas;
    if (!canvas || document.pointerLockElement === canvas) return;
    const pending = canvas.requestPointerLock();
    // Chrome refuse une nouvelle capture juste après une sortie par Échap : le HUD propose alors de recliquer
    if (pending?.catch) pending.catch(() => {});
  },
  /** Met la visite en pause (libère la souris capturée). */
  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (state.touch && state.locked) explorerStore.set({ locked: false });
  },
  /** Choix des commandes (mémorisé) : la visite passe en pause, « Jouer » la relance avec les nouvelles. */
  setTouch(touch) {
    saveTouchPreference(touch);
    if (touch === state.touch) return;
    explorerStore.set({ touch, locked: false });
    if (touch && document.pointerLockElement) document.exitPointerLock();
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('pointerlockchange', () => {
    // Joysticks : la visite en cours ne dépend pas de la capture de la souris
    if (state.touch) return;
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
