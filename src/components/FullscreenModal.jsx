import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ObjectLayerContent } from './CanvasArea';
import { TextLayerContent } from '../utils/textRenderer';
import { getPatternCssStyle } from '../utils/patternMaker';
import { resolveMoodFilter } from '../utils/moodFilters';
import WatermarkOverlay from './WatermarkOverlay';

export default function FullscreenModal({
  open,
  onClose,
  boxW,
  boxH,
  bgConfig,
  layers,
  watermark
}) {
  const [fsZoom, setFsZoom] = useState(1);
  const [fsPan, setFsPan] = useState({ x: 0, y: 0 });
  const fsPointers = useRef(new Map());
  const fsGesture = useRef({
    mode: null,
    startX: 0,
    startY: 0,
    origPanX: 0,
    origPanY: 0,
    dist0: 1,
    origZoom: 1
  });

  useEffect(() => {
    if (open) {
      setFsZoom(1);
      setFsPan({ x: 0, y: 0 });
      fsPointers.current.clear();
      fsGesture.current.mode = null;
    }
  }, [open]);

  if (!open) return null;

  const patternStyle = !bgConfig.transparent ? getPatternCssStyle(bgConfig.pattern) : null;
  const bgMood = !bgConfig.transparent
    ? resolveMoodFilter(bgConfig.moodFilter)
    : { filterParts: [], tintCss: null, blendMode: 'normal' };

  const handleFsPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fsPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (fsPointers.current.size === 1) {
      fsGesture.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origPanX: fsPan.x,
        origPanY: fsPan.y
      };
    } else if (fsPointers.current.size === 2) {
      const [p1, p2] = Array.from(fsPointers.current.values());
      const dist0 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      fsGesture.current = { mode: 'pinch', dist0, origZoom: fsZoom };
    }
  };

  const handleFsPointerMove = (e) => {
    if (!fsPointers.current.has(e.pointerId)) return;
    fsPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (fsPointers.current.size === 2 && fsGesture.current.mode === 'pinch') {
      const [p1, p2] = Array.from(fsPointers.current.values());
      const dist1 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const nextZoom = Math.max(
        0.7,
        Math.min(4, fsGesture.current.origZoom * (dist1 / fsGesture.current.dist0))
      );
      setFsZoom(Number(nextZoom.toFixed(2)));
    } else if (fsPointers.current.size === 1 && fsGesture.current.mode === 'pan') {
      const dx = e.clientX - fsGesture.current.startX;
      const dy = e.clientY - fsGesture.current.startY;
      setFsPan({
        x: fsGesture.current.origPanX + dx,
        y: fsGesture.current.origPanY + dy
      });
    }
  };

  const handleFsPointerUp = (e) => {
    fsPointers.current.delete(e.pointerId);
    if (fsPointers.current.size === 1) {
      const [rem] = Array.from(fsPointers.current.values());
      fsGesture.current = {
        mode: 'pan',
        startX: rem.x,
        startY: rem.y,
        origPanX: fsPan.x,
        origPanY: fsPan.y
      };
    } else if (fsPointers.current.size === 0) {
      fsGesture.current.mode = null;
    }
  };

  const baseScale = Math.min(
    (window.innerWidth - 16) / boxW,
    (window.innerHeight - 110) / boxH
  );

  return (
    <div
      className="fullscreen-modal"
      onWheel={(e) => {
        const delta = e.deltaY < 0 ? 0.2 : -0.2;
        setFsZoom((z) => Number(Math.max(0.7, Math.min(4, z + delta)).toFixed(2)));
      }}
    >
      <button className="fullscreen-close-btn" onClick={onClose} title="বন্ধ করুন">
        <X size={20} />
      </button>

      <div
        className="fullscreen-stage"
        onPointerDown={handleFsPointerDown}
        onPointerMove={handleFsPointerMove}
        onPointerUp={handleFsPointerUp}
        onPointerCancel={handleFsPointerUp}
      >
        <div
          className={`canvas-box ${bgConfig.transparent ? 'canvas-transparent-bg' : ''}`}
          style={{
            width: `${boxW}px`,
            height: `${boxH}px`,
            transform: `translate(${fsPan.x}px, ${fsPan.y}px) scale(${fsZoom * baseScale})`,
            transition: fsGesture.current.mode ? 'none' : 'transform 0.12s ease-out',
            borderColor: 'rgba(255,255,255,0.2)'
          }}
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
              style={{
                background:
                  bgConfig.overlayGradient ||
                  'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.65) 100%)'
              }}
            />
          )}

          {layers.map((layer, index) => {
            if (layer.visible === false) return null;
            return (
              <div
                key={layer.id}
                className="layer-item"
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: layer.type === 'text' && !layer.width ? 'fit-content' : `${layer.width}px`,
                  maxWidth: layer.type === 'text' && !layer.width ? `${Math.round(boxW * 0.92)}px` : undefined,
                  height: layer.type === 'shape' ? `${layer.height || layer.width}px` : 'auto',
                  transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`,
                  zIndex: index + 1,
                  cursor: 'inherit'
                }}
              >
                {layer.type === 'text' ? (
                  <TextLayerContent layer={layer} />
                ) : (
                  <ObjectLayerContent layer={layer} />
                )}
              </div>
            );
          })}

          <WatermarkOverlay wm={watermark} boxW={boxW} />
        </div>
      </div>

      <div className="fullscreen-zoom-bar">
        <button
          className="fs-zoom-btn"
          onClick={() => setFsZoom((z) => Number(Math.max(0.7, z - 0.3).toFixed(2)))}
        >
          <ZoomOut size={16} />
        </button>
        <span className="fs-zoom-label">{Math.round(fsZoom * 100)}%</span>
        <button
          className="fs-zoom-btn"
          onClick={() => setFsZoom((z) => Number(Math.min(4, z + 0.3).toFixed(2)))}
        >
          <ZoomIn size={16} />
        </button>
        <button
          className="fs-zoom-btn"
          onClick={() => {
            setFsZoom(1);
            setFsPan({ x: 0, y: 0 });
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );
}
