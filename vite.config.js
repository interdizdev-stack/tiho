import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  let siteUrl;
  if (env.VITE_SITE_URL) {
    const url = new URL(env.VITE_SITE_URL);
    if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
      throw new Error('VITE_SITE_URL must be an absolute HTTP(S) URL without credentials, query or fragment');
    }
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    siteUrl = url.href;
  }
  const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  return {
    plugins: [{
      name: 'site-seo',
      transformIndexHtml(html) {
        if (!siteUrl) return html;
        const safeUrl = escapeXml(siteUrl);
        return html.replace('</head>', `  <link rel="canonical" href="${safeUrl}" />\n    <meta property="og:url" content="${safeUrl}" />\n  </head>`);
      },
      generateBundle() {
        if (!siteUrl) return;
        const safeUrl = escapeXml(siteUrl);
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${safeUrl}</loc></url></urlset>\n` });
      },
    }],
  };
});
