import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Kit de primitives low-poly partagées par tous les modèles 3D (bâtiments, postes, décor).
 * Échelle : 1 unité ≈ 1,5 m (cohérente avec les opérateurs animés de WorkerAgents).
 * Géométries unitaires et matériaux sont mutualisés (mis en cache) pour limiter
 * le nombre d'objets GPU, et les maillages décoratifs ignorent le raycasting
 * (le clic est porté par la dalle / le volume de l'Unité de Travail).
 */

export const noRaycast = () => null;

/** À poser en `userData` sur tout groupe / maillage animé : il est exclu de la fusion statique. */
export const DYNAMIC = { dynamic: true };

export const PALETTE = {
  steel: '#9aa5b1',
  darkSteel: '#475569',
  graphite: '#1f2937',
  rubber: '#111827',
  concrete: '#8b939c',
  white: '#e5e7eb',
  wood: '#c8a27a',
  glass: '#7dd3fc',
  safetyYellow: '#facc15',
  safetyBlack: '#1f2937',
  fireRed: '#dc2626',
  safetyGreen: '#16a34a',
  mandatoryBlue: '#1d4ed8',
  machineGreen: '#5f7f73',
  machineBlue: '#2f5f9e',
  carton: '#c08a4f',
  rackBlue: '#1d4ed8',
  rackOrange: '#f97316',
};

/* ------------------------------------------------------------------ */
/* Géométries & matériaux mutualisés                                   */
/* ------------------------------------------------------------------ */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_SPHERE = new THREE.SphereGeometry(0.5, 16, 12);
const UNIT_ICOSA = new THREE.IcosahedronGeometry(0.5, 0);
const UNIT_DODECA = new THREE.DodecahedronGeometry(0.5, 0);
const UNIT_TORUS = new THREE.TorusGeometry(0.5, 0.14, 8, 28);
const UNIT_TORUS_ARC = new THREE.TorusGeometry(0.5, 0.145, 8, 6, Math.PI / 5);

/**
 * Panneau de bardage ondulé unitaire (longueur X = 1, hauteur Y = 1, ondes en Z de 0 à 1).
 * Mettre à l'échelle avec scale=[longueur, hauteur, épaisseur].
 */
const corrugatedGeometries = new Map();
export function getCorrugatedGeometry(waves = 16) {
  if (!corrugatedGeometries.has(waves)) {
    const p = 1 / waves;
    const pts = [new THREE.Vector2(-0.5, -0.25)];
    for (let i = 0; i < waves; i += 1) {
      const x0 = -0.5 + i * p;
      pts.push(
        new THREE.Vector2(x0, 0),
        new THREE.Vector2(x0 + 0.2 * p, 1),
        new THREE.Vector2(x0 + 0.5 * p, 1),
        new THREE.Vector2(x0 + 0.7 * p, 0)
      );
    }
    pts.push(new THREE.Vector2(0.5, 0), new THREE.Vector2(0.5, -0.25));
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 1, bevelEnabled: false });
    geo.translate(0, 0, -0.5);
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    corrugatedGeometries.set(waves, geo);
  }
  return corrugatedGeometries.get(waves);
}

const cylinderGeometries = new Map();
function getCylinderGeometry(top = 1, segments = 16, openEnded = false) {
  const key = `${top}|${segments}|${openEnded}`;
  if (!cylinderGeometries.has(key)) {
    cylinderGeometries.set(key, new THREE.CylinderGeometry(0.5 * top, 0.5, 1, segments, 1, openEnded));
  }
  return cylinderGeometries.get(key);
}

const materials = new Map();
export function getMaterial({
  color = '#94a3b8',
  metalness = 0.1,
  roughness = 0.7,
  emissive = null,
  emissiveIntensity = 1,
  opacity = 1,
  flatShading = false,
  doubleSide = false,
  map = null,
} = {}) {
  const key = [color, metalness, roughness, emissive, emissiveIntensity, opacity, flatShading, doubleSide, map?.uuid].join('|');
  let material = materials.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({
      color,
      map,
      metalness,
      roughness,
      flatShading,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 0.6,
      side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    if (emissive) {
      material.emissive = new THREE.Color(emissive);
      material.emissiveIntensity = emissiveIntensity;
    }
    materials.set(key, material);
  }
  return material;
}

function materialFrom({ color, metal, rough, glow, glowColor, opacity, flat, doubleSide, map }) {
  return getMaterial({
    color: map && !color ? '#ffffff' : color,
    map,
    metalness: metal,
    roughness: rough,
    emissive: glow ? glowColor || color : null,
    emissiveIntensity: glow || 1,
    opacity,
    flatShading: flat,
    doubleSide,
  });
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

// Seuls les objets d'une certaine taille projettent une ombre (allège la passe d'ombres)
const SHADOW_MIN_SIZE = 0.3;

export function Box({ size = [1, 1, 1], color, metal, rough, glow, glowColor, opacity, flat, doubleSide, map, shadow = true, receive = false, ...rest }) {
  return (
    <mesh
      geometry={UNIT_BOX}
      material={materialFrom({ color, metal, rough, glow, glowColor, opacity, flat, doubleSide, map })}
      scale={size}
      castShadow={shadow && (opacity ?? 1) >= 0.6 && Math.max(size[0], size[1], size[2]) >= SHADOW_MIN_SIZE}
      receiveShadow={receive}
      raycast={noRaycast}
      {...rest}
    />
  );
}

/** Cylindre vertical (axe Y). `top` = ratio rayon haut / rayon bas (0 => cône). */
export function Cylinder({ radius = 0.5, height = 1, top = 1, segments = 16, openEnded = false, color, metal, rough, glow, glowColor, opacity, flat, doubleSide, map, shadow = true, ...rest }) {
  return (
    <mesh
      geometry={getCylinderGeometry(top, segments, openEnded)}
      material={materialFrom({ color, metal, rough, glow, glowColor, opacity, flat, doubleSide, map })}
      scale={[radius * 2, height, radius * 2]}
      castShadow={shadow && (opacity ?? 1) >= 0.6 && Math.max(radius * 2, height) >= SHADOW_MIN_SIZE}
      raycast={noRaycast}
      {...rest}
    />
  );
}

export function Ball({ radius = 0.5, scale, shape = 'sphere', color, metal, rough, glow, glowColor, opacity, flat, shadow = true, ...rest }) {
  const geometry = shape === 'icosa' ? UNIT_ICOSA : shape === 'dodeca' ? UNIT_DODECA : UNIT_SPHERE;
  const s = scale || [radius * 2, radius * 2, radius * 2];
  return (
    <mesh
      geometry={geometry}
      material={materialFrom({ color, metal, rough, glow, glowColor, opacity, flat })}
      scale={s}
      castShadow={shadow && (opacity ?? 1) >= 0.6 && Math.max(...s) >= SHADOW_MIN_SIZE}
      raycast={noRaycast}
      {...rest}
    />
  );
}

/** Tube / câble / tuyauterie suivant une courbe passant par `points`. */
export function Tube({ points, radius = 0.02, color = PALETTE.rubber, metal, rough = 0.6, glow, closed = false, segments = 32 }) {
  const key = JSON.stringify(points);
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
    return new THREE.TubeGeometry(curve, segments, radius, 8, closed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, radius, closed, segments]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} material={materialFrom({ color, metal, rough, glow })} castShadow raycast={noRaycast} />
  );
}

/** Prisme extrudé à partir d'un profil 2D (plan XY) sur `depth` selon Z, centré en Z. */
export function Profile({ points, depth = 1, bevel = 0, color, metal, rough, glow, opacity, map, shadow = true, ...rest }) {
  const key = JSON.stringify(points);
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, depth, bevel]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      material={materialFrom({ color, metal, rough, glow, opacity, map })}
      castShadow={shadow && (opacity ?? 1) >= 0.6}
      raycast={noRaycast}
      {...rest}
    />
  );
}

/** Bardage / tôle ondulée : `size` = [longueur, hauteur, profondeur d'onde], ondes vers +Z. */
export function Corrugated({ size = [1, 1, 0.04], waves = 16, color, metal = 0.45, rough = 0.45, opacity, shadow = true, ...rest }) {
  return (
    <mesh
      geometry={getCorrugatedGeometry(waves)}
      material={materialFrom({ color, metal, rough, opacity })}
      scale={size}
      castShadow={shadow}
      receiveShadow
      raycast={noRaycast}
      {...rest}
    />
  );
}

/** Bouée couronne rouge et blanche (axe selon Z). */
export function Lifebuoy({ radius = 0.18, ...rest }) {
  return (
    <group {...rest}>
      <mesh geometry={UNIT_TORUS} material={getMaterial({ color: '#ea580c', roughness: 0.6 })} scale={radius * 2} castShadow raycast={noRaycast} />
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          geometry={UNIT_TORUS_ARC}
          material={getMaterial({ color: '#f8fafc', roughness: 0.6 })}
          rotation={[0, 0, (i * Math.PI) / 2]}
          scale={radius * 2}
          raycast={noRaycast}
        />
      ))}
    </group>
  );
}

/** Générateur pseudo-aléatoire déterministe (positions stables d'un rendu à l'autre). */
export function seeded(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Marquages & signalisation de sécurité                               */
/* ------------------------------------------------------------------ */

/** Contour peint au sol (zone de danger / allée) — rectangle centré. */
export function FloorZone({ width, depth, color = PALETTE.safetyYellow, line = 0.05, position = [0, 0, 0] }) {
  const y = 0.008;
  return (
    <group position={position} userData={{ noCollide: true }}>
      <Box position={[0, y, -depth / 2]} size={[width, 0.012, line]} color={color} shadow={false} />
      <Box position={[0, y, depth / 2]} size={[width, 0.012, line]} color={color} shadow={false} />
      <Box position={[-width / 2, y, 0]} size={[line, 0.012, depth]} color={color} shadow={false} />
      <Box position={[width / 2, y, 0]} size={[line, 0.012, depth]} color={color} shadow={false} />
    </group>
  );
}

/**
 * Couloir piéton industriel réglementaire (norme INRS) reliant deux points [x1, z1] -> [x2, z2] :
 * bande de circulation verte bordée de deux lignes jaunes de sécurité, avec chevrons directionnels
 * et pictogrammes piétons blancs peints au sol (ou zébra de traversée si `zebra = true`).
 */
export function WalkwayStrip({
  from = [0, 0],
  to = [1, 0],
  y = 0.008,
  width = 0.78,
  line = 0.055,
  color = '#15803d',
  borderColor = PALETTE.safetyYellow,
  arrows = true,
  zebra = false,
}) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return null;
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const angle = Math.atan2(-dz, dx);
  const markCount = arrows ? Math.max(1, Math.floor(len / 2.6)) : 0;
  const zebraCount = zebra ? Math.max(2, Math.floor(len / 0.34)) : 0;

  return (
    <group position={[cx, y, cz]} rotation={[0, angle, 0]} userData={{ noCollide: true }}>
      {/* Bande de roulement piétonne verte */}
      <Box position={[0, 0, 0]} size={[len, 0.008, width]} color={color} rough={0.85} shadow={false} />
      {/* Deux bandes latérales jaunes de sécurité */}
      <Box position={[0, 0.002, -(width / 2 - line / 2)]} size={[len, 0.01, line]} color={borderColor} shadow={false} />
      <Box position={[0, 0.002, width / 2 - line / 2]} size={[len, 0.01, line]} color={borderColor} shadow={false} />

      {/* Zébra de seuil de porte / traversée de voie */}
      {zebra &&
        Array.from({ length: zebraCount }, (_, i) => {
          const x = -len / 2 + ((i + 0.5) * len) / zebraCount;
          return (
            <Box
              key={`z${i}`}
              position={[x, 0.004, 0]}
              size={[0.14, 0.01, width - line * 2.4]}
              color={i % 2 === 0 ? '#f8fafc' : borderColor}
              shadow={false}
            />
          );
        })}

      {/* Chevrons directionnels et silhouettes piétons peints au sol */}
      {!zebra &&
        Array.from({ length: markCount }, (_, i) => {
          const x = -len / 2 + ((i + 0.5) * len) / markCount;
          const isPedIcon = i % 2 === 1 && len >= 3.2;
          return isPedIcon ? (
            <group key={`m${i}`} position={[x, 0.004, 0]}>
              <Cylinder position={[-0.12, 0, 0]} radius={0.055} height={0.01} segments={12} color="#f8fafc" shadow={false} />
              <Box position={[0.04, 0, 0]} size={[0.18, 0.01, 0.12]} color="#f8fafc" shadow={false} />
              <Box position={[0.2, 0, -0.05]} rotation={[0, 0.2, 0]} size={[0.16, 0.01, 0.045]} color="#f8fafc" shadow={false} />
              <Box position={[0.2, 0, 0.05]} rotation={[0, -0.2, 0]} size={[0.16, 0.01, 0.045]} color="#f8fafc" shadow={false} />
            </group>
          ) : (
            <group key={`m${i}`} position={[x, 0.004, 0]}>
              <Box position={[0.06, 0, -0.08]} rotation={[0, 0.65, 0]} size={[0.22, 0.01, 0.045]} color="#f8fafc" shadow={false} />
              <Box position={[0.06, 0, 0.08]} rotation={[0, -0.65, 0]} size={[0.22, 0.01, 0.045]} color="#f8fafc" shadow={false} />
            </group>
          );
        })}
    </group>
  );
}

/** Dalle de jonction aux intersections de couloirs piétons. */
export function WalkwayNode({
  position = [0, 0],
  y = 0.008,
  width = 0.78,
  line = 0.055,
  color = '#15803d',
  borderColor = PALETTE.safetyYellow,
}) {
  const c = width / 2 - line / 2;
  return (
    <group position={[position[0], y, position[1]]} userData={{ noCollide: true }}>
      <Box position={[0, 0.001, 0]} size={[width, 0.009, width]} color={color} rough={0.85} shadow={false} />
      {[
        [-c, -c],
        [-c, c],
        [c, -c],
        [c, c],
      ].map(([kx, kz], idx) => (
        <Box key={idx} position={[kx, 0.003, kz]} size={[line * 1.3, 0.011, line * 1.3]} color={borderColor} shadow={false} />
      ))}
    </group>
  );
}

/** Barrière / garde-corps industriel tubulaire jaune et noir de protection piétonne. */
export function SafetyGuardrail({ length = 1.6, height = 0.74, axis = 'x', ...rest }) {
  const posts = Math.max(2, Math.round(length / 1.4) + 1);
  return (
    <group {...rest}>
      {Array.from({ length: posts }, (_, i) => {
        const offset = -length / 2 + (i * length) / (posts - 1);
        const pos = axis === 'x' ? [offset, height / 2, 0] : [0, height / 2, offset];
        return (
          <group key={i} position={pos}>
            <Cylinder radius={0.038} height={height} color={PALETTE.safetyYellow} metal={0.45} rough={0.35} />
            <Cylinder position={[0, -height / 2 + 0.02, 0]} radius={0.075} height={0.04} color={PALETTE.safetyBlack} />
          </group>
        );
      })}
      <HazardBar
        position={[0, height - 0.04, 0]}
        axis={axis}
        length={length}
        segments={Math.max(4, Math.round(length * 4))}
        height={0.055}
        thickness={0.055}
      />
      <Box
        position={[0, height * 0.52, 0]}
        size={axis === 'x' ? [length, 0.045, 0.045] : [0.045, 0.045, length]}
        color={PALETTE.safetyYellow}
        metal={0.45}
        rough={0.35}
      />
    </group>
  );
}

/** Barre zébrée jaune / noir (garde-corps, butée, bord de quai). */
export function HazardBar({ length = 1, thickness = 0.06, height = 0.06, segments = 8, axis = 'x', ...rest }) {
  const seg = length / segments;
  return (
    <group {...rest}>
      {Array.from({ length: segments }, (_, i) => {
        const offset = -length / 2 + seg * (i + 0.5);
        const pos = axis === 'x' ? [offset, 0, 0] : [0, 0, offset];
        const size = axis === 'x' ? [seg, height, thickness] : [thickness, height, seg];
        return (
          <Box key={i} position={pos} size={size} color={i % 2 ? PALETTE.safetyBlack : PALETTE.safetyYellow} />
        );
      })}
    </group>
  );
}

/**
 * Panneau de signalisation sur poteau (pictogramme simplifié) :
 * warning (triangle jaune), mandatory (disque bleu), prohibition (disque cerclé rouge),
 * fire (carré rouge), firstaid (carré vert).
 */
export function SafetySign({ kind = 'warning', post = true, height = 1.05, size = 0.26, ...rest }) {
  return (
    <group {...rest}>
      {post && <Cylinder position={[0, height / 2, 0]} radius={0.018} height={height} color={PALETTE.darkSteel} metal={0.6} rough={0.4} />}
      <group position={[0, height + size * 0.45, 0.02]}>
        {kind === 'warning' && (
          <>
            <Cylinder rotation={[-Math.PI / 2, 0, 0]} radius={size * 0.62} height={0.012} segments={3} color={PALETTE.safetyBlack} />
            <Cylinder position={[0, -0.01, 0.008]} rotation={[-Math.PI / 2, 0, 0]} radius={size * 0.5} height={0.012} segments={3} color={PALETTE.safetyYellow} />
            <Box position={[0, 0.0, 0.016]} size={[0.025, size * 0.3, 0.004]} color={PALETTE.safetyBlack} />
          </>
        )}
        {kind === 'mandatory' && (
          <>
            <Cylinder rotation={[Math.PI / 2, 0, 0]} radius={size * 0.5} height={0.012} segments={20} color={PALETTE.mandatoryBlue} />
            <Ball position={[0, size * 0.12, 0.01]} radius={size * 0.1} color={PALETTE.white} shadow={false} />
            <Box position={[0, -size * 0.1, 0.01]} size={[size * 0.28, size * 0.22, 0.004]} color={PALETTE.white} shadow={false} />
          </>
        )}
        {kind === 'prohibition' && (
          <>
            <Cylinder rotation={[Math.PI / 2, 0, 0]} radius={size * 0.5} height={0.012} segments={20} color={PALETTE.fireRed} />
            <Cylinder position={[0, 0, 0.004]} rotation={[Math.PI / 2, 0, 0]} radius={size * 0.4} height={0.012} segments={20} color={PALETTE.white} />
            <Box position={[0, 0, 0.012]} rotation={[0, 0, Math.PI / 4]} size={[size * 0.8, 0.03, 0.004]} color={PALETTE.fireRed} shadow={false} />
          </>
        )}
        {(kind === 'fire' || kind === 'firstaid') && (
          <>
            <Box size={[size, size, 0.012]} color={kind === 'fire' ? PALETTE.fireRed : PALETTE.safetyGreen} />
            <Box position={[0, 0, 0.008]} size={[size * 0.55, size * 0.16, 0.004]} color={PALETTE.white} shadow={false} />
            <Box position={[0, 0, 0.008]} size={[size * 0.16, size * 0.55, 0.004]} color={PALETTE.white} shadow={false} />
          </>
        )}
      </group>
    </group>
  );
}

/** Extincteur sur support avec panneau rouge. */
export function Extinguisher({ withSign = true, ...rest }) {
  return (
    <group {...rest}>
      <Cylinder position={[0, 0.2, 0]} radius={0.055} height={0.32} top={0.95} color={PALETTE.fireRed} metal={0.3} rough={0.35} />
      <Ball position={[0, 0.37, 0]} radius={0.05} color={PALETTE.fireRed} metal={0.3} rough={0.35} />
      <Box position={[0, 0.43, 0]} size={[0.05, 0.04, 0.03]} color={PALETTE.rubber} />
      <Tube points={[[0.02, 0.42, 0], [0.08, 0.38, 0.02], [0.07, 0.12, 0.04]]} radius={0.01} />
      {withSign && <SafetySign kind="fire" post={false} height={0.75} size={0.16} />}
    </group>
  );
}

/** Potelet de protection jaune. */
export function Bollard({ height = 0.6, ...rest }) {
  return (
    <group {...rest}>
      <Cylinder position={[0, height / 2, 0]} radius={0.06} height={height} color={PALETTE.safetyYellow} metal={0.4} rough={0.4} />
      <Cylinder position={[0, height * 0.75, 0]} radius={0.062} height={0.06} color={PALETTE.safetyBlack} />
    </group>
  );
}

/** Douche de sécurité / lave-œil (poteau vert). */
export function SafetyShower(props) {
  return (
    <group {...props}>
      <Cylinder position={[0, 0.03, 0]} radius={0.16} height={0.06} color={PALETTE.safetyGreen} />
      <Cylinder position={[0, 0.8, 0]} radius={0.03} height={1.6} color={PALETTE.safetyGreen} metal={0.4} rough={0.4} />
      <Box position={[0.18, 1.58, 0]} size={[0.36, 0.035, 0.035]} color={PALETTE.safetyGreen} metal={0.4} />
      <Cylinder position={[0.36, 1.5, 0]} radius={0.12} height={0.08} top={1.6} color={PALETTE.safetyGreen} metal={0.4} />
      <Box position={[0.12, 0.62, 0]} size={[0.2, 0.06, 0.16]} color={PALETTE.safetyGreen} />
      <SafetySign kind="firstaid" post={false} height={1.1} size={0.14} position={[0, 0, 0.03]} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Mobilier de bureau                                                   */
/* ------------------------------------------------------------------ */

/** Bureau : l'utilisateur se tient côté +Z, le plan de travail est centré. */
export function Desk({ width = 1.07, depth = 0.53, top = '#d9c4a3', frame = PALETTE.darkSteel, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.48, 0]} size={[width, 0.035, depth]} color={top} rough={0.55} receive />
      <Box position={[-width / 2 + 0.04, 0.24, 0]} size={[0.035, 0.46, depth - 0.06]} color={frame} metal={0.5} rough={0.4} />
      <Box position={[width / 2 - 0.04, 0.24, 0]} size={[0.035, 0.46, depth - 0.06]} color={frame} metal={0.5} rough={0.4} />
      <Box position={[0, 0.3, -depth / 2 + 0.03]} size={[width - 0.1, 0.26, 0.02]} color={frame} metal={0.3} />
    </group>
  );
}

/** Écran d'ordinateur, face à +Z. */
export function Monitor({ width = 0.38, height = 0.22, screen = '#38bdf8', glow = 0.55, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.006, 0]} size={[0.14, 0.012, 0.1]} color={PALETTE.graphite} />
      <Box position={[0, 0.07, -0.02]} size={[0.025, 0.13, 0.025]} color={PALETTE.graphite} />
      <Box position={[0, 0.06 + height / 2, 0]} size={[width, height, 0.02]} color={PALETTE.rubber} metal={0.3} rough={0.4} />
      <Box position={[0, 0.06 + height / 2, 0.011]} size={[width - 0.025, height - 0.025, 0.004]} color={screen} glow={glow} shadow={false} />
    </group>
  );
}

/** Clavier + souris posés sur le plan de travail. */
export function Keyboard(props) {
  return (
    <group {...props}>
      <Box size={[0.26, 0.012, 0.08]} color={PALETTE.graphite} shadow={false} />
      <Box position={[0.19, 0, 0.01]} size={[0.035, 0.014, 0.055]} color={PALETTE.graphite} shadow={false} />
    </group>
  );
}

/** Fauteuil de bureau à piètement étoile, assise orientée vers -Z. */
export function OfficeChair({ color = '#334155', ...rest }) {
  return (
    <group {...rest}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Box key={i} position={[Math.sin((i * Math.PI * 2) / 5) * 0.09, 0.03, Math.cos((i * Math.PI * 2) / 5) * 0.09]} rotation={[0, (i * Math.PI * 2) / 5, 0]} size={[0.025, 0.025, 0.2]} color={PALETTE.rubber} shadow={false} />
      ))}
      <Cylinder position={[0, 0.17, 0]} radius={0.02} height={0.26} color={PALETTE.darkSteel} metal={0.7} rough={0.3} />
      <Box position={[0, 0.31, 0]} size={[0.32, 0.05, 0.3]} color={color} rough={0.8} />
      <Box position={[0, 0.52, 0.15]} rotation={[-0.12, 0, 0]} size={[0.3, 0.36, 0.04]} color={color} rough={0.8} />
      <Box position={[-0.17, 0.4, 0.02]} size={[0.03, 0.03, 0.18]} color={PALETTE.rubber} />
      <Box position={[0.17, 0.4, 0.02]} size={[0.03, 0.03, 0.18]} color={PALETTE.rubber} />
    </group>
  );
}

/** Poste de travail complet : bureau + écran(s) + clavier + fauteuil. */
export function Workstation({ screens = 1, screen = '#38bdf8', chair = '#334155', top, ...rest }) {
  const offsets = screens === 1 ? [0] : screens === 2 ? [-0.2, 0.2] : [-0.38, 0, 0.38];
  return (
    <group {...rest}>
      <Desk top={top} width={screens > 2 ? 1.3 : 1.07} />
      {offsets.map((x, i) => (
        <Monitor key={i} position={[x, 0.5, -0.12]} rotation={[0, x === 0 ? 0 : -x * 0.9, 0]} screen={screen} />
      ))}
      <Keyboard position={[0, 0.505, 0.1]} />
      <OfficeChair position={[0, 0, 0.45]} color={chair} />
    </group>
  );
}

export function FilingCabinet({ drawers = 4, color = '#cbd5e1', ...rest }) {
  const h = 0.87;
  return (
    <group {...rest}>
      <Box position={[0, h / 2, 0]} size={[0.5, h, 0.32]} color={color} metal={0.4} rough={0.45} />
      {Array.from({ length: drawers }, (_, i) => (
        <Box key={i} position={[0, (h / drawers) * (i + 0.5), 0.163]} size={[0.16, 0.02, 0.012]} color={PALETTE.darkSteel} shadow={false} />
      ))}
    </group>
  );
}

export function Plant({ size = 1, ...rest }) {
  return (
    <group {...rest} scale={[size, size, size]}>
      <Cylinder position={[0, 0.13, 0]} radius={0.11} height={0.26} top={1.25} color="#e7e5e4" rough={0.8} />
      <Ball position={[0, 0.42, 0]} radius={0.2} shape="icosa" color="#15803d" flat />
      <Ball position={[0.08, 0.58, -0.04]} radius={0.14} shape="icosa" color="#16a34a" flat />
      <Ball position={[-0.07, 0.55, 0.06]} radius={0.12} shape="icosa" color="#22c55e" flat />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Logistique : palettes, cartons, racks, fûts                         */
/* ------------------------------------------------------------------ */

export function Pallet({ color = '#b08355', ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, 0.088, 0]} size={[0.8, 0.025, 0.53]} color={color} rough={0.9} />
      {[-0.35, 0, 0.35].map((x) => (
        <Box key={x} position={[x, 0.04, 0]} size={[0.09, 0.07, 0.53]} color={color} rough={0.9} />
      ))}
    </group>
  );
}

/** Palette chargée : cartons filmés (hauteur variable). `simple` = 2 maillages (racks de grande taille). */
export function LoadedPallet({ load = 0.55, color = PALETTE.carton, film = true, simple = false, ...rest }) {
  if (simple) {
    return (
      <group {...rest}>
        <Box position={[0, 0.05, 0]} size={[0.8, 0.1, 0.53]} color="#b08355" rough={0.9} shadow={false} />
        <Box position={[0, 0.1 + load / 2, 0]} size={[0.76, load, 0.5]} color={color} rough={0.85} />
      </group>
    );
  }
  return (
    <group {...rest}>
      <Pallet />
      <Box position={[0, 0.1 + load / 2, 0]} size={[0.76, load, 0.5]} color={color} rough={0.85} />
      <Box position={[0, 0.1 + load / 2, 0]} size={[0.77, 0.035, 0.51]} color="#e8d5b0" rough={0.9} shadow={false} />
      {film && <Box position={[0, 0.1 + load / 2, 0]} size={[0.79, load + 0.02, 0.53]} color="#e0f2fe" opacity={0.18} shadow={false} />}
    </group>
  );
}

export function Carton({ size = [0.3, 0.22, 0.25], color = PALETTE.carton, ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0, size[1] / 2, 0]} size={size} color={color} rough={0.85} />
      <Box position={[0, size[1] + 0.002, 0]} size={[size[0] + 0.004, 0.006, 0.05]} color="#e8d5b0" shadow={false} />
    </group>
  );
}

/** Rack à palettes (échelles bleues, lisses orange) — longueur selon X. */
export function PalletRack({ bays = 2, levels = 2, bayWidth = 0.95, depth = 0.6, levelHeight = 0.72, seed = 1, simple = false, ...rest }) {
  const width = bays * bayWidth;
  const height = levels * levelHeight + 0.15;
  return (
    <group {...rest}>
      {Array.from({ length: bays + 1 }, (_, i) => {
        const x = -width / 2 + i * bayWidth;
        return (
          <group key={`u${i}`} position={[x, 0, 0]}>
            <Box position={[0, height / 2, -depth / 2]} size={[0.05, height, 0.05]} color={PALETTE.rackBlue} metal={0.5} rough={0.4} />
            <Box position={[0, height / 2, depth / 2]} size={[0.05, height, 0.05]} color={PALETTE.rackBlue} metal={0.5} rough={0.4} />
            <Box position={[0, height * 0.35, 0]} rotation={[0.9, 0, 0]} size={[0.02, 0.02, depth * 1.2]} color={PALETTE.rackBlue} shadow={false} />
          </group>
        );
      })}
      {Array.from({ length: levels }, (_, l) => {
        const y = 0.12 + l * levelHeight;
        return (
          <group key={`l${l}`}>
            {l > 0 && (
              <>
                <Box position={[0, y, -depth / 2]} size={[width, 0.07, 0.04]} color={PALETTE.rackOrange} metal={0.4} rough={0.4} />
                <Box position={[0, y, depth / 2]} size={[width, 0.07, 0.04]} color={PALETTE.rackOrange} metal={0.4} rough={0.4} />
              </>
            )}
            {Array.from({ length: bays }, (_, b) => {
              if (seeded(seed * 31 + l * 7 + b) < 0.18) return null;
              const loadH = 0.3 + seeded(seed * 17 + l * 3 + b) * 0.3;
              const tint = ['#c08a4f', '#b7794a', '#d1a066', '#9ca3af'][Math.floor(seeded(seed + l + b * 5) * 4)];
              return (
                <LoadedPallet
                  key={b}
                  position={[-width / 2 + bayWidth * (b + 0.5), l === 0 ? 0 : y + 0.035, 0]}
                  rotation={[0, Math.PI / 2, 0]}
                  scale={[0.95, 1, 1]}
                  load={Math.min(loadH, levelHeight - 0.2)}
                  color={tint}
                  simple={simple}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

export function Barrel({ color = '#2563eb', ...rest }) {
  return (
    <group {...rest}>
      <Cylinder position={[0, 0.29, 0]} radius={0.2} height={0.58} color={color} metal={0.45} rough={0.4} />
      <Cylinder position={[0, 0.2, 0]} radius={0.205} height={0.02} color={color} metal={0.6} rough={0.3} />
      <Cylinder position={[0, 0.4, 0]} radius={0.205} height={0.02} color={color} metal={0.6} rough={0.3} />
      <Cylinder position={[0.08, 0.59, 0.05]} radius={0.025} height={0.02} color={PALETTE.darkSteel} />
    </group>
  );
}

export function GasBottle({ color = '#64748b', cap = '#16a34a', ...rest }) {
  return (
    <group {...rest}>
      <Cylinder position={[0, 0.42, 0]} radius={0.075} height={0.84} color={color} metal={0.4} rough={0.4} />
      <Ball position={[0, 0.84, 0]} radius={0.075} color={cap} metal={0.3} rough={0.4} />
      <Cylinder position={[0, 0.93, 0]} radius={0.02} height={0.08} color={PALETTE.steel} metal={0.8} rough={0.25} />
    </group>
  );
}

/** Conteneur GRV / IBC 1000 L (cuve blanche en cage acier). */
export function IBCTank({ liquid = '#f8fafc', ...rest }) {
  const w = 0.8;
  const d = 0.66;
  const h = 0.76;
  return (
    <group {...rest}>
      <Box position={[0, 0.06, 0]} size={[w, 0.12, d]} color={PALETTE.darkSteel} metal={0.5} rough={0.5} />
      <Box position={[0, 0.12 + h / 2, 0]} size={[w - 0.06, h - 0.04, d - 0.06]} color={liquid} rough={0.35} opacity={0.88} />
      {[-w / 2, -w / 6, w / 6, w / 2].map((x) => (
        <Box key={`v${x}`} position={[x, 0.12 + h / 2, d / 2]} size={[0.02, h, 0.02]} color={PALETTE.steel} metal={0.8} rough={0.3} shadow={false} />
      ))}
      {[0.3, 0.6, 0.88].map((y) => (
        <Box key={`h${y}`} position={[0, y, d / 2]} size={[w, 0.02, 0.02]} color={PALETTE.steel} metal={0.8} rough={0.3} shadow={false} />
      ))}
      <Box position={[0, 0.12 + h, 0]} size={[w, 0.02, d]} color={PALETTE.steel} metal={0.8} rough={0.3} shadow={false} />
      <Cylinder position={[0, 0.92, 0]} radius={0.08} height={0.05} color="#0f172a" />
      <Box position={[0, 0.18, d / 2 + 0.04]} size={[0.08, 0.06, 0.08]} color="#0f172a" />
    </group>
  );
}

/** Transpalette manuel (fourches vers +X). */
export function PalletJack({ color = '#dc2626', ...rest }) {
  return (
    <group {...rest}>
      <Box position={[0.35, 0.05, 0.13]} size={[0.75, 0.05, 0.11]} color={PALETTE.graphite} metal={0.5} />
      <Box position={[0.35, 0.05, -0.13]} size={[0.75, 0.05, 0.11]} color={PALETTE.graphite} metal={0.5} />
      <Box position={[-0.08, 0.18, 0]} size={[0.16, 0.3, 0.42]} color={color} metal={0.4} rough={0.4} />
      <Cylinder position={[-0.1, 0.4, 0]} radius={0.04} height={0.2} color={PALETTE.darkSteel} metal={0.7} />
      <Box position={[-0.3, 0.68, 0]} rotation={[0, 0, 0.45]} size={[0.04, 0.72, 0.04]} color={PALETTE.graphite} />
      <Box position={[-0.46, 1.0, 0]} size={[0.05, 0.05, 0.28]} color={PALETTE.rubber} />
      <Wheel position={[-0.12, 0.07, 0.12]} radius={0.07} width={0.05} />
      <Wheel position={[-0.12, 0.07, -0.12]} radius={0.07} width={0.05} />
    </group>
  );
}

/** Étagère métallique à `levels` niveaux (longueur selon X), chargée de cartons. */
export function Shelving({ width = 1.2, depth = 0.4, height = 1.25, levels = 3, seed = 3, color = '#94a3b8', ...rest }) {
  const gap = (height - 0.08) / levels;
  return (
    <group {...rest}>
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
        <Box key={`${sx}${sz}`} position={[(sx * width) / 2, height / 2, (sz * depth) / 2]} size={[0.035, height, 0.035]} color={color} metal={0.6} rough={0.4} />
      ))}
      {Array.from({ length: levels + 1 }, (_, l) => (
        <Box key={`s${l}`} position={[0, 0.06 + l * gap, 0]} size={[width, 0.025, depth]} color={color} metal={0.5} rough={0.45} />
      ))}
      {Array.from({ length: levels }, (_, l) =>
        [-0.33, 0, 0.33].map((fx, i) => {
          if (seeded(seed * 13 + l * 5 + i) < 0.25) return null;
          const h = 0.12 + seeded(seed + l * 9 + i) * (gap - 0.2);
          return (
            <Carton
              key={`c${l}${i}`}
              position={[fx * width, 0.075 + l * gap, 0]}
              size={[width * 0.28, h, depth * 0.8]}
              color={['#c08a4f', '#b7794a', '#d1a066'][i]}
            />
          );
        })
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Véhicules                                                            */
/* ------------------------------------------------------------------ */

/** Roue (axe selon Z). */
export function Wheel({ radius = 0.2, width = 0.14, hub = PALETTE.steel, ...rest }) {
  return (
    <group {...rest}>
      <Cylinder rotation={[Math.PI / 2, 0, 0]} radius={radius} height={width} segments={18} color={PALETTE.rubber} rough={0.9} />
      <Cylinder rotation={[Math.PI / 2, 0, 0]} radius={radius * 0.55} height={width + 0.01} segments={12} color={hub} metal={0.7} rough={0.3} />
    </group>
  );
}

/** Voiture de société (avant vers +X). */
export function Car({ color = '#2563eb', ...rest }) {
  return (
    <group {...rest}>
      <Profile
        points={[[-1.3, 0.16], [1.3, 0.16], [1.32, 0.42], [1.2, 0.56], [0.55, 0.62], [-1.12, 0.66], [-1.3, 0.56]]}
        depth={1.05}
        bevel={0.03}
        color={color}
        metal={0.55}
        rough={0.3}
      />
      <Profile points={[[0.6, 0.6], [0.16, 0.95], [-0.72, 0.97], [-1.15, 0.64]]} depth={0.98} color="#0b1220" metal={0.85} rough={0.12} />
      <Box position={[-0.27, 0.985, 0]} size={[0.92, 0.03, 0.98]} color={color} metal={0.55} rough={0.3} />
      <Box position={[-0.22, 0.8, 0]} size={[0.05, 0.32, 1.0]} color={color} metal={0.55} rough={0.3} />
      {[[0.85, 0.5], [0.85, -0.5], [-0.82, 0.5], [-0.82, -0.5]].map(([x, z]) => (
        <Wheel key={`${x}${z}`} position={[x, 0.2, z]} radius={0.2} width={0.12} />
      ))}
      <Box position={[1.33, 0.44, 0.36]} size={[0.02, 0.06, 0.18]} color="#fef9c3" glow={1.4} shadow={false} />
      <Box position={[1.33, 0.44, -0.36]} size={[0.02, 0.06, 0.18]} color="#fef9c3" glow={1.4} shadow={false} />
      <Box position={[-1.31, 0.5, 0.38]} size={[0.02, 0.06, 0.16]} color="#ef4444" glow={1.2} shadow={false} />
      <Box position={[-1.31, 0.5, -0.38]} size={[0.02, 0.06, 0.16]} color="#ef4444" glow={1.2} shadow={false} />
    </group>
  );
}

/** Fourgon utilitaire (avant vers +X). */
export function Van({ color = '#f8fafc', stripe = '#2563eb', ...rest }) {
  return (
    <group {...rest}>
      <Profile
        points={[[-1.6, 0.18], [1.6, 0.18], [1.62, 0.6], [1.45, 0.74], [1.02, 0.8], [0.7, 1.32], [-1.6, 1.36]]}
        depth={1.2}
        bevel={0.03}
        color={color}
        metal={0.35}
        rough={0.4}
      />
      <Box position={[0.87, 1.066, 0]} rotation={[0, 0, -1.02]} size={[0.56, 0.02, 1.12]} color="#0b1220" metal={0.85} rough={0.12} />
      <Box position={[0.62, 0.98, 0.615]} size={[0.44, 0.3, 0.01]} color="#0b1220" metal={0.85} rough={0.12} />
      <Box position={[0.62, 0.98, -0.615]} size={[0.44, 0.3, 0.01]} color="#0b1220" metal={0.85} rough={0.12} />
      <Box position={[-0.4, 0.62, 0.616]} size={[2.2, 0.12, 0.01]} color={stripe} glow={0.15} shadow={false} />
      <Box position={[-0.4, 0.62, -0.616]} size={[2.2, 0.12, 0.01]} color={stripe} glow={0.15} shadow={false} />
      <Box position={[0.05, 0.75, 0.616]} size={[0.015, 0.95, 0.01]} color="#94a3b8" shadow={false} />
      {[[1.0, 0.56], [1.0, -0.56], [-1.05, 0.56], [-1.05, -0.56]].map(([x, z]) => (
        <Wheel key={`${x}${z}`} position={[x, 0.22, z]} radius={0.22} width={0.14} />
      ))}
      <Box position={[1.63, 0.5, 0.42]} size={[0.02, 0.07, 0.2]} color="#fef9c3" glow={1.4} shadow={false} />
      <Box position={[1.63, 0.5, -0.42]} size={[0.02, 0.07, 0.2]} color="#fef9c3" glow={1.4} shadow={false} />
      <Box position={[-1.61, 0.55, 0.5]} size={[0.02, 0.18, 0.08]} color="#ef4444" glow={1.2} shadow={false} />
      <Box position={[-1.61, 0.55, -0.5]} size={[0.02, 0.18, 0.08]} color="#ef4444" glow={1.2} shadow={false} />
    </group>
  );
}

/**
 * Chariot élévateur frontal (fourches vers +X).
 * `carriageRef` permet d'animer la levée du tablier porte-fourches.
 */
export function Forklift({ color = '#f59e0b', carriageRef, beaconRef, payload = true, ...rest }) {
  return (
    <group {...rest}>
      {/* Châssis & contrepoids */}
      <Box position={[-0.05, 0.3, 0]} size={[1.0, 0.32, 0.72]} color={color} metal={0.35} rough={0.4} />
      <Box position={[-0.5, 0.42, 0]} size={[0.24, 0.5, 0.74]} color={PALETTE.graphite} metal={0.5} rough={0.5} />
      <Box position={[0.1, 0.5, 0]} size={[0.5, 0.1, 0.6]} color={color} metal={0.35} rough={0.4} />
      {/* Siège & volant */}
      <Box position={[-0.12, 0.62, 0]} size={[0.24, 0.07, 0.3]} color={PALETTE.rubber} />
      <Box position={[-0.24, 0.78, 0]} size={[0.06, 0.28, 0.3]} color={PALETTE.rubber} />
      <Cylinder position={[0.2, 0.86, 0]} rotation={[0, 0, 0.9]} radius={0.09} height={0.02} color={PALETTE.rubber} />
      <Box position={[0.26, 0.7, 0]} rotation={[0, 0, 0.5]} size={[0.04, 0.28, 0.04]} color={PALETTE.graphite} />
      {/* Toit protège-conducteur */}
      {[[-0.38, 0.33], [-0.38, -0.33], [0.3, 0.33], [0.3, -0.33]].map(([x, z]) => (
        <Box key={`p${x}${z}`} position={[x, 0.98, z]} size={[0.05, 0.98, 0.05]} color={PALETTE.graphite} metal={0.5} rough={0.4} />
      ))}
      <Box position={[-0.04, 1.48, 0]} size={[0.78, 0.04, 0.72]} color={PALETTE.graphite} metal={0.5} rough={0.4} />
      {[-0.2, 0, 0.2].map((x) => (
        <Box key={`g${x}`} position={[x, 1.47, 0]} size={[0.03, 0.03, 0.7]} color={color} shadow={false} />
      ))}
      <group ref={beaconRef} userData={DYNAMIC} position={[-0.3, 1.55, 0.25]}>
        <Cylinder radius={0.045} height={0.08} color="#f97316" glow={1.6} shadow={false} />
      </group>
      {/* Mât */}
      <Box position={[0.5, 0.85, 0.22]} size={[0.07, 1.5, 0.07]} color={PALETTE.darkSteel} metal={0.6} rough={0.35} />
      <Box position={[0.5, 0.85, -0.22]} size={[0.07, 1.5, 0.07]} color={PALETTE.darkSteel} metal={0.6} rough={0.35} />
      <Box position={[0.5, 1.58, 0]} size={[0.07, 0.06, 0.5]} color={PALETTE.darkSteel} metal={0.6} rough={0.35} />
      {/* Tablier + fourches (animables) */}
      <group ref={carriageRef} userData={DYNAMIC} position={[0.57, 0, 0]}>
        <Box position={[0, 0.3, 0]} size={[0.05, 0.36, 0.56]} color={PALETTE.graphite} metal={0.5} />
        <Box position={[0.38, 0.13, 0.15]} size={[0.75, 0.035, 0.08]} color={PALETTE.graphite} metal={0.6} rough={0.35} />
        <Box position={[0.38, 0.13, -0.15]} size={[0.75, 0.035, 0.08]} color={PALETTE.graphite} metal={0.6} rough={0.35} />
        {payload && <LoadedPallet position={[0.42, 0.15, 0]} scale={[0.95, 0.9, 1]} load={0.42} color="#b7794a" />}
      </group>
      {/* Roues */}
      <Wheel position={[0.32, 0.17, 0.36]} radius={0.17} width={0.14} hub="#f59e0b" />
      <Wheel position={[0.32, 0.17, -0.36]} radius={0.17} width={0.14} hub="#f59e0b" />
      <Wheel position={[-0.42, 0.13, 0.32]} radius={0.13} width={0.12} hub="#f59e0b" />
      <Wheel position={[-0.42, 0.13, -0.32]} radius={0.13} width={0.12} hub="#f59e0b" />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Décor extérieur                                                      */
/* ------------------------------------------------------------------ */

export function Tree({ variant = 'round', size = 1, ...rest }) {
  return (
    <group {...rest} scale={[size, size, size]}>
      <Cylinder position={[0, 0.45, 0]} radius={0.09} height={0.9} top={0.7} color="#6b4f3a" rough={0.9} />
      {variant === 'conifer' ? (
        <>
          <Cylinder position={[0, 1.2, 0]} radius={0.75} height={1.1} top={0} segments={7} color="#166534" flat />
          <Cylinder position={[0, 1.75, 0]} radius={0.58} height={0.95} top={0} segments={7} color="#15803d" flat />
          <Cylinder position={[0, 2.25, 0]} radius={0.4} height={0.8} top={0} segments={7} color="#16a34a" flat />
        </>
      ) : (
        <>
          <Ball position={[0, 1.45, 0]} radius={0.72} shape="dodeca" color="#15803d" flat />
          <Ball position={[0.38, 1.25, 0.2]} radius={0.45} shape="dodeca" color="#16a34a" flat />
          <Ball position={[-0.32, 1.3, -0.22]} radius={0.48} shape="dodeca" color="#166534" flat />
        </>
      )}
    </group>
  );
}

/** Lampadaire (bras orienté vers +X). */
export function StreetLamp({ height = 3.2, ...rest }) {
  return (
    <group {...rest}>
      <Cylinder position={[0, height / 2, 0]} radius={0.05} height={height} top={0.7} color="#334155" metal={0.6} rough={0.4} />
      <Box position={[0.35, height, 0]} size={[0.7, 0.05, 0.05]} color="#334155" metal={0.6} rough={0.4} />
      <Box position={[0.68, height - 0.04, 0]} size={[0.32, 0.07, 0.16]} color="#1f2937" metal={0.5} />
      <Box position={[0.68, height - 0.085, 0]} size={[0.28, 0.02, 0.13]} color="#fde68a" glow={2.2} shadow={false} />
    </group>
  );
}

export function Bench(props) {
  return (
    <group {...props}>
      <Box position={[0, 0.3, 0]} size={[1.1, 0.04, 0.3]} color={PALETTE.wood} rough={0.8} />
      <Box position={[0, 0.5, -0.14]} rotation={[0.2, 0, 0]} size={[1.1, 0.24, 0.03]} color={PALETTE.wood} rough={0.8} />
      <Box position={[-0.45, 0.15, 0]} size={[0.05, 0.3, 0.3]} color="#334155" metal={0.6} />
      <Box position={[0.45, 0.15, 0]} size={[0.05, 0.3, 0.3]} color="#334155" metal={0.6} />
    </group>
  );
}
