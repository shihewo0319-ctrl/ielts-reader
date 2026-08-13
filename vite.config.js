import { defineConfig } from 'vite';
import { resolve } from 'path';

// 多页应用：主页 / 阅读器 / 我的文章 / 生词本
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        reader: resolve(__dirname, 'reader.html'),
        library: resolve(__dirname, 'library.html'),
        wordbook: resolve(__dirname, 'wordbook.html'),
      },
    },
  },
});
