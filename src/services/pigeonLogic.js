/**
 * Comportement d'un pigeon (sans rendu, testable hors navigateur), dans le repère de son groupe :
 * - au sol : marche par à-coups, picore, regarde autour de lui, sans quitter son coin (rayon `spread`) ;
 *   s'écarte à petits pas pressés d'un passant qui arrive sur lui ;
 * - envol quand le visiteur approche à moins de SCARE_RADIUS : montée presque verticale au-dessus de son coin,
 *   vol au-dessus des toits (CRUISE) loin du visiteur, retour au-dessus d'un point de pose proche de son coin,
 *   descente en spirale qui se resserre ; il ne se pose jamais près du visiteur (il tourne en l'air en attendant).
 * Tout déplacement horizontal notable se fait au-dessus des toits : rien ne traverse les bâtiments.
 * L'état de rendu est laissé dans `b.state` : position (x, y, z), cap, `pitch`, `beat` (angle des ailes),
 * `flying`, `legs`, et pour la tête au sol `peck`, `look`, `bob`.
 */

export const SCARE_RADIUS = 2.1; // ≈ 3 m
export const CRUISE = 14; // altitude de vol (≈ 21 m) : au-dessus de tous les toits et du campanile (sommet 12,6)
const LAND_RADIUS = 2.2; // points de pose possibles autour du coin

/** Pas saccadé en dents de scie : la tête file en avant puis attend que le corps la rattrape. */
export const headBob = (phase) => {
  const p = phase % 1;
  return p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
};

/** Nouvel état d'un pigeon posé en (x, z), cap `heading`. */
export const newPigeon = (x, z, heading, timer, step) => ({ x, y: 0, z, hx: 0, hz: 0, heading, mode: 'walk', timer, step, flight: null, rush: 0 });

/**
 * Avance un pigeon de `dt`. `b` : { state, speed, rand(k) } ; `threat` : visiteur { x, z } ou null ;
 * `walkers` : passants [{ x, z }] ; `t` : temps ; `tick` : compteur d'images ; `index` : rang (rythmes).
 */
export function stepPigeon(b, { threat, walkers = [], dt, t, tick = 0, spread = 1.4, index = 0 }) {
  const s = b.state;
  const near = (x, z, margin = 0) => threat && Math.hypot(threat.x - x, threat.z - z) < SCARE_RADIUS + margin;

  // Envol : le visiteur s'approche d'un oiseau posé
  if (!s.flight && near(s.x, s.z)) {
    const away = Math.atan2(s.x - threat.x, s.z - threat.z) + (b.rand(t) - 0.5) * 0.8;
    s.flight = { phase: 'climb', time: -b.rand(1.7) * 0.35, dir: away, alt: CRUISE + b.rand(2.3) * 1.5, awayTime: 2.5 + b.rand(3.1) * 2.5, wait: 0 };
  }

  if (s.flight) {
    const f = s.flight;
    f.time += dt;
    s.flying = true;
    if (f.time < 0) {
      s.beat = 0.08;
      return;
    }
    let flap = 1;
    s.pitch = -0.1;
    if (f.phase === 'climb') {
      // Montée presque verticale au-dessus de son coin (léger décalage à l'opposé du visiteur)
      // Montée verticale sous les toits (aucun déplacement horizontal près des murs), dérive au-dessus
      const drift = s.y > 9.5 ? 1.6 : 0;
      s.x += Math.sin(f.dir) * drift * dt;
      s.z += Math.cos(f.dir) * drift * dt;
      s.y += Math.max(1.2, (f.alt - s.y) * 0.9) * dt;
      s.heading = f.dir;
      s.pitch = -0.7;
      if (s.y >= f.alt - 0.3) {
        f.phase = 'away';
        f.time = 0;
      }
    } else if (f.phase === 'away') {
      // Au-dessus des toits, loin du visiteur, en planant par moments
      s.x += Math.sin(f.dir) * 4.5 * dt;
      s.z += Math.cos(f.dir) * 4.5 * dt;
      s.y += (f.alt + Math.sin(t * 0.8 + index) * 0.3 - s.y) * Math.min(1, dt * 2);
      s.heading = f.dir;
      flap = Math.sin(t * 1.4 + index * 1.7) > -0.3 ? 1 : 0.15;
      if (f.time > f.awayTime) {
        // Retour : son coin, ou un peu plus loin dans le coin dégagé du groupe
        const a = b.rand(t) * Math.PI * 2;
        const d = b.rand(t + 1) < 0.5 ? b.rand(t + 2) * 0.6 : 0.8 + b.rand(t + 3) * 1.4;
        f.lx = s.hx + Math.sin(a) * d;
        f.lz = s.hz + Math.cos(a) * d;
        f.phase = 'return';
      }
    } else if (f.phase === 'return') {
      // Revient au-dessus du point de pose, toujours à hauteur des toits ; jamais de pose près du visiteur
      const dx = f.lx - s.x;
      const dz = f.lz - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.2) {
        s.x += (dx / d) * 4.5 * dt;
        s.z += (dz / d) * 4.5 * dt;
        s.heading = Math.atan2(dx, dz);
      } else if (near(f.lx, f.lz, 0.6)) {
        f.wait += dt;
        f.orbit = (f.orbit ?? Math.atan2(s.x - f.lx, s.z - f.lz)) + 1.3 * dt;
        s.x = f.lx + Math.sin(f.orbit) * 1.6;
        s.z = f.lz + Math.cos(f.orbit) * 1.6;
        s.heading = f.orbit + Math.PI / 2;
        if (f.wait > 6) {
          // Autre point de pose : celui du pourtour du coin le plus éloigné du visiteur
          let best = null;
          for (let k = 0; k < 12; k += 1) {
            const a = (k / 12) * Math.PI * 2;
            const px = s.hx + Math.sin(a) * LAND_RADIUS;
            const pz = s.hz + Math.cos(a) * LAND_RADIUS;
            const away = Math.hypot(threat.x - px, threat.z - pz);
            if (!best || away > best.away) best = { px, pz, away };
          }
          f.lx = best.px;
          f.lz = best.pz;
          f.wait = 0;
        }
      } else {
        f.phase = 'descend';
        f.spin = Math.atan2(s.x - f.lx, s.z - f.lz);
        f.top = s.y;
      }
      flap = Math.sin(t * 1.2 + index) > -0.2 ? 1 : 0.2;
    } else {
      // Descente en spirale qui se resserre au-dessus du point de pose ; remonte si le visiteur arrive
      if (near(f.lx, f.lz, 0.3)) {
        f.phase = 'return';
        f.wait = 0;
        s.y += 2.5 * dt;
      } else {
        s.y = Math.max(0, s.y - (s.y > 2 ? 2.2 : 1.1) * dt);
      }
      f.spin += 2.2 * dt;
      const radius = 0.6 * Math.min(1, s.y / Math.max(1, f.top));
      s.x = f.lx + Math.sin(f.spin) * radius;
      s.z = f.lz + Math.cos(f.spin) * radius;
      s.heading = f.spin + Math.PI / 2;
      flap = s.y < 1.2 ? 1 : 0.25;
      s.pitch = s.y < 1.2 ? -0.6 : -0.15;
      if (s.y <= 0 && f.phase === 'descend') {
        s.x = f.lx;
        s.z = f.lz;
        s.hx = f.lx;
        s.hz = f.lz;
        s.flight = null;
        s.flying = false;
        s.mode = 'look';
        s.timer = 1.2 + b.rand(t) * 1.5;
      }
    }
    s.legs = !!s.flight && s.flight.phase === 'descend' && s.y < 0.6;
    s.beat = flap * Math.sin(t * (f.phase === 'climb' ? 24 : 17) + index) * 0.85 + (1 - flap) * 0.08;
    return;
  }

  // Au sol
  s.flying = false;
  s.legs = true;
  s.y = 0;
  s.timer -= dt;
  s.rush = Math.max(0, (s.rush || 0) - dt);
  const walker = walkers.find((w) => Math.hypot(w.x - s.x, w.z - s.z) < 0.9);
  if (walker && s.rush <= 0) {
    s.heading = Math.atan2(s.x - walker.x, s.z - walker.z) + (b.rand(t) - 0.5) * 0.6;
    s.mode = 'walk';
    s.timer = 0.8;
    s.rush = 0.8;
  }
  if (s.timer <= 0) {
    // Nouvelle action : marcher (souvent), picorer, regarder autour ; cap vers son coin si trop loin
    const k = b.rand(tick * 0.01 + index);
    s.mode = k < 0.55 ? 'walk' : k < 0.85 ? 'peck' : 'look';
    s.timer = s.mode === 'walk' ? 1.2 + k * 2 : 0.8 + k * 1.6;
    const far = Math.hypot(s.x - s.hx, s.z - s.hz) > spread;
    s.heading = far ? Math.atan2(s.hx - s.x, s.hz - s.z) + (k - 0.5) : s.heading + (k - 0.5) * 2.2;
  }
  if (s.mode === 'walk') {
    s.step += dt * 3.6;
    const v = b.speed * (0.35 + 0.65 * Math.abs(Math.sin(s.step * Math.PI))) * (s.rush > 0 ? 3.2 : 1);
    s.x += Math.sin(s.heading) * v * dt;
    s.z += Math.cos(s.heading) * v * dt;
  }
  s.peck = s.mode === 'peck' ? Math.max(0, Math.sin(s.timer * 9)) ** 2 : 0;
  s.look = s.mode === 'look' ? Math.sin(s.timer * 2.5) * 0.7 : 0;
  s.bob = s.mode === 'walk' ? headBob(s.step) * 0.016 - 0.006 : s.peck * 0.012;
}
