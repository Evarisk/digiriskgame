import * as THREE from 'three';

/**
 * Textures procédurales (canvas) : pierre de taille, parquet, brique, béton, enrobé, sol époxy, panneaux,
 * pelouse, pavés ; et sols naturels de la ville de l'éditeur (béton neutre, enrobé anthracite, pelouse, pavés
 * de granit).
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
  // Pierre de taille : assises de blocs décalées, joints fins (façades anciennes)
  ashlar(ctx, s) {
    ctx.fillStyle = '#cbbd9f';
    ctx.fillRect(0, 0, s, s);
    // Répétée tous les 3 unités sur les façades : blocs d'environ 1,5 m × 0,55 m
    const rows = 8;
    const bh = s / rows;
    const bw = s / 3;
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 4; col += 1) {
        const shade = 0.93 + rand(row * 17 + col * 5) * 0.1;
        ctx.fillStyle = `rgb(${Math.round(232 * shade)},${Math.round(220 * shade)},${Math.round(196 * shade)})`;
        ctx.fillRect(col * bw + offset + 1.5, row * bh + 1.5, bw - 3, bh - 3);
      }
    }
    noise(ctx, s, 2600, 0.06, 8);
  },
  // Parquet ancien : bâtons de chêne posés en vannerie (trois lames par carré, sens alterné)
  parquet(ctx, s) {
    ctx.fillStyle = '#5c3b1e';
    ctx.fillRect(0, 0, s, s);
    // Répétée tous les 4 unités au sol : carrés de 0,75 m, lames de 25 cm
    const n = 8;
    const cell = s / n;
    const lame = cell / 3;
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        for (let k = 0; k < 3; k += 1) {
          const shade = 0.82 + rand(r * 31 + c * 7 + k * 3) * 0.3;
          ctx.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(101 * shade)},${Math.round(58 * shade)})`;
          if ((r + c) % 2) ctx.fillRect(c * cell + 1, r * cell + k * lame + 1, cell - 2, lame - 2);
          else ctx.fillRect(c * cell + k * lame + 1, r * cell + 1, lame - 2, cell - 2);
        }
      }
    }
    noise(ctx, s, 2200, 0.05, 9);
  },
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
  // Béton balayé gris neutre : grain fin, taches d'usure, joints de retrait
  concreteCity(ctx, s) {
    ctx.fillStyle = '#b8b6b1';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 18; i += 1) {
      const g = ctx.createRadialGradient(rand(i * 3.7) * s, rand(i * 5.9) * s, 2, rand(i * 3.7) * s, rand(i * 5.9) * s, 30 + rand(i) * 70);
      const dark = rand(i * 2.1) > 0.5;
      g.addColorStop(0, dark ? 'rgba(90,88,84,0.08)' : 'rgba(255,255,250,0.07)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    noise(ctx, s, 9000, 0.06, 3);
    ctx.fillStyle = 'rgba(70,68,64,0.35)';
    ctx.fillRect(0, 0, s, 2);
    ctx.fillRect(0, 0, 2, s);
  },
  // Enrobé gris anthracite (sans teinte bleue) : granulats clairs et sombres, ressuage, taches d'huile
  asphaltCity(ctx, s) {
    ctx.fillStyle = '#3c3d3f';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 14; i += 1) {
      const x = rand(i * 4.3) * s;
      const y = rand(i * 7.7) * s;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 25 + rand(i * 1.9) * 60);
      g.addColorStop(0, rand(i) > 0.6 ? 'rgba(20,20,22,0.18)' : 'rgba(90,90,92,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    for (let i = 0; i < 16000; i += 1) {
      const v = rand(i * 1.31);
      const c = v > 0.82 ? 140 + Math.floor(rand(i * 2.7) * 70) : v < 0.35 ? 22 + Math.floor(rand(i * 3.3) * 20) : 60 + Math.floor(rand(i * 4.1) * 25);
      ctx.fillStyle = `rgba(${c},${c},${c - 2},${0.35 + rand(i * 5.9) * 0.4})`;
      ctx.fillRect(rand(i * 2.3) * s, rand(i * 4.7) * s, 1 + (v > 0.95 ? 1 : 0), 1);
    }
  },
  // Pelouse : fond vert naturel, plaques plus claires et plus sombres, brins de plusieurs verts, trèfle, brins secs
  lawn(ctx, s) {
    ctx.fillStyle = '#4e7434';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i += 1) {
      const x = rand(i * 6.1) * s;
      const y = rand(i * 2.9) * s;
      const g = ctx.createRadialGradient(x, y, 4, x, y, 30 + rand(i * 3.3) * 80);
      g.addColorStop(0, rand(i * 1.7) > 0.5 ? 'rgba(120,150,70,0.22)' : 'rgba(40,70,30,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    const greens = [[63, 104, 42], [78, 120, 50], [96, 138, 58], [112, 150, 66], [58, 92, 38], [131, 160, 78]];
    ctx.lineCap = 'round';
    for (let i = 0; i < 22000; i += 1) {
      const [r, g, b] = greens[Math.floor(rand(i * 1.13) * greens.length)];
      const x = rand(i * 2.71) * s;
      const y = rand(i * 5.37) * s;
      const len = 2 + rand(i * 3.9) * 5;
      const lean = (rand(i * 7.3) - 0.5) * 2.2;
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.55 + rand(i * 9.1) * 0.4})`;
      ctx.lineWidth = 0.8 + rand(i * 4.4) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + lean, y - len);
      ctx.stroke();
    }
    for (let i = 0; i < 260; i += 1) {
      ctx.fillStyle = rand(i * 8.8) > 0.5 ? 'rgba(170,160,90,0.6)' : 'rgba(70,110,45,0.7)';
      ctx.beginPath();
      ctx.arc(rand(i * 3.2) * s, rand(i * 6.6) * s, 1 + rand(i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // Pavés de granit gris-beige en rangs décalés, joints sablés, chaque pavé légèrement nuancé et bombé
  granite(ctx, s) {
    ctx.fillStyle = '#6e6960';
    ctx.fillRect(0, 0, s, s);
    const rows = 10;
    const cols = 7;
    const h = s / rows;
    const w = s / cols;
    for (let r = 0; r < rows; r += 1) {
      const off = r % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c += 1) {
        const k = rand(r * 31 + c * 7.3);
        const base = 150 + Math.floor(k * 40);
        const x = c * w + off + 2;
        const y = r * h + 2;
        const g = ctx.createLinearGradient(x, y, x, y + h - 4);
        g.addColorStop(0, `rgb(${base + 14},${base + 10},${base + 2})`);
        g.addColorStop(1, `rgb(${base - 18},${base - 20},${base - 26})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, y, w - 4, h - 4, 4);
        ctx.fill();
      }
    }
    noise(ctx, s, 9000, 0.07, 6);
  },
};

const baseTextures = new Map();
const repeated = new Map();

function getBaseTexture(kind) {
  if (!baseTextures.has(kind)) {
    // Sols naturels de l'éditeur plus fins (vus de près en visite)
    const size = ['concreteCity', 'asphaltCity', 'lawn', 'granite'].includes(kind) ? 512 : 256;
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
