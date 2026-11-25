import { parseGradientCss } from '../utils/colorPalette';
import { drawPatternOnCanvas } from '../utils/patternMaker';
import { resolveMoodFilter } from '../utils/moodFilters';

export function parseColorRgb(colorStr = '') {
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

export function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

export async function analyzeCanvasVision(bgConfig, canvasSize) {
  const cw = canvasSize?.width || 1080;
  const ch = canvasSize?.height || 1080;
  const ratio = cw / ch;
  const previewW = ratio >= 1 ? 330 : Math.max(140, Math.round(330 * ratio));
  const previewH = ratio >= 1 ? Math.max(140, Math.round(330 / ratio)) : 330;

  const w = 224;
  const h = 224;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!bgConfig || bgConfig.transparent) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);
    const defaultSpatial = [];
    for (let i = 0; i < 16; i++) {
      defaultSpatial.push(0.06, 0.09, 0.16, 0, 0);
    }
    return {
      transparent: true,
      ratio,
      previewW,
      previewH,
      ctx,
      canvas,
      spatial80: defaultSpatial,
      palette: [],
      isDark: true
    };
  }

  const bgMood = resolveMoodFilter(bgConfig.moodFilter);
  const bgCan = bgMood.filterParts.length ? document.createElement('canvas') : canvas;
  if (bgCan !== canvas) {
    bgCan.width = w;
    bgCan.height = h;
  }
  const bCtx = bgCan.getContext('2d', { willReadFrequently: true });

  const gradStr = bgConfig.gradient || '';
  const parsed = parseGradientCss(gradStr);
  if (parsed && parsed.stops.length >= 2) {
    let g;
    if (parsed.type === 'radial') {
      const cx = ((parsed.cx ?? 50) / 100) * w;
      const cy = ((parsed.cy ?? 50) / 100) * h;
      g = bCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.72);
    } else {
      const rad = (((parsed.angle ?? 180) - 90) * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      g = bCtx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    }
    parsed.stops.forEach((st, i) => {
      const pos = Math.max(0, Math.min(1, (st.pos ?? i / (parsed.stops.length - 1)) / 100));
      g.addColorStop(pos, st.color);
    });
    bCtx.fillStyle = g;
  } else {
    bCtx.fillStyle = gradStr || '#121722';
  }
  bCtx.fillRect(0, 0, w, h);

  if (bgConfig.useImage && bgConfig.imageSrc) {
    try {
      const img = new Image();
      if (!bgConfig.imageSrc.startsWith('data:') && !bgConfig.imageSrc.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.src = bgConfig.imageSrc;
      await img.decode();
      bCtx.save();
      bCtx.globalAlpha = bgConfig.imageOpacity ?? 0.65;
      bCtx.filter = `brightness(${bgConfig.brightness ?? 85}%) contrast(${bgConfig.contrast ?? 110}%)`;
      const imgR = (img.naturalWidth || 1) / (img.naturalHeight || 1);
      const outR = (cw || 1) / (ch || 1);
      let dw = w, dh = h, dx = 0, dy = 0;
      if (imgR > outR) {
        dw = h * imgR;
        dx = (w - dw) / 2;
      } else {
        dh = w / imgR;
        dy = (h - dh) / 2;
      }
      bCtx.drawImage(img, dx, dy, dw, dh);
      bCtx.restore();
    } catch {}
  }

  if (bgConfig.pattern && bgConfig.pattern.id && bgConfig.pattern.id !== 'none') {
    try {
      drawPatternOnCanvas(bCtx, bgConfig.pattern, w, h, w / previewW);
    } catch {}
  }

  if (bgCan !== canvas) {
    ctx.save();
    ctx.filter = bgMood.filterParts.join(' ');
    ctx.drawImage(bgCan, 0, 0);
    ctx.restore();
  }

  if (bgMood.tintCss) {
    ctx.save();
    ctx.globalCompositeOperation = bgMood.blendMode;
    ctx.fillStyle = bgMood.tintCss;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (bgConfig.overlayGradient && bgConfig.overlayGradient !== 'none') {
    const ov = bgConfig.overlayGradient;
    let innerA = 0.15, outerA = 0.78;
    const nums = ov.match(/0\.\d+/g);
    if (nums && nums.length >= 2) {
      innerA = Number(nums[0]);
      outerA = Number(nums[nums.length - 1]);
    }
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, `rgba(0,0,0,${innerA})`);
    vg.addColorStop(1, `rgba(0,0,0,${outerA})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // ৪×৪ গ্রিড থেকে ১৬ ঘরের (R, G, B, কন্ট্রাস্ট/Std, এজ/ব্যস্ততা) = ৮০টি স্পেশাল ফিচার
  const grid = 4;
  const cellW = Math.floor(w / grid);
  const cellH = Math.floor(h / grid);
  let spatial80 = new Array(80).fill(0.15);
  let isDark = true;
  const palette = [];

  try {
    const d = ctx.getImageData(0, 0, w, h).data;
    const cells = [];
    let totalLum = 0;

    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const x0 = gx * cellW;
        const y0 = gy * cellH;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let lumSum = 0;
        let lumSqSum = 0;
        let edgeSum = 0;
        let count = 0;

        for (let y = y0; y < y0 + cellH; y++) {
          for (let x = x0; x < x0 + cellW; x++) {
            const idx = (y * w + x) * 4;
            const r = d[idx] / 255;
            const g = d[idx + 1] / 255;
            const b = d[idx + 2] / 255;
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

            rSum += r;
            gSum += g;
            bSum += b;
            lumSum += lum;
            lumSqSum += lum * lum;

            if (x + 1 < w) {
              const rIdx = idx + 4;
              const rLum = (0.2126 * d[rIdx] + 0.7152 * d[rIdx + 1] + 0.0722 * d[rIdx + 2]) / 255;
              edgeSum += Math.abs(lum - rLum);
            }
            if (y + 1 < h) {
              const dIdx = idx + w * 4;
              const dLum = (0.2126 * d[dIdx] + 0.7152 * d[dIdx + 1] + 0.0722 * d[dIdx + 2]) / 255;
              edgeSum += Math.abs(lum - dLum);
            }
            count++;
          }
        }

        const n = Math.max(1, count);
        const meanR = rSum / n;
        const meanG = gSum / n;
        const meanB = bSum / n;
        const meanLum = lumSum / n;
        const variance = Math.max(0, lumSqSum / n - meanLum * meanLum);
        const lumStd = Math.min(1, Math.sqrt(variance) * 3.5);
        const meanEdge = Math.min(1, (edgeSum / n) * 4.5);

        cells.push(
          Number(meanR.toFixed(3)),
          Number(meanG.toFixed(3)),
          Number(meanB.toFixed(3)),
          Number(lumStd.toFixed(3)),
          Number(meanEdge.toFixed(3))
        );
        totalLum += meanLum;
      }
    }

    spatial80 = cells;
    isDark = totalLum / 16 < 0.45;

    let brightest = { lum: -1, r: 248, g: 250, b: 252 };
    let darkest = { lum: 2, r: 15, g: 23, b: 42 };
    let vibrant = { sat: -1, r: 56, g: 189, b: 248 };
    let mid = { diff: 999, r: 226, g: 232, b: 240 };

    for (let i = 0; i < d.length; i += 64) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

      if (lum > brightest.lum) brightest = { lum, r, g, b };
      if (lum < darkest.lum) darkest = { lum, r, g, b };
      if (sat > vibrant.sat && lum > 0.18 && lum < 0.92) vibrant = { sat, r, g, b };
      const diff = Math.abs(lum - 0.55);
      if (diff < mid.diff) mid = { diff, r, g, b };
    }

    const candidates = [
      { hex: rgbToHex(brightest.r, brightest.g, brightest.b), label: 'উজ্জ্বল' },
      { hex: rgbToHex(vibrant.r, vibrant.g, vibrant.b), label: 'ভাইব্রেন্ট' },
      { hex: rgbToHex(mid.r, mid.g, mid.b), label: 'মিড' },
      { hex: rgbToHex(darkest.r, darkest.g, darkest.b), label: 'গাঢ়' }
    ];
    const seen = new Set();
    for (const c of candidates) {
      if (!seen.has(c.hex)) {
        seen.add(c.hex);
        palette.push(c);
      }
    }
  } catch {}

  return {
    transparent: false,
    ratio,
    previewW,
    previewH,
    ctx,
    canvas,
    spatial80,
    palette,
    isDark
  };
}
