export const MOOD_FILTERS = [
  {
    id: 'none',
    label: 'স্বাভাবিক',
    previewBg: 'linear-gradient(135deg, #334155, #1e293b)'
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    previewBg: 'linear-gradient(135deg, #f59e0b, #78350f)',
    sepia: 28,
    saturate: 138,
    contrast: 108,
    brightness: 104,
    tintRgb: [245, 158, 11],
    tintAlpha: 0.24,
    blendMode: 'soft-light'
  },
  {
    id: 'midnight',
    label: 'Midnight Blue',
    previewBg: 'linear-gradient(135deg, #1d4ed8, #0f172a)',
    saturate: 85,
    contrast: 114,
    brightness: 92,
    tintRgb: [29, 78, 216],
    tintAlpha: 0.34,
    blendMode: 'multiply'
  },
  {
    id: 'vintage',
    label: 'Vintage Film',
    previewBg: 'linear-gradient(135deg, #d6b88d, #574128)',
    sepia: 42,
    saturate: 88,
    contrast: 94,
    brightness: 102,
    tintRgb: [180, 140, 90],
    tintAlpha: 0.22,
    blendMode: 'soft-light'
  },
  {
    id: 'noir',
    label: 'B&W Noir',
    previewBg: 'linear-gradient(135deg, #cbd5e1, #09090b)',
    grayscale: 100,
    contrast: 132,
    brightness: 96,
    tintRgb: null
  },
  {
    id: 'rose',
    label: 'Romantic Rose',
    previewBg: 'linear-gradient(135deg, #fb7185, #4c0519)',
    saturate: 118,
    contrast: 104,
    brightness: 103,
    tintRgb: [244, 63, 94],
    tintAlpha: 0.22,
    blendMode: 'soft-light'
  },
  {
    id: 'emerald',
    label: 'Forest Mist',
    previewBg: 'linear-gradient(135deg, #10b981, #064e3b)',
    saturate: 110,
    contrast: 106,
    hueRotate: -10,
    tintRgb: [16, 185, 129],
    tintAlpha: 0.22,
    blendMode: 'soft-light'
  },
  {
    id: 'sunset',
    label: 'Sunset Glow',
    previewBg: 'linear-gradient(135deg, #fb923c, #9d174d)',
    saturate: 142,
    contrast: 112,
    hueRotate: -8,
    tintRgb: [236, 72, 153],
    tintAlpha: 0.24,
    blendMode: 'overlay'
  },
  {
    id: 'matte',
    label: 'Matte Faded',
    previewBg: 'linear-gradient(135deg, #94a3b8, #334155)',
    saturate: 82,
    contrast: 86,
    brightness: 108,
    tintRgb: [100, 116, 139],
    tintAlpha: 0.18,
    blendMode: 'screen'
  }
];

export const DEFAULT_MOOD_FILTER = {
  id: 'none',
  intensity: 80
};

export function resolveMoodFilter(moodConfig) {
  if (!moodConfig || !moodConfig.id || moodConfig.id === 'none') {
    return { filterParts: [], tintCss: null, blendMode: 'normal' };
  }
  const preset = MOOD_FILTERS.find((m) => m.id === moodConfig.id);
  if (!preset) {
    return { filterParts: [], tintCss: null, blendMode: 'normal' };
  }

  const t = Math.max(0, Math.min(1, (moodConfig.intensity ?? 80) / 100));
  if (t <= 0) {
    return { filterParts: [], tintCss: null, blendMode: 'normal' };
  }

  const filterParts = [];
  if (preset.grayscale) {
    filterParts.push(`grayscale(${Math.round(preset.grayscale * t)}%)`);
  }
  if (preset.sepia) {
    filterParts.push(`sepia(${Math.round(preset.sepia * t)}%)`);
  }
  if (preset.brightness !== undefined && preset.brightness !== 100) {
    const val = Math.round(100 + (preset.brightness - 100) * t);
    if (val !== 100) filterParts.push(`brightness(${val}%)`);
  }
  if (preset.contrast !== undefined && preset.contrast !== 100) {
    const val = Math.round(100 + (preset.contrast - 100) * t);
    if (val !== 100) filterParts.push(`contrast(${val}%)`);
  }
  if (preset.saturate !== undefined && preset.saturate !== 100) {
    const val = Math.round(100 + (preset.saturate - 100) * t);
    if (val !== 100) filterParts.push(`saturate(${val}%)`);
  }
  if (preset.hueRotate) {
    const val = Math.round(preset.hueRotate * t);
    if (val !== 0) filterParts.push(`hue-rotate(${val}deg)`);
  }

  const tintCss = preset.tintRgb
    ? `rgba(${preset.tintRgb[0]}, ${preset.tintRgb[1]}, ${preset.tintRgb[2]}, ${(preset.tintAlpha * t).toFixed(3)})`
    : null;

  return {
    filterParts,
    tintCss,
    blendMode: preset.blendMode || 'soft-light'
  };
}
