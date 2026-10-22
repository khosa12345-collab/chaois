import { expect, test, type Page } from '@playwright/test'
import { closeDb, startLoggedIn } from './auth-helpers'

// 한글 IME: 마지막 음절이 조합 중인 상태에서 Enter를 누른 뒤 조합이 확정되는 상황을 CDP로 재현한다
async function typeKoreanThenEnter(page: Page, done: string, composing: string) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.insertText', { text: done })
  await cdp.send('Input.imeSetComposition', {
    text: composing,
    selectionStart: composing.length,
    selectionEnd: composing.length
  })
  await page.keyboard.press('Enter')
  await cdp.send('Input.insertText', { text: composing })
}

const titles = (page: Page) => page.getByRole('list', { name: '할 일 목록' }).locator('.title')

test.beforeEach(async ({ page, context }) => {
  await startLoggedIn(page, context)
})
test.afterAll(closeDb)

test('조합 중 Enter로 추가해도 마지막 글자가 입력 칸에 남지 않는다', async ({ page }) => {
  await page.getByLabel('새 할 일').click()
  await typeKoreanThenEnter(page, '월요일 회', '의')
  await expect(titles(page)).toHaveText(['월요일 회의'])
  await expect(page.getByLabel('새 할 일')).toHaveValue('')

  // 이어서 Enter를 한 번 더 눌러도 남은 글자로 된 항목이 생기지 않는다
  await page.getByLabel('새 할 일').press('Enter')
  await expect(titles(page)).toHaveText(['월요일 회의'])
})

test('조합 중 Enter로 수정해도 마지막 글자까지 저장된다', async ({ page }) => {
  await page.getByLabel('새 할 일').fill('운동')
  await page.getByLabel('새 할 일').press('Enter')
  await page.getByRole('button', { name: '"운동" 수정' }).click()
  await page.getByRole('textbox', { name: '"운동" 수정' }).press('End')
  await typeKoreanThenEnter(page, ' 30분 요', '가')
  await expect(titles(page)).toHaveText(['운동 30분 요가'])
  await expect(page.locator('li.editing')).toHaveCount(0)

  // 한글로 수정한 항목도 삭제된다
  await page.getByRole('button', { name: '"운동 30분 요가" 삭제' }).click()
  await expect(titles(page)).toHaveCount(0)
})
