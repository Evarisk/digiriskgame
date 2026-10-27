import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { BriefcaseMedical, FireExtinguisher } from 'lucide-react';
import { equipmentCheck, formatDate } from '../../../services/equipmentChecks';

/**
 * Équipements de sécurité interactifs (extincteurs, trousses de secours) : survol à la souris,
 * ou visée en mode visite, pour afficher leurs dates de vérification (services/equipmentChecks.js).
 *
 * Chaque équipement porte une zone de survol invisible placée sur un calque que la caméra ne dessine
 * pas (aucun draw call). Le survol utilise un lancer de rayons dédié à ce calque : les volumes
 * holographiques des UT, qui interceptent les événements de pointeur, ne masquent pas les équipements.
 */

export const EQUIPMENT_LAYER = 1;

/** Élément DigiRisk (UT, groupement) ou lieu qui détient les équipements du sous-arbre. */
export const EquipmentOwner = createContext(null);

const items = new Map(); // clé -> { key, kind, owner, object }
let state = { hovered: null, aimed: null };
const listeners = new Set();

export const equipmentStore = {
  items,
  get: () => state,
  set(partial) {
    state = { ...state, ...partial };
    listeners.forEach((notify) => notify());
  },
  subscribe(notify) {
    listeners.add(notify);
    return () => listeners.delete(notify);
  },
};

function useEquipment(selector) {
  return useSyncExternalStore(equipmentStore.subscribe, () => selector(state));
}

const HOTSPOT_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const HOTSPOT_MATERIAL = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

/**
 * Zone de survol d'un équipement. `slot` distingue les équipements d'un même élément (emplacement
 * dans le modèle) ; sans élément propriétaire (galerie des modèles), rien n'est rendu.
 */
export function EquipmentHotspot({ kind, slot, center = [0, 0, 0], size = [0.3, 0.3, 0.3] }) {
  const owner = useContext(EquipmentOwner);
  const meshRef = useRef();
  const key = owner ? `${owner.id}:${kind}:${slot}` : null;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !key) return undefined;
    mesh.layers.set(EQUIPMENT_LAYER);
    const item = { key, kind, owner, object: mesh };
    items.set(key, item);
    return () => {
      items.delete(key);
      const { hovered, aimed } = equipmentStore.get();
      if (hovered?.key === key || aimed?.key === key) {
        equipmentStore.set({ hovered: hovered?.key === key ? null : hovered, aimed: aimed?.key === key ? null : aimed });
      }
    };
  }, [key, kind, owner]);

  if (!owner) return null;
  return (
    <mesh
      ref={meshRef}
      position={center}
      scale={size}
      geometry={HOTSPOT_GEOMETRY}
      material={HOTSPOT_MATERIAL}
      userData={{ dynamic: true, noCollide: true }}
    />
  );
}

const tmp = new THREE.Vector3();
const hoverRaycaster = new THREE.Raycaster();
hoverRaycaster.layers.set(EQUIPMENT_LAYER);
const lastPointer = new THREE.Vector2(NaN, NaN);

/** Survol à la souris (hors mode visite) : équipement le plus proche sous le pointeur. */
function useEquipmentHover() {
  const source = useThree((s) => s.events.connected);
  useEffect(() => {
    if (!source) return undefined;
    const leave = () => {
      lastPointer.set(NaN, NaN);
      if (equipmentStore.get().hovered) equipmentStore.set({ hovered: null });
    };
    source.addEventListener('pointerleave', leave);
    return () => source.removeEventListener('pointerleave', leave);
  }, [source]);

  useFrame(({ pointer, camera, events }) => {
    if (!events.enabled) {
      // Mode visite : seule la visée compte
      if (equipmentStore.get().hovered) equipmentStore.set({ hovered: null });
      return;
    }
    if (pointer.equals(lastPointer)) return;
    lastPointer.copy(pointer);
    hoverRaycaster.setFromCamera(pointer, camera);
    const objects = Array.from(items.values(), (item) => item.object);
    const hit = hoverRaycaster.intersectObjects(objects, false)[0];
    const hovered = hit ? [...items.values()].find((item) => item.object === hit.object) : null;
    if (hovered !== equipmentStore.get().hovered) equipmentStore.set({ hovered });
  });
}

/**
 * Équipement visé en mode visite : le plus proche dont le centre passe à moins de `radius` de l'axe
 * du regard, devant le premier obstacle (`blockedAt`, avec une tolérance pour l'équipement lui-même).
 */
export function findAimedEquipment(origin, direction, maxDistance, blockedAt = Infinity, radius = 0.32) {
  let best = null;
  let bestAlong = Infinity;
  for (const item of items.values()) {
    item.object.getWorldPosition(tmp).sub(origin);
    const along = tmp.dot(direction);
    if (along < 0.2 || along > maxDistance || along > blockedAt + 0.35) continue;
    const off = Math.sqrt(Math.max(0, tmp.lengthSq() - along * along));
    if (off < radius && along < bestAlong) {
      best = item;
      bestAlong = along;
    }
  }
  return best;
}

const STATUS_TEXT = {
  ok: (days) => `À jour · échéance dans ${days} j`,
  soon: (days) => `À prévoir · échéance dans ${days} j`,
  late: (days) => `En retard de ${-days} j`,
};

/** Infobulle de l'équipement survolé (ou visé en mode visite), unique dans la scène. */
export function EquipmentTooltip() {
  useEquipmentHover();
  const item = useEquipment((s) => s.aimed || s.hovered);
  const position = useMemo(() => (item ? item.object.getWorldPosition(new THREE.Vector3()).toArray() : null), [item]);
  if (!item || !position) return null;

  const info = equipmentCheck(item.kind, item.key);
  const Icon = item.kind === 'firstaid' ? BriefcaseMedical : FireExtinguisher;
  return (
    <Html position={[position[0], position[1] + 0.45, position[2]]} center zIndexRange={[60, 50]} style={{ pointerEvents: 'none' }}>
      <div className={`equipment-tooltip ${info.status}`}>
        <div className="equipment-head">
          <Icon size={15} />
          <strong>{info.label}</strong>
          <span>{info.model}</span>
        </div>
        <div className="equipment-owner">
          {item.owner.ref} · {item.owner.label}
        </div>
        <dl>
          <dt>{info.lastLabel}</dt>
          <dd>{formatDate(info.lastCheck)}</dd>
          <dt>{info.nextLabel}</dt>
          <dd>{formatDate(info.nextCheck)}</dd>
        </dl>
        <div className="equipment-status">{STATUS_TEXT[info.status](info.daysLeft)}</div>
        <div className="equipment-demo">{info.check} · dates de démonstration</div>
      </div>
    </Html>
  );
}
