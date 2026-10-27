import React, { useEffect, useMemo, useRef } from 'react';
import { explorerStore } from '../3d/explorer/explorerStore';
import { streetRect } from '../3d/CampusScenery';
import { HUB } from '../../services/siteLayout';

/**
 * Minicarte du mode visite (nord en haut) : voirie, groupements et sous-groupements, UT teintées
 * par leur cotation (cerclées de vert une fois inspectées) et position / orientation du joueur.
 */

const CSS_W = 190;
const CSS_H = 150;
const DPR = 2;

export default function ExplorerMinimap({ data, cotationMode, inspectedIds }) {
  const canvasRef = useRef();
  const site = data?.site;
  const fence = useMemo(() => (site?.fence ? site.fence : null), [site]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fence) return undefined;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = 10;
    const k = Math.min((W - 2 * pad) / (fence.maxX - fence.minX), (H - 2 * pad) / (fence.maxZ - fence.minZ));
    const ox = W / 2 - ((fence.minX + fence.maxX) / 2) * k;
    const oz = H / 2 - ((fence.minZ + fence.maxZ) / 2) * k;
    const px = (x) => ox + x * k;
    const pz = (z) => oz + z * k;
    const rect = (minX, minZ, maxX, maxZ) => [px(minX), pz(minZ), (maxX - minX) * k, (maxZ - minZ) * k];

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(...rect(fence.minX, fence.minZ, fence.maxX, fence.maxZ));

      // Voirie et rond-point central
      ctx.fillStyle = 'rgba(71, 85, 105, 0.75)';
      for (const street of site.streets) {
        const r = streetRect(street);
        ctx.fillRect(...rect(r.minX, r.minZ, r.maxX, r.maxZ));
      }
      ctx.beginPath();
      ctx.arc(px(site.hub[0]), pz(site.hub[1]), HUB.ring * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px(site.hub[0]), pz(site.hub[1]), HUB.island * k, 0, Math.PI * 2);
      ctx.fillStyle = '#14532d';
      ctx.fill();

      // Étiquettes lisibles uniquement si les bâtiments sont assez grands à l'écran
      const labelled = data.buildings.every((b) => b.layout3D.size[0] * k > 22 * DPR);
      for (const b of data.buildings) {
        const [x, , z] = b.layout3D.position;
        const [w, , d] = b.layout3D.size;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
        ctx.fillRect(...rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2));
        ctx.strokeStyle = b.layout3D.themeColor || '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(...rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2));
        for (const zone of b.zones || []) {
          const [zx, , zz] = zone.layout3D.position;
          const [zw, , zd] = zone.layout3D.size;
          ctx.lineWidth = 1;
          ctx.setLineDash([3 * DPR, 2 * DPR]);
          ctx.strokeRect(...rect(zx - zw / 2, zz - zd / 2, zx + zw / 2, zz + zd / 2));
          ctx.setLineDash([]);
        }
        if (labelled) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = `bold ${10 * DPR}px Inter, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(b.ref, px(x), pz(z - d / 2) + 12 * DPR);
        }
      }

      for (const ut of data.allWorkUnitsWorld || []) {
        const [x, , z] = ut.layout3D.worldPosition;
        const [w, , d] = ut.layout3D.size;
        const scale = cotationMode === 'brute' ? ut.stats.scaleBrute : ut.stats.scaleResiduelle;
        const r = rect(x - w / 2 + 0.3, z - d / 2 + 0.3, x + w / 2 - 0.3, z + d / 2 - 0.3);
        ctx.fillStyle = scale.color;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(...r);
        ctx.globalAlpha = 1;
        const inspected = inspectedIds.has(ut.id);
        ctx.strokeStyle = inspected ? '#22c55e' : scale.level === 'critical' ? '#cbd5e1' : 'rgba(15, 23, 42, 0.9)';
        ctx.lineWidth = inspected ? 3 : 1.5;
        ctx.strokeRect(...r);
        if (inspected) {
          ctx.fillStyle = '#22c55e';
          ctx.font = `bold ${10 * DPR}px Inter, system-ui, sans-serif`;
          ctx.fillText('✓', px(x), pz(z) + 4 * DPR);
        }
      }

      const player = explorerStore.get().player;
      if (player) {
        const cx = px(player.x);
        const cy = pz(player.z);
        const fx = -Math.sin(player.yaw);
        const fy = -Math.cos(player.yaw);
        const size = 7 * DPR;
        ctx.beginPath();
        ctx.moveTo(cx + fx * size, cy + fy * size);
        ctx.lineTo(cx - fx * size * 0.6 - fy * size * 0.6, cy - fy * size * 0.6 + fx * size * 0.6);
        ctx.lineTo(cx - fx * size * 0.25, cy - fy * size * 0.25);
        ctx.lineTo(cx - fx * size * 0.6 + fy * size * 0.6, cy - fy * size * 0.6 - fx * size * 0.6);
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }
    };

    draw();
    let lastPlayer = explorerStore.get().player;
    return explorerStore.subscribe(() => {
      const { player } = explorerStore.get();
      if (player === lastPlayer) return;
      lastPlayer = player;
      draw();
    });
  }, [fence, site, data, cotationMode, inspectedIds]);

  if (!fence) return null;
  return (
    <canvas
      ref={canvasRef}
      className="explorer-minimap"
      width={CSS_W * DPR}
      height={CSS_H * DPR}
      style={{ width: CSS_W, height: CSS_H }}
    />
  );
}
