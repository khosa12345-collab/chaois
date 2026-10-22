import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo: MongoMemoryServer
let client: MongoClient
let db: Db
let server: Server
let base: string

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  // 서버 모듈이 처음 DB에 연결하기 전에 환경 변수를 정한다
  process.env.MONGODB_URI = mongo.getUri()
  process.env.AUTH_SECRET = 'test-only-secret-0123456789abcdef'
  process.env.AUTH_GITHUB_ID = 'test-client-id'
  process.env.AUTH_GITHUB_SECRET = 'test-client-secret'
  client = await new MongoClient(mongo.getUri()).connect()
  db = client.db('todoapp')
  const { createApp } = await import('../server/app')
  server = createApp().listen(0)
  base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  server?.close()
  await client?.close()
  const { getClient } = await import('../server/db')
  await (await getClient()).close()
  await mongo?.stop()
})

beforeEach(async () => {
  await Promise.all(['users', 'sessions', 'todos'].map((c) => db.collection(c).deleteMany({})))
})

// GitHub 로그인을 마친 상태: Auth.js MongoDB adapter와 같은 형태로 사용자·세션을 만든다
async function login(name: string) {
  const _id = new ObjectId()
  await db.collection('users').insertOne({ _id, name, email: `${name}@example.com`, emailVerified: null })
  const token = randomUUID()
  await db.collection('sessions').insertOne({ sessionToken: token, userId: _id, expires: new Date(Date.now() + 86_400_000) })
  const cookie = `authjs.session-token=${token}`
  const call = (method: string, path: string, body?: unknown, contentType = 'application/json') =>
    fetch(base + path, {
      method,
      headers: { cookie, ...(body === undefined ? {} : { 'Content-Type': contentType }) },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
    })
  return { id: _id.toHexString(), call }
}

describe('API 접근 제어', () => {
  it('세션이 없으면 401', async () => {
    for (const [method, path] of [
      ['GET', '/api/me'],
      ['GET', '/api/todos'],
      ['POST', '/api/todos'],
      ['PATCH', '/api/todos/x'],
      ['DELETE', '/api/todos/x'],
      ['POST', '/api/todos/clear-completed']
    ]) {
      const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' || method === 'DELETE' ? undefined : '{}' })
      expect(res.status, `${method} ${path}`).toBe(401)
    }
  })

  it('없는 세션 토큰은 401', async () => {
    const res = await fetch(base + '/api/todos', { headers: { cookie: 'authjs.session-token=nope' } })
    expect(res.status).toBe(401)
  })

  it('만료된 세션은 401', async () => {
    const _id = new ObjectId()
    await db.collection('users').insertOne({ _id, name: '지난', email: 'old@example.com', emailVerified: null })
    await db.collection('sessions').insertOne({ sessionToken: 'expired', userId: _id, expires: new Date(Date.now() - 1000) })
    const res = await fetch(base + '/api/todos', { headers: { cookie: 'authjs.session-token=expired' } })
    expect(res.status).toBe(401)
  })

  it('깨진 JSON은 스택 없이 JSON 400 (로그인 전후 모두)', async () => {
    const a = await login('에이')
    const anonymous = await fetch(base + '/api/todos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })
    const loggedIn = await a.call('POST', '/api/todos', '{bad')
    for (const res of [anonymous, loggedIn]) {
      expect(res.status).toBe(400)
      expect(res.headers.get('content-type')).toContain('application/json')
      const text = await res.text()
      expect(text).not.toMatch(/<pre>|SyntaxError|node_modules|at /)
    }
  })

  it('다른 사용자의 할 일과 같은 id로 추가하면 409이고 덮어쓰지 않는다', async () => {
    const a = await login('에이')
    const b = await login('비')
    await a.call('POST', '/api/todos', { id: 'same', title: 'A의 것' })
    const res = await b.call('POST', '/api/todos', { id: 'same', title: 'B의 것' })
    expect(res.status).toBe(409)
    expect(await (await a.call('GET', '/api/todos')).json()).toEqual([{ id: 'same', title: 'A의 것', done: false }])
  })

  it('GitHub 키가 비어 있으면 GitHub 대신 로그인 화면으로 이유와 함께 돌려보낸다', async () => {
    const saved = process.env.AUTH_GITHUB_ID
    process.env.AUTH_GITHUB_ID = ''
    try {
      const res = await fetch(base + '/auth/signin/github', { method: 'POST', redirect: 'manual' })
      expect(res.status).toBe(303)
      expect(res.headers.get('location')).toBe('/login?error=GitHubNotConfigured')
    } finally {
      process.env.AUTH_GITHUB_ID = saved
    }
  })

  it('TRUST_PROXY 는 홉 수만 받는다', async () => {
    const { trustProxySetting } = await import('../server/app')
    expect(trustProxySetting(undefined)).toBe('loopback')
    expect(trustProxySetting('')).toBe('loopback')
    expect(trustProxySetting('1')).toBe(1)
    expect(() => trustProxySetting('true')).toThrow('TRUST_PROXY')
    expect(() => trustProxySetting('-1')).toThrow('TRUST_PROXY')
  })

  it('없는 API 주소는 JSON 404', async () => {
    const a = await login('에이')
    const res = await a.call('GET', '/api/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: '없는 주소입니다' })
  })

  it('/api/me 는 세션의 사용자를 돌려준다', async () => {
    const a = await login('에이')
    expect(await (await a.call('GET', '/api/me')).json()).toEqual({ id: a.id, name: '에이' })
  })

  it('A와 B는 서로의 할 일을 보거나 바꿀 수 없다', async () => {
    const a = await login('에이')
    const b = await login('비')
    expect((await a.call('POST', '/api/todos', { id: 'a1', title: '장보기' })).status).toBe(201)
    expect((await a.call('POST', '/api/todos', { id: 'a2', title: '운동' })).status).toBe(201)

    expect(await (await b.call('GET', '/api/todos')).json()).toEqual([])
    await b.call('PATCH', '/api/todos/a1', { title: '해킹', done: true })
    await b.call('DELETE', '/api/todos/a2')
    await b.call('POST', '/api/todos/complete-all', { done: true })
    await b.call('POST', '/api/todos/clear-completed', {})

    expect(await (await a.call('GET', '/api/todos')).json()).toEqual([
      { id: 'a1', title: '장보기', done: false },
      { id: 'a2', title: '운동', done: false }
    ])
  })

  it('본문의 userId는 무시한다', async () => {
    const a = await login('에이')
    const b = await login('비')
    await b.call('POST', '/api/todos', { id: 'b1', title: 'A인 척', userId: a.id })
    expect(await (await a.call('GET', '/api/todos')).json()).toEqual([])
    const doc = await db.collection('todos').findOne({ _id: 'b1' as never })
    expect(doc!.userId.toHexString()).toBe(b.id)
  })

  it('형식이 틀린 값(연산자 객체 등)은 400', async () => {
    const a = await login('에이')
    expect((await a.call('POST', '/api/todos', { id: { $gt: '' }, title: 'x' })).status).toBe(400)
    expect((await a.call('POST', '/api/todos', { id: 'ok', title: { $ne: null } })).status).toBe(400)
    expect((await a.call('POST', '/api/todos', { id: 'bad id!', title: 'x' })).status).toBe(400)
    expect((await a.call('POST', '/api/todos', { id: 'empty', title: '   ' })).status).toBe(400)
    expect((await a.call('PATCH', '/api/todos/ok', { done: 'yes' })).status).toBe(400)
    expect((await a.call('POST', '/api/todos/complete-all', { done: 1 })).status).toBe(400)
    expect(await db.collection('todos').countDocuments()).toBe(0)
  })

  it('JSON이 아닌 변경 요청(다른 사이트의 form 전송)은 415', async () => {
    const a = await login('에이')
    const res = await a.call('POST', '/api/todos', 'id=a1&title=x', 'application/x-www-form-urlencoded')
    expect(res.status).toBe(415)
    expect(await db.collection('todos').countDocuments()).toBe(0)
  })

  it('수정·완료·삭제·일괄 처리가 자기 할 일에 반영된다', async () => {
    const a = await login('에이')
    await a.call('POST', '/api/todos', { id: 't1', title: '하나' })
    await a.call('POST', '/api/todos', { id: 't2', title: '둘' })
    expect((await a.call('PATCH', '/api/todos/t1', { title: ' 하나! ', done: true })).status).toBe(204)
    expect((await a.call('DELETE', '/api/todos/t2')).status).toBe(204)
    expect(await (await a.call('GET', '/api/todos')).json()).toEqual([{ id: 't1', title: '하나!', done: true }])
    await a.call('POST', '/api/todos/clear-completed', {})
    expect(await (await a.call('GET', '/api/todos')).json()).toEqual([])
  })

  it('GitHub 로그인 시작 주소가 있다 (/auth/signin/github)', async () => {
    const csrf = await fetch(base + '/auth/csrf')
    expect(csrf.status).toBe(200)
    const { csrfToken } = await csrf.json()
    const cookie = csrf.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ')
    const res = await fetch(base + '/auth/signin/github', {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
      body: new URLSearchParams({ csrfToken, callbackUrl: '/' })
    })
    const location = new URL(res.headers.get('location')!)
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe('test-client-id')
    expect(location.searchParams.get('redirect_uri')).toBe(`${base}/auth/callback/github`)
  })
})
