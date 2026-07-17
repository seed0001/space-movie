import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: '.',
  publicDir: 'public',
  base: command === 'serve' ? '/' : '/solar-system-trader/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // Edge TTS websocket fallback: browsers send an Origin header the
      // speech endpoint sometimes refuses; proxying through the dev server
      // strips it. See src/cinema/VoiceEngine.js.
      '/edge-tts': {
        target: 'https://speech.platform.bing.com',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/edge-tts/, ''),
        configure: (proxy) => {
          proxy.on('proxyReqWs', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
