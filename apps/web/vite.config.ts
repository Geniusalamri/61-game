import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@61-game/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@61-game/engine': path.resolve(__dirname, '../../packages/engine/src'),
      '@61-game/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
});