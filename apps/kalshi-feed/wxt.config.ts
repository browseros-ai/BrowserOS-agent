import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Kalshi Feed',
    description: 'TikTok-style prediction market feed powered by Kalshi',
    action: {
      default_title: 'Kalshi Feed',
    },
    permissions: ['sidePanel', 'storage'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
