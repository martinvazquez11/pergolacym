import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Armar Presupuesto',
        short_name: 'Presupuestos',
        description: 'Generador rápido de presupuestos en imagen desde el celular',
        theme_color: '#111827',
        background_color: '#f9fafb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cachea todos los archivos compilados y recursos locales para uso offline
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webmanifest}'],
      },
    }),
  ],
})