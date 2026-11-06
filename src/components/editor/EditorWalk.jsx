import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { buildWorld, floorAt, obstaclesAt, resolve, walkStep } from '../../services/editorWalkPhysics';
import { touchInput, resetTouchInput, consumeTouchLook } from '../../services/touchControls';

/**
 * Visite en première personne du site conçu dans l'éditeur : souris capturée pour regarder,
 * ZQSD / WASD / flèches pour marcher, Maj pour courir. Commandes tactiles (téléphone, tablette, Samsung DeX,
 * ou au choix du joueur) : joysticks à l'écran (components/ui/TouchControls.jsx) — gauche pour se déplacer,
 * droit ou glissé du doigt pour regarder — sans capture de la souris, le clavier restant utilisable.
 * Collisions et hauteur du sol (étages, escaliers) : voir services/editorWalkPhysics.js.
 */

/**
 * Liaison avec l'éditeur : `touch` = commandes tactiles en cours (tenu à jour par SiteEditor avant le
 * montage), `onTouch(true)` = passage aux joysticks demandé par un toucher de l'écran en visite à la souris.
 */
export const walkControl = { canvas: null, onLockChange: null, touch: false, onTouch: null };

const EYE = 1.1; // ≈ 1,65 m
const WALK = 2.6;
const RUN = 4.8;
const LOOK = 0.0022;

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
    const requestLock = () => gl.domElement.requestPointerLock?.()?.catch?.(() => {});
    const onLockChange = () => walkControl.onLockChange?.(locked());
    const onMouseMove = (e) => {
      if (!locked()) return;
      state.yaw -= e.movementX * LOOK;
      state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch - e.movementY * LOOK));
    };
    // Clavier : souris capturée, ou visite aux joysticks (clavier branché : téléphone sur DeX, tablette)
    const onKeyDown = (e) => {
      if (!locked() && !walkControl.touch) return;
      state.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    };
    const onKeyUp = (e) => state.keys.delete(e.code);
    // Joysticks : pas de capture du pointeur. Visite à la souris : un toucher de l'écran passe aux joysticks
    // (avant le clic qui suit, qui sinon demanderait la capture)
    const onPointerDown = (e) => {
      if (e.pointerType === 'touch' && !walkControl.touch) walkControl.onTouch?.(true);
    };
    const onClick = () => {
      if (!walkControl.touch && !locked()) requestLock();
    };
    const clear = () => state.keys.clear();
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    gl.domElement.addEventListener('pointerdown', onPointerDown);
    gl.domElement.addEventListener('click', onClick);
    if (!walkControl.touch) requestLock();
    resetTouchInput();

    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      gl.domElement.removeEventListener('pointerdown', onPointerDown);
      gl.domElement.removeEventListener('click', onClick);
      resetTouchInput();
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
    // Regard au toucher : joystick droit et glissé du doigt
    const [turn, tilt] = consumeTouchLook(dt);
    if (turn || tilt) {
      state.yaw += turn;
      state.pitch = Math.max(-1.3, Math.min(1.3, state.pitch + tilt));
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
