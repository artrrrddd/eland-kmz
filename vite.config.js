import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function leasingPage() {
  const middleware = (req, _res, next) => {
    if (/^\/leasing\/?(?:\?|$)/.test(req.url || '')) {
      req.url = req.url.replace(/^\/leasing\/?/, '/leasing/index.html');
    }
    next();
  };
  return {
    name: 'leasing-page',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

export default defineConfig({
  plugins: [react(), leasingPage()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
