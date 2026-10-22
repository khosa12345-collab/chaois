import type { Todo } from './todos'

export interface Me {
  id: string
  name: string
}

// 서버로 보내는 할 일 변경. userId는 들어 있지 않다(서버가 세션에서 얻는다).
export type TodoOp =
  | { type: 'create'; id: string; title: string }
  | { type: 'update'; id: string; title?: string; done?: boolean }
  | { type: 'delete'; id: string }
  | { type: 'setAllDone'; done: boolean }
  | { type: 'clearCompleted' }

export class UnauthorizedError extends Error {}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) throw new Error(`${method} ${path} 실패: ${res.status}`)
  return res
}

export async function fetchMe(): Promise<Me | null> {
  try {
    return await (await request('GET', '/api/me')).json()
  } catch (err) {
    if (err instanceof UnauthorizedError) return null
    throw err
  }
}

export const fetchTodos = async (): Promise<Todo[]> => (await request('GET', '/api/todos')).json()

export async function applyTodoOp(op: TodoOp): Promise<void> {
  const id = 'id' in op ? encodeURIComponent(op.id) : ''
  switch (op.type) {
    case 'create':
      await request('POST', '/api/todos', { id: op.id, title: op.title })
      return
    case 'update':
      await request('PATCH', `/api/todos/${id}`, { title: op.title, done: op.done })
      return
    case 'delete':
      await request('DELETE', `/api/todos/${id}`)
      return
    case 'setAllDone':
      await request('POST', '/api/todos/complete-all', { done: op.done })
      return
    case 'clearCompleted':
      await request('POST', '/api/todos/clear-completed', {})
  }
}

// Auth.js의 로그인·로그아웃은 CSRF 토큰을 담은 form POST여야 한다. 브라우저가 그 응답(리다이렉트)을 따라간다.
async function postAuthForm(action: string, fields: Record<string, string>): Promise<void> {
  const { csrfToken } = await (await fetch('/auth/csrf')).json()
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = action
  for (const [name, value] of Object.entries({ ...fields, csrfToken })) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.append(input)
  }
  document.body.append(form)
  form.submit()
}

export const loginWithGitHub = () => postAuthForm('/auth/signin/github', { callbackUrl: '/' })
export const logout = () => postAuthForm('/auth/signout', { callbackUrl: '/login' })
