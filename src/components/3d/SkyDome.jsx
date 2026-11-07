import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Ciel de jour : dégradé du bleu du zénith à la brume claire de l'horizon (couleur du brouillard, pour
 * que le terrain lointain s'y fonde), halo du soleil dans la direction de l'éclairage, et nuages doux peints
 * dans le dôme (bruit fractal projeté sur une couche nuageuse : bords vaporeux, sommets éclairés côté soleil,
 * bases grisées), qui dérivent lentement et s'estompent vers l'horizon.
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
  uniform float time;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int k = 0; k < 6; k++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = max(dir.y, 0.0);
    vec3 color = mix(horizon, zenith, pow(h, 0.55));
    float sun = max(dot(dir, sunDirection), 0.0);
    // Couche nuageuse : direction projetée sur un plan haut, dérive lente avec le vent
    if (dir.y > 0.0) {
      vec2 uv = dir.xz / (dir.y + 0.18) * 1.3 + vec2(time * 0.006, time * 0.0025);
      float n = fbm(uv);
      float detail = fbm(uv * 3.1 + 7.3);
      float cover = smoothstep(0.5, 0.74, n + 0.18 * detail);
      // Ombre propre : épaisseur relevée un peu vers le soleil (sommets clairs, bases grises)
      vec2 toSun = normalize(sunDirection.xz + vec2(1e-4)) * 0.09;
      float lit = clamp(0.7 + (n - fbm(uv + toSun)) * 3.0, 0.42, 1.08);
      vec3 cloud = mix(vec3(0.66, 0.71, 0.78), vec3(1.0, 0.985, 0.96), lit);
      cloud += sunColor * pow(sun, 8.0) * 0.25 * (1.0 - cover);
      float fade = smoothstep(0.03, 0.28, dir.y);
      color = mix(color, cloud, cover * fade * 0.94);
    }
    color += sunColor * (pow(sun, 900.0) * 1.2 + pow(sun, 24.0) * 0.18);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

// eslint-disable-next-line no-unused-vars
export default function SkyDome({ site, scale = 1, sunDirection = [28, 42, 24] }) {
  const domeRef = useRef();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          horizon: { value: new THREE.Color(SKY_HORIZON) },
          zenith: { value: new THREE.Color(SKY_ZENITH) },
          sunColor: { value: new THREE.Color(SUN_GLOW) },
          sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
          time: { value: 0 },
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useFrame(({ camera, clock }) => {
    domeRef.current?.position.copy(camera.position);
    material.uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <>
      <mesh ref={domeRef} material={material} frustumCulled={false} renderOrder={-1} raycast={() => null} userData={{ noCollide: true }}>
        <sphereGeometry args={[100, 32, 16]} />
      </mesh>
    </>
  );
}
