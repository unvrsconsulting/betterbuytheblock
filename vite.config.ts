import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Hash of every file in public/data/, so the static catalog URLs change exactly when their contents do and can
// be cached as immutable (see services/dataUrl.ts and the /data/ Cache-Control rule in vercel.json).
function dataVersion(): string {
  const dir = path.resolve(__dirname, 'public/data');
  const hash = crypto.createHash('sha1');
  for (const file of fs.readdirSync(dir).sort()) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(dir, file)));
  }
  return hash.digest('hex').slice(0, 10);
}

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      define: {
        __DATA_VERSION__: JSON.stringify(dataVersion()),
      },
      build: {
        rollupOptions: {
          output: {
            // Separate long-lived vendor chunks so they cache independently of
            // app code and download in parallel with the entry bundle.
            manualChunks: {
              'vendor-motion': ['framer-motion'],
              'vendor-map': ['leaflet', 'react-leaflet'],
            },
          },
        },
      },
      // GEMINI_API_KEY is never defined for the client bundle — it's read
      // directly from process.env in api/ai.ts, which only runs server-side.
      // Baking a secret into `define` here would ship it in the shipped JS.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
