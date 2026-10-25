import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/digirisk-api': {
        target: 'https://demodoli.digirisk.com/htdocs/api/index.php',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/digirisk-api/, ''),
      },
    },
  },
});
