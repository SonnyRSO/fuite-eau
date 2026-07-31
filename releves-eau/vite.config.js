import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT : remplace "releves-eau" par le nom exact de ton dépôt GitHub
// si tu déploies sur GitHub Pages (https://<user>.github.io/<repo>/)
export default defineConfig({
  plugins: [react()],
  base: '/releves-eau/',
})
