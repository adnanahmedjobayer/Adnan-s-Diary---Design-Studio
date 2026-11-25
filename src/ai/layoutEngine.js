import { pickBestMatchingFont } from './fontVisionAnalyzer.js';

export function buildNeuralBgPatch(bgConfig, nnPrediction) {
  if (!bgConfig || bgConfig.transparent || !nnPrediction) return null;

  const v = Math.max(0, Math.min(0.95, nnPrediction.bgVignette ?? 0.5));
  const overlayGradient =
    v <= 0.08
      ? 'none'
      : `radial-gradient(circle, rgba(0,0,0,${(v * 0.22).toFixed(2)}) 35%, rgba(0,0,0,${v.toFixed(2)}) 100%)`;

  return {
    ...bgConfig,
    overlayGradient,
    brightness: Math.max(55, Math.min(125, nnPrediction.bgBrightness ?? bgConfig.brightness ?? 85))
  };
}

function estimateBoxPct(layer, vision) {
  const previewW = vision?.previewW || 260;
  const previewH = vision?.previewH || 260;
  const fSize = layer.fontSize || 22;
  const padX = layer.paddingX ?? 0;
  const padY = layer.paddingY ?? 0;
  const boxW = layer.width || previewW * 0.8;
  let lines = (layer.text || ' ').split('\n').length;

  if (vision?.ctx) {
    vision.ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold === false ? 400 : 700} ${fSize}px "${layer.font || 'sans-serif'}", sans-serif`;
    const maxAllow = Math.max(40, boxW - padX * 2);
    let totalLines = 0;
    for (const rl of (layer.text || ' ').split('\n')) {
      const w = vision.ctx.measureText(rl || ' ').width;
      totalLines += Math.max(1, Math.ceil(w / maxAllow));
    }
    lines = totalLines;
  }

  const lineH = fSize * (layer.lineHeight ?? 1.2);
  const hPx = Math.max(fSize, (lines - 1) * lineH + fSize + padY * 2);
  return {
    wPct: (boxW / previewW) * 100,
    hPct: (hPx / previewH) * 100
  };
}

export function applyNeuralDesignToLayers({
  curLayers = [],
  vision,
  nnPrediction,
  fontDnaMap,
  variantIndex = 0
}) {
  if (!nnPrediction) return curLayers;

  const baseLayers = curLayers.filter((l) => !l.aiGenerated);
  const unlockedTexts = baseLayers
    .filter((l) => l.visible !== false && !l.locked && l.type === 'text')
    .sort((a, b) => a.y - b.y);

  if (!unlockedTexts.length) return baseLayers;

  const headHex = nnPrediction.headHex || '#f8fafc';
  const subHex = nnPrediction.subHex || '#ffffff';
  const grad2Hex = nnPrediction.grad2Hex || headHex;
  const gradCss = `linear-gradient(135deg, ${headHex} 0%, ${grad2Hex} 100%)`;

  const shOp = nnPrediction.shadowOpacity ?? 0.6;
  const shadowPatch =
    shOp >= 0.16
      ? {
          shadow: true,
          shadowColor: `rgba(${nnPrediction.shadowR ?? 0},${nnPrediction.shadowG ?? 0},${nnPrediction.shadowB ?? 0},${Math.min(0.95, shOp)})`,
          shadowBlur: Math.max(2, nnPrediction.shadowBlur ?? 10),
          shadowX: 0,
          shadowY: 2
        }
      : { shadow: false };

  const headText = unlockedTexts[0]?.text || '';
  const headNeedBn = /[\u0980-\u09FF]/.test(headText);
  const pickedHeadFont = pickBestMatchingFont(fontDnaMap, nnPrediction.headFontStyle, {
    needBangla: headNeedBn,
    rankIndex: variantIndex
  });

  const totalCount = unlockedTexts.length;
  const draftPatches = unlockedTexts.map((t, idx) => {
    const isHead = idx === 0;
    const isLastSub = totalCount >= 2 && idx === totalCount - 1;
    const needBn = /[\u0980-\u09FF]/.test(t.text || '');

    const pickedFont = isHead
      ? pickedHeadFont
      : pickBestMatchingFont(fontDnaMap, nnPrediction.subFontStyle, {
          needBangla: needBn,
          rankIndex: variantIndex,
          excludeFont: pickedHeadFont
        });

    let rawX;
    let rawY;
    if (isHead) {
      rawX = nnPrediction.headX;
      rawY = nnPrediction.headY;
    } else if (isLastSub) {
      rawX = nnPrediction.subX;
      rawY = nnPrediction.subY;
    } else {
      const ratio = idx / (totalCount - 1);
      rawX = nnPrediction.headX + (nnPrediction.subX - nnPrediction.headX) * ratio;
      rawY = nnPrediction.headY + (nnPrediction.subY - nnPrediction.headY) * ratio;
    }

    const nextAlign = isHead ? nnPrediction.headAlign : nnPrediction.subAlign;
    const widthRatio = isHead ? nnPrediction.headWidthRatio : nnPrediction.subWidthRatio;
    const nextWidth = Math.round(vision.previewW * widthRatio);
    const useCardBg = isHead ? Boolean(nnPrediction.headCardBg) : Boolean(nnPrediction.subCardBg);

    const patch = {
      ...t,
      x: rawX,
      y: rawY,
      align: nextAlign,
      width: nextWidth,
      font: pickedFont || t.font,
      fontSize: isHead ? nnPrediction.headSize : nnPrediction.subSize,
      lineHeight: isHead ? nnPrediction.headLineHeight : nnPrediction.subLineHeight,
      isBold: isHead ? nnPrediction.headBold : nnPrediction.subBold,
      isItalic: isHead ? nnPrediction.headItalic : nnPrediction.subItalic,
      textBgEnabled: useCardBg,
      paddingX: t.paddingX ?? 0,
      paddingY: t.paddingY ?? 0,
      ...shadowPatch
    };

    if (isHead && nnPrediction.useGradient) {
      patch.colorMode = 'gradient';
      patch.textureSrc = null;
      patch.gradCss = gradCss;
      patch.gradAngle = 135;
      patch.gradColor1 = headHex;
      patch.gradColor2 = grad2Hex;
      patch.gradStops = [
        { color: headHex, pos: 0 },
        { color: grad2Hex, pos: 100 }
      ];
    } else {
      patch.colorMode = 'solid';
      patch.textureSrc = null;
      patch.color = isHead ? headHex : subHex;
    }

    const box = estimateBoxPct(patch, vision);
    const halfW = Math.min(46, box.wPct / 2);
    const halfH = Math.min(44, box.hPct / 2);
    patch.x = Number(Math.max(halfW + 3, Math.min(97 - halfW, rawX)).toFixed(1));
    patch.y = Number(Math.max(halfH + 3, Math.min(97 - halfH, rawY)).toFixed(1));

    return { patch, box };
  });

  if (draftPatches.length === 2) {
    const h = draftPatches[0];
    const s = draftPatches[1];
    const hHalfH = h.box.hPct / 2;
    const sHalfH = s.box.hPct / 2;
    const hHalfW = h.box.wPct / 2;
    const sHalfW = s.box.wPct / 2;

    const xOverlaps = Math.abs(h.patch.x - s.patch.x) < (hHalfW + sHalfW) * 0.85;
    const minSepY = hHalfH + sHalfH + 2.5;
    const dy = s.patch.y - h.patch.y;

    if (xOverlaps && Math.abs(dy) < minSepY) {
      if (dy >= 0) {
        const pushedY = h.patch.y + minSepY;
        if (pushedY + sHalfH <= 97) {
          s.patch.y = Number(pushedY.toFixed(1));
        } else {
          const pullHeadY = Math.max(hHalfH + 3, 97 - sHalfH - minSepY);
          h.patch.y = Number(pullHeadY.toFixed(1));
          s.patch.y = Number(Math.min(97 - sHalfH, pullHeadY + minSepY).toFixed(1));
        }
      } else {
        const pushedY = h.patch.y - minSepY;
        if (pushedY - sHalfH >= 3) {
          s.patch.y = Number(pushedY.toFixed(1));
        }
      }
    }
  }

  const textUpdates = new Map(draftPatches.map((d) => [d.patch.id, d.patch]));
  return baseLayers.map((l) => (textUpdates.has(l.id) ? textUpdates.get(l.id) : l));
}
