import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import MergeStatic from './models/MergeStatic';
import { Ball, seeded, DYNAMIC } from './models/kit';

/**
 * Ciel de jour : dégradé du bleu du zénith à la brume claire de l'horizon (couleur du brouillard, pour
 * que le terrain lointain s'y fonde), halo du soleil dans la direction de l'éclairage, et nuages
 * low-poly qui dérivent lentement autour du site, hors de la vue plongeante sur les bâtiments.
 */

export const SKY_HORIZON = '#d4e3ef';
const SKY_ZENITH = '#4a90d9';
const SUN_GLOW = '#fff4d6';

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w; // toujours au plan lointain, derrière toute la scène
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 horizon;
  uniform vec3 zenith;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  varying vec3 vWorld;
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = max(dir.y, 0.0);
    vec3 color = mix(horizon, zenith, pow(h, 0.55));
    float sun = max(dot(dir, sunDirection), 0.0);
    color += sunColor * (pow(sun, 900.0) * 1.2 + pow(sun, 24.0) * 0.18);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Nuages : grappes de boules facettées aplaties, en couronne autour du site (positions stables). */
function cloudLayout(site, scale) {
  const [cx, cz] = site?.center || [0, 0];
  const inner = (site?.radius || 45) + 30 * scale;
  return Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2 + seeded(i * 3.7) * 0.3;
    const distance = inner + seeded(i * 5.3) * 60 * scale;
    const puffs = 3 + Math.floor(seeded(i * 7.1) * 3);
    return {
      position: [cx + Math.cos(angle) * distance, (34 + seeded(i * 2.9) * 22) * scale, cz + Math.sin(angle) * distance],
      rotation: seeded(i * 1.3) * Math.PI,
      size: (2.6 + seeded(i * 9.1) * 2.4) * scale,
      puffs: Array.from({ length: puffs }, (__, k) => [(k - (puffs - 1) / 2) * 1.5, seeded(i * 11 + k) * 0.5, (seeded(i * 13 + k) - 0.5) * 1.6]),
    };
  });
}

export default function SkyDome({ site, scale = 1, sunDirection = [28, 42, 24] }) {
  const domeRef = useRef();
  const cloudsRef = useRef();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          horizon: { value: new THREE.Color(SKY_HORIZON) },
          zenith: { value: new THREE.Color(SKY_ZENITH) },
          sunColor: { value: new THREE.Color(SUN_GLOW) },
          sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const clouds = useMemo(() => cloudLayout(site, scale), [site, scale]);
  const [cx, cz] = site?.center || [0, 0];

  useFrame(({ camera, clock }) => {
    domeRef.current?.position.copy(camera.position);
    if (cloudsRef.current) cloudsRef.current.rotation.y = clock.getElapsedTime() * 0.004;
  });

  return (
    <>
      <mesh ref={domeRef} material={material} frustumCulled={false} renderOrder={-1} raycast={() => null} userData={{ noCollide: true }}>
        <sphereGeometry args={[100, 32, 16]} />
      </mesh>
      {/* Nuages en rotation lente autour du centre du site */}
      <group position={[cx, 0, cz]}>
        <group ref={cloudsRef} userData={{ ...DYNAMIC, noCollide: true }}>
          <MergeStatic deps={[clouds]}>
            {clouds.map((c, i) => (
              <group key={i} position={[c.position[0] - cx, c.position[1], c.position[2] - cz]} rotation={[0, c.rotation, 0]} scale={c.size}>
                {c.puffs.map(([x, y, z], k) => {
                  const d = 1.8 + seeded(i + k * 3) * 1.0; // diamètre de la boule
                  return <Ball key={k} position={[x, y, z]} scale={[d, d * 0.55, d * 0.8]} shape="icosa" color="#f8fafc" rough={1} flat shadow={false} />;
                })}
              </group>
            ))}
          </MergeStatic>
        </group>
      </group>
    </>
  );
}
