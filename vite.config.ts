import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Build id: commit (in CI) or timestamp, shown in the settings and used to detect updates. */
const BUILD = (process.env.GITHUB_SHA ?? '').slice(0, 7) || new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const BUILT_AT = new Date().toISOString();

/** Emits version.json next to index.html so a running app can tell that a newer build is live. */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, builtAt: BUILT_AT }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify(BUILD),
    __APP_BUILT_AT__: JSON.stringify(BUILT_AT),
  },
  test: { globals: true },
});
