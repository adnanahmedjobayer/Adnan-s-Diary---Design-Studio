import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Download, Quote, Undo2, Redo2, Grid3X3,
  Layers, Edit3, Trash2, Magnet, MoreVertical,
  Type, Sticker, Shapes, Brush, ImagePlus,
  FileArchive, Image as ImageIcon, Maximize2, FolderOpen, CheckCircle2, Stamp,
  ZoomIn, Sparkles
} from 'lucide-react';

export default function TopBar({
  onAddText,
  onAddSticker,
  onOpenShapes,
  onStartDrawing,
  onAddGalleryPhoto,
  onOpenQuotes,
  onOpenCoach,
  coachIssueCount = 0,
  onExportAdp,
  onSaveImage,
  onFullscreenPreview,
  onOpenAdp,
  autoSaveEnabled,
  onToggleAutoSave,
  watermarkEnabled,
  onOpenWatermark,
  onEditSelected,
  onDeleteSelected,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  zoomMode,
  onToggleZoomMode,
  isZoomed,
  gridOn,
  setGridOn,
  magnetOn,
  setMagnetOn,
  layersCount,
  onToggleLayers,
  hasSelection,
  canEdit
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const actionsRef = useRef(null);

  const editEnabled = canEdit !== undefined ? canEdit : hasSelection;

  useEffect(() => {
    const closeOnOutside = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, []);

  const toggleMenu = (name) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  };

  const runAction = (fn) => {
    setOpenMenu(null);
    fn?.();
  };

  return (
    <header className="topbar-wrapper">
      <div className="topbar-row-1">
        <div className="brand-title">Aᴅɴꫝɴ's Dɪᴀʀʏ</div>

        <div className="top-actions" ref={actionsRef}>
          <button
            className="icon-btn"
            style={{ position: 'relative' }}
            title="স্মার্ট ডিজাইন গাইড (AI)"
            onClick={() => {
              setOpenMenu(null);
              onOpenCoach?.();
            }}
          >
            <Sparkles size={16} color={coachIssueCount > 0 ? '#fbbf24' : '#38bdf8'} />
            {coachIssueCount > 0 && <span className="coach-dot" />}
          </button>

          <div className="topbar-dropdown-wrap">
            <button
              className={`icon-btn ${openMenu === 'add' ? 'active' : ''}`}
              title="যোগ করুন"
              onClick={() => toggleMenu('add')}
            >
              <Plus size={17} />
            </button>

            {openMenu === 'add' && (
              <div className="topbar-dropdown-menu">
                <button className="dropdown-item" onClick={() => runAction(onAddText)}>
                  <Type size={15} /> <span>ফন্ট / টেক্সট</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onAddSticker)}>
                  <Sticker size={15} /> <span>স্টিকার</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onOpenShapes)}>
                  <Shapes size={15} /> <span>শেপ</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onStartDrawing)}>
                  <Brush size={15} /> <span>ড্রোয়িং</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onAddGalleryPhoto)}>
                  <ImagePlus size={15} /> <span>গ্যালারি থেকে ফটো</span>
                </button>
              </div>
            )}
          </div>

          <button
            className="icon-btn"
            title="থিম / কোটস"
            onClick={() => {
              setOpenMenu(null);
              onOpenQuotes();
            }}
          >
            <Quote size={16} />
          </button>

          <div className="topbar-dropdown-wrap">
            <button
              className={`icon-btn ${openMenu === 'save' ? 'active' : ''}`}
              title="সেভ করুন"
              onClick={() => toggleMenu('save')}
            >
              <Download size={16} />
            </button>

            {openMenu === 'save' && (
              <div className="topbar-dropdown-menu">
                <button className="dropdown-item" onClick={() => runAction(onExportAdp)}>
                  <FileArchive size={15} /> <span>Save as .adp</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onSaveImage)}>
                  <ImageIcon size={15} /> <span>Save as Image</span>
                </button>
              </div>
            )}
          </div>

          <div className="topbar-dropdown-wrap">
            <button
              className={`icon-btn ${openMenu === 'more' ? 'active' : ''}`}
              title="আরও অপশন"
              onClick={() => toggleMenu('more')}
            >
              <MoreVertical size={16} />
            </button>

            {openMenu === 'more' && (
              <div className="topbar-dropdown-menu">
                <button className="dropdown-item" onClick={() => runAction(onFullscreenPreview)}>
                  <Maximize2 size={15} /> <span>ফুল স্ক্রিন ভিউ</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onOpenAdp)}>
                  <FolderOpen size={15} /> <span>Open .adp</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onOpenWatermark)}>
                  <Stamp size={15} color={watermarkEnabled ? '#38bdf8' : '#94a3b8'} />
                  <span>ওয়াটারমার্ক: {watermarkEnabled ? 'চালু' : 'বন্ধ'}</span>
                </button>
                <button className="dropdown-item" onClick={() => runAction(onToggleAutoSave)}>
                  <CheckCircle2 size={15} color={autoSaveEnabled ? '#38bdf8' : '#64748b'} />
                  <span>অটো সেভ: {autoSaveEnabled ? 'চালু' : 'বন্ধ'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="topbar-row-2">
        <div className="edit-pill">
          <button
            className="btn-edit"
            onClick={onEditSelected}
            disabled={!editEnabled}
            style={{ opacity: editEnabled ? 1 : 0.45 }}
          >
            <Edit3 size={12} /> এডিট
          </button>
          <button
            className="btn-del"
            onClick={onDeleteSelected}
            disabled={!hasSelection}
            style={{ opacity: hasSelection ? 1 : 0.45 }}
          >
            <Trash2 size={13} />
          </button>
        </div>

        <div className="tool-pills">
          <button
            className="icon-btn"
            style={{ width: 26, height: 26, opacity: canUndo ? 1 : 0.4 }}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
          >
            <Undo2 size={13} />
          </button>

          <button
            className="icon-btn"
            style={{ width: 26, height: 26, opacity: canRedo ? 1 : 0.4 }}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
          >
            <Redo2 size={13} />
          </button>

          <button
            className={`icon-btn ${zoomMode || isZoomed ? 'active' : ''}`}
            style={{ width: 26, height: 26 }}
            onClick={onToggleZoomMode}
            title="জুম মোড (1x–100x)"
          >
            <ZoomIn size={13} />
          </button>

          <button
            className={`badge-btn ${magnetOn ? 'active' : ''}`}
            onClick={() => setMagnetOn(!magnetOn)}
            title="ম্যাগনেট স্ন্যাপ"
          >
            <Magnet size={12} />
          </button>

          <button
            className={`badge-btn ${gridOn ? 'active' : ''}`}
            onClick={() => setGridOn(!gridOn)}
            title="গ্রিড"
          >
            <Grid3X3 size={12} />
          </button>

          <button className="badge-btn" onClick={onToggleLayers}>
            <Layers size={12} /> {layersCount}
          </button>
        </div>
      </div>
    </header>
  );
}
