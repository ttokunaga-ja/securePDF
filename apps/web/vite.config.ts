import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Split the large, rarely-changing vendors into their own long-cacheable
    // chunks. The PDF engine (@securepdf/core + @cantoo/pdf-lib) is already a
    // separate chunk via the dynamic import in lib/core.ts.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'mui', test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/ },
            { name: 'pdfjs', test: /[\\/]node_modules[\\/]pdfjs-dist[\\/]/ },
            { name: 'dnd', test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/ },
          ],
        },
      },
    },
    // pdf.js's worker and the lazy engine chunk are legitimately large; raise the
    // warning bar so the build log stays useful.
    chunkSizeWarningLimit: 800,
  },
})
