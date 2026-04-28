import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 部署到 GitHub Pages 時 URL 是 https://<user>.github.io/<repo>/
// 所以 production build 的 base 要設成 /<repo>/
// 本機 dev 時還是用 /(localhost:5173/)
// 透過環境變數 VITE_BASE_PATH 切換,給 GitHub Actions build 時注入
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  base: command === 'build' ? (process.env.VITE_BASE_PATH ?? '/comic-record/') : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
