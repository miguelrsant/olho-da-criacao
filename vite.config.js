import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // as imagens dos afrescos ficam como arquivos (não viram base64 dentro do JS)
  // PREVIEW=1 embute tudo (para a prévia num arquivo só)
  build: process.env.PREVIEW ? { assetsInlineLimit: 1e9, outDir: 'dist-preview', cssCodeSplit: false } : { assetsInlineLimit: 0 },
});
