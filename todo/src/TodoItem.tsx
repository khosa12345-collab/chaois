import { useEffect, useRef, useState, type Dispatch, type KeyboardEvent } from 'react'
import { isComposing } from './ime'
import type { Action, Todo } from './todos'

interface Props {
  todo: Todo
  dispatch: Dispatch<Action>
}

export function TodoItem({ todo, dispatch }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(todo.title)
  // Enter/Esc로 끝낸 뒤 입력 칸이 사라지면서 생기는 blur가 한 번 더 저장(또는 취소를 무시하고 저장)하지 않게 막는다
  const closed = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const editInput = useRef<HTMLInputElement>(null)

  // autoFocus는 포커스를 가진 '수정' 버튼이 사라지는 순간과 겹치면 body로 밀려난다. 렌더가 끝난 뒤 직접 포커스한다.
  useEffect(() => {
    if (editing) editInput.current?.focus()
  }, [editing])

  const startEdit = () => {
    closed.current = false
    setText(todo.title)
    setEditing(true)
  }

  // 조합 중에 Enter를 누르면 조합이 끝난 뒤(완성된 글자로) 저장한다
  const saveAfterComposition = useRef(false)

  const finish = (save: boolean, title = text) => {
    if (closed.current) return
    closed.current = true
    if (save) dispatch({ type: 'edit', id: todo.id, title })
    setEditing(false)
    // 편집을 마치면 키보드 사용자가 제자리에서 이어갈 수 있게 수정 버튼으로 포커스를 돌린다
    requestAnimationFrame(() => editButton.current?.focus())
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 조합 중 Esc는 IME가 조합을 취소하는 키이므로 편집 취소로 보지 않는다
    if (isComposing(e)) {
      if (e.key === 'Enter') saveAfterComposition.current = true
      return
    }
    if (e.key === 'Enter') finish(true)
    else if (e.key === 'Escape') finish(false)
  }

  if (editing) {
    return (
      <li className="todo editing">
        <input
          ref={editInput}
          className="edit"
          aria-label={`"${todo.title}" 수정`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onCompositionEnd={(e) => {
            if (!saveAfterComposition.current) return
            saveAfterComposition.current = false
            finish(true, e.currentTarget.value)
          }}
          onBlur={(e) => finish(true, e.currentTarget.value)}
        />
      </li>
    )
  }

  return (
    <li className={todo.done ? 'todo done' : 'todo'}>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => dispatch({ type: 'toggle', id: todo.id })}
        aria-label={`"${todo.title}" 완료`}
      />
      <span className="title" onDoubleClick={startEdit}>
        {todo.title}
      </span>
      <button type="button" ref={editButton} onClick={startEdit} aria-label={`"${todo.title}" 수정`}>
        수정
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: 'remove', id: todo.id })}
        aria-label={`"${todo.title}" 삭제`}
      >
        삭제
      </button>
    </li>
  )
}
