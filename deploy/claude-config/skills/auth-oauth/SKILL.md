# Viewster 인증 & 소셜 로그인

JWT 인증, OAuth2 소셜 로그인, 중복 로그인 방지, 본인인증을 다루는 skill.
사용 시기: (1) 로그인/로그아웃 버그, (2) 소셜 로그인 연동, (3) 토큰 갱신 이슈, (4) 중복 로그인 방지, (5) 본인인증(Nice) 연동, (6) 미들웨어 인증 문제, (7) 쿠키 도메인 이슈

---

## 핵심 파일 맵

### Frontend (B2C)
| 파일 | 역할 |
|------|------|
| `viewster-frontend/src/contexts/AuthContext.tsx` | **핵심** - 인증 상태 관리, WebSocket force_logout 연결, 토큰 갱신 |
| `viewster-frontend/src/components/organisms/AuthModal/` | 로그인/회원가입 모달 (Google, Naver, Kakao 소셜 버튼) |
| `viewster-frontend/src/components/login/` | 소셜 로그인 버튼 컴포넌트 |
| `viewster-frontend/src/services/TokenService.ts` | JWT 메모리 저장 + 만료 시간 추적 (181 LOC) |
| `viewster-frontend/src/services/apiService.ts` | 401 처리, preemptive 토큰 갱신 (946 LOC) |
| `viewster-frontend/src/store/request/authRequest.ts` | 인증 API 호출 |
| `viewster-frontend/src/store/request/loginRequest.ts` | 로그인 요청 |
| `viewster-frontend/src/store/request/logoutRequest.ts` | 로그아웃 요청 |
| `viewster-frontend/src/store/slices/authSlice.ts` | Redux 인증 상태 |
| `viewster-frontend/src/hooks/HandleLogout.tsx` | 로그아웃 핸들러 |
| `viewster-frontend/src/middleware.ts` | JWT 검증, 보호 라우트, callbackUrl 리다이렉트 |
| `viewster-frontend/src/utils/tokenUtils.ts` | JWT 유틸리티 |

### Backend
| 파일 | 역할 |
|------|------|
| `viewster-backend/app/core/security.py` | JWT 생성/검증 (HS256), bcrypt 비밀번호 해싱 |
| `viewster-backend/app/routers/auth.py` | 인증 API (로그인, 회원가입, 토큰 갱신, 로그아웃) |
| `viewster-backend/app/api/dependencies/auth.py` | JWT 추출 & 사용자 주입 (미들웨어) |
| `viewster-backend/app/services/auth_service.py` | 인증 비즈니스 로직 |
| `viewster-backend/app/services/oauth/oauth_service.py` | OAuth 서비스 공통 |
| `viewster-backend/app/services/oauth/google_provider.py` | Google OAuth 프로바이더 |
| `viewster-backend/app/services/oauth/naver_provider.py` | Naver OAuth 프로바이더 |
| `viewster-backend/app/services/oauth/kakao_provider.py` | Kakao OAuth 프로바이더 |
| `viewster-backend/app/routers/social_oauth_callback.py` | OAuth 콜백 핸들러 |
| `viewster-backend/app/api/routers/social_oauth.py` | B2C OAuth 엔드포인트 |
| `viewster-backend/app/middleware/auth.py` | HTTP 인증 미들웨어 |
| `viewster-backend/app/models/social.py` | OAuth 프로바이더 모델 |
| `viewster-backend/app/schemas/social_oauth.py` | OAuth 스키마 |
| `viewster-backend/app/services/nice_service.py` | Nice 본인인증 서비스 |

### Admin Frontend
| 파일 | 역할 |
|------|------|
| `viewster-admin-frontend/src/app/login/` | 관리자 로그인 페이지 |
| `viewster-admin-frontend/src/app/change-password/` | 비밀번호 변경 (최초 로그인 시 강제) |
| `viewster-admin-frontend/src/services/TokenService.ts` | JWT 자동 갱신 (만료 10분 전) |
| `viewster-admin-frontend/src/middleware.ts` | 보호 라우트, staging prefix 지원 |
| `viewster-admin-frontend/src/lib/api/auth.ts` | 인증 API 클라이언트 |

---

## JWT 토큰 구조

### 토큰 종류
| 토큰 | 저장 위치 | 만료 | 용도 |
|------|----------|------|------|
| accessToken | HttpOnly 쿠키 + 메모리 (TokenService) | 30분 | API 인증 |
| refreshToken | HttpOnly 쿠키 | 7일 | accessToken 갱신 |
| userIsLogedin | 일반 쿠키 (JS 접근 가능) | 7일 | 프론트엔드 로그인 상태 확인 |

### JWT 페이로드
```json
{
  "sub": "user_id",
  "exp": 1234567890,
  "iat": 1234567890,
  "type": "access" | "refresh"
}
```

### 알고리즘: HS256 (python-jose)

---

## 인증 플로우

### 1. 소셜 로그인 (Google/Naver/Kakao)
```
AuthModal 소셜 버튼 클릭
  → OAuth Provider 인증 페이지 리다이렉트
  → 인증 완료 → /api/social-oauth/callback/{provider}
  → 사용자 생성/조회 → JWT 발급 → 쿠키 설정
  → callbackUrl로 리다이렉트 (있으면)
```

### 2. 토큰 갱신
```
apiService.ts:
  1. 요청 전: userIsLogedin 쿠키 확인
  2. TokenService: 만료 임박 검사 (preemptive)
  3. 401 응답 시: POST /auth/refresh
  4. 갱신 실패: force_logout (WebSocket)
```

### 3. 중복 로그인 방지
```
WebSocket 연결 시:
  → Redis ws_user:{user_id} 확인
  → 기존 연결 있으면 → force_logout 전송
  → 새 연결으로 교체
```

---

## callbackUrl 리다이렉트

### 미들웨어 (middleware.ts)
- 보호 라우트 (`/my/*`) 접근 시 인증 실패 → `/home?callbackUrl=/my/asset`
- `handleLoginComplete`에서 callbackUrl 읽어 리다이렉트
- 모달 닫기 시 callbackUrl 파라미터 정리

### 쿠키 도메인 주의사항
- Production: `.viewster.io` (서브도메인 공유)
- Staging: `staging.viewster.io` → HttpOnly 쿠키 도메인 이슈 가능
- Local: `localhost` (도메인 없이)

---

## Nice 본인인증

### 플로우
```
프론트엔드 → Nice 인증 팝업 → 본인인증 완료
  → 콜백 → /api/nice/callback
  → 인증 정보 저장 → 계좌 인증 가능
```

### 관련 파일
- `viewster-frontend/src/components/function/niceResultFunction.tsx`
- `viewster-frontend/src/hooks/NiceResultHook.tsx`
- `viewster-backend/app/services/nice_service.py`

---

## 디버깅 체크리스트

1. **로그인 후 상태 유지 안 됨**: HttpOnly 쿠키 설정 확인, 도메인/경로 확인
2. **401 무한 루프**: refreshToken 만료 확인, force_logout 처리 확인
3. **소셜 로그인 실패**: OAuth 동의 화면 설정 (Google: prompt=consent)
4. **callbackUrl 미동작**: middleware.ts에서 URL 인코딩 확인
5. **로그아웃 후 시청 페이지 재진입 시 로그인 유지**: 쿠키 삭제 순서 확인
6. **WebSocket userId=0**: AuthContext에서 `setUserId()` 호출 확인 (connect 전)
7. **Staging 인증 실패**: 쿠키 도메인 `staging.viewster.io` 확인

---

## 관련 스킬
- `watching-session`: WebSocket 인증, force_logout 처리
- `admin-panel`: 관리자 인증, RBAC 권한
- `b2c-frontend`: AuthContext, 미들웨어 구조
