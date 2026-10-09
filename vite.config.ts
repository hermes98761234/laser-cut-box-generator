import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the build works from any sub-path (GitHub Pages).
  base: './',
  // three.js is loaded on demand in its own chunk.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    // Geometry tests sample 3D occupancy grids.
    testTimeout: 30000,
  },
})
