/**
 * Circulation d'une rue (sans rendu, testable hors navigateur) : deux voies de sens opposés selon X (à droite :
 * +X en +Z), positions curvilignes bouclées sur la longueur de la rue. Chaque véhicule roule à son allure de
 * croisière, ralentit aux passages piétons, garde ses distances avec celui qui le précède, freine et s'arrête
 * devant un obstacle sur sa voie (visiteur, piéton), puis repart en accélérant doucement.
 */

export const LANE = 0.72; // décalage des voies par rapport à l'axe de la rue
export const STOP_GAP = 2.5; // distance centre du véhicule → obstacle à l'arrêt (≈ 3,7 m)
export const FOLLOW_GAP = 4.2; // distance entre deux véhicules qui se suivent, centre à centre
const LANE_HALF = 1.05; // demi-largeur de voie où un obstacle arrête le véhicule
const ACCEL = 2.0;
const BRAKE = 8;

/** Abscisse dans la rue d'un véhicule à l'abscisse curviligne `s` (sens `dir`). */
export const laneX = (s, dir, length) => {
  const pos = ((s % length) + length) % length;
  return dir > 0 ? pos - length / 2 : length / 2 - pos;
};

/**
 * Avance la circulation de `dt` secondes. `cars` : [{ dir, cruise }] ; `state` : [{ s, v }] (modifié) ;
 * `obstacles` : [{ x, z }] dans le repère de la rue ; `crossings` : abscisses des passages piétons.
 * Renvoie les abscisses des véhicules.
 */
export function stepTraffic(cars, state, obstacles, dt, length, crossings = []) {
  return cars.map((c, i) => {
    const me = state[i];
    const x = laneX(me.s, c.dir, length);
    const laneZ = c.dir > 0 ? LANE : -LANE;
    // Allure de croisière, réduite à l'approche d'un passage piéton
    let desired = c.cruise;
    crossings.forEach((cx) => {
      const ahead = (cx - x) * c.dir;
      if (ahead > -1.5 && ahead < 7) desired *= 0.45 + 0.55 * Math.min(1, Math.abs(ahead - 2) / 5);
    });
    // Distance libre devant : obstacle devant le pare-chocs (une personne déjà à côté de la carrosserie ne bloque
    // pas : le véhicule la dépasse et dégage le passage — sinon chacun attendrait l'autre), véhicule qui précède
    let free = Infinity;
    const front = c.hl ?? 1.55;
    obstacles.forEach((o) => {
      if (Math.abs(o.z - laneZ) > LANE_HALF) return;
      const ahead = (o.x - x) * c.dir;
      if (ahead > front + 0.1) free = Math.min(free, ahead - STOP_GAP);
    });
    cars.forEach((other, j) => {
      if (j === i || other.dir !== c.dir) return;
      const ahead = (((state[j].s - me.s) % length) + length) % length;
      if (ahead > 0.01) free = Math.min(free, ahead - FOLLOW_GAP);
    });
    // Vitesse visée : nulle au point d'arrêt, croissante avec la distance libre ; freinage énergique si besoin
    const target = Math.max(0, Math.min(desired, free * 1.3));
    me.v = me.v < target ? Math.min(target, me.v + ACCEL * dt) : Math.max(target, me.v - BRAKE * dt);
    // Jamais au-delà du point d'arrêt (pas de dépassement d'un obstacle ni du véhicule de devant)
    const step = Math.min(me.v * dt, Math.max(0, free));
    me.s += step;
    me.d = (me.d || 0) + step;
    return laneX(me.s, c.dir, length);
  });
}
