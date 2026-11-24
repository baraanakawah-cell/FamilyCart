import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          if (id.includes('node_modules/lucide-react/')) return 'icons'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor'
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['familycart.svg'],
      manifest: {
        name: 'FamilyCart — Samen boodschappen doen',
        short_name: 'FamilyCart',
        description: 'De gedeelde boodschappenlijst voor jouw gezin.',
        lang: 'nl',
        theme_color: '#f7f8f3',
        background_color: '#f7f8f3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/familycart.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
})
