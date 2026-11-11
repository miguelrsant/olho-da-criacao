import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { seoPlugin } from './seo/kit.mjs';
import site from './seo/site.mjs';

export default defineConfig({
  // seoPlugin: metadados, JSON-LD, texto sem JavaScript, páginas internas, Markdown, robots, sitemap e llms.txt (seo/)
  plugins: [react(), ...(process.env.PREVIEW ? [] : [seoPlugin(site)])],
  // as imagens dos afrescos ficam como arquivos (não viram base64 dentro do JS)
  // PREVIEW=1 embute tudo (para a prévia num arquivo só)
  build: process.env.PREVIEW ? { assetsInlineLimit: 1e9, outDir: 'dist-preview', cssCodeSplit: false } : { assetsInlineLimit: 0 },
});
