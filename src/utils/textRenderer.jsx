import React, { useEffect, useId, useMemo, useState } from 'react';
import { gradientToCss, parseGradientCss } from './colorPalette';

let measureCanvas = null;

function getMeasureCtx() {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
  }
  return measureCanvas.getContext('2d');
}

function measureTightFontTrim({
  text,
  font,
  fontSize,
  isBold,
  isItalic,
  letterSpacing,
  lineHeight,
  strokeEnabled,
  strokeWidth
}) {
  const ctx = getMeasureCtx();
  if (!ctx) return { topTrim: 0, bottomTrim: 0, maxLineW: 120 };

  const weight = isBold === false ? 400 : 700;
  const style = isItalic ? 'italic ' : '';
  const fSize = fontSize || 22;

  ctx.save();
  ctx.font = `${style}${weight} ${fSize}px "${font || 'sans-serif'}", sans-serif`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${letterSpacing ?? 0}px`;
  }

  const rawLines = (text || ' ').split('\n');
  const firstStr = rawLines[0].trim() || 'আ';
  const lastStr = rawLines[rawLines.length - 1].trim() || 'আ';

  const mFirst = ctx.measureText(firstStr);
  const mLast = ctx.measureText(lastStr);
  const maxLineW = Math.max(
    40,
    ...rawLines.map((ln) => ctx.measureText(ln || ' ').width)
  );
  ctx.restore();

  if (
    typeof mFirst.fontBoundingBoxAscent !== 'number' ||
    typeof mFirst.actualBoundingBoxAscent !== 'number' ||
    typeof mLast.fontBoundingBoxDescent !== 'number' ||
    typeof mLast.actualBoundingBoxDescent !== 'number'
  ) {
    return { topTrim: 0, bottomTrim: 0, maxLineW };
  }

  const lineBoxH = fSize * (lineHeight ?? 1.2);

  const fTotal1 = mFirst.fontBoundingBoxAscent + mFirst.fontBoundingBoxDescent;
  const halfLead1 = (lineBoxH - fTotal1) / 2;
  const cssTopToBase = mFirst.fontBoundingBoxAscent + halfLead1;
  const rawTopGap = cssTopToBase - mFirst.actualBoundingBoxAscent;

  const fTotal2 = mLast.fontBoundingBoxAscent + mLast.fontBoundingBoxDescent;
  const halfLead2 = (lineBoxH - fTotal2) / 2;
  const cssBaseToBot = mLast.fontBoundingBoxDescent + halfLead2;
  const rawBotGap = cssBaseToBot - mLast.actualBoundingBoxDescent;

  const strokePad = strokeEnabled ? (strokeWidth ?? 2) * 0.55 : 0;
  const safety = 1.5 + strokePad;

  return {
    topTrim: Number(Math.max(-4, rawTopGap - safety).toFixed(1)),
    bottomTrim: Number(Math.max(-4, rawBotGap - safety).toFixed(1)),
    maxLineW
  };
}

function buildTextShadow(layer) {
  const shadows = [];

  if (layer.text3dEnabled) {
    const depth = layer.depth3d ?? 6;
    const c3d = layer.color3d || '#475569';
    for (let i = 1; i <= depth; i++) {
      shadows.push(`${(i * 0.8).toFixed(1)}px ${(i * 0.8).toFixed(1)}px 0px ${c3d}`);
    }
  }

  if (layer.embossEnabled) {
    const p = Math.max(1, Math.round((layer.embossIntensity ?? 4) / 3));
    shadows.push(`-${p}px -${p}px 1px rgba(255,255,255,0.65)`);
    shadows.push(`${p}px ${p}px 1px rgba(0,0,0,0.8)`);
  }

  if (layer.shadow) {
    const sx = layer.shadowX ?? 0;
    const sy = layer.shadowY ?? 3;
    const blur = layer.shadowBlur ?? 10;
    const col = layer.shadowColor || 'rgba(0,0,0,0.85)';
    shadows.push(`${sx}px ${sy}px ${blur}px ${col}`);
  }

  return shadows.length ? shadows.join(', ') : 'none';
}

function resolveTextGradient(layer) {
  if (layer.gradCss) {
    const parsed = parseGradientCss(layer.gradCss);
    if (parsed) return { css: layer.gradCss, ...parsed };
  }
  const angle = layer.gradAngle ?? 90;
  const stops =
    Array.isArray(layer.gradStops) && layer.gradStops.length >= 2
      ? layer.gradStops
      : [
          { color: layer.gradColor1 || '#fda4af', pos: 0 },
          { color: layer.gradColor2 || '#38bdf8', pos: 100 }
        ];
  return {
    type: 'linear',
    css: gradientToCss({ type: 'linear', angle, stops }),
    angle,
    cx: 50,
    cy: 50,
    stops
  };
}

export function TextLayerContent({ layer }) {
  const rawId = useId().replace(/:/g, '');
  const [fontTick, setFontTick] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let active = true;
    const bump = () => {
      if (active) setFontTick((t) => t + 1);
    };
    document.fonts.ready.then(bump);
    document.fonts.addEventListener?.('loadingdone', bump);
    return () => {
      active = false;
      document.fonts.removeEventListener?.('loadingdone', bump);
    };
  }, [layer.font]);

  const curve = layer.curve ?? 0;
  const padX = layer.paddingX ?? 0;
  const padY = layer.paddingY ?? 0;
  const fontWeight = layer.isBold === false ? 400 : 700;
  const fontStyle = layer.isItalic ? 'italic' : 'normal';
  const textDecoration = layer.isUnderline ? 'underline' : 'none';
  const letterSpacing = `${layer.letterSpacing ?? 0}px`;
  const lineHeight = layer.lineHeight ?? 1.2;
  const align = layer.align || 'center';

  const metrics = useMemo(
    () =>
      measureTightFontTrim({
        text: layer.text,
        font: layer.font,
        fontSize: layer.fontSize,
        isBold: layer.isBold,
        isItalic: layer.isItalic,
        letterSpacing: layer.letterSpacing,
        lineHeight,
        strokeEnabled: layer.strokeEnabled,
        strokeWidth: layer.strokeWidth
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      layer.text,
      layer.font,
      layer.fontSize,
      layer.isBold,
      layer.isItalic,
      layer.letterSpacing,
      lineHeight,
      layer.strokeEnabled,
      layer.strokeWidth,
      fontTick
    ]
  );

  const hasClippedFill = Boolean(layer.textureSrc || layer.colorMode === 'gradient');
  const combinedShadow = buildTextShadow(layer);
  const gradInfo = layer.colorMode === 'gradient' ? resolveTextGradient(layer) : null;

  const transform3d = [
    'perspective(420px)',
    `rotateX(${layer.rotateX ?? 0}deg)`,
    `rotateY(${layer.rotateY ?? 0}deg)`,
    `skew(${layer.skewX ?? 0}deg, ${layer.skewY ?? 0}deg)`
  ].join(' ');

  const boxStyle = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: `${padY}px ${padX}px`,
    backgroundColor: layer.textBgEnabled ? (layer.textBgColor || '#0f172a') : 'transparent',
    borderRadius: layer.textBgEnabled ? `${layer.textBgRadius ?? 8}px` : 0,
    opacity: layer.opacity ?? 1,
    transform: transform3d,
    transformStyle: 'preserve-3d'
  };

  const baseTextStyle = {
    fontFamily: `'${layer.font}', sans-serif`,
    fontSize: `${layer.fontSize}px`,
    fontWeight,
    fontStyle,
    textDecoration,
    letterSpacing,
    lineHeight,
    textAlign: align,
    whiteSpace: 'pre-wrap',
    WebkitTextStroke: layer.strokeEnabled ? `${layer.strokeWidth ?? 2}px ${layer.strokeColor || '#000000'}` : '0px transparent',
    paintOrder: 'stroke fill'
  };

  const fillStyle = layer.textureSrc
    ? {
        backgroundImage: `url(${layer.textureSrc})`,
        backgroundSize: `${layer.textureScale ?? 100}%`,
        backgroundPosition: 'center',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent'
      }
    : gradInfo
    ? {
        backgroundImage: gradInfo.css,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent'
      }
    : {
        color: layer.color || '#f8fafc'
      };

  // কার্ভ টেক্সট রেন্ডারিং (SVG textPath)
  if (Math.abs(curve) > 1) {
    const w = layer.width || Math.max(90, Math.min(300, Math.round(metrics.maxLineW + 24)));
    const fz = layer.fontSize || 22;
    const arcDepth = Math.abs(curve / 100) * Math.max(70, fz * 3.2);
    const h = Math.max(fz * 1.8, Math.round(fz * 1.8 + arcDepth));
    const midY = h / 2;
    const bend = (curve / 100) * (h * 0.85);
    const pathId = `curve_${rawId}`;
    const gradId = `grad_${rawId}`;
    const strokeCol = layer.strokeEnabled ? (layer.strokeColor || '#000000') : 'none';
    const strokeW = layer.strokeEnabled ? (layer.strokeWidth ?? 2) * 1.4 : 0;

    let gx1 = '0%', gy1 = '0%', gx2 = '100%', gy2 = '0%';
    if (gradInfo && gradInfo.type !== 'radial') {
      const rad = (((gradInfo.angle ?? 90) - 90) * Math.PI) / 180;
      const dx = Math.cos(rad) * 50;
      const dy = Math.sin(rad) * 50;
      gx1 = `${(50 - dx).toFixed(1)}%`;
      gy1 = `${(50 - dy).toFixed(1)}%`;
      gx2 = `${(50 + dx).toFixed(1)}%`;
      gy2 = `${(50 + dy).toFixed(1)}%`;
    }

    return (
      <div style={boxStyle}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={layer.width ? '100%' : w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            <path id={pathId} d={`M 10 ${midY} Q ${w / 2} ${midY - bend} ${w - 10} ${midY}`} fill="none" />
            {gradInfo && gradInfo.type === 'radial' && (
              <radialGradient
                id={gradId}
                cx={`${gradInfo.cx ?? 50}%`}
                cy={`${gradInfo.cy ?? 50}%`}
                r="65%"
              >
                {gradInfo.stops.map((st, idx) => (
                  <stop key={idx} offset={`${Math.max(0, Math.min(100, st.pos))}%`} stopColor={st.color} />
                ))}
              </radialGradient>
            )}
            {gradInfo && gradInfo.type !== 'radial' && (
              <linearGradient id={gradId} x1={gx1} y1={gy1} x2={gx2} y2={gy2}>
                {gradInfo.stops.map((st, idx) => (
                  <stop key={idx} offset={`${Math.max(0, Math.min(100, st.pos))}%`} stopColor={st.color} />
                ))}
              </linearGradient>
            )}
          </defs>
          <text
            fill={gradInfo ? `url(#${gradId})` : (layer.color || '#f8fafc')}
            stroke={strokeCol}
            strokeWidth={strokeW}
            paintOrder="stroke fill"
            style={{
              fontFamily: `'${layer.font}', sans-serif`,
              fontSize: `${fz}px`,
              fontWeight,
              fontStyle,
              letterSpacing,
              filter: layer.shadow ? `drop-shadow(${layer.shadowX ?? 0}px ${layer.shadowY ?? 3}px ${(layer.shadowBlur ?? 8) / 2}px ${layer.shadowColor || 'rgba(0,0,0,0.85)'})` : 'none'
            }}
          >
            <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
              {layer.text.replace(/\n/g, ' ')}
            </textPath>
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div
        style={{
          position: 'relative',
          marginTop: `${-metrics.topTrim}px`,
          marginBottom: `${-metrics.bottomTrim}px`
        }}
      >
        {hasClippedFill && combinedShadow !== 'none' && (
          <div
            aria-hidden="true"
            style={{
              ...baseTextStyle,
              position: 'absolute',
              inset: 0,
              color: 'transparent',
              textShadow: combinedShadow,
              pointerEvents: 'none'
            }}
          >
            {layer.text}
          </div>
        )}

        <div
          style={{
            ...baseTextStyle,
            ...fillStyle,
            position: 'relative',
            textShadow: hasClippedFill ? 'none' : combinedShadow
          }}
        >
          {layer.text}
        </div>
      </div>

      {layer.shadow3dEnabled && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '12%',
            right: '12%',
            bottom: `-${layer.shadow3dY ?? 18}px`,
            height: 12,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.85)',
            opacity: (layer.shadow3dOpacity ?? 50) / 100,
            filter: `blur(${layer.shadow3dBlur ?? 8}px)`,
            pointerEvents: 'none'
          }}
        />
      )}

      {layer.reflectionEnabled && (
        <div
          aria-hidden="true"
          style={{
            ...baseTextStyle,
            color: layer.color || '#f8fafc',
            opacity: (layer.reflectionOpacity ?? 45) / 100,
            transform: `scaleY(-1) translateY(-${layer.reflectionOffset ?? 4}px)`,
            transformOrigin: 'bottom center',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent 85%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent 85%)',
            pointerEvents: 'none',
            marginTop: 2
          }}
        >
          {layer.text}
        </div>
      )}
    </div>
  );
}

function drawRoundedRect(ctx, x, y, w, h, r) {
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

function splitGraphemes(str) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('bn', { granularity: 'grapheme' });
    return Array.from(seg.segment(str), (s) => s.segment);
  }
  return Array.from(str);
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = (text || '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    const words = para.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth) {
        if (current) {
          lines.push(current);
          current = '';
        }
        if (ctx.measureText(word).width > maxWidth) {
          const chars = splitGraphemes(word);
          let chunk = '';
          for (const ch of chars) {
            const tChunk = chunk + ch;
            if (ctx.measureText(tChunk).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk = tChunk;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function drawTextLayerOnCanvas(ctx, layer, scale) {
  const fSize = (layer.fontSize || 22) * scale;
  const weight = layer.isBold === false ? 400 : 700;
  const style = layer.isItalic ? 'italic ' : '';

  if (layer.font && layer.font !== 'sans-serif') {
    try {
      await document.fonts.load(`${style}${weight} ${fSize}px "${layer.font}"`);
    } catch {}
  }

  ctx.save();
  const sx = Math.tan(((layer.skewX ?? 0) * Math.PI) / 180);
  const sy = Math.tan(((layer.skewY ?? 0) * Math.PI) / 180);
  const scaleRx = Math.max(0.25, Math.cos(((layer.rotateY ?? 0) * Math.PI) / 180));
  const scaleRy = Math.max(0.25, Math.cos(((layer.rotateX ?? 0) * Math.PI) / 180));
  ctx.transform(scaleRx, sy * scaleRx, sx * scaleRy, scaleRy, 0, 0);

  ctx.font = `${style}${weight} ${fSize}px "${layer.font || 'sans-serif'}", sans-serif`;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${(layer.letterSpacing ?? 0) * scale}px`;
  }

  const padX = (layer.paddingX ?? 0) * scale;
  const padY = (layer.paddingY ?? 0) * scale;
  const lineH = fSize * (layer.lineHeight ?? 1.2);

  let boxW;
  let lines;
  if (layer.width) {
    boxW = layer.width * scale;
    lines = wrapLines(ctx, layer.text, Math.max(20 * scale, boxW - padX * 2));
  } else {
    const canvasMaxW = (ctx.canvas?.width ? ctx.canvas.width * 0.92 : 304 * scale) - padX * 2;
    lines = wrapLines(ctx, layer.text, Math.max(20 * scale, canvasMaxW));
    const measuredMaxW = Math.max(1, ...lines.map((ln) => ctx.measureText(ln || ' ').width));
    boxW = measuredMaxW + padX * 2;
  }

  const firstM = ctx.measureText((lines[0] || ' ').trim() || 'আ');
  const lastM = ctx.measureText((lines[lines.length - 1] || ' ').trim() || 'আ');
  const inkAsc =
    typeof firstM.actualBoundingBoxAscent === 'number'
      ? firstM.actualBoundingBoxAscent
      : fSize * 0.72;
  const inkDesc =
    typeof lastM.actualBoundingBoxDescent === 'number'
      ? lastM.actualBoundingBoxDescent
      : fSize * 0.22;
  const visualH = Math.max(fSize * 0.6, (lines.length - 1) * lineH + inkAsc + inkDesc);
  const firstBaselineY = -visualH / 2 + inkAsc;

  if (layer.textBgEnabled) {
    ctx.fillStyle = layer.textBgColor || '#0f172a';
    drawRoundedRect(
      ctx,
      -boxW / 2,
      -visualH / 2 - padY,
      boxW,
      visualH + padY * 2,
      (layer.textBgRadius ?? 8) * scale
    );
    ctx.fill();
  }

  if (layer.shadow3dEnabled) {
    ctx.save();
    ctx.globalAlpha *= (layer.shadow3dOpacity ?? 50) / 100;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.filter = `blur(${(layer.shadow3dBlur ?? 8) * scale}px)`;
    ctx.beginPath();
    ctx.ellipse(0, visualH / 2 + padY + (layer.shadow3dY ?? 18) * scale, boxW * 0.36, 7 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let fillStyle = layer.color || '#f8fafc';
  if (layer.colorMode === 'gradient') {
    const gradInfo = resolveTextGradient(layer);
    let grad;
    if (gradInfo.type === 'radial') {
      const boxH = visualH + padY * 2;
      const rcx = (((gradInfo.cx ?? 50) - 50) / 100) * boxW;
      const rcy = (((gradInfo.cy ?? 50) - 50) / 100) * boxH;
      const maxR = Math.max(20 * scale, Math.hypot(boxW / 2 + Math.abs(rcx), boxH / 2 + Math.abs(rcy)));
      grad = ctx.createRadialGradient(rcx, rcy, 0, rcx, rcy, maxR);
    } else {
      const rad = (((gradInfo.angle ?? 90) - 90) * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const halfLen = (Math.abs(boxW * dx) + Math.abs((visualH + padY * 2) * dy)) / 2;
      grad = ctx.createLinearGradient(-dx * halfLen, -dy * halfLen, dx * halfLen, dy * halfLen);
    }
    gradInfo.stops.forEach((st, idx) => {
      const pos = Math.max(0, Math.min(1, (st.pos ?? (idx / (gradInfo.stops.length - 1)) * 100) / 100));
      grad.addColorStop(pos, st.color);
    });
    fillStyle = grad;
  }

  if (layer.textureSrc) {
    try {
      const tImg = new Image();
      if (!layer.textureSrc.startsWith('data:') && !layer.textureSrc.startsWith('blob:')) {
        tImg.crossOrigin = 'anonymous';
      }
      tImg.src = layer.textureSrc;
      await tImg.decode();
      const pattern = ctx.createPattern(tImg, 'repeat');
      if (pattern) {
        if (pattern.setTransform && typeof DOMMatrix !== 'undefined') {
          const ts = (layer.textureScale ?? 100) / 100;
          const tileW = boxW * ts;
          const patScale = tileW / (tImg.naturalWidth || 1);
          const tileH = (tImg.naturalHeight || 1) * patScale;
          pattern.setTransform(
            new DOMMatrix().translate(-tileW / 2, -tileH / 2).scale(patScale)
          );
        }
        fillStyle = pattern;
      }
    } catch {}
  }

  if (Math.abs(layer.curve ?? 0) > 1) {
    const curveVal = layer.curve;
    const str = layer.text.replace(/\n/g, ' ');
    const chars = splitGraphemes(str);
    const radius = Math.max(90 * scale, (14000 / Math.abs(curveVal)) * scale);
    const dir = curveVal > 0 ? 1 : -1;
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const totalArcW = widths.reduce((a, b) => a + b, 0);
    let angle = -(totalArcW / radius) / 2;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (layer.shadow) {
      ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = (layer.shadowBlur ?? 10) * scale;
      ctx.shadowOffsetX = (layer.shadowX ?? 0) * scale;
      ctx.shadowOffsetY = (layer.shadowY ?? 3) * scale;
    }

    chars.forEach((ch, idx) => {
      const cw = widths[idx];
      angle += cw / (2 * radius);
      ctx.save();
      ctx.translate(0, dir * radius);
      ctx.rotate(dir * angle);
      ctx.translate(0, -dir * radius);
      if (layer.strokeEnabled) {
        ctx.strokeStyle = layer.strokeColor || '#000000';
        ctx.lineWidth = (layer.strokeWidth ?? 2) * 2 * scale;
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, 0, 0);
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      angle += cw / (2 * radius);
    });

    ctx.restore();
    return;
  }

  const align = layer.align || 'center';
  ctx.textAlign = align === 'justify' ? 'center' : align;
  ctx.textBaseline = 'alphabetic';
  const anchorX = align === 'left' ? -boxW / 2 + padX : align === 'right' ? boxW / 2 - padX : 0;

  const renderLinesPass = (passStyle, dx = 0, dy = 0, useStroke = false) => {
    lines.forEach((line, idx) => {
      const yOff = firstBaselineY + idx * lineH + dy;
      if (useStroke && layer.strokeEnabled) {
        ctx.strokeStyle = layer.strokeColor || '#000000';
        ctx.lineWidth = (layer.strokeWidth ?? 2) * 2 * scale;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, anchorX + dx, yOff);
      }
      ctx.fillStyle = passStyle;
      ctx.fillText(line, anchorX + dx, yOff);
      if (!useStroke && layer.isUnderline) {
        const lw = ctx.measureText(line).width;
        const ux = align === 'left' ? anchorX : align === 'right' ? anchorX - lw : anchorX - lw / 2;
        ctx.fillRect(ux + dx, yOff + Math.max(2 * scale, fSize * 0.14), lw, Math.max(1.5, fSize * 0.06));
      }
    });
  };

  if (layer.text3dEnabled) {
    const depth = layer.depth3d ?? 6;
    const c3d = layer.color3d || '#475569';
    for (let i = depth; i >= 1; i--) {
      renderLinesPass(c3d, i * 0.8 * scale, i * 0.8 * scale, false);
    }
  }

  if (layer.embossEnabled) {
    const p = Math.max(1, (layer.embossIntensity ?? 4) / 3) * scale;
    renderLinesPass('rgba(255,255,255,0.65)', -p, -p, false);
    renderLinesPass('rgba(0,0,0,0.8)', p, p, false);
  }

  ctx.save();
  if (layer.shadow) {
    ctx.shadowColor = layer.shadowColor || 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = (layer.shadowBlur ?? 10) * scale;
    ctx.shadowOffsetX = (layer.shadowX ?? 0) * scale;
    ctx.shadowOffsetY = (layer.shadowY ?? 3) * scale;
  }
  renderLinesPass(fillStyle, 0, 0, true);
  ctx.restore();

  if (layer.reflectionEnabled) {
    ctx.save();
    ctx.globalAlpha *= (layer.reflectionOpacity ?? 45) / 100;
    ctx.translate(0, visualH + padY * 2 + (layer.reflectionOffset ?? 4) * scale);
    ctx.scale(1, -1);
    renderLinesPass(fillStyle, 0, 0, false);
    ctx.restore();
  }

  ctx.restore();
}
