import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  FlipHorizontal, FlipVertical, Pipette, X
} from 'lucide-react';
import { DEFAULT_MOOD_FILTER, MOOD_FILTERS } from '../../utils/moodFilters';
import StepperSlider from './StepperSlider';
import ColorPickerStrip from './ColorPickerStrip';

function hexToRgb(hex = '#ffffff') {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, 'f');
  const num = parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0'))
      .join('')
  );
}

async function processEraseColor(sourceSrc, targetHex, tolerance, smooth) {
  const img = new Image();
  if (sourceSrc && !sourceSrc.startsWith('data:') && !sourceSrc.startsWith('blob:')) {
    img.crossOrigin = 'anonymous';
  }
  img.src = sourceSrc;
  await img.decode();

  const nw = img.naturalWidth || 1;
  const nh = img.naturalHeight || 1;
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * scale));
  const h = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const { r: tr, g: tg, b: tb } = hexToRgb(targetHex);
  const thresh = tolerance <= 0 ? 2 : tolerance * 3.2;
  const feather = smooth * 2.5;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= thresh) {
      data[i + 3] = 0;
    } else if (feather > 0 && dist < thresh + feather) {
      const factor = (dist - thresh) / feather;
      data[i + 3] = Math.round(a * factor);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export default function ShapeToolsEditor({ tool, layer, updateLayer }) {
  const [step, setStep] = useState(2);
  const patch = (obj) => updateLayer(layer.id, obj);

  const [ecColor, setEcColor] = useState(layer.eraseColor || '#ffffff');
  const [ecTol, setEcTol] = useState(layer.eraseTolerance ?? 28);
  const [ecSmooth, setEcSmooth] = useState(layer.eraseSmooth ?? 6);
  const [pickModal, setPickModal] = useState(false);
  const [ecBusy, setEcBusy] = useState(false);
  const ecTimerRef = useRef(null);
  const ecSeqRef = useRef(0);

  useEffect(() => {
    setEcColor(layer.eraseColor || '#ffffff');
    setEcTol(layer.eraseTolerance ?? 28);
    setEcSmooth(layer.eraseSmooth ?? 6);
  }, [layer.id, layer.eraseColor, layer.eraseTolerance, layer.eraseSmooth]);

  useEffect(() => () => clearTimeout(ecTimerRef.current), []);

  const runErase = async (enabled, col, tol, sm) => {
    const baseSrc = layer.rawSrc || layer.src;
    if (!baseSrc) return;

    if (!enabled) {
      patch({
        eraseColorEnabled: false,
        src: baseSrc
      });
      return;
    }

    const seq = ++ecSeqRef.current;
    setEcBusy(true);
    try {
      const outUrl = await processEraseColor(baseSrc, col, tol, sm);
      if (seq !== ecSeqRef.current) return;
      patch({
        rawSrc: baseSrc,
        eraseColorEnabled: true,
        eraseColor: col,
        eraseTolerance: tol,
        eraseSmooth: sm,
        src: outUrl
      });
    } catch {
      alert('ছবিটি প্রসেস করা যায়নি');
    } finally {
      if (seq === ecSeqRef.current) setEcBusy(false);
    }
  };

  const scheduleErase = (col, tol, sm) => {
    clearTimeout(ecTimerRef.current);
    ecTimerRef.current = setTimeout(() => {
      runErase(true, col, tol, sm);
    }, 85);
  };

  const handlePickPixelFromImage = async (e) => {
    const imgEl = e.currentTarget;
    const rect = imgEl.getBoundingClientRect();
    const rx = Math.max(0, Math.min(0.999, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(0.999, (e.clientY - rect.top) / rect.height));

    try {
      const tmp = document.createElement('canvas');
      const nw = imgEl.naturalWidth || 1;
      const nh = imgEl.naturalHeight || 1;
      tmp.width = nw;
      tmp.height = nh;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(imgEl, 0, 0, nw, nh);
      const px = Math.floor(rx * nw);
      const py = Math.floor(ry * nh);
      const [r, g, b, a] = ctx.getImageData(px, py, 1, 1).data;
      if (a < 10) return;
      const pickedHex = rgbToHex(r, g, b);
      setEcColor(pickedHex);
      setPickModal(false);
      runErase(true, pickedHex, ecTol, ecSmooth);
    } catch {
      setPickModal(false);
    }
  };

  if (tool === 'mood') {
    const mood = layer.moodFilter || DEFAULT_MOOD_FILTER;
    const updateMood = (obj) =>
      patch({ moodFilter: { ...DEFAULT_MOOD_FILTER, ...mood, ...obj } });

    return (
      <div className="px-editor-body">
        <div className="scroll-row" style={{ marginBottom: 6 }}>
          {MOOD_FILTERS.map((m) => {
            const selected = (mood.id || 'none') === m.id;
            return (
              <div
                key={m.id}
                className="theme-card"
                style={{
                  minWidth: 66,
                  width: 66,
                  height: 52,
                  background: m.previewBg,
                  borderColor: selected ? '#38bdf8' : 'rgba(255,255,255,0.16)'
                }}
                onClick={() => updateMood({ id: m.id })}
              >
                <span style={{ fontSize: 9 }}>{m.label}</span>
              </div>
            );
          })}
        </div>

        {mood.id && mood.id !== 'none' && (
          <StepperSlider
            label="তীব্রতা"
            value={mood.intensity ?? 80}
            min={10}
            max={100}
            unit="%"
            onChange={(v) => updateMood({ intensity: v })}
          />
        )}
      </div>
    );
  }

  if (tool === 'erase-color') {
    if (layer.type === 'shape') {
      return (
        <div className="px-editor-body" style={{ fontSize: 11, color: '#94a3b8', padding: '8px 2px' }}>
          এটি শুধু গ্যালারি থেকে আনা ছবি বা স্টিকারের ব্যাকগ্রাউন্ড মুছতে কাজ করে।
        </div>
      );
    }

    const enabled = Boolean(layer.eraseColorEnabled);
    const origPreview = layer.rawSrc || layer.src;

    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <button
              className={`px-toggle-pill ${enabled ? 'on' : ''}`}
              onClick={() => runErase(!enabled, ecColor, ecTol, ecSmooth)}
            >
              {enabled ? 'চালু' : 'বন্ধ'}
            </button>

            <button
              className="chip-btn"
              style={{ padding: '4px 8px', fontSize: 11, background: '#ffffff', color: '#0f172a', fontWeight: 700 }}
              onClick={() => { setEcColor('#ffffff'); runErase(true, '#ffffff', ecTol, ecSmooth); }}
            >
              সাদা
            </button>
            <button
              className="chip-btn"
              style={{ padding: '4px 8px', fontSize: 11, background: '#0f172a', color: '#f8fafc' }}
              onClick={() => { setEcColor('#000000'); runErase(true, '#000000', ecTol, ecSmooth); }}
            >
              কালো
            </button>

            <input
              type="color"
              value={ecColor}
              onChange={(e) => {
                const c = e.target.value;
                setEcColor(c);
                scheduleErase(c, ecTol, ecSmooth);
              }}
              style={{ width: 26, height: 24, border: 'none', background: 'transparent', cursor: 'pointer' }}
              title="রঙ বেছে নিন"
            />
          </div>

          <button
            className="chip-btn"
            style={{ padding: '4px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setPickModal(true)}
          >
            <Pipette size={12} /> ছবি থেকে
          </button>
        </div>

        <StepperSlider
          label={ecBusy ? 'প্রসেস...' : 'টলারেন্স'}
          value={ecTol}
          min={0}
          max={80}
          onChange={(v) => {
            setEcTol(v);
            if (enabled) scheduleErase(ecColor, v, ecSmooth);
          }}
        />

        <StepperSlider
          label="স্মুথ এজ"
          value={ecSmooth}
          min={0}
          max={20}
          onChange={(v) => {
            setEcSmooth(v);
            if (enabled) scheduleErase(ecColor, ecTol, v);
          }}
        />

        {pickModal && (
          <div className="modal-backdrop" onClick={() => setPickModal(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>যে রঙ মুছতে চান তার ওপর ট্যাপ করুন</span>
                <button className="layer-close-btn" onClick={() => setPickModal(false)}><X size={14} /></button>
              </div>
              <div className="canvas-transparent-bg" style={{ borderRadius: 12, padding: 8, display: 'inline-block' }}>
                <img
                  src={origPreview}
                  alt="Pick Color"
                  crossOrigin={!origPreview?.startsWith('data:') && !origPreview?.startsWith('blob:') ? 'anonymous' : undefined}
                  onClick={handlePickPixelFromImage}
                  style={{ maxWidth: 260, maxHeight: 260, display: 'block', cursor: 'crosshair', borderRadius: 6 }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (tool === 'position') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className="chip-btn" onClick={() => patch({ x: Math.max(2, layer.x - step) })}><ArrowLeft size={14} /></button>
          <button className="chip-btn" onClick={() => patch({ y: Math.max(2, layer.y - step) })}><ArrowUp size={14} /></button>
          <button className="chip-btn" onClick={() => patch({ y: Math.min(98, layer.y + step) })}><ArrowDown size={14} /></button>
          <button className="chip-btn" onClick={() => patch({ x: Math.min(98, layer.x + step) })}><ArrowRight size={14} /></button>
        </div>
        <StepperSlider label="মুভ স্পিড" value={step} min={1} max={10} onChange={setStep} />
      </div>
    );
  }

  if (tool === 'rel-pos') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid">
          <button className="chip-btn" onClick={() => patch({ x: 18 })}>বামে</button>
          <button className="chip-btn" onClick={() => patch({ x: 50 })}>মাঝে (X)</button>
          <button className="chip-btn" onClick={() => patch({ x: 82 })}>ডানে</button>
          <button className="chip-btn" onClick={() => patch({ y: 15 })}>উপরে</button>
          <button className="chip-btn" onClick={() => patch({ y: 50 })}>মাঝে (Y)</button>
          <button className="chip-btn" onClick={() => patch({ y: 85 })}>নিচে</button>
        </div>
      </div>
    );
  }

  if (tool === 'size') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="প্রস্থ (W)" value={Math.round(layer.width || 110)} min={20} max={320} unit="px" onChange={(v) => patch({ width: v })} />
        {layer.type === 'shape' && (
          <StepperSlider label="উচ্চতা (H)" value={Math.round(layer.height || layer.width || 110)} min={20} max={320} unit="px" onChange={(v) => patch({ height: v })} />
        )}
      </div>
    );
  }

  if (tool === 'color') {
    if (layer.type !== 'shape') {
      return (
        <div className="px-editor-body" style={{ fontSize: 11, color: '#94a3b8' }}>
          ছবি/স্টিকারের রঙ বদলাতে "হিউ" বা "স্যাচুরেশন" টুল ব্যবহার করুন।
        </div>
      );
    }
    const isGrad =
      typeof layer.color === 'string' &&
      (layer.color.includes('linear-gradient') || layer.color.includes('radial-gradient'));
    return (
      <div className="px-editor-body">
        <ColorPickerStrip
          allowGradient={true}
          colorMode={isGrad ? 'gradient' : 'solid'}
          solidValue={!isGrad ? layer.color || '#fda4af' : '#fda4af'}
          gradientCss={isGrad ? layer.color : ''}
          onSelectSolid={(hex) => patch({ color: hex })}
          onSelectGradient={(g) => patch({ color: g.css })}
        />
      </div>
    );
  }

  if (tool === 'opacity') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="অপাসিটি" value={Math.round((layer.opacity ?? 0.85) * 100)} min={5} max={100} unit="%" onChange={(v) => patch({ opacity: v / 100 })} />
      </div>
    );
  }

  if (tool === 'rotate') {
    return (
      <div className="px-editor-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="রোটেট" value={layer.rotation ?? 0} min={-180} max={180} unit="°" onChange={(v) => patch({ rotation: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 11, marginTop: 6 }} onClick={() => patch({ rotation: 0 })}>0°</button>
        </div>
      </div>
    );
  }

  if (tool === 'flip') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid">
          <button className={`px-toggle-pill ${layer.flipH ? 'on' : ''}`} onClick={() => patch({ flipH: !layer.flipH })}>
            <FlipHorizontal size={14} /> ডান-বাম
          </button>
          <button className={`px-toggle-pill ${layer.flipV ? 'on' : ''}`} onClick={() => patch({ flipV: !layer.flipV })}>
            <FlipVertical size={14} /> উপর-নিচ
          </button>
        </div>
      </div>
    );
  }

  if (tool === 'radius') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="রাউন্ড" value={layer.borderRadius ?? 0} min={0} max={100} unit="px" onChange={(v) => patch({ borderRadius: v })} />
      </div>
    );
  }

  if (tool === 'stroke') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.strokeEnabled ? 'on' : ''}`} onClick={() => patch({ strokeEnabled: !layer.strokeEnabled, strokeColor: layer.strokeColor || '#ffffff' })}>
            {layer.strokeEnabled ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.strokeEnabled && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.strokeColor || '#ffffff'}
              onSelectSolid={(hex) => patch({ strokeColor: hex })}
            />
            <StepperSlider label="উইডথ" value={layer.strokeWidth ?? 2} min={1} max={15} unit="px" onChange={(v) => patch({ strokeWidth: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'shadow') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.shadow ? 'on' : ''}`} onClick={() => patch({ shadow: !layer.shadow })}>
            {layer.shadow ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.shadow && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.shadowColor || '#000000'}
              onSelectSolid={(hex) => patch({ shadowColor: hex })}
            />
            <StepperSlider label="ব্লার" value={layer.shadowBlur ?? 8} min={0} max={30} onChange={(v) => patch({ shadowBlur: v })} />
            <StepperSlider label="Offset X" value={layer.shadowX ?? 0} min={-20} max={20} onChange={(v) => patch({ shadowX: v })} />
            <StepperSlider label="Offset Y" value={layer.shadowY ?? 4} min={-20} max={20} onChange={(v) => patch({ shadowY: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'emboss') {
    return (
      <div className="px-editor-body">
        <button className={`px-toggle-pill ${layer.embossEnabled ? 'on' : ''}`} onClick={() => patch({ embossEnabled: !layer.embossEnabled })}>
          {layer.embossEnabled ? 'এমবোস চালু' : 'এমবোস বন্ধ'}
        </button>
      </div>
    );
  }

  if (tool === 'brightness') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="ব্রাইটনেস" value={layer.brightness ?? 100} min={30} max={180} unit="%" onChange={(v) => patch({ brightness: v })} />
        <StepperSlider label="কনট্রাস্ট" value={layer.contrast ?? 100} min={40} max={180} unit="%" onChange={(v) => patch({ contrast: v })} />
      </div>
    );
  }

  if (tool === 'blur') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="ব্লার" value={layer.blur ?? 0} min={0} max={20} unit="px" onChange={(v) => patch({ blur: v })} />
      </div>
    );
  }

  if (tool === 'saturate') {
    return (
      <div className="px-editor-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="স্যাচুরেশন" value={layer.saturate ?? 100} min={0} max={200} unit="%" onChange={(v) => patch({ saturate: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 10, marginTop: 6 }} onClick={() => patch({ saturate: 100 })}>100%</button>
        </div>
      </div>
    );
  }

  if (tool === 'hue') {
    return (
      <div className="px-editor-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="হিউ" value={layer.hueRotate ?? 0} min={-180} max={180} unit="°" onChange={(v) => patch({ hueRotate: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 10, marginTop: 6 }} onClick={() => patch({ hueRotate: 0 })}>0°</button>
        </div>
      </div>
    );
  }

  if (tool === 'perspective') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="Skew X" value={layer.skewX ?? 0} min={-45} max={45} unit="°" onChange={(v) => patch({ skewX: v })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="Skew Y" value={layer.skewY ?? 0} min={-45} max={45} unit="°" onChange={(v) => patch({ skewY: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 10, marginTop: 6 }} onClick={() => patch({ skewX: 0, skewY: 0 })}>0</button>
        </div>
      </div>
    );
  }

  if (tool === 'rotate3d') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="3D X" value={layer.rotateX ?? 0} min={-65} max={65} unit="°" onChange={(v) => patch({ rotateX: v })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="3D Y" value={layer.rotateY ?? 0} min={-65} max={65} unit="°" onChange={(v) => patch({ rotateY: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 10, marginTop: 6 }} onClick={() => patch({ rotateX: 0, rotateY: 0 })}>0</button>
        </div>
      </div>
    );
  }

  if (tool === 'text3d') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.text3dEnabled ? 'on' : ''}`} onClick={() => patch({ text3dEnabled: !layer.text3dEnabled, color3d: layer.color3d || '#334155' })}>
            {layer.text3dEnabled ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.text3dEnabled && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.color3d || '#334155'}
              onSelectSolid={(hex) => patch({ color3d: hex })}
            />
            <StepperSlider label="গভীরতা" value={layer.depth3d ?? 5} min={1} max={15} onChange={(v) => patch({ depth3d: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'shadow3d') {
    return (
      <div className="px-editor-body">
        <button className={`px-toggle-pill ${layer.shadow3dEnabled ? 'on' : ''}`} onClick={() => patch({ shadow3dEnabled: !layer.shadow3dEnabled })}>
          {layer.shadow3dEnabled ? 'চালু' : 'বন্ধ'}
        </button>
        {layer.shadow3dEnabled && (
          <>
            <StepperSlider label="দূরত্ব" value={layer.shadow3dY ?? 16} min={5} max={45} onChange={(v) => patch({ shadow3dY: v })} />
            <StepperSlider label="অপাসিটি" value={layer.shadow3dOpacity ?? 50} min={10} max={95} unit="%" onChange={(v) => patch({ shadow3dOpacity: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'reflection') {
    return (
      <div className="px-editor-body">
        <button className={`px-toggle-pill ${layer.reflectionEnabled ? 'on' : ''}`} onClick={() => patch({ reflectionEnabled: !layer.reflectionEnabled })}>
          {layer.reflectionEnabled ? 'চালু' : 'বন্ধ'}
        </button>
        {layer.reflectionEnabled && (
          <>
            <StepperSlider label="দূরত্ব" value={layer.reflectionOffset ?? 4} min={-10} max={30} onChange={(v) => patch({ reflectionOffset: v })} />
            <StepperSlider label="অপাসিটি" value={layer.reflectionOpacity ?? 40} min={10} max={90} unit="%" onChange={(v) => patch({ reflectionOpacity: v })} />
          </>
        )}
      </div>
    );
  }

  return null;
}
