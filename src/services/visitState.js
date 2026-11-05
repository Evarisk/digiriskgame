/**
 * État partagé de la visite en première personne et des corps mobiles de la scène, mis à jour à chaque image :
 * - `visit` : position du visiteur (EditorWalk) — les voitures s'arrêtent devant lui, les passants l'attendent,
 *   les pigeons s'envolent à son approche ;
 * - `bodies` : personnages et voitures en mouvement (EditorNpc, Traffic) — le visiteur ne les traverse pas, et
 *   les voitures laissent passer les piétons.
 * Coordonnées du monde (x, z) en unités de scène ; `level` : niveau (0 au rez-de-chaussée).
 */

export const visit = { active: false, x: 0, z: 0, feet: 0, level: 0 };

/**
 * Corps mobiles par identifiant : `{ kind: 'npc', x, z, r, level }` (cercle) ou
 * `{ kind: 'car', x, z, ux, uz, hl, hw, level }` (rectangle orienté : axe avant (ux, uz), demi-longueur, demi-largeur).
 */
export const bodies = new Map();

/** Repousse le point p = [x, z] hors des corps mobiles du niveau (rayon du visiteur `radius`). */
export function pushOutOfBodies(p, level, radius) {
  bodies.forEach((b) => {
    if ((b.level || 0) !== level) return;
    if (b.kind === 'npc') {
      const dx = p[0] - b.x;
      const dz = p[1] - b.z;
      const d = Math.hypot(dx, dz);
      const min = radius + b.r;
      if (d < min) {
        const nx = d > 1e-5 ? dx / d : 1;
        const nz = d > 1e-5 ? dz / d : 0;
        p[0] = b.x + nx * min;
        p[1] = b.z + nz * min;
      }
      return;
    }
    // Rectangle orienté : point dans le repère du véhicule, point le plus proche, sortie par le côté le plus proche
    const rx = p[0] - b.x;
    const rz = p[1] - b.z;
    const lx = rx * b.ux + rz * b.uz;
    const lz = -rx * b.uz + rz * b.ux;
    const qx = Math.max(-b.hl, Math.min(b.hl, lx));
    const qz = Math.max(-b.hw, Math.min(b.hw, lz));
    let d = Math.hypot(lx - qx, lz - qz);
    if (d >= radius) return;
    let ox;
    let oz;
    if (d > 1e-5) {
      ox = qx + ((lx - qx) / d) * radius;
      oz = qz + ((lz - qz) / d) * radius;
    } else {
      const exits = [
        [-b.hl - radius, lz],
        [b.hl + radius, lz],
        [lx, -b.hw - radius],
        [lx, b.hw + radius],
      ].sort((u, v) => Math.hypot(u[0] - lx, u[1] - lz) - Math.hypot(v[0] - lx, v[1] - lz));
      [ox, oz] = exits[0];
      d = 0;
    }
    p[0] = b.x + ox * b.ux - oz * b.uz;
    p[1] = b.z + ox * b.uz + oz * b.ux;
  });
  return p;
}
