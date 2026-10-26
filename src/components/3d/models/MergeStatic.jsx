import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noRaycast } from './kit';

/**
 * Optimisation des draw calls : après le montage, fusionne tous les maillages statiques
 * du sous-arbre en un maillage par (matériau, ombre portée, ombre reçue), puis masque les originaux.
 * Les objets animés doivent porter `userData.dynamic` (eux et leurs descendants sont ignorés).
 * `deps` : valeurs dont le changement impose de refaire la fusion (géométrie / disposition).
 */

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'];

function isDynamic(obj, root) {
  for (let node = obj; node && node !== root; node = node.parent) {
    if (node.userData?.dynamic) return true;
  }
  return false;
}

function normalizedGeometry(source, matrix) {
  const geo = source.index ? source.toNonIndexed() : source.clone();
  const out = new THREE.BufferGeometry();
  const count = geo.attributes.position.count;
  KEPT_ATTRIBUTES.forEach((name) => {
    out.setAttribute(name, geo.attributes[name] || new THREE.BufferAttribute(new Float32Array(count * (name === 'uv' ? 2 : 3)), name === 'uv' ? 2 : 3));
  });
  geo.dispose();
  out.applyMatrix4(matrix);
  return out;
}

// En développement, un rechargement à chaud (HMR) remonte les enfants : on refait alors la fusion.
const hmrListeners = new Set();
if (import.meta.hot) {
  import.meta.hot.on('vite:afterUpdate', () => hmrListeners.forEach((notify) => notify()));
}

function useHmrVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!import.meta.hot) return undefined;
    const notify = () => setVersion((v) => v + 1);
    hmrListeners.add(notify);
    return () => hmrListeners.delete(notify);
  }, []);
  return version;
}

export default function MergeStatic({ children, deps = [] }) {
  const rootRef = useRef();
  const hmrVersion = useHmrVersion();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    root.updateMatrixWorld(true);
    const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map();
    const hidden = [];

    root.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || !obj.visible || !obj.geometry?.attributes?.position) return;
      if (Array.isArray(obj.material) || isDynamic(obj, root)) return;
      const key = `${obj.material.uuid}|${obj.castShadow}|${obj.receiveShadow}`;
      if (!buckets.has(key)) buckets.set(key, { material: obj.material, cast: obj.castShadow, receive: obj.receiveShadow, geos: [] });
      const local = new THREE.Matrix4().multiplyMatrices(inverseRoot, obj.matrixWorld);
      buckets.get(key).geos.push(normalizedGeometry(obj.geometry, local));
      hidden.push(obj);
    });

    const merged = [];
    buckets.forEach(({ material, cast, receive, geos }) => {
      const geometry = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geometry) return;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.raycast = noRaycast;
      mesh.userData.dynamic = true; // ne jamais re-fusionner le résultat
      merged.push(mesh);
      root.add(mesh);
    });
    hidden.forEach((obj) => {
      obj.visible = false;
    });

    return () => {
      merged.forEach((mesh) => {
        root.remove(mesh);
        mesh.geometry.dispose();
      });
      hidden.forEach((obj) => {
        obj.visible = true;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, hmrVersion]);

  return <group ref={rootRef}>{children}</group>;
}
