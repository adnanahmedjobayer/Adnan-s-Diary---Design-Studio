import React from 'react';
import ColorPickerStrip from './ColorPickerStrip';

export default function ColorPanel({ selectedLayer, updateLayer, bgConfig, setBgConfig }) {
  const isText = selectedLayer?.type === 'text';
  const isShape = selectedLayer?.type === 'shape';
  const isBgFallback = !selectedLayer;
  const canGrad = isText || isShape || isBgFallback;

  const isBgGrad =
    typeof bgConfig.gradient === 'string' &&
    (bgConfig.gradient.includes('linear-gradient') || bgConfig.gradient.includes('radial-gradient'));

  const isGradValue = isText
    ? selectedLayer.colorMode === 'gradient'
    : isShape
    ? typeof selectedLayer.color === 'string' &&
      (selectedLayer.color.includes('linear-gradient') || selectedLayer.color.includes('radial-gradient'))
    : isBgFallback
    ? isBgGrad
    : false;

  const solidVal = isText
    ? selectedLayer.color || '#f8fafc'
    : isShape && !isGradValue
    ? selectedLayer.color || '#fda4af'
    : isBgFallback && !isBgGrad
    ? bgConfig.gradient || '#1e1b2e'
    : '#f8fafc';

  const gradCss = isText
    ? selectedLayer.gradCss || ''
    : isShape && isGradValue
    ? selectedLayer.color
    : isBgFallback && isBgGrad
    ? bgConfig.gradient
    : '';

  return (
    <>
      <div className="strip-header">
        <span>লেয়ার কালার ও ব্যাকগ্রাউন্ড ব্রাইটনেস</span>
        <span>
          {isText
            ? 'সিলেক্টেড টেক্সট'
            : isShape
            ? 'সিলেক্টেড শেপ'
            : selectedLayer
            ? 'ছবি/স্টিকার (ফিল্টার ব্যবহার করুন)'
            : 'ব্যাকগ্রাউন্ড কালার'}
        </span>
      </div>

      <ColorPickerStrip
        allowGradient={canGrad}
        colorMode={isGradValue ? 'gradient' : 'solid'}
        solidValue={solidVal}
        gradientCss={gradCss}
        onModeChange={(m) => {
          if (isText) updateLayer(selectedLayer.id, { colorMode: m, textureSrc: null });
        }}
        onSelectSolid={(hex) => {
          if (isText) {
            updateLayer(selectedLayer.id, { colorMode: 'solid', color: hex, textureSrc: null });
          } else if (isShape) {
            updateLayer(selectedLayer.id, { color: hex });
          } else if (isBgFallback) {
            setBgConfig({
              ...bgConfig,
              transparent: false,
              useImage: false,
              gradient: hex,
              overlayGradient: 'none'
            });
          }
        }}
        onSelectGradient={(g) => {
          if (isText) {
            updateLayer(selectedLayer.id, {
              colorMode: 'gradient',
              textureSrc: null,
              gradCss: g.css,
              gradAngle: g.angle,
              gradColor1: g.color1,
              gradColor2: g.color2,
              gradStops: g.stops
            });
          } else if (isShape) {
            updateLayer(selectedLayer.id, { color: g.css });
          } else if (isBgFallback) {
            setBgConfig({
              ...bgConfig,
              transparent: false,
              useImage: false,
              gradient: g.css,
              overlayGradient: 'none'
            });
          }
        }}
      />

      <div className="slider-row">
        <span>ব্রাইটনেস: {bgConfig.brightness ?? 85}%</span>
        <input
          type="range"
          min="30"
          max="130"
          value={bgConfig.brightness ?? 85}
          onChange={(e) => setBgConfig({ ...bgConfig, brightness: Number(e.target.value) })}
        />
      </div>
    </>
  );
}
