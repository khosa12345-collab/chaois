import { expect, test, type Page } from '@playwright/test'
import { closeDb, createUser, loginAs, resetDb, sessionExists, waitSaved } from './auth-helpers'

const newTodo = (page: Page) => page.getByLabel('새 할 일')
const titles = (page: Page) => page.getByRole('list', { name: '할 일 목록' }).locator('.title')

async function add(page: Page, ...items: string[]) {
  for (const t of items) {
    await newTodo(page).fill(t)
    await newTodo(page).press('Enter')
    await expect(titles(page).last()).toHaveText(t)
  }
  await waitSaved(page)
}

test.beforeEach(resetDb)
test.afterAll(closeDb)

// docs/login.md §9 완료 조건 (GitHub 로그인으로 조정)
test('A와 B는 서로의 할 일을 볼 수 없다', async ({ page, context }) => {
  const a = await createUser('에이')
  const b = await createUser('비')

  await loginAs(context, a)
  await page.goto('/')
  await expect(page.getByText('에이님 환영합니다')).toBeVisible()
  await add(page, '장보기', '운동')

  await loginAs(context, b)
  await page.goto('/')
  await expect(page.getByText('비님 환영합니다')).toBeVisible()
  await expect(page.getByText('할 일이 없습니다')).toBeVisible()
  await expect(page.getByText('장보기')).toHaveCount(0)
  await add(page, 'B의 할 일')

  await loginAs(context, a)
  await page.goto('/')
  await expect(titles(page)).toHaveText(['장보기', '운동'])
})

test('로그인하지 않으면 /login 으로 이동하고, GitHub 인증 주소로 보낸다', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)

  // 실제 GitHub에는 접속하지 않는다. 302 리다이렉트의 목적지는 page.route로 가로챌 수 없으므로,
  // 로그인 form POST를 가로채 서버의 실제 응답(Location)만 받아 확인하고 브라우저는 그 자리에 멈춘다.
  let location = ''
  await page.route('**/auth/signin/github', async (route) => {
    const res = await route.fetch({ maxRedirects: 0 })
    location = res.headers()['location'] ?? ''
    await route.fulfill({ status: 200, contentType: 'text/plain', body: 'github stub' })
  })
  await page.getByRole('button', { name: 'GitHub로 로그인' }).click()
  await expect(page.getByText('github stub')).toBeVisible()

  const url = new URL(location)
  expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize')
  expect(url.searchParams.get('client_id')).toBe('e2e-client-id')
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3100/auth/callback/github')
})

test('로그인한 상태로 /login 에 가면 / 로 이동한다', async ({ page, context }) => {
  await loginAs(context, await createUser('에이'))
  await page.goto('/login')
  await expect(page).toHaveURL(/localhost:3100\/$/)
})

test('로그아웃하면 세션이 지워지고, 같은 쿠키로는 들어갈 수 없다', async ({ page, context }) => {
  const a = await createUser('에이')
  await loginAs(context, a)
  await page.goto('/')
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await sessionExists(a.sessionToken)).toBe(false)

  await loginAs(context, a) // 지워진 세션 쿠키를 다시 넣어 본다
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('세션이 없으면 API로 할 일을 바꿀 수 없다', async ({ page, context }) => {
  const a = await createUser('에이')
  await loginAs(context, a)
  await page.goto('/')
  await add(page, '장보기')

  // 화면은 그대로 둔 채 세션을 지운 뒤 추가를 시도한다
  await context.clearCookies()
  await newTodo(page).fill('몰래 추가')
  await newTodo(page).press('Enter')
  await expect(page.getByRole('alert')).toContainText('저장하지 못한 변경이 있습니다')

  await loginAs(context, a)
  await page.reload()
  await expect(titles(page)).toHaveText(['장보기'])
})
