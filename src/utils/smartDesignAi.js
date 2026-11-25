import { parseGradientCss } from './colorPalette';

function parseColorRgb(colorStr = '') {
  if (typeof colorStr !== 'string') return null;
  const s = colorStr.trim();
  const hexMatch = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return { r: Number(rgbMatch[1]), g: Number(rgbMatch[2]), b: Number(rgbMatch[3]) };
  }
  return null;
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  };
}

function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function getLuminance(rgb) {
  if (!rgb) return 0.5;
  const toLin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b);
}

function contrastRatio(lum1, lum2) {
  const hi = Math.max(lum1, lum2);
  const lo = Math.min(lum1, lum2);
  return (hi + 0.05) / (lo + 0.05);
}

function ensureReadableColor(h, s, bgLum, preferDark) {
  const startL = preferDark ? 24 : 84;
  const step = preferDark ? -6 : 5;
  for (let i = 0; i < 8; i++) {
    const l = Math.max(8, Math.min(96, startL + i * step));
    const rgb = hslToRgb(h, s, l);
    if (contrastRatio(getLuminance(rgb), bgLum) >= 4.4) {
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }
  }
  return preferDark ? '#0f172a' : '#f8fafc';
}

function resolvePrimaryTextColor(layer) {
  if (layer.colorMode === 'gradient') {
    if (layer.gradCss) {
      const p = parseGradientCss(layer.gradCss);
      if (p?.stops?.[0]?.color) return p.stops[0].color;
    }
    if (layer.gradStops?.[0]?.color) return layer.gradStops[0].color;
    if (layer.gradColor1) return layer.gradColor1;
  }
  return layer.color || '#f8fafc';
}

async function sampleBackgroundPixels(bgConfig, canvasSize) {
  const cw = canvasSize?.width || 1080;
  const ch = canvasSize?.height || 1080;
  const ratio = cw / ch;
  const w = ratio >= 1 ? 120 : Math.max(54, Math.round(120 * ratio));
  const h = ratio >= 1 ? Math.max(54, Math.round(120 / ratio)) : 120;

  if (!bgConfig || bgConfig.transparent) {
    return { transparent: true, w, h, data: null, globalLum: 0.14 };
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const gradStr = bgConfig.gradient || '';
  const parsed = parseGradientCss(gradStr);
  if (parsed && parsed.stops.length >= 2) {
    let g;
    if (parsed.type === 'radial') {
      const cx = ((parsed.cx ?? 50) / 100) * w;
      const cy = ((parsed.cy ?? 50) / 100) * h;
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.7);
    } else {
      const rad = (((parsed.angle ?? 180) - 90) * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      g = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    }
    parsed.stops.forEach((st, i) => {
      const pos = Math.max(0, Math.min(1, (st.pos ?? i / (parsed.stops.length - 1)) / 100));
      g.addColorStop(pos, st.color);
    });
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = gradStr || '#121722';
  }
  ctx.fillRect(0, 0, w, h);

  if (bgConfig.useImage && bgConfig.imageSrc) {
    try {
      const img = new Image();
      if (!bgConfig.imageSrc.startsWith('data:') && !bgConfig.imageSrc.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.src = bgConfig.imageSrc;
      await img.decode();
      ctx.save();
      ctx.globalAlpha = bgConfig.imageOpacity ?? 0.65;
      ctx.filter = `brightness(${bgConfig.brightness ?? 85}%) contrast(${bgConfig.contrast ?? 110}%)`;
      const imgR = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      const outR = w / h;
      let dw = w, dh = h, dx = 0, dy = 0;
      if (imgR > outR) {
        dw = h * imgR;
        dx = (w - dw) / 2;
      } else {
        dh = w / imgR;
        dy = (h - dh) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    } catch {}
  }

  if (bgConfig.overlayGradient !== 'none') {
    const ov = bgConfig.overlayGradient || '';
    let innerA = 0.15, outerA = 0.78;
    if (ov.includes('0.45')) { innerA = 0.05; outerA = 0.45; }
    else if (ov.includes('0.92')) { innerA = 0.22; outerA = 0.92; }
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, `rgba(0,0,0,${innerA})`);
    vg.addColorStop(1, `rgba(0,0,0,${outerA})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  let data = null;
  let globalLum = 0.16;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    const count = w * h;
    for (let i = 0; i < data.length; i += 4) {
      sum += getLuminance({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
    globalLum = sum / Math.max(1, count);
  } catch {}

  return { transparent: false, w, h, data, globalLum, ctx };
}

function sampleRegionStats(bgSample, box) {
  if (!bgSample.data) {
    return { avgLum: bgSample.globalLum, variance: 0 };
  }
  const { w, h, data } = bgSample;
  const x0 = Math.max(0, Math.floor(((box.x - box.wPct / 2) / 100) * w));
  const x1 = Math.min(w - 1, Math.ceil(((box.x + box.wPct / 2) / 100) * w));
  const y0 = Math.max(0, Math.floor(((box.y - box.hPct / 2) / 100) * h));
  const y1 = Math.min(h - 1, Math.ceil(((box.y + box.hPct / 2) / 100) * h));

  let sum = 0;
  let sumSq = 0;
  let cnt = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = (y * w + x) * 4;
      const lum = getLuminance({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      sum += lum;
      sumSq += lum * lum;
      cnt++;
    }
  }
  if (!cnt) return { avgLum: bgSample.globalLum, variance: 0 };
  const mean = sum / cnt;
  return { avgLum: mean, variance: Math.max(0, sumSq / cnt - mean * mean) };
}

function extractSmartPalette(bgSample) {
  const isDark = bgSample.globalLum < 0.45;
  let accentHue = 38;
  let accentSat = 85;
  let foundVibrant = false;

  if (bgSample.data) {
    const bins = new Float32Array(12);
    const satSum = new Float32Array(12);
    const data = bgSample.data;
    for (let i = 0; i < data.length; i += 8) {
      const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      if (hsl.s >= 22 && hsl.l >= 12 && hsl.l <= 88) {
        const b = Math.floor(hsl.h / 30) % 12;
        bins[b] += hsl.s;
        satSum[b] += 1;
        foundVibrant = true;
      }
    }
    if (foundVibrant) {
      let bestBin = 0;
      for (let i = 1; i < 12; i++) {
        if (bins[i] > bins[bestBin]) bestBin = i;
      }
      accentHue = bestBin * 30 + 15;
      accentSat = Math.min(92, Math.max(58, bins[bestBin] / Math.max(1, satSum[bestBin])));
    }
  }

  const baseNeutral = isDark ? '#f8fafc' : '#0f172a';
  const warmAccent = ensureReadableColor(foundVibrant ? accentHue : 42, accentSat, bgSample.globalLum, !isDark);
  const compAccent = ensureReadableColor((accentHue + 180) % 360, 76, bgSample.globalLum, !isDark);
  const softTone = ensureReadableColor((accentHue + 35) % 360, 68, bgSample.globalLum, !isDark);
  const roseHighlight = ensureReadableColor(348, 82, bgSample.globalLum, !isDark);

  const seen = new Set();
  const palette = [];
  const pushCol = (hex, label) => {
    const low = hex.toLowerCase();
    if (seen.has(low)) return;
    seen.add(low);
    palette.push({ hex, label });
  };

  pushCol(baseNeutral, isDark ? 'স্পষ্ট সাদা' : 'স্পষ্ট কালো');
  pushCol(warmAccent, foundVibrant ? 'থিম অ্যাকসেন্ট' : 'গোল্ডেন');
  pushCol(compAccent, 'কনট্রাস্ট');
  pushCol(softTone, 'সফট টোন');
  pushCol(roseHighlight, 'রোজ');

  const shapeAccentColor = hslToHex(accentHue, Math.max(45, accentSat * 0.85), isDark ? 70 : 38);
  return { palette, shapeAccentColor, isDark };
}

function estimateLayerBounds(layer, previewW, previewH, ctx) {
  if (layer.type === 'text') {
    const fSize = layer.fontSize || 22;
    const padX = layer.paddingX ?? 0;
    const padY = layer.paddingY ?? 0;
    let measuredW = 140;
    let linesCount = (layer.text || '').split('\n').length;

    if (ctx) {
      ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold === false ? 400 : 700} ${fSize}px "${layer.font || 'sans-serif'}", sans-serif`;
      const maxAllow = (layer.width || previewW * 0.92) - padX * 2;
      const rawLines = (layer.text || ' ').split('\n');
      let maxW = 40;
      let totalLines = 0;
      for (const rl of rawLines) {
        const w = ctx.measureText(rl || ' ').width;
        maxW = Math.max(maxW, w);
        totalLines += Math.max(1, Math.ceil(w / Math.max(40, maxAllow)));
      }
      measuredW = layer.width || Math.min(previewW * 0.92, maxW + padX * 2);
      linesCount = totalLines;
    }

    const estW = Math.max(36, measuredW);
    const estH = Math.max(fSize, linesCount * fSize * (layer.lineHeight ?? 1.2) + padY * 2);
    const wPct = (estW / previewW) * 100;
    const hPct = (estH / previewH) * 100;
    return { x: layer.x, y: layer.y, wPct, hPct };
  }

  const w = layer.width || 110;
  const h = layer.height || layer.width || 110;
  return {
    x: layer.x,
    y: layer.y,
    wPct: (w / previewW) * 100,
    hPct: (h / previewH) * 100
  };
}

function computeRecommendedFontSize(layer, previewW) {
  const len = (layer.text || '').trim().length;
  const lines = (layer.text || '').split('\n').length;
  const scaleFactor = previewW / 330;
  let base = 22;
  if (len <= 18 && lines === 1) base = 28;
  else if (len <= 45) base = 22;
  else if (len <= 95) base = 18;
  else base = 15;
  return Math.max(13, Math.min(42, Math.round(base * scaleFactor)));
}

export async function runSmartDesignAi({
  bgConfig,
  layers = [],
  canvasSize = { width: 1080, height: 1080 },
  selectedId = null
}) {
  const cw = canvasSize?.width || 1080;
  const ch = canvasSize?.height || 1080;
  const ratio = cw / ch;
  const previewW = ratio >= 1 ? 330 : Math.max(140, Math.round(330 * ratio));
  const previewH = ratio >= 1 ? Math.max(140, Math.round(330 / ratio)) : 330;

  const bgSample = await sampleBackgroundPixels(bgConfig, canvasSize);
  const { palette, shapeAccentColor, isDark } = extractSmartPalette(bgSample);
  const visibleLayers = layers.filter((l) => l.visible !== false);
  const textLayers = visibleLayers.filter((l) => l.type === 'text');

  const boundsMap = new Map();
  for (const l of visibleLayers) {
    boundsMap.set(l.id, estimateLayerBounds(l, previewW, previewH, bgSample.ctx));
  }

  const issues = [];

  // ১. পিক্সেল-ভিত্তিক কনট্রাস্ট ও ব্যস্ত ব্যাকগ্রাউন্ড চেক
  const lowContrastFixes = [];
  for (const l of textLayers) {
    if (l.locked || l.textureSrc) continue;
    const b = boundsMap.get(l.id);
    const region = sampleRegionStats(bgSample, b);
    const textRgb = parseColorRgb(resolvePrimaryTextColor(l));
    if (!textRgb) continue;

    let surfaceLum = region.avgLum;
    if (l.textBgEnabled && l.textBgColor) {
      const boxRgb = parseColorRgb(l.textBgColor);
      if (boxRgb) surfaceLum = getLuminance(boxRgb);
    }

    const cr = contrastRatio(getLuminance(textRgb), surfaceLum);
    const localDark = surfaceLum < 0.45;
    const busyPhoto = !l.textBgEnabled && bgConfig?.useImage && region.variance > 0.025 && (l.fontSize || 22) < 24;
    const hasProtection = l.shadow || (l.strokeEnabled && (l.strokeWidth ?? 2) >= 2);

    if (cr < 3.5 || (busyPhoto && !hasProtection)) {
      const bestHex = localDark ? palette[0]?.hex || '#f8fafc' : '#0f172a';
      lowContrastFixes.push({ id: l.id, bestHex, localDark });
    }
  }

  if (lowContrastFixes.length > 0) {
    issues.push({
      id: 'smart-contrast',
      severity: 'high',
      title: 'লেখার কনট্রাস্ট বা পঠনযোগ্যতা দুর্বল',
      desc: `${lowContrastFixes.length}টি লেখার পেছনের অংশের তুলনায় রঙ কম স্পষ্ট। মানানসই রঙ ও হালকা শ্যাডো দিলে একদম পরিষ্কার দেখাবে।`,
      fixLabel: 'স্পষ্ট করুন',
      apply: (curLayers) =>
        curLayers.map((l) => {
          const hit = lowContrastFixes.find((x) => x.id === l.id);
          if (!hit) return l;
          return {
            ...l,
            colorMode: 'solid',
            textureSrc: null,
            color: hit.bestHex,
            shadow: true,
            shadowColor: hit.localDark ? 'rgba(0,0,0,0.88)' : 'rgba(255,255,255,0.65)',
            shadowBlur: 10,
            shadowY: 3
          };
        })
    });
  }

  // ২. ফন্ট সাইজ ও হেডিং-সাবটাইটেল হায়ারার্কি চেক
  const unlockedTexts = textLayers.filter((l) => !l.locked);
  if (unlockedTexts.length === 1) {
    const t = unlockedTexts[0];
    const ideal = computeRecommendedFontSize(t, previewW);
    const curS = t.fontSize || 22;
    if (curS < 14 || Math.abs(curS - ideal) >= 9) {
      issues.push({
        id: 'smart-single-size',
        severity: 'low',
        title: `আদর্শ ফন্ট সাইজ হতে পারে ~${ideal}px`,
        desc: `বর্তমানে সাইজ ${curS}px আছে। লেখার দৈর্ঘ্য ও ক্যানভাস অনুযায়ী ${ideal}px রাখলে আরও সুন্দর মানাবে।`,
        fixLabel: `${ideal}px করুন`,
        apply: (curLayers) =>
          curLayers.map((l) => (l.id === t.id ? { ...l, fontSize: ideal } : l))
      });
    }
  } else if (unlockedTexts.length >= 2) {
    const byTop = [...unlockedTexts].sort((a, b) => a.y - b.y);
    const sizes = unlockedTexts.map((l) => l.fontSize || 22);
    const maxS = Math.max(...sizes);
    const minS = Math.min(...sizes);
    if (maxS - minS < 4) {
      const head = byTop[0];
      const sub = byTop[1];
      const headIdeal = Math.max(22, Math.min(36, computeRecommendedFontSize(head, previewW) + 2));
      const subIdeal = Math.max(14, Math.min(headIdeal - 6, Math.round(headIdeal * 0.68)));
      issues.push({
        id: 'smart-hierarchy',
        severity: 'medium',
        title: 'দুটি লেখার সাইজ প্রায় সমান',
        desc: `ওপরের মূল লেখা (${headIdeal}px) ও নিচের লেখা (${subIdeal}px) আলাদা সাইজে রাখলে ডিজাইনে প্রফেশনাল ব্যালেন্স আসবে।`,
        fixLabel: 'সাইজ ব্যালেন্স',
        apply: (curLayers) =>
          curLayers.map((l) => {
            if (l.id === head.id) return { ...l, fontSize: headIdeal };
            if (l.id === sub.id) return { ...l, fontSize: subIdeal, opacity: 0.9 };
            return l;
          })
      });
    }
  }

  // ৩. টেক্সট ওভারল্যাপ (একটার ওপর আরেকটা উঠে যাওয়া) চেক
  const overlapPairs = [];
  for (let i = 0; i < unlockedTexts.length; i++) {
    for (let j = i + 1; j < unlockedTexts.length; j++) {
      const a = unlockedTexts[i];
      const b = unlockedTexts[j];
      const ba = boundsMap.get(a.id);
      const bb = boundsMap.get(b.id);
      const xOverlap = Math.min(ba.x + ba.wPct / 2, bb.x + bb.wPct / 2) - Math.max(ba.x - ba.wPct / 2, bb.x - bb.wPct / 2);
      const yOverlap = Math.min(ba.y + ba.hPct / 2, bb.y + bb.hPct / 2) - Math.max(ba.y - ba.hPct / 2, bb.y - bb.hPct / 2);
      if (xOverlap > 6 && yOverlap > 1.5) {
        overlapPairs.push({ a, b, ba, bb, yOverlap });
      }
    }
  }
  if (overlapPairs.length > 0) {
    const pair = overlapPairs[0];
    const upper = pair.ba.y <= pair.bb.y ? pair.a : pair.b;
    const lower = pair.ba.y <= pair.bb.y ? pair.b : pair.a;
    const shift = Math.max(5, Math.min(18, Math.ceil(pair.yOverlap / 2 + 2.5)));
    issues.push({
      id: 'smart-overlap',
      severity: 'high',
      title: 'দুটি লেখা একসাথে মিশে (Overlap) গেছে',
      desc: 'দুটি টেক্সট লেয়ার একে অপরের ওপর চলে আসায় পড়তে অসুবিধা হতে পারে। সামান্য ফাঁকা করে বসান।',
      fixLabel: 'ফাঁকা করুন',
      apply: (curLayers) =>
        curLayers.map((l) => {
          if (l.id === upper.id) return { ...l, y: Math.max(8, Number((l.y - shift).toFixed(1))) };
          if (l.id === lower.id) return { ...l, y: Math.min(92, Number((l.y + shift).toFixed(1))) };
          return l;
        })
    });
  }

  // ৪. প্রকৃত বক্স অনুযায়ী সেফ-মার্জিন চেক
  const edgeFixList = [];
  for (const l of visibleLayers) {
    if (l.locked) continue;
    const b = boundsMap.get(l.id);
    const halfW = Math.min(44, b.wPct / 2);
    const halfH = Math.min(44, b.hPct / 2);
    if (b.x - halfW < 3 || b.x + halfW > 97 || b.y - halfH < 3 || b.y + halfH > 97) {
      edgeFixList.push({
        id: l.id,
        nx: Math.max(halfW + 4, Math.min(96 - halfW, b.x)),
        ny: Math.max(halfH + 4, Math.min(96 - halfH, b.y))
      });
    }
  }
  if (edgeFixList.length > 0) {
    issues.push({
      id: 'smart-safe-margin',
      severity: 'medium',
      title: 'কিনারার খুব কাছে লেয়ার আছে',
      desc: `${edgeFixList.length}টি লেয়ার ক্যানভাসের বর্ডার ঘেঁষে থাকায় সেভ করলে কেটে যাওয়ার ঝুঁকি আছে।`,
      fixLabel: 'ভেতরে আনুন',
      apply: (curLayers) =>
        curLayers.map((l) => {
          const hit = edgeFixList.find((x) => x.id === l.id);
          return hit ? { ...l, x: Number(hit.nx.toFixed(1)), y: Number(hit.ny.toFixed(1)) } : l;
        })
    });
  }

  // ৫. সামান্য বাঁকা সেন্টার-স্ন্যাপ (শুধু ০.৮% থেকে ৪.৫% এর মধ্যে হলে)
  const nearCenterIds = visibleLayers
    .filter((l) => !l.locked && Math.abs(l.x - 50) > 0.8 && Math.abs(l.x - 50) <= 4.5)
    .map((l) => l.id);
  if (nearCenterIds.length > 0) {
    issues.push({
      id: 'smart-center',
      severity: 'low',
      title: 'মাঝখান থেকে সামান্য সরে আছে',
      desc: `${nearCenterIds.length}টি লেয়ার ঠিক সেন্টার থেকে সামান্য সরে আছে।`,
      fixLabel: 'মাঝে আনুন',
      apply: (curLayers) =>
        curLayers.map((l) => (nearCenterIds.includes(l.id) ? { ...l, x: 50 } : l))
    });
  }

  // লক্ষ্য (Target) লেয়ার ঠিক করা (কালার ও সাইজ সাজেশনের জন্য)
  const selectedLayer = visibleLayers.find((l) => l.id === selectedId && !l.locked) || null;
  const targetColorLayer =
    (selectedLayer && (selectedLayer.type === 'text' || selectedLayer.type === 'shape')
      ? selectedLayer
      : null) ||
    unlockedTexts[0] ||
    visibleLayers.find((l) => l.type === 'shape' && !l.locked) ||
    null;

  const targetTextLayer =
    (selectedLayer?.type === 'text' ? selectedLayer : null) || unlockedTexts[0] || null;

  const idealForTarget = targetTextLayer
    ? computeRecommendedFontSize(targetTextLayer, previewW)
    : 22;

  const sizeOptions = targetTextLayer
    ? [
        { label: 'ছোট', size: Math.max(13, idealForTarget - 5) },
        { label: 'আদর্শ', size: idealForTarget, best: true },
        { label: 'বড়', size: Math.min(54, idealForTarget + 7) }
      ]
    : [];

  let penalty = 0;
  for (const iss of issues) {
    penalty += iss.severity === 'high' ? 22 : iss.severity === 'medium' ? 12 : 7;
  }
  const score = Math.max(35, 100 - penalty);
  const gradeLabel =
    score >= 92 ? 'একদম প্রফেশনাল' : score >= 75 ? 'ভালো ডিজাইন' : 'আরও সুন্দর করা যাবে';

  return {
    score,
    gradeLabel,
    bgSummary: bgSample.transparent
      ? 'ট্রান্সপারেন্ট ক্যানভাস'
      : isDark
      ? 'গাঢ় ব্যাকগ্রাউন্ড'
      : 'উজ্জ্বল ব্যাকগ্রাউন্ড',
    palette,
    shapeAccentColor,
    sizeOptions,
    targetColorLayerId: targetColorLayer?.id || null,
    targetColorLayerType: targetColorLayer?.type || null,
    targetTextLayerId: targetTextLayer?.id || null,
    targetTextLabel: targetTextLayer?.text?.slice(0, 18) || '',
    targetTextCurSize: targetTextLayer?.fontSize || 22,
    issues,
    applySingle: (issue, curLayers) => issue.apply(curLayers),
    applyAll: (curLayers) => {
      let updated = curLayers;
      for (const iss of issues) {
        updated = iss.apply(updated);
      }
      return updated;
    }
  };
}
