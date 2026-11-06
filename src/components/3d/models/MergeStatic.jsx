import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noRaycast } from './kit';
import { StaticBatchContext, batchable, bakedMaterial, bakedSignature, surfaceOf, kitBakeable } from './staticBatch';

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
 * `isolated` : sous-arbre qui se fusionne lui-même (MergeStatic imbriqué dont le contenu change, par exemple
 * un personnage qui passe d'un niveau de détail à l'autre) — une fusion englobante ne le touche pas.
 * Les petites pièces (moins de SHADOW_TRIM de rayon : doigts, articulations, souris...) ne portent pas
 * d'ombre : invisible à l'œil, elle coûterait un dessin de plus par image dans la carte d'ombre.
 */

const SHADOW_TRIM = 0.06;
const SKIP = () => {};

const KEPT_ATTRIBUTES = ['position', 'normal', 'uv'];

// Signature, valeurs de surface et matériau des pièces à surface reportée : voir staticBatch.js (communs au
// regroupement de la scène)

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

/**
 * `batch` : les pièces fusionnées fixes (hors parties animées) rejoignent le regroupement de la scène
 * (StaticBatchContext, voir staticBatch.js) quand il existe.
 */
export default function MergeStatic({ children, deps = [], name, isolated = false, batch = false }) {
  const rootRef = useRef();
  const hmrVersion = useHmrVersion();
  const batcher = useContext(StaticBatchContext);

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
      // Sous-arbre isolé (MergeStatic imbriqué) : il gère sa propre fusion
      for (let node = obj.parent; node && node !== root; node = node.parent) {
        if (node.userData?.noMerge) return null;
      }
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
      mesh.userData.mergedOwner = true; // géométrie propre à cette fusion
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
    // Petites pièces restées visibles (fusionnées ou non) : pas d'ombre portée
    const trimmed = [];
    const scale = new THREE.Vector3();
    root.traverse((obj) => {
      if (!obj.isMesh || !obj.visible || !obj.castShadow || !obj.geometry?.attributes?.position) return;
      if (obj !== root && hasFlag(obj.parent, root, 'noMerge')) return;
      if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
      obj.getWorldScale(scale);
      if (obj.geometry.boundingSphere.radius * Math.max(scale.x, scale.y, scale.z) < SHADOW_TRIM) {
        obj.castShadow = false;
        trimmed.push(obj);
      }
    });

    // Pièces fixes (portée : la racine) confiées au regroupement de la scène : les pièces fusionnées, et les pièces
    // restées seules à matériau du kit (jamais modifié) — surveillées, car leur composant peut les déplacer
    let token = null;
    if (batch && batcher) {
      const shown = (obj) => {
        for (let node = obj; node && node !== root; node = node.parent) if (!node.visible) return false;
        return true;
      };
      const singles = [];
      buckets.forEach(({ scope, parts }) => {
        if (parts.length === 1 && scope === root && kitBakeable(parts[0].material) && shown(parts[0]) && batchable(parts[0])) singles.push(parts[0]);
      });
      token = batcher.register(root, merged.filter((mesh) => mesh.parent === root && batchable(mesh)), singles);
    }
    // Positions figées des parties inertes : groupes qui ne contiennent plus que des pièces masquées par la fusion
    // — three.js ne les recalcule plus à chaque image (des milliers de groupes dans une ville). Objet confié au
    // regroupement : ses pièces fusionnées aussi (le regroupement les recalcule si l'objet est déplacé). Restent
    // vivants : parties animées, sous-arbres isolés, pièces restées visibles (leur composant peut les animer sans
    // marque), lumières, lignes, et leurs parents.
    const frozen = [];
    const live = new Set();
    const keepUp = (node) => {
      for (let n = node; n && n !== root && !live.has(n); n = n.parent) live.add(n);
    };
    root.traverse((obj) => {
      if (obj === root || live.has(obj)) return;
      if ((obj.userData?.dynamic && !obj.userData?.mergedOwner) || obj.userData?.noMerge) {
        keepUp(obj);
        obj.traverse((child) => live.add(child));
      } else if (obj.userData?.mergedOwner) {
        if (!token) keepUp(obj);
      } else if ((obj.isMesh && obj.visible) || obj.isLight || obj.isLine || obj.isPoints || obj.isSprite) {
        keepUp(obj);
      }
    });
    // Groupes inertes masqués aussi : le parcours de chaque image (rendu, carte d'ombre) s'y arrête. three.js
    // parcourt pourtant tous les descendants pour les matrices, même figés : la mise à jour des groupes inertes et
    // des pièces masquées devient sans effet (SKIP), leur sous-arbre n'est plus visité.
    const veiled = [];
    const skipped = [];
    root.traverse((obj) => {
      if (obj === root || live.has(obj)) return;
      if (obj.matrixWorldAutoUpdate) {
        obj.matrixAutoUpdate = false;
        obj.matrixWorldAutoUpdate = false;
        frozen.push(obj);
      }
      if (obj.userData?.mergedOwner) return; // pièces fusionnées : recalculées si l'objet est déplacé
      if (!Object.prototype.hasOwnProperty.call(obj, 'updateMatrixWorld')) {
        obj.updateMatrixWorld = SKIP;
        skipped.push(obj);
      }
      if (!obj.isMesh && obj.visible && (live.has(obj.parent) || obj.parent === root)) {
        obj.visible = false;
        veiled.push(obj);
      }
    });

    return () => {
      batcher?.unregister(token);
      frozen.forEach((obj) => {
        obj.matrixAutoUpdate = true;
        obj.matrixWorldAutoUpdate = true;
      });
      veiled.forEach((obj) => {
        obj.visible = true;
      });
      skipped.forEach((obj) => {
        delete obj.updateMatrixWorld;
      });
      trimmed.forEach((obj) => {
        obj.castShadow = true;
      });
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
  }, [...deps, hmrVersion, batch, batcher]);

  return (
    <group ref={rootRef} name={name} userData={isolated ? { noMerge: true } : undefined}>
      {children}
    </group>
  );
}
