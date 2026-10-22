import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MongoClient, ObjectId, type Db } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import {
  clearCompleted,
  createTodo,
  deleteTodo,
  listTodos,
  MAX_TITLE,
  setAllDone,
  updateTodo,
  type TodoDoc
} from '../server/todos-repo'

let server: MongoMemoryServer
let client: MongoClient
let db: Db
const A = new ObjectId().toHexString()
const B = new ObjectId().toHexString()

beforeAll(async () => {
  server = await MongoMemoryServer.create()
  client = await new MongoClient(server.getUri()).connect()
  db = client.db('todoapp')
})

afterAll(async () => {
  await client?.close()
  await server?.stop()
})

beforeEach(async () => {
  await db.collection('todos').deleteMany({})
})

const raw = (id: string) => db.collection<TodoDoc>('todos').findOne({ _id: id })

describe('todos-repo', () => {
  it('문서 형태: _id, userId(ObjectId), title, done, createdAt', async () => {
    await createTodo(db, A, 't1', '장보기')
    const doc = await raw('t1')
    expect(doc).toMatchObject({ _id: 't1', title: '장보기', done: false })
    expect(doc!.userId).toBeInstanceOf(ObjectId)
    expect(doc!.userId.toHexString()).toBe(A)
    expect(doc!.createdAt).toBeInstanceOf(Date)
  })

  it('listTodos는 그 사용자의 할 일만 만든 순서대로 돌려준다', async () => {
    await createTodo(db, A, 'a1', '장보기')
    await createTodo(db, B, 'b1', 'B의 할 일')
    await createTodo(db, A, 'a2', '운동')
    expect(await listTodos(db, A)).toEqual([
      { id: 'a1', title: '장보기', done: false },
      { id: 'a2', title: '운동', done: false }
    ])
    expect((await listTodos(db, B)).map((t) => t.id)).toEqual(['b1'])
  })

  it('다른 사용자의 할 일은 id를 알아도 수정·삭제할 수 없다', async () => {
    await createTodo(db, A, 'a1', '장보기')
    await createTodo(db, A, 'a2', '운동')
    await updateTodo(db, B, 'a1', { title: '해킹', done: true })
    await updateTodo(db, B, 'a2', { title: '' }) // 빈 제목 = 삭제 경로
    await deleteTodo(db, B, 'a1')
    await setAllDone(db, B, true)
    await clearCompleted(db, B)
    expect(await listTodos(db, A)).toEqual([
      { id: 'a1', title: '장보기', done: false },
      { id: 'a2', title: '운동', done: false }
    ])
  })

  it('다른 사용자가 같은 id로 만들어 덮어쓸 수 없다', async () => {
    await createTodo(db, A, 'same', 'A의 것')
    await expect(createTodo(db, B, 'same', 'B의 것')).rejects.toThrow()
    expect(await raw('same')).toMatchObject({ title: 'A의 것' })
    expect(await listTodos(db, B)).toEqual([])
  })

  it('제목 공백을 자르고, 빈 제목 추가는 거부한다', async () => {
    expect(await createTodo(db, A, 't1', '  빨래  ')).toEqual({ id: 't1', title: '빨래', done: false })
    expect(await createTodo(db, A, 't2', '   ')).toBeNull()
    expect(await raw('t2')).toBeNull()
  })

  it('제목은 500자로 자른다', async () => {
    await createTodo(db, A, 't1', 'x'.repeat(MAX_TITLE + 50))
    expect((await raw('t1'))!.title).toHaveLength(MAX_TITLE)
  })

  it('잘못된 형식의 id는 거부한다', async () => {
    await expect(createTodo(db, A, '{"$gt":""}', '장보기')).rejects.toThrow('id')
    await expect(createTodo(db, A, '', '장보기')).rejects.toThrow('id')
  })

  it('updateTodo: 제목·완료를 바꾸고, 빈 제목이면 삭제한다', async () => {
    await createTodo(db, A, 't1', '책')
    await updateTodo(db, A, 't1', { title: ' 소설 ', done: true })
    expect(await raw('t1')).toMatchObject({ title: '소설', done: true })
    await updateTodo(db, A, 't1', { title: '  ' })
    expect(await raw('t1')).toBeNull()
  })

  it('deleteTodo / setAllDone / clearCompleted', async () => {
    await createTodo(db, A, 't1', '하나')
    await createTodo(db, A, 't2', '둘')
    await createTodo(db, A, 't3', '셋')
    await deleteTodo(db, A, 't2')
    expect((await listTodos(db, A)).map((t) => t.id)).toEqual(['t1', 't3'])

    await setAllDone(db, A, true)
    expect((await listTodos(db, A)).every((t) => t.done)).toBe(true)
    await setAllDone(db, A, false)
    expect((await listTodos(db, A)).every((t) => !t.done)).toBe(true)

    await updateTodo(db, A, 't3', { done: true })
    await clearCompleted(db, A)
    expect((await listTodos(db, A)).map((t) => t.id)).toEqual(['t1'])
  })

  it('잘못된 userId는 예외를 던진다 (세션 값이 아니면 쓰지 않음)', async () => {
    await expect(listTodos(db, 'not-an-object-id')).rejects.toThrow()
  })
})
