import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: './',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/digirisk-api': {
          target: 'https://demodoli.digirisk.com/htdocs/api/index.php',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/digirisk-api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (!req.headers['dolapikey'] && env.VITE_DOLAPIKEY) {
                proxyReq.setHeader('DOLAPIKEY', env.VITE_DOLAPIKEY);
              }
            });
          },
        },
      },
    },
  };
});
