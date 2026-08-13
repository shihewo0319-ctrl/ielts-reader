import { defineConfig } from 'vite';
import { resolve } from 'path';

// 多页应用：主页 + 阅读器
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        reader: resolve(__dirname, 'reader.html'),
      },
    },
  },
});
