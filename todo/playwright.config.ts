import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  // 모든 테스트가 같은 메모리 DB를 비우고 쓰므로 하나씩 실행한다
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // npm run e2e 가 먼저 vite build 를 하고, 여기서 메모리 MongoDB + Express 서버(dist 제공)를 띄운다
  webServer: { command: 'node e2e/server.mjs', port: PORT, reuseExistingServer: false, timeout: 180_000 }
})
