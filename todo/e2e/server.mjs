// E2E용 서버: 메모리 MongoDB를 띄운 뒤 그 주소로 Express 서버를 실행한다. 서버가 빌드된 Vite 클라이언트(dist)도 함께 제공한다.
// 실제 GitHub·Atlas에는 접속하지 않는다. 환경 변수를 여기서 정하므로 .env.local 값은 쓰이지 않는다.
import { spawn } from 'node:child_process'
import { MongoMemoryServer } from 'mongodb-memory-server'

const E2E_MONGO_PORT = 27018
const E2E_APP_PORT = 3100

const mongo = await MongoMemoryServer.create({ instance: { port: E2E_MONGO_PORT, ip: '127.0.0.1' } })

const app = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: String(E2E_APP_PORT),
    CLIENT_DIR: 'dist',
    MONGODB_URI: mongo.getUri(),
    AUTH_SECRET: 'e2e-only-secret-not-for-production-0123456789',
    AUTH_GITHUB_ID: 'e2e-client-id',
    AUTH_GITHUB_SECRET: 'e2e-client-secret',
  }
})

const shutdown = async () => {
  app.kill()
  await mongo.stop()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
app.on('exit', async (code) => {
  await mongo.stop()
  process.exit(code ?? 0)
})
