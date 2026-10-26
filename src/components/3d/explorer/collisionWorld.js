import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

/**
 * Monde de collision du mode visite : lancers de rayons accélérés (BVH) sur les maillages
 * visibles de la scène. Les maillages du kit neutralisent `raycast` (performance des événements
 * pointeur) : on interroge donc directement les BVH, sans passer par `mesh.raycast`.
 * Exclus : sous-arbres masqués ou marqués `userData.noCollide` (volumes holographiques, fumées,
 * main du joueur...), lignes et maillages instanciés.
 */

const bvhCache = new WeakMap();

function bvhOf(geometry) {
  let bvh = bvhCache.get(geometry);
  if (!bvh) {
    // `indirect` : n'altère pas l'index de la géométrie partagée avec le rendu
    bvh = new MeshBVH(geometry, { indirect: true, maxLeafTris: 8 });
    bvhCache.set(geometry, bvh);
  }
  return bvh;
}

function isSolidMesh(obj) {
  if (!obj.isMesh || obj.isInstancedMesh || Array.isArray(obj.material)) return false;
  const geometry = obj.geometry;
  return Boolean(geometry?.attributes?.position) && !geometry.isInstancedBufferGeometry && obj.material?.visible !== false;
}

function collect(node, out) {
  if (!node.visible || node.userData?.noCollide) return;
  if (isSolidMesh(node)) out.push(node);
  for (let i = 0; i < node.children.length; i += 1) collect(node.children[i], out);
}

const _sphere = new THREE.Sphere();
const _inverse = new THREE.Matrix4();
const _localRay = new THREE.Ray();
const _farPoint = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();

function worldSphere(mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  return _sphere.copy(geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
}

export class CollisionWorld {
  constructor() {
    this.meshes = [];
    this.close = []; // proximité immédiate du joueur (murs, sol)
    this.wide = []; // portée de visée
    this.hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), mesh: null };
  }

  /** Recense les maillages solides de la scène (à rappeler quand la scène change). */
  refresh(scene) {
    const list = [];
    collect(scene, list);
    this.meshes = list;
  }

  /** Pré-filtre les maillages dont la sphère englobante approche `center`. */
  updateNear(center, closeRadius, wideRadius) {
    this.close = [];
    this.wide = [];
    for (const mesh of this.meshes) {
      const sphere = worldSphere(mesh);
      const gap = sphere.center.distanceTo(center) - sphere.radius;
      if (gap < wideRadius) this.wide.push(mesh);
      if (gap < closeRadius) this.close.push(mesh);
    }
  }

  /**
   * Premier impact le long du rayon (direction normalisée) jusqu'à `far` (unités monde).
   * Renvoie `this.hit` (réutilisé à chaque appel) ou null.
   */
  raycast(origin, direction, far, list = this.close) {
    let bestDistance = far;
    let bestMesh = null;
    let bestFace = null;
    const hitPoint = this.hit.point;

    for (const mesh of list) {
      const sphere = worldSphere(mesh);
      const toCenter = sphere.center.distanceTo(origin);
      if (toCenter - sphere.radius > bestDistance) continue;

      // Rayon et portée exprimés dans le repère local (échelles non uniformes du kit)
      _inverse.copy(mesh.matrixWorld).invert();
      _farPoint.copy(direction).multiplyScalar(bestDistance).add(origin).applyMatrix4(_inverse);
      _localRay.origin.copy(origin).applyMatrix4(_inverse);
      _localRay.direction.copy(_farPoint).sub(_localRay.origin);
      const localFar = _localRay.direction.length();
      if (localFar < 1e-6) continue;
      _localRay.direction.divideScalar(localFar);
      if (!_localRay.intersectsSphere(mesh.geometry.boundingSphere)) continue;

      const result = bvhOf(mesh.geometry).raycastFirst(_localRay, mesh.material.side, 0, localFar);
      if (!result) continue;
      _hitPoint.copy(result.point).applyMatrix4(mesh.matrixWorld);
      const distance = _hitPoint.distanceTo(origin);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMesh = mesh;
        bestFace = result.face;
        hitPoint.copy(_hitPoint);
      }
    }

    if (!bestMesh) return null;
    this.hit.distance = bestDistance;
    this.hit.mesh = bestMesh;
    _normalMatrix.getNormalMatrix(bestMesh.matrixWorld);
    this.hit.normal.copy(bestFace.normal).applyMatrix3(_normalMatrix).normalize();
    return this.hit;
  }
}
