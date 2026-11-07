import React from 'react';
import * as THREE from 'three';
import { noRaycast } from './kit';

/**
 * Regroupement des pièces fixes de toute une scène (éditeur de site) : chaque objet posé est déjà fusionné par
 * matériau (MergeStatic), mais il reste plusieurs dessins par objet — des centaines pour une ville. Ici, les pièces
 * fixes de tous les objets d'un même carré de carte (CELL unités) qui partagent un matériau deviennent un seul
 * maillage, en coordonnées du monde : quelques dessins par carré au lieu de quelques-uns par objet. Les matériaux
 * mutualisés du kit (couleur, rugosité, métal, lueur reportées dans les sommets) se regroupent tous ensemble.
 * - Restent à part : pièces animées, transparentes qui écrivent la profondeur, personnages, postes de travail.
 * - Une pièce restée seule qui se met à bouger (animée sans marque) est repérée et rendue à son objet.
 * - Un objet déplacé, modifié, ajouté ou retiré : son carré repasse aussitôt en pièces séparées (affichage exact
 *   pendant l'édition), puis se regroupe REBUILD_DELAY ms après la dernière modification, un carré par image.
 * - Les pièces regroupées sont masquées (la sélection passe par des volumes invisibles, les collisions de la visite
 *   par les données de la scène) ; leurs tampons graphiques sont libérés tant que le regroupement les remplace.
 */

export const StaticBatchContext = React.createContext(null);

const CELL = 20;
const REBUILD_DELAY = 400;
const CHECK_EVERY = 1; // images entre deux vérifications des déplacements (un objet glissé suit le pointeur)

/* ---- Matériaux à surface reportée (partagés avec MergeStatic) ---- */

/** Signature d'un matériau mutualisé, hors valeurs reportées dans les sommets. */
export function bakedSignature(m) {
  return [m.type, m.map?.uuid, m.opacity, m.transparent, m.depthWrite, m.side, m.flatShading].join('|');
}

/** Valeurs de surface d'un matériau mutualisé, reportées dans les sommets (espace linéaire). */
export function surfaceOf(m) {
  const glow = m.emissive ? m.emissive.clone().multiplyScalar(m.emissiveIntensity) : new THREE.Color(0, 0, 0);
  return { color: m.color, metalness: m.metalness, roughness: m.roughness, glow };
}

/** Matériau des pièces fusionnées : couleur, rugosité, aspect métallique et lueur lus par sommet. */
export function bakedMaterial(source) {
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
  // Regroupement de scène : un seul matériau par signature pour tous les objets
  material.bakedSource = source;
  material.bakedKey = bakedSignature(source);
  return material;
}

/** Matériau mutualisé du kit dont la surface peut être reportée dans les sommets. */
export const kitBakeable = (m) => Boolean(m?.userData?.kitShared && m.isMeshStandardMaterial && !m.vertexColors);

/* ---- Pièces regroupables ---- */

/** Pièce regroupable : maillage simple, opaque (ou transparent sans écriture de profondeur), matériau courant. */
export function batchable(mesh) {
  const m = mesh.material;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || Array.isArray(m) || !m) return false;
  if (!(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial || m.isMeshBasicMaterial)) return false;
  // Transparent : seulement sans écriture de profondeur (vitres, voiles) — l'ordre de mélange d'une même teinte
  // ne change rien ; avec écriture de profondeur, les pièces se masqueraient dans le désordre
  if ((m.transparent || m.opacity < 1) && m.depthWrite) return false;
  if (mesh.renderOrder !== 0 || mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return false;
  const g = mesh.geometry;
  if (!g?.attributes?.position || !g.attributes.normal || g.morphAttributes?.position) return false;
  // Couleurs par sommet : seulement celles des pièces fusionnées (matériau à surface reportée)
  if (m.vertexColors && !m.bakedSource) return false;
  return true;
}

/** Matrice du monde à jour, même figée (matrixWorldAutoUpdate faux : ignorée par three.js). */
function refreshWorld(mesh) {
  const parent = mesh.parent;
  if (!parent) return;
  parent.updateWorldMatrix(true, false);
  if (mesh.matrixAutoUpdate) mesh.updateMatrix();
  mesh.matrixWorld.multiplyMatrices(parent.matrixWorld, mesh.matrix);
}

const BAKED_ATTRIBUTES = ['position', 'normal', 'uv', 'color', 'surface', 'glow'];
const SIZES = { position: 3, normal: 3, uv: 2, color: 3, surface: 2, glow: 3 };

export class StaticBatcher {
  constructor(group) {
    this.group = group;
    this.entries = new Set();
    this.cells = new Map(); // clé de carré -> { entries:Set, meshes:[], due, batched }
    this.canonical = new Map(); // matériau à surface reportée commun par signature
    this.frame = 0;
  }

  /**
   * Enregistre les pièces fixes d'un objet (racine `root`) : `meshes` (pièces fusionnées, immobiles par
   * construction) et `singles` (pièces restées seules, surveillées) ; renvoie le jeton à rendre au retrait.
   */
  register(root, meshes, singles = []) {
    if (!meshes.length && !singles.length) return null;
    root.updateWorldMatrix(true, true);
    // Carré de l'objet : centre de l'emprise de ses pièces (les bâtiments sur mesure ont leur origine au centre
    // de la carte), gardé dans le repère de l'objet pour suivre ses déplacements
    const box = new THREE.Box3();
    const part = new THREE.Box3();
    [...meshes, ...singles].forEach((mesh) => {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      box.union(part.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
    });
    const center = box.getCenter(new THREE.Vector3());
    const local = center.clone().applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
    const entry = {
      root,
      local,
      meshes: [...meshes, ...singles],
      singles: singles.map((mesh) => ({ mesh, snapshot: mesh.matrixWorld.clone() })),
      snapshot: root.matrixWorld.clone(),
      cell: this.cellKey(center.x, center.z),
    };
    this.entries.add(entry);
    this.cellOf(entry.cell).entries.add(entry);
    this.invalidate(entry.cell);
    return entry;
  }

  unregister(entry) {
    if (!entry || !this.entries.has(entry)) return;
    this.entries.delete(entry);
    const cell = this.cells.get(entry.cell);
    if (cell) {
      this.invalidate(entry.cell);
      cell.entries.delete(entry);
    }
    entry.meshes.forEach((mesh) => {
      mesh.visible = true;
    });
  }

  cellKey(x, z) {
    return `${Math.floor(x / CELL)}|${Math.floor(z / CELL)}`;
  }

  cellOf(key) {
    if (!this.cells.has(key)) this.cells.set(key, { entries: new Set(), meshes: [], due: 0, batched: false });
    return this.cells.get(key);
  }

  /** Carré en pièces séparées tout de suite, regroupé plus tard. */
  invalidate(key) {
    const cell = this.cellOf(key);
    cell.due = performance.now() + REBUILD_DELAY;
    if (!cell.batched) return;
    cell.batched = false;
    this.clearCell(cell);
    cell.entries.forEach((entry) => entry.meshes.forEach((mesh) => (mesh.visible = true)));
  }

  clearCell(cell) {
    cell.meshes.forEach((mesh) => {
      this.group?.remove(mesh);
      mesh.geometry.dispose();
    });
    cell.meshes = [];
  }

  /** Vérifie les déplacements d'un objet et de ses pièces seules. */
  check(entry) {
    const root = entry.root.matrixWorld;
    if (!root.equals(entry.snapshot)) {
      entry.snapshot.copy(root);
      // Pièces fusionnées figées (voir MergeStatic) : positions recalculées une fois (three.js ne recalcule pas
      // une matrice figée, même de force)
      entry.meshes.forEach(refreshWorld);
      entry.singles.forEach((s) => s.snapshot.copy(s.mesh.matrixWorld));
      // Objet déplacé : il peut changer de carré
      const p = entry.local.clone().applyMatrix4(root);
      const key = this.cellKey(p.x, p.z);
      this.invalidate(entry.cell);
      if (key !== entry.cell) {
        this.cells.get(entry.cell)?.entries.delete(entry);
        entry.cell = key;
        this.cellOf(key).entries.add(entry);
        this.invalidate(key);
      }
      return;
    }
    // Pièce seule qui bouge dans son objet : animée, elle quitte le regroupement (vérifié une image sur 30)
    if (this.frame % 30 !== 0 || !entry.singles.length) return;
    let still = true;
    for (let i = 0; i < entry.singles.length && still; i += 1) still = entry.singles[i].mesh.matrixWorld.equals(entry.singles[i].snapshot);
    if (still) return;
    const moving = entry.singles.filter((s) => !s.mesh.matrixWorld.equals(s.snapshot));
    moving.forEach((s) => {
      entry.meshes.splice(entry.meshes.indexOf(s.mesh), 1);
      entry.singles.splice(entry.singles.indexOf(s), 1);
      s.mesh.visible = true;
    });
    this.invalidate(entry.cell);
  }

  /** La scène vient de changer (édition, glissement) : déplacements surveillés à chaque image pendant un moment. */
  touch() {
    this.watchUntil = this.frame + 12;
  }

  /**
   * À chaque image : déplacements détectés (à chaque image après une modification de la scène, sinon une image
   * sur 30), puis au plus un carré regroupé.
   */
  update() {
    this.frame += 1;
    if ((this.frame <= (this.watchUntil || 0) && this.frame % CHECK_EVERY === 0) || this.frame % 30 === 0) this.entries.forEach((entry) => this.check(entry));
    const now = performance.now();
    for (const cell of this.cells.values()) {
      if (cell.batched || !cell.due || now < cell.due) continue;
      this.buildCell(cell);
      break;
    }
  }

  /** Matériau du regroupement : surface reportée commune par signature (copie propre au regroupement). */
  materialFor(mesh) {
    const m = mesh.material;
    const source = m.bakedSource || (kitBakeable(m) ? m : null);
    if (!source) return { key: m.uuid, material: m, baked: false };
    const key = `baked|${bakedSignature(source)}`;
    if (!this.canonical.has(key)) this.canonical.set(key, bakedMaterial(source));
    return { key, material: this.canonical.get(key), baked: true };
  }

  buildCell(cell) {
    cell.due = 0;
    if (!this.group) return;
    this.clearCell(cell);
    const groups = new Map();
    cell.entries.forEach((entry) =>
      entry.meshes.forEach((mesh) => {
        refreshWorld(mesh);
        const { key, material, baked } = this.materialFor(mesh);
        const names = baked ? BAKED_ATTRIBUTES : mesh.geometry.attributes.uv ? ['position', 'normal', 'uv'] : ['position', 'normal'];
        const k = `${key}|${mesh.castShadow}|${mesh.receiveShadow}|${names.length}`;
        if (!groups.has(k)) groups.set(k, { material, cast: mesh.castShadow, receive: mesh.receiveShadow, names, parts: [] });
        groups.get(k).parts.push(mesh);
      })
    );
    groups.forEach(({ material, cast, receive, names, parts }) => {
      const geometry = mergeWorld(parts, names);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.raycast = noRaycast;
      // Coordonnées du monde (groupe du regroupement à l'origine) : aucune matrice à recalculer
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldAutoUpdate = false;
      mesh.userData.dynamic = true;
      mesh.userData.staticBatch = true;
      this.group.add(mesh);
      cell.meshes.push(mesh);
    });
    cell.entries.forEach((entry) =>
      entry.meshes.forEach((mesh) => {
        mesh.visible = false;
        // Tampons graphiques des pièces fusionnées (non partagées) libérés ; rechargés si le carré se défait
        if (mesh.userData.mergedOwner) mesh.geometry.dispose();
      })
    );
    cell.batched = true;
  }

  dispose() {
    this.cells.forEach((cell) => this.clearCell(cell));
    this.cells.clear();
    this.entries.forEach((entry) => entry.meshes.forEach((mesh) => (mesh.visible = true)));
    this.entries.clear();
    this.canonical.forEach((material) => material.dispose());
    this.canonical.clear();
  }
}

/**
 * Géométrie unique, en coordonnées du monde, des pièces `parts` (attributs `names`, sans index). Pièce à matériau
 * du kit (non fusionnée) : couleur, surface et lueur constantes tirées de son matériau ; coordonnées de texture
 * absentes : zéro.
 */
function mergeWorld(parts, names) {
  let total = 0;
  parts.forEach((mesh) => {
    const g = mesh.geometry;
    total += g.index ? g.index.count : g.attributes.position.count;
  });
  const arrays = {};
  names.forEach((name) => {
    arrays[name] = new Float32Array(total * SIZES[name]);
  });
  const normalMatrix = new THREE.Matrix3();
  let offset = 0;
  parts.forEach((mesh) => {
    const g = mesh.geometry;
    const index = g.index ? g.index.array : null;
    const count = index ? index.length : g.attributes.position.count;
    const e = mesh.matrixWorld.elements;
    normalMatrix.getNormalMatrix(mesh.matrixWorld);
    const n = normalMatrix.elements;
    const m = mesh.material;
    let constants = null;
    if (!m.bakedSource && names.length === BAKED_ATTRIBUTES.length) {
      const s = surfaceOf(m);
      constants = { color: [s.color.r, s.color.g, s.color.b], surface: [s.metalness, s.roughness], glow: [s.glow.r, s.glow.g, s.glow.b] };
    }
    names.forEach((name) => {
      const size = SIZES[name];
      const data = arrays[name];
      const src = g.attributes[name];
      if (!src || (constants && constants[name])) {
        // Valeur constante (surface du matériau) ou zéro (coordonnées de texture absentes)
        const value = constants?.[name];
        if (value) for (let i = 0; i < count; i += 1) data.set(value, (offset + i) * size);
        return;
      }
      const s = src.isInterleavedBufferAttribute ? src.data.array : src.array;
      const stride = src.isInterleavedBufferAttribute ? src.data.stride : src.itemSize;
      const base = src.isInterleavedBufferAttribute ? src.offset : 0;
      for (let i = 0; i < count; i += 1) {
        const at = base + (index ? index[i] : i) * stride;
        const to = (offset + i) * size;
        if (name === 'position') {
          const x = s[at];
          const y = s[at + 1];
          const z = s[at + 2];
          data[to] = e[0] * x + e[4] * y + e[8] * z + e[12];
          data[to + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          data[to + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        } else if (name === 'normal') {
          const x = s[at];
          const y = s[at + 1];
          const z = s[at + 2];
          const nx = n[0] * x + n[3] * y + n[6] * z;
          const ny = n[1] * x + n[4] * y + n[7] * z;
          const nz = n[2] * x + n[5] * y + n[8] * z;
          const l = Math.hypot(nx, ny, nz) || 1;
          data[to] = nx / l;
          data[to + 1] = ny / l;
          data[to + 2] = nz / l;
        } else {
          for (let c = 0; c < size; c += 1) data[to + c] = s[at + c];
        }
      }
    });
    offset += count;
  });
  const out = new THREE.BufferGeometry();
  names.forEach((name) => out.setAttribute(name, new THREE.BufferAttribute(arrays[name], SIZES[name])));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  // Copie mémoire libérée une fois envoyée à la carte graphique (le carré se reconstruit depuis les pièces)
  names.forEach((name) =>
    out.attributes[name].onUpload(function release() {
      this.array = null;
    })
  );
  return out;
}
