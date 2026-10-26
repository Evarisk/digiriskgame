import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_BASE_URL = 'https://demodoli.digirisk.com/htdocs/api/index.php';
const PHOTO_PATH_PATTERN = /^riskassessment\/RA[0-9]+\/[a-zA-Z0-9_\-.\s,/]+$/u;

/**
 * En développement, émule le mode « photo » de public/api-proxy.php (non exécuté par Vite)
 * pour que le repli des photos de risques fonctionne aussi contre un Dolibarr local.
 */
function devApiProxyPhotos(baseUrl, apiKey) {
  return {
    name: 'digirisk-dev-api-proxy-photos',
    configureServer(server) {
      server.middlewares.use('/api-proxy.php', async (req, res) => {
        const photoPath = new URL(req.url, 'http://localhost').searchParams.get('photo') || '';
        if (!PHOTO_PATH_PATTERN.test(photoPath) || photoPath.includes('..')) {
          res.statusCode = 400;
          res.end('Chemin photo invalide');
          return;
        }

        try {
          const docUrl = `${baseUrl}/documents/download?modulepart=digiriskdolibarr&original_file=${encodeURIComponent(photoPath)}`;
          const apiRes = await fetch(docUrl, {
            headers: { DOLAPIKEY: req.headers.dolapikey || apiKey, Accept: 'application/json' },
          });
          const json = apiRes.ok ? await apiRes.json() : null;
          if (!json?.content) throw new Error(`HTTP ${apiRes.status}`);

          res.setHeader('Content-Type', json['content-type'] || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(Buffer.from(json.content, 'base64'));
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const baseUrl = (env.VITE_DIGIRISK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

  return {
    base: './',
    plugins: [react(), devApiProxyPhotos(baseUrl, env.VITE_DOLAPIKEY || '')],
    server: {
      port: 5173,
      proxy: {
        '/digirisk-api': {
          target: baseUrl,
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
