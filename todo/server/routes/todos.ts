import { Router, type NextFunction, type Request, type Response } from 'express'
import { MongoServerError } from 'mongodb'
import { getDb } from '../db'
import * as repo from '../todos-repo'

// requireUser 가 넣어 둔, 서버 세션의 사용자 id. 요청 본문의 값은 쓰지 않는다.
const userIdOf = (res: Response): string => res.locals.userId

const isStr = (v: unknown): v is string => typeof v === 'string'
const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

const badRequest = (res: Response) => res.status(400).json({ error: '잘못된 요청입니다' })

// express.json() 은 객체도 그대로 넘기므로 필드 형식을 직접 확인한다 ({"$gt": ""} 같은 값 차단)
export const todosRouter = Router()

todosRouter.get('/', async (_req, res) => {
  res.json(await repo.listTodos(await getDb(), userIdOf(res)))
})

todosRouter.post('/', async (req, res) => {
  const { id, title } = req.body ?? {}
  if (!isStr(id) || !isStr(title)) return badRequest(res)
  const todo = await repo.createTodo(await getDb(), userIdOf(res), id, title)
  if (!todo) return badRequest(res)
  res.status(201).json(todo)
})

todosRouter.post('/complete-all', async (req, res) => {
  const { done } = req.body ?? {}
  if (!isBool(done)) return badRequest(res)
  await repo.setAllDone(await getDb(), userIdOf(res), done)
  res.status(204).end()
})

todosRouter.post('/clear-completed', async (_req, res) => {
  await repo.clearCompleted(await getDb(), userIdOf(res))
  res.status(204).end()
})

todosRouter.patch('/:id', async (req, res) => {
  const { title, done } = req.body ?? {}
  if ((title !== undefined && !isStr(title)) || (done !== undefined && !isBool(done))) return badRequest(res)
  await repo.updateTodo(await getDb(), userIdOf(res), req.params.id, { title, done })
  res.status(204).end()
})

todosRouter.delete('/:id', async (req, res) => {
  await repo.deleteTodo(await getDb(), userIdOf(res), req.params.id)
  res.status(204).end()
})

// 저장소의 입력 오류(잘못된 id 형식 등)는 400, 이미 있는 id로 추가하면 409. 그 밖의 오류는 앱 공통 처리(500)로 넘긴다.
todosRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err)
  if (err instanceof repo.InvalidInputError) return badRequest(res)
  if (err instanceof MongoServerError && err.code === 11000) return res.status(409).json({ error: '이미 있는 할 일 id입니다' })
  next(err)
})
