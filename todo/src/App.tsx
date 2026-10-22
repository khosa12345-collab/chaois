import { useEffect, useState } from 'react'
import { fetchMe, fetchTodos, logout, type Me } from './api'
import { Login } from './Login'
import type { Todo } from './todos'
import { TodoList } from './TodoList'

type State =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'user'; me: Me; todos: Todo[] }
  | { status: 'error' }

// 주소는 / (할 일)와 /login 두 개뿐이라 라우터 없이 로그인 상태에 맞춰 주소를 바꾼다
const goTo = (path: string) => {
  if (location.pathname !== path) history.replaceState(null, '', path)
}

export function App() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    ;(async () => {
      const me = await fetchMe()
      if (!me) {
        goTo('/login')
        return setState({ status: 'guest' })
      }
      const todos = await fetchTodos()
      goTo('/')
      setState({ status: 'user', me, todos })
    })().catch(() => setState({ status: 'error' }))
  }, [])

  if (state.status === 'loading') return null
  if (state.status === 'guest') return <Login />
  if (state.status === 'error') {
    return (
      <main className="app">
        <p role="alert" className="error">
          서버에 연결하지 못했습니다. 잠시 뒤 새로고침해 주세요.
        </p>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="user-bar">
        <span>{state.me.name}님 환영합니다</span>
        <button type="button" onClick={() => void logout()}>
          로그아웃
        </button>
      </header>
      <TodoList initialTodos={state.todos} />
    </main>
  )
}
