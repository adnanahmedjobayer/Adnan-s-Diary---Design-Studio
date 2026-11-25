import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

const STORAGE_KEY = 'adnans_user_text_styles_v1';

const RESET_BASE = {
  colorMode: 'solid',
  color: '#f8fafc',
  gradCss: null,
  gradStops: null,
  gradColor1: '#fda4af',
  gradColor2: '#38bdf8',
  gradAngle: 90,
  textureSrc: null,
  isBold: true,
  isItalic: false,
  isUnderline: false,
  strokeEnabled: false,
  strokeColor: '#000000',
  strokeWidth: 2,
  shadow: false,
  shadowColor: 'rgba(0,0,0,0.85)',
  shadowBlur: 10,
  shadowX: 0,
  shadowY: 3,
  embossEnabled: false,
  embossIntensity: 4,
  text3dEnabled: false,
  color3d: '#475569',
  depth3d: 6,
  shadow3dEnabled: false,
  shadow3dY: 18,
  shadow3dOpacity: 50,
  shadow3dBlur: 8,
  reflectionEnabled: false,
  reflectionOffset: 4,
  reflectionOpacity: 45,
  textBgEnabled: false,
  textBgColor: '#0f172a',
  textBgRadius: 8
};

const STYLE_KEYS = Object.keys(RESET_BASE);

const DEFAULT_PRESETS = [
  {
    id: 'clean',
    label: 'ক্লিন',
    style: {
      colorMode: 'solid',
      color: '#f8fafc',
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.75)',
      shadowBlur: 8,
      shadowX: 0,
      shadowY: 2
    }
  },
  {
    id: 'golden-3d',
    label: 'গোল্ডেন 3D',
    style: {
      colorMode: 'gradient',
      gradColor1: '#fef08a',
      gradColor2: '#ca8a04',
      gradAngle: 180,
      text3dEnabled: true,
      color3d: '#713f12',
      depth3d: 6,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowY: 5
    }
  },
  {
    id: 'neon-cyan',
    label: 'নিয়ন',
    style: {
      colorMode: 'solid',
      color: '#e0f2fe',
      strokeEnabled: true,
      strokeColor: '#0284c7',
      strokeWidth: 1.5,
      shadow: true,
      shadowColor: '#38bdf8',
      shadowBlur: 16,
      shadowX: 0,
      shadowY: 0
    }
  },
  {
    id: 'rose-pink',
    label: 'রোমান্টিক',
    style: {
      colorMode: 'gradient',
      gradColor1: '#fda4af',
      gradColor2: '#c084fc',
      gradAngle: 90,
      shadow: true,
      shadowColor: 'rgba(88,28,135,0.85)',
      shadowBlur: 10,
      shadowY: 3
    }
  },
  {
    id: 'poster-bold',
    label: 'পোস্টার',
    style: {
      colorMode: 'solid',
      color: '#fde047',
      strokeEnabled: true,
      strokeColor: '#0f172a',
      strokeWidth: 3.5,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 6,
      shadowX: 2,
      shadowY: 4
    }
  },
  {
    id: 'silver-emboss',
    label: 'এমবোস',
    style: {
      colorMode: 'gradient',
      gradColor1: '#f8fafc',
      gradColor2: '#94a3b8',
      gradAngle: 180,
      embossEnabled: true,
      embossIntensity: 5,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.7)',
      shadowBlur: 8,
      shadowY: 3
    }
  },
  {
    id: 'caption-box',
    label: 'ক্যাপশন',
    style: {
      colorMode: 'solid',
      color: '#f8fafc',
      textBgEnabled: true,
      textBgColor: '#be123c',
      textBgRadius: 10,
      paddingX: 12,
      paddingY: 6
    }
  },
  {
    id: 'fire-3d',
    label: 'ফায়ার 3D',
    style: {
      colorMode: 'gradient',
      gradColor1: '#fde047',
      gradColor2: '#ef4444',
      gradAngle: 180,
      strokeEnabled: true,
      strokeColor: '#450a0a',
      strokeWidth: 1.5,
      text3dEnabled: true,
      color3d: '#7f1d1d',
      depth3d: 5,
      shadow: true,
      shadowColor: '#000000',
      shadowBlur: 10,
      shadowY: 4
    }
  },
  {
    id: 'mirror-ice',
    label: 'রিফ্লেকশন',
    style: {
      colorMode: 'gradient',
      gradColor1: '#ffffff',
      gradColor2: '#7dd3fc',
      gradAngle: 180,
      reflectionEnabled: true,
      reflectionOffset: 3,
      reflectionOpacity: 50,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.75)',
      shadowBlur: 8,
      shadowY: 2
    }
  }
];

function loadSavedStyles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getPreviewCss(st) {
  const shadows = [];
  if (st.text3dEnabled) {
    const c = st.color3d || '#475569';
    shadows.push(`1px 1px 0 ${c}`, `2px 2px 0 ${c}`);
  }
  if (st.shadow) {
    shadows.push(`0 2px ${Math.min(8, st.shadowBlur ?? 6)}px ${st.shadowColor || 'rgba(0,0,0,0.85)'}`);
  }

  const base = {
    fontSize: 13,
    fontWeight: st.isBold === false ? 400 : 700,
    fontStyle: st.isItalic ? 'italic' : 'normal',
    textDecoration: st.isUnderline ? 'underline' : 'none',
    padding: st.textBgEnabled ? '2px 6px' : '1px 3px',
    borderRadius: st.textBgEnabled ? 6 : 0,
    backgroundColor: st.textBgEnabled ? (st.textBgColor || '#0f172a') : 'transparent',
    WebkitTextStroke: st.strokeEnabled ? `0.8px ${st.strokeColor || '#000'}` : '0px transparent',
    textShadow: shadows.length ? shadows.join(', ') : 'none',
    lineHeight: 1.2
  };

  if (st.colorMode === 'gradient') {
    return {
      ...base,
      backgroundImage:
        st.gradCss ||
        `linear-gradient(${st.gradAngle ?? 90}deg, ${st.gradColor1 || '#fda4af'}, ${st.gradColor2 || '#38bdf8'})`,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent'
    };
  }

  return {
    ...base,
    color: st.color || '#f8fafc'
  };
}

export default function TextStylePresets({ layer, updateLayer, onRequestDelete }) {
  const [tab, setTab] = useState('default');
  const [userStyles, setUserStyles] = useState(() => loadSavedStyles());

  const applyPreset = (styleObj) => {
    updateLayer(layer.id, { ...RESET_BASE, ...styleObj });
  };

  const handleSaveCurrentStyle = () => {
    const rawName = window.prompt('নতুন স্টাইলের নাম লিখুন:', `স্টাইল ${userStyles.length + 1}`);
    if (!rawName) return;

    const picked = {};
    STYLE_KEYS.forEach((k) => {
      if (k !== 'textureSrc' && layer[k] !== undefined) {
        picked[k] = layer[k];
      }
    });

    const newItem = {
      id: `us-${Date.now()}`,
      label: rawName.trim().slice(0, 14),
      style: picked
    };

    const next = [newItem, ...userStyles];
    setUserStyles(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    setTab('user');
  };

  const handleDeleteUserStyle = (e, item) => {
    e.stopPropagation();
    const run = () => {
      const next = userStyles.filter((x) => x.id !== item.id);
      setUserStyles(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    };
    if (onRequestDelete) {
      onRequestDelete(`"${item.label}" স্টাইলটি কি ডিলিট করতে চান?`, run);
    } else {
      run();
    }
  };

  const list = tab === 'default' ? DEFAULT_PRESETS : userStyles;

  return (
    <div className="px-editor-body">
      <div className="px-mini-grid" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <button className={`px-toggle-pill ${tab === 'default' ? 'on' : ''}`} onClick={() => setTab('default')}>
            ডিফল্ট ({DEFAULT_PRESETS.length})
          </button>
          <button className={`px-toggle-pill ${tab === 'user' ? 'on' : ''}`} onClick={() => setTab('user')}>
            আমার ({userStyles.length})
          </button>
        </div>

        <button
          className="chip-btn"
          style={{ padding: '3px 9px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          onClick={handleSaveCurrentStyle}
        >
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
              gap: 3,
              padding: '4px 6px',
              cursor: 'pointer',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            {tab === 'user' && (
              <button
                className="asset-del-btn"
                title="ডিলিট"
                onClick={(e) => handleDeleteUserStyle(e, item)}
              >
                <X size={10} />
              </button>
            )}
            <span style={getPreviewCss(item.style)}>বাংলা</span>
            <span style={{ fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}

        {tab === 'user' && userStyles.length === 0 && (
          <div style={{ fontSize: 11, color: '#64748b', padding: '14px 4px' }}>
            পছন্দমতো লেখা সাজিয়ে "+ বর্তমান সেভ" চাপলে এখানে জমা থাকবে।
          </div>
        )}
      </div>
    </div>
  );
}
