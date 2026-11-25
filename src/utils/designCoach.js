import { parseGradientCss } from './colorPalette';

function parseColorRgb(colorStr = '') {
  if (typeof colorStr !== 'string') return null;
  const s = colorStr.trim();
  const hexMatch = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3])
    };
  }
  return null;
}

function getLuminance(rgb) {
  if (!rgb) return 0.5;
  const toLin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(rgb.r) + 0.7152 * toLin(rgb.g) + 0.0722 * toLin(rgb.b);
}

function contrastRatio(lum1, lum2) {
  const hi = Math.max(lum1, lum2);
  const lo = Math.min(lum1, lum2);
  return (hi + 0.05) / (lo + 0.05);
}

function estimateBgLuminance(bgConfig) {
  if (!bgConfig || bgConfig.transparent) return null;

  let baseLum = 0.14;
  const parsed = parseGradientCss(bgConfig.gradient || '');
  if (parsed && parsed.stops.length) {
    const lums = parsed.stops
      .map((st) => parseColorRgb(st.color))
      .filter(Boolean)
      .map(getLuminance);
    if (lums.length) {
      baseLum = lums.reduce((a, b) => a + b, 0) / lums.length;
    }
  } else {
    const rgb = parseColorRgb(bgConfig.gradient || '');
    if (rgb) baseLum = getLuminance(rgb);
  }

  if (bgConfig.useImage) {
    const br = (bgConfig.brightness ?? 85) / 100;
    const op = bgConfig.imageOpacity ?? 0.65;
    const imgLum = Math.min(1, 0.42 * br);
    baseLum = baseLum * (1 - op) + imgLum * op;
  }

  if (bgConfig.overlayGradient && bgConfig.overlayGradient !== 'none') {
    baseLum = baseLum * 0.72;
  }

  return Math.max(0, Math.min(1, baseLum));
}

function resolvePrimaryTextColor(layer) {
  if (layer.colorMode === 'gradient') {
    if (layer.gradCss) {
      const p = parseGradientCss(layer.gradCss);
      if (p?.stops?.[0]?.color) return p.stops[0].color;
    }
    if (layer.gradStops?.[0]?.color) return layer.gradStops[0].color;
    if (layer.gradColor1) return layer.gradColor1;
  }
  return layer.color || '#f8fafc';
}

export function analyzeDesign({ bgConfig, layers = [] }) {
  const issues = [];
  const visibleLayers = layers.filter((l) => l.visible !== false);
  const bgLum = estimateBgLuminance(bgConfig);

  // ১. কনট্রাস্ট ও পঠনযোগ্যতা চেক
  if (bgLum !== null) {
    const isDarkBg = bgLum < 0.45;
    const lowContrastIds = [];

    for (const l of visibleLayers) {
      if (l.type !== 'text' || l.textureSrc) continue;
      const textRgb = parseColorRgb(resolvePrimaryTextColor(l));
      if (!textRgb) continue;
      const textLum = getLuminance(textRgb);

      let surfaceLum = bgLum;
      if (l.textBgEnabled && l.textBgColor) {
        const boxRgb = parseColorRgb(l.textBgColor);
        if (boxRgb) surfaceLum = getLuminance(boxRgb);
      }

      const ratio = contrastRatio(textLum, surfaceLum);
      const hasProtection = l.shadow || (l.strokeEnabled && (l.strokeWidth ?? 2) >= 2);
      if (ratio < 3.2 && !hasProtection) {
        lowContrastIds.push(l.id);
      }
    }

    if (lowContrastIds.length > 0) {
      issues.push({
        id: 'fix-contrast',
        severity: 'high',
        title: 'লেখার কনট্রাস্ট কম দেখাচ্ছে',
        desc: `${lowContrastIds.length}টি লেখা ব্যাকগ্রাউন্ডের সাথে মিশে যাচ্ছে। এক ট্যাপে স্পষ্ট রঙ ও হালকা শ্যাডো দিন।`,
        fixLabel: 'স্পষ্ট করুন',
        apply: (curLayers) =>
          curLayers.map((l) =>
            lowContrastIds.includes(l.id)
              ? {
                  ...l,
                  colorMode: 'solid',
                  textureSrc: null,
                  color: isDarkBg ? '#f8fafc' : '#0f172a',
                  shadow: true,
                  shadowColor: isDarkBg ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.65)',
                  shadowBlur: 10,
                  shadowY: 3
                }
              : l
          )
      });
    }
  }

  // ২. সেফ মার্জিন চেক (কিনারায় কেটে যাওয়ার ঝুঁকি)
  const edgeIds = [];
  for (const l of visibleLayers) {
    if (l.locked) continue;
    if (l.x < 10 || l.x > 90 || l.y < 8 || l.y > 92) {
      edgeIds.push(l.id);
    }
  }
  if (edgeIds.length > 0) {
    issues.push({
      id: 'fix-safe-zone',
      severity: 'medium',
      title: 'কিনারার খুব কাছে লেয়ার আছে',
      desc: `${edgeIds.length}টি লেয়ার সেফ-জোনের বাইরে থাকায় সেভ বা শেয়ারে কেটে যেতে পারে।`,
      fixLabel: 'সেফ-জোনে আনুন',
      apply: (curLayers) =>
        curLayers.map((l) =>
          edgeIds.includes(l.id)
            ? {
                ...l,
                x: Math.max(12, Math.min(88, l.x)),
                y: Math.max(10, Math.min(90, l.y))
              }
            : l
        )
    });
  }

  // ৩. সামান্য বাঁকা বা প্রায়-সেন্টার্ড লেয়ার অ্যালাইনমেন্ট চেক
  const nearCenterIds = [];
  for (const l of visibleLayers) {
    if (l.locked) continue;
    const dx = Math.abs(l.x - 50);
    if (dx > 0.8 && dx <= 9) {
      nearCenterIds.push(l.id);
    }
  }
  if (nearCenterIds.length > 0) {
    issues.push({
      id: 'fix-center-align',
      severity: 'medium',
      title: 'অ্যালাইনমেন্ট সামান্য সরে আছে',
      desc: `${nearCenterIds.length}টি লেয়ার মাঝখান থেকে সামান্য সরে আছে। সেন্টার করলে প্রফেশনাল দেখাবে।`,
      fixLabel: 'মাঝে আনুন',
      apply: (curLayers) =>
        curLayers.map((l) => (nearCenterIds.includes(l.id) ? { ...l, x: 50 } : l))
    });
  }

  // ৪. একাধিক টেক্সটের সাইজ হায়ারার্কি চেক
  const textLayers = visibleLayers.filter((l) => l.type === 'text' && !l.locked);
  if (textLayers.length >= 2) {
    const sizes = textLayers.map((l) => l.fontSize || 22);
    const maxS = Math.max(...sizes);
    const minS = Math.min(...sizes);
    if (maxS - minS < 3) {
      const primaryId = textLayers[0].id;
      const secondaryId = textLayers[1].id;
      issues.push({
        id: 'fix-hierarchy',
        severity: 'low',
        title: 'হেডিং ও সাবটাইটেল সাইজ প্রায় এক',
        desc: 'মূল লেখাটি একটু বড় এবং দ্বিতীয়টি কিছুটা ছোট হলে ডিজাইনে সুন্দর ব্যালেন্স তৈরি হয়।',
        fixLabel: 'ব্যালেন্স করুন',
        apply: (curLayers) =>
          curLayers.map((l) => {
            if (l.id === primaryId) {
              return { ...l, fontSize: Math.min(64, (l.fontSize || 22) + 4) };
            }
            if (l.id === secondaryId) {
              return { ...l, fontSize: Math.max(12, (l.fontSize || 22) - 3), opacity: 0.88 };
            }
            return l;
          })
      });
    }
  }

  // স্কোর হিসাব
  let penalty = 0;
  for (const iss of issues) {
    penalty += iss.severity === 'high' ? 22 : iss.severity === 'medium' ? 12 : 7;
  }
  const score = Math.max(35, 100 - penalty);
  const gradeLabel =
    score >= 92 ? 'একদম প্রফেশনাল' : score >= 75 ? 'ভালো ডিজাইন' : 'আরও সুন্দর করা যাবে';

  return {
    score,
    gradeLabel,
    issues,
    applySingle: (issue, curLayers) => issue.apply(curLayers),
    applyAll: (curLayers) => {
      let updated = curLayers;
      for (const iss of issues) {
        updated = iss.apply(updated);
      }
      return updated;
    }
  };
}
