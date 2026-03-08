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
      '/auth-api': {
        target: process.env.VITE_AUTH_PROXY_TARGET || 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
      },
      '/flight-api': {
        target: process.env.VITE_FLIGHT_PROXY_TARGET || 'http://localhost:8082',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/flight-api/, ''),
      },
      '/booking-api': {
        target: process.env.VITE_BOOKING_PROXY_TARGET || 'http://localhost:8083',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/booking-api/, ''),
      },
      '/customer-api': {
        target: process.env.VITE_CUSTOMER_PROXY_TARGET || 'http://localhost:8084',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/customer-api/, ''),
      },
      '/payment-api': {
        target: process.env.VITE_PAYMENT_PROXY_TARGET || 'http://localhost:8085',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/payment-api/, ''),
      },
    },
  },
});
