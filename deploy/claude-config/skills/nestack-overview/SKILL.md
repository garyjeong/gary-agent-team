---
name: nestack-overview
description: |
  Nestack 프로젝트 전체 아키텍처 및 도메인 컨텍스트 skill. 프로젝트 구조, 비즈니스 로직, 기술 스택, 데이터 모델을 빠르게 파악한다.
  사용 시기: (1) 프로젝트 구조 파악, (2) 도메인 용어 확인, (3) 아키텍처 질문, (4) 신규 기능 설계 전 컨텍스트 확인, (5) 코드 리뷰 시 도메인 이해
---

# Nestack Project Overview

## 프로젝트 정체성

**Nestack**: Life-Cycle Mission SaaS for Couples

부부/커플의 생애 주기(결혼, 주택, 출산, 노후)를 하나의 프로젝트로 정의하고,
자산(Finance) 데이터를 연동하여 게임처럼 미션을 클리어하며 성장하는 **가정 경영 운영체제(OS)**.

## 핵심 3대 테마

| 테마 | 설명 |
|------|------|
| Quest-Driven Growth | 거대한 목표를 수행 가능한 퀘스트로 분해. 메인 목표 -> 월별 -> 주별 -> 일별 미션 |
| Privacy-First Sync (Duo-Sync) | "공동 목표에 필요한 데이터만" 선택적 공유. 12자리 랜덤 초대 코드로 가족 연결 |
| Gamification | 미션 완료 뱃지, 연속 달성 뱃지, 가족 공동 달성 뱃지 |

---

## 프로젝트 구조

```
nestack/
  1_REQUIREMENTS.md          # 요구사항 정의서
  2_SCREEN_DESIGN.md         # 화면 설계서
  3_FUNCTIONAL_SPECIFICATION.md  # 기능 정의서 (API 명세 포함)
  4_COLOR_CONCEPT.md         # 컬러 컨셉
  5_DATABASE_SCHEMA.md       # DB 스키마 및 ERD
  nestack-backend/           # NestJS 백엔드 (TypeScript)
  nestack-mobile/            # React Native 모바일 앱 (TypeScript)
```

## 기술 스택

### Backend
| 항목 | 기술 |
|------|------|
| 경로 | `/Users/gary/Documents/workspace/gary/nestack/nestack-backend` |
| 프레임워크 | NestJS 11 (TypeScript 5.7) |
| 데이터베이스 | PostgreSQL 16 |
| ORM | TypeORM 0.3 |
| 인증 | JWT (Passport) + Google OAuth 2.0 |
| 문서 | Swagger (OpenAPI) |
| 이메일 | Nodemailer (SMTP) |
| 금융 | 오픈뱅킹 테스트베드 API |
| 컨테이너 | Docker (node:20-alpine) |

### Mobile
| 항목 | 기술 |
|------|------|
| 경로 | `/Users/gary/Documents/workspace/gary/nestack/nestack-mobile` |
| 프레임워크 | React Native 0.83 (React 19) |
| UI | Tamagui 1.144 |
| 네비게이션 | React Navigation 7 |
| 상태관리 | Zustand 5 + React Query 5 |
| 폼 | React Hook Form + Zod 4 |
| 차트 | react-native-gifted-charts |
| 애니메이션 | Reanimated 4, Lottie |
| 저장소 | MMKV |
| 아이콘 | Lucide React Native |

---

## 도메인 모델 (핵심 엔티티)

### User Module
- **users**: 사용자 (email/password + Google OAuth)
- **refresh_tokens**: JWT 리프레시 토큰
- **email_verification_tokens**: 이메일 인증/비밀번호 재설정 토큰

### Family Module (Duo-Sync)
- **family_groups**: 가족 그룹 (최대 2명, 부부/커플)
- **invite_codes**: 12자리 랜덤 초대 코드 (7일 유효)

### Mission Module
- **lifecycle_categories**: 생애주기 카테고리 (결혼, 주택, 출산, 노후)
- **mission_templates**: 시스템 제공 미션 템플릿
- **missions**: 미션 (계층 구조: main -> monthly -> weekly -> daily)
- **mission_shared_accounts**: 미션에 연결된 공유 계좌

### Finance Module
- **bank_accounts**: 은행 계좌 (오픈뱅킹 연동)
- **transactions**: 거래 내역
- **openbanking_tokens**: 오픈뱅킹 OAuth 토큰

### Badge Module
- **badges**: 뱃지 정의 (lifecycle, streak, family 타입)
- **user_badges**: 사용자별 획득 뱃지

### Admin Module
- **admin_users**: 관리자 (super_admin, admin)
- **announcements**: 공지사항 (popup, banner)

---

## 핵심 비즈니스 규칙

### 미션 상태 전환
```
pending -> in_progress (사용자 시작)
in_progress -> completed (목표 달성)
in_progress -> failed (기한 초과)
```

### 미션 계층
```
main (메인 목표)
  -> monthly (월별 미션)
    -> weekly (주별 미션)
      -> daily (일별 미션)
```

### 계좌 공유 상태
- **full**: 전체 공개 (잔액 + 거래내역)
- **balance_only**: 잔액만 공개
- **private**: 비공개

### 초대 코드
- 12자리 영문 대문자 + 숫자
- 유효 기간: 7일
- 1회 사용 후 자동 만료

---

## 컬러 시스템

### 모바일 테마 (5가지)
| 테마 | Primary | Secondary |
|------|---------|-----------|
| forest (기본) | #228B22 | #86EFAC |
| ocean | #0066FF | #00D4AA |
| sunset | #F97316 | #FBBF24 |
| berry | #8B5CF6 | #EC4899 |
| night | #6366F1 | #818CF8 |

### 상태 컬러
- Success: #10B981 (Emerald)
- Warning: #F59E0B (Amber)
- Error: #EF4444 (Red)
- Info: #3B82F6 (Blue, 모바일) / #84CC16 (Lime, 웹 - No Blue 원칙)

---

## API 엔드포인트 구조

| 모듈 | Prefix | 주요 기능 |
|------|--------|----------|
| Auth | /auth | Google 로그인, 토큰 갱신, 로그아웃 |
| Users | /users | 프로필 조회/수정 |
| Family | /family | 가족 그룹 생성, 초대 코드, 가입/탈퇴 |
| Missions | /missions | 미션 CRUD, 상태 변경, 거래 연결, 템플릿/카테고리 |
| Finance | /finance | 오픈뱅킹 연동, 계좌 관리, 거래 내역 |
| Badges | /badges | 뱃지 목록, 내 뱃지 |
| Events | /events | SSE 실시간 동기화 |

API Prefix: `/api/v1`

---

## 개발 환경

### Backend
```bash
cd nestack-backend
docker compose up -d         # PostgreSQL (port 5433)
npm run start:dev            # Dev server (port 3000)
npm run test                 # Unit tests
npm run test:e2e             # E2E tests
```

### Mobile
```bash
cd nestack-mobile
npm start                    # Metro bundler
npm run android              # Android
npm run ios                  # iOS
```

---

## 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| 요구사항 | `1_REQUIREMENTS.md` | 비즈니스/기능 요구사항 |
| 화면 설계 | `2_SCREEN_DESIGN.md` | B2C + Admin 화면 설계 |
| 기능 정의 | `3_FUNCTIONAL_SPECIFICATION.md` | API 명세, 데이터 모델 |
| 컬러 컨셉 | `4_COLOR_CONCEPT.md` | 컬러 팔레트 |
| DB 스키마 | `5_DATABASE_SCHEMA.md` | ERD, 테이블 상세 |
