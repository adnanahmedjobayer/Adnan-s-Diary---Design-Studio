import React, { useEffect, useState } from 'react';
import { X, Type, Image as ImageIcon, Upload, Sparkles, Check, Stamp } from 'lucide-react';
import { getLibraryFonts } from '../../library/fonts/loadFonts';
import { getUserAssets } from '../../utils/userLibrary';
import StepperSlider from './StepperSlider';
import ColorPickerStrip from './ColorPickerStrip';

const POSITIONS = [
  { id: 'bottom-right', label: 'নিচে ডানে' },
  { id: 'bottom-center', label: 'নিচে মাঝে' },
  { id: 'bottom-left', label: 'নিচে বামে' },
  { id: 'center', label: 'মাঝখানে' },
  { id: 'top-right', label: 'উপরে ডানে' },
  { id: 'top-left', label: 'উপরে বামে' },
  { id: 'tile', label: 'Tiled (সবখানে)' }
];

export default function WatermarkModal({
  config,
  onClose,
  onSave,
  onCaptureCanvasDesign
}) {
  const [draft, setDraft] = useState(() => ({ ...config }));
  const [fonts, setFonts] = useState(() => getLibraryFonts().map((f) => f.name));
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let active = true;
    const libNames = getLibraryFonts().map((f) => f.name);
    getUserAssets('fonts').then((uFonts) => {
      if (!active) return;
      const merged = Array.from(new Set([...libNames, ...uFonts.map((f) => f.name)]));
      setFonts(merged);
    });
    return () => { active = false; };
  }, []);

  const patch = (obj) => setDraft((prev) => ({ ...prev, ...obj }));

  const handleUploadLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      patch({ mode: 'image', imageSrc: reader.result, enabled: true });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFromCanvas = async () => {
    if (!onCaptureCanvasDesign || capturing) return;
    setCapturing(true);
    try {
      const pngUrl = await onCaptureCanvasDesign();
      if (!pngUrl) {
        alert('ক্যানভাসে কোনো দৃশ্যমান ডিজাইন পাওয়া যায়নি!');
        return;
      }
      patch({ mode: 'image', imageSrc: pngUrl, enabled: true });
    } catch {
      alert('ক্যানভাস থেকে ওয়াটারমার্ক তৈরি করা যায়নি');
    } finally {
      setCapturing(false);
    }
  };

  const handleSaveClick = () => {
    if (draft.enabled) {
      if (draft.mode === 'text' && !(draft.text || '').trim()) {
        alert('অনুগ্রহ করে ওয়াটারমার্কের টেক্সট লিখুন');
        return;
      }
      if (draft.mode === 'image' && !draft.imageSrc) {
        alert('অনুগ্রহ করে একটি লোগো আপলোড করুন অথবা ক্যানভাস থেকে তৈরি করুন');
        return;
      }
    }
    onSave(draft);
  };

  const prevW = 210;
  const posStyle = (() => {
    const m = `${draft.margin ?? 4}%`;
    const p = draft.position || 'bottom-right';
    const base = {
      position: 'absolute',
      opacity: (draft.opacity ?? 45) / 100,
      pointerEvents: 'none',
      maxWidth: '90%'
    };
    if (p === 'top-left') return { ...base, top: m, left: m, textAlign: 'left' };
    if (p === 'top-center') return { ...base, top: m, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' };
    if (p === 'top-right') return { ...base, top: m, right: m, textAlign: 'right' };
    if (p === 'center') return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' };
    if (p === 'bottom-left') return { ...base, bottom: m, left: m, textAlign: 'left' };
    if (p === 'bottom-center') return { ...base, bottom: m, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' };
    return { ...base, bottom: m, right: m, textAlign: 'right' };
  })();

  const prevFontSize = Math.max(7, prevW * ((draft.size ?? 22) / 100) * 0.25);

  return (
    <div className="modal-backdrop" style={{ zIndex: 200, padding: 12 }} onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 400, maxHeight: '92dvh', overflowY: 'auto', padding: 14 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stamp size={16} color="#38bdf8" /> গ্লোবাল ওয়াটারমার্ক
          </span>
          <button className="layer-close-btn" onClick={onClose}><X size={15} /></button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            padding: '8px 10px',
            marginBottom: 10
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
            সব প্রজেক্টে অটো-অ্যাপ্লাই
          </span>
          <button
            className={`px-toggle-pill ${draft.enabled ? 'on' : ''}`}
            onClick={() => patch({ enabled: !draft.enabled })}
          >
            {draft.enabled ? 'চালু আছে' : 'বন্ধ আছে'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div
            style={{
              width: prevW,
              height: 112,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontWeight: 700 }}>PREVIEW</span>

            {draft.enabled && (
              draft.position === 'tile' ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(3, 1fr)',
                    alignItems: 'center',
                    justifyItems: 'center',
                    opacity: (draft.opacity ?? 45) / 100,
                    pointerEvents: 'none'
                  }}
                >
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={idx} style={{ transform: 'rotate(-26deg)' }}>
                      {draft.mode === 'image' && draft.imageSrc ? (
                        <img
                          src={draft.imageSrc}
                          alt=""
                          style={{ width: prevW * ((draft.size ?? 22) / 100) * 0.72, height: 'auto', display: 'block' }}
                        />
                      ) : (
                        <span
                          style={{
                            fontFamily: `'${draft.font}', sans-serif`,
                            fontSize: prevFontSize * 0.85,
                            fontWeight: 700,
                            color: draft.color || '#ffffff',
                            whiteSpace: 'nowrap',
                            textShadow: '0 1px 3px rgba(0,0,0,0.45)'
                          }}
                        >
                          {draft.text}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : draft.mode === 'image' && draft.imageSrc ? (
                <img
                  src={draft.imageSrc}
                  alt=""
                  style={{
                    ...posStyle,
                    width: `${draft.size ?? 22}%`,
                    height: 'auto',
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))'
                  }}
                />
              ) : (
                <span
                  style={{
                    ...posStyle,
                    fontFamily: `'${draft.font}', sans-serif`,
                    fontSize: prevFontSize,
                    fontWeight: 700,
                    color: draft.color || '#ffffff',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)'
                  }}
                >
                  {draft.text}
                </span>
              )
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            className={`px-toggle-pill ${draft.mode === 'text' ? 'on' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => patch({ mode: 'text', enabled: true })}
          >
            <Type size={13} /> টেক্সট
          </button>
          <button
            className={`px-toggle-pill ${draft.mode === 'image' ? 'on' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => patch({ mode: 'image', enabled: true })}
          >
            <ImageIcon size={13} /> লোগো / ডিজাইন
          </button>
        </div>

        {draft.mode === 'text' ? (
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              className="modal-textarea"
              style={{ marginTop: 0, marginBottom: 8, padding: '8px 10px', fontSize: 13 }}
              value={draft.text || ''}
              onChange={(e) => patch({ text: e.target.value, enabled: true })}
              placeholder="ওয়াটারমার্ক টেক্সট লিখুন..."
            />

            <div className="scroll-row" style={{ marginBottom: 6 }}>
              <button
                className={`chip-btn ${draft.font === 'sans-serif' ? 'active' : ''}`}
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => patch({ font: 'sans-serif' })}
              >
                Default
              </button>
              {fonts.map((fn) => (
                <button
                  key={fn}
                  className={`chip-btn ${draft.font === fn ? 'active' : ''}`}
                  style={{ fontFamily: `'${fn}', sans-serif`, padding: '4px 10px', fontSize: 11 }}
                  onClick={() => patch({ font: fn })}
                >
                  {fn}
                </button>
              ))}
            </div>

            <ColorPickerStrip
              allowGradient={false}
              solidValue={draft.color || '#ffffff'}
              onSelectSolid={(hex) => patch({ color: hex })}
            />
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <label
                className="chip-btn active"
                style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
              >
                <Upload size={13} /> গ্যালারি লোগো
                <input type="file" accept="image/*" hidden onChange={handleUploadLogo} />
              </label>

              <button
                className="chip-btn"
                style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, borderColor: '#38bdf8', color: '#38bdf8' }}
                disabled={capturing}
                onClick={handleFromCanvas}
              >
                <Sparkles size={13} /> {capturing ? 'তৈরি হচ্ছে...' : 'ক্যানভাস থেকে'}
              </button>
            </div>

            {draft.imageSrc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#0f172a', padding: 6, borderRadius: 10 }}>
                <div className="canvas-transparent-bg" style={{ padding: 4, borderRadius: 6 }}>
                  <img src={draft.imageSrc} alt="Logo" style={{ width: 38, height: 38, objectFit: 'contain', display: 'block' }} />
                </div>
                <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>লোগো সেট করা হয়েছে</span>
                <button
                  className="chip-btn"
                  style={{ padding: '3px 8px', fontSize: 10, color: '#fda4af' }}
                  onClick={() => patch({ imageSrc: null })}
                >
                  মুছুন
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>অবস্থান (Position)</div>
        <div className="scroll-row" style={{ marginBottom: 6 }}>
          {POSITIONS.map((p) => (
            <button
              key={p.id}
              className={`chip-btn ${draft.position === p.id ? 'active' : ''}`}
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => patch({ position: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>

        <StepperSlider
          label="সাইজ"
          value={draft.size ?? 22}
          min={8}
          max={60}
          unit="%"
          onChange={(v) => patch({ size: v })}
        />
        <StepperSlider
          label="স্বচ্ছতা"
          value={draft.opacity ?? 45}
          min={10}
          max={100}
          unit="%"
          onChange={(v) => patch({ opacity: v })}
        />
        {draft.position !== 'tile' && (
          <StepperSlider
            label="কিনারা থেকে"
            value={draft.margin ?? 4}
            min={1}
            max={15}
            unit="%"
            onChange={(v) => patch({ margin: v })}
          />
        )}

        <div className="modal-actions" style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={onClose}>বাতিল</button>
          <button
            className="btn-primary"
            style={{ background: '#0284c7', display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={handleSaveClick}
          >
            <Check size={14} /> সেভ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
