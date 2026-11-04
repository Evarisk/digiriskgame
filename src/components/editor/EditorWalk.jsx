import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { buildWorld, floorAt, obstaclesAt, resolve, walkStep } from '../../services/editorWalkPhysics';

/**
 * Visite en première personne du site conçu dans l'éditeur : souris capturée pour regarder,
 * ZQSD / WASD / flèches pour marcher, Maj pour courir. Sur écran tactile (téléphone, tablette) : joysticks
 * à l'écran (voir TouchControls) — gauche pour se déplacer, droit ou glissé du doigt pour regarder.
 * Collisions et hauteur du sol (étages, escaliers) : voir services/editorWalkPhysics.js.
 */

export const walkControl = { canvas: null, onLockChange: null };

/**
 * Commandes tactiles en cours, écrites par TouchControls : `move` et `look` dans [−1, 1] (x vers la droite,
 * y vers le bas de l'écran), `swipe` = glissé du doigt accumulé en pixels depuis la dernière image.
 */
export const touchInput = { move: [0, 0], look: [0, 0], swipe: [0, 0] };

/** Visite tactile : écran tactile comme pointeur principal, ou `?touch` dans l'adresse (essai à la souris). */
export const TOUCH_WALK =
  typeof window !== 'undefined' &&
  (Boolean(window.matchMedia?.('(pointer: coarse)').matches) || new URLSearchParams(window.location.search).has('touch'));

const EYE = 1.1; // ≈ 1,65 m
const WALK = 2.6;
const RUN = 4.8;
const LOOK = 0.0022;
const STICK_TURN = 2.4; // rad/s : joystick droit poussé à fond (gauche / droite)
const STICK_TILT = 1.4; // rad/s : joystick droit poussé à fond (haut / bas)
const SWIPE = 0.0055; // rad par pixel glissé

export default function EditorWalk({ scene }) {
  const { camera, gl } = useThree();
  const world = useMemo(() => buildWorld(scene), [scene]);
  const worldRef = useRef(world);
  worldRef.current = world;
  const state = useRef({ keys: new Set(), yaw: 0, pitch: -0.05, pos: null, feet: 0 }).current;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  useEffect(() => {
    walkControl.canvas = gl.domElement;
    const saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), order: camera.rotation.order };

    // Départ au rez-de-chaussée : point de départ de la scène s'il est défini (rotation en degrés, 0 = regard
    // vers +Z), sinon point du sol visé au centre de l'écran (à défaut, sous la caméra)
    const ground = obstaclesAt(world, 0);
    const spawn = sceneRef.current.spawn;
    if (spawn?.position) {
      state.pos = resolve([...spawn.position], ground);
      state.yaw = (((spawn.rotation || 0) - 180) * Math.PI) / 180;
    } else {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      const t = dir.y < -0.05 ? -camera.position.y / dir.y : 0;
      state.pos = resolve([camera.position.x + dir.x * t, camera.position.z + dir.z * t], ground);
      state.yaw = Math.atan2(-dir.x, -dir.z);
    }
    state.feet = floorAt(sceneRef.current, world, state.pos, 0);
    state.pitch = -0.05;
    camera.rotation.order = 'YXZ';

    const locked = () => document.pointerLockElement === gl.domElement;
    const onLockChange = () => walkControl.onLockChange?.(locked());
    const onMouseMove = (e) => {
      if (!locked()) return;
      state.yaw -= e.movementX * LOOK;
      state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch - e.movementY * LOOK));
    };
    const onKeyDown = (e) => {
      if (!locked()) return;
      state.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const onKeyUp = (e) => state.keys.delete(e.code);
    // Écran tactile : pas de capture du pointeur, les joysticks pilotent la visite
    const onClick = () => {
      if (!TOUCH_WALK && !locked()) gl.domElement.requestPointerLock?.();
    };
    const clear = () => state.keys.clear();
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    gl.domElement.addEventListener('click', onClick);
    if (!TOUCH_WALK) gl.domElement.requestPointerLock?.();
    touchInput.move = [0, 0];
    touchInput.look = [0, 0];
    touchInput.swipe = [0, 0];

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      gl.domElement.removeEventListener('click', onClick);
      if (locked()) document.exitPointerLock?.();
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
      camera.rotation.order = saved.order;
      walkControl.canvas = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (!state.pos) return;
    const dt = Math.min(delta, 0.05);
    const k = state.keys;
    // Regard au toucher : joystick droit (vitesse de rotation, réponse douce au centre) et glissé du doigt
    const [lx, ly] = touchInput.look;
    if (lx || ly) {
      state.yaw -= Math.sign(lx) * lx * lx * STICK_TURN * dt;
      state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch - Math.sign(ly) * ly * ly * STICK_TILT * dt));
    }
    const [sx, sy] = touchInput.swipe;
    if (sx || sy) {
      state.yaw -= sx * SWIPE;
      state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch - sy * SWIPE));
      touchInput.swipe = [0, 0];
    }
    // Clavier et joystick gauche (pousser vers le haut de l'écran : avancer ; vitesse selon la poussée)
    const [mx, my] = touchInput.move;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - my;
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + mx;
    const push = Math.hypot(forward, strafe);
    if (push > 0.08) {
      const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN : WALK) * dt * Math.min(1, push);
      const len = push;
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const dx = ((-sin * forward + cos * strafe) / len) * speed;
      const dz = ((-cos * forward - sin * strafe) / len) * speed;
      state.feet = walkStep(sceneRef.current, worldRef.current, state.pos, state.feet, dx, dz);
    }
    // Montée des marches suivie en douceur ; une vraie chute (plus de 2 unités) est immédiate
    const targetY = state.feet + EYE;
    camera.position.set(state.pos[0], THREE.MathUtils.lerp(camera.position.y, targetY, Math.min(1, dt * 12)), state.pos[1]);
    if (Math.abs(camera.position.y - targetY) > 2) camera.position.y = targetY;
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  });

  return null;
}
