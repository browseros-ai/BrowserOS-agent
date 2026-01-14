import { defineConfig } from 'bunup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  clean: true,
  noExternal: ['@browseros/shared'],
})
