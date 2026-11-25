import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
  Wand2, Copy, ArrowUp, ArrowDown, Move, Grid, Maximize2,
  Square, Palette, Image, Droplet, RotateCw, Type,
  Bold, RefreshCw, AlignCenter, MoveHorizontal,
  ChevronsUpDown, PenTool, Layers, Sun, Sparkles,
  Box, FlipVertical, ArrowLeft, Check
} from 'lucide-react';

const TextStylePresets = lazy(() => import('./TextStylePresets'));
const TextBasicTools = lazy(() => import('./TextBasicTools'));
const TextEffectTools = lazy(() => import('./TextEffectTools'));

const EFFECT_TOOLS = new Set([
  'curve', 'stroke', 'shadow', 'emboss',
  'perspective', 'rotate3d', 'text3d', 'shadow3d', 'reflection'
]);

const TEXT_NAV_ITEMS = [
  { id: 'presets', label: 'স্টাইলস', icon: Wand2 },
  { id: 'copy', label: 'কপি', icon: Copy, instant: true },
  { id: 'to-front', label: 'টু ফ্রন্ট', icon: ArrowUp, instant: true },
  { id: 'to-back', label: 'টু ব্যাক', icon: ArrowDown, instant: true },
  { id: 'position', label: 'পজিশন', icon: Move },
  { id: 'rel-pos', label: 'রিলেটিভ', icon: Grid },
  { id: 'size', label: 'সাইজ', icon: Maximize2 },
  { id: 'padding', label: 'পেডিং', icon: Square },
  { id: 'color', label: 'কালার', icon: Palette },
  { id: 'texture', label: 'টেক্সার', icon: Image },
  { id: 'opacity', label: 'অপাসিটি', icon: Droplet },
  { id: 'rotate', label: 'রোটেট', icon: RotateCw },
  { id: 'font', label: 'ফন্ট', icon: Type },
  { id: 'style', label: 'স্টাইল', icon: Bold },
  { id: 'curve', label: 'কার্ভ', icon: RefreshCw },
  { id: 'text-bg', label: 'ব্যাকগ্রাউন্ড', icon: Layers },
  { id: 'align', label: 'এলাইন', icon: AlignCenter },
  { id: 'spacing', label: 'স্পেসিং', icon: MoveHorizontal },
  { id: 'line-spacing', label: 'লাইন স্পেস', icon: ChevronsUpDown },
  { id: 'stroke', label: 'স্টক', icon: PenTool },
  { id: 'shadow', label: 'শেডো', icon: Sun },
  { id: 'emboss', label: 'এমবোস', icon: Sparkles },
  { id: 'perspective', label: 'পার্সপেক্টিভ', icon: Grid },
  { id: 'rotate3d', label: '3D রোটেট', icon: RotateCw },
  { id: 'text3d', label: '3D টেক্সট', icon: Box },
  { id: 'shadow3d', label: '3D শেডো', icon: Sun },
  { id: 'reflection', label: 'রিফ্লেকশন', icon: FlipVertical }
];

export default function TextPanel({
  selectedLayer,
  updateLayer,
  onAddText,
  onCopyLayer,
  onMoveLayer,
  onRequestDelete
}) {
  const [activeTool, setActiveTool] = useState(null);

  useEffect(() => {
    if (!selectedLayer || selectedLayer.type !== 'text') {
      setActiveTool(null);
    }
  }, [selectedLayer?.id, selectedLayer?.type]);

  if (!selectedLayer || selectedLayer.type !== 'text') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 6px' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>টেক্সট সিলেক্ট করুন</span>
        <button className="chip-btn active" onClick={onAddText} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Type size={13} /> + নতুন টেক্সট
        </button>
      </div>
    );
  }

  const handleNavClick = (item) => {
    if (item.instant) {
      if (item.id === 'copy') onCopyLayer?.(selectedLayer.id);
      if (item.id === 'to-front') onMoveLayer?.(selectedLayer.id, 'front');
      if (item.id === 'to-back') onMoveLayer?.(selectedLayer.id, 'back');
      return;
    }
    setActiveTool(item.id);
  };

  if (activeTool) {
    const toolMeta = TEXT_NAV_ITEMS.find((t) => t.id === activeTool);
    const isEffect = EFFECT_TOOLS.has(activeTool);

    return (
      <>
        <div className="px-editor-head">
          <button className="px-back-btn" onClick={() => setActiveTool(null)}>
            <ArrowLeft size={13} /> {toolMeta?.label}
          </button>
          <button className="px-back-btn" style={{ background: '#0284c7' }} onClick={() => setActiveTool(null)}>
            <Check size={13} /> ঠিক আছে
          </button>
        </div>
        <Suspense fallback={<div style={{ fontSize: 11, color: '#64748b' }}>লোড হচ্ছে...</div>}>
          {activeTool === 'presets' ? (
            <TextStylePresets layer={selectedLayer} updateLayer={updateLayer} onRequestDelete={onRequestDelete} />
          ) : isEffect ? (
            <TextEffectTools tool={activeTool} layer={selectedLayer} updateLayer={updateLayer} />
          ) : (
            <TextBasicTools tool={activeTool} layer={selectedLayer} updateLayer={updateLayer} onRequestDelete={onRequestDelete} />
          )}
        </Suspense>
      </>
    );
  }

  return (
    <div className="px-tool-scroll">
      {TEXT_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} className="px-tool-item" onClick={() => handleNavClick(item)}>
            <Icon size={17} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
