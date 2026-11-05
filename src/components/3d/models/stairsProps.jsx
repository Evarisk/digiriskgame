import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Box, Cylinder, Ball, getMaterial } from './kit';

/**
 * Escaliers de l'éditeur de site : volée droite qui monte d'un niveau (2,5 unités ≈ 3,75 m), de l'avant
 * (+Z, première marche) vers l'arrière (−Z, arrivée à l'étage). Origine au sol, au centre de l'emprise.
 * Les marches sont un seul profil extrudé (aucune face confondue d'une marche à l'autre) ; rampe le long de
 * la volée et garde-corps autour de la trémie à l'étage (côtés et bout de la volée, l'arrivée restant libre).
 */

const LEVEL = 2.5;
const RISER = 0.115; // ≈ 17 cm
const RAIL = 0.62; // main courante ≈ 0,93 m au-dessus du nez des marches
const STONE = '#ebe3d1';
const IRON = '#1f2937';
const OAK = '#5b3a21';
const STEEL = '#94a3b8';
const GILT = '#c9a227';

/**
 * Volée en dents de scie extrudée sur `width` : massive (escalier maçonné) ou à sous-face inclinée d'épaisseur
 * `soffit`. `lift` décale le profil vers l'avant et vers le haut (tapis d'escalier posé sur les marches).
 */
function stepsGeometry(width, length, rise, count, { lift = 0, soffit = 0 } = {}) {
  const d = length / count;
  const h = rise / count;
  const shape = new THREE.Shape();
  shape.moveTo(length / 2 + lift, lift);
  for (let i = 0; i < count; i += 1) {
    const s = length / 2 - i * d + lift;
    shape.lineTo(s, (i + 1) * h + lift);
    shape.lineTo(s - d, (i + 1) * h + lift);
  }
  if (soffit) {
    // Sous-face parallèle à la ligne des nez de marche, `soffit` sous les angles rentrants
    shape.lineTo(-length / 2 + lift, rise - soffit + lift);
    shape.lineTo(length / 2 - (soffit * length) / rise + lift, lift);
  } else {
    shape.lineTo(-length / 2 + lift, lift);
  }
  shape.closePath();
  // Profil dans le plan (z, y) extrudé le long de X, centré sur la largeur
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  return geometry;
}

function useStepsGeometry(enabled, width, length, rise, count, options) {
  const { lift = 0, soffit = 0 } = options;
  const geometry = useMemo(
    () => (enabled ? stepsGeometry(width, length, rise, count, { lift, soffit }) : null),
    [enabled, width, length, rise, count, lift, soffit]
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

/** Garde-corps droit de `from` à `to` (repère de l'escalier), posé à la hauteur `y`. */
function Balustrade({ from, to, y, grand, posts = true }) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const angle = Math.atan2(to[0] - from[0], to[1] - from[1]);
  const count = Math.max(1, Math.round(length / 0.3));
  const metal = grand ? IRON : STEEL;
  return (
    <group position={[from[0], y, from[1]]} rotation={[0, angle, 0]}>
      <Box size={[0.06, 0.05, length]} position={[0, RAIL, length / 2]} color={grand ? OAK : STEEL} rough={0.5} metal={grand ? 0.1 : 0.6} />
      <Box size={[0.025, 0.025, length]} position={[0, 0.09, length / 2]} color={metal} metal={0.5} rough={0.5} />
      {posts &&
        Array.from({ length: count }, (_, i) => (
          <Cylinder key={i} radius={grand ? 0.011 : 0.014} height={RAIL + 0.01} position={[0, (RAIL - 0.01) / 2, ((i + 0.5) * length) / count]} color={metal} metal={0.5} rough={0.5} />
        ))}
    </group>
  );
}

/**
 * Escalier droit : `grand` = escalier d'honneur en pierre (tapis `color`, rampe en fer forgé, main courante en
 * chêne, pilastres de départ) ; sinon escalier en béton (`color`) à rampe métallique. `guard` : garde-corps de
 * la trémie à l'étage (masqué quand l'étage n'est pas affiché).
 */
export function Stairs({ width = 0.8, length = 4.2, grand = false, color = '#b9b4aa', guard = true }) {
  const rise = LEVEL;
  const count = Math.max(6, Math.round(rise / RISER));
  const d = length / count;
  const h = rise / count;
  const slope = Math.atan2(rise, length);
  const span = Math.hypot(length, rise);
  const steps = useStepsGeometry(true, width, length, rise, count, { soffit: grand ? 0 : 0.28 });
  const runner = useStepsGeometry(grand, width * 0.62, length, rise, count, { lift: 0.012 });
  const stone = getMaterial({ color: grand ? STONE : color, roughness: 0.85, metalness: 0.05 });
  const carpet = getMaterial({ color, roughness: 0.95, metalness: 0 });
  const railMetal = grand ? IRON : STEEL;
  const gx = width / 2 + 0.07;
  const gz = length / 2 + 0.07;
  const endPosts = Math.max(1, Math.round((2 * gx) / 0.3) - 1);

  return (
    <group>
      <mesh geometry={steps} material={stone} castShadow receiveShadow />
      {runner && <mesh geometry={runner} material={carpet} receiveShadow />}

      {[-1, 1].map((side) => {
        const x = side * (width / 2 - 0.05);
        return (
          <group key={side}>
            {/* Main courante et lisse basse, parallèles à la volée */}
            <Box size={[0.07, 0.05, span]} position={[x, rise / 2 + h / 2 + RAIL, 0]} rotation={[slope, 0, 0]} color={grand ? OAK : STEEL} rough={0.5} metal={grand ? 0.1 : 0.6} />
            <Box size={[0.03, 0.03, span]} position={[x, rise / 2 + h / 2 + 0.1, 0]} rotation={[slope, 0, 0]} color={railMetal} metal={0.5} rough={0.5} />
            {/* Barreaux : un par marche (fer forgé) ou un toutes les quatre marches (tubes) */}
            {Array.from({ length: count }, (_, i) => i)
              .filter((i) => (grand ? i > 0 : i % 4 === 0 || i === count - 1))
              .map((i) => {
                const z = length / 2 - (i + 0.5) * d;
                const y0 = (i + 1) * h;
                return <Cylinder key={i} radius={grand ? 0.012 : 0.016} height={RAIL} position={[x, y0 + RAIL / 2, z]} color={railMetal} metal={0.5} rough={0.5} />;
              })}
            {grand && (
              <>
                {/* Pilastre de départ en pierre et pomme dorée */}
                <Box size={[0.14, RAIL + 0.22, 0.14]} position={[x, h + (RAIL + 0.22) / 2, length / 2 - d / 2]} color={STONE} rough={0.8} />
                <Ball radius={0.07} position={[x, h + RAIL + 0.29, length / 2 - d / 2]} color={GILT} metal={0.8} rough={0.3} />
              </>
            )}
          </group>
        );
      })}

      {/* Trémie à l'étage : garde-corps sur les deux côtés et au bout de la volée (l'arrivée, côté −Z, reste libre) */}
      {guard && (
        <group>
          <Balustrade from={[-gx, -length / 2]} to={[-gx, gz]} y={rise} grand={grand} />
          <Balustrade from={[gx, -length / 2]} to={[gx, gz]} y={rise} grand={grand} />
          {/* Lisses du bout arrêtées dans l'axe des côtés (pas de faces confondues aux angles) */}
          <group position={[0, rise, gz]}>
            <Box size={[2 * gx, 0.044, 0.056]} position={[0, RAIL, 0]} color={grand ? OAK : STEEL} rough={0.5} metal={grand ? 0.1 : 0.6} />
            <Box size={[2 * gx, 0.022, 0.022]} position={[0, 0.09, 0]} color={railMetal} metal={0.5} rough={0.5} />
            {Array.from({ length: endPosts }, (_, i) => (
              <Cylinder
                key={i}
                radius={grand ? 0.011 : 0.014}
                height={RAIL + 0.01}
                position={[-gx + ((i + 1) * 2 * gx) / (endPosts + 1), (RAIL - 0.01) / 2, 0]}
                color={railMetal}
                metal={0.5}
                rough={0.5}
              />
            ))}
          </group>
        </group>
      )}
    </group>
  );
}
