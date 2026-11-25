import React, { useEffect, useState } from 'react';
import {
  GripVertical, Lock, Unlock, SquarePen,
  Eye, EyeOff, Trash2, X, Layers,
  CheckSquare, Square, ArrowUp, ArrowDown, Check
} from 'lucide-react';
import { renderShapeSVG } from './CanvasArea';

const MergeLayersIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="10" height="10" rx="2" />
    <rect x="11" y="11" width="10" height="10" rx="2" />
    <path d="M16 5l3 3-3 3" />
    <path d="M19 8h-3" />
    <path d="M8 19l-3-3 3-3" />
    <path d="M5 16h3" />
  </svg>
);

export default function LayerDrawer({
  open,
  onClose,
  layers,
  selectedId,
  onSelectLayer,
  onUpdateLayer,
  onEditText,
  onDeleteLayer,
  onReorderLayers,
  onMergeLayers,
  onMultiDelete,
  onMultiLock,
  onMultiToggleVisible
}) {
  const [multiMode, setMultiMode] = useState(false);
  const [multiIds, setMultiIds] = useState([]);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open) {
      setMultiMode(false);
      setMultiIds([]);
      setMerging(false);
    }
  }, [open]);

  if (!open) return null;

  const validMultiIds = multiIds.filter((id) => layers.some((l) => l.id === id));
  const selectedTargets = layers.filter((l) => validMultiIds.includes(l.id));
  const allLocked = selectedTargets.length > 0 && selectedTargets.every((l) => l.locked);
  const allHidden = selectedTargets.length > 0 && selectedTargets.every((l) => l.visible === false);

  const toggleMultiId = (id) => {
    setMultiIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (validMultiIds.length === layers.length) {
      setMultiIds([]);
    } else {
      setMultiIds(layers.map((l) => l.id));
    }
  };

  const handleMove = (dir) => {
    if (!selectedId) return;
    const idx = layers.findIndex((x) => x.id === selectedId);
    if (idx === -1) return;
    const copy = [...layers];
    if (dir === 'up' && idx < layers.length - 1) {
      [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
      onReorderLayers(copy);
    } else if (dir === 'down' && idx > 0) {
      [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
      onReorderLayers(copy);
    }
  };

  const handleRunMerge = async () => {
    if (validMultiIds.length < 2 || merging) return;
    setMerging(true);
    try {
      const done = await onMergeLayers(validMultiIds);
      if (done) {
        setMultiIds([]);
        setMultiMode(false);
      }
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="layer-drawer-backdrop" onClick={onClose}>
      <div className="layer-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="layer-drawer-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Layers size={16} color="#38bdf8" />
            <span>
              {multiMode ? `সিলেক্ট (${validMultiIds.length}/${layers.length})` : `Layers (${layers.length})`}
            </span>
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {multiMode && layers.length > 0 && (
              <button
                className="chip-btn"
                style={{ padding: '2px 8px', fontSize: 10 }}
                onClick={toggleSelectAll}
              >
                {validMultiIds.length === layers.length ? 'বাদ দিন' : 'সবগুলো'}
              </button>
            )}
            <button className="layer-close-btn" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="layer-list-container">
          {[...layers].reverse().map((l) => {
            const isSelected = multiMode ? validMultiIds.includes(l.id) : l.id === selectedId;
            const isHidden = l.visible === false;
            const layerTitle =
              l.type === 'text'
                ? l.text
                : l.type === 'shape'
                ? (l.label || `Shape • ${l.shapeId}`)
                : l.label || (l.type === 'sticker' ? 'Sticker' : 'Photo Layer');

            return (
              <div
                key={l.id}
                className={`px-layer-card ${isSelected ? 'active' : ''}`}
                style={{ opacity: isHidden ? 0.5 : 1 }}
                onClick={multiMode ? () => toggleMultiId(l.id) : undefined}
              >
                <div
                  className="px-layer-left"
                  onClick={(e) => {
                    if (multiMode) return;
                    e.stopPropagation();
                    if (!l.locked) onSelectLayer(l.id);
                  }}
                >
                  <span className="px-drag-grip" style={{ color: multiMode && isSelected ? '#38bdf8' : '#64748b' }}>
                    {multiMode ? (
                      isSelected ? <CheckSquare size={16} /> : <Square size={16} />
                    ) : (
                      <GripVertical size={15} />
                    )}
                  </span>

                  {l.type === 'shape' && (
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 6,
                        padding: 3
                      }}
                    >
                      {renderShapeSVG(l.shapeId, l.color || '#e2e8f0', 0.95, null, 0, l.customShape)}
                    </span>
                  )}

                  {(l.type === 'image' || l.type === 'sticker') && l.src && (
                    <img
                      src={l.src}
                      alt=""
                      style={{
                        width: 24,
                        height: 24,
                        objectFit: 'contain',
                        flexShrink: 0,
                        borderRadius: 5,
                        background: 'rgba(255,255,255,0.06)'
                      }}
                    />
                  )}

                  <span className="px-layer-title">{layerTitle}</span>
                </div>

                {!multiMode && (
                  <div className="px-layer-grid">
                    <button
                      className={`px-grid-btn ${l.locked ? 'is-locked' : ''}`}
                      onClick={() => onUpdateLayer(l.id, { locked: !l.locked })}
                      title="Lock/Unlock"
                    >
                      {l.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    <button
                      className="px-grid-btn"
                      onClick={() => {
                        onSelectLayer(l.id);
                        if (l.type === 'text') onEditText(l);
                      }}
                      title="Edit"
                    >
                      <SquarePen size={14} />
                    </button>
                    <button
                      className={`px-grid-btn ${isHidden ? 'is-hidden' : ''}`}
                      onClick={() => onUpdateLayer(l.id, { visible: isHidden })}
                      title="Show/Hide"
                    >
                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      className="px-grid-btn is-del"
                      onClick={() => onDeleteLayer(l, layerTitle)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {layers.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 40 }}>
              কোনো লেয়ার পাওয়া যায়নি
            </div>
          )}
        </div>

        {!multiMode ? (
          <div className="layer-drawer-footer">
            <button
              className="footer-tool-btn"
              disabled={!selectedId}
              style={{ opacity: selectedId ? 1 : 0.4 }}
              onClick={() => handleMove('up')}
              title="উপরে তুলুন"
            >
              <ArrowUp size={16} />
            </button>

            <button
              className="footer-tool-btn"
              disabled={!selectedId}
              style={{ opacity: selectedId ? 1 : 0.4 }}
              onClick={() => handleMove('down')}
              title="নিচে নামান"
            >
              <ArrowDown size={16} />
            </button>

            <button
              className="footer-tool-btn"
              disabled={layers.length === 0}
              style={{ opacity: layers.length ? 1 : 0.4 }}
              onClick={() => {
                setMultiIds(selectedId ? [selectedId] : []);
                setMultiMode(true);
              }}
              title="একাধিক লেয়ার সিলেক্ট করুন"
            >
              <CheckSquare size={16} />
            </button>

            <button className="footer-tool-btn" onClick={onClose} title="বন্ধ করুন">
              <Check size={16} />
            </button>
          </div>
        ) : (
          <div className="layer-drawer-footer">
            <button
              className={`footer-tool-btn ${validMultiIds.length >= 2 ? 'active' : ''}`}
              style={{ opacity: validMultiIds.length >= 2 && !merging ? 1 : 0.4 }}
              disabled={validMultiIds.length < 2 || merging}
              onClick={handleRunMerge}
              title="সিলেক্ট করা লেয়ারগুলোকে ১টি লেয়ার বানান (Merge)"
            >
              <MergeLayersIcon size={16} />
            </button>

            <button
              className="footer-tool-btn"
              style={{
                opacity: validMultiIds.length ? 1 : 0.4,
                ...(allLocked
                  ? { color: '#fbbf24', borderColor: '#fbbf24', background: 'rgba(251, 191, 36, 0.16)' }
                  : {})
              }}
              disabled={!validMultiIds.length}
              onClick={() => onMultiLock(validMultiIds)}
              title={allLocked ? 'Unlock All' : 'Lock All'}
            >
              {allLocked ? <Lock size={15} /> : <Unlock size={15} />}
            </button>

            <button
              className="footer-tool-btn"
              style={{
                opacity: validMultiIds.length ? 1 : 0.4,
                ...(allHidden
                  ? { color: '#f43f5e', borderColor: '#f43f5e', background: 'rgba(244, 63, 94, 0.16)' }
                  : {})
              }}
              disabled={!validMultiIds.length}
              onClick={() => onMultiToggleVisible(validMultiIds)}
              title={allHidden ? 'Show All' : 'Hide All'}
            >
              {allHidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>

            <button
              className="footer-tool-btn"
              style={{ color: '#fda4af', opacity: validMultiIds.length ? 1 : 0.4 }}
              disabled={!validMultiIds.length}
              onClick={() => {
                onMultiDelete(validMultiIds, () => {
                  setMultiIds([]);
                  setMultiMode(false);
                });
              }}
              title="সিলেক্ট করাগুলো ডিলিট"
            >
              <Trash2 size={15} />
            </button>

            <button
              className="footer-tool-btn"
              onClick={() => {
                setMultiMode(false);
                setMultiIds([]);
              }}
              title="সিলেক্ট মোড বাতিল"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
