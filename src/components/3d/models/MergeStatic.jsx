import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noRaycast } from './kit';

/**
 * Optimisation des draw calls : après le montage, fusionne tous les maillages statiques
 * du sous-arbre en un maillage par (matériau, ombre portée, ombre reçue), puis masque les originaux.
 * Les matériaux mutualisés du kit (`userData.kitShared`, jamais modifiés) ne diffèrent le plus souvent
 * que par leur couleur, leur rugosité / aspect métallique et leur lueur : ces valeurs sont reportées
 * dans les sommets (shader standard légèrement adapté) et toutes ces pièces partagent un seul maillage.
 * Les autres matériaux (déclarés dans les composants, parfois animés par leurs props) gardent le leur.
 * Les objets animés doivent porter `userData.dynamic` : leurs pièces fixes sont fusionnées à part, dans
 * leur propre repère (elles suivent l'animation). Un maillage animé lui-même n'est jamais fusionné ; tout
 * groupe dont le code d'animation modifie un enfant (visibilité, position...) doit donc être marqué aussi.
 * `deps` : valeurs dont le changement impose de refaire la fusion (géométrie / disposition).
 */

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'];

/** Signature d'un matériau mutualisé, hors valeurs reportées dans les sommets. */
function bakedSignature(m) {
  return [m.type, m.map?.uuid, m.opacity, m.transparent, m.depthWrite, m.side, m.flatShading].join('|');
}

/** Valeurs de surface d'un matériau mutualisé, reportées dans les sommets (espace linéaire). */
function surfaceOf(m) {
  const glow = m.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : new THREE.Color(0, 0, 0);
  return { color: m.color, metalness: m.metalness, roughness: m.roughness, glow };
}

/** Matériau des pièces fusionnées : couleur, rugosité, aspect métallique et lueur lus par sommet. */
function bakedMaterial(source) {
  const material = source.clone();
  material.vertexColors = true;
  material.color.set('#ffffff');
  material.emissive?.set('#000000');
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 surface;\nattribute vec3 glow;\nvarying vec2 vSurface;\nvarying vec3 vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurface = surface;\nvGlow = glow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSurface;\nvarying vec3 vGlow;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurface.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurface.x;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vGlow;');
  };
  material.customProgramCacheKey = () => 'merge-static-baked-surface';
  return material;
}

/** Attribut constant (même valeur pour tous les sommets). */
function constantAttribute(count, values) {
  const array = new Float32Array(count * values.length);
  for (let i = 0; i < count; i += 1) array.set(values, i * values.length);
  return new THREE.BufferAttribute(array, values.length);
}

function hasFlag(obj, root, flag) {
  for (let node = obj; node && node !== root; node = node.parent) {
    if (node.userData?.[flag]) return true;
  }
  return false;
}

function normalizedGeometry(source, matrix, surface = null) {
  const geo = source.index ? source.toNonIndexed() : source.clone();
  const out = new THREE.BufferGeometry();
  const count = geo.attributes.position.count;
  KEPT_ATTRIBUTES.forEach((name) => {
    out.setAttribute(name, geo.attributes[name] || new THREE.BufferAttribute(new Float32Array(count * (name === 'uv' ? 2 : 3)), name === 'uv' ? 2 : 3));
  });
  if (surface) {
    const { color, metalness, roughness, glow } = surface;
    out.setAttribute('color', constantAttribute(count, [color.r, color.g, color.b]));
    out.setAttribute('surface', constantAttribute(count, [metalness, roughness]));
    out.setAttribute('glow', constantAttribute(count, [glow.r, glow.g, glow.b]));
  }
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
    const inverses = new Map();
    const inverseOf = (scope) => {
      if (!inverses.has(scope)) inverses.set(scope, new THREE.Matrix4().copy(scope.matrixWorld).invert());
      return inverses.get(scope);
    };
    // Portée de fusion : le groupe animé (userData.dynamic) le plus proche, sinon la racine ;
    // un maillage lui-même animé est laissé tel quel
    const scopeOf = (obj) => {
      if (obj.userData?.dynamic) return null;
      for (let node = obj.parent; node && node !== root; node = node.parent) {
        if (node.userData?.dynamic) return node;
      }
      return root;
    };
    const buckets = new Map();

    root.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh || !obj.visible || !obj.geometry?.attributes?.position) return;
      if (Array.isArray(obj.material)) return;
      const scope = scopeOf(obj);
      if (!scope) return;
      const noCollide = hasFlag(obj, root, 'noCollide');
      const shared = Boolean(obj.material.userData?.kitShared && obj.material.isMeshStandardMaterial && !obj.material.vertexColors);
      const key = `${scope.uuid}|${shared ? bakedSignature(obj.material) : obj.material.uuid}|${obj.castShadow}|${obj.receiveShadow}|${noCollide}`;
      if (!buckets.has(key)) buckets.set(key, { scope, material: obj.material, shared, cast: obj.castShadow, receive: obj.receiveShadow, noCollide, parts: [] });
      buckets.get(key).parts.push(obj);
    });

    const merged = [];
    const hidden = [];
    const ownedMaterials = [];
    buckets.forEach(({ scope, material: source, shared, cast, receive, noCollide, parts }) => {
      if (parts.length < 2) return; // rien à gagner : l'original reste affiché
      const inverse = inverseOf(scope);
      const geos = parts.map((obj) =>
        normalizedGeometry(obj.geometry, new THREE.Matrix4().multiplyMatrices(inverse, obj.matrixWorld), shared ? surfaceOf(obj.material) : null)
      );
      const geometry = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!geometry) return;
      let material = source;
      if (shared) {
        material = bakedMaterial(source);
        ownedMaterials.push(material);
      }
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.raycast = noRaycast;
      mesh.userData.noCollide = noCollide; // volumes sans collision du mode visite (voir collisionWorld)
      mesh.userData.dynamic = true; // ne jamais re-fusionner le résultat
      merged.push(mesh);
      scope.add(mesh);
      hidden.push(...parts);
    });
    // Originaux masqués et figés : three.js ne recalcule plus leurs matrices à chaque image
    hidden.forEach((obj) => {
      obj.visible = false;
      obj.matrixAutoUpdate = false;
      obj.matrixWorldAutoUpdate = false;
    });

    return () => {
      merged.forEach((mesh) => {
        mesh.parent?.remove(mesh);
        mesh.geometry.dispose();
      });
      ownedMaterials.forEach((material) => material.dispose());
      hidden.forEach((obj) => {
        obj.visible = true;
        obj.matrixAutoUpdate = true;
        obj.matrixWorldAutoUpdate = true;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, hmrVersion]);

  return <group ref={rootRef}>{children}</group>;
}
