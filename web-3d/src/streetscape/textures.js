import * as THREE from 'three';

/**
 * Procedural canvas textures for the streetscape. Every surface UV is laid out
 * in feet, so `tileFt` is the real-world size one texture tile covers.
 * Grayscale textures are tinted per house through instance colors.
 */

const cache = new Map();

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gray(v) {
  const c = Math.max(0, Math.min(255, Math.round(v * 255)));
  return `rgb(${c},${c},${c})`;
}

function makeTexture(key, size, draw, { tileFt = 4, srgb = true, unit = false } = {}) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size, mulberry32(key.length * 7919 + size));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (!unit) texture.repeat.set(1 / tileFt, 1 / tileFt);
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
}

function speckle(ctx, size, rand, count, colors, minR = 0.6, maxR = 2.2) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const r = minR + rand() * (maxR - minR);
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Horizontal vinyl lap siding, ~6.9" exposure (7 boards per 4 ft tile). */
export function lapSidingTexture() {
  return makeTexture('lap', 512, (ctx, size, rand) => {
    const boards = 7;
    const h = size / boards;
    for (let i = 0; i < boards; i += 1) {
      const y = i * h;
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, gray(0.8));
      grad.addColorStop(0.12, gray(0.93));
      grad.addColorStop(0.85, gray(0.97));
      grad.addColorStop(1, gray(0.9));
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, size, h);
      ctx.fillStyle = gray(0.55);
      ctx.fillRect(0, y + h - 3, size, 3);
      for (let g = 0; g < 40; g += 1) {
        ctx.fillStyle = `rgba(0,0,0,${0.015 + rand() * 0.02})`;
        ctx.fillRect(rand() * size, y + 4 + rand() * (h - 9), 20 + rand() * 90, 1);
      }
    }
  }, { tileFt: 4, srgb: false });
}

/** Cedar-look shake siding used in craftsman gables. */
export function shakeTexture() {
  return makeTexture('shake', 512, (ctx, size, rand) => {
    ctx.fillStyle = gray(0.35);
    ctx.fillRect(0, 0, size, size);
    const rows = 7;
    const h = size / rows;
    for (let r = 0; r < rows; r += 1) {
      let x = -rand() * 40;
      while (x < size) {
        const w = 22 + rand() * 46;
        const v = 0.72 + rand() * 0.26;
        const grad = ctx.createLinearGradient(0, r * h, 0, r * h + h);
        grad.addColorStop(0, gray(v * 0.82));
        grad.addColorStop(1, gray(v));
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, r * h, w - 3, h - 3);
        for (let g = 0; g < 4; g += 1) {
          ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.06})`;
          ctx.fillRect(x + 4 + rand() * (w - 8), r * h + 2, 1, h - 6);
        }
        x += w;
      }
      ctx.fillStyle = gray(0.22);
      ctx.fillRect(0, r * h + h - 3, size, 3);
    }
  }, { tileFt: 4, srgb: false });
}

/** Vertical board-and-batten, battens every 16". */
export function boardBattenTexture() {
  return makeTexture('bnb', 512, (ctx, size) => {
    ctx.fillStyle = gray(0.9);
    ctx.fillRect(0, 0, size, size);
    const battens = 3;
    const spacing = size / battens;
    for (let i = 0; i < battens; i += 1) {
      const x = i * spacing + spacing / 2;
      ctx.fillStyle = gray(0.99);
      ctx.fillRect(x - 10, 0, 20, size);
      ctx.fillStyle = gray(0.66);
      ctx.fillRect(x + 10, 0, 5, size);
      ctx.fillStyle = gray(0.8);
      ctx.fillRect(x - 13, 0, 3, size);
    }
  }, { tileFt: 4, srgb: false });
}

/** Architectural asphalt shingles. */
export function shingleTexture() {
  return makeTexture('shingle', 512, (ctx, size, rand) => {
    ctx.fillStyle = gray(0.45);
    ctx.fillRect(0, 0, size, size);
    const rows = 12;
    const h = size / rows;
    for (let r = 0; r < rows; r += 1) {
      let x = -rand() * 50;
      while (x < size) {
        const w = 18 + rand() * 44;
        const v = 0.55 + rand() * 0.4;
        ctx.fillStyle = gray(v);
        ctx.fillRect(x, r * h, w, h - 4);
        x += w;
      }
      ctx.fillStyle = gray(0.2);
      ctx.fillRect(0, r * h + h - 4, size, 4);
    }
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${0.06 + rand() * 0.08})`;
      ctx.fillRect(rand() * size, rand() * size, 2, 2);
    }
  }, { tileFt: 6, srgb: false });
}

/** Brick skirting below the floor line. */
export function brickTexture() {
  return makeTexture('brick', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#b7b0a6';
    ctx.fillRect(0, 0, size, size);
    const rows = 18;
    const cols = 6;
    const h = size / rows;
    const w = size / cols;
    for (let r = 0; r < rows; r += 1) {
      const offset = r % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c += 1) {
        const tone = 0.75 + rand() * 0.3;
        const red = Math.round(150 * tone);
        const green = Math.round(88 * tone);
        const blue = Math.round(70 * tone);
        ctx.fillStyle = `rgb(${red},${green},${blue})`;
        ctx.fillRect(c * w + offset + 2, r * h + 2, w - 4, h - 4);
      }
    }
  }, { tileFt: 4 });
}

/** Stacked stone veneer for craftsman column piers. */
export function stoneTexture() {
  return makeTexture('stone', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#5b544c';
    ctx.fillRect(0, 0, size, size);
    let y = 0;
    while (y < size) {
      const h = 18 + rand() * 30;
      let x = -rand() * 40;
      while (x < size) {
        const w = 30 + rand() * 80;
        const t = 0.65 + rand() * 0.4;
        ctx.fillStyle = `rgb(${Math.round(150 * t)},${Math.round(138 * t)},${Math.round(122 * t)})`;
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6);
        ctx.fill();
        x += w;
      }
      y += h;
    }
  }, { tileFt: 3 });
}

/** Two-car sectional garage door (UV 0..1 across the door). */
export function garageDoorTexture() {
  return makeTexture('garage', 512, (ctx, size) => {
    ctx.fillStyle = gray(0.95);
    ctx.fillRect(0, 0, size, size);
    const rows = 4;
    const cols = 8;
    const rh = size / rows;
    const cw = size / cols;
    for (let r = 0; r < rows; r += 1) {
      ctx.fillStyle = gray(0.7);
      ctx.fillRect(0, r * rh, size, 3);
      for (let c = 0; c < cols; c += 1) {
        const x = c * cw + 8;
        const y = r * rh + 14;
        const w = cw - 16;
        const h = rh - 28;
        if (r === 0 && c % 2 === 0) {
          ctx.fillStyle = '#29323b';
          ctx.fillRect(x, y + 6, cw * 2 - 16, h - 12);
          ctx.fillStyle = gray(0.95);
          ctx.fillRect(x + cw - 10, y + 6, 4, h - 12);
          continue;
        }
        if (r === 0) continue;
        ctx.fillStyle = gray(0.84);
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = gray(0.99);
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
      }
    }
  }, { srgb: false, unit: true });
}

/** Craftsman entry door with a 6-lite top (UV 0..1). */
export function doorTexture() {
  return makeTexture('door', 256, (ctx, size) => {
    ctx.fillStyle = gray(0.92);
    ctx.fillRect(0, 0, size, size);
    const lite = '#2a333d';
    const lw = size * 0.17;
    const lh = size * 0.08;
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        ctx.fillStyle = lite;
        ctx.fillRect(size * 0.22 + c * (lw + 6), size * 0.1 + r * (lh + 6), lw, lh);
      }
    }
    ctx.fillStyle = gray(0.8);
    ctx.fillRect(size * 0.2, size * 0.42, size * 0.25, size * 0.48);
    ctx.fillRect(size * 0.55, size * 0.42, size * 0.25, size * 0.48);
    ctx.fillStyle = gray(0.97);
    ctx.fillRect(size * 0.22, size * 0.44, size * 0.21, size * 0.44);
    ctx.fillRect(size * 0.57, size * 0.44, size * 0.21, size * 0.44);
    ctx.fillStyle = '#9c8a5a';
    ctx.beginPath();
    ctx.arc(size * 0.86, size * 0.55, 5, 0, Math.PI * 2);
    ctx.fill();
  }, { srgb: false, unit: true });
}

/** Louvered shutter slats. */
export function shutterTexture() {
  return makeTexture('shutter', 128, (ctx, size) => {
    ctx.fillStyle = gray(0.85);
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      ctx.fillStyle = gray(0.6);
      ctx.fillRect(0, y + 6, size, 2);
    }
  }, { tileFt: 1, srgb: false });
}

export function grassTexture() {
  return makeTexture('grass', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#4f7a32';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 26000; i += 1) {
      const t = rand();
      ctx.fillStyle = t < 0.33 ? '#5f8c3a' : t < 0.66 ? '#43692a' : '#6c9a45';
      ctx.fillRect(rand() * size, rand() * size, 1.5, 3 + rand() * 4);
    }
  }, { tileFt: 10 });
}

export function fieldTexture() {
  return makeTexture('field', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#a49a72';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i += 1) {
      const t = rand();
      ctx.fillStyle = t < 0.4 ? '#8f8a5c' : t < 0.75 ? '#b7ab83' : '#7d7a50';
      ctx.fillRect(rand() * size, rand() * size, 2, 2 + rand() * 4);
    }
  }, { tileFt: 40 });
}

export function gravelTexture() {
  return makeTexture('gravel', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#b9a98c';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 9000, ['#a39274', '#cfc1a4', '#8c7d64', '#d9cdb5', '#9c9286'], 1, 3.2);
  }, { tileFt: 5 });
}

export function rockTexture() {
  return makeTexture('rock', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#6e6862';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 2600, ['#837b72', '#5c5751', '#9a9188', '#4c4843'], 3, 7);
  }, { tileFt: 5 });
}

export function mulchTexture() {
  return makeTexture('mulch', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#3f2a1d';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 7000; i += 1) {
      const t = rand();
      ctx.fillStyle = t < 0.4 ? '#5a3b26' : t < 0.75 ? '#2f1f15' : '#6d4a30';
      ctx.save();
      ctx.translate(rand() * size, rand() * size);
      ctx.rotate(rand() * Math.PI);
      ctx.fillRect(0, 0, 6 + rand() * 6, 2);
      ctx.restore();
    }
  }, { tileFt: 4 });
}

/** Concrete with control joints every 5 ft. */
export function concreteTexture() {
  return makeTexture('concrete', 256, (ctx, size, rand) => {
    ctx.fillStyle = '#c4c2bc';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 3000; i += 1) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '60,60,60'},0.06)`;
      ctx.fillRect(rand() * size, rand() * size, 2, 2);
    }
    ctx.fillStyle = '#8f8c86';
    ctx.fillRect(0, 0, size, 2);
    ctx.fillRect(0, 0, 2, size);
  }, { tileFt: 5 });
}

export function asphaltTexture() {
  return makeTexture('asphalt', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#3b3c3e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 16000; i += 1) {
      const t = rand();
      ctx.fillStyle = t < 0.5 ? '#46474a' : t < 0.85 ? '#323335' : '#58595c';
      ctx.fillRect(rand() * size, rand() * size, 1.5, 1.5);
    }
  }, { tileFt: 12 });
}

export function courtTexture() {
  return makeTexture('court', 256, (ctx, size) => {
    ctx.fillStyle = '#3f7a5a';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#3a6ea0';
    ctx.fillRect(size * 0.15, size * 0.15, size * 0.7, size * 0.7);
  }, { tileFt: 60 });
}

/** Dappled leaf clusters for tree canopies (tinted per tree). */
export function foliageTexture() {
  return makeTexture('foliage', 256, (ctx, size, rand) => {
    ctx.fillStyle = gray(0.62);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1400; i += 1) {
      const v = 0.35 + rand() * 0.75;
      ctx.fillStyle = gray(Math.min(1, v));
      ctx.beginPath();
      ctx.ellipse(rand() * size, rand() * size, 2 + rand() * 5, 1.5 + rand() * 3, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { srgb: false, unit: true });
}

/** Rear entry door: 9-lite glass upper half over two short panels (UV 0..1). */
export function nineLiteDoorTexture() {
  return makeTexture('door9', 256, (ctx, size) => {
    ctx.fillStyle = gray(0.92);
    ctx.fillRect(0, 0, size, size);
    const x0 = size * 0.2;
    const w = size * 0.6;
    const y0 = size * 0.08;
    const h = size * 0.42;
    ctx.fillStyle = gray(0.98);
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        ctx.fillStyle = '#2a333d';
        ctx.fillRect(x0 + c * (w / 3) + 3, y0 + r * (h / 3) + 3, w / 3 - 6, h / 3 - 6);
      }
    }
    ctx.fillStyle = gray(0.8);
    ctx.fillRect(size * 0.2, size * 0.62, size * 0.25, size * 0.3);
    ctx.fillRect(size * 0.55, size * 0.62, size * 0.25, size * 0.3);
    ctx.fillStyle = gray(0.97);
    ctx.fillRect(size * 0.22, size * 0.64, size * 0.21, size * 0.26);
    ctx.fillRect(size * 0.57, size * 0.64, size * 0.21, size * 0.26);
    ctx.fillStyle = '#9c8a5a';
    ctx.beginPath();
    ctx.arc(size * 0.86, size * 0.55, 5, 0, Math.PI * 2);
    ctx.fill();
  }, { srgb: false, unit: true });
}
