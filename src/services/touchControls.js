/**
 * Commandes tactiles des visites en première personne (jumeau numérique et éditeur de site) : état partagé
 * entre les joysticks à l'écran (components/ui/TouchControls.jsx) et les contrôleurs de caméra, détection de
 * l'appareil et choix mémorisé du joueur (joysticks ou souris et clavier).
 */

/**
 * Commandes en cours, écrites par TouchControls : `move` et `look` dans [−1, 1] (x vers la droite, y vers le
 * bas de l'écran), `swipe` = glissé du doigt accumulé en pixels depuis la dernière image.
 */
export const touchInput = { move: [0, 0], look: [0, 0], swipe: [0, 0] };

export function resetTouchInput() {
  touchInput.move = [0, 0];
  touchInput.look = [0, 0];
  touchInput.swipe = [0, 0];
}

const STICK_TURN = 2.4; // rad/s : joystick droit poussé à fond (gauche / droite)
const STICK_TILT = 1.4; // rad/s : joystick droit poussé à fond (haut / bas)
const SWIPE = 0.0055; // rad par pixel glissé

/**
 * Rotation du regard demandée au toucher depuis la dernière image : joystick droit (vitesse de rotation,
 * réponse douce au centre) et glissé du doigt (consommé). Renvoie [Δ lacet, Δ tangage] en radians.
 */
export function consumeTouchLook(dt) {
  const [lx, ly] = touchInput.look;
  const [sx, sy] = touchInput.swipe;
  if (sx || sy) touchInput.swipe = [0, 0];
  return [-Math.sign(lx) * lx * lx * STICK_TURN * dt - sx * SWIPE, -Math.sign(ly) * ly * ly * STICK_TILT * dt - sy * SWIPE];
}

const matches = (query) => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches);

/** Capture de la souris (Pointer Lock) disponible dans ce navigateur. */
export const POINTER_LOCK_SUPPORTED = typeof Element !== 'undefined' && 'requestPointerLock' in Element.prototype;

/**
 * Appareil tactile : téléphone, tablette, Samsung DeX, écran tactile d'ordinateur… `(pointer: coarse)` seul ne
 * suffit pas : il ne décrit que le pointeur *principal*, signalé « fin » dès qu'une souris, un pavé tactile
 * (DeX) ou un stylet est présent. On retient donc tout écran tactile, et Android / iOS même en mode bureau.
 */
export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator || {};
  return (
    matches('(pointer: coarse)') ||
    matches('(any-pointer: coarse)') ||
    (nav.maxTouchPoints || 0) > 0 ||
    'ontouchstart' in window ||
    nav.userAgentData?.mobile === true ||
    /android/i.test(nav.userAgentData?.platform || '') ||
    /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser|Silk/i.test(nav.userAgent || '')
  );
}

/** Souris (ou pavé tactile) utilisable pour la visite capturée : le choix « souris et clavier » est proposé. */
export function canUseMouse() {
  return POINTER_LOCK_SUPPORTED && matches('(any-pointer: fine)');
}

const PREF_KEY = 'digiriskgame.touchControls';

/**
 * Commandes à l'ouverture d'une visite : joysticks d'office sans capture de la souris possible, sinon
 * `?touch` / `?touch=0` dans l'adresse, sinon le dernier choix du joueur, sinon selon l'appareil.
 */
export function prefersTouchControls() {
  if (typeof window === 'undefined') return false;
  if (!canUseMouse()) return true;
  const param = new URLSearchParams(window.location.search).get('touch');
  if (param !== null) return param !== '0' && param !== 'false';
  try {
    const saved = window.localStorage.getItem(PREF_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch {
    // Stockage indisponible (navigation privée) : choix selon l'appareil
  }
  return isTouchDevice();
}

export function saveTouchPreference(on) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours
  }
}
