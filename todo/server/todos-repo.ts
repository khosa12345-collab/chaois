import { ObjectId, type Db } from 'mongodb'
import type { Todo } from '../src/todos'

// docs/login.md §4: 할 일마다 만든 사람의 users._id 를 붙인다
export interface TodoDoc {
  _id: string
  userId: ObjectId
  title: string
  done: boolean
  createdAt: Date
}

export const MAX_TITLE = 500
// 화면에서 만든 id(UUID 등)를 그대로 _id로 쓴다. 형식만 제한한다.
const ID_PATTERN = /^[\w-]{1,64}$/

// API가 400으로 답할 수 있게 입력 오류를 다른 오류(DB 장애 등)와 구분한다
export class InvalidInputError extends Error {}

const todos = (db: Db) => db.collection<TodoDoc>('todos')
const cleanTitle = (title: string) => title.trim().slice(0, MAX_TITLE)

// 모든 함수는 userId를 받아 조건에 넣는다. userId는 반드시 서버 세션에서 얻은 값이어야 한다.
const owner = (userId: string) => new ObjectId(userId)

const toTodo = (d: TodoDoc): Todo => ({ id: d._id, title: d.title, done: d.done })

export async function ensureIndexes(db: Db): Promise<void> {
  await todos(db).createIndex({ userId: 1, createdAt: 1 })
}

export async function listTodos(db: Db, userId: string): Promise<Todo[]> {
  const docs = await todos(db).find({ userId: owner(userId) }).sort({ createdAt: 1, _id: 1 }).toArray()
  return docs.map(toTodo)
}

// 빈 제목이면 만들지 않고 null을 돌려준다
export async function createTodo(db: Db, userId: string, id: string, title: string): Promise<Todo | null> {
  if (!ID_PATTERN.test(id)) throw new InvalidInputError('잘못된 할 일 id입니다')
  const clean = cleanTitle(title)
  if (!clean) return null
  const doc: TodoDoc = { _id: id, userId: owner(userId), title: clean, done: false, createdAt: new Date() }
  await todos(db).insertOne(doc)
  return toTodo(doc)
}

// 제목을 빈 문자열로 바꾸면 삭제로 본다(화면의 동작과 같음)
export async function updateTodo(
  db: Db,
  userId: string,
  id: string,
  patch: { title?: string; done?: boolean }
): Promise<void> {
  const set: Partial<Pick<TodoDoc, 'title' | 'done'>> = {}
  if (patch.title !== undefined) {
    const clean = cleanTitle(patch.title)
    if (!clean) return deleteTodo(db, userId, id)
    set.title = clean
  }
  if (patch.done !== undefined) set.done = patch.done
  if (Object.keys(set).length === 0) return
  await todos(db).updateOne({ _id: id, userId: owner(userId) }, { $set: set })
}

export async function deleteTodo(db: Db, userId: string, id: string): Promise<void> {
  await todos(db).deleteOne({ _id: id, userId: owner(userId) })
}

export async function setAllDone(db: Db, userId: string, done: boolean): Promise<void> {
  await todos(db).updateMany({ userId: owner(userId) }, { $set: { done } })
}

export async function clearCompleted(db: Db, userId: string): Promise<void> {
  await todos(db).deleteMany({ userId: owner(userId), done: true })
}
