import * as THREE from 'three';

/**
 * Textures procédurales (canvas) : brique, béton, enrobé, sol époxy, panneaux, pelouse, pavés.
 * Générées une seule fois puis clonées par facteur de répétition (l'image source est partagée).
 */

function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function noise(ctx, size, amount, alpha, seed = 1) {
  for (let i = 0; i < amount; i += 1) {
    const v = Math.floor(rand(seed + i * 1.7) * 255);
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    ctx.fillRect(rand(seed + i * 3.1) * size, rand(seed + i * 5.3) * size, 1 + rand(i) * 2, 1 + rand(i + 9) * 2);
  }
}

const PAINTERS = {
  brick(ctx, s) {
    ctx.fillStyle = '#b9a58f';
    ctx.fillRect(0, 0, s, s);
    const bw = s / 4;
    const bh = s / 8;
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 5; col += 1) {
        const shade = 0.8 + rand(row * 13 + col * 7) * 0.35;
        ctx.fillStyle = `rgb(${Math.round(138 * shade)},${Math.round(59 * shade)},${Math.round(36 * shade)})`;
        ctx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    noise(ctx, s, 1800, 0.08, 2);
  },
  concrete(ctx, s) {
    ctx.fillStyle = '#c3c8cf';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 4000, 0.07, 3);
    ctx.strokeStyle = 'rgba(80,90,100,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
    ctx.fillStyle = 'rgba(80,90,100,0.35)';
    [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x * s, y * s, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  asphalt(ctx, s) {
    ctx.fillStyle = '#262f3d';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 6000, 0.12, 4);
    for (let i = 0; i < 300; i += 1) {
      ctx.fillStyle = `rgba(200,210,220,${0.08 + rand(i) * 0.12})`;
      ctx.fillRect(rand(i * 2.3) * s, rand(i * 4.1) * s, 1, 1);
    }
  },
  epoxy(ctx, s) {
    ctx.fillStyle = '#3a4554';
    ctx.fillRect(0, 0, s, s);
    noise(ctx, s, 2500, 0.05, 5);
    ctx.strokeStyle = 'rgba(15,23,42,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, s, s);
  },
  panel(ctx, s) {
    const grad = ctx.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(0, '#d7dbe0');
    grad.addColorStop(1, '#c9ced5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgba(100,110,125,0.5)';
    ctx.fillRect(0, 0, 3, s);
    for (let y = 16; y < s; y += 32) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(4, y, s - 4, 2);
    }
  },
  grass(ctx, s) {
    ctx.fillStyle = '#16301f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5000; i += 1) {
      const g = 50 + Math.floor(rand(i * 1.3) * 60);
      ctx.fillStyle = `rgba(${Math.floor(g * 0.35)},${g},${Math.floor(g * 0.45)},0.5)`;
      ctx.fillRect(rand(i * 2.9) * s, rand(i * 6.1) * s, 1, 2 + rand(i) * 3);
    }
  },
  pavers(ctx, s) {
    ctx.fillStyle = '#121a2a';
    ctx.fillRect(0, 0, s, s);
    const n = 4;
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const shade = 22 + Math.floor(rand(r * 9 + c) * 10);
        ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 16})`;
        ctx.fillRect((c * s) / n + 2, (r * s) / n + 2, s / n - 4, s / n - 4);
      }
    }
    noise(ctx, s, 1500, 0.05, 6);
  },
};

const baseTextures = new Map();
const repeated = new Map();

function getBaseTexture(kind) {
  if (!baseTextures.has(kind)) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    PAINTERS[kind](canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    baseTextures.set(kind, tex);
  }
  return baseTextures.get(kind);
}

/** Texture `kind` répétée (rx, ry) fois — arrondi au quart pour limiter le nombre de clones. */
export function getTexture(kind, rx = 1, ry = 1) {
  const qx = Math.max(0.25, Math.round(rx * 4) / 4);
  const qy = Math.max(0.25, Math.round(ry * 4) / 4);
  const key = `${kind}|${qx}|${qy}`;
  if (!repeated.has(key)) {
    const tex = getBaseTexture(kind).clone();
    tex.repeat.set(qx, qy);
    tex.needsUpdate = true;
    repeated.set(key, tex);
  }
  return repeated.get(key);
}
