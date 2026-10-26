import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CollisionWorld } from './collisionWorld';
import { explorerStore } from './explorerStore';
import { computeSiteBounds } from '../CampusScenery';
import InspectorTablet from './InspectorTablet';

/**
 * Mode visite en première personne : un préventeur parcourt le site à hauteur d'homme.
 * Souris capturée (Pointer Lock) pour regarder, ZQSD / WASD / flèches pour marcher, Maj pour courir,
 * Espace pour sauter, E ou clic pour inspecter l'élément visé (UT, groupement, entité mère).
 * Collisions contre la géométrie réelle des modèles (voir collisionWorld).
 *
 * Échelle de la scène : 1 unité ≈ 1,5 m.
 */

const EYE = 1.07; // hauteur des yeux (≈ 1,60 m)
const HEAD = 1.17;
const RADIUS = 0.2;
const STEP = 0.25; // marche franchissable
const WALK = 2.6;
const RUN = 4.6;
const GRAVITY = 13;
const JUMP_SPEED = 3.7;
const SENSITIVITY = 0.0022;
const AIM_RANGE = 6;
const INTRO_SECONDS = 1.3;
const WALL_HEIGHTS = [0.3, 0.55, 0.8, 1.05];
const WALL_DIRS = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 4), 0, Math.sin((i * Math.PI) / 4)));
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const WORLD_LIMIT = 76;

const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
};

/** Emprises des UT, groupements et du totem central (repère monde) pour la visée et la localisation. */
function buildZones(data) {
  const buildings = (data?.buildings || []).map((b) => {
    const [x, , z] = b.layout3D.position;
    const [w, h, d] = b.layout3D.size;
    return { element: b, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY: h + 6 };
  });
  const units = (data?.allWorkUnitsWorld || []).map((ut) => {
    const [x, , z] = ut.layout3D.worldPosition;
    const [w, h, d] = ut.layout3D.size;
    return { element: ut, minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY: h + 0.6 };
  });
  return { buildings, units, root: data?.rootEntity || null };
}

function inside(zone, x, z, margin = 0) {
  return x > zone.minX - margin && x < zone.maxX + margin && z > zone.minZ - margin && z < zone.maxZ + margin;
}

/** Point d'apparition : devant l'élément ciblé, sinon à l'entrée du site (portail sud). */
function spawnFor(cameraTarget, data) {
  if (cameraTarget?.type === 'focus' && cameraTarget.position) {
    const [x, , z] = cameraTarget.position;
    if (!cameraTarget.isBuilding) return { x, z: z + 2.7, yaw: 0 };
    const building = data?.buildings?.find((b) => b.layout3D.position[0] === x && b.layout3D.position[2] === z);
    return { x, z: z + (building ? building.layout3D.size[2] / 2 : 8) + 2.4, yaw: 0 };
  }
  const fenceZ = data?.buildings?.length ? computeSiteBounds(data.buildings).fence.maxZ : 24;
  return { x: 0, z: fenceZ + 3, yaw: 0 };
}

export default function FirstPersonExplorer({ data, cameraTarget, onInspect, cotationMode, inspectedIds }) {
  const { camera, gl, scene } = useThree();
  const tabletRef = useRef();
  const setEvents = useThree((s) => s.setEvents);
  const world = useMemo(() => new CollisionWorld(), []);
  const zones = useMemo(() => buildZones(data), [data]);
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const onInspectRef = useRef(onInspect);
  onInspectRef.current = onInspect;

  const s = useRef({
    feet: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    grounded: false,
    eyeY: 0,
    keys: new Set(),
    jump: false,
    bob: 0,
    refreshIn: 0,
    nearIn: 0,
    publishIn: 0,
    intro: null,
    targetTs: cameraTarget?.ts,
  }).current;

  // Temporaires réutilisés à chaque image
  const tmp = useMemo(
    () => ({ origin: new THREE.Vector3(), dir: new THREE.Vector3(), wish: new THREE.Vector3(), euler: new THREE.Euler(0, 0, 0, 'YXZ'), quat: new THREE.Quaternion(), pos: new THREE.Vector3() }),
    []
  );

  const teleport = (spawn) => {
    s.feet.set(spawn.x, 0.5, spawn.z);
    s.vel.set(0, 0, 0);
    s.yaw = spawn.yaw;
    s.pitch = -0.08;
    s.grounded = false;
    s.eyeY = s.feet.y + EYE;
    s.refreshIn = 0;
  };

  // Mise en place : caméra à hauteur d'homme, événements pointeur R3F coupés, restauration à la sortie
  useEffect(() => {
    const previous = { fov: camera.fov, near: camera.near, order: camera.rotation.order };
    camera.fov = 70;
    camera.near = 0.03;
    camera.updateProjectionMatrix();
    setEvents({ enabled: false });

    const spawn = spawnFor(cameraTarget, data);
    teleport(spawn);
    s.intro = { t: 0, fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone() };

    return () => {
      camera.fov = previous.fov;
      camera.near = previous.near;
      camera.rotation.order = previous.order;
      camera.updateProjectionMatrix();
      setEvents({ enabled: true });
      explorerStore.releaseLock();
      explorerStore.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation depuis l'arborescence pendant la visite : téléportation devant l'élément choisi
  useEffect(() => {
    if (!cameraTarget || cameraTarget.ts === s.targetTs) return;
    s.targetTs = cameraTarget.ts;
    teleport(spawnFor(cameraTarget, data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget]);

  // Clavier / souris
  useEffect(() => {
    const canvas = gl.domElement;
    const isLocked = () => document.pointerLockElement === canvas;

    const inspect = () => {
      const { target } = explorerStore.get();
      if (!target) return;
      explorerStore.releaseLock();
      onInspectRef.current?.(target);
    };
    const onMouseMove = (e) => {
      if (!isLocked() || s.intro) return;
      // Ignore les sauts aberrants de movementX/Y que Chrome émet parfois sous Pointer Lock
      if (Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return;
      s.yaw -= e.movementX * SENSITIVITY;
      s.pitch = THREE.MathUtils.clamp(s.pitch - e.movementY * SENSITIVITY, -1.45, 1.45);
    };
    const onKeyDown = (e) => {
      if (!isLocked()) return;
      s.keys.add(e.code);
      if (e.code === 'Space') {
        e.preventDefault();
        s.jump = true;
      }
      if (e.code.startsWith('Arrow')) e.preventDefault();
      if (e.code === 'KeyE' && !e.repeat) inspect();
    };
    const onKeyUp = (e) => s.keys.delete(e.code);
    const onMouseDown = (e) => {
      if (isLocked() && e.button === 0) inspect();
    };
    // Clic dans la vue 3D en pause : reprise de la visite
    const onCanvasClick = () => {
      if (!isLocked()) explorerStore.requestLock();
    };
    const clearKeys = () => s.keys.clear();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('pointerlockchange', clearKeys);
    canvas.addEventListener('click', onCanvasClick);
    explorerStore.set({ locked: isLocked() });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('pointerlockchange', clearKeys);
      canvas.removeEventListener('click', onCanvasClick);
    };
  }, [gl, s]);

  const pressed = (name) => MOVE_KEYS[name].some((code) => s.keys.has(code));

  /** Repousse le joueur hors des parois (rayons horizontaux en étoile à plusieurs hauteurs). */
  const resolveWalls = () => {
    for (let pass = 0; pass < 2; pass += 1) {
      let pushed = false;
      for (const h of WALL_HEIGHTS) {
        for (const dir of WALL_DIRS) {
          tmp.origin.set(s.feet.x, s.feet.y + h, s.feet.z);
          const hit = world.raycast(tmp.origin, dir, RADIUS);
          if (!hit) continue;
          let nx = hit.normal.x;
          let nz = hit.normal.z;
          const len = Math.hypot(nx, nz);
          if (len < 0.35) continue; // surface quasi horizontale : gérée par le sol
          nx /= len;
          nz /= len;
          let facing = nx * dir.x + nz * dir.z;
          if (facing > 0) {
            nx = -nx;
            nz = -nz;
            facing = -facing;
          }
          const penetration = RADIUS - hit.distance * -facing;
          if (penetration <= 0.001) continue;
          s.feet.x += nx * penetration;
          s.feet.z += nz * penetration;
          const into = s.vel.x * nx + s.vel.z * nz;
          if (into < 0) {
            s.vel.x -= into * nx;
            s.vel.z -= into * nz;
          }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
  };

  /** Altitude du sol sous le joueur (rayon descendant partant d'une marche au-dessus des pieds). */
  const groundHeight = () => {
    tmp.origin.set(s.feet.x, s.feet.y + STEP, s.feet.z);
    const hit = world.raycast(tmp.origin, DOWN, STEP + 4);
    return hit ? hit.point.y : -Infinity;
  };

  /** Élément visé : premier impact du regard, rattaché à l'UT / au groupement qui le contient. */
  const findTarget = () => {
    camera.getWorldDirection(tmp.dir);
    const hit = world.raycast(camera.position, tmp.dir, AIM_RANGE, world.wide);
    if (!hit) return null;
    const { x, y, z } = hit.point;
    const { units, buildings, root } = zonesRef.current;
    const unit = units.find((u) => inside(u, x, z, 0.15) && y < u.maxY);
    if (unit) return unit.element;
    const building = buildings.find((b) => inside(b, x, z, 0.3) && y < b.maxY);
    if (building) return building.element;
    if (root && Math.hypot(x, z) < 3.4 && y < 3) return root;
    return null;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    if ((s.refreshIn -= dt) <= 0) {
      world.refresh(scene);
      s.refreshIn = 1;
      s.nearIn = 0;
    }
    if ((s.nearIn -= dt) <= 0) {
      world.updateNear(s.feet, 1.6, AIM_RANGE + 2);
      s.nearIn = 0.12;
    }

    // Descente de la vue campus vers le point d'apparition
    if (s.intro) {
      s.intro.t += dt / INTRO_SECONDS;
      const k = THREE.MathUtils.smootherstep(Math.min(s.intro.t, 1), 0, 1);
      const ground = groundHeight();
      if (ground > -Infinity) s.feet.y = ground;
      tmp.pos.set(s.feet.x, s.feet.y + EYE, s.feet.z);
      tmp.quat.setFromEuler(tmp.euler.set(s.pitch, s.yaw, 0));
      camera.position.lerpVectors(s.intro.fromPos, tmp.pos, k);
      camera.quaternion.slerpQuaternions(s.intro.fromQuat, tmp.quat, k);
      if (s.intro.t >= 1) {
        s.intro = null;
        s.eyeY = tmp.pos.y;
        camera.rotation.order = 'YXZ';
      }
      return;
    }

    const locked = explorerStore.get().locked;
    const forward = locked ? Number(pressed('forward')) - Number(pressed('back')) : 0;
    const strafe = locked ? Number(pressed('right')) - Number(pressed('left')) : 0;
    const speed = pressed('run') ? RUN : WALK;
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    tmp.wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe);
    if (tmp.wish.lengthSq() > 0) tmp.wish.normalize().multiplyScalar(speed);

    const accel = 1 - Math.exp(-dt * (s.grounded ? 12 : 2.5));
    s.vel.x += (tmp.wish.x - s.vel.x) * accel;
    s.vel.z += (tmp.wish.z - s.vel.z) * accel;
    if (s.jump && s.grounded) {
      s.vel.y = JUMP_SPEED;
      s.grounded = false;
    }
    s.jump = false;

    // Déplacement horizontal par sous-pas (pas de traversée de paroi à faible fréquence d'image)
    const travel = Math.hypot(s.vel.x, s.vel.z) * dt;
    const steps = Math.max(1, Math.ceil(travel / 0.08));
    for (let i = 0; i < steps; i += 1) {
      s.feet.x += (s.vel.x * dt) / steps;
      s.feet.z += (s.vel.z * dt) / steps;
      resolveWalls();
    }
    s.feet.x = THREE.MathUtils.clamp(s.feet.x, -WORLD_LIMIT, WORLD_LIMIT);
    s.feet.z = THREE.MathUtils.clamp(s.feet.z, -WORLD_LIMIT, WORLD_LIMIT);

    // Gravité, sol, plafond
    if (!s.grounded) s.vel.y -= GRAVITY * dt;
    if (s.vel.y > 0) {
      tmp.origin.set(s.feet.x, s.feet.y + HEAD - 0.1, s.feet.z);
      if (world.raycast(tmp.origin, UP, 0.12 + s.vel.y * dt)) s.vel.y = 0;
    }
    s.feet.y += s.vel.y * dt;
    const ground = groundHeight();
    const snap = s.grounded ? STEP : 0.02;
    if (s.vel.y <= 0 && s.feet.y <= ground + snap) {
      s.feet.y = ground;
      s.vel.y = 0;
      s.grounded = true;
    } else {
      s.grounded = false;
    }
    if (s.feet.y < -5) teleport(spawnFor(null, data));

    // Caméra : marches lissées, léger balancement de la tête en marchant
    const eyeTarget = s.feet.y + EYE;
    s.eyeY = s.grounded && eyeTarget > s.eyeY ? THREE.MathUtils.damp(s.eyeY, eyeTarget, 18, dt) : eyeTarget;
    const horizontalSpeed = Math.hypot(s.vel.x, s.vel.z);
    if (s.grounded && horizontalSpeed > 0.3) s.bob += dt * horizontalSpeed * 3.1;
    const bobAmount = s.grounded ? Math.min(horizontalSpeed / RUN, 1) * 0.022 : 0;
    camera.position.set(
      s.feet.x + Math.cos(s.bob) * bobAmount * 0.6 * cos,
      s.eyeY + Math.abs(Math.sin(s.bob)) * bobAmount,
      s.feet.z - Math.cos(s.bob) * bobAmount * 0.6 * sin
    );
    camera.rotation.order = 'YXZ';
    camera.rotation.set(s.pitch, s.yaw, 0);
    camera.updateMatrixWorld();
    if (tabletRef.current) {
      tabletRef.current.visible = locked;
      tabletRef.current.position.copy(camera.position);
      tabletRef.current.quaternion.copy(camera.quaternion);
    }

    // Visée et localisation (publiées vers le HUD uniquement en cas de changement)
    const state = explorerStore.get();
    const target = findTarget();
    const { units, buildings } = zonesRef.current;
    const zoneUt = units.find((u) => inside(u, s.feet.x, s.feet.z, 0.1))?.element || null;
    const zoneBuilding = buildings.find((b) => inside(b, s.feet.x, s.feet.z))?.element || null;
    const changes = {};
    if (target !== state.target) changes.target = target;
    if (zoneUt !== state.zoneUt) changes.zoneUt = zoneUt;
    if (zoneBuilding !== state.zoneBuilding) changes.zoneBuilding = zoneBuilding;
    if ((s.publishIn -= dt) <= 0) {
      changes.player = { x: s.feet.x, z: s.feet.z, yaw: s.yaw };
      s.publishIn = 0.1;
    }
    if (Object.keys(changes).length) explorerStore.set(changes);
  });

  return (
    <InspectorTablet
      ref={tabletRef}
      cotationMode={cotationMode}
      inspectedIds={inspectedIds}
      total={data?.allWorkUnitsWorld?.length || 0}
    />
  );
}
