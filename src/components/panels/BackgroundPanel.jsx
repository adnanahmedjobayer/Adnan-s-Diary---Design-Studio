import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Palette, Grid, Maximize2, Crop, Image as ImageIcon,
  ImagePlus, Sliders, ArrowLeft, Check, X, RotateCcw, LayoutGrid, Sparkles
} from 'lucide-react';
import { getLibraryBackgrounds } from '../../library/backgrounds/loadBackgrounds';
import { deleteUserAsset, getUserAssets, saveUserImageAsset } from '../../utils/userLibrary';
import { DEFAULT_PATTERN, PATTERN_LIST, getPatternCssStyle } from '../../utils/patternMaker';
import { DEFAULT_MOOD_FILTER, MOOD_FILTERS } from '../../utils/moodFilters';
import StepperSlider from './StepperSlider';
import ColorPickerStrip from './ColorPickerStrip';

const SIZE_PRESETS = [
  { label: '1:1 Square', w: 1080, h: 1080 },
  { label: '4:5 Post', w: 1080, h: 1350 },
  { label: '16:9 YouTube', w: 1280, h: 720 },
  { label: '9:16 Reels', w: 1080, h: 1920 },
  { label: '3:4 Portrait', w: 900, h: 1200 },
  { label: 'FB Cover', w: 851, h: 315 }
];

const VIGNETTE_PRESETS = [
  { id: 'none', label: 'বন্ধ', value: 'none' },
  { id: 'soft', label: 'হালকা', value: 'radial-gradient(circle, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.45) 100%)' },
  { id: 'med', label: 'মাঝারি', value: 'radial-gradient(circle, rgba(0,0,0,0.15) 30%, rgba(10,10,18,0.78) 100%)' },
  { id: 'dark', label: 'গাঢ়', value: 'radial-gradient(circle, rgba(0,0,0,0.22) 18%, rgba(5,5,10,0.92) 100%)' }
];

const BG_NAV_ITEMS = [
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'patterns', label: 'Patterns', icon: LayoutGrid },
  { id: 'filters', label: 'Filters', icon: Sparkles },
  { id: 'transparent', label: 'Transparent', icon: Grid },
  { id: 'image-size', label: 'Image Size', icon: Maximize2 },
  { id: 'crop', label: 'Crop', icon: Crop },
  { id: 'effects', label: 'Effects', icon: Sliders },
  { id: 'bg-images', label: 'Bg Images', icon: ImageIcon },
  { id: 'gallery', label: 'From Gallery', icon: ImagePlus }
];

export default function BackgroundPanel({
  bgConfig,
  setBgConfig,
  canvasSize,
  setCanvasSize,
  onOpenCropModal,
  onRequestDelete
}) {
  const [activeTool, setActiveTool] = useState(null);
  const [imgTab, setImgTab] = useState('default');
  const [userBgs, setUserBgs] = useState([]);
  const [customW, setCustomW] = useState(canvasSize?.width || 1080);
  const [customH, setCustomH] = useState(canvasSize?.height || 1080);
  const galleryRef = useRef(null);

  const libBgs = useMemo(() => getLibraryBackgrounds(), []);
  const pat = bgConfig.pattern || DEFAULT_PATTERN;
  const mood = bgConfig.moodFilter || DEFAULT_MOOD_FILTER;

  useEffect(() => {
    getUserAssets('backgrounds').then(setUserBgs);
  }, []);

  useEffect(() => {
    setCustomW(canvasSize?.width || 1080);
    setCustomH(canvasSize?.height || 1080);
  }, [canvasSize?.width, canvasSize?.height]);

  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const saved = await saveUserImageAsset('backgrounds', file);
      setUserBgs((prev) => [saved, ...prev]);
      setBgConfig({
        ...bgConfig,
        id: saved.id,
        transparent: false,
        useImage: true,
        imageSrc: saved.imageSrc,
        imageOpacity: 0.85
      });
    } catch {
      alert('ছবি লোড করা যায়নি');
    } finally {
      e.target.value = '';
    }
  };

  const handleNavClick = (id) => {
    if (id === 'transparent') {
      setBgConfig({
        ...bgConfig,
        transparent: !bgConfig.transparent,
        useImage: bgConfig.transparent ? bgConfig.useImage : false
      });
      return;
    }
    if (id === 'crop') {
      if (!bgConfig.useImage || !bgConfig.imageSrc) {
        alert('ক্রপ করার জন্য আগে একটি ব্যাকগ্রাউন্ড ছবি সেট করুন।');
        return;
      }
      onOpenCropModal?.();
      return;
    }
    if (id === 'gallery') {
      galleryRef.current?.click();
      return;
    }
    setActiveTool(id);
  };

  const applyCustomSize = () => {
    const w = Math.max(100, Math.min(4096, Number(customW) || 1080));
    const h = Math.max(100, Math.min(4096, Number(customH) || 1080));
    setCanvasSize({ width: w, height: h });
  };

  const handleDeleteUserBg = (e, item) => {
    e.stopPropagation();
    const doDelete = async () => {
      await deleteUserAsset('backgrounds', item.id);
      setUserBgs((prev) => prev.filter((x) => x.id !== item.id));
    };
    if (onRequestDelete) {
      onRequestDelete(`"${item.name}" ব্যাকগ্রাউন্ডটি কি ডিলিট করতে চান?`, doDelete);
    } else {
      doDelete();
    }
  };

  const resetBgEffects = () => {
    setBgConfig({
      ...bgConfig,
      imageOpacity: 0.75,
      blur: 0,
      brightness: 85,
      contrast: 110,
      overlayGradient: VIGNETTE_PRESETS[2].value
    });
  };

  const updatePattern = (patchObj) => {
    setBgConfig({
      ...bgConfig,
      transparent: false,
      pattern: { ...DEFAULT_PATTERN, ...pat, ...patchObj }
    });
  };

  const updateMood = (patchObj) => {
    setBgConfig({
      ...bgConfig,
      transparent: false,
      moodFilter: { ...DEFAULT_MOOD_FILTER, ...mood, ...patchObj }
    });
  };

  const isBgGrad =
    typeof bgConfig.gradient === 'string' &&
    (bgConfig.gradient.includes('linear-gradient') || bgConfig.gradient.includes('radial-gradient'));

  return (
    <>
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleGalleryUpload} />

      {!activeTool ? (
        <div className="px-tool-scroll">
          {BG_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              (item.id === 'transparent' && bgConfig.transparent) ||
              (item.id === 'patterns' && pat.id && pat.id !== 'none' && !bgConfig.transparent) ||
              (item.id === 'filters' && mood.id && mood.id !== 'none' && !bgConfig.transparent);
            return (
              <button
                key={item.id}
                className="px-tool-item"
                style={isActive ? { borderColor: '#38bdf8', background: 'rgba(56,189,248,0.18)' } : undefined}
                onClick={() => handleNavClick(item.id)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="px-editor-head">
            <button className="px-back-btn" onClick={() => setActiveTool(null)}>
              <ArrowLeft size={13} /> {BG_NAV_ITEMS.find((x) => x.id === activeTool)?.label}
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {activeTool === 'effects' && !bgConfig.transparent && (
                <button className="px-back-btn" onClick={resetBgEffects} title="রিসেট">
                  <RotateCcw size={12} /> রিসেট
                </button>
              )}
              {activeTool === 'patterns' && pat.id !== 'none' && (
                <button
                  className="px-back-btn"
                  onClick={() => setBgConfig({ ...bgConfig, pattern: { ...DEFAULT_PATTERN } })}
                  title="প্যাটার্ন বন্ধ"
                >
                  <RotateCcw size={12} /> বন্ধ
                </button>
              )}
              {activeTool === 'filters' && mood.id !== 'none' && (
                <button
                  className="px-back-btn"
                  onClick={() => setBgConfig({ ...bgConfig, moodFilter: { ...DEFAULT_MOOD_FILTER } })}
                  title="ফিল্টার বন্ধ"
                >
                  <RotateCcw size={12} /> বন্ধ
                </button>
              )}
              <button className="px-back-btn" style={{ background: '#0284c7' }} onClick={() => setActiveTool(null)}>
                <Check size={13} /> ঠিক আছে
              </button>
            </div>
          </div>

          {activeTool === 'color' && (
            <div className="px-editor-body">
              <ColorPickerStrip
                allowGradient={true}
                colorMode={isBgGrad ? 'gradient' : 'solid'}
                solidValue={!isBgGrad ? bgConfig.gradient || '#1e1b2e' : '#1e1b2e'}
                gradientCss={isBgGrad ? bgConfig.gradient : ''}
                onSelectSolid={(hex) =>
                  setBgConfig({
                    ...bgConfig,
                    transparent: false,
                    useImage: false,
                    gradient: hex,
                    overlayGradient: 'none'
                  })
                }
                onSelectGradient={(g) =>
                  setBgConfig({
                    ...bgConfig,
                    transparent: false,
                    useImage: false,
                    gradient: g.css,
                    overlayGradient: 'none'
                  })
                }
              />
            </div>
          )}

          {activeTool === 'patterns' && (
            <div className="px-editor-body">
              <div className="scroll-row" style={{ marginBottom: 6 }}>
                {PATTERN_LIST.map((item) => {
                  const selected = (pat.id || 'none') === item.id;
                  const thumbCss =
                    item.id === 'none'
                      ? null
                      : getPatternCssStyle({
                          id: item.id,
                          color: '#cbd5e1',
                          opacity: 55,
                          size: 14,
                          thickness: 1
                        });
                  return (
                    <div
                      key={item.id}
                      className="theme-card"
                      style={{
                        minWidth: 64,
                        width: 64,
                        height: 52,
                        backgroundColor: '#1e293b',
                        borderColor: selected ? '#38bdf8' : 'rgba(255,255,255,0.16)',
                        ...(thumbCss || {})
                      }}
                      onClick={() => updatePattern({ id: item.id })}
                    >
                      <span style={{ fontSize: 9 }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>

              {pat.id && pat.id !== 'none' && (
                <>
                  <ColorPickerStrip
                    allowGradient={false}
                    solidValue={pat.color || '#94a3b8'}
                    onSelectSolid={(hex) => updatePattern({ color: hex })}
                  />
                  <StepperSlider
                    label="সাইজ"
                    value={pat.size ?? 24}
                    min={12}
                    max={60}
                    unit="px"
                    onChange={(v) => updatePattern({ size: v })}
                  />
                  <StepperSlider
                    label="স্বচ্ছতা"
                    value={pat.opacity ?? 28}
                    min={5}
                    max={85}
                    unit="%"
                    onChange={(v) => updatePattern({ opacity: v })}
                  />
                  {pat.id !== 'checker' && pat.id !== 'grain' && (
                    <StepperSlider
                      label="পুরুত্ব"
                      value={pat.thickness ?? 1}
                      min={1}
                      max={4}
                      step={0.5}
                      unit="px"
                      onChange={(v) => updatePattern({ thickness: v })}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {activeTool === 'filters' && (
            <div className="px-editor-body">
              <div className="scroll-row" style={{ marginBottom: 6 }}>
                {MOOD_FILTERS.map((m) => {
                  const selected = (mood.id || 'none') === m.id;
                  return (
                    <div
                      key={m.id}
                      className="theme-card"
                      style={{
                        minWidth: 68,
                        width: 68,
                        height: 54,
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
          )}

          {activeTool === 'image-size' && (
            <div className="px-editor-body">
              <div className="scroll-row" style={{ marginBottom: 6 }}>
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`chip-btn ${canvasSize?.width === p.w && canvasSize?.height === p.h ? 'active' : ''}`}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                    onClick={() => setCanvasSize({ width: p.w, height: p.h })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="px-mini-grid">
                <span style={{ fontSize: 11 }}>W:</span>
                <input type="number" className="px-size-input" value={customW} onChange={(e) => setCustomW(e.target.value)} />
                <span style={{ fontSize: 11 }}>H:</span>
                <input type="number" className="px-size-input" value={customH} onChange={(e) => setCustomH(e.target.value)} />
                <button className="chip-btn active" style={{ padding: '4px 10px', fontSize: 11 }} onClick={applyCustomSize}>সেট</button>
              </div>
            </div>
          )}

          {activeTool === 'effects' && (
            <div className="px-editor-body">
              {bgConfig.transparent ? (
                <div style={{ fontSize: 11, color: '#94a3b8', padding: '10px 2px' }}>
                  ট্রান্সপারেন্ট ব্যাকগ্রাউন্ডে ইফেক্ট কাজ করে না।
                </div>
              ) : (
                <>
                  <div className="px-mini-grid" style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>ভিনিয়েট শেড:</span>
                    {VIGNETTE_PRESETS.map((v) => {
                      const isCur =
                        v.value === 'none'
                          ? bgConfig.overlayGradient === 'none'
                          : bgConfig.overlayGradient === v.value ||
                            (v.id === 'med' && bgConfig.overlayGradient !== 'none' && !VIGNETTE_PRESETS.some((p) => p.value === bgConfig.overlayGradient));
                      return (
                        <button
                          key={v.id}
                          className={`px-toggle-pill ${isCur ? 'on' : ''}`}
                          onClick={() => setBgConfig({ ...bgConfig, overlayGradient: v.value })}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>

                  {bgConfig.useImage ? (
                    <>
                      <StepperSlider
                        label="ব্লার"
                        value={bgConfig.blur ?? 0}
                        min={0}
                        max={20}
                        unit="px"
                        onChange={(v) => setBgConfig({ ...bgConfig, blur: v })}
                      />
                      <StepperSlider
                        label="অপাসিটি"
                        value={Math.round((bgConfig.imageOpacity ?? 0.65) * 100)}
                        min={10}
                        max={100}
                        unit="%"
                        onChange={(v) => setBgConfig({ ...bgConfig, imageOpacity: v / 100 })}
                      />
                      <StepperSlider
                        label="ব্রাইটনেস"
                        value={bgConfig.brightness ?? 85}
                        min={30}
                        max={150}
                        unit="%"
                        onChange={(v) => setBgConfig({ ...bgConfig, brightness: v })}
                      />
                      <StepperSlider
                        label="কনট্রাস্ট"
                        value={bgConfig.contrast ?? 110}
                        min={50}
                        max={180}
                        unit="%"
                        onChange={(v) => setBgConfig({ ...bgConfig, contrast: v })}
                      />
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      ব্লার, অপাসিটি ও ব্রাইটনেস ইফেক্ট ব্যবহার করতে Bg Images বা Gallery থেকে একটি ছবি সেট করুন।
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTool === 'bg-images' && (
            <div className="px-editor-body">
              <div className="px-mini-grid" style={{ marginBottom: 6 }}>
                <button className={`px-toggle-pill ${imgTab === 'default' ? 'on' : ''}`} onClick={() => setImgTab('default')}>
                  ডিফল্ট ({libBgs.length})
                </button>
                <button className={`px-toggle-pill ${imgTab === 'user' ? 'on' : ''}`} onClick={() => setImgTab('user')}>
                  আমার ফাইল ({userBgs.length})
                </button>
              </div>

              {imgTab === 'default' ? (
                <div className="scroll-row">
                  {libBgs.map((b) => (
                    <div
                      key={b.id}
                      className="theme-card"
                      style={{ width: 54, height: 54, minWidth: 54, background: b.gradient }}
                      onClick={() => setBgConfig({ ...bgConfig, ...b, transparent: false })}
                    >
                      <img src={b.imageSrc} alt={b.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                      <span style={{ fontSize: 9 }}>{b.name}</span>
                    </div>
                  ))}
                  {libBgs.length === 0 && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>src/library/backgrounds/ ফোল্ডারে ছবি রাখুন।</span>
                  )}
                </div>
              ) : (
                <div className="scroll-row">
                  {userBgs.map((b) => (
                    <div
                      key={b.id}
                      className="theme-card"
                      style={{ width: 54, height: 54, minWidth: 54, background: '#1e293b', overflow: 'visible' }}
                      onClick={() => setBgConfig({ ...bgConfig, id: b.id, transparent: false, useImage: true, imageSrc: b.imageSrc, imageOpacity: 0.85 })}
                    >
                      <img src={b.imageSrc} alt={b.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                      <button className="asset-del-btn" onClick={(e) => handleDeleteUserBg(e, b)} title="ডিলিট"><X size={10} /></button>
                      <span style={{ fontSize: 9 }}>{b.name}</span>
                    </div>
                  ))}
                  {userBgs.length === 0 && (
                    <span style={{ fontSize: 11, color: '#64748b' }}>"From Gallery" দিয়ে আপলোড করা ছবি এখানে থাকবে।</span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
