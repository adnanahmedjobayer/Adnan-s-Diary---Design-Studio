import React from 'react';
import StepperSlider from './StepperSlider';
import ColorPickerStrip from './ColorPickerStrip';

export default function TextEffectTools({ tool, layer, updateLayer }) {
  const patch = (obj) => updateLayer(layer.id, obj);

  if (tool === 'curve') {
    return (
      <div className="px-editor-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="কার্ভ" value={layer.curve ?? 0} min={-100} max={100} onChange={(v) => patch({ curve: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 11, marginTop: 6 }} onClick={() => patch({ curve: 0 })}>0</button>
        </div>
      </div>
    );
  }

  if (tool === 'stroke') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.strokeEnabled ? 'on' : ''}`} onClick={() => patch({ strokeEnabled: !layer.strokeEnabled, strokeColor: layer.strokeColor || '#000000' })}>
            {layer.strokeEnabled ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.strokeEnabled && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.strokeColor || '#000000'}
              onSelectSolid={(hex) => patch({ strokeColor: hex })}
            />
            <StepperSlider label="উইডথ" value={layer.strokeWidth ?? 2} min={1} max={12} unit="px" onChange={(v) => patch({ strokeWidth: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'shadow') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.shadow ? 'on' : ''}`} onClick={() => patch({ shadow: !layer.shadow })}>
            {layer.shadow ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.shadow && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.shadowColor || '#000000'}
              onSelectSolid={(hex) => patch({ shadowColor: hex })}
            />
            <StepperSlider label="ব্লার" value={layer.shadowBlur ?? 10} min={0} max={30} onChange={(v) => patch({ shadowBlur: v })} />
            <StepperSlider label="Offset X" value={layer.shadowX ?? 0} min={-20} max={20} onChange={(v) => patch({ shadowX: v })} />
            <StepperSlider label="Offset Y" value={layer.shadowY ?? 3} min={-20} max={20} onChange={(v) => patch({ shadowY: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'emboss') {
    return (
      <div className="px-editor-body">
        <button className={`px-toggle-pill ${layer.embossEnabled ? 'on' : ''}`} onClick={() => patch({ embossEnabled: !layer.embossEnabled })}>
          {layer.embossEnabled ? 'চালু' : 'বন্ধ'}
        </button>
        {layer.embossEnabled && (
          <StepperSlider label="তীব্রতা" value={layer.embossIntensity ?? 4} min={1} max={10} onChange={(v) => patch({ embossIntensity: v })} />
        )}
      </div>
    );
  }

  if (tool === 'perspective') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="Skew X" value={layer.skewX ?? 0} min={-45} max={45} unit="°" onChange={(v) => patch({ skewX: v })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="Skew Y" value={layer.skewY ?? 0} min={-45} max={45} unit="°" onChange={(v) => patch({ skewY: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 10, marginTop: 6 }} onClick={() => patch({ skewX: 0, skewY: 0 })}>0</button>
        </div>
      </div>
    );
  }

  if (tool === 'rotate3d') {
    return (
      <div className="px-editor-body">
        <StepperSlider label="3D X" value={layer.rotateX ?? 0} min={-65} max={65} unit="°" onChange={(v) => patch({ rotateX: v })} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }}>
            <StepperSlider label="3D Y" value={layer.rotateY ?? 0} min={-65} max={65} unit="°" onChange={(v) => patch({ rotateY: v })} />
          </div>
          <button className="chip-btn" style={{ padding: '4px 8px', fontSize: 10, marginTop: 6 }} onClick={() => patch({ rotateX: 0, rotateY: 0 })}>0</button>
        </div>
      </div>
    );
  }

  if (tool === 'text3d') {
    return (
      <div className="px-editor-body">
        <div className="px-mini-grid" style={{ marginBottom: 4 }}>
          <button className={`px-toggle-pill ${layer.text3dEnabled ? 'on' : ''}`} onClick={() => patch({ text3dEnabled: !layer.text3dEnabled, color3d: layer.color3d || '#475569' })}>
            {layer.text3dEnabled ? 'চালু' : 'বন্ধ'}
          </button>
        </div>
        {layer.text3dEnabled && (
          <>
            <ColorPickerStrip
              allowGradient={false}
              solidValue={layer.color3d || '#475569'}
              onSelectSolid={(hex) => patch({ color3d: hex })}
            />
            <StepperSlider label="গভীরতা" value={layer.depth3d ?? 6} min={1} max={18} onChange={(v) => patch({ depth3d: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'shadow3d') {
    return (
      <div className="px-editor-body">
        <button className={`px-toggle-pill ${layer.shadow3dEnabled ? 'on' : ''}`} onClick={() => patch({ shadow3dEnabled: !layer.shadow3dEnabled })}>
          {layer.shadow3dEnabled ? 'চালু' : 'বন্ধ'}
        </button>
        {layer.shadow3dEnabled && (
          <>
            <StepperSlider label="দূরত্ব" value={layer.shadow3dY ?? 18} min={5} max={45} onChange={(v) => patch({ shadow3dY: v })} />
            <StepperSlider label="অপাসিটি" value={layer.shadow3dOpacity ?? 50} min={10} max={95} unit="%" onChange={(v) => patch({ shadow3dOpacity: v })} />
            <StepperSlider label="ব্লার" value={layer.shadow3dBlur ?? 8} min={0} max={25} onChange={(v) => patch({ shadow3dBlur: v })} />
          </>
        )}
      </div>
    );
  }

  if (tool === 'reflection') {
    return (
      <div className="px-editor-body">
        <button className={`px-toggle-pill ${layer.reflectionEnabled ? 'on' : ''}`} onClick={() => patch({ reflectionEnabled: !layer.reflectionEnabled })}>
          {layer.reflectionEnabled ? 'চালু' : 'বন্ধ'}
        </button>
        {layer.reflectionEnabled && (
          <>
            <StepperSlider label="দূরত্ব" value={layer.reflectionOffset ?? 4} min={-10} max={30} onChange={(v) => patch({ reflectionOffset: v })} />
            <StepperSlider label="অপাসিটি" value={layer.reflectionOpacity ?? 45} min={10} max={90} unit="%" onChange={(v) => patch({ reflectionOpacity: v })} />
          </>
        )}
      </div>
    );
  }

  return null;
}
