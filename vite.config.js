import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', 
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'], 
      manifest: {
        name: 'Degu Math Quest',
        short_name: 'DeguMath',
        description: 'Драконий Центр Связи',
        theme_color: '#00d4ff', 
        background_color: '#0f2027', 
        display: 'standalone', 
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})