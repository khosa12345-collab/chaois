import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // 개발 중에는 API·로그인 요청을 Express 서버로 넘긴다. 주소가 같아야 로그인 쿠키가 함께 간다.
    // changeOrigin: false 로 Host(localhost:5173)를 그대로 넘겨야 GitHub 콜백 주소가 5173으로 만들어진다.
    // (문자열로만 적으면 Vite가 changeOrigin: true 로 바꿔 콜백이 3001이 된다)
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: false },
      '/auth': { target: 'http://localhost:3001', changeOrigin: false }
    }
  }
})
