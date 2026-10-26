import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, Ball, Tree, StreetLamp, Bench, SafetySign, seeded, PALETTE, DYNAMIC } from './models/kit';
import { getTexture } from './models/textures';
import MergeStatic from './models/MergeStatic';

/**
 * Décor du site industriel : voirie marquée, rond-point central, éclairage public,
 * arbres, clôture d'enceinte et poste de garde. L'emprise est calculée à partir
 * des bâtiments (et de leurs annexes extérieures : parking, quais, cuves...).
 */

// Débord des annexes extérieures côté `outward` selon le type de bâtiment
const OUTWARD_MARGIN = { office: 6.6, factory: 2.6, paint: 4.4, logistics: 10.2 };
const ROAD_X_WIDTH = 5.5; // voie Est-Ouest (selon X)
const ROAD_Z_WIDTH = 6.5; // voie Nord-Sud (selon Z)

function computeSiteBounds(buildings) {
  const rects = buildings.map((b) => {
    const [x, , z] = b.layout3D.position;
    const [w, , d] = b.layout3D.size;
    const [ox] = b.layout3D.outward || [1, 1];
    const extra = OUTWARD_MARGIN[b.layout3D.archetype] || 2;
    return {
      minX: x - w / 2 - (ox < 0 ? extra : 0.6),
      maxX: x + w / 2 + (ox > 0 ? extra : 0.6),
      minZ: z - d / 2 - 0.6,
      maxZ: z + d / 2 + 0.6,
    };
  });
  const site = rects.reduce(
    (acc, r) => ({
      minX: Math.min(acc.minX, r.minX),
      maxX: Math.max(acc.maxX, r.maxX),
      minZ: Math.min(acc.minZ, r.minZ),
      maxZ: Math.max(acc.maxZ, r.maxZ),
    }),
    { minX: -30, maxX: 30, minZ: -20, maxZ: 20 }
  );
  return { rects, fence: { minX: site.minX - 3.5, maxX: site.maxX + 3.5, minZ: site.minZ - 3.5, maxZ: site.maxZ + 3.5 } };
}

function lengthOf(fence, axis) {
  return axis === 'x' ? fence.maxX - fence.minX : fence.maxZ - fence.minZ;
}

/** Deux tronçons de part et d'autre du rond-point central : [[début, fin], ...]. */
function splitAroundCenter(min, max, gap = 4.8) {
  return [
    [min, -gap],
    [gap, max],
  ];
}

function isFree(x, z, rects, pad = 1.2) {
  if (Math.abs(x) < ROAD_Z_WIDTH / 2 + 1.2 || Math.abs(z) < ROAD_X_WIDTH / 2 + 1.2) return false;
  return !rects.some((r) => x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad);
}

/** Pointillés axiaux d'une voie. */
function DashedLine({ from, to, axis, gapAround = 4.5 }) {
  const dashes = [];
  for (let c = from; c <= to; c += 2) {
    if (Math.abs(c) < gapAround) continue;
    dashes.push(c);
  }
  return dashes.map((c) => (
    <Box
      key={c}
      position={axis === 'x' ? [c, 0.035, 0] : [0, 0.035, c]}
      size={axis === 'x' ? [1.0, 0.006, 0.12] : [0.12, 0.006, 1.0]}
      color="#e2e8f0"
      shadow={false}
    />
  ));
}

/** Passage piéton (bandes blanches) en travers d'une voie. */
function Crosswalk({ position, across = 'z', width }) {
  const stripes = Math.floor(width / 0.6);
  return (
    <group position={position}>
      {Array.from({ length: stripes }, (_, i) => {
        const o = -width / 2 + 0.3 + i * 0.6;
        return (
          <Box
            key={i}
            position={across === 'z' ? [0, 0.036, o] : [o, 0.036, 0]}
            size={across === 'z' ? [1.6, 0.006, 0.32] : [0.32, 0.006, 1.6]}
            color="#f1f5f9"
            shadow={false}
          />
        );
      })}
    </group>
  );
}

const FLAG_W = 1.6;
const FLAG_H = 1.0;

/**
 * Texture des drapeaux d'entreprise : logo de la société (data URI renvoyé par l'API DigiRisk)
 * sur fond blanc avec le nom de la société ; à défaut de logo, monogramme + nom.
 */
function useCompanyFlagTexture(logoUrl, companyName = '') {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 320;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    const ctx = texture.image.getContext('2d');
    const name = companyName.length > 28 ? `${companyName.slice(0, 27)}…` : companyName;
    const draw = (img) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 320);
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 300, 512, 20);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(0, 292, 512, 8);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (img) {
        const scale = Math.min(420 / img.width, 200 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, 256 - w / 2, 125 - h / 2, w, h);
      } else {
        const initials = companyName
          .split(/[\s\-_]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((word) => word[0].toUpperCase())
          .join('');
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(256, 120, 82, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 76px Inter, Arial, sans-serif';
        ctx.fillText(initials || '?', 256, 124);
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 30px Inter, Arial, sans-serif';
      ctx.fillText(name, 256, 255);
      texture.needsUpdate = true;
    };

    draw(null);
    if (!logoUrl) return undefined;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => !cancelled && draw(img);
    img.src = logoUrl;
    return () => {
      cancelled = true;
    };
  }, [texture, logoUrl, companyName]);

  return texture;
}

function Flag({ material, phase = 0, ...rest }) {
  const clothRef = useRef();
  useFrame(({ clock }) => {
    if (clothRef.current) clothRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 1.6 + phase) * 0.18;
  });
  return (
    <group {...rest}>
      <Cylinder position={[0, 2.6, 0]} radius={0.045} height={5.2} color="#e2e8f0" metal={0.7} rough={0.3} />
      <Ball position={[0, 5.22, 0]} radius={0.07} color="#e2e8f0" metal={0.7} rough={0.3} />
      <group ref={clothRef} userData={DYNAMIC} position={[0, 5.1 - FLAG_H / 2, 0]}>
        <mesh position={[FLAG_W / 2 + 0.05, 0, 0]} material={material} castShadow raycast={() => null}>
          <planeGeometry args={[FLAG_W, FLAG_H]} />
        </mesh>
      </group>
    </group>
  );
}

function GuardHouse({ side = 1, ...rest }) {
  const armRef = useRef();
  useFrame(({ clock }) => {
    if (!armRef.current) return;
    const cycle = (clock.getElapsedTime() * 0.08) % 1;
    const open = cycle < 0.15 ? cycle / 0.15 : cycle < 0.45 ? 1 : cycle < 0.6 ? 1 - (cycle - 0.45) / 0.15 : 0;
    armRef.current.rotation.z = -side * open * 1.35;
  });
  return (
    <group {...rest}>
      {/* Loge du gardien */}
      <Box position={[0, 0.06, 0]} size={[2.6, 0.12, 2.2]} color="#64748b" rough={0.9} />
      <Box position={[0, 1.0, 0]} size={[2.2, 1.8, 1.8]} color="#e2e8f0" rough={0.5} />
      <Box position={[0, 1.15, 0.91]} size={[1.8, 0.7, 0.03]} color="#1e3a5f" metal={0.85} rough={0.12} />
      <Box position={[-side * 1.11, 1.15, 0]} size={[0.03, 0.7, 1.4]} color="#1e3a5f" metal={0.85} rough={0.12} />
      <Box position={[0, 2.0, 0]} size={[2.6, 0.18, 2.2]} color="#334155" rough={0.6} />
      <Box position={[0, 1.55, 0.93]} size={[1.0, 0.18, 0.02]} color="#38bdf8" glow={0.8} shadow={false} />
      {/* Barrière levante */}
      <group position={[-side * 1.5, 0, 0.6]}>
        <Box position={[0, 0.45, 0]} size={[0.3, 0.9, 0.3]} color={PALETTE.safetyYellow} />
        <group ref={armRef} userData={DYNAMIC} position={[0, 0.8, 0]}>
          {Array.from({ length: 18 }, (_, i) => (
            <Box key={i} position={[-side * (0.25 + i * 0.4), 0, 0]} size={[0.4, 0.08, 0.06]} color={i % 2 ? '#dc2626' : '#f8fafc'} />
          ))}
        </group>
      </group>
    </group>
  );
}

export default function CampusScenery({ buildings = [], companyName, companyLogo }) {
  const flagTexture = useCompanyFlagTexture(companyLogo, companyName);
  const flagMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 0.85 }),
    [flagTexture]
  );
  useEffect(() => () => flagMaterial.dispose(), [flagMaterial]);

  const layout = useMemo(() => {
    if (!buildings.length) return null;
    const { rects, fence } = computeSiteBounds(buildings);

    const trees = [];
    // Alignement d'arbres le long de la clôture (côté intérieur)
    const inset = 1.6;
    const step = 4.2;
    const addTree = (x, z, i) => {
      if (!isFree(x, z, rects, 0.8)) return;
      trees.push({ x, z, variant: seeded(i) > 0.55 ? 'conifer' : 'round', size: 0.85 + seeded(i + 7) * 0.45 });
    };
    let i = 0;
    for (let x = fence.minX + inset; x <= fence.maxX - inset; x += step) {
      addTree(x, fence.minZ + inset, (i += 1));
      addTree(x + step / 2, fence.maxZ - inset, (i += 1));
    }
    for (let z = fence.minZ + inset + step; z <= fence.maxZ - inset - step; z += step) {
      addTree(fence.minX + inset, z, (i += 1));
      addTree(fence.maxX - inset, z, (i += 1));
    }
    // Bosquets hors enceinte pour habiller le terrain (bande de 2,5 à 9 unités autour de la clôture)
    for (let k = 0; k < 32; k += 1) {
      const side = k % 4;
      const along = seeded(k * 3.1);
      const offset = 2.5 + seeded(k * 5.7) * 6.5;
      const x =
        side === 0 ? fence.minX - offset : side === 1 ? fence.maxX + offset : fence.minX + along * lengthOf(fence, 'x');
      const z =
        side === 2 ? fence.minZ - offset : side === 3 ? fence.maxZ + offset : fence.minZ + along * lengthOf(fence, 'z');
      if (z > 0 && Math.abs(x) < ROAD_Z_WIDTH / 2 + 1.5) continue;
      trees.push({ x, z, variant: k % 3 ? 'conifer' : 'round', size: 1 + seeded(k) * 0.6 });
    }

    // Lampadaires alternés le long des deux voies (bras orienté vers la chaussée), décalés hors des
    // bâtiments et de l'auvent d'entrée des bureaux, qui bordent la voie Est-Ouest
    const lamps = [];
    const blocked = (x, z) =>
      buildings.some((b) => {
        const [bx, , bz] = b.layout3D.position;
        const [w, , d] = b.layout3D.size;
        const front = bz + d / 2;
        const entrance = b.layout3D.archetype === 'office' && Math.abs(x - bx) < 3.8 && z > front - 0.5 && z < front + 1.8;
        return entrance || (Math.abs(x - bx) < w / 2 + 0.3 && Math.abs(z - bz) < d / 2 + 0.3);
      });
    for (let x = fence.minX + 4; x <= fence.maxX - 4; x += 9) {
      if (Math.abs(x) < 6) continue;
      const side = Math.round(x / 9) % 2 ? 1 : -1;
      const z = side * (ROAD_X_WIDTH / 2 + 0.45);
      const spot = [x, x - 4.5, x + 4.5].find((c) => Math.abs(c) >= 6 && c > fence.minX + 1 && c < fence.maxX - 1 && !blocked(c, z));
      if (spot !== undefined) lamps.push({ x: spot, z, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2 });
    }
    for (let z = fence.minZ + 4; z <= fence.maxZ - 4; z += 9) {
      if (Math.abs(z) < 6) continue;
      const side = Math.round(z / 9) % 2 ? 1 : -1;
      lamps.push({ x: side * (ROAD_Z_WIDTH / 2 + 0.45), z, rot: side > 0 ? Math.PI : 0 });
    }

    // Poteaux de clôture
    const posts = [];
    const postStep = 4;
    for (let x = fence.minX; x <= fence.maxX + 0.01; x += (fence.maxX - fence.minX) / Math.round((fence.maxX - fence.minX) / postStep)) {
      posts.push([x, fence.minZ]);
      if (Math.abs(x) > ROAD_Z_WIDTH / 2 + 2.2) posts.push([x, fence.maxZ]);
    }
    for (let z = fence.minZ; z <= fence.maxZ + 0.01; z += (fence.maxZ - fence.minZ) / Math.round((fence.maxZ - fence.minZ) / postStep)) {
      posts.push([fence.minX, z], [fence.maxX, z]);
    }

    return { fence, trees, lamps, posts };
  }, [buildings]);

  if (!layout) return null;
  const { fence, trees, lamps, posts } = layout;
  const lengthX = fence.maxX - fence.minX;
  const lengthZ = fence.maxZ - fence.minZ;
  const centerX = (fence.minX + fence.maxX) / 2;
  const centerZ = (fence.minZ + fence.maxZ) / 2;
  const gateHalf = ROAD_Z_WIDTH / 2 + 2.2;
  const fenceH = 1.6;

  return (
    <MergeStatic deps={[layout, flagMaterial]}>
      {/* Enceinte pavée */}
      <Box position={[centerX, 0.004, centerZ]} size={[lengthX, 0.008, lengthZ]} map={getTexture('pavers', lengthX / 3, lengthZ / 3)} rough={0.95} shadow={false} receive />

      {/* Voirie : chaussées, bordures, marquages */}
      <Box position={[centerX, 0.02, 0]} size={[lengthX, 0.03, ROAD_X_WIDTH]} map={getTexture('asphalt', lengthX / 4, ROAD_X_WIDTH / 4)} rough={0.85} shadow={false} receive />
      <Box position={[0, 0.021, (fence.minZ + fence.maxZ + 8) / 2]} size={[ROAD_Z_WIDTH, 0.03, lengthZ + 8]} map={getTexture('asphalt', ROAD_Z_WIDTH / 4, (lengthZ + 8) / 4)} rough={0.85} shadow={false} receive />
      {[-1, 1].map((s) => (
        <React.Fragment key={s}>
          {splitAroundCenter(fence.minX, fence.maxX).map(([a, b]) => (
            <React.Fragment key={`x${a}`}>
              <Box position={[(a + b) / 2, 0.06, s * (ROAD_X_WIDTH / 2 + 0.15)]} size={[b - a, 0.1, 0.3]} color="#475569" rough={0.8} shadow={false} />
              <Box position={[(a + b) / 2, 0.035, s * (ROAD_X_WIDTH / 2 - 0.25)]} size={[b - a, 0.006, 0.08]} color="#94a3b8" shadow={false} />
            </React.Fragment>
          ))}
          {splitAroundCenter(fence.minZ, fence.maxZ).map(([a, b]) => (
            <React.Fragment key={`z${a}`}>
              <Box position={[s * (ROAD_Z_WIDTH / 2 + 0.15), 0.06, (a + b) / 2]} size={[0.3, 0.1, b - a]} color="#475569" rough={0.8} shadow={false} />
              <Box position={[s * (ROAD_Z_WIDTH / 2 - 0.25), 0.035, (a + b) / 2]} size={[0.08, 0.006, b - a]} color="#94a3b8" shadow={false} />
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
      <DashedLine from={fence.minX + 1} to={fence.maxX - 1} axis="x" />
      <DashedLine from={fence.minZ + 1} to={fence.maxZ + 3} axis="z" />
      <Crosswalk position={[-6.2, 0, 0]} across="z" width={ROAD_X_WIDTH - 0.6} />
      <Crosswalk position={[6.2, 0, 0]} across="z" width={ROAD_X_WIDTH - 0.6} />
      <Crosswalk position={[0, 0, -5.4]} across="x" width={ROAD_Z_WIDTH - 0.6} />
      <Crosswalk position={[0, 0, 5.4]} across="x" width={ROAD_Z_WIDTH - 0.6} />

      {/* Rond-point engazonné et mâts de drapeaux autour du totem central */}
      <Cylinder position={[0, 0.04, 0]} radius={4.4} height={0.05} segments={40} color="#334155" rough={0.8} shadow={false} />
      <Cylinder position={[0, 0.07, 0]} radius={4.1} height={0.06} segments={40} color="#14532d" rough={0.95} shadow={false} />
      {/* Drapeaux aux couleurs de la société (logo Dolibarr) */}
      <Flag position={[-2.2, 0.05, -3.0]} material={flagMaterial} phase={0} />
      <Flag position={[-0.3, 0.05, -3.5]} material={flagMaterial} phase={1.3} />
      <Flag position={[1.6, 0.05, -3.0]} material={flagMaterial} phase={2.1} />
      {[[-3.2, 1.6], [3.2, 1.6]].map(([x, z]) => (
        <Bench key={x} position={[x, 0.08, z]} rotation={[0, x < 0 ? Math.PI / 3 : -Math.PI / 3, 0]} />
      ))}

      {/* Éclairage public */}
      {lamps.map((l) => (
        <StreetLamp key={`${l.x}${l.z}`} position={[l.x, 0.05, l.z]} rotation={[0, l.rot, 0]} />
      ))}

      {/* Végétation */}
      {trees.map((t, k) => (
        <Tree key={k} position={[t.x, 0, t.z]} variant={t.variant} size={t.size} />
      ))}

      {/* Clôture d'enceinte (portail d'entrée au sud, sur la voie principale) */}
      {posts.map(([x, z], k) => (
        <Box key={k} position={[x, fenceH / 2, z]} size={[0.1, fenceH, 0.1]} color="#64748b" metal={0.6} rough={0.4} />
      ))}
      <Box position={[centerX, fenceH - 0.05, fence.minZ]} size={[lengthX, 0.05, 0.05]} color="#64748b" metal={0.6} shadow={false} />
      <Box position={[centerX, fenceH / 2, fence.minZ]} size={[lengthX, fenceH, 0.02]} color="#94a3b8" opacity={0.16} shadow={false} />
      {[-1, 1].map((s) => {
        const from = s < 0 ? fence.minX : gateHalf;
        const to = s < 0 ? -gateHalf : fence.maxX;
        return (
          <React.Fragment key={s}>
            <Box position={[(from + to) / 2, fenceH - 0.05, fence.maxZ]} size={[to - from, 0.05, 0.05]} color="#64748b" metal={0.6} shadow={false} />
            <Box position={[(from + to) / 2, fenceH / 2, fence.maxZ]} size={[to - from, fenceH, 0.02]} color="#94a3b8" opacity={0.16} shadow={false} />
            <Box position={[s < 0 ? fence.minX : fence.maxX, fenceH - 0.05, centerZ]} size={[0.05, 0.05, lengthZ]} color="#64748b" metal={0.6} shadow={false} />
            <Box position={[s < 0 ? fence.minX : fence.maxX, fenceH / 2, centerZ]} size={[0.02, fenceH, lengthZ]} color="#94a3b8" opacity={0.16} shadow={false} />
          </React.Fragment>
        );
      })}
      <GuardHouse position={[ROAD_Z_WIDTH / 2 + 2.6, 0, fence.maxZ - 1.6]} side={1} />
      <SafetySign kind="firstaid" position={[-ROAD_Z_WIDTH / 2 - 1.5, 0, fence.maxZ - 1.2]} height={1.7} size={0.55} />
    </MergeStatic>
  );
}
