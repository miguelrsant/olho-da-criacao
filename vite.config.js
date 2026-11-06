import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // as imagens dos afrescos ficam como arquivos (não viram base64 dentro do JS)
  build: { assetsInlineLimit: 0 },
});
