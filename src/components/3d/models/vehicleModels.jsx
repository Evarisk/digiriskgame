import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Véhicules de la ville d'après les modèles 3D du « Car Kit » de Kenney (licence CC0, public/models/vehicules/,
 * voir LICENSE-Kenney-CC0.txt) : berlines, citadine, SUV, fourgon, camion de livraison, benne à ordures,
 * camion plateau. Chaque modèle est remis aux proportions réelles (la caisse est mise à l'échelle sur les trois
 * axes, les roues restent rondes), orienté avant vers +X comme les autres véhicules de l'éditeur, et repeint
 * dans la teinte demandée : la case de la palette utilisée par la carrosserie est repérée puis recolorée en
 * gardant son dégradé (vitres, pneus, optiques inchangés). Les roues tournent selon la distance parcourue
 * (`odometer.d`). Chargement asynchrone et partagé ; le groupe est marqué dynamique (jamais fusionné).
 */

const BASE = './models/vehicules/';
const DYNAMIC = { dynamic: true };

// Dimensions réelles visées (unités : 1 ≈ 1,5 m) : longueur, largeur, hauteur, rayon de roue
const MODELS = {
  sedan: { length: 3.0, width: 1.18, height: 0.98, wheel: 0.21 },
  'sedan-sports': { length: 3.0, width: 1.19, height: 0.9, wheel: 0.21 },
  'hatchback-sports': { length: 2.72, width: 1.16, height: 0.96, wheel: 0.2 },
  suv: { length: 3.05, width: 1.2, height: 1.12, wheel: 0.25 },
  'suv-luxury': { length: 3.1, width: 1.22, height: 1.12, wheel: 0.25 },
  van: { length: 3.3, width: 1.24, height: 1.32, wheel: 0.22 },
  delivery: { length: 3.9, width: 1.45, height: 1.75, wheel: 0.26 },
  'garbage-truck': { length: 5.2, width: 1.65, height: 2.2, wheel: 0.34 },
  'truck-flat': { length: 4.7, width: 1.6, height: 1.75, wheel: 0.32 },
};
const CAR_MODELS = ['sedan', 'hatchback-sports', 'suv', 'sedan-sports', 'suv-luxury'];

const loader = new GLTFLoader();
const gltfs = new Map();
/** Charge un modèle une seule fois ; repère la case de peinture (UV majoritaire de la caisse, pondérée par l'aire). */
function loadModel(name) {
  if (!gltfs.has(name)) {
    gltfs.set(
      name,
      new Promise((resolve, reject) => {
        loader.load(
          `${BASE}${name}.glb`,
          (gltf) => {
            const root = gltf.scene;
            const body = root.getObjectByName('body') || root;
            const votes = new Map();
            body.traverse((o) => {
              if (!o.isMesh || !o.geometry.attributes.uv) return;
              const g = o.geometry;
              const uv = g.attributes.uv;
              const pos = g.attributes.position;
              const idx = g.index ? g.index.array : null;
              const count = idx ? idx.length : pos.count;
              const a = new THREE.Vector3();
              const b = new THREE.Vector3();
              const c = new THREE.Vector3();
              for (let k = 0; k < count; k += 3) {
                const i0 = idx ? idx[k] : k;
                const i1 = idx ? idx[k + 1] : k + 1;
                const i2 = idx ? idx[k + 2] : k + 2;
                a.fromBufferAttribute(pos, i0);
                b.fromBufferAttribute(pos, i1);
                c.fromBufferAttribute(pos, i2);
                const area = b.clone().sub(a).cross(c.clone().sub(a)).length();
                // Case de 64 × 128 px de la palette 512 × 512 (paire de colonnes uni / dégradé)
                const cu = Math.floor(((uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3) * 8);
                const cv = Math.floor(((uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3) * 4);
                const key = `${Math.min(7, Math.max(0, cu))}|${Math.min(3, Math.max(0, cv))}`;
                votes.set(key, (votes.get(key) || 0) + area);
              }
            });
            let material = null;
            root.traverse((o) => {
              if (o.isMesh && !material) material = o.material;
            });
            // Carrosserie : la plus grande case de couleur franche (les gris, noirs et blancs sont les vitres,
            // pneus, bas de caisse et chromes, à ne pas repeindre)
            const image = material?.map?.image;
            let saturated = () => true;
            if (image) {
              const probe = document.createElement('canvas');
              probe.width = image.width;
              probe.height = image.height;
              const pctx = probe.getContext('2d');
              pctx.drawImage(image, 0, 0);
              saturated = (key) => {
                const [cu, cv] = key.split('|').map(Number);
                const [r, g, b] = pctx.getImageData(cu * (image.width / 8) + 8, cv * (image.height / 4) + 8, 1, 1).data;
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                return max > 50 && (max - min) / max > 0.25;
              };
            }
            const ranked = [...votes.entries()].sort((x, y) => y[1] - x[1]);
            const paint = (ranked.find(([key]) => saturated(key)) || ranked[0])?.[0] || '0|0';
            resolve({ root, paint: paint.split('|').map(Number), material });
          },
          undefined,
          reject
        );
      })
    );
  }
  return gltfs.get(name);
}

const paints = new Map();
/** Matériau du modèle avec la case de carrosserie repeinte dans `color` (dégradé de la case conservé). */
function paintedMaterial(model, name, color) {
  const key = `${name}|${color}`;
  if (!paints.has(key)) {
    const { material, paint } = model;
    const image = material.map?.image;
    if (!image) {
      paints.set(key, material);
      return material;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const cw = image.width / 8;
    const ch = image.height / 4;
    const x0 = paint[0] * cw;
    const y0 = paint[1] * ch;
    const data = ctx.getImageData(x0, y0, cw, ch);
    const target = new THREE.Color(color);
    // Luminance de référence : le haut de la colonne unie de la case
    const ref = (data.data[0] * 0.299 + data.data[1] * 0.587 + data.data[2] * 0.114) / 255 || 1;
    for (let i = 0; i < data.data.length; i += 4) {
      const lum = (data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114) / 255;
      // Dégradé de la case adouci : la teinte reste reconnaissable (un bordeaux ne vire pas au noir)
      const k = 0.84 + 0.2 * Math.min(1.2, lum / ref);
      data.data[i] = Math.min(255, target.r * 255 * k);
      data.data[i + 1] = Math.min(255, target.g * 255 * k);
      data.data[i + 2] = Math.min(255, target.b * 255 * k);
    }
    ctx.putImageData(data, x0, y0);
    const map = new THREE.CanvasTexture(canvas);
    map.flipY = material.map.flipY;
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = material.map.magFilter;
    map.minFilter = material.map.minFilter;
    map.anisotropy = 4;
    const painted = material.clone();
    painted.map = map;
    painted.metalness = 0.25;
    painted.roughness = 0.45;
    paints.set(key, painted);
  }
  return paints.get(key);
}

/** Instance d'un modèle aux proportions réelles, repeinte ; roues mises à part (rondes, qui tournent). */
function useVehicle(name, color) {
  const [model, setModel] = useState(null);
  useEffect(() => {
    let alive = true;
    loadModel(name).then((m) => alive && setModel(m));
    return () => {
      alive = false;
    };
  }, [name]);
  return useMemo(() => {
    if (!model) return null;
    const spec = MODELS[name];
    const root = model.root.clone(true);
    const material = paintedMaterial(model, name, color);
    const body = root.getObjectByName('body');
    const box = new THREE.Box3().setFromObject(body || root);
    const size = box.getSize(new THREE.Vector3());
    // Repère Kenney : avant vers +Z, largeur selon X ; le haut de la caisse est mis à la hauteur réelle
    const sx = spec.width / size.x;
    const sz = spec.length / size.z;
    const sy = spec.height / Math.max(0.01, box.max.y);
    const wheels = [];
    root.children.forEach((o) => {
      if (o.name.startsWith('wheel')) {
        const wb = new THREE.Box3().setFromObject(o);
        const r = (wb.max.y - wb.min.y) / 2 || 0.3;
        const ws = spec.wheel / r;
        o.scale.multiplyScalar(ws);
        o.position.set(o.position.x * sx, spec.wheel, o.position.z * sz);
        wheels.push(o);
      } else {
        o.scale.set(o.scale.x * sx, o.scale.y * sy, o.scale.z * sz);
        o.position.set(o.position.x * sx, o.position.y * sy, o.position.z * sz);
      }
    });
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = material;
        o.castShadow = true;
        o.receiveShadow = true;
        o.raycast = () => {};
      }
    });
    return { root, wheels, radius: spec.wheel };
  }, [model, name, color]);
}

/** Véhicule GLB (avant vers +X), `odometer` : objet { d } (distance parcourue) qui fait tourner les roues. */
function VehicleModel({ name, color, odometer, ...rest }) {
  const vehicle = useVehicle(name, color);
  const last = useRef(0);
  useFrame(() => {
    if (!vehicle || !odometer) return;
    if (odometer.d === last.current) return;
    last.current = odometer.d;
    const angle = odometer.d / vehicle.radius;
    vehicle.wheels.forEach((w) => {
      w.rotation.x = angle;
    });
  });
  return (
    <group {...rest} userData={DYNAMIC}>
      {vehicle && <primitive object={vehicle.root} rotation={[0, Math.PI / 2, 0]} />}
    </group>
  );
}

/** Code de modèle tiré de la couleur (les voitures d'une scène varient sans réglage). */
const pick = (color, list) => list[[...String(color)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) % list.length];

/** Voiture particulière (berline, citadine, SUV selon la couleur ou `model`), avant vers +X. */
export function Car({ color = '#2563eb', model, odometer, ...rest }) {
  return <VehicleModel name={model || pick(color, CAR_MODELS)} color={color} odometer={odometer} {...rest} />;
}

/** Fourgon utilitaire, avant vers +X (`stripe` conservé pour compatibilité, non utilisé). */
// eslint-disable-next-line no-unused-vars
export function Van({ color = '#f8fafc', stripe, odometer, ...rest }) {
  return <VehicleModel name="van" color={color} odometer={odometer} {...rest} />;
}

/** Poids lourds municipaux : camion de livraison, benne à ordures, camion plateau. */
export function Truck({ model = 'garbage-truck', color = '#f4f5f6', odometer, ...rest }) {
  return <VehicleModel name={model} color={color} odometer={odometer} {...rest} />;
}
