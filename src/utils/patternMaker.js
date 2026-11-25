export const PATTERN_LIST = [
  { id: 'none', label: 'বন্ধ' },
  { id: 'diary', label: 'ডায়েরি পেজ' },
  { id: 'ruled', label: 'রুলড লাইন' },
  { id: 'graph', label: 'গ্রাফ পেপার' },
  { id: 'dots', label: 'ডট বুলেট' },
  { id: 'checker', label: 'চেকার' },
  { id: 'diagonal', label: 'ডায়াগোনাল' },
  { id: 'islamic', label: 'ইসলামিক গ্রিড' },
  { id: 'grain', label: 'ফিল্ম গ্রেন' }
];

export const DEFAULT_PATTERN = {
  id: 'none',
  color: '#94a3b8',
  opacity: 28,
  size: 24,
  thickness: 1
};

const tileCache = new Map();

function hexToRgb(hex = '#94a3b8') {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '8');
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getCachedTile(pat) {
  if (!pat || !pat.id || pat.id === 'none') return null;
  const norm = {
    id: pat.id,
    color: pat.color || '#94a3b8',
    opacity: Math.max(4, Math.min(90, pat.opacity ?? 28)),
    size: Math.max(10, Math.min(70, pat.size ?? 24)),
    thickness: Math.max(0.5, Math.min(5, pat.thickness ?? 1))
  };
  const key = JSON.stringify(norm);
  if (tileCache.has(key)) return tileCache.get(key);

  const { r, g, b } = hexToRgb(norm.color);
  const alpha = norm.opacity / 100;
  const strokeCol = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const s = norm.size;
  const t = norm.thickness;

  const canvas = document.createElement('canvas');
  let ctx = null;

  if (norm.id === 'diary' || norm.id === 'ruled') {
    canvas.width = s;
    canvas.height = s;
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = t;
    ctx.beginPath();
    ctx.moveTo(0, s - t / 2);
    ctx.lineTo(s, s - t / 2);
    ctx.stroke();
  } else if (norm.id === 'graph') {
    const big = s * 2;
    canvas.width = big;
    canvas.height = big;
    ctx = canvas.getContext('2d');
    const sub = s / 2;
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.42).toFixed(3)})`;
    ctx.lineWidth = Math.max(0.75, t * 0.65);
    for (let i = 1; i < 4; i++) {
      const p = i * sub;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, big);
      ctx.moveTo(0, p);
      ctx.lineTo(big, p);
      ctx.stroke();
    }
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = t;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, big);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(big, 0.5);
    ctx.stroke();
  } else if (norm.id === 'dots') {
    canvas.width = s;
    canvas.height = s;
    ctx = canvas.getContext('2d');
    ctx.fillStyle = strokeCol;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, Math.max(1, t * 1.15), 0, Math.PI * 2);
    ctx.fill();
  } else if (norm.id === 'checker') {
    const big = s * 2;
    canvas.width = big;
    canvas.height = big;
    ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.65).toFixed(3)})`;
    ctx.fillRect(0, 0, s, s);
    ctx.fillRect(s, s, s, s);
  } else if (norm.id === 'diagonal') {
    canvas.width = s;
    canvas.height = s;
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = t;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.5);
    ctx.lineTo(s * 0.5, -s * 0.5);
    ctx.moveTo(0, s);
    ctx.lineTo(s, 0);
    ctx.moveTo(s * 0.5, s * 1.5);
    ctx.lineTo(s * 1.5, s * 0.5);
    ctx.stroke();
  } else if (norm.id === 'islamic') {
    const big = Math.max(28, Math.round(s * 1.6));
    canvas.width = big;
    canvas.height = big;
    ctx = canvas.getContext('2d');
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = t;
    const h = big / 2;
    const m = big * 0.18;
    const n = big - m;
    const o = big * 0.06;

    // ডায়মন্ড + ৮-কোণা জালি
    ctx.beginPath();
    ctx.moveTo(h, o);
    ctx.lineTo(big - o, h);
    ctx.lineTo(h, big - o);
    ctx.lineTo(o, h);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeRect(m, m, n - m, n - m);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(m, m);
    ctx.moveTo(big, 0);
    ctx.lineTo(n, m);
    ctx.moveTo(big, big);
    ctx.lineTo(n, n);
    ctx.moveTo(0, big);
    ctx.lineTo(m, n);
    ctx.moveTo(h, 0);
    ctx.lineTo(h, o);
    ctx.moveTo(big, h);
    ctx.lineTo(big - o, h);
    ctx.moveTo(h, big);
    ctx.lineTo(h, big - o);
    ctx.moveTo(0, h);
    ctx.lineTo(o, h);
    ctx.stroke();
  } else if (norm.id === 'grain') {
    const dim = 128;
    canvas.width = dim;
    canvas.height = dim;
    ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(dim, dim);
    const d = imgData.data;
    let seed = 1337;
    for (let i = 0; i < d.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const rv = (seed >>> 24) / 255;
      if (rv > 0.45) {
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = Math.round(255 * alpha * ((rv - 0.45) / 0.55));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else {
    return null;
  }

  const entry = {
    canvas,
    dataUrl: canvas.toDataURL('image/png'),
    w: canvas.width,
    h: canvas.height,
    alpha,
    t
  };

  if (tileCache.size >= 30) {
    const oldest = tileCache.keys().next().value;
    tileCache.delete(oldest);
  }
  tileCache.set(key, entry);
  return entry;
}

export function getPatternCssStyle(pattern) {
  const entry = getCachedTile(pattern);
  if (!entry) return null;

  if (pattern.id === 'diary') {
    const marginA = Math.min(0.85, entry.alpha * 1.45).toFixed(2);
    const mw = Math.max(1, entry.t);
    return {
      backgroundImage: `linear-gradient(to right, transparent 11.5%, rgba(244,63,94,${marginA}) 11.5%, rgba(244,63,94,${marginA}) calc(11.5% + ${mw}px), transparent calc(11.5% + ${mw}px)), url(${entry.dataUrl})`,
      backgroundSize: `100% 100%, ${entry.w}px ${entry.h}px`,
      backgroundRepeat: 'no-repeat, repeat'
    };
  }

  const scaleFactor = pattern.id === 'grain' ? Math.max(0.7, (pattern.size ?? 24) / 24) : 1;
  return {
    backgroundImage: `url(${entry.dataUrl})`,
    backgroundSize: `${Math.round(entry.w * scaleFactor)}px ${Math.round(entry.h * scaleFactor)}px`,
    backgroundRepeat: 'repeat'
  };
}

export function drawPatternOnCanvas(ctx, pattern, outW, outH, scale) {
  const entry = getCachedTile(pattern);
  if (!entry) return;

  const pat = ctx.createPattern(entry.canvas, 'repeat');
  if (!pat) return;

  const grainScale = pattern.id === 'grain' ? Math.max(0.7, (pattern.size ?? 24) / 24) : 1;
  const totalScale = scale * grainScale;

  if (pat.setTransform && typeof DOMMatrix !== 'undefined') {
    pat.setTransform(new DOMMatrix().scale(totalScale));
  }

  ctx.save();
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, outW, outH);

  if (pattern.id === 'diary') {
    const mx = outW * 0.115;
    ctx.strokeStyle = `rgba(244, 63, 94, ${Math.min(0.85, entry.alpha * 1.45).toFixed(2)})`;
    ctx.lineWidth = Math.max(1, entry.t * scale);
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx, outH);
    ctx.stroke();
  }
  ctx.restore();
}
