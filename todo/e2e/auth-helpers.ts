import { randomUUID } from 'node:crypto'
import { MongoClient, ObjectId } from 'mongodb'
import { expect, type BrowserContext, type Page } from '@playwright/test'

// e2e/server.mjs 의 메모리 MongoDB
const client = new MongoClient('mongodb://127.0.0.1:27018')
const db = () => client.db('todoapp')

export async function resetDb(): Promise<void> {
  await client.connect()
  await Promise.all(['users', 'accounts', 'sessions', 'todos'].map((c) => db().collection(c).deleteMany({})))
}

export interface TestUser {
  name: string
  sessionToken: string
}

// GitHub 로그인을 마친 상태를 재현한다: Auth.js MongoDB adapter와 같은 형태로 users·sessions 문서를 만든다
export async function createUser(name: string): Promise<TestUser> {
  await client.connect()
  const _id = new ObjectId()
  await db().collection('users').insertOne({ _id, name, email: `${name}@example.com`, emailVerified: null, image: null })
  const sessionToken = randomUUID()
  await db()
    .collection('sessions')
    .insertOne({ sessionToken, userId: _id, expires: new Date(Date.now() + 24 * 60 * 60 * 1000) })
  return { name, sessionToken }
}

export async function loginAs(context: BrowserContext, user: TestUser): Promise<void> {
  await context.clearCookies()
  await context.addCookies([
    { name: 'authjs.session-token', value: user.sessionToken, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }
  ])
}

// 서버 저장이 모두 끝날 때까지 기다린다 (새로고침·사용자 전환 전에 필요)
export async function waitSaved(page: Page): Promise<void> {
  await expect(page.locator('.todo-app')).toHaveAttribute('aria-busy', 'false')
}

// 새 사용자로 로그인한 화면에서 시작한다
export async function startLoggedIn(page: Page, context: BrowserContext, name = '테스터'): Promise<TestUser> {
  await resetDb()
  const user = await createUser(name)
  await loginAs(context, user)
  await page.goto('/')
  await expect(page.getByText(`${name}님 환영합니다`)).toBeVisible()
  return user
}

export async function sessionExists(token: string): Promise<boolean> {
  return (await db().collection('sessions').countDocuments({ sessionToken: token })) > 0
}

export async function closeDb(): Promise<void> {
  await client.close()
}
