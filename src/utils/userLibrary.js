import { getLibraryFonts } from '../library/fonts/loadFonts';

const DB_NAME = 'adnans_user_library_db';
const DB_VERSION = 1;
const STORES = ['fonts', 'backgrounds', 'stickers'];

// মেমোরি ক্যাশ (যাতে .adp এক্সপোর্ট করার সময় ফন্টের বাইনারি সাথে সাথে পাওয়া যায়)
const sessionFontCache = new Map();

function openLibDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      STORES.forEach((s) => {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function cleanName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
}

export async function getUserAssets(storeName) {
  try {
    const db = await openLibDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteUserAsset(storeName, id, fontName = null) {
  try {
    const db = await openLibDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (storeName === 'fonts' && fontName) {
      sessionFontCache.delete(fontName);
    }
  } catch (err) {
    console.warn('Delete failed:', err);
  }
}

// ইউজারের আপলোড করা ব্যাকগ্রাউন্ড বা স্টিকার সেভ
export async function saveUserImageAsset(storeName, file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const item = {
    id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName(file.name),
    src: dataUrl,
    imageSrc: dataUrl,
    isUser: true,
    createdAt: Date.now()
  };

  const db = await openLibDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return item;
}

// ইউজারের ফোনের ফন্ট (.ttf/.otf/.woff2) সেভ ও রেজিস্টার
export async function saveUserFont(file) {
  const buffer = await file.arrayBuffer();
  const name = cleanName(file.name);
  const ext = (file.name.split('.').pop() || 'ttf').toLowerCase();

  const face = new FontFace(name, buffer.slice(0));
  await face.load();
  document.fonts.add(face);
  sessionFontCache.set(name, { name, ext, buffer: buffer.slice(0) });

  const item = {
    id: `uf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    ext,
    buffer,
    isUser: true,
    createdAt: Date.now()
  };

  const db = await openLibDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('fonts', 'readwrite');
    tx.objectStore('fonts').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return item;
}

// অ্যাপ চালু হলেই ইউজারের সেভ করা সব ফন্ট লোড করা
export async function registerAllUserFonts() {
  const list = await getUserAssets('fonts');
  for (const f of list) {
    try {
      if (!f.buffer) continue;
      const face = new FontFace(f.name, f.buffer.slice(0));
      await face.load();
      document.fonts.add(face);
      sessionFontCache.set(f.name, {
        name: f.name,
        ext: f.ext || 'ttf',
        buffer: f.buffer.slice(0)
      });
    } catch (err) {
      console.warn('User font load skipped:', f.name, err);
    }
  }
}

// অন্যের শেয়ার করা .adp ফাইল থেকে আসা ফন্ট সেশনে রেজিস্টার করা
export async function registerSessionAdpFont(name, ext, buffer) {
  const face = new FontFace(name, buffer.slice(0));
  await face.load();
  document.fonts.add(face);
  sessionFontCache.set(name, { name, ext, buffer: buffer.slice(0) });
}

// .adp প্যাক করার সময় ফন্টের বাইনারি খুঁজে আনা (User ফন্ট বা Default ফন্ট)
export async function getFontBinaryForAdp(fontName) {
  if (!fontName || fontName === 'sans-serif') return null;

  if (sessionFontCache.has(fontName)) {
    const meta = sessionFontCache.get(fontName);
    return {
      name: fontName,
      ext: meta.ext || 'ttf',
      buffer: meta.buffer
    };
  }

  const libFont = getLibraryFonts().find((f) => f.name === fontName);
  if (libFont && libFont.url) {
    try {
      const res = await fetch(libFont.url);
      const buffer = await res.arrayBuffer();
      const extMatch = libFont.url.match(/\.(ttf|otf|woff2|woff)(\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'ttf';
      sessionFontCache.set(fontName, { name: fontName, ext, buffer: buffer.slice(0) });
      return { name: fontName, ext, buffer };
    } catch (err) {
      console.warn('Library font fetch failed:', fontName, err);
    }
  }

  return null;
}
