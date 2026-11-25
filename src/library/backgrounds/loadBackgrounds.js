const bgFiles = import.meta.glob('./**/*.{png,jpg,jpeg,webp,avif}', {
  eager: true,
  query: '?url',
  import: 'default'
});

export function getLibraryBackgrounds() {
  return Object.entries(bgFiles).map(([path, url], idx) => {
    const fileName = path
      .split('/')
      .pop()
      .replace(/\.[^/.]+$/, '')
      .replace(/[-_]+/g, ' ');
    return {
      id: `lib-bg-${idx}`,
      name: fileName,
      useImage: true,
      imageSrc: url,
      imageOpacity: 0.85,
      gradient: 'linear-gradient(135deg, #0f172a, #1e293b)',
      overlayGradient: 'radial-gradient(circle, transparent 35%, rgba(0,0,0,0.65) 100%)'
    };
  });
}
