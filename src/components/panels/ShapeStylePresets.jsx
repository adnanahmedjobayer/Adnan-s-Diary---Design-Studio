import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const STORAGE_KEY = 'adnans_user_shape_styles_v1';

const RESET_SHAPE_BASE = {
  opacity: 0.9,
  strokeEnabled: false,
  strokeColor: '#ffffff',
  strokeWidth: 2,
  shadow: false,
  shadowColor: 'rgba(0,0,0,0.8)',
  shadowBlur: 8,
  shadowX: 0,
  shadowY: 4,
  embossEnabled: false,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
  blur: 0,
  text3dEnabled: false,
  color3d: '#334155',
  depth3d: 5,
  shadow3dEnabled: false,
  shadow3dY: 16,
  shadow3dOpacity: 50,
  shadow3dBlur: 7,
  reflectionEnabled: false,
  reflectionOffset: 4,
  reflectionOpacity: 40
};

const STYLE_KEYS = ['color', ...Object.keys(RESET_SHAPE_BASE)];

const SHAPE_PRESETS = [
  {
    id: 'sh-clean',
    label: 'ক্লিন',
    style: { color: '#e2e8f0', opacity: 0.9 }
  },
  {
    id: 'sh-gold-3d',
    label: 'গোল্ড 3D',
    style: {
      color: '#fde047',
      text3dEnabled: true,
      color3d: '#854d0e',
      depth3d: 6,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowY: 4
    }
  },
  {
    id: 'sh-neon',
    label: 'নিয়ন গ্লো',
    style: {
      color: '#38bdf8',
      strokeEnabled: true,
      strokeColor: '#e0f2fe',
      strokeWidth: 2,
      shadow: true,
      shadowColor: '#38bdf8',
      shadowBlur: 16,
      shadowY: 0
    }
  },
  {
    id: 'sh-rose',
    label: 'রোজ সফট',
    style: {
      color: '#fda4af',
      shadow: true,
      shadowColor: 'rgba(190,18,60,0.75)',
      shadowBlur: 12,
      shadowY: 3
    }
  },
  {
    id: 'sh-emboss',
    label: 'এমবোস',
    style: {
      color: '#cbd5e1',
      embossEnabled: true,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.65)',
      shadowBlur: 6,
      shadowY: 3
    }
  },
  {
    id: 'sh-glass',
    label: 'গ্লাস শেডো',
    style: {
      color: '#ffffff',
      opacity: 0.45,
      strokeEnabled: true,
      strokeColor: '#ffffff',
      strokeWidth: 2,
      shadow3dEnabled: true,
      shadow3dY: 16,
      shadow3dOpacity: 55
    }
  },
  {
    id: 'sh-mirror',
    label: 'রিফ্লেকশন',
    style: {
      color: '#a5f3fc',
      reflectionEnabled: true,
      reflectionOffset: 4,
      reflectionOpacity: 45,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.7)',
      shadowBlur: 8
    }
  }
];

function loadSavedShapeStyles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function ShapeStylePresets({ layer, updateLayer, onRequestDelete }) {
  const [tab, setTab] = useState('default');
  const [userStyles, setUserStyles] = useState(() => loadSavedShapeStyles());

  const applyPreset = (styleObj) => {
    const patch = { ...RESET_SHAPE_BASE, ...styleObj };
    if (layer.type !== 'shape') {
      delete patch.color;
      patch.text3dEnabled = false;
      if (styleObj.opacity === undefined || styleObj.opacity === 0.9) {
        patch.opacity = 1;
      }
    }
    updateLayer(layer.id, patch);
  };

  const handleSave = () => {
    const rawName = window.prompt('শেপ স্টাইলের নাম লিখুন:', `শেপ স্টাইল ${userStyles.length + 1}`);
    if (!rawName) return;
    const picked = {};
    STYLE_KEYS.forEach((k) => {
      if (layer[k] !== undefined) picked[k] = layer[k];
    });
    const next = [{ id: `uss-${Date.now()}`, label: rawName.trim().slice(0, 14), style: picked }, ...userStyles];
    setUserStyles(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    setTab('user');
  };

  const handleDel = (e, item) => {
    e.stopPropagation();
    const run = () => {
      const next = userStyles.filter((x) => x.id !== item.id);
      setUserStyles(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    };
    if (onRequestDelete) onRequestDelete(`"${item.label}" স্টাইলটি কি ডিলিট করতে চান?`, run);
    else run();
  };

  const list = tab === 'default' ? SHAPE_PRESETS : userStyles;

  return (
    <div className="px-editor-body">
      <div className="px-mini-grid" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <button className={`px-toggle-pill ${tab === 'default' ? 'on' : ''}`} onClick={() => setTab('default')}>
            ডিফল্ট ({SHAPE_PRESETS.length})
          </button>
          <button className={`px-toggle-pill ${tab === 'user' ? 'on' : ''}`} onClick={() => setTab('user')}>
            আমার ({userStyles.length})
          </button>
        </div>

        <button className="chip-btn" style={{ padding: '3px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }} onClick={handleSave}>
          <Plus size={12} /> বর্তমান সেভ
        </button>
      </div>

      <div className="scroll-row" style={{ paddingTop: 4 }}>
        {list.map((item) => (
          <div
            key={item.id}
            onClick={() => applyPreset(item.style)}
            style={{
              minWidth: 68,
              height: 54,
              borderRadius: 10,
              background: '#0f172a',
              border: '1px solid rgba(255,255,255,0.14)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '4px 6px',
              cursor: 'pointer',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            {tab === 'user' && (
              <button className="asset-del-btn" title="ডিলিট" onClick={(e) => handleDel(e, item)}>
                <X size={10} />
              </button>
            )}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: item.style.color || '#38bdf8',
                opacity: item.style.opacity ?? 0.9,
                border: item.style.strokeEnabled ? `2px solid ${item.style.strokeColor || '#fff'}` : 'none',
                boxShadow: item.style.shadow ? `0 2px 8px ${item.style.shadowColor || 'rgba(0,0,0,0.8)'}` : 'none'
              }}
            />
            <span style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}

        {tab === 'user' && userStyles.length === 0 && (
          <div style={{ fontSize: 11, color: '#64748b', padding: '14px 4px' }}>
            শেপ সাজিয়ে "+ বর্তমান সেভ" চাপলে এখানে জমা থাকবে।
          </div>
        )}
      </div>
    </div>
  );
}
