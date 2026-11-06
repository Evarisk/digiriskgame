/**
 * Générateur pseudo-aléatoire à graine (mulberry32) : état sérialisable (un entier), parties reproductibles.
 * Le moteur n'utilise jamais Math.random.
 */
export function nextRandom(state) {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Générateur autonome (génération de carte, robots) à partir d'une graine. */
export function makeRandom(seed) {
  const box = { rng: seed | 0 };
  return () => nextRandom(box);
}
