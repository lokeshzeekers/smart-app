import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Installable free-of-cost app: this config produces a Progressive Web App.
// On Android (Chrome) it prompts "Add to Home Screen" / "Install app" automatically.
// On iOS (Safari) users tap Share -> "Add to Home Screen". Both run full-screen,
// with an app icon, and cost nothing to distribute (no App Store / Play Store fee).
// See README.md "Wrapping as a native app" section if you later want store listings.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'SMArT - Airway Training',
        short_name: 'SMArT',
        description: 'Simulation-based Management of Airway Training',
        theme_color: '#0B4F6C',
        background_color: '#F5F8F9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: { port: 5173 },
});
