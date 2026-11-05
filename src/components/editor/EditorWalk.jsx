import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { buildWorld, floorAt, obstaclesAt, resolve, walkStep, levelAt, RADIUS } from '../../services/editorWalkPhysics';
import { visit, pushOutOfBodies } from '../../services/visitState';

/**
 * Visite en première personne du site conçu dans l'éditeur : souris capturée pour regarder,
 * ZQSD / WASD / flèches pour marcher, Maj pour courir. Collisions et hauteur du sol (étages, escaliers) :
 * voir services/editorWalkPhysics.js ; on ne traverse ni les personnages ni les voitures (services/visitState.js),
 * et la position du visiteur est partagée (voitures qui s'arrêtent, passants qui attendent, pigeons qui s'envolent).
 */

export const walkControl = { canvas: null, onLockChange: null };

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
    visit.active = true;

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
    const onClick = () => {
      if (!locked()) gl.domElement.requestPointerLock?.();
    };
    const clear = () => state.keys.clear();
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clear);
    gl.domElement.addEventListener('click', onClick);
    gl.domElement.requestPointerLock?.();

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
      visit.active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_, delta) => {
    if (!state.pos) return;
    const dt = Math.min(delta, 0.05);
    const k = state.keys;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    if (forward || strafe) {
      const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? RUN : WALK) * dt;
      const len = Math.hypot(forward, strafe);
      const sin = Math.sin(state.yaw);
      const cos = Math.cos(state.yaw);
      const dx = ((-sin * forward + cos * strafe) / len) * speed;
      const dz = ((-cos * forward - sin * strafe) / len) * speed;
      state.feet = walkStep(sceneRef.current, worldRef.current, state.pos, state.feet, dx, dz);
    }
    // Personnages et voitures : le visiteur est repoussé hors de leur emprise (puis hors des murs)
    const level = levelAt(state.feet);
    pushOutOfBodies(state.pos, level, RADIUS);
    resolve(state.pos, obstaclesAt(worldRef.current, level));
    visit.x = state.pos[0];
    visit.z = state.pos[1];
    visit.feet = state.feet;
    visit.level = level;
    // Montée des marches suivie en douceur ; une vraie chute (plus de 2 unités) est immédiate
    const targetY = state.feet + EYE;
    camera.position.set(state.pos[0], THREE.MathUtils.lerp(camera.position.y, targetY, Math.min(1, dt * 12)), state.pos[1]);
    if (Math.abs(camera.position.y - targetY) > 2) camera.position.y = targetY;
    camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
  });

  return null;
}
