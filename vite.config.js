import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

function offlinePwaPlugin() {
  let outDir = 'dist';

  return {
    name: 'offline-pwa-builder',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir || 'dist');
    },
    closeBundle() {
      if (!fs.existsSync(outDir)) return;

      const manifest = {
        name: 'PixelLab',
        short_name: 'PixelLab',
        description: 'Offline-ready creative editor',
        theme_color: '#141e30',
        background_color: '#0b0e14',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      };
      fs.writeFileSync(
        path.join(outDir, 'manifest.webmanifest'),
        JSON.stringify(manifest, null, 2)
      );

      const walk = (dir) => {
        let list = [];
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) {
            list = list.concat(walk(full));
          } else if (ent.isFile()) {
            const rel = '/' + path.relative(outDir, full).split(path.sep).join('/');
            if (rel !== '/sw.js') list.push(rel);
          }
        }
        return list;
      };

      const allFiles = Array.from(new Set(['/', ...walk(outDir)]));
      const coreUrls = allFiles.filter((u) => /\.(html|js|css|webmanifest)$/i.test(u) || u === '/');
      const assetUrls = allFiles.filter((u) => !coreUrls.includes(u));

      const hash = crypto
        .createHash('md5')
        .update(allFiles.join('|') + ':' + Date.now())
        .digest('hex')
        .slice(0, 10);

      const swCode = [
        "const CACHE_NAME = 'pixellab-offline-" + hash + "';",
        'const CORE_URLS = ' + JSON.stringify(coreUrls) + ';',
        'const ASSET_URLS = ' + JSON.stringify(assetUrls) + ';',
        '',
        'async function cacheUrl(cache, u) {',
        '  try {',
        '    const encoded = encodeURI(u);',
        "    const res = await fetch(encoded, { cache: 'no-cache' });",
        '    if (res && res.ok) {',
        '      await cache.put(encoded, res.clone());',
        "      if (u === '/index.html') await cache.put('/', res.clone());",
        '    }',
        '  } catch {}',
        '}',
        '',
        "self.addEventListener('install', (event) => {",
        '  event.waitUntil(',
        '    caches.open(CACHE_NAME).then(async (cache) => {',
        '      await Promise.all(CORE_URLS.map((u) => cacheUrl(cache, u)));',
        '      for (let i = 0; i < ASSET_URLS.length; i += 4) {',
        '        const chunk = ASSET_URLS.slice(i, i + 4);',
        '        await Promise.all(chunk.map((u) => cacheUrl(cache, u)));',
        '      }',
        '    }).then(() => self.skipWaiting())',
        '  );',
        '});',
        '',
        "self.addEventListener('activate', (event) => {",
        '  event.waitUntil(',
        '    caches.keys().then((keys) =>',
        '      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))',
        '    ).then(() => self.clients.claim())',
        '  );',
        '});',
        '',
        "self.addEventListener('fetch', (event) => {",
        '  const req = event.request;',
        "  if (req.method !== 'GET' || !req.url.startsWith('http')) return;",
        '',
        "  if (req.mode === 'navigate') {",
        '    event.respondWith(',
        '      fetch(req)',
        '        .then((res) => {',
        '          if (res && res.ok) {',
        '            const copy = res.clone();',
        "            caches.open(CACHE_NAME).then((c) => c.put('/index.html', copy));",
        '          }',
        '          return res;',
        '        })',
        '        .catch(async () => {',
        "          const cache = await caches.open(CACHE_NAME);",
        "          return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error();",
        '        })',
        '    );',
        '    return;',
        '  }',
        '',
        '  event.respondWith(',
        '    caches.match(req, { ignoreSearch: true }).then((cached) => {',
        '      if (cached) return cached;',
        '      return fetch(req)',
        '        .then((res) => {',
        "          if (res && (res.status === 200 || res.type === 'opaque')) {",
        '            const copy = res.clone();',
        '            caches.open(CACHE_NAME).then((c) => c.put(req, copy));',
        '          }',
        '          return res;',
        '        })',
        '        .catch(() => Response.error());',
        '    })',
        '  );',
        '});'
      ].join('\n');

      fs.writeFileSync(path.join(outDir, 'sw.js'), swCode);
      console.log(`✓ Offline PWA ready (${coreUrls.length} core + ${assetUrls.length} assets)`);
    }
  };
}

export default defineConfig({
  plugins: [react(), offlinePwaPlugin()]
});
