import { getLibraryFonts } from '../library/fonts/loadFonts';

const fontDnaCache = new Map();
let catalogPromise = null;

function renderPixelMask(ctx, text, fontSpec, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = fontSpec;
  ctx.fillText(text, 8, Math.floor(h / 2));
  return ctx.getImageData(0, 0, w, h).data;
}

function pixelsDiffer(a, b) {
  let diff = 0;
  for (let i = 3; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) > 24) diff++;
  }
  return diff > 12;
}

function measureVisualDna(ctx, fontName, w, h, monoBangla, serifBangla) {
  const bnSample = 'অআমক';
  const testMono = renderPixelMask(ctx, bnSample, `24px "${fontName}", monospace`, w, h);
  const testSerif = renderPixelMask(ctx, bnSample, `24px "${fontName}", serif`, w, h);
  const supportsBangla = pixelsDiffer(testMono, monoBangla) || pixelsDiffer(testSerif, serifBangla);

  const sample = supportsBangla ? 'আমার সোনার Abg' : 'Beautiful Quote Abg';
  const data = renderPixelMask(ctx, sample, `24px "${fontName}", sans-serif`, w, h);

  let minX = w, maxX = 0, minY = h, maxY = 0;
  let ink = 0, edges = 0;
  let topX = 0, topCnt = 0, botX = 0, botCnt = 0;
  const midY = h / 2;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      const isInk = data[idx + 3] > 64;
      if (isInk) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (y < midY) { topX += x; topCnt++; }
        else { botX += x; botCnt++; }
      }
      const rInk = data[(y * w + (x + 1)) * 4 + 3] > 64;
      const dInk = data[((y + 1) * w + x) * 4 + 3] > 64;
      if (isInk !== rInk) edges++;
      if (isInk !== dInk) edges++;
    }
  }

  if (ink < 15 || maxX <= minX || maxY <= minY) {
    return {
      name: fontName,
      supportsBangla,
      weight: 0.45,
      widthRatio: 0.5,
      slant: 0.2,
      complexity: 0.4
    };
  }

  const boxW = maxX - minX + 1;
  const boxH = maxY - minY + 1;
  const boxArea = Math.max(1, boxW * boxH);

  const weight = Math.min(1, Math.max(0, (ink / boxArea - 0.11) / 0.34));
  const widthRatio = Math.min(1, Math.max(0, (boxW / boxH - 2.2) / 3.8));
  const topMean = topCnt ? topX / topCnt : 0;
  const botMean = botCnt ? botX / botCnt : 0;
  const slant = Math.min(1, (Math.abs(topMean - botMean) / Math.max(1, boxH)) * 4.5);
  const complexity = Math.min(1, Math.max(0, (edges / ink - 0.34) / 0.72));

  return {
    name: fontName,
    supportsBangla,
    weight: Number(weight.toFixed(3)),
    widthRatio: Number(widthRatio.toFixed(3)),
    slant: Number(slant.toFixed(3)),
    complexity: Number(complexity.toFixed(3))
  };
}

export async function getFontDnaCatalog() {
  const libFonts = getLibraryFonts() || [];
  if (fontDnaCache.size > 0 && fontDnaCache.size >= libFonts.length) {
    return fontDnaCache;
  }
  if (catalogPromise) return catalogPromise;

  catalogPromise = (async () => {
    try {
      const loadTasks = libFonts.map((f) =>
        document?.fonts?.load ? document.fonts.load(`24px "${f.name}"`).catch(() => {}) : Promise.resolve()
      );
      await Promise.race([
        Promise.allSettled(loadTasks),
        new Promise((res) => setTimeout(res, 400))
      ]);
    } catch {}

    const w = 210, h = 52;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      const monoBangla = renderPixelMask(ctx, 'অআমক', '24px monospace', w, h);
      const serifBangla = renderPixelMask(ctx, 'অআমক', '24px serif', w, h);

      for (const f of libFonts) {
        if (!f?.name || fontDnaCache.has(f.name)) continue;
        fontDnaCache.set(
          f.name,
          measureVisualDna(ctx, f.name, w, h, monoBangla, serifBangla)
        );
      }
    }

    catalogPromise = null;
    return fontDnaCache;
  })();

  return catalogPromise;
}

export function pickBestMatchingFont(
  fontDnaMap,
  targetStyle,
  { needBangla = true, rankIndex = 0, excludeFont = null } = {}
) {
  if (!fontDnaMap || fontDnaMap.size === 0) return null;

  let candidates = Array.from(fontDnaMap.values());
  if (needBangla) {
    const bnOnly = candidates.filter((c) => c.supportsBangla);
    if (bnOnly.length > 0) candidates = bnOnly;
  }
  if (excludeFont && candidates.length > 1) {
    const withoutSame = candidates.filter((c) => c.name !== excludeFont);
    if (withoutSame.length > 0) candidates = withoutSame;
  }

  const scored = candidates
    .map((c) => {
      const dw = c.weight - (targetStyle?.weight ?? 0.5);
      const dwr = c.widthRatio - (targetStyle?.widthRatio ?? 0.5);
      const ds = c.slant - (targetStyle?.slant ?? 0.2);
      const dc = c.complexity - (targetStyle?.complexity ?? 0.4);
      const dist = dw * dw * 1.4 + dwr * dwr * 0.9 + ds * ds * 1.2 + dc * dc * 1.1;
      return { name: c.name, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  if (!scored.length) return null;
  const pickIdx = Math.min(scored.length - 1, rankIndex % Math.min(4, scored.length));
  return scored[pickIdx].name;
}
