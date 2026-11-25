import JSZip from 'jszip';
import { getFontBinaryForAdp, registerSessionAdpFont } from './userLibrary';

function getExtFromMime(mime = '', fallback = 'png') {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('ttf')) return 'ttf';
  if (mime.includes('otf')) return 'otf';
  if (mime.includes('woff2')) return 'woff2';
  return fallback;
}

async function srcToBlob(src) {
  const res = await fetch(src);
  return await res.blob();
}

// বর্তমান ডিজাইন থেকে .adp (ZIP v2) Blob তৈরি
export async function createAdpBlob({
  title = 'My Theme',
  bgConfig,
  layers,
  canvasSize = { width: 1080, height: 1080 },
  thumbnailBlob
}) {
  const zip = new JSZip();
  const cleanBg = { ...bgConfig };
  const cleanLayers = JSON.parse(JSON.stringify(layers));
  const usedFonts = new Set();
  const fontAssets = [];

  // ১. ব্যাকগ্রাউন্ড ইমেজ থাকলে assets/backgrounds-এ প্যাক করা
  if (cleanBg.useImage && cleanBg.imageSrc) {
    try {
      const bgBlob = await srcToBlob(cleanBg.imageSrc);
      const ext = getExtFromMime(bgBlob.type, 'jpg');
      const assetPath = `assets/backgrounds/bg.${ext}`;
      zip.file(assetPath, bgBlob);
      cleanBg.imageAsset = assetPath;
      delete cleanBg.imageSrc;
    } catch (err) {
      console.warn('Background image pack skipped:', err);
    }
  }

  // ২. স্টিকার/ইমেজ (এবং rawSrc), টেক্সট টেক্সচার ও ফন্ট সংগ্রহ করা
  for (const layer of cleanLayers) {
    if (layer.type === 'image' || layer.type === 'sticker') {
      const origSrc = layer.src;
      const origRaw = layer.rawSrc;

      if (origSrc) {
        try {
          const stBlob = await srcToBlob(origSrc);
          const ext = getExtFromMime(stBlob.type, 'png');
          const assetPath = `assets/stickers/${layer.id}.${ext}`;
          zip.file(assetPath, stBlob);
          layer.srcAsset = assetPath;
          delete layer.src;
        } catch (err) {
          console.warn('Sticker pack skipped:', err);
        }
      }

      if (origRaw) {
        if (origRaw === origSrc) {
          delete layer.rawSrc;
        } else {
          try {
            const rawBlob = await srcToBlob(origRaw);
            const ext = getExtFromMime(rawBlob.type, 'png');
            const rawPath = `assets/stickers/${layer.id}_raw.${ext}`;
            zip.file(rawPath, rawBlob);
            layer.rawSrcAsset = rawPath;
            delete layer.rawSrc;
          } catch (err) {
            console.warn('Raw sticker pack skipped:', err);
          }
        }
      }
    }

    if (layer.type === 'text') {
      if (layer.textureSrc) {
        try {
          const texBlob = await srcToBlob(layer.textureSrc);
          const ext = getExtFromMime(texBlob.type, 'png');
          const assetPath = `assets/textures/${layer.id}.${ext}`;
          zip.file(assetPath, texBlob);
          layer.textureAsset = assetPath;
          delete layer.textureSrc;
        } catch (err) {
          console.warn('Texture pack skipped:', err);
        }
      }
      if (layer.font && layer.font !== 'sans-serif') {
        usedFonts.add(layer.font);
      }
    }
  }

  // ৩. ব্যবহৃত ফন্টগুলো assets/fonts-এ প্যাক করা
  let fontIdx = 0;
  for (const fontName of usedFonts) {
    try {
      const fontData = await getFontBinaryForAdp(fontName);
      if (fontData && fontData.buffer) {
        fontIdx += 1;
        const safeBase =
          fontName.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '') ||
          'font';
        const ext = fontData.ext || 'ttf';
        const assetPath = `assets/fonts/${safeBase}_${fontIdx}.${ext}`;
        zip.file(assetPath, fontData.buffer);
        fontAssets.push({ name: fontName, ext, asset: assetPath });
      }
    } catch (err) {
      console.warn('Font pack skipped:', fontName, err);
    }
  }

  // ৪. থাম্বনাইল প্যাক করা
  if (thumbnailBlob) {
    zip.file('thumbnail.png', thumbnailBlob);
  }

  // ৫. মূল প্রজেক্ট ডেটা (project.json)
  const projectData = {
    format: 'adp',
    version: 2,
    title,
    canvas: {
      width: canvasSize?.width || 1080,
      height: canvasSize?.height || 1080
    },
    bg: cleanBg,
    layers: cleanLayers,
    fontAssets
  };

  zip.file('project.json', JSON.stringify(projectData, null, 2));

  // মোবাইল ব্রাউজারে .zip হয়ে যাওয়া আটকাতে application/octet-stream ব্যবহার
  const buffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return new Blob([buffer], { type: 'application/octet-stream' });
}

// .adp ফাইলের ভেতর থেকে শুধু thumbnail ও title বের করা (কার্ডে দেখানোর জন্য)
export async function extractAdpPreview(fileOrBlob) {
  const zip = await JSZip.loadAsync(fileOrBlob);
  let title = null;
  let thumbnail = null;

  const projectFile = zip.file('project.json');
  if (projectFile) {
    try {
      const data = JSON.parse(await projectFile.async('string'));
      title = data.title || null;
    } catch {}
  }

  const thumbFile =
    zip.file('thumbnail.png') ||
    zip.file('thumbnail.jpg') ||
    zip.file('thumbnail.webp');

  if (thumbFile) {
    const blob = await thumbFile.async('blob');
    thumbnail = URL.createObjectURL(blob);
  }

  return { title, thumbnail };
}

// .adp (ZIP) ফাইল আনজিপ করে প্রজেক্ট ও ফন্ট রিস্টোর করা
export async function parseAdpFile(fileOrBlob) {
  const zip = await JSZip.loadAsync(fileOrBlob);
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    throw new Error('সঠিক .adp ফাইল নয় (project.json পাওয়া যায়নি)');
  }

  const projectData = JSON.parse(await projectFile.async('string'));
  const restoredBg = { ...(projectData.bg || {}) };

  // ১. ব্যাকগ্রাউন্ড ইমেজ রিস্টোর
  if (restoredBg.imageAsset) {
    const bgZipFile = zip.file(restoredBg.imageAsset);
    if (bgZipFile) {
      const blob = await bgZipFile.async('blob');
      restoredBg.imageSrc = URL.createObjectURL(blob);
    }
    delete restoredBg.imageAsset;
  }

  // ২. স্টিকার/ইমেজ (এবং rawSrc) ও টেক্সচার রিস্টোর
  const restoredLayers = await Promise.all(
    (projectData.layers || []).map(async (layer) => {
      const copy = { ...layer };
      if (copy.srcAsset) {
        const assetFile = zip.file(copy.srcAsset);
        if (assetFile) {
          const blob = await assetFile.async('blob');
          copy.src = URL.createObjectURL(blob);
        }
        delete copy.srcAsset;
      }
      if (copy.rawSrcAsset) {
        const rawFile = zip.file(copy.rawSrcAsset);
        if (rawFile) {
          const blob = await rawFile.async('blob');
          copy.rawSrc = URL.createObjectURL(blob);
        }
        delete copy.rawSrcAsset;
      }
      if (copy.textureAsset) {
        const texFile = zip.file(copy.textureAsset);
        if (texFile) {
          const blob = await texFile.async('blob');
          copy.textureSrc = URL.createObjectURL(blob);
        }
        delete copy.textureAsset;
      }
      return copy;
    })
  );

  // ৩. প্যাকেজের ভেতর থাকা ফন্ট সেশনে রেজিস্টার করা (v2 ও v1 উভয় সাপোর্ট)
  const loadedPaths = new Set();
  if (Array.isArray(projectData.fontAssets)) {
    for (const meta of projectData.fontAssets) {
      try {
        const fFile = zip.file(meta.asset);
        if (!fFile) continue;
        loadedPaths.add(meta.asset);
        const buffer = await fFile.async('arraybuffer');
        await registerSessionAdpFont(meta.name, meta.ext || 'ttf', buffer);
      } catch (err) {
        console.warn('v2 font load failed:', meta.name, err);
      }
    }
  }

  const fontEntries = Object.keys(zip.files).filter(
    (name) =>
      name.startsWith('assets/fonts/') &&
      !zip.files[name].dir &&
      !loadedPaths.has(name)
  );
  for (const fontPath of fontEntries) {
    try {
      const fileName = fontPath.split('/').pop();
      const ext = (fileName.split('.').pop() || 'ttf').toLowerCase();
      const fontName = fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/[_]+/g, ' ')
        .trim();
      const buffer = await zip.file(fontPath).async('arraybuffer');
      await registerSessionAdpFont(fontName, ext, buffer);
    } catch (err) {
      console.warn('Font load failed:', fontPath, err);
    }
  }

  return {
    title: projectData.title || 'Untitled Theme',
    canvasSize: projectData.canvas || { width: 1080, height: 1080 },
    bg: restoredBg,
    layers: restoredLayers
  };
}
