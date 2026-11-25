import React, { useEffect, useRef, useState } from 'react';
import { RotateCw, Check, X, Eraser, Minus, Plus, RotateCcw, ArrowDownRight } from 'lucide-react';
import { TextLayerContent } from '../utils/textRenderer';
import { getPatternCssStyle } from '../utils/patternMaker';
import { parseGradientCss } from '../utils/colorPalette';
import { resolveMoodFilter } from '../utils/moodFilters';
import {
  collectOtherLayerTargets,
  computeMoveGuides,
  computeRotateSnap,
  triggerHapticTick
} from '../utils/smartGuides';
import { CanvasSmartGuides, CanvasSmartHud } from './CanvasSmartGuides';
import WatermarkOverlay from './WatermarkOverlay';

export const renderShapeSVG = (
  shapeId,
  color = '#ffffff',
  opacity = 0.85,
  strokeColor = null,
  strokeWidth = 0,
  customShape = null
) => {
  const props = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '100%',
    height: '100%',
    viewBox: '0 0 100 100',
    style: { opacity, display: 'block', overflow: 'visible' }
  };

  const parsedGrad =
    typeof color === 'string' && (color.includes('linear-gradient') || color.includes('radial-gradient'))
      ? parseGradientCss(color)
      : null;

  let gradDef = null;
  let fillCol = color;

  if (parsedGrad) {
    let h = 0;
    for (let i = 0; i < color.length; i++) {
      h = ((h << 5) - h + color.charCodeAt(i)) | 0;
    }
    const gid = `shg_${Math.abs(h).toString(36)}`;

    if (parsedGrad.type === 'radial') {
      gradDef = (
        <defs>
          <radialGradient
            id={gid}
            gradientUnits="userSpaceOnUse"
            cx={parsedGrad.cx ?? 50}
            cy={parsedGrad.cy ?? 50}
            r={65}
          >
            {parsedGrad.stops.map((st, idx) => (
              <stop key={idx} offset={`${Math.max(0, Math.min(100, st.pos))}%`} stopColor={st.color} />
            ))}
          </radialGradient>
        </defs>
      );
    } else {
      const rad = (((parsedGrad.angle ?? 135) - 90) * Math.PI) / 180;
      const dx = Math.cos(rad) * 50;
      const dy = Math.sin(rad) * 50;

      gradDef = (
        <defs>
          <linearGradient
            id={gid}
            gradientUnits="userSpaceOnUse"
            x1={Number((50 - dx).toFixed(2))}
            y1={Number((50 - dy).toFixed(2))}
            x2={Number((50 + dx).toFixed(2))}
            y2={Number((50 + dy).toFixed(2))}
          >
            {parsedGrad.stops.map((st, idx) => (
              <stop key={idx} offset={`${Math.max(0, Math.min(100, st.pos))}%`} stopColor={st.color} />
            ))}
          </linearGradient>
        </defs>
      );
    }
    fillCol = `url(#${gid})`;
  }

  const wrapSvg = (inner, extraProps = {}) => (
    <svg {...props} {...extraProps}>
      {gradDef}
      {inner}
    </svg>
  );

  if (shapeId === 'custom' && customShape?.d) {
    const fillOp = customShape.fillOpacity ?? 1;
    const fillAttr = fillOp <= 0 ? 'none' : fillCol;
    const hasExtStroke = strokeColor && strokeWidth > 0;
    const borderCol = hasExtStroke ? strokeColor : customShape.hasBorder ? fillCol : 'none';
    const borderW = hasExtStroke ? strokeWidth : customShape.hasBorder ? (customShape.defaultStrokeWidth ?? 2.8) : 0;

    return wrapSvg(
      <path
        d={customShape.d}
        fill={fillAttr}
        fillOpacity={fillOp}
        fillRule={customShape.fillRule || 'nonzero'}
        stroke={borderCol}
        strokeWidth={borderW}
        strokeDasharray={customShape.strokeDash ? '6 4' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
      { preserveAspectRatio: 'none' }
    );
  }

  const hasStroke = Boolean(strokeColor && strokeWidth > 0);
  const extraStroke = hasStroke ? { stroke: strokeColor, strokeWidth } : {};
  const borderCol = hasStroke ? strokeColor : fillCol;
  const getW = (def) => (hasStroke ? strokeWidth : def);

  switch (shapeId) {
    case 'divider-flower':
      return wrapSvg(
        <>
          <line x1="5" y1="50" x2="38" y2="50" stroke={borderCol} strokeWidth={getW(2.5)} strokeLinecap="round" />
          <circle cx="50" cy="50" r="6" fill="none" stroke={borderCol} strokeWidth={getW(2.5)} />
          <circle cx="50" cy="50" r="2" fill={fillCol} />
          <line x1="62" y1="50" x2="95" y2="50" stroke={borderCol} strokeWidth={getW(2.5)} strokeLinecap="round" />
        </>
      );
    case 'quote-frame':
      return wrapSvg(
        <>
          <rect x="4" y="4" width="92" height="92" rx="12" fill="none" stroke={borderCol} strokeWidth={getW(2.5)} />
          <rect x="9" y="9" width="82" height="82" rx="8" fill="none" stroke={borderCol} strokeWidth="1" strokeDasharray="4 3" />
        </>,
        { preserveAspectRatio: 'none' }
      );
    case 'corner-bracket':
      return wrapSvg(
        <path d="M5 25 L5 5 L25 5 M75 5 L95 5 L95 25 M95 75 L95 95 L75 95 M25 95 L5 95 L5 75" fill="none" stroke={borderCol} strokeWidth={getW(3.5)} strokeLinecap="round" />,
        { preserveAspectRatio: 'none' }
      );
    case 'glass-card':
      return wrapSvg(
        <rect x="2" y="2" width="96" height="96" rx="16" fill={fillCol} fillOpacity="0.16" stroke={borderCol} strokeWidth={getW(2)} />,
        { preserveAspectRatio: 'none' }
      );
    case 'heart-outline':
      return wrapSvg(
        <path d="M50 85 C20 62 8 42 20 25 C30 12 45 18 50 30 C55 18 70 12 80 25 C92 42 80 62 50 85 Z" fill="none" stroke={borderCol} strokeWidth={getW(3.5)} />
      );
    case 'heart-solid':
      return wrapSvg(
        <path d="M50 85 C20 62 8 42 20 25 C30 12 45 18 50 30 C55 18 70 12 80 25 C92 42 80 62 50 85 Z" fill={fillCol} {...extraStroke} />
      );
    case 'crescent-moon':
      return wrapSvg(
        <path d="M62 15 A36 36 0 1 0 85 72 A28 28 0 1 1 62 15 Z" fill={fillCol} {...extraStroke} />
      );
    case 'sparkle-stars':
      return wrapSvg(
        <>
          <path d="M50 10 L55 40 L85 45 L55 50 L50 80 L45 50 L15 45 L45 40 Z" fill={fillCol} {...extraStroke} />
          <circle cx="78" cy="22" r="4" fill={fillCol} />
          <circle cx="22" cy="75" r="3" fill={fillCol} />
        </>
      );
    case 'ribbon-banner':
      return wrapSvg(
        <path d="M10 30 L90 30 L82 50 L90 70 L10 70 L18 50 Z" fill={fillCol} fillOpacity="0.25" stroke={borderCol} strokeWidth={getW(2.5)} />,
        { preserveAspectRatio: 'none' }
      );
    case 'circle-ring':
      return wrapSvg(
        <>
          <circle cx="50" cy="50" r="42" fill="none" stroke={borderCol} strokeWidth={getW(2.5)} />
          <circle cx="50" cy="50" r="36" fill="none" stroke={borderCol} strokeWidth="1" strokeDasharray="5 4" />
        </>
      );
    case 'diamond-frame':
      return wrapSvg(
        <polygon points="50,5 95,50 50,95 5,50" fill="none" stroke={borderCol} strokeWidth={getW(3)} />
      );
    case 'leaf-branch':
      return wrapSvg(
        <>
          <path d="M15 80 Q50 50 85 20" fill="none" stroke={borderCol} strokeWidth={getW(2.5)} />
          <ellipse cx="42" cy="44" rx="10" ry="5" transform="rotate(-35 42 44)" fill={fillCol} />
          <ellipse cx="62" cy="36" rx="10" ry="5" transform="rotate(25 62 36)" fill={fillCol} />
          <ellipse cx="58" cy="54" rx="10" ry="5" transform="rotate(-35 58 54)" fill={fillCol} />
        </>
      );
    case 'quote-marks':
      return wrapSvg(
        <text x="50" y="72" textAnchor="middle" fontSize="85" fontFamily="Georgia, serif" fill={fillCol} opacity="0.45" {...extraStroke}>“”</text>
      );
    case 'arch-window':
      return wrapSvg(
        <path d="M12 95 L12 45 A38 38 0 0 1 88 45 L88 95 Z" fill="none" stroke={borderCol} strokeWidth={getW(3)} />,
        { preserveAspectRatio: 'none' }
      );
    case 'underline-wave':
      return wrapSvg(
        <path d="M8 50 Q29 35 50 50 T92 50" fill="none" stroke={borderCol} strokeWidth={getW(3.5)} strokeLinecap="round" />
      );
    case 'hexagon-badge':
      return wrapSvg(
        <polygon points="50,5 90,27 90,73 50,95 10,73 10,27" fill="none" stroke={borderCol} strokeWidth={getW(3)} />
      );
    case 'broken-heart':
      return wrapSvg(
        <>
          <path d="M48 82 C20 60 10 40 22 25 C31 14 43 19 48 29 L44 45 L52 56 L48 82 Z" fill={fillCol} {...extraStroke} />
          <path d="M53 82 C81 60 91 40 79 25 C70 14 58 19 53 29 L49 45 L57 56 L53 82 Z" fill={fillCol} opacity="0.7" {...extraStroke} />
        </>
      );
    case 'cloud-mist':
      return wrapSvg(
        <path d="M25 68 H75 A16 16 0 0 0 73 36 A22 22 0 0 0 32 32 A18 18 0 0 0 25 68 Z" fill={fillCol} fillOpacity="0.25" stroke={borderCol} strokeWidth={getW(2)} />
      );
    case 'pill-tag':
      return wrapSvg(
        <rect x="5" y="25" width="90" height="50" rx="25" fill={fillCol} fillOpacity="0.22" stroke={borderCol} strokeWidth={getW(2.5)} />,
        { preserveAspectRatio: 'none' }
      );
    case 'crown-minimal':
    default:
      return wrapSvg(
        <path d="M15 72 L22 32 L40 50 L50 24 L60 50 L78 32 L85 72 Z" fill="none" stroke={borderCol} strokeWidth={getW(3)} strokeLinejoin="round" />
      );
  }
};

export function ObjectLayerContent({ layer }) {
  const isMedia = layer.type === 'image' || layer.type === 'sticker';
  const layerMood = isMedia
    ? resolveMoodFilter(layer.moodFilter)
    : { filterParts: [], tintCss: null, blendMode: 'normal' };

  const filters = [...layerMood.filterParts];
  if (layer.shadow) {
    filters.push(`drop-shadow(${layer.shadowX ?? 0}px ${layer.shadowY ?? 4}px ${layer.shadowBlur ?? 8}px ${layer.shadowColor || 'rgba(0,0,0,0.8)'})`);
  }
  if (layer.embossEnabled) {
    filters.push(`drop-shadow(-1px -1px 0px rgba(255,255,255,0.55)) drop-shadow(2px 2px 1px rgba(0,0,0,0.75))`);
  }
  if (layer.brightness !== undefined && layer.brightness !== 100) {
    filters.push(`brightness(${layer.brightness}%)`);
  }
  if (layer.contrast !== undefined && layer.contrast !== 100) {
    filters.push(`contrast(${layer.contrast}%)`);
  }
  if (layer.saturate !== undefined && layer.saturate !== 100) {
    filters.push(`saturate(${layer.saturate}%)`);
  }
  if (layer.hueRotate) {
    filters.push(`hue-rotate(${layer.hueRotate}deg)`);
  }
  if (layer.blur) {
    filters.push(`blur(${layer.blur}px)`);
  }

  const transform3d = [
    'perspective(420px)',
    `rotateX(${layer.rotateX ?? 0}deg)`,
    `rotateY(${layer.rotateY ?? 0}deg)`,
    `skew(${layer.skewX ?? 0}deg, ${layer.skewY ?? 0}deg)`,
    `scale(${layer.flipH ? -1 : 1}, ${layer.flipV ? -1 : 1})`
  ].join(' ');

  const depthShadows = layer.text3dEnabled
    ? Array.from({ length: layer.depth3d ?? 5 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${(i + 1) * 1.2}px, ${(i + 1) * 1.2}px)`,
            opacity: 0.45,
            pointerEvents: 'none',
            zIndex: -1
          }}
        >
          {!isMedia && renderShapeSVG(layer.shapeId, layer.color3d || '#334155', layer.opacity ?? 0.85, null, 0, layer.customShape)}
        </div>
      ))
    : null;

  const content = isMedia ? (
    <div
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: layer.borderRadius ? `${layer.borderRadius}px` : 0,
        overflow: layer.borderRadius ? 'hidden' : 'visible',
        border: layer.strokeEnabled ? `${layer.strokeWidth ?? 2}px solid ${layer.strokeColor || '#ffffff'}` : 'none'
      }}
    >
      <img
        src={layer.src}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: 'auto',
          opacity: layer.opacity ?? 1,
          display: 'block',
          pointerEvents: 'none'
        }}
      />
      {layerMood.tintCss && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: layerMood.tintCss,
            mixBlendMode: layerMood.blendMode,
            WebkitMaskImage: `url(${layer.src})`,
            maskImage: `url(${layer.src})`,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  ) : (
    renderShapeSVG(
      layer.shapeId,
      layer.color,
      layer.opacity ?? 0.85,
      layer.strokeEnabled ? (layer.strokeColor || '#ffffff') : null,
      layer.strokeWidth ?? 2,
      layer.customShape
    )
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', transform: transform3d, filter: filters.join(' ') || 'none' }}>
      {depthShadows}
      {content}
      {layer.shadow3dEnabled && (
        <div
          style={{
            position: 'absolute',
            left: '15%',
            right: '15%',
            bottom: `-${layer.shadow3dY ?? 16}px`,
            height: 10,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.8)',
            opacity: (layer.shadow3dOpacity ?? 50) / 100,
            filter: `blur(${layer.shadow3dBlur ?? 7}px)`,
            pointerEvents: 'none'
          }}
        />
      )}
      {layer.reflectionEnabled && (
        <div
          style={{
            position: 'absolute',
            top: `calc(100% + ${layer.reflectionOffset ?? 4}px)`,
            left: 0,
            right: 0,
            height: '100%',
            transform: 'scaleY(-1)',
            opacity: (layer.reflectionOpacity ?? 40) / 100,
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 80%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 80%)',
            pointerEvents: 'none'
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

const BRUSH_COLORS = ['#f8fafc', '#fda4af', '#f43f5e', '#fde047', '#38bdf8', '#86efac', '#0f172a'];
const EMPTY_GUIDES = { vLines: [], hLines: [], spacing: [] };

const zoomToSlider = (z) => Math.log10(Math.max(1, Math.min(100, z))) * 50;
const sliderToZoom = (s) => Math.pow(10, Math.max(0, Math.min(100, s)) / 50);
const formatZoomLabel = (z) => (z < 10 ? `${Number(z.toFixed(1))}x` : `${Math.round(z)}x`);

export default function CanvasArea({
  canvasRef,
  canvasSize,
  bgConfig,
  layers,
  selectedId,
  setSelectedId,
  updateLayer,
  onDoubleClickText,
  gridOn,
  magnetOn,
  drawMode,
  onFinishDrawing,
  onCancelDrawing,
  watermark,
  zoomMode,
  onExitZoomMode,
  zoom,
  setZoom,
  pan,
  setPan
}) {
  const workspaceRef = useRef(null);
  const dragInfo = useRef(null);
  const lastSnapKeyRef = useRef('');
  const [guides, setGuides] = useState(EMPTY_GUIDES);
  const [hud, setHud] = useState(null);
  const [avail, setAvail] = useState({ w: 340, h: 340 });

  const wsPointers = useRef(new Map());
  const wsGesture = useRef({
    mode: null,
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
    dist0: 1,
    midX0: 0,
    midY0: 0,
    origZoom: 1
  });

  useEffect(() => {
    if (!zoomMode) {
      wsPointers.current.clear();
      wsGesture.current.mode = null;
    } else {
      dragInfo.current = null;
      isDrawingRef.current = false;
      setGuides(EMPTY_GUIDES);
      setHud(null);
    }
  }, [zoomMode]);

  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAvail({ w: Math.max(200, r.width - 12), h: Math.max(200, r.height - 12) });
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const ratio = (canvasSize?.width || 1080) / (canvasSize?.height || 1080);
  let boxW = avail.w;
  let boxH = Math.round(boxW / ratio);
  if (boxH > avail.h) {
    boxH = avail.h;
    boxW = Math.round(boxH * ratio);
  }
  const drawW = boxW * 2;
  const drawH = boxH * 2;

  const patternStyle = !bgConfig.transparent ? getPatternCssStyle(bgConfig.pattern) : null;
  const bgMood = !bgConfig.transparent
    ? resolveMoodFilter(bgConfig.moodFilter)
    : { filterParts: [], tintCss: null, blendMode: 'normal' };

  const clampPan = (nx, ny, z = zoom) => {
    if (z <= 1.01) return { x: 0, y: 0 };
    const maxX = (boxW * z) / 2;
    const maxY = (boxH * z) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny))
    };
  };

  const applyZoom = (rawZoom) => {
    const z = rawZoom <= 1.02 ? 1 : Number(Math.max(1, Math.min(100, rawZoom)).toFixed(2));
    setZoom(z);
    setPan((prev) => (z === 1 ? { x: 0, y: 0 } : clampPan(prev.x, prev.y, z)));
  };

  const startPinchFromPointers = () => {
    if (!workspaceRef.current || wsPointers.current.size < 2) return;
    const wsRect = workspaceRef.current.getBoundingClientRect();
    const cx = wsRect.left + wsRect.width / 2;
    const cy = wsRect.top + wsRect.height / 2;
    const [p1, p2] = Array.from(wsPointers.current.values());
    const dist0 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    wsGesture.current = {
      mode: 'pinch',
      dist0,
      midX0: (p1.x + p2.x) / 2 - cx,
      midY0: (p1.y + p2.y) / 2 - cy,
      origZoom: zoom,
      origPanX: pan.x,
      origPanY: pan.y
    };
  };

  const handleWsPointerDown = (e) => {
    if (!zoomMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    wsPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (wsPointers.current.size === 2) {
      startPinchFromPointers();
    } else if (wsPointers.current.size === 1) {
      wsGesture.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y
      };
    }
  };

  const handleWsPointerMove = (e) => {
    if (!zoomMode || !wsPointers.current.has(e.pointerId)) return;
    wsPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (wsPointers.current.size >= 2 && wsGesture.current.mode === 'pinch') {
      const g = wsGesture.current;
      const wsRect = workspaceRef.current.getBoundingClientRect();
      const cx = wsRect.left + wsRect.width / 2;
      const cy = wsRect.top + wsRect.height / 2;
      const [p1, p2] = Array.from(wsPointers.current.values());
      const dist1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const rawZ = g.origZoom * (dist1 / g.dist0);
      const nextZ = rawZ <= 1.02 ? 1 : Number(Math.max(1, Math.min(100, rawZ)).toFixed(2));
      const midX1 = (p1.x + p2.x) / 2 - cx;
      const midY1 = (p1.y + p2.y) / 2 - cy;
      const rawPanX = midX1 - ((g.midX0 - g.origPanX) / g.origZoom) * nextZ;
      const rawPanY = midY1 - ((g.midY0 - g.origPanY) / g.origZoom) * nextZ;
      setZoom(nextZ);
      setPan(nextZ === 1 ? { x: 0, y: 0 } : clampPan(rawPanX, rawPanY, nextZ));
    } else if (wsPointers.current.size === 1 && wsGesture.current.mode === 'pan') {
      const g = wsGesture.current;
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      setPan(clampPan(g.origPanX + dx, g.origPanY + dy, zoom));
    }
  };

  const handleWsPointerUp = (e) => {
    if (!zoomMode) return;
    wsPointers.current.delete(e.pointerId);
    if (wsPointers.current.size === 1) {
      const [rem] = Array.from(wsPointers.current.values());
      wsGesture.current = {
        mode: 'pan',
        startX: rem.x,
        startY: rem.y,
        origPanX: pan.x,
        origPanY: pan.y
      };
    } else if (wsPointers.current.size === 0) {
      wsGesture.current.mode = null;
    }
  };

  const drawCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [drawColor, setDrawColor] = useState('#f8fafc');
  const [drawSize, setDrawSize] = useState(6);

  useEffect(() => {
    if (drawMode && drawCanvasRef.current) {
      drawCanvasRef.current.getContext('2d').clearRect(0, 0, drawW, drawH);
    }
  }, [drawMode, drawW, drawH]);

  const getDrawCoords = (e) => {
    const rect = drawCanvasRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * drawW,
      y: ((e.clientY - rect.top) / rect.height) * drawH
    };
  };

  const handleDrawDown = (e) => {
    if (zoomMode) return;
    e.stopPropagation();
    const ctx = drawCanvasRef.current.getContext('2d');
    const { x, y } = getDrawCoords(e);
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDrawMove = (e) => {
    if (zoomMode || !isDrawingRef.current) return;
    const ctx = drawCanvasRef.current.getContext('2d');
    const { x, y } = getDrawCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleDrawUp = () => { isDrawingRef.current = false; };
  const handleClearDraw = () => { if (drawCanvasRef.current) drawCanvasRef.current.getContext('2d').clearRect(0, 0, drawW, drawH); };

  const handleSaveDraw = () => {
    const c = drawCanvasRef.current;
    if (!c) return onCancelDrawing?.();
    const ctx = c.getContext('2d');
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return onCancelDrawing?.();

    const pad = 12;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = cropW;
    out.height = cropH;
    out.getContext('2d').drawImage(c, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    onFinishDrawing?.({
      src: out.toDataURL('image/png'),
      x: ((minX + cropW / 2) / width) * 100,
      y: ((minY + cropH / 2) / height) * 100,
      width: Math.max(40, Math.round(cropW / 2))
    });
  };

  const handlePointerDown = (e, layer, mode = 'move') => {
    if (zoomMode || drawMode || layer.locked) return;
    e.stopPropagation();
    setSelectedId(layer.id);
    const rect = canvasRef.current.getBoundingClientRect();
    const layerEl = mode === 'move' ? e.currentTarget : e.currentTarget.parentElement;
    const domW = layerEl?.offsetWidth || layer.width || 110;
    const domH = layer.type === 'shape'
      ? (layer.height || layer.width || 110)
      : (layerEl?.offsetHeight || 60);

    dragInfo.current = {
      id: layer.id,
      type: layer.type,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
      origW: layer.width || domW,
      hasManualWidth: Boolean(layer.width),
      origH: domH,
      origFontSize: layer.fontSize || 22,
      origRot: layer.rotation || 0,
      origZoom: zoom,
      rect,
      draggedSizePct: { w: (domW / boxW) * 100, h: (domH / boxH) * 100 },
      otherTargets: mode === 'move'
        ? collectOtherLayerTargets(layers, layer.id, canvasRef.current, boxW, boxH)
        : []
    };
    lastSnapKeyRef.current = '';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const d = dragInfo.current;
    if (!d || zoomMode) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.mode === 'move') {
      const rawX = Math.max(2, Math.min(98, d.origX + (dx / d.rect.width) * 100));
      const rawY = Math.max(2, Math.min(98, d.origY + (dy / d.rect.height) * 100));
      const res = computeMoveGuides({
        rawX,
        rawY,
        draggedSizePct: d.draggedSizePct,
        otherTargets: d.otherTargets,
        magnetOn
      });

      if (magnetOn && res.snapKey && res.snapKey !== lastSnapKeyRef.current) {
        triggerHapticTick();
      }
      lastSnapKeyRef.current = res.snapKey;

      setGuides({ vLines: res.vLines, hLines: res.hLines, spacing: res.spacing });
      setHud({
        type: 'move',
        x: Math.round(res.x),
        y: Math.round(res.y),
        snapped: res.snapped,
        matched: res.vLines.length > 0 || res.hLines.length > 0 || res.spacing.length > 0
      });
      updateLayer(d.id, { x: res.x, y: res.y });
    } else if (d.mode === 'scale') {
      const rad = ((d.origRot || 0) * Math.PI) / 180;
      const z = d.origZoom || 1;
      const localDx = (dx * Math.cos(rad) + dy * Math.sin(rad)) / z;
      const localDy = (-dx * Math.sin(rad) + dy * Math.cos(rad)) / z;
      const rawFactor =
        1 +
        (localDx / Math.max(16, d.origW / 2) + localDy / Math.max(16, d.origH / 2)) / 2;
      const maxDim = Math.round(Math.max(boxW, boxH) * 1.6);

      if (d.type === 'text') {
        const minF = Math.max(10 / d.origFontSize, 40 / d.origW);
        const maxF = Math.min(120 / d.origFontSize, maxDim / d.origW);
        const f = Math.max(minF, Math.min(maxF, rawFactor));
        const nextSize = Math.round(d.origFontSize * f);
        if (d.hasManualWidth) {
          const nextW = Math.round(d.origW * f);
          updateLayer(d.id, { fontSize: nextSize, width: nextW });
          setHud({ type: 'scale', text: `ফন্ট: ${nextSize}px • প্রস্থ: ${nextW}px` });
        } else {
          updateLayer(d.id, { fontSize: nextSize });
          setHud({ type: 'scale', text: `ফন্ট: ${nextSize}px` });
        }
      } else if (d.type === 'shape') {
        const minF = Math.max(20 / d.origW, 20 / d.origH);
        const maxF = Math.min(maxDim / d.origW, maxDim / d.origH);
        const f = Math.max(minF, Math.min(maxF, rawFactor));
        const nextW = Math.round(d.origW * f);
        const nextH = Math.round(d.origH * f);
        updateLayer(d.id, { width: nextW, height: nextH });
        setHud({ type: 'scale', text: `সাইজ: ${nextW} × ${nextH}` });
      } else {
        const nextW = Math.max(24, Math.min(maxDim, Math.round(d.origW * rawFactor)));
        updateLayer(d.id, { width: nextW });
        setHud({ type: 'scale', text: `প্রস্থ: ${nextW}px` });
      }
    } else if (d.mode === 'width-r' || d.mode === 'width-l') {
      const rad = ((d.origRot || 0) * Math.PI) / 180;
      const proj = dx * Math.cos(rad) + dy * Math.sin(rad);
      const delta = (d.mode === 'width-r' ? proj * 1.5 : -proj * 1.5) / (d.origZoom || 1);
      const nextW = Math.max(24, Math.min(Math.round(boxW * 1.5), Math.round(d.origW + delta)));
      updateLayer(d.id, { width: nextW });
      setHud({ type: 'size', text: `প্রস্থ: ${nextW}px` });
    } else if (d.mode === 'rotate') {
      const layer = layers.find((l) => l.id === d.id);
      if (!layer) return;
      const cx = d.rect.left + (layer.x / 100) * d.rect.width;
      const cy = d.rect.top + (layer.y / 100) * d.rect.height;
      let rawAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI) - 90;
      rawAngle = ((rawAngle + 180) % 360 + 360) % 360 - 180;

      const rotRes = computeRotateSnap(rawAngle, magnetOn);
      const rotKey = rotRes.nearKey !== null ? `rot:${rotRes.nearKey}` : '';
      if (magnetOn && rotKey && rotKey !== lastSnapKeyRef.current) {
        triggerHapticTick();
      }
      lastSnapKeyRef.current = rotKey;

      updateLayer(d.id, { rotation: rotRes.angle });
      setHud({ type: 'rotate', angle: rotRes.angle, nearKey: rotRes.nearKey });
    }
  };

  const handlePointerUp = () => {
    dragInfo.current = null;
    lastSnapKeyRef.current = '';
    setGuides(EMPTY_GUIDES);
    setHud(null);
  };

  const hasZoom = zoom > 1 || pan.x !== 0 || pan.y !== 0;

  return (
    <main
      ref={workspaceRef}
      className="canvas-workspace"
      style={{ cursor: zoomMode ? 'grab' : undefined }}
      onPointerDown={handleWsPointerDown}
      onPointerMove={handleWsPointerMove}
      onPointerUp={handleWsPointerUp}
      onPointerCancel={handleWsPointerUp}
      onWheel={(e) => {
        if (!zoomMode) return;
        const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
        applyZoom(zoom * factor);
      }}
      onClick={() => {
        if (!zoomMode && !drawMode) setSelectedId(null);
      }}
    >
      <CanvasSmartHud hud={hud} magnetOn={magnetOn} />

      {zoomMode && (
        <div
          className="canvas-zoom-hud"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="canvas-zoom-bar">
            <button
              className="canvas-zoom-btn"
              onClick={() => applyZoom(sliderToZoom(zoomToSlider(zoom) - 8))}
              title="জুম কমান"
            >
              <Minus size={13} />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={zoomToSlider(zoom)}
              onChange={(e) => applyZoom(sliderToZoom(Number(e.target.value)))}
            />
            <button
              className="canvas-zoom-btn"
              onClick={() => applyZoom(sliderToZoom(zoomToSlider(zoom) + 8))}
              title="জুম বাড়ান"
            >
              <Plus size={13} />
            </button>
            <span className="canvas-zoom-label">{formatZoomLabel(zoom)}</span>
            <button
              className="canvas-zoom-btn"
              style={{ background: '#0284c7', borderColor: '#38bdf8' }}
              onClick={onExitZoomMode}
              title="জুম মোড শেষ"
            >
              <Check size={13} />
            </button>
            <button
              className="canvas-zoom-btn"
              style={{ opacity: hasZoom ? 1 : 0.4 }}
              disabled={!hasZoom}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              title="জুম রিসেট (1x)"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      )}

      <div
        ref={canvasRef}
        className={`canvas-box ${bgConfig.transparent ? 'canvas-transparent-bg' : ''}`}
        style={{
          width: `${boxW}px`,
          height: `${boxH}px`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transition: wsGesture.current.mode ? 'none' : 'transform 0.08s ease-out',
          pointerEvents: zoomMode ? 'none' : undefined
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {!bgConfig.transparent && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: bgConfig.gradient,
              filter: bgMood.filterParts.length ? bgMood.filterParts.join(' ') : 'none',
              pointerEvents: 'none'
            }}
          >
            {bgConfig.useImage && (
              <img
                src={bgConfig.imageSrc}
                alt="Background"
                className="canvas-bg-img"
                style={{
                  opacity: bgConfig.imageOpacity ?? 0.65,
                  filter: `brightness(${bgConfig.brightness ?? 85}%) contrast(${bgConfig.contrast ?? 110}%) blur(${bgConfig.blur ?? 0}px)`
                }}
              />
            )}
            {patternStyle && <div className="canvas-overlay" style={patternStyle} />}
          </div>
        )}

        {bgMood.tintCss && (
          <div
            className="canvas-overlay"
            style={{ backgroundColor: bgMood.tintCss, mixBlendMode: bgMood.blendMode }}
          />
        )}

        {!bgConfig.transparent && bgConfig.overlayGradient !== 'none' && (
          <div
            className="canvas-overlay"
            style={{ background: bgConfig.overlayGradient || 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.65) 100%)' }}
          />
        )}

        {gridOn && <div className="grid-lines" />}
        <CanvasSmartGuides guides={guides} />

        {layers.map((layer, index) => {
          if (layer.visible === false) return null;
          const isSelected = !drawMode && layer.id === selectedId;

          return (
            <div
              key={layer.id}
              data-layer-id={layer.id}
              className={`layer-item ${isSelected ? 'layer-selected' : ''}`}
              onClick={(e) => {
                if (!zoomMode) e.stopPropagation();
              }}
              onPointerDown={(e) => handlePointerDown(e, layer, 'move')}
              onDoubleClick={(e) => {
                if (zoomMode) return;
                e.stopPropagation();
                if (!layer.locked && layer.type === 'text') onDoubleClickText(layer);
              }}
              style={{
                left: `${layer.x}%`,
                top: `${layer.y}%`,
                width: layer.type === 'text' && !layer.width ? 'fit-content' : `${layer.width}px`,
                maxWidth: layer.type === 'text' && !layer.width ? `${Math.round(boxW * 0.92)}px` : undefined,
                height: layer.type === 'shape' ? `${layer.height || layer.width}px` : 'auto',
                transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`,
                zIndex: index + 1
              }}
            >
              {layer.type === 'text' ? <TextLayerContent layer={layer} /> : <ObjectLayerContent layer={layer} />}

              {isSelected && (
                <>
                  <div
                    className="handle-width-l"
                    onPointerDown={(e) => handlePointerDown(e, layer, 'width-l')}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (layer.type === 'text') updateLayer(layer.id, { width: null });
                    }}
                  />
                  <div
                    className="handle-width-r"
                    onPointerDown={(e) => handlePointerDown(e, layer, 'width-r')}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (layer.type === 'text') updateLayer(layer.id, { width: null });
                    }}
                  />
                  <div
                    className="handle-scale-br"
                    title="ছোট-বড় করুন"
                    onPointerDown={(e) => handlePointerDown(e, layer, 'scale')}
                  >
                    <ArrowDownRight size={11} />
                  </div>
                  <div className="handle-rotate" onPointerDown={(e) => handlePointerDown(e, layer, 'rotate')}>
                    <RotateCw size={10} />
                  </div>
                </>
              )}
            </div>
          );
        })}

        <WatermarkOverlay wm={watermark} boxW={boxW} />

        {drawMode && (
          <canvas
            ref={drawCanvasRef}
            width={drawW}
            height={drawH}
            className="draw-canvas-overlay"
            onPointerDown={handleDrawDown}
            onPointerMove={handleDrawMove}
            onPointerUp={handleDrawUp}
            onPointerCancel={handleDrawUp}
          />
        )}
      </div>

      {drawMode && !zoomMode && (
        <div
          className="draw-toolbar"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="draw-colors">
            {BRUSH_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDrawColor(c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: c,
                  border: drawColor === c ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.25)',
                  cursor: 'pointer'
                }}
              />
            ))}
            <input type="range" min="2" max="20" value={drawSize} onChange={(e) => setDrawSize(Number(e.target.value))} style={{ width: 62, accentColor: '#38bdf8' }} />
          </div>
          <div className="draw-actions">
            <button className="draw-btn" onClick={handleClearDraw} title="মুছুন"><Eraser size={14} /></button>
            <button className="draw-btn cancel" onClick={onCancelDrawing} title="বাতিল"><X size={14} /></button>
            <button className="draw-btn done" onClick={handleSaveDraw} title="লেয়ারে যোগ করুন"><Check size={14} /> সেভ</button>
          </div>
        </div>
      )}
    </main>
  );
}
