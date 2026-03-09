import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  outDir: 'dist',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Tweaks Studio',
    description:
      'Make websites work the way you want with local BrowserOS tweaks.',
    action: {
      default_title: 'Tweaks Studio',
      default_popup: 'popup.html',
    },
    options_ui: {
      page: 'app.html',
      open_in_tab: true,
    },
    permissions: ['storage', 'tabs'],
    host_permissions: ['<all_urls>'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
