import React, { useEffect, useState } from 'react';
import {
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Bold, Italic, Underline, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Upload, Trash2, X
} from 'lucide-react';
import { getLibraryFonts } from '../../library/fonts/loadFonts';
import { deleteUserAsset, getUserAssets, saveUserFont } from '../../utils/userLibrary';
import StepperSlider from './StepperSlider';
import ColorPickerStrip from './ColorPickerStrip';

export default function TextBasicTools({ tool, layer, updateLayer, onRequestDelete }) {
  const [step, setStep] = useState(2);
  const [fontTab, setFontTab] = useState('default');
  const [userFonts, setUserFonts] = useState([]);
  const defaultFonts = getLibraryFonts();

  useEffect(() => {
    if (tool === 'font') {
      getUserAssets('fonts').then(setUserFonts);
    }
  }, [tool]);

  const patch = (obj) => updateLayer(layer.id, obj);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="সাইজ" value={layer.fontSize} min={10} max={90} unit="px" onChange={(v) => patch({ fontSize: v })} />
          </div>
          {layer.width && (
            <button
              className="chip-btn"
              style={{ padding: '4px 8px', fontSize: 10, marginTop: 6, borderColor: '#38bdf8', color: '#38bdf8' }}
              onClick={() => patch({ width: null })}
              title="বক্সের প্রস্থ লেখার সাথে অটো-ফিট করুন"
            >
              অটো-ফিট
            </button>
          )}
        </div>
      </div>
    );
  }

  if (tool === 'padding') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="ডানে-বামে" value={layer.paddingX ?? 0} min={0} max={40} unit="px" onChange={(v) => patch({ paddingX: v })} />
        <StepperSlider label="উপরে-নিচে" value={layer.paddingY ?? 0} min={0} max={30} unit="px" onChange={(v) => patch({ paddingY: v })} />
      </div>
    );
  }

  if (tool === 'color') {
    return (
      <div className="px-editor-body">
        <ColorPickerStrip
          allowGradient={true}
          colorMode={layer.colorMode || 'solid'}
          solidValue={layer.color || '#f8fafc'}
          gradientCss={layer.gradCss || ''}
          onModeChange={(m) =>
            patch({
              colorMode: m,
              textureSrc: null,
              ...(m === 'gradient'
                ? {
                    gradColor1: layer.gradColor1 || '#fda4af',
                    gradColor2: layer.gradColor2 || '#38bdf8',
                    gradAngle: layer.gradAngle ?? 90
                  }
                : {})
            })
          }
          onSelectSolid={(hex) => patch({ colorMode: 'solid', color: hex, textureSrc: null })}
          onSelectGradient={(g) =>
            patch({
              colorMode: 'gradient',
              textureSrc: null,
              gradCss: g.css,
              gradAngle: g.angle,
              gradColor1: g.color1,
              gradColor2: g.color2,
              gradStops: g.stops
            })
          }
        />
      </div>
    );
  }

  if (tool === 'texture') {
    const handleTex = (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => patch({ textureSrc: r.result });
      r.readAsDataURL(f);
      e.target.value = '';
    };
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid">
          <label className="chip-btn active" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Upload size={12} /> গ্যালারি থেকে টেক্সচার
            <input type="file" accept="image/*" hidden onChange={handleTex} />
          </label>
          {layer.textureSrc && (
            <button className="chip-btn" onClick={() => patch({ textureSrc: null })} style={{ color: '#fda4af' }}>
              <Trash2 size={12} /> মুছুন
            </button>
          )}
        </div>
        {layer.textureSrc && (
          <StepperSlider label="স্কেল" value={layer.textureScale ?? 100} min={50} max={250} unit="%" onChange={(v) => patch({ textureScale: v })} />
        )}
      </div>
    );
  }

  if (tool === 'opacity') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="অপাসিটি" value={Math.round((layer.opacity ?? 1) * 100)} min={5} max={100} unit="%" onChange={(v) => patch({ opacity: v / 100 })} />
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

  if (tool === 'font') {
    const handlePhoneFont = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const saved = await saveUserFont(f);
        setUserFonts((prev) => [saved, ...prev]);
        setFontTab('user');
        patch({ font: saved.name });
      } catch {
        alert('সঠিক .ttf বা .otf ফন্ট দিন');
      } finally {
        e.target.value = '';
      }
    };

    const handleDelFont = (e, item) => {
      e.stopPropagation();
      const run = async () => {
        await deleteUserAsset('fonts', item.id, item.name);
        setUserFonts((prev) => prev.filter((x) => x.id !== item.id));
      };
      if (onRequestDelete) onRequestDelete(`"${item.name}" ফন্টটি কি ডিলিট করতে চান?`, run);
      else run();
    };

    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <button className={`px-toggle-pill ${fontTab === 'default' ? 'on' : ''}`} onClick={() => setFontTab('default')}>
              ডিফল্ট ({defaultFonts.length})
            </button>
            <button className={`px-toggle-pill ${fontTab === 'user' ? 'on' : ''}`} onClick={() => setFontTab('user')}>
              আমার ফন্ট ({userFonts.length})
            </button>
          </div>
          <label className="chip-btn" style={{ padding: '3px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Upload size={11} /> + ফোনের ফন্ট
            <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={handlePhoneFont} />
          </label>
        </div>

        {fontTab === 'default' ? (
          <div className="scroll-row">
            {defaultFonts.map((f) => (
              <button key={f.name} className={`chip-btn ${layer.font === f.name ? 'active' : ''}`} style={{ fontFamily: `'${f.name}', sans-serif` }} onClick={() => patch({ font: f.name })}>
                {f.name}
              </button>
            ))}
            {defaultFonts.length === 0 && <span style={{ fontSize: 11, color: '#64748b' }}>src/library/fonts/-এ .ttf/.otf ফন্ট রাখুন।</span>}
          </div>
        ) : (
          <div className="scroll-row">
            {userFonts.map((f) => (
              <button
                key={f.id}
                className={`chip-btn ${layer.font === f.name ? 'active' : ''}`}
                style={{ fontFamily: `'${f.name}', sans-serif`, display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => patch({ font: f.name })}
              >
                <span>{f.name}</span>
                <span onClick={(e) => handleDelFont(e, f)} style={{ color: '#fda4af', display: 'inline-flex' }}><X size={12} /></span>
              </button>
            ))}
            {userFonts.length === 0 && <span style={{ fontSize: 11, color: '#64748b' }}>আপনার লোড করা কোনো ফন্ট নেই।</span>}
          </div>
        )}
      </div>
    );
  }

  if (tool === 'style') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid">
          <button className={`px-toggle-pill ${layer.isBold !== false ? 'on' : ''}`} onClick={() => patch({ isBold: layer.isBold === false })}><Bold size={13} /> Bold</button>
          <button className={`px-toggle-pill ${layer.isItalic ? 'on' : ''}`} onClick={() => patch({ isItalic: !layer.isItalic })}><Italic size={13} /> Italic</button>
          <button className={`px-toggle-pill ${layer.isUnderline ? 'on' : ''}`} onClick={() => patch({ isUnderline: !layer.isUnderline })}><Underline size={13} /> Underline</button>
        </div>
      </div>
    );
  }

  if (tool === 'text-bg') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.textBgEnabled ? 'on' : ''}`} onClick={() => patch({ textBgEnabled: !layer.textBgEnabled, textBgColor: layer.textBgColor || '#0f172a' })}>
            {layer.textBgEnabled ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.textBgEnabled && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.textBgColor || '#0f172a'}
              onSelectSolid={(hex) => patch({ textBgColor: hex })}
            />
            <StepperSlider label="রাউন্ড" value={layer.textBgRadius ?? 8} min={0} max={30} unit="px" onChange={(v) => patch({ textBgRadius: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'align') {
    const a = layer.align || 'center';
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid">
          <button className={`px-toggle-pill ${a === 'left' ? 'on' : ''}`} onClick={() => patch({ align: 'left' })}><AlignLeft size={14} /></button>
          <button className={`px-toggle-pill ${a === 'center' ? 'on' : ''}`} onClick={() => patch({ align: 'center' })}><AlignCenter size={14} /></button>
          <button className={`px-toggle-pill ${a === 'right' ? 'on' : ''}`} onClick={() => patch({ align: 'right' })}><AlignRight size={14} /></button>
          <button className={`px-toggle-pill ${a === 'justify' ? 'on' : ''}`} onClick={() => patch({ align: 'justify' })}><AlignJustify size={14} /></button>
        </div>
      </div>
    );
  }

  if (tool === 'spacing') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="স্পেসিং" value={layer.letterSpacing ?? 0} min={-3} max={20} unit="px" onChange={(v) => patch({ letterSpacing: v })} />
      </div>
    );
  }

  if (tool === 'line-spacing') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="লাইন স্পেস" value={layer.lineHeight ?? 1.2} min={0.8} max={2.6} step={0.05} onChange={(v) => patch({ lineHeight: v })} />
      </div>
    );
  }

  return null;
}
