import type { ExpressAuthConfig } from '@auth/express'
import GitHub from '@auth/express/providers/github'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import { DB_NAME, getClient } from './db'

// GitHub 키는 AUTH_GITHUB_ID / AUTH_GITHUB_SECRET, 서명 키는 AUTH_SECRET 환경 변수에서 읽는다
export const authConfig: ExpressAuthConfig = {
  // 함수로 넘겨 첫 요청 때 연결한다
  adapter: MongoDBAdapter(getClient, { databaseName: DB_NAME }),
  providers: [GitHub],
  // 세션을 todoapp.sessions 에 저장한다. 로그아웃하면 서버에서 세션이 지워진다.
  session: { strategy: 'database' },
  // 개발 중에는 Vite 프록시(localhost:5173)를 거쳐 들어오므로 요청의 Host로 주소를 만든다
  trustHost: true,
  // 로그인 오류(사용자가 GitHub에서 취소 등)도 Auth.js 영어 기본 화면 대신 우리 로그인 화면으로 보낸다
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id
      return session
    }
  }
}
