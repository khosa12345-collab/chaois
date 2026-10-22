import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 3001)
// 빌드된 클라이언트(dist)가 있으면 함께 제공한다 (npm start, E2E). 개발 중에는 Vite(5173)로 접속한다.
const app = createApp({ clientDir: process.env.CLIENT_DIR ?? 'dist' })

app.listen(port, () => {
  console.log(`할 일 서버: http://localhost:${port}`)
})
