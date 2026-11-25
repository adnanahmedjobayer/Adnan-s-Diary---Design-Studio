import React, { useEffect, useRef, useState } from 'react';
import {
  RotateCcw, RotateCw, Maximize2, Lock, Unlock,
  Circle, FlipHorizontal, FlipVertical, X, Check, Search
} from 'lucide-react';

const RATIOS = [
  { id: 'free', label: 'Free', r: null, rw: 20, rh: 16 },
  { id: '1:1', label: '1:1', r: 1, w: 1080, h: 1080, rw: 18, rh: 18 },
  { id: '16:9', label: '16:9', r: 16 / 9, w: 1280, h: 720, rw: 24, rh: 14 },
  { id: '4:3', label: '4:3', r: 4 / 3, w: 1200, h: 900, rw: 22, rh: 16 },
  { id: '3:2', label: '3:2', r: 3 / 2, w: 1200, h: 800, rw: 22, rh: 15 },
  { id: '9:16', label: '9:16', r: 9 / 16, w: 1080, h: 1920, rw: 13, rh: 22 },
  { id: '3:4', label: '3:4', r: 3 / 4, w: 900, h: 1200, rw: 15, rh: 20 },
  { id: '2:3', label: '2:3', r: 2 / 3, w: 800, h: 1200, rw: 14, rh: 21 },
  { id: '4:6', label: '4:6', r: 4 / 6, w: 800, h: 1200, rw: 14, rh: 21 }
];

export default function BgCropModal({ imageSrc, onCancel, onApply }) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);

  const [rawImg, setRawImg] = useState(null);
  const [stageSize, setStageSize] = useState({ w: 320, h: 380 });
  const [rot, setRot] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [ratioId, setRatioId] = useState('free');
  const [locked, setLocked] = useState(false);
  const [circleMode, setCircleMode] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ x: 20, y: 20, w: 200, h: 200 });

  useEffect(() => {
    const img = new Image();
    if (imageSrc && !imageSrc.startsWith('data:') && !imageSrc.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => setRawImg(img);
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStageSize({ w: Math.max(200, r.width - 24), h: Math.max(200, r.height - 24) });
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, []);

  const isRotated90 = rot % 180 !== 0;
  const srcW = rawImg ? (isRotated90 ? rawImg.naturalHeight : rawImg.naturalWidth) : 1;
  const srcH = rawImg ? (isRotated90 ? rawImg.naturalWidth : rawImg.naturalHeight) : 1;
  const fitScale = Math.min(stageSize.w / srcW, stageSize.h / srcH);
  const dispW = Math.max(80, Math.round(srcW * fitScale * zoom));
  const dispH = Math.max(80, Math.round(srcH * fitScale * zoom));

  const fitBoxToRatio = (rVal, dw = dispW, dh = dispH) => {
    if (!rVal) return { x: 10, y: 10, w: dw - 20, h: dh - 20 };
    let w = dw * 0.9;
    let h = w / rVal;
    if (h > dh * 0.9) {
      h = dh * 0.9;
      w = h * rVal;
    }
    return {
      x: Math.round((dw - w) / 2),
      y: Math.round((dh - h) / 2),
      w: Math.round(w),
      h: Math.round(h)
    };
  };

  // রোটেশন বা স্ক্রিন সাইজ বদলালে বক্স ফিট করা (zoom বদলালে বক্স রিসেট হবে না)
  useEffect(() => {
    if (!rawImg) return;
    const item = RATIOS.find((x) => x.id === ratioId);
    const baseW = Math.max(80, Math.round(srcW * fitScale * zoom));
    const baseH = Math.max(80, Math.round(srcH * fitScale * zoom));
    setBox(fitBoxToRatio(item?.r || null, baseW, baseH));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawImg, rot, stageSize.w, stageSize.h]);

  // জুম কমালে যেন ক্রপ বক্স ছবির বাইরে না যায় শুধু সেটুকু সীমাবদ্ধ করা
  useEffect(() => {
    if (!rawImg) return;
    setBox((prev) => {
      let w = Math.min(prev.w, dispW);
      let h = Math.min(prev.h, dispH);
      const ar = RATIOS.find((x) => x.id === ratioId)?.r;
      if (ar) {
        if (w / h > ar) w = h * ar;
        else h = w / ar;
      }
      w = Math.max(36, w);
      h = Math.max(36, h);
      const x = Math.max(0, Math.min(dispW - w, prev.x));
      const y = Math.max(0, Math.min(dispH - h, prev.y));
      return { x, y, w, h };
    });
  }, [dispW, dispH, rawImg, ratioId]);

  const selectRatio = (item) => {
    setRatioId(item.id);
    setLocked(Boolean(item.r));
    setBox(fitBoxToRatio(item.r, dispW, dispH));
  };

  const currentRatio = () => RATIOS.find((x) => x.id === ratioId)?.r || (locked ? box.w / box.h : null);

  const startDrag = (e, mode) => {
    e.stopPropagation();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...box },
      ar: currentRatio()
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDrag = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const o = d.orig;
    const min = 36;

    if (d.mode === 'move') {
      setBox({
        ...o,
        x: Math.max(0, Math.min(dispW - o.w, o.x + dx)),
        y: Math.max(0, Math.min(dispH - o.h, o.y + dy))
      });
      return;
    }

    let left = o.x, top = o.y, right = o.x + o.w, bottom = o.y + o.h;
    if (d.mode.includes('l')) left = Math.max(0, Math.min(right - min, o.x + dx));
    if (d.mode.includes('r')) right = Math.min(dispW, Math.max(left + min, o.x + o.w + dx));
    if (d.mode.includes('t')) top = Math.max(0, Math.min(bottom - min, o.y + dy));
    if (d.mode.includes('b')) bottom = Math.min(dispH, Math.max(top + min, o.y + o.h + dy));

    let w = right - left;
    let h = bottom - top;

    if (d.ar) {
      if (d.mode === 'tc' || d.mode === 'bc') {
        w = h * d.ar;
        if (left + w > dispW) { w = dispW - left; h = w / d.ar; }
      } else {
        h = w / d.ar;
        if (top + h > dispH) { h = dispH - top; w = h * d.ar; }
      }
      if (d.mode.includes('t')) top = bottom - h;
      if (d.mode.includes('l')) left = right - w;
      left = Math.max(0, left);
      top = Math.max(0, top);
    }

    setBox({ x: left, y: top, w, h });
  };

  const endDrag = () => { dragRef.current = null; };

  const handleConfirm = () => {
    if (!rawImg) return;
    const tCan = document.createElement('canvas');
    tCan.width = srcW;
    tCan.height = srcH;
    const tCtx = tCan.getContext('2d');
    tCtx.translate(srcW / 2, srcH / 2);
    tCtx.rotate((rot * Math.PI) / 180);
    tCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    tCtx.drawImage(rawImg, -rawImg.naturalWidth / 2, -rawImg.naturalHeight / 2);

    const sx = (box.x / dispW) * srcW;
    const sy = (box.y / dispH) * srcH;
    const sw = Math.max(1, (box.w / dispW) * srcW);
    const sh = Math.max(1, (box.h / dispH) * srcH);

    const maxOut = 1440;
    const sc = Math.min(1, maxOut / Math.max(sw, sh));
    const outW = Math.round(sw * sc);
    const outH = Math.round(sh * sc);

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const oCtx = out.getContext('2d');

    if (circleMode) {
      oCtx.beginPath();
      oCtx.ellipse(outW / 2, outH / 2, outW / 2, outH / 2, 0, 0, Math.PI * 2);
      oCtx.closePath();
      oCtx.clip();
    }
    oCtx.drawImage(tCan, sx, sy, sw, sh, 0, 0, outW, outH);

    const picked = RATIOS.find((x) => x.id === ratioId);
    const nextSize = picked && picked.w && picked.h ? { width: picked.w, height: picked.h } : null;
    onApply(out.toDataURL('image/png'), nextSize);
  };

  const handles = [
    { id: 'tl', left: '0%', top: '0%', cursor: 'nwse-resize' },
    { id: 'tc', left: '50%', top: '0%', cursor: 'ns-resize' },
    { id: 'tr', left: '100%', top: '0%', cursor: 'nesw-resize' },
    { id: 'ml', left: '0%', top: '50%', cursor: 'ew-resize' },
    { id: 'mr', left: '100%', top: '50%', cursor: 'ew-resize' },
    { id: 'bl', left: '0%', top: '100%', cursor: 'nesw-resize' },
    { id: 'bc', left: '50%', top: '100%', cursor: 'ns-resize' },
    { id: 'br', left: '100%', top: '100%', cursor: 'nwse-resize' }
  ];

  return (
    <div className="px-crop-overlay">
      <div className="px-crop-topbar">
        <span>Crop ({Math.round(box.w)}×{Math.round(box.h)})</span>
        <button className="icon-btn" onClick={() => setShowZoom((z) => !z)} title="Zoom">
          <Search size={16} />
        </button>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round(zoom * 100)}%</span>
      </div>

      {showZoom && (
        <div style={{ background: '#161c28', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11 }}>Zoom:</span>
          <input type="range" min="1" max="2.5" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          <button className="chip-btn" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setZoom(1)}>1x</button>
        </div>
      )}

      <div
        className="px-crop-stage"
        ref={stageRef}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div style={{ position: 'relative', width: dispW, height: dispH, overflow: 'hidden', background: '#000' }}>
          {rawImg && (
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: rawImg.naturalWidth * fitScale * zoom,
                height: rawImg.naturalHeight * fitScale * zoom,
                maxWidth: 'none',
                transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
                pointerEvents: 'none'
              }}
            />
          )}

          <div
            className="px-crop-box"
            style={{
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              borderRadius: circleMode ? '50%' : 0
            }}
            onPointerDown={(e) => startDrag(e, 'move')}
          >
            <div className="px-crop-grid" style={{ borderRadius: circleMode ? '50%' : 0 }} />
            {handles.map((h) => (
              <div
                key={h.id}
                className="px-crop-handle"
                style={{ left: h.left, top: h.top, cursor: h.cursor }}
                onPointerDown={(e) => startDrag(e, h.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-crop-bottom">
        <div className="px-crop-ratios">
          {RATIOS.map((item) => (
            <button key={item.id} className={`px-ratio-btn ${ratioId === item.id ? 'active' : ''}`} onClick={() => selectRatio(item)}>
              <div style={{ width: item.rw, height: item.rh, border: '1.5px solid currentColor', borderRadius: 2 }} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="px-crop-tools-row">
          <button className="px-crop-bar-btn" onClick={() => setRot((r) => (r - 90 + 360) % 360)}><RotateCcw size={18} /></button>
          <button className="px-crop-bar-btn" onClick={() => setRot((r) => (r + 90) % 360)}><RotateCw size={18} /></button>
          <button className="px-crop-bar-btn" onClick={() => setBox({ x: 0, y: 0, w: dispW, h: dispH })}><Maximize2 size={18} /></button>
          <button className={`px-crop-bar-btn ${locked ? 'active' : ''}`} onClick={() => setLocked((l) => !l)}>
            {locked ? <Lock size={18} /> : <Unlock size={18} />}
          </button>
          <button className={`px-crop-bar-btn ${circleMode ? 'active' : ''}`} onClick={() => setCircleMode((c) => !c)}>
            <Circle size={18} />
          </button>
        </div>

        <div className="px-crop-actions-row">
          <button className={`px-crop-bar-btn ${flipH ? 'active' : ''}`} onClick={() => setFlipH((f) => !f)}><FlipHorizontal size={18} /></button>
          <button className={`px-crop-bar-btn ${flipV ? 'active' : ''}`} onClick={() => setFlipV((f) => !f)}><FlipVertical size={18} /></button>
          <button className="px-crop-bar-btn" onClick={onCancel} style={{ color: '#fda4af' }}><X size={20} /></button>
          <button className="px-crop-bar-btn" onClick={handleConfirm} style={{ color: '#38bdf8' }}><Check size={20} /></button>
        </div>
      </div>
    </div>
  );
}
