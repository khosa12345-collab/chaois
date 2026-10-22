import { useReducer, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { applyTodoOp, type TodoOp } from './api'
import { isComposing } from './ime'
import { activeCount, FILTER_LABELS, todosReducer, visibleTodos, type Action, type Filter, type Todo } from './todos'
import { TodoItem } from './TodoItem'

const FILTERS = Object.keys(FILTER_LABELS) as Filter[]

// randomUUID는 보안 컨텍스트(https, localhost)에서만 있다. 같은 망의 IP로 http 접속해도 추가가 되도록 대체값을 둔다.
const newId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

// 화면의 동작을 서버에 보낼 변경으로 바꾼다. 바뀔 것이 없으면 null.
function toOp(action: Action, todos: Todo[]): TodoOp | null {
  switch (action.type) {
    case 'add':
      return action.title.trim() ? { type: 'create', id: action.id, title: action.title } : null
    case 'toggle': {
      const todo = todos.find((t) => t.id === action.id)
      return todo ? { type: 'update', id: action.id, done: !todo.done } : null
    }
    case 'edit':
      return { type: 'update', id: action.id, title: action.title }
    case 'remove':
      return { type: 'delete', id: action.id }
    case 'toggleAll':
      return { type: 'setAllDone', done: action.done }
    case 'clearCompleted':
      return { type: 'clearCompleted' }
  }
}

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, localDispatch] = useReducer(todosReducer, initialTodos)
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [pending, setPending] = useState(0)
  // 조합 중에 Enter를 누르면 조합이 끝난 뒤(완성된 글자로) 추가한다
  const addAfterComposition = useRef(false)
  // 저장 요청 줄. fetch는 동시에 나가므로 '추가 → 바로 삭제'가 서버에 거꾸로 닿지 않게 하나씩 보낸다.
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

  // 화면에 먼저 반영하고 서버에 저장한다
  const dispatch = (action: Action) => {
    const op = toOp(action, todos)
    localDispatch(action)
    if (!op) return
    setPending((n) => n + 1)
    saveQueue.current = saveQueue.current
      .then(() => applyTodoOp(op))
      .catch(() => setSaveFailed(true))
      .finally(() => setPending((n) => n - 1))
  }

  const add = (title: string) => {
    // 공백만 입력했으면 reducer가 무시한다. 어느 쪽이든 입력 칸은 비운다.
    dispatch({ type: 'add', id: newId(), title })
    setDraft('')
  }

  const onAdd = (e: FormEvent) => {
    e.preventDefault()
    add(draft)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isComposing(e)) {
      e.preventDefault()
      addAfterComposition.current = true
    }
  }

  const remaining = activeCount(todos)
  const allDone = todos.length > 0 && remaining === 0
  const shown = visibleTodos(todos, filter)

  return (
    // 저장 중이면 aria-busy=true (화면 읽기 프로그램과 테스트가 저장 완료를 알 수 있다)
    <div className="todo-app" aria-busy={pending > 0}>
      <h1>할 일</h1>

      {saveFailed && (
        <p role="alert" className="error">
          저장하지 못한 변경이 있습니다.{' '}
          <button type="button" onClick={() => location.reload()}>
            다시 불러오기
          </button>
        </p>
      )}

      <form onSubmit={onAdd} className="new-todo">
        <label htmlFor="new-todo" className="sr-only">
          새 할 일
        </label>
        <input
          id="new-todo"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onCompositionEnd={(e) => {
            if (!addAfterComposition.current) return
            addAfterComposition.current = false
            add(e.currentTarget.value)
          }}
          placeholder="할 일을 입력하고 Enter"
          autoComplete="off"
          autoFocus
        />
        <button type="submit">추가</button>
      </form>

      {todos.length === 0 ? (
        <p className="empty">할 일이 없습니다. 위 칸에 입력해 추가하세요.</p>
      ) : (
        <>
          <label className="toggle-all">
            <input
              type="checkbox"
              checked={allDone}
              onChange={() => dispatch({ type: 'toggleAll', done: !allDone })}
            />
            모두 완료
          </label>

          <ul className="todo-list" aria-label="할 일 목록">
            {shown.map((todo) => (
              <TodoItem key={todo.id} todo={todo} dispatch={dispatch} />
            ))}
          </ul>
          {shown.length === 0 && <p className="empty">이 필터에 해당하는 할 일이 없습니다.</p>}

          <footer className="footer">
            <span role="status">남은 할 일 {remaining}개</span>
            <nav aria-label="필터" className="filters">
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => dispatch({ type: 'clearCompleted' })}
              disabled={todos.length === remaining}
            >
              완료 항목 삭제
            </button>
          </footer>
        </>
      )}
    </div>
  )
}
