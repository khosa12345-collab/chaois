import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ExpressAuth, getSession } from '@auth/express'
import { authConfig } from './auth.js'
import { todosRouter } from './routes/todos.js'

// 로그인한 사람만 통과시키고, 세션의 사용자 id를 res.locals.userId 에 넣는다
async function requireUser(req: Request, res: Response, next: NextFunction) {
  const session = await getSession(req, authConfig)
  const userId = session?.user?.id
  if (!userId) return res.status(401).json({ error: '로그인이 필요합니다' })
  res.locals.userId = userId
  res.locals.userName = session.user?.name || session.user?.email || '사용자'
  next()
}

// 내용을 바꾸는 요청은 JSON만 받는다. 다른 사이트의 <form> 전송(CSRF)은 JSON을 보낼 수 없다.
// OPTIONS(CORS 사전 요청)도 415가 되어 다른 사이트의 fetch DELETE 등이 막힌다. 같은 주소에서만 쓰는 API라 의도한 동작이다.
function requireJson(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'DELETE' && !req.is('application/json')) {
    return res.status(415).json({ error: 'JSON 요청만 받습니다' })
  }
  next()
}

// 어떤 오류든 JSON으로만 답한다. Express 기본 오류 화면은 스택과 파일 경로를 보여 주므로 쓰지 않는다.
function jsonErrors(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err)
  const status = (err as { status?: number }).status
  if (status && status >= 400 && status < 500) return res.status(status).json({ error: '잘못된 요청입니다' })
  console.error(err)
  res.status(500).json({ error: '서버 오류' })
}

// TRUST_PROXY 는 0 이상의 정수(프록시 홉 수)만 받는다. 잘못된 값이면 조용히 무시하지 않고 시작을 멈춘다.
export function trustProxySetting(value: string | undefined): number | 'loopback' {
  if (value === undefined || value === '') return 'loopback'
  const hops = Number(value)
  if (!Number.isInteger(hops) || hops < 0) throw new Error(`TRUST_PROXY 는 프록시 홉 수(0 이상의 정수)여야 합니다: ${value}`)
  return hops
}

export function createApp(options: { clientDir?: string } = {}) {
  const app = express()
  // 같은 컴퓨터의 프록시(개발 중 Vite)가 붙인 X-Forwarded-* 헤더만 믿는다.
  // 앞단 프록시가 따로 있는 곳에 배포하면 TRUST_PROXY 에 그 홉 수를 넣는다(예: 1).
  app.set('trust proxy', trustProxySetting(process.env.TRUST_PROXY))

  // GitHub 키가 비어 있으면 GitHub로 보내지 않는다(빈 client_id면 GitHub가 404를 띄운다). 이유를 로그인 화면에 보여 준다.
  app.post('/auth/signin/github', (_req, res, next) => {
    if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) return next()
    res.redirect(303, '/login?error=GitHubNotConfigured')
  })

  // GitHub 로그인·콜백·로그아웃·세션: /auth/signin/github, /auth/callback/github, /auth/signout ...
  app.use('/auth', ExpressAuth(authConfig))

  app.use('/api', express.json(), requireJson, requireUser)
  app.get('/api/me', (_req, res) => res.json({ id: res.locals.userId, name: res.locals.userName }))
  app.use('/api/todos', todosRouter)
  // 없는 API 주소가 아래의 화면(index.html)으로 넘어가지 않게 한다
  app.use('/api', (_req, res) => res.status(404).json({ error: '없는 주소입니다' }))

  // 빌드된 Vite 클라이언트(dist)가 있으면 같은 주소에서 함께 제공한다 (배포·E2E용)
  const clientDir = options.clientDir && resolve(options.clientDir)
  if (clientDir && existsSync(clientDir)) {
    app.use(express.static(clientDir))
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(clientDir, 'index.html')))
  }
  app.use(jsonErrors)
  return app
}
