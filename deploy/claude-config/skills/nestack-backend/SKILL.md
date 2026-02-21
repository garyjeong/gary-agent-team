---
name: nestack-backend
description: |
  Nestack 백엔드(NestJS) 개발 및 운영 skill. API 개발, DB 운영, 인증 시스템, 오픈뱅킹 연동, 미션 시스템 개발을 수행한다.
  사용 시기: (1) API 엔드포인트 개발, (2) DB 스키마/마이그레이션, (3) 인증/권한 이슈, (4) 오픈뱅킹 연동, (5) 미션 비즈니스 로직, (6) 테스트 작성, (7) Docker/배포
---

# Nestack Backend Development

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 경로 | `/Users/gary/Documents/workspace/gary/nestack/nestack-backend` |
| 프레임워크 | NestJS 11 (TypeScript 5.7) |
| 데이터베이스 | PostgreSQL 16 (TypeORM 0.3) |
| 인증 | JWT (passport-jwt) + Google OAuth 2.0 |
| API 문서 | Swagger (@nestjs/swagger) |
| 이메일 | Nodemailer (@nestjs-modules/mailer) |
| 컨테이너 | Docker (node:20-alpine) |
| API Prefix | `/api/v1` |

## 환경 설정

| 환경 | API | DB Port |
|------|-----|---------|
| 로컬 | `localhost:3000` | 5433 (docker) |
| 프로덕션 | `api.nestack.kr` | - |

### 환경 변수 (.env)
```
NODE_ENV, PORT, FRONTEND_URL, API_PREFIX
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE
JWT_SECRET, JWT_ACCESS_EXPIRES_IN(15m), JWT_REFRESH_EXPIRES_IN(7d)
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
OPENBANKING_BASE_URL, OPENBANKING_CLIENT_ID, OPENBANKING_CLIENT_SECRET
MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM
```

---

## 프로젝트 구조

```
src/
  app.module.ts              # Root module (글로벌 Guard, Filter, Interceptor 등록)
  main.ts                    # Bootstrap
  common/
    decorators/              # @CurrentUser, @Public
    dto/                     # ApiResponseDto
    enums/                   # 공통 Enum
    exceptions/              # GlobalExceptionFilter, BusinessException
    guards/                  # JwtAuthGuard, AdminGuard
    interceptors/            # TransformInterceptor, LoggingInterceptor
    utils/                   # crypto, invite-code 유틸
  config/                    # app, database, jwt, mail, google, openbanking 설정
  database/
    entities/                # TypeORM 엔티티 (17개)
  modules/
    admin/                   # 관리자 모듈
    auth/                    # 인증 모듈 (Google OAuth, JWT)
    badges/                  # 뱃지 모듈
    family/                  # 가족(Duo-Sync) 모듈
    finance/                 # 금융 모듈 (오픈뱅킹)
    mail/                    # 이메일 모듈
    missions/                # 미션 모듈
    users/                   # 사용자 모듈
```

---

## 글로벌 설정 (app.module.ts)

| 설정 | 클래스 | 설명 |
|------|--------|------|
| APP_FILTER | GlobalExceptionFilter | 전역 예외 핸들링 |
| APP_GUARD | JwtAuthGuard | 전역 JWT 인증 (기본 모든 API 보호) |
| APP_INTERCEPTOR | TransformInterceptor | 응답 표준화 |
| APP_INTERCEPTOR | LoggingInterceptor | 요청/응답 로깅 |

- `@Public()` 데코레이터로 JWT 인증 우회 가능
- `@CurrentUser()` 데코레이터로 현재 사용자 주입

---

## 모듈별 API 엔드포인트

### Auth Module (`/auth`)
| Method | Path | Auth | 설명 |
|--------|------|------|------|
| POST | /auth/google | Public | Google ID Token으로 로그인 |
| POST | /auth/refresh | Public | Access Token 갱신 |
| POST | /auth/logout | JWT | 로그아웃 |

### Users Module (`/users`)
| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | /users/me | JWT | 내 프로필 조회 |
| PATCH | /users/me | JWT | 프로필 수정 |

### Family Module (`/family`)
| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | /family | JWT | 가족 그룹 조회 |
| POST | /family/invite-code | JWT | 초대 코드 생성 |
| POST | /family/invite-code/regenerate | JWT | 초대 코드 재발급 |
| POST | /family/join | JWT | 초대 코드로 가족 가입 |
| POST | /family/leave | JWT | 가족 그룹 탈퇴 |

### Missions Module (`/missions`)
| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | /missions | JWT | 미션 목록 조회 |
| POST | /missions | JWT | 미션 생성 |
| GET | /missions/templates | JWT | 미션 템플릿 목록 |
| GET | /missions/categories | JWT | 생애주기 카테고리 목록 |
| GET | /missions/:id | JWT | 미션 상세 |
| PATCH | /missions/:id | JWT | 미션 수정 |
| DELETE | /missions/:id | JWT | 미션 삭제 |
| PATCH | /missions/:id/status | JWT | 미션 상태 변경 |
| POST | /missions/:id/transactions | JWT | 미션에 거래 연결 |

### Finance Module (`/finance`)
| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | /finance/openbanking/authorize | JWT | 오픈뱅킹 인증 URL 생성 |
| GET | /finance/openbanking/callback | JWT | 오픈뱅킹 콜백 |
| DELETE | /finance/openbanking | JWT | 오픈뱅킹 연동 해제 |
| GET | /finance/accounts | JWT | 계좌 목록 |
| GET | /finance/accounts/:id | JWT | 계좌 상세 |
| PATCH | /finance/accounts/:id | JWT | 계좌 설정 수정 |
| POST | /finance/accounts/:id/sync | JWT | 계좌 동기화 |
| GET | /finance/accounts/:id/transactions | JWT | 거래 내역 조회 |

### Badges Module (`/badges`)
| Method | Path | Auth | 설명 |
|--------|------|------|------|
| GET | /badges | JWT | 전체 뱃지 목록 |
| GET | /badges/me | JWT | 내 뱃지 목록 |

---

## 데이터베이스 엔티티 (17개)

| 엔티티 | 테이블 | 모듈 |
|--------|--------|------|
| User | users | User |
| RefreshToken | refresh_tokens | Auth |
| EmailVerificationToken | email_verification_tokens | Auth |
| FamilyGroup | family_groups | Family |
| InviteCode | invite_codes | Family |
| LifecycleCategory | lifecycle_categories | Mission |
| MissionTemplate | mission_templates | Mission |
| Mission | missions | Mission |
| MissionSharedAccount | mission_shared_accounts | Mission |
| BankAccount | bank_accounts | Finance |
| Transaction | transactions | Finance |
| OpenbankingToken | openbanking_tokens | Finance |
| Badge | badges | Badge |
| UserBadge | user_badges | Badge |
| AdminUser | admin_users | Admin |
| Announcement | announcements | Admin |

---

## 주요 비즈니스 로직

### 인증 플로우
```
1. Google ID Token -> POST /auth/google
2. google-auth-library로 토큰 검증
3. 사용자 생성 또는 조회
4. Access Token (15m) + Refresh Token (7d) 발급
5. Refresh Token은 DB에 해시 저장
```

### 미션 생성 플로우
```
1. 템플릿 선택 또는 커스텀 생성
2. 목표 금액, 기한 설정
3. 카테고리 연결 (결혼/주택 등)
4. 상위 미션 연결 (계층 구조)
5. 공유 계좌 연결 (선택)
```

### 오픈뱅킹 연동 플로우
```
1. GET /finance/openbanking/authorize -> 인증 URL 반환
2. 사용자 금융결제원 인증
3. GET /finance/openbanking/callback -> 토큰 저장
4. 계좌 목록/잔액/거래내역 조회
```

---

## 주요 명령어

```bash
# 개발 서버
npm run start:dev

# 빌드
npm run build

# 테스트
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:cov          # Coverage

# 린트
npm run lint
npm run format

# Docker
docker compose up -d      # PostgreSQL (port 5433)
docker compose down
```

---

## 코딩 컨벤션

### 파일 구조 (각 모듈)
```
modules/{module-name}/
  {name}.module.ts
  {name}.controller.ts
  {name}.service.ts
  dto/
    index.ts
    {action}-{name}.dto.ts
```

### DTO 패턴
- class-validator + class-transformer 사용
- Swagger 데코레이터 필수 (@ApiProperty)
- Request DTO / Response DTO 분리

### 에러 처리
- BusinessException (커스텀 예외) 사용
- GlobalExceptionFilter에서 통합 처리
- 표준 응답 형식: `{ success, data, meta }` 또는 `{ success, error: { code, message } }`

### TypeORM 패턴
- Entity에서 @Column, @ManyToOne, @OneToMany 관계 정의
- Repository 패턴 (Service에서 직접 inject)
- autoLoadEntities: true
- synchronize: dev에서만 true

---

## 상세 레퍼런스

- **API 명세**: 프로젝트 루트 `3_FUNCTIONAL_SPECIFICATION.md`
- **DB 스키마**: 프로젝트 루트 `5_DATABASE_SCHEMA.md`
- **화면 설계**: 프로젝트 루트 `2_SCREEN_DESIGN.md`
