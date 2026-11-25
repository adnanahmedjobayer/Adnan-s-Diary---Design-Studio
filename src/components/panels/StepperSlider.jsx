import React from 'react';
import { Minus, Plus } from 'lucide-react';

export default function StepperSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
  const clampRound = (val) => Number(Math.max(min, Math.min(max, val)).toFixed(decimals));
  const current = Number.isFinite(Number(value)) ? clampRound(Number(value)) : min;

  const btnStyle = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0
  };

  return (
    <div className="slider-row" style={{ gap: 7 }}>
      <span style={{ minWidth: 74, color: '#cbd5e1', whiteSpace: 'nowrap' }}>
        {label}: <strong style={{ color: '#f8fafc' }}>{current}{unit}</strong>
      </span>

      <button
        type="button"
        style={btnStyle}
        onClick={() => onChange?.(clampRound(current - step))}
        disabled={current <= min}
        title="কমান"
      >
        <Minus size={12} />
      </button>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange?.(clampRound(Number(e.target.value)))}
        style={{ flex: 1, minWidth: 70, accentColor: '#38bdf8' }}
      />

      <button
        type="button"
        style={btnStyle}
        onClick={() => onChange?.(clampRound(current + step))}
        disabled={current >= max}
        title="বাড়ান"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
