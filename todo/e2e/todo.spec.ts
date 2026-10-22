import { expect, test, type Page } from '@playwright/test'
import { closeDb, startLoggedIn, waitSaved } from './auth-helpers'

const newTodo = (page: Page) => page.getByLabel('새 할 일')
const items = (page: Page) => page.getByRole('list', { name: '할 일 목록' }).getByRole('listitem')
const remaining = (page: Page) => page.getByRole('status')

async function add(page: Page, ...titles: string[]) {
  for (const t of titles) {
    await newTodo(page).fill(t)
    await newTodo(page).press('Enter')
  }
}

test.beforeEach(async ({ page, context }) => {
  await startLoggedIn(page, context)
})
test.afterAll(closeDb)

test('추가 → 완료 → 필터 → 수정 → 삭제 → 완료 항목 삭제', async ({ page }) => {
  await expect(page.getByText('할 일이 없습니다')).toBeVisible()

  // 추가: 맨 아래에 붙고 입력 칸이 비워진다, 공백만 있으면 무시
  await add(page, '장보기', '운동', '책 읽기')
  await add(page, '   ')
  await expect(items(page)).toHaveText([/장보기/, /운동/, /책 읽기/])
  await expect(newTodo(page)).toHaveValue('')
  await expect(remaining(page)).toHaveText('남은 할 일 3개')

  // 완료: 취소선, 남은 개수 감소
  await page.getByLabel('"운동" 완료').check()
  await expect(items(page).nth(1)).toHaveClass(/done/)
  await expect(items(page).nth(1).locator('.title')).toHaveCSS('text-decoration-line', 'line-through')
  await expect(remaining(page)).toHaveText('남은 할 일 2개')

  // 필터
  await page.getByRole('button', { name: '완료', exact: true }).click()
  await expect(items(page)).toHaveText([/운동/])
  await page.getByRole('button', { name: '진행 중' }).click()
  await expect(items(page)).toHaveText([/장보기/, /책 읽기/])
  await page.getByRole('button', { name: '전체' }).click()
  await expect(items(page)).toHaveCount(3)

  // 수정: 더블클릭 → Enter 저장
  await page.getByText('책 읽기').dblclick()
  const edit = page.getByRole('textbox', { name: '"책 읽기" 수정' })
  await expect(edit).toBeFocused()
  await edit.fill('소설 읽기')
  await edit.press('Enter')
  await expect(items(page).nth(2)).toHaveText(/소설 읽기/)

  // 수정: 버튼 → Esc 취소 (blur가 뒤따라도 저장되지 않는다)
  await page.getByRole('button', { name: '"장보기" 수정' }).click()
  await page.getByRole('textbox', { name: '"장보기" 수정' }).fill('바뀌면 안 됨')
  await page.getByRole('textbox', { name: '"장보기" 수정' }).press('Escape')
  await expect(items(page).nth(0)).toHaveText(/장보기/)
  await expect(page.getByText('바뀌면 안 됨')).toHaveCount(0)

  // 수정: 포커스 해제로 저장
  await page.getByRole('button', { name: '"장보기" 수정' }).click()
  await page.getByRole('textbox', { name: '"장보기" 수정' }).fill('장보기 (우유)')
  await newTodo(page).click()
  await expect(items(page).nth(0)).toHaveText(/장보기 \(우유\)/)

  // 삭제
  await page.getByRole('button', { name: '"소설 읽기" 삭제' }).click()
  await expect(items(page)).toHaveText([/장보기 \(우유\)/, /운동/])

  // 완료 항목 삭제
  await page.getByRole('button', { name: '완료 항목 삭제' }).click()
  await expect(items(page)).toHaveText([/장보기 \(우유\)/])
  await expect(page.getByRole('button', { name: '완료 항목 삭제' })).toBeDisabled()

  // 모두 완료 토글
  await add(page, '청소')
  await page.getByLabel('모두 완료').check()
  await expect(remaining(page)).toHaveText('남은 할 일 0개')
  await page.getByLabel('모두 완료').uncheck()
  await expect(remaining(page)).toHaveText('남은 할 일 2개')
})

test('새로고침해도 목록과 완료 상태가 유지된다', async ({ page }) => {
  await add(page, '장보기', '운동')
  await page.getByLabel('"운동" 완료').check()
  await waitSaved(page)
  await page.reload()
  await expect(items(page)).toHaveText([/장보기/, /운동/])
  await expect(page.getByLabel('"운동" 완료')).toBeChecked()
  await expect(page.getByLabel('"장보기" 완료')).not.toBeChecked()
  await expect(remaining(page)).toHaveText('남은 할 일 1개')
})

test('키보드만으로 추가·완료·수정·삭제할 수 있다', async ({ page }) => {
  // 첫 화면에서 입력 칸에 바로 포커스가 있다
  await expect(newTodo(page)).toBeFocused()
  await page.keyboard.type('장보기')
  await page.keyboard.press('Enter')
  await page.keyboard.type('운동')
  await page.keyboard.press('Enter')
  await expect(items(page)).toHaveCount(2)

  // Tab 순서: 입력 칸 → 추가 → 모두 완료 → 1번 체크박스 → 1번 수정 → 1번 삭제 → 2번 체크박스
  const tabTo = async (name: string) => {
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      if ((await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === name) return
    }
    throw new Error(`Tab으로 ${name}에 도달하지 못함`)
  }

  await tabTo('"운동" 완료')
  await page.keyboard.press('Space')
  await expect(page.getByLabel('"운동" 완료')).toBeChecked()

  await tabTo('"운동" 수정')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('textbox', { name: '"운동" 수정' })).toBeFocused()
  await page.keyboard.press('End')
  await page.keyboard.type(' 30분')
  await page.keyboard.press('Enter')
  await expect(items(page).nth(1)).toHaveText(/운동 30분/)
  // 편집을 마치면 수정 버튼으로 포커스가 돌아온다
  await expect(page.getByRole('button', { name: '"운동 30분" 수정' })).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '"운동 30분" 삭제' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(items(page)).toHaveText([/장보기/])
})
