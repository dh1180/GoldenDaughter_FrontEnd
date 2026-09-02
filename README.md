# GoldenDaughter FrontEnd

모바일에서 홈 화면에 설치해서 사용하는 GoldenDaughter React PWA입니다.

## Stack

- React 19
- Vite 8
- vite-plugin-pwa
- Native Fetch API
- Netlify 배포 기준

## 포함된 기능

- 회원가입 / 로그인
- JWT 저장 및 인증 요청
- 실제 시작시각을 지정할 수 있는 DAY 카운터
- 랜덤 명언
- `🚨 지금 진짜 위험함` 위기 모드
- 위기 강도 1~10 기록
- 랜덤 추천글 + 다른 글 보기 + 도움됨
- 10분 버티기 타이머
- 월간 체크인 캘린더
- 개인 통계
- PWA 홈 화면 설치

## Local run

```bash
npm install
cp .env.example .env
npm run dev
```

`.env`:

```text
VITE_API_BASE_URL=http://localhost:8080
```

## Netlify

1. 이 GitHub repository를 Netlify에 연결합니다.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment variables에 아래를 추가합니다.

```text
VITE_API_BASE_URL=https://<railway-backend-domain>
```

`netlify.toml`에 SPA redirect 설정이 들어 있습니다.

## Backend CORS

Netlify 주소가 생성되면 BackEnd Railway 서비스의 환경변수도 설정해야 합니다.

```text
CORS_ALLOWED_ORIGINS=https://<your-site>.netlify.app
```

로컬 주소까지 동시에 허용하려면 쉼표로 구분합니다.

```text
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://<your-site>.netlify.app
```

## 사용 흐름

```text
회원가입 / 로그인
        ↓
금딸 시작 시각 입력
        ↓
DAY + 경과시간 + 명언
        ↓
🚨 지금 진짜 위험함
        ↓
위기 강도 저장 + 추천글 랜덤 출력
        ↓
체크인 / 통계 누적
```
