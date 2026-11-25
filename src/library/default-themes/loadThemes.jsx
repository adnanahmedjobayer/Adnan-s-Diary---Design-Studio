import { extractAdpPreview, parseAdpFile } from '../../utils/adpHandler';

const themeFiles = import.meta.glob('./**/*.{adp,png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default'
});

export function getDefaultThemeList() {
  const map = {};

  for (const [path, url] of Object.entries(themeFiles)) {
    const parts = path.split('/');

    // ১. সরাসরি default-themes/theme.adp রাখা হলে
    if (parts.length === 2) {
      const fileName = parts[1];
      if (fileName.toLowerCase().endsWith('.adp')) {
        const id = fileName.replace(/\.adp$/i, '');
        map[`file:${id}`] = {
          id,
          title: id.replace(/[-_]/g, ' '),
          adpUrl: url,
          thumbnail: null
        };
      }
      continue;
    }

    // ২. সাবফোল্ডার default-themes/name/theme.adp রাখা হলে
    if (parts.length === 3) {
      const folder = parts[1];
      const fileName = parts[2].toLowerCase();
      const key = `dir:${folder}`;

      if (!map[key]) {
        map[key] = {
          id: folder,
          title: folder.replace(/[-_]/g, ' '),
          thumbnail: null
        };
      }

      if (/\.(png|jpe?g|webp)$/.test(fileName)) {
        map[key].thumbnail = url;
      } else if (fileName.endsWith('.adp')) {
        map[key].adpUrl = url;
      }
    }
  }

  return Object.values(map).filter((item) => item.adpUrl);
}

// প্রতিটি .adp ফাইলের ভেতর থেকে thumbnail ও title বের করে আনা
export async function loadDefaultThemePreviews(list) {
  return await Promise.all(
    list.map(async (item) => {
      if (item.thumbnail) return item;
      try {
        const res = await fetch(item.adpUrl);
        if (!res.ok) return item;
        const blob = await res.blob();
        const preview = await extractAdpPreview(blob);
        return {
          ...item,
          title: preview.title || item.title,
          thumbnail: preview.thumbnail || item.thumbnail
        };
      } catch (err) {
        console.warn('Preview extract skipped:', item.id, err);
        return item;
      }
    })
  );
}

export async function loadDefaultAdpTheme(adpUrl) {
  const res = await fetch(adpUrl);
  if (!res.ok) throw new Error('থিম ফাইলটি পাওয়া যায়নি');
  const blob = await res.blob();
  return await parseAdpFile(blob);
}