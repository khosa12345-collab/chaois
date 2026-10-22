export interface Todo {
  id: string
  title: string
  done: boolean
}

export type Filter = 'all' | 'active' | 'done'

export const FILTER_LABELS: Record<Filter, string> = {
  all: '전체',
  active: '진행 중',
  done: '완료'
}

// id는 호출하는 쪽에서 만든다. reducer를 순수 함수로 유지해 테스트를 결정적으로 만든다.
export type Action =
  | { type: 'add'; id: string; title: string }
  | { type: 'toggle'; id: string }
  | { type: 'edit'; id: string; title: string }
  | { type: 'remove'; id: string }
  | { type: 'toggleAll'; done: boolean }
  | { type: 'clearCompleted' }

export function todosReducer(todos: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case 'add': {
      const title = action.title.trim()
      return title ? [...todos, { id: action.id, title, done: false }] : todos
    }
    case 'toggle':
      return todos.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))
    case 'edit': {
      const title = action.title.trim()
      // 내용을 다 지우고 저장하면 삭제로 본다
      if (!title) return todos.filter((t) => t.id !== action.id)
      return todos.map((t) => (t.id === action.id ? { ...t, title } : t))
    }
    case 'remove':
      return todos.filter((t) => t.id !== action.id)
    case 'toggleAll':
      return todos.map((t) => (t.done === action.done ? t : { ...t, done: action.done }))
    case 'clearCompleted':
      return todos.filter((t) => !t.done)
  }
}

export function visibleTodos(todos: Todo[], filter: Filter): Todo[] {
  if (filter === 'active') return todos.filter((t) => !t.done)
  if (filter === 'done') return todos.filter((t) => t.done)
  return todos
}

export const activeCount = (todos: Todo[]): number => todos.filter((t) => !t.done).length
