import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_PORTAL_TARGET 指向 portal 后端地址，Vite 把 /api 反代过去。
// 默认 http://localhost:8080；登录态依赖同源 cookie，所以请在浏览器里通过本 dev server 完成登录。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_PORTAL_TARGET || 'https://ecs.yuansuan.work'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
        },
      },
    },
  }
})
