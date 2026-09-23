import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const NETEASE_API = process.env.NETEASE_API ?? 'http://localhost:3000';

// Vite 中间件：代理网易云音频 CDN（带 Range 透传 + 流式输出）
function neteaseStreamPlugin() {
  return {
    name: 'netease-stream',
    configureServer(server: any) {
      server.middlewares.use('/netease-stream', async (req: any, res: any) => {
        try {
          const u = new URL(req.url ?? '', 'http://localhost').searchParams.get('u');
          if (!u) {
            res.statusCode = 400;
            return res.end('missing u');
          }

          const headers: Record<string, string> = {};
          if (req.headers.range) headers['Range'] = String(req.headers.range);

          const upstream = await fetch(u, { headers });
          res.statusCode = upstream.status;
          const ct = upstream.headers.get('content-type');
          if (ct) res.setHeader('Content-Type', ct);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'public, max-age=600');
          const cl = upstream.headers.get('content-length');
          if (cl) res.setHeader('Content-Length', cl);
          const cr = upstream.headers.get('content-range');
          if (cr) res.setHeader('Content-Range', cr);

          if (!upstream.body) {
            res.statusCode = 502;
            return res.end('no body');
          }

          const reader = upstream.body.getReader();
          let closed = false;
          req.on?.('close', () => {
            closed = true;
            reader.cancel().catch(() => {});
          });

          while (true) {
            if (closed) break;
            const { done, value } = await reader.read();
            if (done) break;
            const ok = res.write(Buffer.from(value));
            if (!ok) {
              // backpressure: wait for drain
              await new Promise((r) => res.once('drain', r));
            }
          }
          res.end();
        } catch (err) {
          try {
            res.statusCode = 500;
            res.end(String(err));
          } catch {}
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // 默认相对路径：Capacitor 打包与本地预览都能直接用
  // GitHub Pages 项目仓库部署时用 VITE_BASE=/<repo-name>/ 覆盖
  base: process.env.VITE_BASE ?? './',
  plugins: [react(), tailwindcss(), neteaseStreamPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/netease': {
        target: NETEASE_API,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/netease/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
});