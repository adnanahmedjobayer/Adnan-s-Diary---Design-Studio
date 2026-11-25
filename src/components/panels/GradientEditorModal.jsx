import React, { useMemo, useRef, useState } from 'react';
import {
  Plus, Minus, ChevronLeft, ChevronRight, Code2,
  PaintBucket, Pipette, X, Check
} from 'lucide-react';
import {
  DEFAULT_SOLIDS,
  getUserSolids,
  normalizeHex,
  parseGradientCss,
  sampleCurrentCanvas
} from '../../utils/colorPalette';

const uid = () => Math.random().toString(36).slice(2, 8);

const PRESET_DIRS = [
  { id: 'lr', type: 'linear', sx: 0, sy: 50, ex: 100, ey: 50, bg: 'linear-gradient(90deg, #e0f2fe, #0369a1)' },
  { id: 'tb', type: 'linear', sx: 50, sy: 0, ex: 50, ey: 100, bg: 'linear-gradient(180deg, #e0f2fe, #0369a1)' },
  { id: 'diag', type: 'linear', sx: 0, sy: 0, ex: 100, ey: 100, bg: 'linear-gradient(135deg, #e0f2fe, #0369a1)' },
  { id: 'rad-c', type: 'radial', sx: 50, sy: 50, ex: 92, ey: 50, bg: 'radial-gradient(circle at 50% 50%, #e0f2fe, #0369a1)' },
  { id: 'rad-inv', type: 'radial', sx: 50, sy: 50, ex: 92, ey: 50, invert: true, bg: 'radial-gradient(circle at 50% 50%, #0369a1, #bae6fd)' },
  { id: 'rad-tl', type: 'radial', sx: 22, sy: 22, ex: 88, ey: 88, bg: 'radial-gradient(circle at 22% 22%, #e0f2fe, #0369a1)' }
];

function buildInitialState(initialGradient) {
  const parsed = initialGradient ? parseGradientCss(initialGradient) : null;
  if (parsed && parsed.stops.length >= 2) {
    const stops = parsed.stops.map((s) => ({
      id: uid(),
      color: s.color,
      pos: Math.max(0, Math.min(100, Math.round(s.pos)))
    }));
    if (parsed.type === 'radial') {
      return {
        type: 'radial',
        startPt: { x: parsed.cx ?? 50, y: parsed.cy ?? 50 },
        endPt: { x: Math.min(96, (parsed.cx ?? 50) + 42), y: parsed.cy ?? 50 },
        stops
      };
    }
    const rad = (((parsed.angle ?? 90) - 90) * Math.PI) / 180;
    const dx = Math.cos(rad) * 48;
    const dy = Math.sin(rad) * 48;
    return {
      type: 'linear',
      startPt: { x: Math.round(50 - dx), y: Math.round(50 - dy) },
      endPt: { x: Math.round(50 + dx), y: Math.round(50 + dy) },
      stops
    };
  }

  return {
    type: 'linear',
    startPt: { x: 0, y: 50 },
    endPt: { x: 100, y: 50 },
    stops: [
      { id: uid(), color: '#0f172a', pos: 0 },
      { id: uid(), color: '#f8fafc', pos: 100 }
    ]
  };
}

export default function GradientEditorModal({ initialGradient, onCancel, onApply }) {
  const init = useMemo(() => buildInitialState(initialGradient), [initialGradient]);
  const [gradType, setGradType] = useState(init.type);
  const [startPt, setStartPt] = useState(init.startPt);
  const [endPt, setEndPt] = useState(init.endPt);
  const [stops, setStops] = useState(init.stops);
  const [activeId, setActiveId] = useState(init.stops[init.stops.length - 1]?.id || init.stops[0]?.id);
  const [activePreset, setActivePreset] = useState(init.type === 'radial' ? 'rad-c' : 'lr');

  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [hexInput, setHexInput] = useState('#ffffff');
  const [pickerSnap, setPickerSnap] = useState(null);

  const previewRef = useRef(null);
  const barRef = useRef(null);
  const dragTargetRef = useRef(null);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.pos - b.pos),
    [stops]
  );

  const computedGradient = useMemo(() => {
    const dx = endPt.x - startPt.x;
    const dy = endPt.y - startPt.y;
    const len = Math.hypot(dx, dy) || 1;

    if (gradType === 'radial') {
      const cx = Math.round(startPt.x);
      const cy = Math.round(startPt.y);
      const spread = Math.max(0.25, Math.min(1.8, len / 55));
      const mapped = sortedStops.map((s) => ({
        color: s.color,
        pos: Math.round(s.pos * spread)
      }));
      const stopStr = mapped.map((s) => `${s.color} ${s.pos}%`).join(', ');
      return {
        type: 'radial',
        cx,
        cy,
        angle: 135,
        stops: mapped,
        css: `radial-gradient(circle at ${cx}% ${cy}%, ${stopStr})`
      };
    }

    const angle = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360);
    const dirX = dx / len;
    const dirY = dy / len;
    const halfCss = 50 * (Math.abs(dirX) + Math.abs(dirY)) || 50;
    const sProj = (startPt.x - 50) * dirX + (startPt.y - 50) * dirY;
    const eProj = (endPt.x - 50) * dirX + (endPt.y - 50) * dirY;
    const p0 = 50 + (sProj / halfCss) * 50;
    const p1 = 50 + (eProj / halfCss) * 50;

    const mapped = sortedStops.map((s) => ({
      color: s.color,
      pos: Math.round(p0 + (s.pos / 100) * (p1 - p0))
    }));
    const stopStr = mapped.map((s) => `${s.color} ${s.pos}%`).join(', ');

    return {
      type: 'linear',
      angle,
      cx: 50,
      cy: 50,
      stops: mapped,
      css: `linear-gradient(${angle}deg, ${stopStr})`
    };
  }, [gradType, startPt, endPt, sortedStops]);

  const activeStop = stops.find((s) => s.id === activeId) || stops[0];

  const handlePresetClick = (p) => {
    setActivePreset(p.id);
    setGradType(p.type);
    setStartPt({ x: p.sx, y: p.sy });
    setEndPt({ x: p.ex, y: p.ey });
    if (p.invert) {
      setStops((prev) => prev.map((s) => ({ ...s, pos: 100 - s.pos })));
    }
  };

  const handlePreviewPointerDown = (e, target) => {
    e.stopPropagation();
    dragTargetRef.current = { kind: target };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePreviewPointerMove = (e) => {
    const dt = dragTargetRef.current;
    if (!dt || (dt.kind !== 'start' && dt.kind !== 'end') || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)));
    if (dt.kind === 'start') setStartPt({ x, y });
    else setEndPt({ x, y });
  };

  const handleBarPointerDown = (e, stopId) => {
    e.stopPropagation();
    setActiveId(stopId);
    dragTargetRef.current = { kind: 'stop', id: stopId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleBarPointerMove = (e) => {
    const dt = dragTargetRef.current;
    if (!dt || dt.kind !== 'stop' || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pos = Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
    setStops((prev) => prev.map((s) => (s.id === dt.id ? { ...s, pos } : s)));
  };

  const endDrag = () => {
    dragTargetRef.current = null;
  };

  const handleAddStop = () => {
    const idx = sortedStops.findIndex((s) => s.id === activeStop?.id);
    let newPos = 50;
    if (idx !== -1 && sortedStops.length >= 2) {
      const next = sortedStops[idx + 1] || sortedStops[idx - 1];
      newPos = Math.round((sortedStops[idx].pos + next.pos) / 2);
    }
    const newStop = {
      id: uid(),
      color: activeStop?.color || '#38bdf8',
      pos: newPos
    };
    setStops((prev) => [...prev, newStop]);
    setActiveId(newStop.id);
  };

  const handleRemoveStop = () => {
    if (stops.length <= 2) return;
    const remaining = stops.filter((s) => s.id !== activeId);
    setStops(remaining);
    setActiveId(remaining[0].id);
  };

  const handleNudgeStop = (delta) => {
    if (!activeStop) return;
    setStops((prev) =>
      prev.map((s) =>
        s.id === activeStop.id ? { ...s, pos: Math.max(0, Math.min(100, s.pos + delta)) } : s
      )
    );
  };

  const handleReverseStops = () => {
    setStops((prev) => prev.map((s) => ({ ...s, pos: 100 - s.pos })));
  };

  const openColorEditor = () => {
    if (!activeStop) return;
    setHexInput(activeStop.color || '#ffffff');
    setColorModalOpen(true);
  };

  const updateActiveStopColor = (hex) => {
    if (!activeStop) return;
    setHexInput(hex);
    setStops((prev) => prev.map((s) => (s.id === activeStop.id ? { ...s, color: hex } : s)));
  };

  const handleOpenEyedropper = async () => {
    const canvas = await sampleCurrentCanvas();
    if (!canvas) {
      alert('ক্যানভাস থেকে কালার পিক করা যায়নি');
      return;
    }
    setPickerSnap({
      url: canvas.toDataURL('image/png'),
      canvas
    });
  };

  const handlePickFromSnapshot = (e) => {
    if (!pickerSnap?.canvas) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rx = Math.max(0, Math.min(0.999, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(0.999, (e.clientY - rect.top) / rect.height));
    const cw = pickerSnap.canvas.width;
    const ch = pickerSnap.canvas.height;
    const [r, g, b] = pickerSnap.canvas
      .getContext('2d')
      .getImageData(Math.floor(rx * cw), Math.floor(ry * ch), 1, 1).data;
    const hex =
      '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    updateActiveStopColor(hex);
    setPickerSnap(null);
  };

  const midDots = [0.25, 0.5, 0.75];
  const lineAngleDeg = (Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x) * 180) / Math.PI;
  const userSolids = getUserSolids();
  const rampCss = `linear-gradient(90deg, ${sortedStops.map((s) => `${s.color} ${s.pos}%`).join(', ')})`;

  return (
    <div className="modal-backdrop" style={{ zIndex: 230, padding: 10 }} onClick={onCancel}>
      <div
        className="modal-card"
        style={{ maxWidth: 380, maxHeight: '94dvh', overflowY: 'auto', padding: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ১. উপরে ৬টি গ্রেডিয়েন্ট প্রিসেট বক্স */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 10 }}>
          {PRESET_DIRS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetClick(p)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: p.bg,
                border: activePreset === p.id ? '2px solid #38bdf8' : '1.5px solid rgba(255,255,255,0.28)',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>

        {/* ২. মাঝের ইন্টার‍্যাক্টিভ প্রিভিউ ও ২টি ড্র্যাগেবল হ্যান্ডেল */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div
            ref={previewRef}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              width: 240,
              height: 240,
              borderRadius: 10,
              background: computedGradient.css,
              border: '1.5px solid rgba(255,255,255,0.18)',
              position: 'relative',
              overflow: 'hidden',
              touchAction: 'none'
            }}
          >
            <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <line
                x1={startPt.x}
                y1={startPt.y}
                x2={endPt.x}
                y2={endPt.y}
                stroke="rgba(255,255,255,0.88)"
                strokeWidth="0.9"
              />
              {midDots.map((t) => {
                const mx = startPt.x + (endPt.x - startPt.x) * t;
                const my = startPt.y + (endPt.y - startPt.y) * t;
                return (
                  <g key={t} transform={`translate(${mx}, ${my}) rotate(${lineAngleDeg})`}>
                    <path
                      d="M -2 -2 L 1.5 0 L -2 2"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })}
            </svg>

            <div
              onPointerDown={(e) => handlePreviewPointerDown(e, 'start')}
              style={{
                position: 'absolute',
                left: `${startPt.x}%`,
                top: `${startPt.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.92)',
                border: '2px solid #0f172a',
                boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none'
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #0f172a' }} />
            </div>

            <div
              onPointerDown={(e) => handlePreviewPointerDown(e, 'end')}
              style={{
                position: 'absolute',
                left: `${endPt.x}%`,
                top: `${endPt.y}%`,
                transform: 'translate(-50%, -50%)',
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.92)',
                border: '2px solid #0284c7',
                boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'grab',
                touchAction: 'none'
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0284c7' }} />
            </div>
          </div>
        </div>

        {/* ৩. মাল্টি-স্টপ কালার স্লাইডার বার */}
        <div style={{ padding: '0 14px', marginBottom: 26 }}>
          <div
            ref={barRef}
            onPointerMove={handleBarPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: 'relative',
              height: 26,
              borderRadius: 6,
              background: rampCss,
              border: '1.5px solid rgba(255,255,255,0.35)',
              touchAction: 'none'
            }}
          >
            {stops.map((st) => {
              const isAct = st.id === activeStop?.id;
              return (
                <div
                  key={st.id}
                  onPointerDown={(e) => handleBarPointerDown(e, st.id)}
                  onDoubleClick={openColorEditor}
                  style={{
                    position: 'absolute',
                    left: `${st.pos}%`,
                    top: -2,
                    transform: 'translateX(-50%)',
                    width: 22,
                    height: 36,
                    cursor: 'ew-resize',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: isAct ? 5 : 2,
                    touchAction: 'none'
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 28,
                      borderRadius: 3,
                      background: st.color,
                      border: isAct ? '2.5px solid #f59e0b' : '2px solid #ffffff',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.7)'
                    }}
                  />
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: '7px solid transparent',
                      borderRight: '7px solid transparent',
                      borderTop: `7px solid ${isAct ? '#f59e0b' : '#ffffff'}`
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ৪. ৬টি নীল গোল বাটন (+, -, <, <>, >, PaintBucket) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
          {[
            { icon: <Plus size={16} />, onClick: handleAddStop, title: 'রঙ যোগ' },
            { icon: <Minus size={16} />, onClick: handleRemoveStop, title: 'বাদ দিন', disabled: stops.length <= 2 },
            { icon: <ChevronLeft size={16} />, onClick: () => handleNudgeStop(-4), title: 'বামে সরান' },
            { icon: <Code2 size={15} />, onClick: handleReverseStops, title: 'রঙ উল্টান' },
            { icon: <ChevronRight size={16} />, onClick: () => handleNudgeStop(4), title: 'ডানে সরান' },
            { icon: <PaintBucket size={15} />, onClick: openColorEditor, title: 'রঙ বদলান', highlight: true }
          ].map((btn, i) => (
            <button
              key={i}
              disabled={btn.disabled}
              title={btn.title}
              onClick={btn.onClick}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: btn.highlight ? '2px solid #fde047' : 'none',
                background: '#0ea5e9',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: btn.disabled ? 0.4 : 1,
                boxShadow: '0 3px 8px rgba(14,165,233,0.4)'
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>CANCEL</button>
          <button
            className="btn-primary"
            style={{ background: '#0284c7' }}
            onClick={() => onApply(computedGradient)}
          >
            OK
          </button>
        </div>
      </div>

      {/* স্টপ কালার এডিটর (কালার পিকার + হেক্স কোড + ক্যানভাস Eyedropper) */}
      {colorModalOpen && activeStop && (
        <div className="modal-backdrop" style={{ zIndex: 240 }} onClick={() => setColorModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>স্টপের রঙ সেট করুন</span>
              <button className="layer-close-btn" onClick={() => setColorModalOpen(false)}><X size={14} /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <input
                type="color"
                value={activeStop.color.startsWith('#') ? activeStop.color : '#ffffff'}
                onChange={(e) => updateActiveStopColor(e.target.value)}
                style={{ width: 42, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <input
                type="text"
                className="modal-textarea"
                style={{ margin: 0, padding: '7px 10px', fontSize: 13, fontFamily: 'monospace', flex: 1 }}
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setHexInput(v);
                  const norm = normalizeHex(v);
                  if (norm) updateActiveStopColor(norm);
                }}
                placeholder="#FF3B5C"
              />
              <button
                className="chip-btn active"
                style={{ padding: '7px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={handleOpenEyedropper}
                title="ক্যানভাস থেকে কালার পিক"
              >
                <Pipette size={14} /> পিক
              </button>
            </div>

            <div className="scroll-row" style={{ marginBottom: 12 }}>
              {[...userSolids, ...DEFAULT_SOLIDS].map((c, i) => (
                <button
                  key={`${c}-${i}`}
                  onClick={() => updateActiveStopColor(c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    border: activeStop.color.toLowerCase() === c.toLowerCase() ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                    flexShrink: 0,
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn-primary" style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setColorModalOpen(false)}>
                <Check size={14} /> ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ক্যানভাস Eyedropper ওভারলে */}
      {pickerSnap && (
        <div className="modal-backdrop" style={{ zIndex: 250 }} onClick={() => setPickerSnap(null)}>
          <div className="modal-card" style={{ textAlign: 'center', maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>ব্যাকগ্রাউন্ড বা শেপের ওপর ট্যাপ করে রঙ নিন</span>
              <button className="layer-close-btn" onClick={() => setPickerSnap(null)}><X size={14} /></button>
            </div>
            <img
              src={pickerSnap.url}
              alt="Canvas Sample"
              onClick={handlePickFromSnapshot}
              style={{
                maxWidth: '100%',
                maxHeight: '62dvh',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'crosshair',
                display: 'block',
                margin: '0 auto'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
