import { cp, mkdir } from 'node:fs/promises';

// GitHub Pages serves the repository root. Keep its entry point and assets built.
await mkdir('assets', { recursive: true });
await cp('dist/assets', 'assets', { recursive: true });
for (const file of ['index.html', 'favicon.svg', 'robots.txt', 'sitemap.xml']) {
  try {
    await cp(`dist/${file}`, file);
  } catch (error) {
    if (error.code !== 'ENOENT' || file !== 'sitemap.xml') throw error;
  }
}
