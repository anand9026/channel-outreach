import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Only apply the GitHub Pages base for production builds.
  // Dev/preview servers run at '/'.
  base: command === 'build' ? '/channel-outreach/' : '/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
    watch: {
      // Prevent watcher from following the local `frontend` symlink (dev-only)
      ignored: ['**/node_modules/**', '**/frontend/**', '**/.git/**'],
      followSymlinks: false,
    },
  },
}))
