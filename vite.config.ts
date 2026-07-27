import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves this repo at https://aduda091.github.io/dudannex/, so a
 * production build has to prefix every asset URL with the repo name — without
 * it the page loads and then 404s on its own JS and CSS. Dev keeps the root
 * path so `npm run dev` stays at http://localhost:5173/.
 *
 * The build lands in `docs/` because Pages can serve directly from that folder
 * on the main branch, which avoids needing a second branch or an Action.
 *
 * Keyed on `mode`, not `command`: `command` is 'serve' for both dev *and*
 * `vite preview`, which would leave preview serving at / while the built HTML
 * asks for /dudannex/ — so the local check of a production build would 404
 * even though the real deploy is fine.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/dudannex/' : '/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
}));
