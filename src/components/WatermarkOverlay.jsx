import React from 'react';

export default function WatermarkOverlay({ wm, boxW = 330 }) {
  if (!wm || !wm.enabled) return null;
  if (wm.mode === 'text' && !(wm.text || '').trim()) return null;
  if (wm.mode === 'image' && !wm.imageSrc) return null;

  const sizePct = Math.max(6, Math.min(70, wm.size ?? 22));
  const opacity = Math.max(0.05, Math.min(1, (wm.opacity ?? 45) / 100));
  const margin = `${Math.max(1, Math.min(20, wm.margin ?? 4))}%`;
  const fSize = Math.max(8, boxW * (sizePct / 100) * 0.25);
  const pos = wm.position || 'bottom-right';

  if (pos === 'tile') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 38,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          alignItems: 'center',
          justifyItems: 'center',
          opacity
        }}
      >
        {Array.from({ length: 9 }).map((_, idx) => (
          <div key={idx} style={{ transform: 'rotate(-26deg)' }}>
            {wm.mode === 'image' ? (
              <img
                src={wm.imageSrc}
                alt=""
                draggable={false}
                style={{ width: boxW * (sizePct / 100) * 0.72, height: 'auto', display: 'block' }}
              />
            ) : (
              <span
                style={{
                  fontFamily: `'${wm.font || 'sans-serif'}', sans-serif`,
                  fontSize: fSize * 0.85,
                  fontWeight: 700,
                  color: wm.color || '#ffffff',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 4px rgba(0,0,0,0.45)'
                }}
              >
                {wm.text}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  const posStyle = {
    position: 'absolute',
    pointerEvents: 'none',
    opacity,
    zIndex: 38
  };

  if (pos === 'top-left') Object.assign(posStyle, { top: margin, left: margin, textAlign: 'left' });
  else if (pos === 'top-center') Object.assign(posStyle, { top: margin, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' });
  else if (pos === 'top-right') Object.assign(posStyle, { top: margin, right: margin, textAlign: 'right' });
  else if (pos === 'center') Object.assign(posStyle, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' });
  else if (pos === 'bottom-left') Object.assign(posStyle, { bottom: margin, left: margin, textAlign: 'left' });
  else if (pos === 'bottom-center') Object.assign(posStyle, { bottom: margin, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' });
  else Object.assign(posStyle, { bottom: margin, right: margin, textAlign: 'right' });

  if (wm.mode === 'image') {
    return (
      <img
        src={wm.imageSrc}
        alt=""
        draggable={false}
        style={{
          ...posStyle,
          width: `${sizePct}%`,
          height: 'auto',
          display: 'block',
          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.35))'
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...posStyle,
        fontFamily: `'${wm.font || 'sans-serif'}', sans-serif`,
        fontSize: fSize,
        fontWeight: 700,
        color: wm.color || '#ffffff',
        whiteSpace: 'nowrap',
        lineHeight: 1.1,
        textShadow: '0 1px 4px rgba(0,0,0,0.5)'
      }}
    >
      {wm.text}
    </div>
  );
}
