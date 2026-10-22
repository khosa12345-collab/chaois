import { describe, expect, it } from 'vitest'
import { activeCount, todosReducer, visibleTodos, type Todo } from '../src/todos'

const base: Todo[] = [
  { id: 'a', title: '장보기', done: false },
  { id: 'b', title: '운동', done: true },
  { id: 'c', title: '책 읽기', done: false }
]

// reducer 호출 전에 떠 둔 사본. 호출 뒤 base가 이것과 같아야 불변이 지켜진 것이다.
const snapshot = structuredClone(base)

describe('todosReducer', () => {
  it('add: 앞뒤 공백을 잘라 맨 아래에 미완료로 추가한다', () => {
    const next = todosReducer(base, { type: 'add', id: 'd', title: '  빨래  ' })
    expect(next.at(-1)).toEqual({ id: 'd', title: '빨래', done: false })
    expect(next).toHaveLength(4)
    expect(base).toEqual(snapshot)
  })

  it('add: 빈 문자열·공백만 있으면 무시하고 같은 배열을 돌려준다', () => {
    expect(todosReducer(base, { type: 'add', id: 'd', title: '' })).toBe(base)
    expect(todosReducer(base, { type: 'add', id: 'd', title: '   ' })).toBe(base)
  })

  it('toggle: 해당 항목만 완료 상태를 뒤집는다', () => {
    const next = todosReducer(base, { type: 'toggle', id: 'a' })
    expect(next.map((t) => t.done)).toEqual([true, true, false])
    expect(next[1]).toBe(base[1])
    expect(base).toEqual(snapshot)
  })

  it('edit: 공백을 잘라 제목을 바꾼다', () => {
    const next = todosReducer(base, { type: 'edit', id: 'c', title: ' 소설 읽기 ' })
    expect(next[2]).toEqual({ id: 'c', title: '소설 읽기', done: false })
    expect(base).toEqual(snapshot)
  })

  it('edit: 빈 제목으로 저장하면 그 항목을 삭제한다', () => {
    const next = todosReducer(base, { type: 'edit', id: 'a', title: '  ' })
    expect(next.map((t) => t.id)).toEqual(['b', 'c'])
  })

  it('remove: 해당 항목을 지운다', () => {
    const next = todosReducer(base, { type: 'remove', id: 'b' })
    expect(next.map((t) => t.id)).toEqual(['a', 'c'])
    expect(base).toEqual(snapshot)
  })

  it('toggleAll: 모두 완료 / 모두 미완료로 바꾼다', () => {
    expect(todosReducer(base, { type: 'toggleAll', done: true }).every((t) => t.done)).toBe(true)
    expect(todosReducer(base, { type: 'toggleAll', done: false }).every((t) => !t.done)).toBe(true)
    expect(base).toEqual(snapshot)
  })

  it('clearCompleted: 완료 항목만 지운다', () => {
    expect(todosReducer(base, { type: 'clearCompleted' }).map((t) => t.id)).toEqual(['a', 'c'])
    expect(base).toEqual(snapshot)
  })

  it('없는 id에 대한 동작은 목록을 바꾸지 않는다', () => {
    expect(todosReducer(base, { type: 'toggle', id: 'zz' })).toEqual(base)
    expect(todosReducer(base, { type: 'remove', id: 'zz' })).toEqual(base)
    expect(todosReducer(base, { type: 'edit', id: 'zz', title: 'x' })).toEqual(base)
  })
})

describe('visibleTodos / activeCount', () => {
  it('필터별 목록', () => {
    expect(visibleTodos(base, 'all')).toEqual(base)
    expect(visibleTodos(base, 'active').map((t) => t.id)).toEqual(['a', 'c'])
    expect(visibleTodos(base, 'done').map((t) => t.id)).toEqual(['b'])
  })

  it('남은 개수', () => {
    expect(activeCount(base)).toBe(2)
    expect(activeCount([])).toBe(0)
  })
})
