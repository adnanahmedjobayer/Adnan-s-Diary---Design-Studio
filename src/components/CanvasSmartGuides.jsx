import React from 'react';

function getLineStyle(kind) {
  if (kind === 'center') {
    return { color: '#f43f5e', dashed: false };
  }
  if (kind === 'safe' || kind === 'third') {
    return { color: '#fbbf24', dashed: true };
  }
  return { color: '#38bdf8', dashed: kind === 'layer-edge' };
}

export function CanvasSmartGuides({ guides }) {
  if (!guides) return null;
  const { vLines = [], hLines = [], spacing = [] } = guides;

  return (
    <>
      {vLines.map((line, i) => {
        const st = getLineStyle(line.kind);
        return (
          <div
            key={`v-${i}`}
            className="smart-guide-v"
            style={{
              left: `${line.pos}%`,
              borderLeft: `1.5px ${st.dashed ? 'dashed' : 'solid'} ${st.color}`
            }}
          />
        );
      })}

      {hLines.map((line, i) => {
        const st = getLineStyle(line.kind);
        return (
          <div
            key={`h-${i}`}
            className="smart-guide-h"
            style={{
              top: `${line.pos}%`,
              borderTop: `1.5px ${st.dashed ? 'dashed' : 'solid'} ${st.color}`
            }}
          />
        );
      })}

      {spacing.map((sp, i) => {
        const isX = sp.axis === 'x';
        const min = Math.min(sp.from, sp.to);
        const len = Math.max(2, Math.abs(sp.to - sp.from));
        return (
          <div
            key={`sp-${i}`}
            className="smart-spacing-bar"
            style={
              isX
                ? {
                    left: `${min}%`,
                    width: `${len}%`,
                    top: `${sp.cross}%`,
                    height: 10,
                    transform: 'translateY(-50%)',
                    borderTop: 'none',
                    borderBottom: 'none',
                    borderLeft: '1.5px solid #22c55e',
                    borderRight: '1.5px solid #22c55e'
                  }
                : {
                    top: `${min}%`,
                    height: `${len}%`,
                    left: `${sp.cross}%`,
                    width: 10,
                    transform: 'translateX(-50%)',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: '1.5px solid #22c55e',
                    borderBottom: '1.5px solid #22c55e'
                  }
            }
          >
            <div
              style={{
                position: 'absolute',
                ...(isX
                  ? { left: 0, right: 0, top: '50%', height: 1.5, background: '#22c55e' }
                  : { top: 0, bottom: 0, left: '50%', width: 1.5, background: '#22c55e' })
              }}
            />
            <span className="smart-spacing-badge">=</span>
          </div>
        );
      })}
    </>
  );
}

export function CanvasSmartHud({ hud, magnetOn }) {
  if (!hud) return null;

  return (
    <div className="smart-hud-wrap" aria-hidden="true">
      <div className={`smart-hud-pill ${hud.snapped || hud.nearKey !== null ? 'is-snapped' : ''}`}>
        {hud.type === 'move' && (
          <>
            <span>X: {hud.x}% • Y: {hud.y}%</span>
            {hud.matched && !magnetOn && (
              <span className="smart-hud-tag">গাইড (ম্যাগনেট অফ)</span>
            )}
          </>
        )}
        {hud.type === 'scale' && <span>{hud.text}</span>}
        {hud.type === 'size' && <span>{hud.text}</span>}
        {hud.type === 'rotate' && (
          <span>
            {hud.angle}° {hud.nearKey !== null ? '• স্ট্রেইট' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
