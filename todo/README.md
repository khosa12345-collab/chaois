# 할 일 (todo)

GitHub 계정으로 로그인해서 **내 할 일만** 보고 관리하는 앱입니다.

- **클라이언트**: Vite + React (`src/`)
- **서버**: Express + Auth.js(`@auth/express`, GitHub OAuth) (`server/`)
- **DB**: MongoDB, 데이터베이스 `todoapp`

설계 문서: [`../docs/login.md`](../docs/login.md)
- 문서와 다른 점: 이메일·비밀번호 가입 대신 **GitHub 로그인만** 씁니다(2026-10-22 결정).
- 그래서 회원가입 화면과 비밀번호 저장(bcrypt)은 없습니다.

```
브라우저 ──▶ Vite 개발 서버 :5173 ──(/api, /auth 프록시)──▶ Express :3001 ──▶ MongoDB(todoapp)
                                                              └─ Auth.js ──▶ GitHub OAuth
```

## 1. GitHub OAuth App 만들기

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. 아래처럼 입력하고 **Register application**을 누릅니다.

   | 칸 | 값 |
   |---|---|
   | Application name | 할 일 (아무 이름) |
   | Homepage URL | `http://localhost:5173` |
   | Authorization callback URL | `http://localhost:5173/auth/callback/github` |

3. 만들어진 화면의 **Client ID**를 복사합니다.
4. **Generate a new client secret**을 눌러 나온 값을 복사합니다. 이 값은 한 번만 보입니다.

개발 중에는 브라우저가 Vite 주소(5173)로 접속하고, Vite가 `/auth` 요청을 서버로 넘깁니다.
그래서 콜백 주소도 5173입니다.

## 2. `.env.local` 채우기

`todo/.env.local`에 아래 값이 있어야 합니다(`.env.example` 참고). 서버가 읽습니다.
이 파일은 `.gitignore`에 들어 있어 깃허브에 올라가지 않습니다.

| 변수 | 내용 |
|---|---|
| `MONGODB_URI` | MongoDB Atlas 연결 주소 (link 프로젝트와 같은 클러스터를 씀) |
| `AUTH_SECRET` | 세션 서명 키. `npx auth secret` 으로 새로 만들 수 있음 |
| `AUTH_GITHUB_ID` | 1단계의 Client ID |
| `AUTH_GITHUB_SECRET` | 1단계의 Client secret |

## 3. 실행

```bash
npm install
npm run dev        # 서버(:3001)와 Vite(:5173)를 함께 띄움 → http://localhost:5173
```

따로 띄우려면 `npm run dev:server`와 `npm run dev:client`를 각각 실행합니다.

`.env.local`을 고친 뒤에는 개발 서버를 껐다 켜야 새 값이 적용됩니다(코드 파일만 자동으로 다시 불러옴).

처음 GitHub로 로그인하면 `todoapp` 데이터베이스에 아래 컬렉션이 생깁니다.

| 컬렉션 | 내용 |
|---|---|
| `users` | GitHub 이름·이메일·프로필 이미지 (비밀번호는 저장하지 않음) |
| `accounts` | GitHub 계정 연결 정보 |
| `sessions` | 로그인 세션. 로그아웃하면 지워짐 |
| `todos` | 할 일. 각 문서에 `userId`(= `users._id`)가 붙음 |

## 4. 서버 API

모두 로그인이 필요합니다. 로그인하지 않으면 `401`을 돌려줍니다.
내용을 바꾸는 요청은 `Content-Type: application/json`만 받습니다.

| 메서드 | 주소 | 내용 |
|---|---|---|
| GET | `/api/me` | 로그인한 사용자 `{ id, name }` |
| GET | `/api/todos` | 내 할 일 목록 |
| POST | `/api/todos` | `{ id, title }` 추가 |
| PATCH | `/api/todos/:id` | `{ title?, done? }` 수정. 빈 제목이면 삭제 |
| DELETE | `/api/todos/:id` | 삭제 |
| POST | `/api/todos/complete-all` | `{ done }` 모두 완료 또는 모두 해제 |
| POST | `/api/todos/clear-completed` | 완료 항목 삭제 |

로그인·로그아웃은 Auth.js 주소를 씁니다: `/auth/signin/github`, `/auth/callback/github`, `/auth/signout`.

## 5. 테스트

```bash
npm run check      # 타입 검사 + lint + 단위·API 테스트
npm run e2e        # 클라이언트 빌드 후 브라우저 테스트
```

- 테스트는 메모리 MongoDB(`mongodb-memory-server`)로 돌아가서 Atlas 데이터에 손대지 않습니다.
- 실제 GitHub에도 접속하지 않습니다. 대신 DB에 사용자와 세션을 직접 만들어 로그인된 상태를 재현합니다.

## 6. 배포할 때

`npm run build` 후 `npm start`를 실행하면 Express가 빌드된 클라이언트(`dist`)와 API를 한 주소에서 함께 제공합니다.

1. 배포 환경의 환경 변수에 위 4개 변수를 같은 이름으로 넣습니다.
   - HTTPS 앞단 프록시를 거치는 곳(Render, Railway, Fly, 로드 밸런서 등)이면 아래 둘 중 하나도 넣습니다.
   - 넣지 않으면 서버가 GitHub 콜백 주소를 `http://`로 만들어, 등록한 `https://` 콜백과 달라서 로그인이 실패합니다.

   | 변수 | 값 | 설명 |
   |---|---|---|
   | `AUTH_URL` | `https://<배포주소>` | 권장. 콜백·쿠키 주소를 이 값으로 고정 |
   | `TRUST_PROXY` | 프록시 홉 수 (보통 `1`) | 프록시가 보낸 `X-Forwarded-Proto` 를 믿게 함 |
2. 배포 주소용 GitHub OAuth App을 하나 더 만듭니다(권장). 값은 다음과 같습니다.
   - Homepage URL: `https://<배포주소>`
   - Callback URL: `https://<배포주소>/auth/callback/github`
3. MongoDB Atlas의 **Network Access**에서 배포 서버가 접속할 수 있게 허용합니다.

## 보안 규칙 (docs/login.md §6)

- 할 일 API는 서버에서 세션의 사용자 id로만 처리합니다. 요청 본문에 userId를 넣어도 무시합니다.
- 다른 사람의 할 일 id를 알아도 수정하거나 삭제할 수 없습니다. 모든 쿼리 조건에 `userId`가 들어갑니다.
- 요청 값의 형식(문자열·불리언)을 확인해서 `{"$gt": ""}` 같은 연산자 주입을 막습니다.
- 비밀 값은 `.env.local`과 배포 환경 변수에만 둡니다.
