import { useState } from 'react'
import { loginWithGitHub } from './api'

// /login?error=... 로 돌아왔을 때 보여 줄 문구 (Auth.js 오류 코드 포함)
const ERROR_MESSAGES: Record<string, string> = {
  GitHubNotConfigured:
    'GitHub 로그인 키가 설정되지 않았습니다. .env.local 의 AUTH_GITHUB_ID 와 AUTH_GITHUB_SECRET 을 채운 뒤 서버를 다시 켜 주세요.',
  AccessDenied: 'GitHub에서 로그인을 취소했습니다.'
}
const DEFAULT_ERROR = 'GitHub 로그인에 실패했습니다. 다시 시도해 주세요.'

export function Login() {
  const [busy, setBusy] = useState(false)
  const errorCode = new URLSearchParams(location.search).get('error')
  const error = errorCode && (ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR)

  return (
    <main className="app login">
      <h1>할 일</h1>
      <p>로그인하면 내 할 일만 보고 관리할 수 있습니다.</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="github"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          loginWithGitHub().catch(() => setBusy(false))
        }}
      >
        GitHub로 로그인
      </button>
    </main>
  )
}
