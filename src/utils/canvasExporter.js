import { renderToStaticMarkup } from 'react-dom/server';
import { renderShapeSVG } from '../components/CanvasArea';
import { drawTextLayerOnCanvas } from './textRenderer';
import { drawWatermarkOnCanvas } from './watermark';
import { drawPatternOnCanvas } from './patternMaker';
import { resolveMoodFilter } from './moodFilters';
import { parseGradientCss } from './colorPalette';

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export async function svgShapeToImage(
  shapeId,
  color,
  strokeColor = null,
  strokeWidth = 0,
  customShape = null
) {
  let svgMarkup = renderToStaticMarkup(
    renderShapeSVG(shapeId, color, 1, strokeColor, strokeWidth, customShape)
  );
  if (!svgMarkup.includes('xmlns=')) {
    svgMarkup = svgMarkup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function drawSingleLayerToCtx(ctx, layer, outW, outH, scale) {
  if (layer.visible === false) return;
  ctx.save();
  ctx.translate((layer.x / 100) * outW, (layer.y / 100) * outH);
  ctx.rotate(((layer.rotation || 0) * Math.PI) / 180);

  if (layer.type === 'text') {
    ctx.globalAlpha = layer.opacity ?? 1;
    await drawTextLayerOnCanvas(ctx, layer, scale);
    ctx.restore();
    return;
  }

  const isMedia = layer.type === 'image' || layer.type === 'sticker';
  const defaultOpacity = layer.type === 'shape' ? 0.85 : 1;
  const layerOpacity = layer.opacity ?? defaultOpacity;
  const layerMood = isMedia
    ? resolveMoodFilter(layer.moodFilter)
    : { filterParts: [], tintCss: null, blendMode: 'normal' };

  const sx = Math.tan(((layer.skewX ?? 0) * Math.PI) / 180);
  const sy = Math.tan(((layer.skewY ?? 0) * Math.PI) / 180);
  const scaleRx = Math.max(0.25, Math.cos(((layer.rotateY ?? 0) * Math.PI) / 180));
  const scaleRy = Math.max(0.25, Math.cos(((layer.rotateX ?? 0) * Math.PI) / 180));
  ctx.transform(scaleRx, sy * scaleRx, sx * scaleRy, scaleRy, 0, 0);
  ctx.scale(layer.flipH ? -1 : 1, layer.flipV ? -1 : 1);

  let w = (layer.width || 110) * scale;
  let h = (layer.height || layer.width || 110) * scale;
  let drawable = null;

  if (layer.type === 'shape') {
    try {
      drawable = await svgShapeToImage(
        layer.shapeId,
        layer.color,
        layer.strokeEnabled ? (layer.strokeColor || '#ffffff') : null,
        layer.strokeEnabled ? (layer.strokeWidth ?? 2) : 0,
        layer.customShape
      );
    } catch {}
  } else if (isMedia && layer.src) {
    try {
      const mImg = new Image();
      if (!layer.src.startsWith('data:') && !layer.src.startsWith('blob:')) {
        mImg.crossOrigin = 'anonymous';
      }
      mImg.src = layer.src;
      await mImg.decode();
      const mRatio = (mImg.naturalHeight || 1) / (mImg.naturalWidth || 1);
      h = w * mRatio;

      if ((layer.borderRadius && layer.borderRadius > 0) || layer.strokeEnabled || layerMood.tintCss) {
        const off = document.createElement('canvas');
        const sw = layer.strokeEnabled ? (layer.strokeWidth ?? 2) * scale : 0;
        off.width = Math.max(1, Math.ceil(w + sw * 2));
        off.height = Math.max(1, Math.ceil(h + sw * 2));
        const oCtx = off.getContext('2d');
        const rad = (layer.borderRadius || 0) * scale;

        oCtx.save();
        if (rad > 0) {
          drawRoundedRectPath(oCtx, sw, sw, w, h, rad);
          oCtx.clip();
        }
        oCtx.drawImage(mImg, sw, sw, w, h);

        if (layerMood.tintCss) {
          const tCan = document.createElement('canvas');
          tCan.width = off.width;
          tCan.height = off.height;
          const tCtx = tCan.getContext('2d');
          tCtx.drawImage(off, 0, 0);
          tCtx.globalCompositeOperation = layerMood.blendMode;
          tCtx.fillStyle = layerMood.tintCss;
          tCtx.fillRect(0, 0, tCan.width, tCan.height);
          tCtx.globalCompositeOperation = 'destination-in';
          tCtx.drawImage(off, 0, 0);
          oCtx.clearRect(0, 0, off.width, off.height);
          oCtx.drawImage(tCan, 0, 0);
        }
        oCtx.restore();

        if (layer.strokeEnabled && sw > 0) {
          oCtx.strokeStyle = layer.strokeColor || '#ffffff';
          oCtx.lineWidth = sw;
          if (rad > 0) {
            drawRoundedRectPath(oCtx, sw / 2, sw / 2, w + sw, h + sw, rad);
            oCtx.stroke();
          } else {
            oCtx.strokeRect(sw / 2, sw / 2, w + sw, h + sw);
          }
        }
        drawable = off;
        w = off.width;
        h = off.height;
      } else {
        drawable = mImg;
      }
    } catch {}
  }

  if (drawable) {
    if (layer.shadow3dEnabled) {
      ctx.save();
      ctx.globalAlpha = layerOpacity * ((layer.shadow3dOpacity ?? 50) / 100);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.filter = `blur(${(layer.shadow3dBlur ?? 7) * scale}px)`;
      ctx.beginPath();
      ctx.ellipse(0, h / 2 + (layer.shadow3dY ?? 16) * scale, w * 0.35, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (layer.type === 'shape' && layer.text3dEnabled) {
      try {
        const depth = layer.depth3d ?? 5;
        const dImg = await svgShapeToImage(layer.shapeId, layer.color3d || '#334155', null, 0, layer.customShape);
        ctx.save();
        ctx.globalAlpha = layerOpacity * 0.45;
        for (let i = depth; i >= 1; i--) {
          const off = i * 1.2 * scale;
          ctx.drawImage(dImg, -w / 2 + off, -h / 2 + off, w, h);
        }
        ctx.restore();
      } catch {}
    }

    const filterParts = [...layerMood.filterParts];
    if (layer.brightness !== undefined && layer.brightness !== 100) {
      filterParts.push(`brightness(${layer.brightness}%)`);
    }
    if (layer.contrast !== undefined && layer.contrast !== 100) {
      filterParts.push(`contrast(${layer.contrast}%)`);
    }
    if (layer.saturate !== undefined && layer.saturate !== 100) {
      filterParts.push(`saturate(${layer.saturate}%)`);
    }
    if (layer.hueRotate) {
      filterParts.push(`hue-rotate(${layer.hueRotate}deg)`);
    }
    if (layer.blur) {
      filterParts.push(`blur(${layer.blur * scale}px)`);
    }
    if (layer.embossEnabled) {
      const p = Math.max(1, scale * 0.6);
      filterParts.push(`drop-shadow(-${p}px -${p}px 0px rgba(255,255,255,0.55))`);
      filterParts.push(`drop-shadow(${p * 1.5}px ${p * 1.5}px ${p * 0.5}px rgba(0,0,0,0.75))`);
    }

    ctx.save();
    ctx.globalAlpha = layerOpacity;
    if (filterParts.length) ctx.filter = filterParts.join(' ');
    if (layer.shadow) {
      ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = (layer.shadowBlur ?? 8) * scale;
      ctx.shadowOffsetX = (layer.shadowX ?? 0) * scale;
      ctx.shadowOffsetY = (layer.shadowY ?? 4) * scale;
    }
    ctx.drawImage(drawable, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (layer.reflectionEnabled) {
      try {
        const rw = Math.max(1, Math.ceil(w));
        const rh = Math.max(1, Math.ceil(h));
        const rCan = document.createElement('canvas');
        rCan.width = rw;
        rCan.height = rh;
        const rCtx = rCan.getContext('2d');

        rCtx.save();
        rCtx.translate(0, rh);
        rCtx.scale(1, -1);
        rCtx.drawImage(drawable, 0, 0, rw, rh);
        rCtx.restore();

        rCtx.globalCompositeOperation = 'destination-in';
        const rGrad = rCtx.createLinearGradient(0, 0, 0, rh * 0.85);
        rGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
        rGrad.addColorStop(1, 'rgba(0,0,0,0)');
        rCtx.fillStyle = rGrad;
        rCtx.fillRect(0, 0, rw, rh);

        ctx.save();
        ctx.globalAlpha = layerOpacity * ((layer.reflectionOpacity ?? 40) / 100);
        if (filterParts.length) ctx.filter = filterParts.join(' ');
        ctx.drawImage(rCan, -w / 2, h / 2 + (layer.reflectionOffset ?? 4) * scale, w, h);
        ctx.restore();
      } catch {}
    }
  }

  ctx.restore();
}

export async function renderCanvasToElement({
  canvasSize,
  bgConfig,
  layers,
  liveWidth,
  maxThumbDim = null,
  exportOpts = null,
  watermark = null
}) {
  const cw = canvasSize?.width || 1080;
  const ch = canvasSize?.height || 1080;
  const thumbScale = maxThumbDim
    ? Math.min(1, maxThumbDim / Math.max(cw, ch))
    : exportOpts?.scaleMult || 1;
  const outW = Math.round(cw * thumbScale);
  const outH = Math.round(ch * thumbScale);
  const scale = outW / (liveWidth || 330);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  if (bgConfig.transparent) {
    if (exportOpts?.fillTransparentForJpg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
    }
  } else {
    const bgMood = resolveMoodFilter(bgConfig.moodFilter);
    const bgCan = bgMood.filterParts.length ? document.createElement('canvas') : canvas;
    if (bgCan !== canvas) {
      bgCan.width = outW;
      bgCan.height = outH;
    }
    const bCtx = bgCan.getContext('2d');

    const gradStr = bgConfig.gradient || '';
    const parsedGrad = parseGradientCss(gradStr);
    if (parsedGrad && parsedGrad.stops.length >= 2) {
      let bgGrad;
      if (parsedGrad.type === 'radial') {
        const rcx = ((parsedGrad.cx ?? 50) / 100) * outW;
        const rcy = ((parsedGrad.cy ?? 50) / 100) * outH;
        const maxR = Math.max(
          1,
          Math.hypot(rcx, rcy),
          Math.hypot(outW - rcx, rcy),
          Math.hypot(rcx, outH - rcy),
          Math.hypot(outW - rcx, outH - rcy)
        );
        bgGrad = bCtx.createRadialGradient(rcx, rcy, 0, rcx, rcy, maxR);
      } else {
        const deg = parsedGrad.angle ?? 180;
        const rad = ((deg - 90) * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const halfLen = (Math.abs(outW * dx) + Math.abs(outH * dy)) / 2;
        const cx = outW / 2;
        const cy = outH / 2;
        bgGrad = bCtx.createLinearGradient(
          cx - dx * halfLen,
          cy - dy * halfLen,
          cx + dx * halfLen,
          cy + dy * halfLen
        );
      }
      parsedGrad.stops.forEach((st, i) => {
        const pos = Math.max(0, Math.min(1, (st.pos ?? (i / (parsedGrad.stops.length - 1)) * 100) / 100));
        bgGrad.addColorStop(pos, st.color);
      });
      bCtx.fillStyle = bgGrad;
    } else {
      bCtx.fillStyle = gradStr || '#121722';
    }
    bCtx.fillRect(0, 0, outW, outH);

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
        bCtx.filter = `brightness(${bgConfig.brightness ?? 85}%) contrast(${bgConfig.contrast ?? 110}%) blur(${(bgConfig.blur ?? 0) * scale}px)`;
        const imgRatio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        const outRatio = outW / outH;
        let dw = outW, dh = outH, dx = 0, dy = 0;
        if (imgRatio > outRatio) {
          dw = outH * imgRatio;
          dx = (outW - dw) / 2;
        } else {
          dh = outW / imgRatio;
          dy = (outH - dh) / 2;
        }
        bCtx.drawImage(img, dx, dy, dw, dh);
        bCtx.restore();
      } catch {}
    }

    if (bgConfig.pattern && bgConfig.pattern.id && bgConfig.pattern.id !== 'none') {
      drawPatternOnCanvas(bCtx, bgConfig.pattern, outW, outH, scale);
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
      ctx.fillRect(0, 0, outW, outH);
      ctx.restore();
    }

    if (bgConfig.overlayGradient !== 'none') {
      const ov = bgConfig.overlayGradient || '';
      let innerA = 0.15, outerA = 0.78;
      if (ov.includes('0.45')) { innerA = 0.05; outerA = 0.45; }
      else if (ov.includes('0.92')) { innerA = 0.22; outerA = 0.92; }
      const grad = ctx.createRadialGradient(
        outW / 2,
        outH / 2,
        outW * 0.2,
        outW / 2,
        outH / 2,
        Math.max(outW, outH) * 0.72
      );
      grad.addColorStop(0, `rgba(0,0,0,${innerA})`);
      grad.addColorStop(1, `rgba(0,0,0,${outerA})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, outW, outH);
    }
  }

  for (const layer of layers) {
    await drawSingleLayerToCtx(ctx, layer, outW, outH, scale);
  }

  if (watermark?.enabled) {
    await drawWatermarkOnCanvas(ctx, watermark, outW, outH);
  }

  return canvas;
}

export async function captureTransparentDesign({ canvasSize, layers, liveWidth }) {
  const cw = canvasSize?.width || 1080;
  const ch = canvasSize?.height || 1080;
  const fit = Math.min(1, 900 / Math.max(cw, ch));
  const outW = Math.max(1, Math.round(cw * fit));
  const outH = Math.max(1, Math.round(ch * fit));
  const scale = outW / (liveWidth || 330);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');

  for (const layer of layers) {
    await drawSingleLayerToCtx(ctx, layer, outW, outH, scale);
  }

  const { data } = ctx.getImageData(0, 0, outW, outH);
  let minX = outW, minY = outH, maxX = -1, maxY = -1;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      if (data[(y * outW + x) * 4 + 3] > 4) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(outW - 1, maxX + pad);
  maxY = Math.min(outH - 1, maxY + pad);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cap = Math.min(1, 560 / Math.max(cropW, cropH));
  const finalW = Math.max(1, Math.round(cropW * cap));
  const finalH = Math.max(1, Math.round(cropH * cap));

  const out = document.createElement('canvas');
  out.width = finalW;
  out.height = finalH;
  out.getContext('2d').drawImage(canvas, minX, minY, cropW, cropH, 0, 0, finalW, finalH);

  return out.toDataURL('image/png');
}
