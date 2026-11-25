
export function estimateLayerBox(layer, vision) {
  const { previewW, previewH, ctx } = vision;
  if (layer.type === 'text') {
    const fSize = layer.fontSize || 22;
    const padX = layer.paddingX ?? 0;
    const padY = layer.paddingY ?? 0;
    const letterSpacing = layer.letterSpacing ?? 0;
    let measuredW = 0;
    let linesCount = (layer.text || '').split('\n').length;

    if (ctx) {
      ctx.font = `${layer.isItalic ? 'italic ' : ''}${layer.isBold === false ? 400 : 700} ${fSize}px "${layer.font || 'sans-serif'}", sans-serif`;
      try { ctx.letterSpacing = `${letterSpacing}px`; } catch {}
      const maxAllow = (layer.width || previewW * 0.92) - padX * 2;
      const rawLines = (layer.text || ' ').split('\n');
      let maxW = 0;
      let totalLines = 0;
      for (const rl of rawLines) {
        const w = ctx.measureText(rl || ' ').width;
        maxW = Math.max(maxW, w);
        totalLines += Math.max(1, Math.ceil(w / Math.max(36, maxAllow)));
      }
      measuredW = layer.width || Math.min(previewW * 0.92, maxW + padX * 2);
      linesCount = totalLines;
      try { ctx.letterSpacing = '0px'; } catch {}
    } else {
      measuredW = layer.width || previewW * 0.6;
    }

    const estW = Math.max(24, measuredW);
    const lineH = fSize * (layer.lineHeight ?? 1.2);
    const tightTextH = linesCount <= 1 ? fSize * 0.92 : (linesCount - 1) * lineH + fSize * 0.92;
    const estH = Math.max(fSize * 0.9, tightTextH + padY * 2);
    return {
      x: layer.x,
      y: layer.y,
      wPx: estW,
      hPx: estH,
      wPct: (estW / previewW) * 100,
      hPct: (estH / previewH) * 100,
    };
  }

  const w = layer.width || 110;
  const h = layer.height || layer.width || 110;
  return {
    x: layer.x,
    y: layer.y,
    wPx: w,
    hPx: h,
    wPct: (w / previewW) * 100,
    hPct: (h / previewH) * 100,
  };
}
