import { MongoClient, type Db } from 'mongodb'
import { ensureIndexes } from './todos-repo'

export const DB_NAME = 'todoapp'

// 개발 서버가 파일을 다시 불러와도 연결을 하나만 쓰도록 globalThis에 둔다
const cache = globalThis as unknown as { mongoClient?: Promise<MongoClient>; indexes?: Promise<void> }

// 처음 쓰일 때 연결한다. 빌드할 때 MONGODB_URI가 없어도 실패하지 않게 하기 위해서다.
export function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI 환경 변수가 없습니다. .env.local 을 확인하세요.')
  cache.mongoClient ??= new MongoClient(uri).connect()
  return cache.mongoClient
}

export async function getDb(): Promise<Db> {
  const db = (await getClient()).db(DB_NAME)
  await (cache.indexes ??= ensureIndexes(db))
  return db
}
