import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'vendor-react'
            if (id.includes('lucide-react') || id.includes('@base-ui') || id.includes('react-resizable-panels')) return 'vendor-ui'
            if (id.includes('@huggingface/transformers') || id.includes('onnxruntime')) return 'vendor-transformers'
            if (id.includes('mediabunny')) return 'vendor-mediabunny'
          }
        },
      },
    },
  },
})
