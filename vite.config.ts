import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { Buffer } from 'buffer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Make Buffer available globally for gray-matter
globalThis.Buffer = Buffer

// Custom plugin to serve the blogs folder
function serveBlogsPlugin() {
  // Debug: log __dirname on load
  console.log(`[serve-blogs] INIT: __dirname = ${__dirname}`);

  // Hardcoded blogs base path (bypassing __dirname issues)
  const BLOGS_BASE = 'D:/New folder (77)/rocm-blogs-internal/blogs';
  const BUILD_BASE = 'D:/New folder (77)/program/_build';
  console.log(`[serve-blogs] INIT: BLOGS_BASE = ${BLOGS_BASE}`);
  console.log(`[serve-blogs] INIT: BUILD_BASE = ${BUILD_BASE}`);

  return {
    name: 'serve-blogs',
    configureServer(server: any) {
      // Serve /_build/* from program/_build/*
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';

        // Handle /_build/* requests for MyST content
        if (url.startsWith('/_build/')) {
          const relativePath = url.slice('/_build'.length);
          const buildPath = path.join(BUILD_BASE, relativePath);

          console.log(`[serve-build] Requested: ${url}`);
          console.log(`[serve-build] Resolved to: ${buildPath}`);

          if (fs.existsSync(buildPath)) {
            const stat = fs.statSync(buildPath);
            if (stat.isFile()) {
              const ext = path.extname(buildPath).toLowerCase();
              const mimeTypes: Record<string, string> = {
                '.json': 'application/json',
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
              };

              console.log(`[serve-build] Serving file: ${buildPath}`);
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
              res.setHeader('Access-Control-Allow-Origin', '*');
              fs.createReadStream(buildPath).pipe(res);
              return;
            }
          } else {
            console.log(`[serve-build] File not found: ${buildPath}`);
          }
        }
        next();
      });

      // Serve /blogs/* from rocm-blogs-internal/blogs/*
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = req.url || '';

        // Only handle /blogs/* requests
        if (!url.startsWith('/blogs/')) {
          return next();
        }

        // Remove /blogs prefix to get the relative path
        const relativePath = url.slice('/blogs'.length);
        const blogsPath = path.join(BLOGS_BASE, relativePath);

        console.log(`[serve-blogs] Requested: ${url}`);
        console.log(`[serve-blogs] Resolved to: ${blogsPath}`);

        if (fs.existsSync(blogsPath)) {
          const stat = fs.statSync(blogsPath);
          if (stat.isFile()) {
            // Set appropriate content type
            const ext = path.extname(blogsPath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.md': 'text/markdown',
              '.json': 'application/json',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.svg': 'image/svg+xml',
              '.css': 'text/css',
              '.js': 'application/javascript',
              '.csv': 'text/csv',
            };

            console.log(`[serve-blogs] Serving file: ${blogsPath}`);
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.setHeader('Access-Control-Allow-Origin', '*');
            fs.createReadStream(blogsPath).pipe(res);
            return;
          }
        } else {
          console.log(`[serve-blogs] File not found: ${blogsPath}`);
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    serveBlogsPlugin(),
  ],
  define: {
    'global': 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['date-fns', 'gray-matter', 'minisearch']
        }
      }
    }
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
})
