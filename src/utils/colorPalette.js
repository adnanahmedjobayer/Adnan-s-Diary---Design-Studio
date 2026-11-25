const SOLIDS_KEY = 'adnans_global_solids_v1';
const GRADIENTS_KEY = 'adnans_global_gradients_v1';
const PALETTE_EVENT = 'adnans-palette-updated';

let canvasSamplerFn = null;

export function registerCanvasSampler(fn) {
  canvasSamplerFn = fn;
}

export async function sampleCurrentCanvas() {
  if (!canvasSamplerFn) return null;
  return await canvasSamplerFn();
}

export function normalizeHex(input = '') {
  const clean = String(input).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    );
  }
  return null;
}

export const DEFAULT_SOLIDS = [
  '#f8fafc', '#cbd5e1', '#94a3b8', '#1e293b', '#0f172a',
  '#fda4af', '#f43f5e', '#fde047', '#f59e0b', '#38bdf8',
  '#3b82f6', '#c4b5fd', '#86efac', '#fdba74'
];

export const DEFAULT_GRADIENTS = [
  {
    id: 'dg-rose',
    label: 'রোজ',
    type: 'linear',
    angle: 135,
    stops: [{ color: '#fda4af', pos: 0 }, { color: '#c084fc', pos: 100 }]
  },
  {
    id: 'dg-ocean',
    label: 'ওশান',
    type: 'linear',
    angle: 135,
    stops: [{ color: '#38bdf8', pos: 0 }, { color: '#1d4ed8', pos: 100 }]
  },
  {
    id: 'dg-sunset',
    label: 'সানসেট',
    type: 'linear',
    angle: 135,
    stops: [{ color: '#fde047', pos: 0 }, { color: '#f43f5e', pos: 100 }]
  },
  {
    id: 'dg-gold',
    label: 'গোল্ড',
    type: 'linear',
    angle: 180,
    stops: [{ color: '#fef08a', pos: 0 }, { color: '#ca8a04', pos: 100 }]
  },
  {
    id: 'dg-midnight',
    label: 'মিডনাইট',
    type: 'radial',
    cx: 50,
    cy: 50,
    stops: [{ color: '#1e1b4b', pos: 0 }, { color: '#090d16', pos: 100 }]
  },
  {
    id: 'dg-emerald',
    label: 'পান্না',
    type: 'linear',
    angle: 135,
    stops: [{ color: '#6ee7b7', pos: 0 }, { color: '#047857', pos: 100 }]
  },
  {
    id: 'dg-royal',
    label: 'রয়্যাল',
    type: 'linear',
    angle: 135,
    stops: [{ color: '#a855f7', pos: 0 }, { color: '#3b82f6', pos: 100 }]
  },
  {
    id: 'dg-fire',
    label: 'ফায়ার',
    type: 'linear',
    angle: 180,
    stops: [{ color: '#fb923c', pos: 0 }, { color: '#be123c', pos: 100 }]
  },
  {
    id: 'dg-ice',
    label: 'আইস',
    type: 'radial',
    cx: 50,
    cy: 50,
    stops: [{ color: '#ffffff', pos: 0 }, { color: '#38bdf8', pos: 100 }]
  },
  {
    id: 'dg-velvet',
    label: 'ভেলভেট',
    type: 'linear',
    angle: 135,
    stops: [{ color: '#4c0519', pos: 0 }, { color: '#1e1b2e', pos: 100 }]
  }
];

export function gradientToCss(grad) {
  if (!grad) return 'linear-gradient(135deg, #fda4af 0%, #38bdf8 100%)';
  if (typeof grad === 'string') return grad;
  const stops =
    Array.isArray(grad.stops) && grad.stops.length >= 2
      ? grad.stops
      : [
          { color: grad.color1 || '#fda4af', pos: 0 },
          { color: grad.color2 || '#38bdf8', pos: 100 }
        ];
  const stopStr = stops
    .map((s, idx) => `${s.color} ${s.pos ?? Math.round((idx / (stops.length - 1)) * 100)}%`)
    .join(', ');

  if (grad.type === 'radial') {
    const cx = grad.cx ?? 50;
    const cy = grad.cy ?? 50;
    return `radial-gradient(circle at ${cx}% ${cy}%, ${stopStr})`;
  }
  const ang = grad.angle ?? 135;
  return `linear-gradient(${ang}deg, ${stopStr})`;
}

function splitTopLevelArgs(inner) {
  const parts = [];
  let cur = '';
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function parseGradientCss(cssStr = '') {
  if (typeof cssStr !== 'string') return null;
  const isRadial = cssStr.includes('radial-gradient');
  const isLinear = cssStr.includes('linear-gradient');
  if (!isRadial && !isLinear) return null;

  const startIdx = cssStr.indexOf('(');
  const endIdx = cssStr.lastIndexOf(')');
  if (startIdx === -1 || endIdx <= startIdx) return null;

  const args = splitTopLevelArgs(cssStr.slice(startIdx + 1, endIdx));
  if (!args.length) return null;

  let angle = 180;
  let cx = 50;
  let cy = 50;
  let stopStartIdx = 0;

  const first = args[0];
  if (isRadial) {
    if (!first.startsWith('#') && !first.startsWith('rgb') && !first.startsWith('hsl')) {
      const atMatch = first.match(/at\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/i);
      if (atMatch) {
        cx = parseFloat(atMatch[1]);
        cy = parseFloat(atMatch[2]);
      }
      stopStartIdx = 1;
    }
  } else if (!first.startsWith('#') && !first.startsWith('rgb') && !first.startsWith('hsl')) {
    const angleMatch = first.match(/(-?\d+(?:\.\d+)?)deg/i);
    if (angleMatch) angle = parseFloat(angleMatch[1]);
    stopStartIdx = 1;
  }

  const rawStops = args.slice(stopStartIdx);
  if (rawStops.length < 2) return null;

  const stops = rawStops.map((item, idx) => {
    const colMatch = item.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)/i);
    const posMatch = item.match(/(-?\d+(?:\.\d+)?)%\s*$/);
    return {
      color: colMatch ? colMatch[0] : '#ffffff',
      pos: posMatch ? parseFloat(posMatch[1]) : Math.round((idx / (rawStops.length - 1)) * 100)
    };
  });

  return {
    type: isRadial ? 'radial' : 'linear',
    angle,
    cx,
    cy,
    stops
  };
}

export function parseLinearGradient(cssStr = '') {
  return parseGradientCss(cssStr);
}

function notifyPaletteChange() {
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT));
}

export function subscribePalette(cb) {
  window.addEventListener(PALETTE_EVENT, cb);
  return () => window.removeEventListener(PALETTE_EVENT, cb);
}

export function getUserSolids() {
  try {
    const raw = localStorage.getItem(SOLIDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserSolid(hex) {
  const clean = normalizeHex(hex) || (hex || '').toLowerCase();
  if (!clean) return;
  const list = getUserSolids().filter((c) => c.toLowerCase() !== clean);
  if (DEFAULT_SOLIDS.some((c) => c.toLowerCase() === clean)) return;
  const next = [clean, ...list].slice(0, 40);
  try {
    localStorage.setItem(SOLIDS_KEY, JSON.stringify(next));
  } catch {}
  notifyPaletteChange();
}

export function deleteUserSolid(hex) {
  const clean = (hex || '').toLowerCase();
  const next = getUserSolids().filter((c) => c.toLowerCase() !== clean);
  try {
    localStorage.setItem(SOLIDS_KEY, JSON.stringify(next));
  } catch {}
  notifyPaletteChange();
}

export function getUserGradients() {
  try {
    const raw = localStorage.getItem(GRADIENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserGradient(grad) {
  const type = grad.type === 'radial' ? 'radial' : 'linear';
  const stops =
    Array.isArray(grad.stops) && grad.stops.length >= 2
      ? grad.stops
      : [
          { color: grad.color1 || '#fda4af', pos: 0 },
          { color: grad.color2 || '#38bdf8', pos: 100 }
        ];
  const item = {
    id: grad.id || `ug-${Date.now()}`,
    type,
    angle: grad.angle ?? 135,
    cx: grad.cx ?? 50,
    cy: grad.cy ?? 50,
    stops,
    css: grad.css || undefined
  };
  const css = item.css || gradientToCss(item);
  const existing = getUserGradients().filter((g) => (g.css || gradientToCss(g)) !== css);
  const next = [item, ...existing].slice(0, 30);
  try {
    localStorage.setItem(GRADIENTS_KEY, JSON.stringify(next));
  } catch {}
  notifyPaletteChange();
  return { ...item, css };
}

export function deleteUserGradient(id) {
  const next = getUserGradients().filter((g) => g.id !== id);
  try {
    localStorage.setItem(GRADIENTS_KEY, JSON.stringify(next));
  } catch {}
  notifyPaletteChange();
}
