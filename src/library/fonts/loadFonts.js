const fontFiles = import.meta.glob('./**/*.{ttf,otf,woff,woff2}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const customSessionFonts = [];

function cleanFontName(fileName) {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

export function getLibraryFonts() {
  const fromFolder = Object.entries(fontFiles).map(([path, url]) => {
    const fileName = path.split('/').pop();
    return {
      name: cleanFontName(fileName),
      url
    };
  });
  return [...customSessionFonts, ...fromFolder];
}

export function registerLibraryFonts() {
  const list = getLibraryFonts();
  let styleEl = document.getElementById('adnans-library-fonts');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'adnans-library-fonts';
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = list
    .map(
      (f) => `
@font-face {
  font-family: '${f.name}';
  src: url('${f.url}');
  font-display: swap;
}`
    )
    .join('\n');
}

// ইউজার নিজের ফোন থেকে .ttf/.otf ফন্ট লোড করলে
export async function loadPhoneFontFile(file) {
  const name = cleanFontName(file.name);
  const buffer = await file.arrayBuffer();
  const face = new FontFace(name, buffer);
  await face.load();
  document.fonts.add(face);
  if (!customSessionFonts.some((f) => f.name === name)) {
    customSessionFonts.unshift({ name, url: null, isLocal: true });
  }
  return name;
}
