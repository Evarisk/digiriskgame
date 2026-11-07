import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

/**
 * Rendu réaliste de l'éditeur (post-traitement) : occlusion ambiante GTAO — coins de pièces, dessous des
 * meubles, pieds des personnages et jonctions mur / sol s'assombrissent, la scène perd son aspect plat —,
 * léger halo des sources lumineuses (lustres, lanternes, écrans) puis tonemapping et conversion sRGB.
 * Image calculée en demi-flottant multi-échantillonnée (anticrénelage conservé). Remplace le rendu
 * automatique de R3F tant qu'il est monté (priorité 1).
 */
export default function EditorPostFx() {
  const { gl, scene, camera, size } = useThree();

  const fx = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(size.width, size.height, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    // Occlusion à l'échelle d'une pièce (rayon ≈ 0,8 m), débruitée
    const ao = new GTAOPass(scene, camera, size.width, size.height);
    ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.4, thickness: 1.2, distanceFallOff: 1, scale: 1.1, samples: 12, screenSpaceRadius: false });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 12 });
    composer.addPass(ao);
    // Halo des seules sources très lumineuses (seuil au-dessus des façades en plein soleil)
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.28, 0.45, 2.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, ao, bloom, target };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    fx.composer.setPixelRatio(gl.getPixelRatio());
    fx.composer.setSize(size.width, size.height);
  }, [fx, gl, size.width, size.height]);

  useEffect(
    () => () => {
      fx.composer.dispose();
      fx.ao.dispose?.();
      fx.bloom.dispose?.();
      fx.target.dispose();
    },
    [fx]
  );

  useFrame(() => fx.composer.render(), 1);
  return null;
}
