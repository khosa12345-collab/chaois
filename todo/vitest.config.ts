import { defineConfig } from 'vitest/config'

export default defineConfig({
  // mongodb-memory-server가 처음 실행될 때 mongod를 띄우는 데 시간이 걸린다
  test: { include: ['tests/**/*.test.ts'], environment: 'node', hookTimeout: 120_000 }
})
