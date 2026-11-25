const stickerFiles = import.meta.glob('./**/*.{png,svg,webp,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default'
});

export function getLibraryStickers() {
  return Object.entries(stickerFiles).map(([path, url], idx) => {
    const fileName = path.split('/').pop().replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
    return {
      id: `lib-st-${idx}`,
      name: fileName,
      src: url
    };
  });
}
