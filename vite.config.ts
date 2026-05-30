import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

/**
 * Copies dotfiles (e.g. .htaccess) from public/ to dist/ since Vite
 * excludes them by default.
 */
function copyDotfilesPlugin(): Plugin {
  return {
    name: 'copy-dotfiles',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const fs = await import('node:fs/promises');
      const src = path.resolve('public', '.htaccess');
      const dest = path.resolve('dist', '.htaccess');
      try {
        await fs.copyFile(src, dest);
      } catch {}
    },
  };
}

/**
 * Inlines the main CSS bundle into <head> so it doesn't block rendering.
 * Removes the original <link rel="stylesheet"> tag.
 */
function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    async writeBundle(opts, bundle) {
      const fs = await import('node:fs/promises');
      const outDir = opts.dir || 'dist';
      const indexPath = path.join(outDir, 'index.html');
      let html: string;
      try {
        html = await fs.readFile(indexPath, 'utf-8');
      } catch {
        return;
      }
      const cssAssets: Record<string, string> = {};
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && asset.type === 'asset') {
          cssAssets[fileName] = String(asset.source);
        }
      }
      const replaced = html.replace(
        /<link\s+rel="stylesheet"[^>]*href="\/?([^"]+\.css)"[^>]*\/?>/g,
        (match, file) => {
          const css = cssAssets[file];
          return css ? `<style>${css}</style>` : match;
        },
      );
      if (replaced !== html) {
        await fs.writeFile(indexPath, replaced, 'utf-8');
      }
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), inlineCssPlugin(), copyDotfilesPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      assetsDir: '.',
      minify: 'terser',
      terserOptions: {
        compress: {
          passes: 2,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        format: { comments: false },
      },
      // Prevent eager preloading of heavy lazy-loaded chunks (e.g. three.js).
      // Only preload chunks that are actually needed for initial render.
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter((d) => !/vendor-three|vendor-motion|vendor-firebase/.test(d)),
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
            'vendor-motion': ['framer-motion'],
            'vendor-i18n': ['i18next', 'react-i18next'],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
