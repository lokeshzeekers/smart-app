import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// SMArT is an installable Progressive Web App:
//  - Android (Chrome): "Install app" prompt / Add to Home screen
//  - iOS (Safari): Share -> Add to Home Screen
// It runs full screen with its own icon, no app-store fee. After a deploy, installed
// phones show a "New version available" banner (registerType 'prompt'), so an update
// never reloads the page in the middle of a training attempt.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'SMArT - Airway Training',
        short_name: 'SMArT',
        description: 'Simulation-based Management of Airway Training',
        lang: 'en',
        categories: ['education', 'medical'],
        theme_color: '#0B4F6C',
        background_color: '#F5F8F9',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Single-page app: offline navigations get the app shell - but NEVER for the API,
        // live socket or health check, which must always hit the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//, /^\/health/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // Web fonts: so the app still looks right offline
          { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'google-fonts-css' } },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
