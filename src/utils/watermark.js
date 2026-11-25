const DB_NAME = 'adnans_watermark_db';
const STORE_NAME = 'config';
const WM_KEY = 'global-watermark';

export const DEFAULT_WATERMARK = {
  enabled: false,
  mode: 'text', // 'text' | 'image'
  text: "Adnan's Diary",
  font: 'sans-serif',
  color: '#ffffff',
  imageSrc: null,
  position: 'bottom-right',
  size: 22, // ক্যানভাস প্রস্থের %
  opacity: 45, // 10 - 100
  margin: 4 // %
};

function openWmDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadWatermarkConfig() {
  try {
    const db = await openWmDB();
    const saved = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(WM_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    return saved ? { ...DEFAULT_WATERMARK, ...saved } : { ...DEFAULT_WATERMARK };
  } catch {
    return { ...DEFAULT_WATERMARK };
  }
}

export async function saveWatermarkConfig(config) {
  const clean = { ...DEFAULT_WATERMARK, ...config, updatedAt: Date.now() };
  try {
    const db = await openWmDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(clean, WM_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Watermark save failed:', err);
  }
  return clean;
}

export async function drawWatermarkOnCanvas(ctx, wm, outW, outH) {
  if (!wm || !wm.enabled) return;
  if (wm.mode === 'text' && !(wm.text || '').trim()) return;
  if (wm.mode === 'image' && !wm.imageSrc) return;

  const alpha = Math.max(0.05, Math.min(1, (wm.opacity ?? 45) / 100));
  const sizePct = Math.max(6, Math.min(70, wm.size ?? 22));
  const marginPct = Math.max(1, Math.min(20, wm.margin ?? 4));
  const padX = outW * (marginPct / 100);
  const padY = outH * (marginPct / 100);
  const pos = wm.position || 'bottom-right';

  let loadedImg = null;
  let dw = 0;
  let dh = 0;

  if (wm.mode === 'image') {
    try {
      const img = new Image();
      if (!wm.imageSrc.startsWith('data:') && !wm.imageSrc.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      img.src = wm.imageSrc;
      await img.decode();
      loadedImg = img;
      dw = outW * (sizePct / 100);
      dh = dw * ((img.naturalHeight || 1) / (img.naturalWidth || 1));
    } catch {
      return;
    }
  }

  const fSize = Math.max(8, outW * (sizePct / 100) * 0.25);
  if (wm.mode === 'text') {
    if (wm.font && wm.font !== 'sans-serif') {
      try {
        await document.fonts.load(`700 ${fSize}px "${wm.font}"`);
      } catch {}
    }
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  if (pos === 'tile') {
    const cols = 3;
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = ((c + 0.5) / cols) * outW;
        const cy = ((r + 0.5) / rows) * outH;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((-26 * Math.PI) / 180);
        if (wm.mode === 'image' && loadedImg) {
          const tw = dw * 0.72;
          const th = dh * 0.72;
          ctx.drawImage(loadedImg, -tw / 2, -th / 2, tw, th);
        } else {
          ctx.font = `700 ${fSize * 0.85}px "${wm.font || 'sans-serif'}", sans-serif`;
          ctx.fillStyle = wm.color || '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.45)';
          ctx.shadowBlur = fSize * 0.16;
          ctx.fillText(wm.text, 0, 0);
        }
        ctx.restore();
      }
    }
    ctx.restore();
    return;
  }

  if (wm.mode === 'image' && loadedImg) {
    let dx = outW - padX - dw;
    let dy = outH - padY - dh;
    if (pos.includes('left')) dx = padX;
    else if (pos === 'top-center' || pos === 'bottom-center' || pos === 'center') dx = (outW - dw) / 2;

    if (pos.startsWith('top')) dy = padY;
    else if (pos === 'center') dy = (outH - dh) / 2;

    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = Math.max(2, outW * 0.004);
    ctx.drawImage(loadedImg, dx, dy, dw, dh);
    ctx.restore();
    return;
  }

  // টেক্সট ওয়াটারমার্ক ড্রয়িং
  ctx.font = `700 ${fSize}px "${wm.font || 'sans-serif'}", sans-serif`;
  ctx.fillStyle = wm.color || '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = fSize * 0.18;
  ctx.shadowOffsetY = fSize * 0.06;

  let tx = outW - padX;
  let ty = outH - padY;
  if (pos.includes('left')) {
    ctx.textAlign = 'left';
    tx = padX;
  } else if (pos === 'top-center' || pos === 'bottom-center' || pos === 'center') {
    ctx.textAlign = 'center';
    tx = outW / 2;
  } else {
    ctx.textAlign = 'right';
    tx = outW - padX;
  }

  if (pos.startsWith('top')) {
    ctx.textBaseline = 'top';
    ty = padY;
  } else if (pos === 'center') {
    ctx.textBaseline = 'middle';
    ty = outH / 2;
  } else {
    ctx.textBaseline = 'bottom';
    ty = outH - padY;
  }

  ctx.fillText(wm.text, tx, ty);
  ctx.restore();
}
