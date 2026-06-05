import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs'

const BUILD_VERSION = Date.now().toString()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'write-version',
      buildStart() {
        writeFileSync('./public/version.json', JSON.stringify({ version: BUILD_VERSION }))
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
})
