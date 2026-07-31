import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT : ce chemin doit correspondre exactement au nom de ton dépôt GitHub
// (https://<user>.github.io/<repo>/). Dépôt actuel : fuite-eau
export default defineConfig({
  plugins: [react()],
  base: '/fuite-eau/',
})
