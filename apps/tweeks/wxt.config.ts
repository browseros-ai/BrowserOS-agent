import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'BrowserOS Tweeks',
    description: 'AI-powered web modifications for BrowserOS',
    action: {
      default_title: 'Tweeks',
      default_popup: 'popup.html',
    },
    permissions: ['activeTab', 'storage', 'scripting', 'tabs'],
    host_permissions: ['http://127.0.0.1/*', '<all_urls>'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
