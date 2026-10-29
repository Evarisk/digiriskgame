import React, { createRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import MergeStatic from './models/MergeStatic';
import { SemiTrailer, TruckTractor } from './models/kit';
import { buildRoundedIndustrialCurve } from './roundedPath';
import { traffic } from './traffic';
import { explorerStore } from './explorer/explorerStore';
import { AVENUE_WIDTH, TRUCK } from '../../services/siteLayout';

/**
 * Camions de livraison : la semi-remorque de chaque entrepôt quitte son quai, circule sur la voirie du
 * site (rond-point, portail) jusqu'à la route départementale, s'éloigne dans le brouillard, puis revient
 * et se remet à quai en marche arrière. Les trajets sont calculés par le plan du site
 * (services/siteLayout.js, `site.deliveries`). Le camion ralentit dans les virages, attend que la
 * barrière du poste de garde soit levée et s'arrête devant un piéton (opérateur animé, joueur en
 * visite) ou un autre véhicule sur sa trajectoire.
 */

const STEP = 0.25; // pas d'échantillonnage des trajets (unités)
const TURN_RADIUS = 2.4; // rayon des virages (identique au plan du site)
const HITCH = TRUCK.axle - TRUCK.bogie; // écart entre l'essieu moteur et les essieux de la remorque
const BARRIER = 1.0; // barrière du poste de garde, en retrait de la clôture (voir CampusScenery)
const SITE_SPEED = 3.2; // ≈ 17 km/h dans l'enceinte (1 unité ≈ 1,5 m)
const ROAD_SPEED = 13; // ≈ 70 km/h sur la route départementale
const REVERSE_SPEED = 0.9;
const ACCEL = 1.4;
const BRAKE = 2.2;
const LATERAL = 1.3; // accélération latérale admise en virage
const CLEARANCE = 1.35; // demi-largeur du camion + encombrement d'un piéton
const FIRST_DEPARTURE = 5; // délai avant le premier départ (s), décalé pour chaque entrepôt
const LOAD_TIME = 18; // chargement à quai
const AWAY_TIME = 6; // hors du site, avant le retour
const SIGNAL_LEAD = 9; // le clignotant s'allume ≈ 13 m avant le virage
const SIGNAL_NOTICE = 3; // et quelques secondes avant de quitter le quai
const BLINK_RATE = 1.5; // clignotements par seconde

/**
 * Clignotants le long d'un trajet (côté : -1 gauche, 1 droite) : à chaque virage, depuis SIGNAL_LEAD
 * avant jusqu'à la fin de la courbe ; au rond-point, à l'entrée selon la direction prise (gauche pour
 * tourner à gauche ou faire demi-tour, droite pour la première sortie, aucun pour aller tout droit), puis
 * à droite avant de sortir. `rings` : indices [entrée, sortie] des traversées du rond-point dans le tracé.
 */
function signalsOf(waypoints, rings, path) {
  // Abscisse curviligne de chaque point du tracé : échantillon le plus proche, dans l'ordre du trajet
  const at = [];
  let from = 0;
  waypoints.forEach(([x, z], k) => {
    const reach = k ? at[k - 1] + Math.hypot(x - waypoints[k - 1][0], z - waypoints[k - 1][1]) + 1 : 0;
    let best = from;
    let bestDistance = Infinity;
    for (let i = from; i < path.count && i * path.step <= reach; i += 1) {
      const d = (path.x[i] - x) ** 2 + (path.z[i] - z) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    from = best;
    at.push(best * path.step);
  });
  // Angle du virage au point k (positif vers la droite)
  const turn = (k) => {
    const ux = waypoints[k][0] - waypoints[k - 1][0];
    const uz = waypoints[k][1] - waypoints[k - 1][1];
    const vx = waypoints[k + 1][0] - waypoints[k][0];
    const vz = waypoints[k + 1][1] - waypoints[k][1];
    return Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
  };

  const signals = [];
  for (const [a, b] of rings) {
    let total = 0;
    for (let k = a; k <= b; k += 1) total += turn(k);
    const exit = Math.max(at[b - 1] - 5, at[a]);
    if (total > Math.PI / 4) {
      signals.push({ from: at[a] - SIGNAL_LEAD, to: at[b], side: 1 });
    } else {
      if (total < -Math.PI / 4) signals.push({ from: at[a] - SIGNAL_LEAD, to: exit, side: -1 });
      signals.push({ from: exit, to: at[b], side: 1 });
    }
  }
  for (let k = 1; k < waypoints.length - 1; k += 1) {
    if (rings.some(([a, b]) => k >= a && k <= b)) continue;
    const angle = turn(k);
    if (Math.abs(angle) > 0.35) signals.push({ from: at[k] - SIGNAL_LEAD, to: at[k] + TURN_RADIUS, side: Math.sign(angle) });
  }
  return signals;
}

/** Clignotant à l'abscisse `s` du trajet (0 : aucun). */
function signalAt(path, s) {
  const signal = path.signals.find((g) => s >= g.from && s <= g.to);
  return signal ? signal.side : 0;
}

/**
 * Trajet échantillonné à pas constant (virages arrondis) et vitesse admise en chaque point :
 * route ou enceinte, réduite selon la courbure. `barrier` : abscisse du passage sous la barrière ;
 * `signals` : clignotants (aucun sans `rings`, comme pour la marche arrière à quai).
 */
function samplePath(waypoints, site, rings = null) {
  const curve = buildRoundedIndustrialCurve(waypoints.map(([x, z]) => [x, 0, z]), TURN_RADIUS);
  const length = curve.getLength();
  const count = Math.max(2, Math.ceil(length / STEP) + 1);
  const step = length / (count - 1);
  const x = new Float32Array(count);
  const z = new Float32Array(count);
  curve.getSpacedPoints(count - 1).forEach((p, i) => {
    x[i] = p.x;
    z[i] = p.z;
  });

  const limit = new Float32Array(count);
  const k = Math.max(1, Math.round(1 / step));
  for (let i = 0; i < count; i += 1) {
    const cruise = z[i] > site.fence.maxZ + 1 ? ROAD_SPEED : SITE_SPEED;
    const a = i - k;
    const b = i + k;
    if (a < 0 || b >= count) {
      limit[i] = cruise;
      continue;
    }
    let turn = Math.abs(Math.atan2(z[b] - z[i], x[b] - x[i]) - Math.atan2(z[i] - z[a], x[i] - x[a]));
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    const curvature = turn / (2 * k * step);
    limit[i] = curvature > 1e-3 ? Math.min(cruise, Math.sqrt(LATERAL / curvature)) : cruise;
  }

  let barrier = null;
  const barrierZ = site.fence.maxZ - BARRIER;
  for (let i = 1; i < count && barrier === null; i += 1) {
    if ((z[i - 1] - barrierZ) * (z[i] - barrierZ) <= 0 && Math.abs(x[i] - site.gate.x) < AVENUE_WIDTH) barrier = i * step;
  }
  const path = { x, z, limit, step, count, length, barrier };
  path.signals = rings ? signalsOf(waypoints, rings, path) : [];
  return path;
}

/** Point du trajet à l'abscisse curviligne `s` (bornée aux extrémités). */
function pointAt(path, s, out) {
  const f = Math.min(path.count - 1, Math.max(0, s / path.step));
  const i = Math.min(path.count - 2, Math.floor(f));
  const t = f - i;
  out.x = path.x[i] + (path.x[i + 1] - path.x[i]) * t;
  out.z = path.z[i] + (path.z[i + 1] - path.z[i]) * t;
  return out;
}

const _axle = { x: 0, z: 0 };
const _ahead = { x: 0, z: 0 };
const _behind = { x: 0, z: 0 };
const _bogie = { x: 0, z: 0 };
const _lead = { x: 0, z: 0 };
const _probe = { x: 0, z: 0 };

/**
 * Pose de l'ensemble articulé : le tracteur suit le trajet par son essieu moteur ; la remorque, tirée
 * par le pivot d'attelage, s'aligne sur ses propres essieux, qui suivent le même trajet en retrait.
 * `points` : centres du tracteur et de la remorque (encombrement partagé avec les autres véhicules).
 */
function place(path, s, tractor, trailer, points) {
  pointAt(path, s, _axle);
  pointAt(path, s + 0.4, _ahead);
  pointAt(path, s - 0.4, _behind);
  const hl = Math.hypot(_ahead.x - _behind.x, _ahead.z - _behind.z) || 1;
  const hx = (_ahead.x - _behind.x) / hl;
  const hz = (_ahead.z - _behind.z) / hl;
  tractor.position.set(_axle.x - hx * (TRUCK.axle - TRUCK.tractor), 0, _axle.z - hz * (TRUCK.axle - TRUCK.tractor));
  tractor.rotation.y = Math.atan2(-hz, hx);

  const kx = _axle.x - hx * (TRUCK.axle - TRUCK.kingpin);
  const kz = _axle.z - hz * (TRUCK.axle - TRUCK.kingpin);
  pointAt(path, s - HITCH, _bogie);
  const tl = Math.hypot(kx - _bogie.x, kz - _bogie.z) || 1;
  const tx = (kx - _bogie.x) / tl;
  const tz = (kz - _bogie.z) / tl;
  trailer.position.set(kx - tx * TRUCK.kingpin, 0, kz - tz * TRUCK.kingpin);
  trailer.rotation.y = Math.atan2(-tz, tx);

  points[0].x = _axle.x + hx * 0.6;
  points[0].z = _axle.z + hz * 0.6;
  points[1].x = kx - tx * (TRUCK.kingpin - 3);
  points[1].z = kz - tz * (TRUCK.kingpin - 3);
}

/** Piéton, joueur ou autre véhicule devant le camion (derrière lui en marche arrière), à distance d'arrêt. */
function obstacleAhead(run, path, id) {
  const lead = run.dir > 0 ? run.s + TRUCK.front - TRUCK.axle : run.s - TRUCK.axle;
  const reach = 1.5 + (run.v * run.v) / (4 * BRAKE);
  pointAt(path, lead, _lead);
  const blocks = (x, z, radius) => {
    if (Math.hypot(x - _lead.x, z - _lead.z) > reach + radius + 1) return false;
    for (let d = 0; d <= reach; d += 0.5) {
      pointAt(path, lead + run.dir * d, _probe);
      if ((_probe.x - x) ** 2 + (_probe.z - z) ** 2 < radius * radius) return true;
    }
    return false;
  };
  for (const p of traffic.pedestrians.values()) {
    if (blocks(p.x, p.z, CLEARANCE)) return true;
  }
  const player = explorerStore.get().player;
  if (player && blocks(player.x, player.z, CLEARANCE)) return true;
  for (const [other, points] of traffic.vehicles) {
    if (other !== id && points.some((q) => blocks(q.x, q.z, 1.9))) return true;
  }
  return false;
}

/** Avance le camion sur son trajet ; renvoie vrai une fois arrivé (à l'arrêt) au bout. */
function drive(run, path, dt, time, id) {
  const end = run.dir > 0 ? path.length : HITCH;
  const remaining = Math.abs(end - run.s);
  // Arrêt en bout de trajet et virages à venir, à décélération constante
  let vmax = Math.min(run.dir > 0 ? Infinity : REVERSE_SPEED, Math.sqrt(2 * BRAKE * remaining) + 0.15);
  const horizon = (run.v * run.v) / (2 * BRAKE) + 1;
  for (let d = 0; d <= horizon; d += 0.5) {
    const i = Math.round((run.s + run.dir * d) / path.step);
    if (i < 0 || i >= path.count) break;
    vmax = Math.min(vmax, Math.sqrt(path.limit[i] ** 2 + 2 * BRAKE * d));
  }
  // Barrière du poste de garde : levée demandée à l'approche, attente tant qu'elle n'est pas levée
  if (run.dir > 0 && path.barrier !== null) {
    const front = run.s + TRUCK.front - TRUCK.axle;
    if (front > path.barrier - 18 && run.s - TRUCK.axle < path.barrier + 1.5) traffic.gate.requestUntil = time + 0.3;
    if (front < path.barrier - 0.5 && traffic.gate.open < 0.97) {
      const hold = path.barrier - 1.2 - (TRUCK.front - TRUCK.axle);
      vmax = Math.min(vmax, Math.sqrt(2 * BRAKE * Math.max(0, hold - run.s)));
    }
  }
  if (obstacleAhead(run, path, id)) vmax = 0;

  run.v = run.v < vmax ? Math.min(vmax, run.v + ACCEL * dt) : Math.max(vmax, run.v - 2 * BRAKE * dt);
  run.s += run.dir * run.v * dt;
  if ((run.s - end) * run.dir >= 0) {
    run.s = end;
    run.v = 0;
    return true;
  }
  return false;
}

/** À quai (prêt au départ), après `wait` secondes de chargement. */
const parked = (wait) => ({ phase: 'loading', path: 'outbound', s: HITCH, v: 0, dir: 1, wait });

function advance(run, paths, dt, time, id) {
  const go = (phase, path, s, dir) => Object.assign(run, { phase, path, s, dir, v: 0 });
  switch (run.phase) {
    case 'loading':
      if ((run.wait -= dt) <= 0) go('outbound', 'outbound', HITCH, 1);
      break;
    case 'outbound':
      if (drive(run, paths.outbound, dt, time, id)) Object.assign(run, { phase: 'away', wait: AWAY_TIME });
      break;
    case 'away':
      if ((run.wait -= dt) <= 0) go('inbound', 'inbound', HITCH, 1);
      break;
    case 'inbound':
      // Arrêté au-delà du quai : courte pause avant la marche arrière
      if (drive(run, paths.inbound, dt, time, id)) Object.assign(go('docking', 'dock', paths.dock.length, -1), { wait: 1.5 });
      break;
    case 'docking':
      if (run.wait > 0) run.wait -= dt;
      else if (drive(run, paths.dock, dt, time, id)) Object.assign(run, parked(LOAD_TIME));
      break;
    default:
      break;
  }
}

function DeliveryTruck({ delivery, site, index, enabled, speedMultiplier }) {
  const rootRef = useRef();
  const tractorRef = useRef();
  const trailerRef = useRef();
  const run = useRef(null);
  const points = useRef([{ x: 0, z: 0 }, { x: 0, z: 0 }]).current;
  const tractorLights = useMemo(() => ({ left: createRef(), right: createRef() }), []);
  const trailerLights = useMemo(() => ({ left: createRef(), right: createRef(), reverse: createRef() }), []);
  const paths = useMemo(
    () => ({
      outbound: samplePath(delivery.outbound, site, delivery.rings.outbound),
      inbound: samplePath(delivery.inbound, site, delivery.rings.inbound),
      dock: samplePath(delivery.dock, site),
    }),
    [delivery, site]
  );
  // Nouveau plan du site : le camion repart de son quai
  useLayoutEffect(() => {
    run.current = parked(FIRST_DEPARTURE + index * 25);
    place(paths.outbound, HITCH, tractorRef.current, trailerRef.current, points);
  }, [paths, index, points]);
  useEffect(() => () => traffic.vehicles.delete(delivery.id), [delivery.id]);

  useFrame(({ clock }, delta) => {
    const current = run.current;
    if (!current || !rootRef.current) return;
    if (!enabled) Object.assign(current, parked(FIRST_DEPARTURE));
    else advance(current, paths, Math.min(delta, 0.05) * speedMultiplier, clock.getElapsedTime(), delivery.id);
    const away = current.phase === 'away';
    rootRef.current.visible = !away;
    if (away) {
      traffic.vehicles.delete(delivery.id);
      return;
    }
    place(paths[current.path], current.s, tractorRef.current, trailerRef.current, points);
    traffic.vehicles.set(delivery.id, points);

    // Clignotants en roulant (et juste avant de quitter le quai), feux de recul en marche arrière
    const driving = current.phase === 'outbound' || current.phase === 'inbound';
    const leaving = enabled && current.phase === 'loading' && current.wait < SIGNAL_NOTICE;
    const side = driving || leaving ? signalAt(paths[current.path], current.s) : 0;
    const lit = Math.floor(clock.getElapsedTime() * 2 * BLINK_RATE) % 2 === 0;
    const show = (ref, on) => {
      if (ref.current) ref.current.visible = on;
    };
    show(tractorLights.left, side < 0 && lit);
    show(trailerLights.left, side < 0 && lit);
    show(tractorLights.right, side > 0 && lit);
    show(trailerLights.right, side > 0 && lit);
    show(trailerLights.reverse, current.phase === 'docking' && current.wait <= 0);  });

  return (
    <group ref={rootRef}>
      <group ref={trailerRef}>
        <MergeStatic>
          <SemiTrailer lights={trailerLights} />
        </MergeStatic>
      </group>
      <group ref={tractorRef}>
        <MergeStatic>
          <TruckTractor lights={tractorLights} />
        </MergeStatic>
      </group>
    </group>
  );
}

export default function DeliveryTrucks({ site, enabled = true, speedMultiplier = 1 }) {
  return (
    <group>
      {(site?.deliveries || []).map((delivery, i) => (
        <DeliveryTruck key={delivery.id} delivery={delivery} site={site} index={i} enabled={enabled} speedMultiplier={speedMultiplier} />
      ))}
    </group>
  );
}
