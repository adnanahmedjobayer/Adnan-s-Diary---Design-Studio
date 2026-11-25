import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import TopBar from './components/TopBar';
import CanvasArea from './components/CanvasArea';
import MiddleStrip from './components/MiddleStrip';
import BottomNav from './components/BottomNav';
import LayerDrawer from './components/LayerDrawer';
import ExportModal from './components/ExportModal';
import FullscreenModal from './components/FullscreenModal';
import BgCropModal from './components/panels/BgCropModal';
import {
  getDefaultThemeList,
  loadDefaultAdpTheme,
  loadDefaultThemePreviews
} from './library/default-themes/loadThemes';
import { getLibraryFonts, registerLibraryFonts } from './library/fonts/loadFonts';
import { registerAllUserFonts } from './utils/userLibrary';
import { createAdpBlob, parseAdpFile } from './utils/adpHandler';
import { saveAutoProject, loadAutoProject, clearAutoProject } from './utils/autoSave';
import { registerCanvasSampler } from './utils/colorPalette';
import { analyzeDesign } from './utils/designCoach';
import {
  svgShapeToImage,
  drawSingleLayerToCtx,
  renderCanvasToElement,
  captureTransparentDesign
} from './utils/canvasExporter';
import {
  DEFAULT_WATERMARK,
  loadWatermarkConfig,
  saveWatermarkConfig
} from './utils/watermark';

const ShapeBuilderModal = lazy(() => import('./components/panels/ShapeBuilderModal'));
const WatermarkModal = lazy(() => import('./components/panels/WatermarkModal'));
const DesignCoachModal = lazy(() => import('./components/DesignCoachModal'));

const USER_SHAPES_KEY = 'adnans_user_custom_shapes_v1';
const uid = () => Math.random().toString(36).slice(2, 9);

const getDefaultFont = () => {
  const libFonts = getLibraryFonts();
  return libFonts[0]?.name || 'sans-serif';
};

const DEFAULT_CANVAS_SIZE = { width: 1080, height: 1080 };

const shallowObjEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
};

const cloneSnap = (bg, lys, cs) => ({
  bgConfig: { ...bg },
  layers: lys.map((l) =>
    l.customShape ? { ...l, customShape: { ...l.customShape } } : { ...l }
  ),
  canvasSize: { ...(cs || DEFAULT_CANVAS_SIZE) }
});

const snapsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (!shallowObjEqual(a.canvasSize, b.canvasSize)) return false;
  if (!shallowObjEqual(a.bgConfig, b.bgConfig)) return false;
  if (a.layers.length !== b.layers.length) return false;
  for (let i = 0; i < a.layers.length; i++) {
    const la = a.layers[i];
    const lb = b.layers[i];
    if (la === lb) continue;
    const keysA = Object.keys(la);
    const keysB = Object.keys(lb);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (k === 'customShape') {
        if (!shallowObjEqual(la.customShape, lb.customShape)) return false;
      } else if (la[k] !== lb[k]) {
        return false;
      }
    }
  }
  return true;
};

const INITIAL_BG = {
  id: 'default-bg',
  transparent: false,
  useImage: false,
  gradient: 'linear-gradient(135deg, #1e1b2e 0%, #2d1f3d 100%)',
  overlayGradient: 'radial-gradient(circle, rgba(0,0,0,0.15) 30%, rgba(10,10,18,0.82) 100%)',
  brightness: 100,
  contrast: 100
};

const INITIAL_LAYERS = [
  {
    id: 'l1',
    type: 'text',
    text: 'নতুন ডিজাইন শুরু করুন...',
    font: getDefaultFont(),
    fontSize: 22,
    color: '#f8fafc',
    x: 50,
    y: 50,
    width: null,
    shadow: true,
    z: 10
  }
];

export default function App() {
  const canvasRef = useRef(null);
  const galleryInputRef = useRef(null);
  const stickerInputRef = useRef(null);
  const adpInputRef = useRef(null);

  const [defaultThemes, setDefaultThemes] = useState(() => getDefaultThemeList());
  const [activeTab, setActiveTab] = useState(0);
  const [canvasSize, setCanvasSize] = useState(DEFAULT_CANVAS_SIZE);
  const [bgConfig, setBgConfig] = useState(INITIAL_BG);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [selectedId, setSelectedId] = useState('l1');
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [hasPendingHistory, setHasPendingHistory] = useState(false);
  const [gridOn, setGridOn] = useState(false);
  const [magnetOn, setMagnetOn] = useState(true);
  const [zoomMode, setZoomMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editModal, setEditModal] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [layersModal, setLayersModal] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [layerCropSrc, setLayerCropSrc] = useState(null);
  const [shapeBuilderOpen, setShapeBuilderOpen] = useState(false);
  const [userCustomShapes, setUserCustomShapes] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_SHAPES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [watermark, setWatermark] = useState(DEFAULT_WATERMARK);
  const [watermarkModalOpen, setWatermarkModalOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const [exportModal, setExportModal] = useState(false);
  const [exportName, setExportName] = useState('');
  const [exportFormat, setExportFormat] = useState('png');
  const [exportScale, setExportScale] = useState(1);
  const [exportQuality, setExportQuality] = useState(0.92);
  const [exporting, setExporting] = useState(false);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const savedPref = localStorage.getItem('adnans_autosave_pref');
    return savedPref === null ? true : savedPref === 'true';
  });
  const [autoSaveReady, setAutoSaveReady] = useState(false);
  const [hasAutoSavedWork, setHasAutoSavedWork] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [confirmThemeSwitch, setConfirmThemeSwitch] = useState(null);
  const [fullscreenView, setFullscreenView] = useState(false);

  const committedRef = useRef(cloneSnap(INITIAL_BG, INITIAL_LAYERS, DEFAULT_CANVAS_SIZE));
  const skipHistoryRef = useRef(false);
  const historyTimerRef = useRef(null);
  const latestStateRef = useRef({ bgConfig: INITIAL_BG, layers: INITIAL_LAYERS, canvasSize: DEFAULT_CANVAS_SIZE });

  const selectedLayer = layers.find((l) => l.id === selectedId) || null;
  const ratio = (canvasSize.width || 1080) / (canvasSize.height || 1080);
  const previewW = ratio >= 1 ? 330 : Math.max(140, Math.round(330 * ratio));
  const previewH = ratio >= 1 ? Math.max(140, Math.round(330 / ratio)) : 330;

  const coachIssueCount = useMemo(() => {
    try {
      return analyzeDesign({ bgConfig, layers }).issues.length;
    } catch {
      return 0;
    }
  }, [bgConfig, layers]);

  const isZoomed = zoom > 1 || pan.x !== 0 || pan.y !== 0;
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  useEffect(() => {
    registerLibraryFonts();
    registerAllUserFonts();
    loadWatermarkConfig().then(setWatermark);
    registerCanvasSampler(() => {
      const st = latestStateRef.current;
      const r = (st.canvasSize?.width || 1080) / (st.canvasSize?.height || 1080);
      const pw = r >= 1 ? 330 : Math.max(140, Math.round(330 * r));
      return renderCanvasToElement({
        canvasSize: st.canvasSize,
        bgConfig: st.bgConfig,
        layers: st.layers,
        liveWidth: canvasRef.current?.clientWidth || pw,
        maxThumbDim: 480
      });
    });
    return () => registerCanvasSampler(null);
  }, []);

  useEffect(() => {
    let active = true;
    const list = getDefaultThemeList();
    if (!list.length) return;
    loadDefaultThemePreviews(list).then((updated) => {
      if (active) setDefaultThemes(updated);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    loadAutoProject().then((saved) => {
      if (!mounted) return;
      if (saved && Array.isArray(saved.layers) && saved.bgConfig) {
        setRecoveryData(saved);
      } else {
        setAutoSaveReady(true);
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    latestStateRef.current = { bgConfig, layers, canvasSize };

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }

    const currentSnap = cloneSnap(bgConfig, layers, canvasSize);
    const prevSnap = committedRef.current;

    if (snapsEqual(currentSnap, prevSnap)) {
      setHasPendingHistory(false);
      return;
    }

    if (autoSaveEnabled) setHasAutoSavedWork(true);
    setHasPendingHistory(true);
    clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      setHistory((prev) => [...prev.slice(-30), prevSnap]);
      setFuture([]);
      committedRef.current = currentSnap;
      setHasPendingHistory(false);
    }, 300);

    return () => clearTimeout(historyTimerRef.current);
  }, [bgConfig, layers, canvasSize, autoSaveEnabled]);

  useEffect(() => {
    if (!autoSaveReady || !autoSaveEnabled) return;
    const timer = setTimeout(() => {
      saveAutoProject(bgConfig, layers, canvasSize);
    }, 400);
    return () => clearTimeout(timer);
  }, [bgConfig, layers, canvasSize, autoSaveReady, autoSaveEnabled]);

  useEffect(() => {
    const flushSave = () => {
      if (autoSaveReady && autoSaveEnabled) {
        saveAutoProject(
          latestStateRef.current.bgConfig,
          latestStateRef.current.layers,
          latestStateRef.current.canvasSize
        );
      }
    };
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [autoSaveReady, autoSaveEnabled]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    if (nextTab === 1) {
      if (!selectedLayer || selectedLayer.type !== 'text') {
        const lastText = [...layers].reverse().find((l) => l.type === 'text' && l.visible !== false && !l.locked);
        if (lastText) setSelectedId(lastText.id);
      }
    } else if (nextTab === 2) {
      const isObj = selectedLayer && (selectedLayer.type === 'shape' || selectedLayer.type === 'sticker' || selectedLayer.type === 'image');
      if (!isObj) {
        const lastObj = [...layers].reverse().find(
          (l) => (l.type === 'shape' || l.type === 'sticker' || l.type === 'image') && l.visible !== false && !l.locked
        );
        if (lastObj) setSelectedId(lastObj.id);
      }
    }
  };

  const handleSelectLayer = (id) => {
    setSelectedId(id);
    if (!id || activeTab === 4) return;
    const target = layers.find((l) => l.id === id);
    if (!target) return;
    if (target.type === 'text') setActiveTab(1);
    else if (target.type === 'shape' || target.type === 'sticker' || target.type === 'image') setActiveTab(2);
  };

  const handleOpenLayerCrop = async () => {
    if (!selectedLayer) return;
    if (selectedLayer.type === 'image' || selectedLayer.type === 'sticker') {
      if (!selectedLayer.src) return;
      setLayerCropSrc({ id: selectedLayer.id, src: selectedLayer.src, wasShape: false });
    } else if (selectedLayer.type === 'shape') {
      try {
        const img = await svgShapeToImage(
          selectedLayer.shapeId,
          selectedLayer.color,
          selectedLayer.strokeEnabled ? (selectedLayer.strokeColor || '#ffffff') : null,
          selectedLayer.strokeEnabled ? (selectedLayer.strokeWidth ?? 2) : 0,
          selectedLayer.customShape
        );
        const w = 600;
        const aspect = (selectedLayer.height || selectedLayer.width || 110) / (selectedLayer.width || 110);
        const h = Math.max(100, Math.round(w * aspect));
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        off.getContext('2d').drawImage(img, 0, 0, w, h);
        setLayerCropSrc({ id: selectedLayer.id, src: off.toDataURL('image/png'), wasShape: true });
      } catch {
        alert('শেপটি ক্রপ করার জন্য প্রস্তুত করা যায়নি');
      }
    }
  };

  const requestConfirm = (opts) => setConfirmDialog(opts);

  const requestDelete = (message, onConfirm) => {
    setConfirmDialog({
      title: 'ডিলিট কনফার্মেশন',
      message,
      confirmLabel: 'হ্যাঁ, ডিলিট করুন',
      confirmColor: '#e11d48',
      onConfirm
    });
  };

  const handleMergeLayers = (ids) => {
    const idSet = new Set(ids);
    const targetLayers = layers.filter((l) => idSet.has(l.id));
    if (targetLayers.length < 2) return Promise.resolve(false);

    return new Promise((resolve) => {
      requestConfirm({
        title: 'লেয়ার মার্জ (Merge)',
        message: `সিলেক্ট করা ${targetLayers.length}টি লেয়ারকে কি একসাথে একটি লেয়ারে পরিণত করতে চান?`,
        confirmLabel: 'হ্যাঁ, মার্জ করুন',
        confirmColor: '#0284c7',
        onCancel: () => resolve(false),
        onConfirm: async () => {
          try {
            const cw = canvasSize.width || 1080;
            const ch = canvasSize.height || 1080;
            const liveW = canvasRef.current?.clientWidth || previewW;
            const scale = cw / liveW;

            const off = document.createElement('canvas');
            off.width = cw;
            off.height = ch;
            const ctx = off.getContext('2d');

            for (const l of targetLayers) {
              await drawSingleLayerToCtx(ctx, l, cw, ch, scale);
            }

            const mergedUrl = off.toDataURL('image/png');
            let lastSelectedIdx = 0;
            layers.forEach((l, idx) => {
              if (idSet.has(l.id)) lastSelectedIdx = idx;
            });

            const insertAt = layers
              .slice(0, lastSelectedIdx + 1)
              .filter((l) => !idSet.has(l.id)).length;

            const mergedLayer = {
              id: uid(),
              type: 'image',
              label: `Merged (${targetLayers.length})`,
              src: mergedUrl,
              x: 50,
              y: 50,
              width: liveW,
              opacity: 1,
              z: lastSelectedIdx + 10
            };

            const remaining = layers.filter((l) => !idSet.has(l.id));
            remaining.splice(insertAt, 0, mergedLayer);
            setLayers(remaining);
            setSelectedId(mergedLayer.id);
            resolve(true);
          } catch (err) {
            alert('মার্জ করতে সমস্যা হয়েছে: ' + (err?.message || ''));
            resolve(false);
          }
        }
      });
    });
  };

  const handleMultiDelete = (ids, onDone) => {
    const idSet = new Set(ids);
    if (!idSet.size) return;
    requestDelete(`সিলেক্ট করা ${idSet.size}টি লেয়ার কি ডিলিট করতে চান?`, () => {
      setLayers((prev) => prev.filter((l) => !idSet.has(l.id)));
      if (idSet.has(selectedId)) setSelectedId(null);
      onDone?.();
    });
  };

  const handleMultiLock = (ids) => {
    const idSet = new Set(ids);
    setLayers((prev) => {
      const targets = prev.filter((l) => idSet.has(l.id));
      const allLocked = targets.length > 0 && targets.every((l) => l.locked);
      return prev.map((l) => (idSet.has(l.id) ? { ...l, locked: !allLocked } : l));
    });
  };

  const handleMultiToggleVisible = (ids) => {
    const idSet = new Set(ids);
    setLayers((prev) => {
      const targets = prev.filter((l) => idSet.has(l.id));
      const anyVisible = targets.some((l) => l.visible !== false);
      return prev.map((l) => (idSet.has(l.id) ? { ...l, visible: !anyVisible } : l));
    });
  };

  const handleAcceptRecovery = () => {
    if (!recoveryData) return;
    clearTimeout(historyTimerRef.current);
    skipHistoryRef.current = true;
    const snap = cloneSnap(recoveryData.bgConfig, recoveryData.layers, recoveryData.canvasSize);
    committedRef.current = snap;
    setBgConfig(snap.bgConfig);
    setLayers(snap.layers);
    setCanvasSize(snap.canvasSize);
    const first = snap.layers.find((l) => l.type === 'text') || snap.layers[0];
    setSelectedId(first ? first.id : null);
    setHistory([]);
    setFuture([]);
    setHasPendingHistory(false);
    setHasAutoSavedWork(true);
    setRecoveryData(null);
    setAutoSaveReady(true);
  };

  const handleDeclineRecovery = () => {
    clearAutoProject();
    setHasAutoSavedWork(false);
    setRecoveryData(null);
    setAutoSaveReady(true);
  };

  const handleToggleAutoSave = () => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    localStorage.setItem('adnans_autosave_pref', String(next));
    if (!next) {
      clearAutoProject();
      setHasAutoSavedWork(false);
    }
  };

  const handleUndo = () => {
    clearTimeout(historyTimerRef.current);
    const currentSnap = cloneSnap(bgConfig, layers, canvasSize);

    if (!snapsEqual(currentSnap, committedRef.current)) {
      const target = cloneSnap(
        committedRef.current.bgConfig,
        committedRef.current.layers,
        committedRef.current.canvasSize
      );
      skipHistoryRef.current = true;
      setFuture((prev) => [...prev.slice(-30), currentSnap]);
      setLayers(target.layers);
      setBgConfig(target.bgConfig);
      setCanvasSize(target.canvasSize);
      setHasPendingHistory(false);
      return;
    }

    if (!history.length) return;
    const last = cloneSnap(
      history[history.length - 1].bgConfig,
      history[history.length - 1].layers,
      history[history.length - 1].canvasSize
    );
    skipHistoryRef.current = true;
    committedRef.current = last;
    setFuture((prev) => [...prev.slice(-30), currentSnap]);
    setLayers(last.layers);
    setBgConfig(last.bgConfig);
    setCanvasSize(last.canvasSize);
    setHistory((prev) => prev.slice(0, -1));
    setHasPendingHistory(false);
  };

  const handleRedo = () => {
    if (!future.length) return;
    clearTimeout(historyTimerRef.current);
    const currentSnap = cloneSnap(bgConfig, layers, canvasSize);
    const next = cloneSnap(
      future[future.length - 1].bgConfig,
      future[future.length - 1].layers,
      future[future.length - 1].canvasSize
    );
    skipHistoryRef.current = true;
    committedRef.current = next;
    setHistory((prev) => [...prev.slice(-30), currentSnap]);
    setLayers(next.layers);
    setBgConfig(next.bgConfig);
    setCanvasSize(next.canvasSize);
    setFuture((prev) => prev.slice(0, -1));
    setHasPendingHistory(false);
  };

  const updateLayer = (id, patch) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleCopyLayer = (id) => {
    const target = layers.find((l) => l.id === id);
    if (!target) return;
    const copy = {
      ...target,
      ...(target.customShape ? { customShape: { ...target.customShape } } : {}),
      id: uid(),
      x: Math.min(92, target.x + 5),
      y: Math.min(92, target.y + 5)
    };
    setLayers((prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const handleMoveLayer = (id, direction) => {
    const idx = layers.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const copy = [...layers];
    const [item] = copy.splice(idx, 1);
    if (direction === 'front') copy.push(item);
    else copy.unshift(item);
    setLayers(copy);
  };

  const executeApplyTheme = async (theme) => {
    try {
      const loaded = await loadDefaultAdpTheme(theme.adpUrl);
      setBgConfig({ ...loaded.bg });
      if (loaded.canvasSize) setCanvasSize(loaded.canvasSize);
      const cloned = loaded.layers.map((l) => ({ ...l, id: uid() }));
      setLayers(cloned);
      const txt = cloned.find((l) => l.type === 'text');
      setSelectedId(txt ? txt.id : cloned[0]?.id || null);
      if (autoSaveEnabled) setHasAutoSavedWork(true);
    } catch (err) {
      alert('থিম লোড করতে সমস্যা হয়েছে: ' + err.message);
    }
  };

  const executeImportAdp = async (buffer) => {
    try {
      const loaded = await parseAdpFile(buffer);
      setBgConfig({ ...loaded.bg });
      if (loaded.canvasSize) setCanvasSize(loaded.canvasSize);
      const cloned = loaded.layers.map((l) => ({ ...l, id: uid() }));
      setLayers(cloned);
      const txt = cloned.find((l) => l.type === 'text');
      setSelectedId(txt ? txt.id : cloned[0]?.id || null);
      if (autoSaveEnabled) setHasAutoSavedWork(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApplyTheme = async (theme) => {
    if (autoSaveEnabled && hasAutoSavedWork) {
      setConfirmThemeSwitch({ type: 'defaultTheme', theme });
      return;
    }
    await executeApplyTheme(theme);
  };

  const handleImportAdp = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      if (autoSaveEnabled && hasAutoSavedWork) {
        setConfirmThemeSwitch({ type: 'adpBuffer', buffer, name: file.name });
      } else {
        await executeImportAdp(buffer);
      }
    } finally {
      e.target.value = '';
    }
  };

  const runConfirmedSwitch = async (saveFirst = false) => {
    if (!confirmThemeSwitch) return;
    if (saveFirst) {
      const exported = await handleExportAdp();
      if (!exported) return;
    }
    const pending = confirmThemeSwitch;
    setConfirmThemeSwitch(null);
    if (pending.type === 'defaultTheme') {
      await executeApplyTheme(pending.theme);
    } else if (pending.type === 'adpBuffer') {
      await executeImportAdp(pending.buffer);
    }
  };

  const handleAddText = () => {
    const newLayer = {
      id: uid(),
      type: 'text',
      text: 'নতুন বাংলা লেখা...',
      font: getDefaultFont(),
      fontSize: 22,
      color: '#f8fafc',
      x: 50,
      y: 50,
      width: null,
      shadow: true,
      z: layers.length + 10
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    setActiveTab(1);
  };

  const handleAddShape = (shapeId) => {
    const newShape = {
      id: uid(),
      type: 'shape',
      shapeId,
      x: 50,
      y: 50,
      width: 110,
      height: 110,
      color: '#fda4af',
      opacity: 0.85,
      z: layers.length + 5
    };
    setLayers((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);
    setActiveTab(2);
  };

  const handleAddCustomShape = ({ customShape, color, label }) => {
    const newShape = {
      id: uid(),
      type: 'shape',
      shapeId: 'custom',
      label: label || 'Custom Shape',
      customShape,
      x: 50,
      y: 50,
      width: 120,
      height: 120,
      color: color || '#fda4af',
      opacity: 0.92,
      z: layers.length + 5
    };
    setLayers((prev) => [...prev, newShape]);
    setSelectedId(newShape.id);
    setActiveTab(2);
    setShapeBuilderOpen(false);
  };

  const handleSaveAndAddCustomShape = ({ customShape, color, label }) => {
    const item = {
      id: `ucs-${Date.now()}`,
      label: label || 'Custom Shape',
      color: color || '#fda4af',
      customShape
    };
    const next = [item, ...userCustomShapes];
    setUserCustomShapes(next);
    try {
      localStorage.setItem(USER_SHAPES_KEY, JSON.stringify(next));
    } catch {}
    handleAddCustomShape({ customShape, color, label });
  };

  const handleDeleteCustomShape = (sh) => {
    requestDelete(`"${sh.label}" শেপটি কি ডিলিট করতে চান?`, () => {
      const next = userCustomShapes.filter((x) => x.id !== sh.id);
      setUserCustomShapes(next);
      try {
        localStorage.setItem(USER_SHAPES_KEY, JSON.stringify(next));
      } catch {}
    });
  };

  const handleAddStickerUrl = (src, name = 'Sticker') => {
    const st = {
      id: uid(),
      type: 'sticker',
      label: name,
      src,
      x: 50,
      y: 50,
      width: 120,
      opacity: 1,
      z: layers.length + 10
    };
    setLayers((prev) => [...prev, st]);
    setSelectedId(st.id);
    setActiveTab(2);
  };

  const handleAddMediaLayer = (e, mediaType = 'image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const newLayer = {
        id: uid(),
        type: mediaType,
        label: mediaType === 'sticker' ? 'Sticker' : 'Photo Layer',
        src: reader.result,
        x: 50,
        y: 50,
        width: mediaType === 'sticker' ? 120 : 180,
        opacity: 1,
        z: layers.length + 10
      };
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newLayer.id);
      setActiveTab(2);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFinishDrawing = ({ src, x, y, width }) => {
    const newLayer = {
      id: uid(),
      type: 'image',
      label: 'Drawing',
      src,
      x,
      y,
      width,
      opacity: 1,
      z: layers.length + 10
    };
    setLayers((prev) => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    setActiveTab(2);
    setDrawMode(false);
  };

  const handleDeleteSelected = () => {
    if (!selectedLayer) return;
    requestDelete('সিলেক্ট করা লেয়ারটি কি ডিলিট করতে চান?', () => {
      setLayers((prev) => prev.filter((l) => l.id !== selectedLayer.id));
      setSelectedId(null);
    });
  };

  const handleOpenEdit = (layer = selectedLayer) => {
    if (!layer || layer.type !== 'text') return;
    setSelectedId(layer.id);
    setEditValue(layer.text);
    setEditModal(true);
  };

  const handleSaveEdit = () => {
    if (selectedId) {
      updateLayer(selectedId, { text: editValue });
    }
    setEditModal(false);
  };

  const handleUploadBg = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setBgConfig({
        ...bgConfig,
        transparent: false,
        useImage: true,
        imageSrc: reader.result,
        imageOpacity: 1
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpenSaveModal = () => {
    setExportName(`Adnans-Diary-${Date.now()}`);
    setExportFormat('png');
    setExportScale(1);
    setExportQuality(0.92);
    setExportModal(true);
  };

  const handleConfirmSaveImage = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const isJpg = exportFormat === 'jpg';
      const canvas = await renderCanvasToElement({
        canvasSize,
        bgConfig,
        layers,
        liveWidth: canvasRef.current?.clientWidth || previewW,
        exportOpts: { scaleMult: exportScale, fillTransparentForJpg: isJpg },
        watermark
      });
      const mime = isJpg ? 'image/jpeg' : 'image/png';
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, mime, isJpg ? exportQuality : undefined)
      );
      if (!blob) throw new Error('ছবি তৈরি করা যায়নি');

      const safeName = (exportName || `Adnans-Diary-${Date.now()}`)
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${safeName}.${isJpg ? 'jpg' : 'png'}`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setExportModal(false);
    } catch (err) {
      alert('ছবি সেভ করতে সমস্যা হয়েছে: ' + (err?.message || ''));
    } finally {
      setExporting(false);
    }
  };

  const handleExportAdp = async () => {
    const rawName = window.prompt('থিমের নাম লিখুন (যেমন: nirob-obhiman):', `theme-${Date.now()}`);
    if (!rawName) return false;
    const safeName = rawName.trim().replace(/\s+/g, '-').toLowerCase();

    const thumbCanvas = await renderCanvasToElement({
      canvasSize,
      bgConfig,
      layers,
      liveWidth: canvasRef.current?.clientWidth || previewW,
      maxThumbDim: 330
    });
    const thumbBlob = await new Promise((resolve) => thumbCanvas.toBlob(resolve, 'image/png'));
    const adpBlob = await createAdpBlob({
      title: rawName.trim(),
      bgConfig,
      layers,
      canvasSize,
      thumbnailBlob: thumbBlob
    });

    const adpUrl = URL.createObjectURL(adpBlob);
    const adpLink = document.createElement('a');
    adpLink.download = `${safeName}.adp`;
    adpLink.href = adpUrl;
    adpLink.click();
    setTimeout(() => URL.revokeObjectURL(adpUrl), 1000);
    return true;
  };

  const handleSaveWatermark = async (nextConfig) => {
    const saved = await saveWatermarkConfig(nextConfig);
    setWatermark(saved);
    setWatermarkModalOpen(false);
  };

  const handleCaptureCanvasDesign = () =>
    captureTransparentDesign({
      canvasSize,
      layers,
      liveWidth: canvasRef.current?.clientWidth || previewW
    });

  return (
    <div className="app-container">
      <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={(e) => handleAddMediaLayer(e, 'image')} />
      <input ref={stickerInputRef} type="file" accept="image/*" hidden onChange={(e) => handleAddMediaLayer(e, 'sticker')} />
      <input ref={adpInputRef} type="file" accept=".adp,.zip" hidden onChange={handleImportAdp} />

      <TopBar
        onAddText={handleAddText}
        onAddSticker={() => setActiveTab(2)}
        onOpenShapes={() => setActiveTab(2)}
        onStartDrawing={() => {
          setZoomMode(false);
          setDrawMode(true);
        }}
        onAddGalleryPhoto={() => galleryInputRef.current?.click()}
        onOpenQuotes={() => setActiveTab(0)}
        onOpenCoach={() => setCoachOpen(true)}
        coachIssueCount={coachIssueCount}
        onExportAdp={handleExportAdp}
        onSaveImage={handleOpenSaveModal}
        onFullscreenPreview={() => setFullscreenView(true)}
        onOpenAdp={() => adpInputRef.current?.click()}
        autoSaveEnabled={autoSaveEnabled}
        onToggleAutoSave={handleToggleAutoSave}
        watermarkEnabled={watermark.enabled}
        onOpenWatermark={() => setWatermarkModalOpen(true)}
        onEditSelected={() => handleOpenEdit()}
        onDeleteSelected={handleDeleteSelected}
        onUndo={handleUndo}
        canUndo={history.length > 0 || hasPendingHistory}
        onRedo={handleRedo}
        canRedo={future.length > 0}
        zoomMode={zoomMode}
        onToggleZoomMode={() => setZoomMode((z) => !z)}
        isZoomed={isZoomed}
        onResetZoom={handleResetZoom}
        gridOn={gridOn}
        setGridOn={setGridOn}
        magnetOn={magnetOn}
        setMagnetOn={setMagnetOn}
        layersCount={layers.length}
        onToggleLayers={() => setLayersModal(true)}
        hasSelection={!!selectedLayer}
        canEdit={selectedLayer?.type === 'text'}
      />

      <CanvasArea
        canvasRef={canvasRef}
        canvasSize={canvasSize}
        bgConfig={bgConfig}
        layers={layers}
        selectedId={selectedId}
        setSelectedId={handleSelectLayer}
        updateLayer={updateLayer}
        onDoubleClickText={handleOpenEdit}
        gridOn={gridOn}
        magnetOn={magnetOn}
        drawMode={drawMode}
        onFinishDrawing={handleFinishDrawing}
        onCancelDrawing={() => setDrawMode(false)}
        watermark={watermark}
        zoomMode={zoomMode}
        onExitZoomMode={() => setZoomMode(false)}
        zoom={zoom}
        setZoom={setZoom}
        pan={pan}
        setPan={setPan}
      />

      <MiddleStrip
        activeTab={activeTab}
        themes={defaultThemes}
        onApplyTheme={handleApplyTheme}
        selectedLayer={selectedLayer}
        updateLayer={updateLayer}
        onAddShape={handleAddShape}
        onAddCustomShape={handleAddCustomShape}
        onOpenShapeBuilder={() => setShapeBuilderOpen(true)}
        userCustomShapes={userCustomShapes}
        onDeleteCustomShape={handleDeleteCustomShape}
        onAddText={handleAddText}
        onCopyLayer={handleCopyLayer}
        onMoveLayer={handleMoveLayer}
        onDeleteSelected={handleDeleteSelected}
        onOpenLayerCrop={handleOpenLayerCrop}
        onAddStickerUrl={handleAddStickerUrl}
        onUploadStickerClick={() => stickerInputRef.current?.click()}
        bgConfig={bgConfig}
        setBgConfig={setBgConfig}
        canvasSize={canvasSize}
        setCanvasSize={setCanvasSize}
        onOpenCropModal={() => setCropModalOpen(true)}
        onRequestDelete={requestDelete}
        onUploadBg={handleUploadBg}
      />

      <BottomNav activeTab={activeTab} setActiveTab={handleTabChange} />

      {shapeBuilderOpen && (
        <Suspense fallback={null}>
          <ShapeBuilderModal
            onClose={() => setShapeBuilderOpen(false)}
            onAddToCanvas={handleAddCustomShape}
            onSaveAndAdd={handleSaveAndAddCustomShape}
          />
        </Suspense>
      )}

      {watermarkModalOpen && (
        <Suspense fallback={null}>
          <WatermarkModal
            config={watermark}
            onClose={() => setWatermarkModalOpen(false)}
            onSave={handleSaveWatermark}
            onCaptureCanvasDesign={handleCaptureCanvasDesign}
          />
        </Suspense>
      )}

      {coachOpen && (
        <Suspense fallback={null}>
          <DesignCoachModal
            open={coachOpen}
            onClose={() => setCoachOpen(false)}
            bgConfig={bgConfig}
            layers={layers}
            canvasSize={canvasSize}
            selectedId={selectedId}
            onUpdateLayers={setLayers}
            onUpdateBg={setBgConfig}
          />
        </Suspense>
      )}

      <ExportModal
        open={exportModal}
        onClose={() => setExportModal(false)}
        canvasSize={canvasSize}
        exportName={exportName}
        setExportName={setExportName}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        exportScale={exportScale}
        setExportScale={setExportScale}
        exportQuality={exportQuality}
        setExportQuality={setExportQuality}
        exporting={exporting}
        bgTransparent={!!bgConfig.transparent}
        onConfirm={handleConfirmSaveImage}
      />

      {cropModalOpen && bgConfig.imageSrc && (
        <BgCropModal
          imageSrc={bgConfig.imageSrc}
          canvasSize={canvasSize}
          onCancel={() => setCropModalOpen(false)}
          onApply={(croppedSrc, nextSize) => {
            setBgConfig({ ...bgConfig, useImage: true, transparent: false, imageSrc: croppedSrc });
            if (nextSize) setCanvasSize(nextSize);
            setCropModalOpen(false);
          }}
        />
      )}

      {layerCropSrc && (
        <BgCropModal
          imageSrc={layerCropSrc.src}
          onCancel={() => setLayerCropSrc(null)}
          onApply={(croppedSrc) => {
            const target = layers.find((l) => l.id === layerCropSrc.id);
            if (target) {
              const patch = {
                src: croppedSrc,
                rawSrc: croppedSrc,
                eraseColorEnabled: false
              };
              if (layerCropSrc.wasShape) {
                patch.type = 'image';
                patch.label = 'Cropped Shape';
                patch.strokeEnabled = false;
                patch.customShape = null;
              }
              updateLayer(target.id, patch);
            }
            setLayerCropSrc(null);
          }}
        />
      )}

      {confirmDialog && (
        <div
          className="modal-backdrop"
          onClick={() => {
            confirmDialog.onCancel?.();
            setConfirmDialog(null);
          }}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4 style={{ marginBottom: 6, color: confirmDialog.confirmColor === '#e11d48' ? '#fda4af' : '#38bdf8' }}>
              {confirmDialog.title || 'নিশ্চিত করুন'}
            </h4>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 14 }}>
              {confirmDialog.message}
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  confirmDialog.onCancel?.();
                  setConfirmDialog(null);
                }}
              >
                না, থাক
              </button>
              <button
                className="btn-primary"
                style={{ background: confirmDialog.confirmColor || '#0284c7' }}
                onClick={async () => {
                  const fn = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  await fn?.();
                }}
              >
                {confirmDialog.confirmLabel || 'হ্যাঁ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {recoveryData && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h4 style={{ marginBottom: 6 }}>অটো-সেভ করা প্রজেক্ট পাওয়া গেছে</h4>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 14 }}>
              আপনার আগের অসম্পূর্ণ প্রজেক্টটি অটো-সেভে সংরক্ষিত আছে। আপনি কি সেটি আবার চালু করে কাজ চালিয়ে যেতে চান?
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleDeclineRecovery}>না, নতুন শুরু</button>
              <button className="btn-primary" style={{ background: '#0284c7' }} onClick={handleAcceptRecovery}>ওকে (চালু করুন)</button>
            </div>
          </div>
        </div>
      )}

      {confirmThemeSwitch && (
        <div className="modal-backdrop" onClick={() => setConfirmThemeSwitch(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4 style={{ marginBottom: 6 }}>চলমান প্রজেক্ট অটো-সেভে আছে!</h4>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 14 }}>
              নতুন থিম চালু করলে বর্তমান ডিজাইনটি পরিবর্তিত হয়ে যাবে। আপনি কি নতুন থিম চালু করতে নিশ্চিত?
            </p>
            <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
              <button className="btn-secondary" onClick={() => setConfirmThemeSwitch(null)}>বাতিল</button>
              <button className="btn-secondary" style={{ borderColor: '#38bdf8', color: '#38bdf8' }} onClick={() => runConfirmedSwitch(true)}>
                .adp সেভ করে চালু
              </button>
              <button className="btn-primary" style={{ background: '#0284c7' }} onClick={() => runConfirmedSwitch(false)}>
                নতুন থিম চালু
              </button>
            </div>
          </div>
        </div>
      )}

      <FullscreenModal
        open={fullscreenView}
        onClose={() => setFullscreenView(false)}
        boxW={canvasRef.current?.clientWidth || previewW}
        boxH={canvasRef.current?.clientHeight || previewH}
        bgConfig={bgConfig}
        layers={layers}
        watermark={watermark}
      />

      {editModal && (
        <div className="modal-backdrop" onClick={() => setEditModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h4>বাংলা লেখা এডিট করুন</h4>
            <textarea rows={4} className="modal-textarea" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setEditModal(false)}>বাতিল</button>
              <button className="btn-primary" onClick={handleSaveEdit}>সেভ করুন</button>
            </div>
          </div>
        </div>
      )}

      <LayerDrawer
        open={layersModal}
        onClose={() => setLayersModal(false)}
        layers={layers}
        selectedId={selectedId}
        onSelectLayer={handleSelectLayer}
        onUpdateLayer={updateLayer}
        onEditText={handleOpenEdit}
        onDeleteLayer={(l, title) =>
          requestDelete(`"${title.slice(0, 25)}" লেয়ারটি কি ডিলিট করতে চান?`, () => {
            setLayers((prev) => prev.filter((item) => item.id !== l.id));
            if (selectedId === l.id) setSelectedId(null);
          })
        }
        onReorderLayers={setLayers}
        onMergeLayers={handleMergeLayers}
        onMultiDelete={handleMultiDelete}
        onMultiLock={handleMultiLock}
        onMultiToggleVisible={handleMultiToggleVisible}
      />
    </div>
  );
}
