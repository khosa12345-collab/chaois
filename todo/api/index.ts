import { createApp } from '../server/app.js'

// Vercel 배포용 입구. /api, /auth 요청을 모두 이 Express 앱이 받는다 (vercel.json 의 rewrites).
// 화면(dist)은 Vercel이 따로 제공하므로 clientDir 는 넘기지 않는다.
export default createApp()
