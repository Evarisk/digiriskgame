import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Person, armAngles } from '../3d/models/people';
import MergeStatic from '../3d/models/MergeStatic';
import { Label } from './EditorStructures';

/**
 * Personnage de l'éditeur : marchant le long de son trajet (boucle ou aller-retour), ou à son poste, quand
 * l'animation est active. Sans trajet, il travaille selon sa pose, par petits mouvements lents : frappe au
 * clavier, gestes au poste, et assis ou debout le regard qui va d'un interlocuteur à l'autre, la respiration,
 * l'appui d'une jambe sur l'autre (bras au repos) ; chacun à son rythme.
 * Le trajet part de sa position.
 */

const WALK_SPEED = 1.35; // unités / s (≈ 2 m/s) pour une allure de 1
const TURN_RATE = 10;
const END_PAUSE = 3; // s d'arrêt aux extrémités d'un aller-retour (le temps d'échanger quelques mots)
const ARM_KEYS = ['leftArm', 'rightArm', 'leftArmFore', 'rightArmFore'];
const PICK_GEOMETRY = new THREE.BoxGeometry(0.5, 1.25, 0.5);

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
 * Gestes de travail d'un personnage immobile, selon sa pose (angles absolus : rien ne dérive).
 * `t` : temps propre du personnage (décalé pour que chacun ait son rythme).
 */
function animateWork(pose, limbs, body, t) {
  const { leftArm, rightArm, leftArmFore, rightArmFore, head } = limbs;
  const [shoulder, elbow] = armAngles(pose);
  const arms = (l, r, lf, rf) => {
    if (leftArm) leftArm.rotation.x = shoulder + l;
    if (rightArm) rightArm.rotation.x = shoulder + r;
    if (leftArmFore) leftArmFore.rotation.x = elbow + lf;
    if (rightArmFore) rightArmFore.rotation.x = elbow + rf;
  };
  const look = (x, y) => {
    if (head) head.rotation.set(x, y, 0);
  };
  // Mouvements discrets et lents (quelques degrés) : on doit sentir la vie, pas voir des pantins
  let sway = 0;
  let bob = 0;
  switch (pose) {
    case 'type': {
      // Au clavier : mains qui tapotent à peine, par périodes ; regard sur l'écran, parfois vers un document
      const typing = gesture(t, 0.45);
      arms(0, 0, typing * 0.025 * Math.sin(t * 9), typing * 0.025 * Math.sin(t * 9 + 2.1));
      look(0.08 + 0.02 * Math.sin(t * 0.6), glance(t, 0.21, 0.28));
      bob = 0.003 * Math.sin(t * 1.5);
      break;
    }
    case 'work': {
      // Au poste : la main droite manipule doucement, la gauche maintient ; tête penchée sur l'ouvrage
      const reach = Math.sin(t * 1.4);
      arms(0.03 * Math.sin(t * 0.9 + 1), 0.08 * reach, 0.04 * Math.sin(t * 0.9 + 2), 0.12 * Math.sin(t * 1.4 + 0.7));
      look(0.25 + 0.03 * Math.sin(t * 0.7), glance(t, 0.19, 0.22));
      sway = 0.012 * Math.sin(t * 0.7);
      bob = 0.003 * Math.sin(t * 1.5);
      break;
    }
    case 'carry':
      // Charge portée : respiration, regard autour
      look(0.05, glance(t, 0.25, 0.3));
      bob = 0.004 * Math.sin(t * 1.6);
      break;
    default: {
      // Assis ou debout (accueil, réunion, discussion) : bras au repos ; le regard va d'un interlocuteur à
      // l'autre, léger hochement, respiration, et debout l'appui passe d'une jambe sur l'autre
      arms(0, 0, 0, 0);
      look(0.03 * Math.sin(t * 0.5) + 0.03 * gesture(t, 1.1) * gesture(t, 0.23), glance(t, 0.23, 0.4));
      if (pose !== 'sit') sway = 0.012 * Math.sin(t * 0.4);
      bob = 0.003 * Math.sin(t * 1.5);
    }
  }
  if (body) {
    body.rotation.z = sway;
    body.position.y = bob;
  }
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

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const body = bodyRef.current;
    if (!walking) {
      const [x, z] = npc.position;
      group.position.set(x, groundRef.current(x, z), z);
      group.rotation.y = (npc.rotation * Math.PI) / 180;
      // À son poste : gestes de travail (sinon, pose figée)
      if (animated) animateWork(npc.pose, limbs, body, clock.getElapsedTime() + phase * 23);
      else if (body) {
        body.position.y = 0;
        body.rotation.z = 0;
      }
      return;
    }
    // Distance parcourue, avec une pause à chaque extrémité d'un aller-retour
    const speed = WALK_SPEED * npc.speed;
    const pause = path.half ? END_PAUSE : 0;
    const cycle = path.total / speed + 2 * pause;
    let time = (clock.getElapsedTime() + phase * cycle) % cycle;
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
    group.rotation.y += angleDelta(group.rotation.y, at.heading) * Math.min(1, delta * TURN_RATE);

    const { leftArm, rightArm, leftLeg, rightLeg, leftArmFore, rightArmFore } = limbs;
    const ease = (limb, target, k) => {
      if (limb) limb.rotation.x = THREE.MathUtils.lerp(limb.rotation.x, target, k);
    };
    if (!moving) {
      // Arrêt au bout du trajet (guichet, collègue) : bras qui retombent en douceur, regard vers l'interlocuteur
      const before = ARM_KEYS.map((key) => limbs[key]?.rotation.x);
      animateWork(npc.pose === 'carry' ? 'carry' : 'stand', limbs, body, clock.getElapsedTime() + phase * 23);
      ARM_KEYS.forEach((key, i) => {
        const limb = limbs[key];
        if (limb && before[i] !== undefined) limb.rotation.x = THREE.MathUtils.lerp(before[i], limb.rotation.x, 0.12);
      });
      ease(leftLeg, 0, 0.15);
      ease(rightLeg, 0, 0.15);
      return;
    }
    if (body) {
      body.rotation.z = 0;
      body.position.y = Math.abs(Math.cos(clock.getElapsedTime() * 7.5 * npc.speed)) * 0.035;
    }
    // Reprise de la marche : regard et bras rejoignent la marche en quelques images (pas de saut)
    if (limbs.head) limbs.head.rotation.set(limbs.head.rotation.x * 0.85, limbs.head.rotation.y * 0.85, 0);
    const stride = Math.sin(clock.getElapsedTime() * 7.5 * npc.speed) * 0.6;
    ease(leftLeg, -stride * 0.8, 1);
    ease(rightLeg, stride * 0.8, 1);
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
