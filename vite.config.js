import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Built into public/admin and served by Fastify under /admin/.
export default defineConfig({
  root: 'web',
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../public/admin',
    emptyOutDir: true,
  },
});
