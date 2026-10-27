import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import {
  Box,
  Cylinder,
  Ball,
  Tree,
  StreetLamp,
  Bench,
  SafetySign,
  SafetyGuardrail,
  WalkwayStrip,
  WalkwayNode,
  FirstAidKit,
  seeded,
  PALETTE,
  DYNAMIC,
} from './models/kit';
import { getTexture } from './models/textures';
import MergeStatic from './models/MergeStatic';
import { EquipmentOwner } from './equipment/equipment';
import { traffic } from './traffic';
import { AVENUE_WIDTH, HUB } from '../../services/siteLayout';

const GATE_OWNER = { id: 'site-gate', ref: 'Accès', label: 'Poste de garde' };

/**
 * Décor du site industriel, d'après le plan calculé pour l'arborescence (services/siteLayout.js) :
 * voirie marquée et carrefours, couloirs piétons balisés (norme INRS) et passages piétons,
 * rond-point central, éclairage public, arbres, clôture d'enceinte, poste de garde et route
 * départementale devant le portail.
 */

const HUB_GAP = 6.7; // interruption des bordures au débouché de l'anneau du rond-point
const CROSSWALK_GAP = 0.95; // bordure abaissée au droit des passages piétons
const WALKWAY_Y = 0.0125; // couloirs extérieurs posés sur le pavé

const inRect = (r, x, z, pad = 0) => x > r.minX - pad && x < r.maxX + pad && z > r.minZ - pad && z < r.maxZ + pad;

/** Distance d'un point à un segment [a, b] (plan XZ). */
function distanceToSegment(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
}

/** Rectangle de chaussée d'une voie (`axis` : direction de la voie). */
export function streetRect(s) {
  return s.axis === 'x'
    ? { minX: s.from, maxX: s.to, minZ: s.z - s.width / 2, maxZ: s.z + s.width / 2 }
    : { minX: s.x - s.width / 2, maxX: s.x + s.width / 2, minZ: s.from, maxZ: s.to };
}

/** Carrefours d'une voie : position le long de son axe et demi-largeur de la voie croisée. */
function crossingsOf(street, site) {
  return site.intersections
    .filter((i) => (street.axis === 'x' ? i.ew === street : i.ns === street))
    .map((i) => ({ at: street.axis === 'x' ? i.x : i.z, half: (street.axis === 'x' ? i.ns : i.ew).width / 2, hub: i.hub }));
}

/** Passages piétons d'une voie : position le long de son axe. */
function crosswalksOf(street, site) {
  return site.crosswalks.filter((c) => c.street === street).map((c) => (street.axis === 'x' ? c.x : c.z));
}

/** Tronçons de bordure d'une voie entre carrefours et passages piétons : [[début, fin], ...]. */
function segmentsOf(from, to, crossings, crosswalks) {
  const gaps = [
    ...crossings.map((c) => (c.hub ? [c.at - HUB_GAP, c.at + HUB_GAP] : [c.at - c.half - 0.3, c.at + c.half + 0.3])),
    ...crosswalks.map((t) => [t - CROSSWALK_GAP, t + CROSSWALK_GAP]),
  ].sort((a, b) => a[0] - b[0]);
  const segments = [];
  let start = from;
  for (const [a, b] of gaps) {
    if (a > start) segments.push([start, a]);
    start = Math.max(start, b);
  }
  if (to > start) segments.push([start, to]);
  return segments;
}

/** Pointillés axiaux d'une voie, interrompus aux carrefours. */
function DashedLine({ street, from, to, crossings }) {
  const dashes = [];
  for (let c = from; c <= to; c += 2) {
    if (crossings.some((k) => Math.abs(c - k.at) < (k.hub ? HUB.ring + 0.3 : k.half + 0.5))) continue;
    dashes.push(c);
  }
  return dashes.map((c) => (
    <Box
      key={c}
      position={street.axis === 'x' ? [c, 0.035, street.z] : [street.x, 0.035, c]}
      size={street.axis === 'x' ? [1.0, 0.006, 0.12] : [0.12, 0.006, 1.0]}
      color="#e2e8f0"
      shadow={false}
    />
  ));
}

/** Passage piéton (bandes blanches sur fond vert sécurité) en travers d'une voie. */
function Crosswalk({ position, across = 'z', width }) {
  const stripes = Math.floor(width / 0.6);
  return (
    <group position={position} userData={{ noCollide: true }}>
      {/* Bande de fond verte sécurité sous les bandes blanches du passage piéton (au-dessus de l'enrobé) */}
      <Box
        position={[0, 0.0372, 0]}
        size={across === 'z' ? [1.85, 0.005, width] : [width, 0.005, 1.85]}
        color="#15803d"
        rough={0.85}
        shadow={false}
      />
      {Array.from({ length: stripes }, (_, i) => {
        const o = -width / 2 + 0.3 + i * 0.6;
        return (
          <Box
            key={i}
            position={across === 'z' ? [0, 0.04, o] : [o, 0.04, 0]}
            size={across === 'z' ? [1.6, 0.006, 0.32] : [0.32, 0.006, 1.6]}
            color="#f1f5f9"
            shadow={false}
          />
        );
      })}
    </group>
  );
}

/**
 * Réseau extérieur de cheminements piétons industriels balisés (vert/jaune + chevrons), calculé par le
 * plan du site : couloirs de part et d'autre de chaque voie, accès aux passages piétons, raccordement
 * des portes de chaque bâtiment ; barrières le long de l'anneau du rond-point et panneaux aux
 * passages piétons qui le bordent.
 */
function CampusPedestrianNetwork({ site }) {
  const [hx, hz] = site.hub;
  const guardrail = (HUB.ring + HUB.clear) / 2 - 0.25; // entre l'anneau et les cheminements diagonaux
  return (
    <group userData={{ noCollide: true }}>
      {site.walkways.strips.map((s) => (
        <WalkwayStrip key={`${s.from}-${s.to}`} from={s.from} to={s.to} y={WALKWAY_Y} arrows={s.arrows} />
      ))}
      {site.walkways.nodes.map((n) => (
        <WalkwayNode key={`${n}`} position={n} y={WALKWAY_Y} />
      ))}

      {/* Barrières de sécurité séparant l'anneau du rond-point des cheminements, panneaux aux passages piétons */}
      <group position={[hx, 0, hz]}>
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => (
          <React.Fragment key={`${sx}${sz}`}>
            <SafetyGuardrail
              position={[(sx * guardrail) / Math.SQRT2, 0, (sz * guardrail) / Math.SQRT2]}
              rotation={[0, Math.atan2(-sx, -sz), 0]}
              length={2.4}
              height={0.68}
              axis="x"
            />
            <SafetySign kind="mandatory" position={[sx * 9.6, 0, sz * 3.15]} height={1.25} size={0.28} />
          </React.Fragment>
        ))}
      </group>
    </group>
  );
}

/** Chaussée, bordures, lignes de rive, pointillés et passages piétons d'une voie. */
function Street({ street, site }) {
  const along = street.axis === 'x';
  const crossings = crossingsOf(street, site);
  const crosswalks = crosswalksOf(street, site);
  const length = street.to - street.from;
  const mid = (street.from + street.to) / 2;
  const half = street.width / 2;
  // Marquages limités à l'enceinte (l'avenue se prolonge au-delà du portail)
  const end = Math.min(street.to, along ? site.fence.maxX : site.fence.maxZ);
  const segments = segmentsOf(street.from, end, crossings, crosswalks);
  const at = (t, offset) => (along ? [t, street.z + offset] : [street.x + offset, t]);

  return (
    <>
      <Box
        position={along ? [mid, 0.02, street.z] : [street.x, 0.021, mid]}
        size={along ? [length, 0.03, street.width] : [street.width, 0.03, length]}
        map={getTexture('asphalt', (along ? length : street.width) / 4, (along ? street.width : length) / 4)}
        rough={0.85}
        shadow={false}
        receive
      />
      {[-1, 1].map((s) =>
        segments.map(([a, b]) => {
          const [cx, cz] = at((a + b) / 2, s * (half + 0.15));
          const [lx, lz] = at((a + b) / 2, s * (half - 0.25));
          return (
            <React.Fragment key={`${s}${a}`}>
              <Box position={[cx, 0.06, cz]} size={along ? [b - a, 0.1, 0.3] : [0.3, 0.1, b - a]} color="#475569" rough={0.8} shadow={false} />
              <Box position={[lx, 0.035, lz]} size={along ? [b - a, 0.006, 0.08] : [0.08, 0.006, b - a]} color="#94a3b8" shadow={false} />
            </React.Fragment>
          );
        })
      )}
      <DashedLine street={street} from={street.from + 1} to={street.main && !along ? site.road.z - site.road.width / 2 - 1 : end - 1} crossings={crossings} />
      {crosswalks.map((t) => {
        const [x, z] = at(t, 0);
        return <Crosswalk key={t} position={[x, 0, z]} across={along ? 'z' : 'x'} width={street.width - 0.6} />;
      })}
    </>
  );
}

/** Route départementale devant le portail : chaussée, lignes de rive et pointillés axiaux. */
function PublicRoad({ road, gateX }) {
  const length = road.to - road.from;
  const mid = (road.from + road.to) / 2;
  const half = road.width / 2;
  const mouth = AVENUE_WIDTH / 2 + 0.6; // débouché de l'avenue (rive nord interrompue)
  const dashes = [];
  for (let x = road.from + 1.5; x < road.to - 1; x += 3) {
    if (Math.abs(x - gateX) > mouth + 0.5) dashes.push(x);
  }
  const north = [
    [road.from, gateX - mouth],
    [gateX + mouth, road.to],
  ];
  return (
    <>
      <Box position={[mid, 0.02, road.z]} size={[length, 0.03, road.width]} map={getTexture('asphalt', length / 4, road.width / 4)} rough={0.85} shadow={false} receive />
      <Box position={[mid, 0.035, road.z + half - 0.25]} size={[length, 0.006, 0.1]} color="#e2e8f0" shadow={false} />
      {north.map(([a, b]) => (
        <Box key={a} position={[(a + b) / 2, 0.035, road.z - half + 0.25]} size={[b - a, 0.006, 0.1]} color="#e2e8f0" shadow={false} />
      ))}
      {dashes.map((x) => (
        <Box key={x} position={[x, 0.035, road.z]} size={[1.5, 0.006, 0.12]} color="#e2e8f0" shadow={false} />
      ))}
    </>
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
  useFrame(({ clock }, delta) => {
    if (!armRef.current) return;
    const t = clock.getElapsedTime();
    const cycle = (t * 0.08) % 1;
    const scheduled = cycle < 0.15 ? cycle / 0.15 : cycle < 0.45 ? 1 : cycle < 0.6 ? 1 - (cycle - 0.45) / 0.15 : 0;
    // Levée pour un véhicule qui approche (voir DeliveryTrucks), sinon cycle d'ouverture régulier
    const gate = traffic.gate;
    const target = t < gate.requestUntil ? 1 : scheduled;
    const step = Math.min(delta, 0.1) / 1.6;
    gate.open = target > gate.open ? Math.min(target, gate.open + step) : Math.max(target, gate.open - step);
    armRef.current.rotation.z = -side * gate.open * 1.35;
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

export default function CampusScenery({ site, companyName, companyLogo }) {
  const flagTexture = useCompanyFlagTexture(companyLogo, companyName);
  const flagMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ map: flagTexture, side: THREE.DoubleSide, roughness: 0.85 }),
    [flagTexture]
  );
  useEffect(() => () => flagMaterial.dispose(), [flagMaterial]);

  const layout = useMemo(() => {
    if (!site) return null;
    const { fence, footprints, streets, lots, gate, hub, road } = site;
    const streetRects = streets.map(streetRect);
    // Passage des camions de livraison (quais, traversée des trottoirs) : ni arbre ni lampadaire
    const truckRoutes = site.deliveries.flatMap((d) => [d.outbound, d.inbound, d.dock]);
    const onTruckRoute = (x, z, clearance) =>
      truckRoutes.some((pts) => pts.some((p, k) => k > 0 && distanceToSegment(x, z, pts[k - 1], p) < clearance));
    const isFree = (x, z, pad = 1.2) =>
      !streetRects.some((r) => inRect(r, x, z, 1.2)) &&
      !footprints.some((r) => inRect(r, x, z, pad)) &&
      !site.walkways.strips.some((s) => distanceToSegment(x, z, s.from, s.to) < 0.4 + pad) &&
      !onTruckRoute(x, z, 1.6 + pad) &&
      Math.hypot(x - hub[0], z - hub[1]) > HUB.clear + 1;
    const lengthX = fence.maxX - fence.minX;
    const lengthZ = fence.maxZ - fence.minZ;

    const trees = [];
    // Alignement d'arbres le long de la clôture (côté intérieur)
    const inset = 1.6;
    const step = 4.2;
    const addTree = (x, z, i) => {
      if (!isFree(x, z, 0.8)) return;
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
    // Bosquets clairsemés sur les îlots sans bâtiment
    lots
      .filter((lot) => !lot.occupied)
      .forEach((lot, l) => {
        for (let x = lot.minX + 2; x <= lot.maxX - 2; x += 4.5) {
          for (let z = lot.minZ + 2; z <= lot.maxZ - 2; z += 4.5) {
            const k = l * 97 + x * 3.1 + z * 7.3;
            if (seeded(k) > 0.6 && isFree(x, z, 0.8)) {
              trees.push({ x, z, variant: seeded(k + 1) > 0.5 ? 'conifer' : 'round', size: 0.9 + seeded(k + 2) * 0.5 });
            }
          }
        }
      });
    // Bosquets hors enceinte pour habiller le terrain (bande de 2,5 à 9 unités autour de la clôture)
    const groves = Math.max(32, Math.round((lengthX + lengthZ) / 4));
    for (let k = 0; k < groves; k += 1) {
      const side = k % 4;
      const along = seeded(k * 3.1);
      const offset = 2.5 + seeded(k * 5.7) * 6.5;
      const x = side === 0 ? fence.minX - offset : side === 1 ? fence.maxX + offset : fence.minX + along * lengthX;
      const z = side === 2 ? fence.minZ - offset : side === 3 ? fence.maxZ + offset : fence.minZ + along * lengthZ;
      if (z > fence.maxZ - 1 && Math.abs(x - gate.x) < AVENUE_WIDTH / 2 + 1.5) continue;
      if (Math.abs(z - road.z) < road.width / 2 + 1.5) continue;
      trees.push({ x, z, variant: k % 3 ? 'conifer' : 'round', size: 1 + seeded(k) * 0.6 });
    }

    // Lampadaires alternés le long de chaque voie (bras orienté vers la chaussée), hors carrefours
    // et hors accès aux passages piétons
    const lamps = [];
    for (const street of streets) {
      const along = street.axis === 'x';
      const crossings = crossingsOf(street, site);
      const crosswalks = crosswalksOf(street, site);
      const end = Math.min(street.to, along ? fence.maxX : fence.maxZ);
      const nearCrossing = (t) =>
        crossings.some((c) => Math.abs(t - c.at) < (c.hub ? HUB.clear + 2.5 : c.half + 3)) || crosswalks.some((c) => Math.abs(t - c) < 1.4);
      const offset = street.width / 2 + 0.45;
      for (let t = street.from + 4; t <= end - 4; t += 9) {
        if (nearCrossing(t)) continue;
        const side = Math.round(t / 9) % 2 ? 1 : -1;
        const at = (c) => (along ? [c, street.z + side * offset] : [street.x + side * offset, c]);
        const spot = [t, t - 4.5, t + 4.5].find(
          (c) =>
            !nearCrossing(c) &&
            c > street.from + 1 &&
            c < end - 1 &&
            !footprints.some((r) => inRect(r, ...at(c), 0.3)) &&
            !onTruckRoute(...at(c), 1.6)
        );
        if (spot === undefined) continue;
        const [x, z] = at(spot);
        lamps.push({ x, z, rot: along ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? Math.PI : 0 });
      }
    }

    // Poteaux de clôture (portail ouvert sur l'avenue)
    const gateHalf = AVENUE_WIDTH / 2 + 2.2;
    const posts = [];
    const postStep = 4;
    for (let x = fence.minX; x <= fence.maxX + 0.01; x += lengthX / Math.round(lengthX / postStep)) {
      posts.push([x, fence.minZ]);
      if (Math.abs(x - gate.x) > gateHalf) posts.push([x, fence.maxZ]);
    }
    for (let z = fence.minZ; z <= fence.maxZ + 0.01; z += lengthZ / Math.round(lengthZ / postStep)) {
      posts.push([fence.minX, z], [fence.maxX, z]);
    }

    return { fence, gate, hub, gateHalf, trees, lamps, posts };
  }, [site]);

  if (!layout) return null;
  const { fence, gate, hub, gateHalf, trees, lamps, posts } = layout;
  const lengthX = fence.maxX - fence.minX;
  const lengthZ = fence.maxZ - fence.minZ;
  const centerX = (fence.minX + fence.maxX) / 2;
  const centerZ = (fence.minZ + fence.maxZ) / 2;
  const fenceH = 1.6;

  return (
    <MergeStatic deps={[layout, flagMaterial]}>
      {/* Enceinte pavée */}
      <Box position={[centerX, 0.004, centerZ]} size={[lengthX, 0.008, lengthZ]} map={getTexture('pavers', lengthX / 3, lengthZ / 3)} rough={0.95} shadow={false} receive />

      {/* Voirie : chaussées, bordures, marquages, passages piétons */}
      {site.streets.map((street) => (
        <Street key={`${street.axis}${street.x ?? street.z}`} street={street} site={site} />
      ))}

      {/* Réseau de cheminements piétons balisés entre les portes des bâtiments et les passages piétons */}
      <CampusPedestrianNetwork site={site} />

      {/* Route départementale (départ et retour des camions de livraison) */}
      <PublicRoad road={site.road} gateX={gate.x} />

      {/* Rond-point : anneau de circulation, îlot engazonné et mâts de drapeaux autour du totem central */}
      <group position={[hub[0], 0, hub[1]]}>
        <Cylinder position={[0, 0.022, 0]} radius={HUB.ring} height={0.03} segments={48} map={getTexture('asphalt', HUB.ring / 2, HUB.ring / 2)} rough={0.85} shadow={false} receiveShadow />
        <Cylinder position={[0, 0.04, 0]} radius={HUB.island} height={0.05} segments={40} color="#334155" rough={0.8} shadow={false} />
        <Cylinder position={[0, 0.07, 0]} radius={HUB.island - 0.3} height={0.06} segments={40} color="#14532d" rough={0.95} shadow={false} />
        {/* Drapeaux aux couleurs de la société (logo Dolibarr) */}
        <Flag position={[-2.2, 0.05, -3.0]} material={flagMaterial} phase={0} />
        <Flag position={[-0.3, 0.05, -3.5]} material={flagMaterial} phase={1.3} />
        <Flag position={[1.6, 0.05, -3.0]} material={flagMaterial} phase={2.1} />
        {[[-3.2, 1.6], [3.2, 1.6]].map(([x, z]) => (
          <Bench key={x} position={[x, 0.08, z]} rotation={[0, x < 0 ? Math.PI / 3 : -Math.PI / 3, 0]} />
        ))}
      </group>

      {/* Éclairage public */}
      {lamps.map((l) => (
        <StreetLamp key={`${l.x}${l.z}`} position={[l.x, 0.05, l.z]} rotation={[0, l.rot, 0]} />
      ))}

      {/* Végétation */}
      {trees.map((t, k) => (
        <Tree key={k} position={[t.x, 0, t.z]} variant={t.variant} size={t.size} />
      ))}

      {/* Clôture d'enceinte (portail d'entrée au sud, sur l'avenue) */}
      {posts.map(([x, z], k) => (
        <Box key={k} position={[x, fenceH / 2, z]} size={[0.1, fenceH, 0.1]} color="#64748b" metal={0.6} rough={0.4} />
      ))}
      <Box position={[centerX, fenceH - 0.05, fence.minZ]} size={[lengthX, 0.05, 0.05]} color="#64748b" metal={0.6} shadow={false} />
      <Box position={[centerX, fenceH / 2, fence.minZ]} size={[lengthX, fenceH, 0.02]} color="#94a3b8" opacity={0.16} shadow={false} />
      {[-1, 1].map((s) => {
        const from = s < 0 ? fence.minX : gate.x + gateHalf;
        const to = s < 0 ? gate.x - gateHalf : fence.maxX;
        return (
          <React.Fragment key={s}>
            <Box position={[(from + to) / 2, fenceH - 0.05, fence.maxZ]} size={[to - from, 0.05, 0.05]} color="#64748b" metal={0.6} shadow={false} />
            <Box position={[(from + to) / 2, fenceH / 2, fence.maxZ]} size={[to - from, fenceH, 0.02]} color="#94a3b8" opacity={0.16} shadow={false} />
            <Box position={[s < 0 ? fence.minX : fence.maxX, fenceH - 0.05, centerZ]} size={[0.05, 0.05, lengthZ]} color="#64748b" metal={0.6} shadow={false} />
            <Box position={[s < 0 ? fence.minX : fence.maxX, fenceH / 2, centerZ]} size={[0.02, fenceH, lengthZ]} color="#94a3b8" opacity={0.16} shadow={false} />
          </React.Fragment>
        );
      })}
      <GuardHouse position={[gate.x + AVENUE_WIDTH / 2 + 2.6, 0, fence.maxZ - 1.6]} side={1} />
      <EquipmentOwner.Provider value={GATE_OWNER}>
        <FirstAidKit position={[gate.x + AVENUE_WIDTH / 2 + 1.2, 0, fence.maxZ - 2.0]} rotation={[0, -Math.PI / 2, 0]} slot="gate" />
      </EquipmentOwner.Provider>
      <SafetySign kind="firstaid" position={[gate.x - AVENUE_WIDTH / 2 - 1.5, 0, fence.maxZ - 1.2]} height={1.7} size={0.55} />
    </MergeStatic>
  );
}
