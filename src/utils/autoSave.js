const DB_NAME = 'adnans_diary_db';
const STORE_NAME = 'autosave';
const PROJECT_KEY = 'latest-project';

function openDB() {
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

async function blobUrlToDataUrl(src) {
  if (!src || !src.startsWith('blob:')) return src;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || src);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}

export async function saveAutoProject(
  bgConfig,
  layers,
  canvasSize = { width: 1080, height: 1080 }
) {
  try {
    const cleanBg = { ...bgConfig };
    if (cleanBg.imageSrc) {
      cleanBg.imageSrc = await blobUrlToDataUrl(cleanBg.imageSrc);
    }

    const cleanLayers = await Promise.all(
      layers.map(async (l) => {
        const copy = { ...l };
        const origSrc = copy.src;
        if (copy.src) {
          copy.src = await blobUrlToDataUrl(copy.src);
        }
        if (copy.rawSrc) {
          copy.rawSrc =
            copy.rawSrc === origSrc
              ? copy.src
              : await blobUrlToDataUrl(copy.rawSrc);
        }
        if (copy.textureSrc) {
          copy.textureSrc = await blobUrlToDataUrl(copy.textureSrc);
        }
        return copy;
      })
    );

    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(
        {
          bgConfig: cleanBg,
          layers: cleanLayers,
          canvasSize: {
            width: canvasSize?.width || 1080,
            height: canvasSize?.height || 1080
          },
          updatedAt: Date.now()
        },
        PROJECT_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Auto-save skipped:', err);
  }
}

export async function loadAutoProject() {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(PROJECT_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearAutoProject() {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}
