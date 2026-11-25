import React, { useEffect, useState } from 'react';
import { Plus, X, Check, Pipette } from 'lucide-react';
import {
  DEFAULT_SOLIDS,
  DEFAULT_GRADIENTS,
  getUserSolids,
  saveUserSolid,
  deleteUserSolid,
  getUserGradients,
  saveUserGradient,
  deleteUserGradient,
  gradientToCss,
  normalizeHex,
  sampleCurrentCanvas,
  subscribePalette
} from '../../utils/colorPalette';
import GradientEditorModal from './GradientEditorModal';

export default function ColorPickerStrip({
  allowGradient = false,
  colorMode = 'solid',
  solidValue = '#f8fafc',
  gradientCss = '',
  onSelectSolid,
  onSelectGradient,
  onModeChange
}) {
  const [tab, setTab] = useState(colorMode === 'gradient' && allowGradient ? 'gradient' : 'solid');
  const [userSolids, setUserSolids] = useState(() => getUserSolids());
  const [userGrads, setUserGrads] = useState(() => getUserGradients());

  const [makingSolid, setMakingSolid] = useState(false);
  const [draftSolid, setDraftSolid] = useState(solidValue || '#38bdf8');
  const [hexInput, setHexInput] = useState(solidValue || '#38bdf8');
  const [pickerSnap, setPickerSnap] = useState(null);

  const [gradModalOpen, setGradModalOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUserSolids(getUserSolids());
      setUserGrads(getUserGradients());
    };
    return subscribePalette(sync);
  }, []);

  useEffect(() => {
    if (allowGradient) {
      setTab(colorMode === 'gradient' ? 'gradient' : 'solid');
    } else {
      setTab('solid');
    }
  }, [colorMode, allowGradient]);

  const switchTab = (nextTab) => {
    setTab(nextTab);
    setMakingSolid(false);
    onModeChange?.(nextTab);
  };

  const handleSaveCustomSolid = () => {
    const valid = normalizeHex(hexInput) || draftSolid;
    saveUserSolid(valid);
    onSelectSolid?.(valid);
    setMakingSolid(false);
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
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    setDraftSolid(hex);
    setHexInput(hex);
    onSelectSolid?.(hex);
    setPickerSnap(null);
  };

  const handleApplyGradientModal = (gradObj) => {
    const saved = saveUserGradient(gradObj);
    const css = gradObj.css || saved.css || gradientToCss(saved);
    onSelectGradient?.({
      ...saved,
      color1: gradObj.stops?.[0]?.color || '#fda4af',
      color2: gradObj.stops?.[gradObj.stops.length - 1]?.color || '#38bdf8',
      css
    });
    setGradModalOpen(false);
  };

  return (
    <div>
      {allowGradient && (
        <div className="px-mini-grid" style={{ marginBottom: 6 }}>
          <button
            className={`px-toggle-pill ${tab === 'solid' ? 'on' : ''}`}
            onClick={() => switchTab('solid')}
          >
            সলিড
          </button>
          <button
            className={`px-toggle-pill ${tab === 'gradient' ? 'on' : ''}`}
            onClick={() => switchTab('gradient')}
          >
            গ্রেডিয়েন্ট
          </button>
        </div>
      )}

      {tab === 'solid' ? (
        <>
          {makingSolid && (
            <div
              className="px-mini-grid"
              style={{
                marginBottom: 6,
                background: 'rgba(255,255,255,0.05)',
                padding: '5px 8px',
                borderRadius: 10
              }}
            >
              <input
                type="color"
                value={draftSolid.startsWith('#') ? draftSolid : '#38bdf8'}
                onChange={(e) => {
                  setDraftSolid(e.target.value);
                  setHexInput(e.target.value);
                  onSelectSolid?.(e.target.value);
                }}
                style={{ width: 28, height: 26, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value;
                  setHexInput(v);
                  const norm = normalizeHex(v);
                  if (norm) {
                    setDraftSolid(norm);
                    onSelectSolid?.(norm);
                  }
                }}
                placeholder="#FF3B5C"
                style={{
                  width: 74,
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: 8,
                  padding: '4px 6px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
              <button
                className="chip-btn"
                style={{ padding: '4px 7px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, borderColor: '#38bdf8', color: '#38bdf8' }}
                onClick={handleOpenEyedropper}
                title="ক্যানভাস থেকে কালার পিক"
              >
                <Pipette size={12} /> পিক
              </button>
              <button
                className="chip-btn active"
                style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}
                onClick={handleSaveCustomSolid}
              >
                <Check size={12} /> সেভ
              </button>
              <button
                className="chip-btn"
                style={{ padding: '4px 6px', fontSize: 11 }}
                onClick={() => setMakingSolid(false)}
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="scroll-row" style={{ paddingTop: 6 }}>
            <button
              className="chip-btn"
              style={{
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: '50%',
                borderColor: '#38bdf8',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="নতুন কালার / হেক্স / পিক"
              onClick={() => {
                const startVal = solidValue && solidValue.startsWith('#') ? solidValue : '#38bdf8';
                setDraftSolid(startVal);
                setHexInput(startVal);
                setMakingSolid((m) => !m);
              }}
            >
              <Plus size={14} />
            </button>

            {userSolids.map((c) => (
              <div key={`us-${c}`} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => onSelectSolid?.(c)}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: c,
                    border:
                      solidValue?.toLowerCase() === c.toLowerCase()
                        ? '2px solid #fff'
                        : '1px solid rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    display: 'block'
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteUserSolid(c);
                  }}
                  title="মুছুন"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background: '#e11d48',
                    color: '#fff',
                    border: '1px solid #0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    cursor: 'pointer'
                  }}
                >
                  <X size={8} />
                </button>
              </div>
            ))}

            {DEFAULT_SOLIDS.map((c) => (
              <button
                key={`ds-${c}`}
                onClick={() => onSelectSolid?.(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: c,
                  border:
                    solidValue?.toLowerCase() === c.toLowerCase()
                      ? '2px solid #fff'
                      : '1px solid rgba(255,255,255,0.22)',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="scroll-row" style={{ paddingTop: 6 }}>
          <button
            className="chip-btn"
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: '50%',
              borderColor: '#38bdf8',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="অ্যাডভান্সড গ্রেডিয়েন্ট এডিটর"
            onClick={() => setGradModalOpen(true)}
          >
            <Plus size={14} />
          </button>

          {userGrads.map((g) => {
            const css = g.css || gradientToCss(g);
            return (
              <div key={g.id} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() =>
                    onSelectGradient?.({
                      ...g,
                      color1: g.stops?.[0]?.color || '#fda4af',
                      color2: g.stops?.[g.stops.length - 1]?.color || '#38bdf8',
                      css
                    })
                  }
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: css,
                    border:
                      gradientCss === css
                        ? '2px solid #fff'
                        : '1px solid rgba(255,255,255,0.28)',
                    cursor: 'pointer',
                    display: 'block'
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteUserGradient(g.id);
                  }}
                  title="মুছুন"
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    background: '#e11d48',
                    color: '#fff',
                    border: '1px solid #0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    cursor: 'pointer'
                  }}
                >
                  <X size={8} />
                </button>
              </div>
            );
          })}

          {DEFAULT_GRADIENTS.map((g) => {
            const css = gradientToCss(g);
            return (
              <button
                key={g.id}
                title={g.label}
                onClick={() =>
                  onSelectGradient?.({
                    ...g,
                    color1: g.stops[0].color,
                    color2: g.stops[g.stops.length - 1].color,
                    css
                  })
                }
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: css,
                  border:
                    gradientCss === css
                      ? '2px solid #fff'
                      : '1px solid rgba(255,255,255,0.25)',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
              />
            );
          })}
        </div>
      )}

      {gradModalOpen && (
        <GradientEditorModal
          initialGradient={gradientCss}
          onCancel={() => setGradModalOpen(false)}
          onApply={handleApplyGradientModal}
        />
      )}

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
