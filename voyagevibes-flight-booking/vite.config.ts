import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const certDir = path.resolve(__dirname, './https-certs');
const webCertPath =
  process.env.UI_TLS_CERT_PATH || path.join(certDir, 'customer-ui.voyagevibes.in.crt.pem');
const webKeyPath =
  process.env.UI_TLS_KEY_PATH || path.join(certDir, 'customer-ui.voyagevibes.in.key.pem');

const httpsConfig =
  fs.existsSync(webCertPath) && fs.existsSync(webKeyPath)
    ? {
        cert: fs.readFileSync(webCertPath),
        key: fs.readFileSync(webKeyPath),
      }
    : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'customer-ui.voyagevibes.in',
    port: 8080,
    strictPort: true,
    https: httpsConfig,
    proxy: {
      '/gateway-api': {
        target: process.env.VITE_GATEWAY_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
        headers: {
          Host: 'customer-api.voyagevibes.in',
        },
        rewrite: (path) => path.replace(/^\/gateway-api/, ''),
      },
    },
  },
});
