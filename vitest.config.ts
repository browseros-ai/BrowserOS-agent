import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'scripts/**/*.{test,spec}.{js,mjs,cjs,ts}'],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'src/types/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.config.js',
        'tests/**',
        'coverage/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})