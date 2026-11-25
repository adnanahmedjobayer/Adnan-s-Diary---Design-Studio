import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Wand2, ImagePlus, X, Plus, Copy, ArrowUp, ArrowDown, Move, Grid,
  Maximize2, Palette, Droplet, RotateCw, FlipHorizontal, Square,
  PenTool, Sun, Sparkles, Sliders, RefreshCw, Box, FlipVertical,
  Trash2, ArrowLeft, Check, Eraser, Crop
} from 'lucide-react';
import { renderShapeSVG } from '../CanvasArea';
import { getLibraryStickers } from '../../library/stickers/loadStickers';
import { deleteUserAsset, getUserAssets, saveUserImageAsset } from '../../utils/userLibrary';

const ShapeStylePresets = lazy(() => import('./ShapeStylePresets'));
const ShapeToolsEditor = lazy(() => import('./ShapeToolsEditor'));

export const USEFUL_SHAPES = [
  { id: 'divider-flower', label: 'ডিভাইডার' },
  { id: 'quote-frame', label: 'ফ্রেম' },
  { id: 'corner-bracket', label: 'কর্নার' },
  { id: 'glass-card', label: 'গ্লাস কার্ড' },
  { id: 'heart-outline', label: 'হার্ট লাইন' },
  { id: 'heart-solid', label: 'সলিড হার্ট' },
  { id: 'broken-heart', label: 'ভাঙা হৃদয়' },
  { id: 'crescent-moon', label: 'চাঁদ' },
  { id: 'sparkle-stars', label: 'তারা' },
  { id: 'ribbon-banner', label: 'রিবন' },
  { id: 'circle-ring', label: 'রিং' },
  { id: 'diamond-frame', label: 'ডায়মন্ড' },
  { id: 'leaf-branch', label: 'পাতা' },
  { id: 'quote-marks', label: 'কোট চিহ্ন' },
  { id: 'arch-window', label: 'আর্চ' },
  { id: 'underline-wave', label: 'ঢেউ লাইন' },
  { id: 'hexagon-badge', label: 'হেক্সাগন' },
  { id: 'cloud-mist', label: 'মেঘ' },
  { id: 'pill-tag', label: 'পিল ট্যাগ' },
  { id: 'crown-minimal', label: 'মুকুট' }
];

const SHAPE_NAV_ITEMS = [
  { id: 'presets', label: 'স্টাইলস', icon: Wand2 },
  { id: 'add-more', label: 'নতুন যোগ', icon: Plus, instant: true },
  { id: 'copy', label: 'কপি', icon: Copy, instant: true },
  { id: 'to-front', label: 'টু ফ্রন্ট', icon: ArrowUp, instant: true },
  { id: 'to-back', label: 'টু ব্যাক', icon: ArrowDown, instant: true },
  { id: 'delete', label: 'ডিলিট', icon: Trash2, instant: true },
  { id: 'position', label: 'পজিশন', icon: Move },
  { id: 'rel-pos', label: 'রিলেটিভ', icon: Grid },
  { id: 'size', label: 'সাইজ', icon: Maximize2 },
  { id: 'crop', label: 'ক্রপ', icon: Crop, instant: true },
  { id: 'color', label: 'কালার', icon: Palette },
  { id: 'mood', label: 'মুড ফিল্টার', icon: Sparkles },
  { id: 'erase-color', label: 'ইরেজ কালার', icon: Eraser },
  { id: 'opacity', label: 'অপাসিটি', icon: Droplet },
  { id: 'rotate', label: 'রোটেট', icon: RotateCw },
  { id: 'flip', label: 'ফ্লিপ', icon: FlipHorizontal },
  { id: 'radius', label: 'রাউন্ড', icon: Square },
  { id: 'stroke', label: 'স্টক', icon: PenTool },
  { id: 'shadow', label: 'শেডো', icon: Sun },
  { id: 'emboss', label: 'এমবোস', icon: Sparkles },
  { id: 'brightness', label: 'ফিল্টার', icon: Sliders },
  { id: 'blur', label: 'ব্লার', icon: Droplet },
  { id: 'saturate', label: 'স্যাচুরেশন', icon: Sparkles },
  { id: 'hue', label: 'হিউ', icon: RefreshCw },
  { id: 'perspective', label: 'পার্সপেক্টিভ', icon: Grid },
  { id: 'rotate3d', label: '3D রোটেট', icon: RotateCw },
  { id: 'text3d', label: '3D ডেপথ', icon: Box },
  { id: 'shadow3d', label: '3D শেডো', icon: Sun },
  { id: 'reflection', label: 'রিফ্লেকশন', icon: FlipVertical }
];

export default function ShapePanel({
  selectedLayer,
  updateLayer,
  onAddShape,
  onAddCustomShape,
  onOpenShapeBuilder,
  userCustomShapes = [],
  onDeleteCustomShape,
  onAddStickerUrl,
  onCopyLayer,
  onMoveLayer,
  onDeleteSelected,
  onOpenLayerCrop,
  onRequestDelete
}) {
  const [mode, setMode] = useState('shapes');
  const [activeTool, setActiveTool] = useState(null);
  const [forceLibrary, setForceLibrary] = useState(false);
  const [userStickers, setUserStickers] = useState([]);
  const defaultStickers = useMemo(() => getLibraryStickers(), []);

  const isObjectSelected =
    selectedLayer &&
    (selectedLayer.type === 'shape' || selectedLayer.type === 'sticker' || selectedLayer.type === 'image');

  useEffect(() => {
    getUserAssets('stickers').then(setUserStickers);
  }, []);

  useEffect(() => {
    setActiveTool(null);
    if (isObjectSelected) setForceLibrary(false);
  }, [selectedLayer?.id, isObjectSelected]);

  const handleUploadSticker = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const saved = await saveUserImageAsset('stickers', file);
      setUserStickers((prev) => [saved, ...prev]);
      setMode('my-stickers');
      setForceLibrary(false);
      onAddStickerUrl?.(saved.src, saved.name);
    } catch {
      alert('স্টিকার লোড করা যায়নি');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteSticker = (e, id) => {
    e.stopPropagation();
    const run = async () => {
      await deleteUserAsset('stickers', id);
      setUserStickers((prev) => prev.filter((s) => s.id !== id));
    };
    if (onRequestDelete) onRequestDelete('এই স্টিকারটি কি ডিলিট করতে চান?', run);
    else run();
  };

  if (isObjectSelected && !forceLibrary) {
    if (activeTool) {
      const meta = SHAPE_NAV_ITEMS.find((t) => t.id === activeTool);
      return (
        <>
          <div className="px-editor-head">
            <button className="px-back-btn" onClick={() => setActiveTool(null)}>
              <ArrowLeft size={13} /> {meta?.label}
            </button>
            <button className="px-back-btn" style={{ background: '#0284c7' }} onClick={() => setActiveTool(null)}>
              <Check size={13} /> ঠিক আছে
            </button>
          </div>
          <Suspense fallback={<div style={{ fontSize: 11, color: '#64748b' }}>লোড হচ্ছে...</div>}>
            {activeTool === 'presets' ? (
              <ShapeStylePresets layer={selectedLayer} updateLayer={updateLayer} onRequestDelete={onRequestDelete} />
            ) : (
              <ShapeToolsEditor tool={activeTool} layer={selectedLayer} updateLayer={updateLayer} />
            )}
          </Suspense>
        </>
      );
    }

    const visibleNavItems = SHAPE_NAV_ITEMS.filter(
      (item) =>
        !(item.id === 'radius' && selectedLayer.type === 'shape') &&
        !(item.id === 'mood' && selectedLayer.type === 'shape')
    );

    return (
      <div className="px-tool-scroll">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className="px-tool-item"
              onClick={() => {
                if (item.id === 'add-more') return setForceLibrary(true);
                if (item.id === 'copy') return onCopyLayer?.(selectedLayer.id);
                if (item.id === 'to-front') return onMoveLayer?.(selectedLayer.id, 'front');
                if (item.id === 'to-back') return onMoveLayer?.(selectedLayer.id, 'back');
                if (item.id === 'delete') return onDeleteSelected?.();
                if (item.id === 'crop') return onOpenLayerCrop?.();
                setActiveTool(item.id);
              }}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="strip-header">
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
          {isObjectSelected && (
            <button className="chip-btn active" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setForceLibrary(false)}>
              <ArrowLeft size={11} /> এডিট
            </button>
          )}
          <button className={`chip-btn ${mode === 'shapes' ? 'active' : ''}`} style={{ padding: '2px 9px', fontSize: 11 }} onClick={() => setMode('shapes')}>
            শেপ
          </button>
          <button className={`chip-btn ${mode === 'my-shapes' ? 'active' : ''}`} style={{ padding: '2px 9px', fontSize: 11 }} onClick={() => setMode('my-shapes')}>
            আমার শেপ ({userCustomShapes.length})
          </button>
          <button className={`chip-btn ${mode === 'def-stickers' ? 'active' : ''}`} style={{ padding: '2px 9px', fontSize: 11 }} onClick={() => setMode('def-stickers')}>
            স্টিকার ({defaultStickers.length})
          </button>
          <button className={`chip-btn ${mode === 'my-stickers' ? 'active' : ''}`} style={{ padding: '2px 9px', fontSize: 11 }} onClick={() => setMode('my-stickers')}>
            আমার ({userStickers.length})
          </button>
        </div>

        <label className="chip-btn" style={{ padding: '2px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ImagePlus size={11} /> + স্টিকার
          <input type="file" accept="image/*,.svg" hidden onChange={handleUploadSticker} />
        </label>
      </div>

      {mode === 'shapes' && (
        <div className="scroll-row">
          <div
            className="shape-item"
            style={{ borderColor: '#38bdf8', background: 'rgba(56,189,248,0.14)', color: '#38bdf8', flexDirection: 'column', minWidth: 52, gap: 2 }}
            title="নিজে শেপ তৈরি করুন"
            onClick={() => onOpenShapeBuilder?.()}
          >
            <Plus size={16} />
            <span style={{ fontSize: 9, fontWeight: 700 }}>বানান</span>
          </div>

          {USEFUL_SHAPES.map((sh) => (
            <div key={sh.id} className="shape-item" title={sh.label} onClick={() => { setForceLibrary(false); onAddShape(sh.id); }}>
              <div style={{ width: 26, height: 26 }}>{renderShapeSVG(sh.id, '#e2e8f0', 0.95)}</div>
            </div>
          ))}
        </div>
      )}

      {mode === 'my-shapes' && (
        <div className="scroll-row" style={{ paddingTop: 4 }}>
          <div
            className="shape-item"
            style={{ borderColor: '#38bdf8', background: 'rgba(56,189,248,0.14)', color: '#38bdf8', flexDirection: 'column', minWidth: 52, gap: 2 }}
            onClick={() => onOpenShapeBuilder?.()}
          >
            <Plus size={16} />
            <span style={{ fontSize: 9, fontWeight: 700 }}>নতুন</span>
          </div>

          {userCustomShapes.map((sh) => (
            <div
              key={sh.id}
              className="shape-item"
              style={{ position: 'relative' }}
              title={sh.label}
              onClick={() => {
                setForceLibrary(false);
                onAddCustomShape?.({ customShape: sh.customShape, color: sh.color || '#fda4af', label: sh.label });
              }}
            >
              <div style={{ width: 28, height: 28 }}>
                {renderShapeSVG('custom', sh.color || '#e2e8f0', 0.95, null, 0, sh.customShape)}
              </div>
              <button
                className="asset-del-btn"
                title="ডিলিট"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCustomShape?.(sh);
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}

          {userCustomShapes.length === 0 && (
            <div style={{ fontSize: 11, color: '#64748b', padding: '12px 4px' }}>
              "+ নতুন" দিয়ে নিজের বানানো শেপ সেভ করলে এখানে থাকবে।
            </div>
          )}
        </div>
      )}

      {mode === 'def-stickers' && (
        <div className="scroll-row">
          {defaultStickers.map((st) => (
            <div key={st.id} className="shape-item" title={st.name} onClick={() => { setForceLibrary(false); onAddStickerUrl?.(st.src, st.name); }}>
              <img src={st.src} alt={st.name} style={{ width: 30, height: 30, objectFit: 'contain' }} />
            </div>
          ))}
          {defaultStickers.length === 0 && (
            <div style={{ fontSize: 11, color: '#64748b', padding: '12px 4px' }}>src/library/stickers/ ফোল্ডারে ডিফল্ট PNG/SVG স্টিকার রাখুন।</div>
          )}
        </div>
      )}

      {mode === 'my-stickers' && (
        <div className="scroll-row" style={{ paddingTop: 4 }}>
          {userStickers.map((st) => (
            <div key={st.id} className="shape-item" style={{ position: 'relative' }} title={st.name} onClick={() => { setForceLibrary(false); onAddStickerUrl?.(st.src, st.name); }}>
              <img src={st.src} alt={st.name} style={{ width: 30, height: 30, objectFit: 'contain' }} />
              <button className="asset-del-btn" title="ডিলিট করুন" onClick={(e) => handleDeleteSticker(e, st.id)}><X size={10} /></button>
            </div>
          ))}
          {userStickers.length === 0 && (
            <div style={{ fontSize: 11, color: '#64748b', padding: '12px 4px' }}>"+ স্টিকার" দিয়ে নিজের PNG/SVG স্টিকার যোগ করুন।</div>
          )}
        </div>
      )}
    </>
  );
}
