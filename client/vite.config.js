import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    allowedHosts: [
      'localhost',
      '.ngrok-free.dev',
      '.ngrok.io',
      'usage-monkhood-flanking.ngrok-free.dev',
    ],
    proxy: {
      '/api': 'http://127.0.0.1:5000',
      '/webhook': 'http://127.0.0.1:5000',
      // Serve uploads through the same origin (works on ngrok too)
      '/uploads': 'http://127.0.0.1:5000',
      // Proxy socket.io so it works on ngrok/mobile too
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
