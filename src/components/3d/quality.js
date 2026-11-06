/**
 * Qualité du rendu 3D de l'éditeur de site, pour tourner sur un maximum de machines.
 * - Trois niveaux : haute (résolution jusqu'à 1,5 ×, ombres douces 4096 px à chaque image), moyenne (résolution
 *   1 ×, ombres 2048 px recalculées une image sur deux) et basse (résolution 0,75 ×, sans ombres portées).
 * - Mode automatique (par défaut) : niveau de départ estimé d'après la carte graphique (rendu logiciel → basse ;
 *   carte intégrée, écran tactile ou processeur à 4 cœurs ou moins → moyenne ; sinon haute), puis abaissé d'un
 *   cran si l'image reste lente (voir `useQualityMonitor`). Le choix manuel est mémorisé dans le navigateur.
 */

export const QUALITY_LEVELS = {
  haute: { label: 'Haute', dpr: [1, 1.5], shadows: 'soft', shadowSize: 4096, shadowEvery: 1, antialias: true },
  moyenne: { label: 'Moyenne', dpr: 1, shadows: 'percentage', shadowSize: 2048, shadowEvery: 2, antialias: true },
  basse: { label: 'Basse', dpr: 0.75, shadows: false, shadowSize: 1024, shadowEvery: 1, antialias: false },
};
export const QUALITY_ORDER = ['haute', 'moyenne', 'basse'];
const STORAGE_KEY = 'editor-quality';

/** Carte graphique (chaîne du pilote WebGL), vide si inconnue. */
function gpuName() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'aucune';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return '';
  }
}

/** Niveau de départ du mode automatique. */
export function guessQuality() {
  const gpu = gpuName();
  if (gpu === 'aucune' || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) return 'basse';
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  if (touch || cores <= 4 || /intel|mali|adreno|powervr|apple|videocore|radeon\(tm\) graphics|vega \d+ graphics/i.test(gpu)) return 'moyenne';
  return 'haute';
}

/** Mode mémorisé : 'auto' (par défaut) ou un niveau choisi. */
export function loadQualityMode() {
  try {
    const mode = window.localStorage.getItem(STORAGE_KEY);
    return mode && (mode === 'auto' || QUALITY_LEVELS[mode]) ? mode : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveQualityMode(mode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // stockage indisponible (navigation privée) : le choix vaut pour la session
  }
}

/** Niveau inférieur (null au plus bas). */
export const lowerQuality = (level) => QUALITY_ORDER[QUALITY_ORDER.indexOf(level) + 1] || null;

// Surveillance de la cadence : image médiane au-delà de SLOW_MS sur deux fenêtres de WINDOW_MS consécutives
export const SLOW_MS = 38;
export const WINDOW_MS = 3000;
export const SETTLE_MS = 8000; // chargement (textures peintes, fusions) et changement de niveau
