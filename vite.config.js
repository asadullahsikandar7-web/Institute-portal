import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// HTTPS in dev, IF a local cert exists (run `./scripts/generate-dev-cert.sh`
// once) — camera/microphone access requires a secure context, and browsers
// only grant that to plain HTTP on literal "localhost"; a LAN IP like
// http://192.168.x.x does not qualify, so testing the class-call feature
// from another device needs the dev server to actually serve HTTPS. Falls
// back to plain HTTP automatically if the cert hasn't been generated, so
// this never breaks a checkout that hasn't run the script.
const certDir = path.resolve(__dirname, 'certs');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');
// ACADEXA_HTTP=1 (set by `npm run demo`) forces plain HTTP: the demo only
// ever runs on localhost, where a browser warning about the self-signed
// cert would just be an obstacle.
const httpsConfig = !process.env.ACADEXA_HTTP && fs.existsSync(keyPath) && fs.existsSync(certPath)
  ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
  : false;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind 0.0.0.0 (not just localhost) so the dev server is reachable from
    // other devices on the same LAN during local multi-device testing —
    // Vite prints the actual Network URL to use on startup.
    host: true,
    https: httpsConfig,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser'
  }
});
