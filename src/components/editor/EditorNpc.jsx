import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Person, armAngles } from '../3d/models/people';
import MergeStatic from '../3d/models/MergeStatic';
import { Label } from './EditorStructures';
import { visit, bodies } from '../../services/visitState';

/**
 * Personnage de l'éditeur : marchant le long de son trajet (boucle ou aller-retour), ou à son poste, quand
 * l'animation est active. Sans trajet, il travaille selon sa pose, par petits mouvements lents : frappe au
 * clavier, gestes au poste, et assis ou debout le regard qui va d'un interlocuteur à l'autre, la respiration,
 * l'appui d'une jambe sur l'autre ; et de temps en temps une action (téléphone, café, discussion avec un
 * collègue, geste en parlant, coup d'œil à la montre) ; chacun à son rythme. En marchant, il regarde autour de lui.
 * Le trajet part de sa position.
 */

const WALK_SPEED = 1.35; // unités / s (≈ 2 m/s) pour une allure de 1
const TURN_RATE = 10;
const END_PAUSE = 3; // s d'arrêt aux extrémités d'un aller-retour (le temps d'échanger quelques mots)
const ARM_KEYS = ['leftArm', 'rightArm', 'leftArmFore', 'rightArmFore'];
const PICK_GEOMETRY = new THREE.BoxGeometry(0.5, 1.25, 0.5);
const BODY_RADIUS = 0.22; // emprise d'un personnage pour les collisions du visiteur

/** Le visiteur barre-t-il le passage (devant, à moins de 1,1 et à moins de 0,55 de côté) ? */
function blockedBy(x, z, heading, level) {
  if (!visit.active || visit.level !== level) return false;
  const dx = visit.x - x;
  const dz = visit.z - z;
  const ahead = dx * Math.sin(heading) + dz * Math.cos(heading);
  const side = Math.abs(dx * Math.cos(heading) - dz * Math.sin(heading));
  return ahead > -0.1 && ahead < 1.1 && side < 0.55;
}

/** Trajet parcouru : sommets et longueurs cumulées (aller-retour : aller puis retour). */
function buildPath(npc) {
  if (!npc.route?.length) return null;
  const pts = [npc.position, ...npc.route];
  if (npc.routeMode === 'loop') pts.push(npc.position);
  else pts.push(...pts.slice(0, -1).reverse());
  const cumulative = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumulative.push(cumulative[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = cumulative[cumulative.length - 1];
  return total > 0.05 ? { pts, cumulative, total, half: npc.routeMode === 'loop' ? null : total / 2 } : null;
}

function sample(path, d) {
  const { pts, cumulative } = path;
  let i = 1;
  while (i < pts.length - 1 && cumulative[i] < d) i += 1;
  const span = cumulative[i] - cumulative[i - 1] || 1;
  const f = Math.min(1, Math.max(0, (d - cumulative[i - 1]) / span));
  const [ax, az] = pts[i - 1];
  const [bx, bz] = pts[i];
  return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, heading: Math.atan2(bx - ax, bz - az) };
}

/** Écart angulaire ramené dans [-π, π]. */
const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Regard qui se pose de temps en temps ailleurs (sinus au cube : longs temps calmes, coups d'œil francs). */
const glance = (t, speed, amount) => amount * Math.sin(t * speed) ** 3;
/** Geste périodique de 0 à 1 (au repos la moitié du temps). */
const gesture = (t, speed, offset = 0) => Math.max(0, Math.sin(t * speed + offset)) ** 2;

/**
 * Clignement des yeux : paupières visibles 0,12 s toutes les 3 à 5 s, à un rythme propre à chacun
 * (`seed` dans [0, 1[).
 */
function blinkEyes(eyes, t, seed) {
  if (!eyes) return;
  const period = 3.2 + seed * 2;
  eyes.visible = (t + seed * 7) % period < 0.12;
}

const smooth01 = (x) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * Actions ponctuelles d'un personnage à son poste, selon sa pose : consulter son téléphone, boire un café, se
 * tourner vers un collègue, écrire, parler en accompagnant ses mots d'un geste mesuré, regarder sa montre,
 * se redresser. Une action toutes les 12 à 20 s, de 4,5 à 7 s, entrée et sortie en douceur.
 */
const ACTIONS = {
  type: ['phone', 'turn', 'coffee', 'write', 'turn'],
  sit: ['talk', 'phone', 'coffee', 'talk', 'nod'],
  meet: ['talk', 'coffee', 'write', 'turn', 'nod'],
  stand: ['talk', 'watch', 'phone', 'talk', 'nod'],
  work: ['straighten', 'look'],
  carry: [],
};

function actionAt(pose, t, seed) {
  const list = ACTIONS[pose] || ACTIONS.stand;
  if (!list.length) return null;
  const period = 12 + seed * 8;
  const u = t + seed * 37;
  const k = Math.floor(u / period);
  const local = u - k * period;
  const pick = Math.abs(k * 7 + Math.floor(seed * 97)) % 97;
  const duration = 4.5 + (pick % 3) * 1.3;
  if (local > duration) return null;
  return { name: list[pick % list.length], w: smooth01(Math.min(local, duration - local) / 0.9), local, side: pick % 2 ? 1 : -1 };
}

/**
 * Gestes de travail d'un personnage immobile, selon sa pose (angles absolus : rien ne dérive), et ses actions
 * ponctuelles. `t` : temps propre du personnage (décalé pour que chacun ait son rythme).
 */
function animateWork(pose, limbs, body, t, seed = 0) {
  const { leftArm, rightArm, leftArmFore, rightArmFore, head, eyes, phone, cup } = limbs;
  blinkEyes(eyes, t, seed);
  const [shoulder, elbow] = armAngles(pose);
  // Angles absolus des épaules (s) et coudes (e), écart des bras vers l'intérieur (z), tête, buste
  const a = { ls: shoulder, rs: shoulder, le: elbow, re: elbow, lz: 0, rz: 0 };
  let hx = 0;
  let hy = 0;
  let hz = 0;
  let sway = 0;
  let bob = 0;
  let lean = 0;
  // Mouvements de fond discrets et lents (quelques degrés) : on doit sentir la vie, pas voir des pantins
  switch (pose) {
    case 'type': {
      // Au clavier : mains qui tapotent à peine, par périodes ; regard sur l'écran, parfois vers un document
      const typing = gesture(t, 0.45);
      a.le += typing * 0.025 * Math.sin(t * 9);
      a.re += typing * 0.025 * Math.sin(t * 9 + 2.1);
      hx = 0.08 + 0.02 * Math.sin(t * 0.6);
      hy = glance(t, 0.21, 0.28);
      bob = 0.003 * Math.sin(t * 1.5);
      break;
    }
    case 'work': {
      // Au poste : la main droite manipule doucement, la gauche maintient ; tête penchée sur l'ouvrage
      a.ls += 0.03 * Math.sin(t * 0.9 + 1);
      a.rs += 0.08 * Math.sin(t * 1.4);
      a.le += 0.04 * Math.sin(t * 0.9 + 2);
      a.re += 0.12 * Math.sin(t * 1.4 + 0.7);
      hx = 0.25 + 0.03 * Math.sin(t * 0.7);
      hy = glance(t, 0.19, 0.22);
      sway = 0.012 * Math.sin(t * 0.7);
      bob = 0.003 * Math.sin(t * 1.5);
      break;
    }
    case 'carry':
      hx = 0.05;
      hy = glance(t, 0.25, 0.3);
      bob = 0.004 * Math.sin(t * 1.6);
      break;
    default: {
      // Assis ou debout (accueil, réunion, discussion) : bras au repos, coudes à peine fléchis ; le regard va
      // d'un interlocuteur à l'autre, léger hochement, respiration, et debout l'appui change de jambe
      if (pose !== 'sit') {
        a.le = -0.22;
        a.re = -0.22;
        sway = 0.012 * Math.sin(t * 0.4);
      }
      hx = 0.03 * Math.sin(t * 0.5) + 0.03 * gesture(t, 1.1) * gesture(t, 0.23);
      hy = glance(t, 0.23, 0.4);
      bob = 0.003 * Math.sin(t * 1.5);
    }
  }

  const act = actionAt(pose, t, seed);
  let phoneOn = false;
  let cupOn = false;
  if (act) {
    const { name, w, local, side } = act;
    const mix = (key, value) => {
      a[key] += (value - a[key]) * w;
    };
    const look = (x, y, z = 0) => {
      hx += (x - hx) * w;
      hy += (y - hy) * w;
      hz += (z - hz) * w;
    };
    switch (name) {
      case 'phone':
        // Téléphone tenu devant soi, tête penchée dessus, le pouce fait défiler
        // À un bureau ou une table : téléphone tenu au-dessus du plateau
        mix('rs', pose === 'type' || pose === 'meet' ? -0.65 : -0.32);
        mix('re', (pose === 'type' || pose === 'meet' ? -1.2 : -1.42) + 0.03 * Math.sin(local * 5));
        mix('rz', -0.14);
        look(0.4, -0.08);
        phoneOn = w > 0.35;
        break;
      case 'coffee': {
        // Tasse tenue devant soi, portée aux lèvres au milieu de l'action
        const sip = smooth01((local - 1.5) / 0.6) * smooth01((3.3 - local) / 0.6);
        // À un bureau ou une table, tasse tenue au-dessus du plateau (jamais dedans)
        const desk = pose === 'type' || pose === 'meet';
        mix('rs', (desk ? -0.5 : -0.3) + 0.18 * sip);
        mix('re', (desk ? -1.5 : -1.35) - (desk ? 1.2 : 1.35) * sip);
        mix('rz', -0.1 - 0.14 * sip);
        look(0.06 - 0.18 * sip, 0);
        cupOn = w > 0.35;
        break;
      }
      case 'turn':
        // Se tourne vers un collègue pour lui parler, se cale dans son fauteuil
        look(0.02 + 0.03 * Math.sin(local * 1.8), side * 0.75, 0.03 * Math.sin(local * 1.1));
        lean = -0.03 * w;
        break;
      case 'talk': {
        // Parle en accompagnant ses mots d'un geste mesuré de l'avant-bras
        const k = side > 0 ? 'r' : 'l';
        mix(`${k}s`, pose === 'meet' ? -0.45 : pose === 'sit' ? -0.4 : -0.18);
        mix(`${k}e`, (pose === 'meet' ? -1.62 : -1.15) + 0.12 * Math.sin(local * 2.2));
        look(hx + 0.04 * Math.sin(local * 1.7), hy, 0.04 * Math.sin(local * 0.9));
        break;
      }
      case 'watch':
        // Regarde sa montre : poignet gauche ramené devant soi
        mix('ls', -0.35);
        mix('le', -1.75);
        mix('lz', 0.18);
        look(0.42, 0.12);
        break;
      case 'nod':
        // Acquiesce
        look(0.03 + 0.11 * Math.sin(local * 3.2) ** 2, hy);
        break;
      case 'write':
        // Prend des notes : petits mouvements de la main droite, regard sur le papier
        a.re += 0.06 * Math.sin(local * 6) * w;
        a.rs += 0.04 * Math.cos(local * 6) * w;
        look(0.32, -0.14);
        break;
      case 'straighten':
        // Se redresse, se cambre un peu, regarde autour de lui
        mix('ls', 0);
        mix('rs', 0);
        mix('le', -0.2);
        mix('re', -0.2);
        look(-0.04, side * 0.4);
        lean = -0.04 * w;
        break;
      case 'look':
        look(0.05, side * 0.6);
        break;
      default:
    }
  }

  if (leftArm) {
    leftArm.rotation.x = a.ls;
    leftArm.rotation.z = -0.05 + a.lz;
  }
  if (rightArm) {
    rightArm.rotation.x = a.rs;
    rightArm.rotation.z = 0.05 + a.rz;
  }
  if (leftArmFore) leftArmFore.rotation.x = a.le;
  if (rightArmFore) rightArmFore.rotation.x = a.re;
  if (head) head.rotation.set(hx, hy, hz);
  if (body) {
    body.rotation.z = sway;
    body.rotation.x = lean;
    body.position.y = bob;
  }
  // Accessoires : téléphone à plat incliné vers le visage, tasse toujours debout
  if (phone) {
    phone.visible = phoneOn;
    phone.rotation.x = -(a.rs + a.re) - 0.7;
  }
  if (cup) {
    cup.visible = cupOn;
    cup.rotation.x = -(a.rs + a.re);
  }
}

/** Remet les bras, le buste et les accessoires en position de marche. */
function resetForWalk(limbs, body) {
  if (limbs.leftArm) limbs.leftArm.rotation.z = -0.05;
  if (limbs.rightArm) limbs.rightArm.rotation.z = 0.05;
  if (limbs.phone) limbs.phone.visible = false;
  if (limbs.cup) limbs.cup.visible = false;
  if (body) body.rotation.x = 0;
}

export default function EditorNpc({ npc, animate, groundAt, bind, highlight, showLabel, showRoute, phase = 0 }) {
  const groupRef = useRef();
  const bodyRef = useRef();
  const limbs = useRef({}).current;
  const path = useMemo(() => buildPath(npc), [npc]);
  const walking = Boolean(animate && path);
  const animated = Boolean(animate);
  const groundRef = useRef(groundAt);
  groundRef.current = groundAt;
  const walkClock = useRef(null);
  const level = npc.level || 0;
  // Retiré des corps mobiles quand il disparaît de la scène
  useEffect(() => () => bodies.delete(npc.id), [npc.id]);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const body = bodyRef.current;
    if (!walking) {
      const [x, z] = npc.position;
      group.position.set(x, groundRef.current(x, z), z);
      group.rotation.y = (npc.rotation * Math.PI) / 180;
      bodies.set(npc.id, { kind: 'npc', x, z, r: BODY_RADIUS, level });
      // À son poste : gestes de travail (sinon, pose figée)
      if (animated) animateWork(npc.pose, limbs, body, clock.getElapsedTime() + phase * 23, phase);
      else if (body) {
        body.position.y = 0;
        body.rotation.z = 0;
        body.rotation.x = 0;
      }
      return;
    }
    // Distance parcourue, avec une pause à chaque extrémité d'un aller-retour
    const speed = WALK_SPEED * npc.speed;
    const pause = path.half ? END_PAUSE : 0;
    const cycle = path.total / speed + 2 * pause;
    // Temps de marche propre : il n'avance pas tant que le visiteur barre le passage
    if (walkClock.current === null) walkClock.current = clock.getElapsedTime();
    let time = (walkClock.current + phase * cycle) % cycle;
    let moving = true;
    if (path.half) {
      const leg = path.half / speed;
      if (time < pause) {
        time = 0;
        moving = false;
      } else if (time < pause + leg) time -= pause;
      else if (time < 2 * pause + leg) {
        time = leg;
        moving = false;
      } else time -= 2 * pause;
    }
    const at = sample(path, Math.min(path.total, time * speed));
    group.position.set(at.x, groundRef.current(at.x, at.z), at.z);
    bodies.set(npc.id, { kind: 'npc', x: at.x, z: at.z, r: BODY_RADIUS, level });
    const blocked = moving && blockedBy(at.x, at.z, at.heading, level);
    if (!blocked) walkClock.current += Math.min(delta, 0.1);
    if (blocked) moving = false;
    group.rotation.y += angleDelta(group.rotation.y, at.heading) * Math.min(1, delta * TURN_RATE);

    const { leftArm, rightArm, leftLeg, rightLeg, leftArmFore, rightArmFore, leftShin, rightShin } = limbs;
    const ease = (limb, target, k) => {
      if (limb) limb.rotation.x = THREE.MathUtils.lerp(limb.rotation.x, target, k);
    };
    if (!moving) {
      // Arrêt au bout du trajet (guichet, collègue) : bras qui retombent en douceur, regard vers l'interlocuteur
      const before = ARM_KEYS.map((key) => limbs[key]?.rotation.x);
      animateWork(npc.pose === 'carry' ? 'carry' : 'stand', limbs, body, clock.getElapsedTime() + phase * 23, phase);
      ARM_KEYS.forEach((key, i) => {
        const limb = limbs[key];
        if (limb && before[i] !== undefined) limb.rotation.x = THREE.MathUtils.lerp(before[i], limb.rotation.x, 0.12);
      });
      ease(leftLeg, 0, 0.15);
      ease(rightLeg, 0, 0.15);
      ease(leftShin, 0, 0.15);
      ease(rightShin, 0, 0.15);
      // Arrêté par le visiteur : il le regarde en attendant qu'il passe
      if (blocked && limbs.head) {
        const toward = Math.atan2(visit.x - at.x, visit.z - at.z) - group.rotation.y;
        limbs.head.rotation.y = Math.max(-0.8, Math.min(0.8, Math.atan2(Math.sin(toward), Math.cos(toward))));
      }
      return;
    }
    blinkEyes(limbs.eyes, clock.getElapsedTime(), phase);
    resetForWalk(limbs, body);
    if (body) {
      body.rotation.z = 0;
      body.position.y = Math.abs(Math.cos(clock.getElapsedTime() * 7.5 * npc.speed)) * 0.035;
    }
    // En marchant, le regard se promène (vitrines, façade, passants) ; reprise sans saut après un arrêt
    if (limbs.head) {
      const gaze = glance(clock.getElapsedTime() + phase * 17, 0.33, 0.45);
      limbs.head.rotation.set(limbs.head.rotation.x * 0.85, limbs.head.rotation.y + (gaze - limbs.head.rotation.y) * 0.08, limbs.head.rotation.z * 0.85);
    }
    const step = clock.getElapsedTime() * 7.5 * npc.speed;
    const stride = Math.sin(step) * 0.6;
    ease(leftLeg, -stride * 0.8, 1);
    ease(rightLeg, stride * 0.8, 1);
    // Genou plié pendant que la jambe passe vers l'avant (jambe d'appui tendue)
    ease(leftShin, 0.05 + Math.max(0, Math.cos(step)) * 0.75, 1);
    ease(rightShin, 0.05 + Math.max(0, -Math.cos(step)) * 0.75, 1);
    // Bras le long du corps qui balancent, sauf en portant une charge
    if (npc.pose !== 'carry') {
      ease(leftArm, stride, 0.35);
      ease(rightArm, -stride, 0.35);
      ease(leftArmFore, -0.1 - Math.max(0, stride) * 0.4, 0.35);
      ease(rightArmFore, -0.1 - Math.max(0, -stride) * 0.4, 0.35);
    }
  });

  const pose = walking ? (npc.pose === 'carry' ? 'carry' : 'stand') : npc.pose;
  const routeY = groundAt(npc.position[0], npc.position[1]) + 0.06;

  return (
    <>
      <group ref={groupRef}>
        <group ref={bodyRef}>
          {/* Animé (marche ou travail) : bras, avant-bras, jambes et tête restent mobiles ; sinon tout est fusionné */}
          <MergeStatic key={animated ? 'anim' : 'still'} deps={[npc.outfit, npc.variant, pose, animated]}>
            <Person outfit={npc.outfit} pose={pose} variant={npc.variant} limbs={animated ? limbs : undefined} />
          </MergeStatic>
        </group>
        <mesh geometry={PICK_GEOMETRY} position={[0, 0.62, 0]} visible={false} {...bind} />
        {highlight && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={10}>
            <ringGeometry args={[0.36, 0.44, 28]} />
            <meshBasicMaterial color={highlight} depthTest={false} transparent />
          </mesh>
        )}
        {showLabel && <Label position={[0, 1.55, 0]} tone="npc">{npc.name}</Label>}
      </group>
      {path && (showRoute || highlight) && (
        <Line
          points={path.pts.slice(0, npc.routeMode === 'loop' ? undefined : npc.route.length + 1).map(([x, z]) => [x, routeY, z])}
          color={highlight || '#f59e0b'}
          lineWidth={2}
          dashed
          dashSize={0.4}
          gapSize={0.25}
          transparent
          opacity={highlight ? 0.95 : 0.6}
          depthTest={false}
          renderOrder={9}
        />
      )}
    </>
  );
}
