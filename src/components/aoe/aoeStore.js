/**
 * État partagé de Cité Prévention entre la 3D et l'interface (même patron que l'explorateur : un magasin externe
 * lu avec useSyncExternalStore, sans bibliothèque d'état). La partie (moteur pur) avance à pas fixe de 0,1 s ; la
 * 3D lit directement `store.game` à chaque image, l'interface est rafraîchie une dizaine de fois par seconde.
 */
import { useSyncExternalStore } from 'react';
import { createGame, step, applyCommand } from '../../game/aoe/engine.js';
import { botTick } from '../../game/aoe/personas.js';

const STEP = 0.1;
const listeners = new Set();

const freshUi = () => ({
  screen: 'start', // start | game | end
  selection: [], // identifiants (unités, bâtiments, ressources, dangers)
  placing: null, // type de bâtiment en cours de pose
  rot: 0,
  ghost: null, // [x, z] de l'aperçu de pose
  speed: 1,
  paused: false,
  autoplay: false,
  notes: [],
  error: null,
  errorAt: 0,
  drawer: true, // panneau des indicateurs ouvert
  help: false, // fenêtre « Comment jouer »
});

export const store = {
  game: null,
  version: 0,
  ui: freshUi(),
  camera: { x: 0, z: 22, d: 62 },
  memo: {},
  tuto: null, // didacticiel en cours : { i (étape), base (repères de l'étape), doneAt, … }
};

export function emit() {
  store.version += 1;
  listeners.forEach((l) => l());
}
export const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Abonnement de l'interface : renvoie un compteur qui change à chaque rafraîchissement. */
export const useAoe = () => useSyncExternalStore(subscribe, () => store.version);
/** Abonnement de la 3D : ne change qu'aux évolutions de structure de la partie (bâtiments, dangers…). */
export const useAoeRevision = () => useSyncExternalStore(subscribe, () => (store.game ? `${store.game.revision}|${store.ui.screen}` : 'none'));

let noteId = 0;
export function pushNotes(notes) {
  notes.forEach((n) => store.ui.notes.push({ ...n, id: (noteId += 1), at: performance.now() }));
  if (store.ui.notes.length > 5) store.ui.notes.splice(0, store.ui.notes.length - 5);
}

/** Nouvelle partie ; `tutorial` : partie guidée pas à pas (moteur en mode calme jusqu'à la fin du didacticiel). */
export function newGame({ seed = Math.floor(Math.random() * 100000) + 1, autoplay = false, tutorial = false } = {}) {
  store.game = createGame({ seed, calm: tutorial });
  store.memo = {};
  store.ui = { ...freshUi(), screen: 'game', autoplay, speed: autoplay ? 2 : 1 };
  store.camera = { x: 0, z: 22, d: 62 };
  store.tuto = tutorial ? { i: 0, base: null, doneAt: 0 } : null;
  if (!tutorial) pushNotes([{ level: 'info', text: autoplay ? 'Démo automatique : la cité se construit toute seule. Cliquez sur « Prendre la main » pour jouer.' : 'Bienvenue ! Suivez le panneau « Prochaine étape » à gauche pour bien démarrer (bouton ? en haut : comment jouer).' }]);
  emit();
}

export function backToStart() {
  store.game = null;
  store.tuto = null;
  store.ui = freshUi();
  emit();
}

/** Commande du joueur (passe par le moteur) ; le message d'erreur s'affiche quelques secondes. */
export function command(cmd) {
  if (!store.game) return { ok: false };
  const r = applyCommand(store.game, cmd);
  if (!r.ok) {
    store.ui.error = r.error;
    store.ui.errorAt = performance.now();
  }
  emit();
  return r;
}

export function setUi(patch) {
  Object.assign(store.ui, patch);
  emit();
}

/** Recentre la caméra (minicarte, notifications, raccourcis). */
export function lookAt(x, z) {
  store.camera.x = x;
  store.camera.z = z;
}

let acc = 0;
let lastEmit = 0;
/** Avance la partie du temps réel écoulé × vitesse (au plus 4 s de jeu par image, le reste est abandonné). */
export function tick(realDt) {
  const g = store.game;
  if (!g || store.ui.screen !== 'game' || store.ui.paused) return;
  acc += Math.min(realDt, 0.25) * store.ui.speed;
  const notes = [];
  let n = 0;
  while (acc >= STEP && n < 40) {
    if (store.ui.autoplay) botTick(g, 'demo', store.memo);
    notes.push(...step(g, STEP));
    acc -= STEP;
    n += 1;
    if (g.outcome) break;
  }
  if (n >= 40) acc = 0;
  if (notes.length) pushNotes(notes);
  // Sélection : on retire ce qui n'existe plus (danger neutralisé, ressource épuisée)
  const before = store.ui.selection.length;
  store.ui.selection = store.ui.selection.filter((id) => g.units.some((u) => u.id === id) || g.buildings.some((b) => b.id === id) || g.nodes.some((x) => x.id === id && x.amount > 0) || g.hazards.some((h) => h.id === id));
  if (g.outcome) store.ui.screen = 'end';
  const now = performance.now();
  if (notes.length || g.outcome || before !== store.ui.selection.length || now - lastEmit > 120) {
    lastEmit = now;
    emit();
  }
}

/* Raccourcis de lecture */
export const unitById = (id) => store.game?.units.find((u) => u.id === id);
export const buildingById = (id) => store.game?.buildings.find((b) => b.id === id);
export const selectedUnits = () => store.ui.selection.map(unitById).filter(Boolean);
