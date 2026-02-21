# Viewster 관리자 시스템

관리자 대시보드, 사용자/콘텐츠/광고/정산 관리, 시스템 설정을 다루는 skill.
사용 시기: (1) 관리자 페이지 개발, (2) 대시보드 통계/차트, (3) 사용자 관리, (4) 콘텐츠 삭제/복구, (5) 정산 처리, (6) 시스템 설정 변경, (7) 관리자 RBAC 권한, (8) 활동 로그

---

## 핵심 파일 맵

### Admin Frontend (24 페이지)
| 경로 | 파일 | 기능 |
|------|------|------|
| `/dashboard` | `viewster-admin-frontend/src/app/dashboard/` | 통계 대시보드 (Chart.js, Recharts, 히트맵) |
| `/users` | `viewster-admin-frontend/src/app/users/` | 사용자 목록/상세/차단/IP차단 |
| `/posts` | `viewster-admin-frontend/src/app/posts/` | 콘텐츠 관리 (삭제/복구) |
| `/ads` | `viewster-admin-frontend/src/app/ads/` | 광고 관리 (승인/거절, 설정) |
| `/settlements` | `viewster-admin-frontend/src/app/settlements/` | 정산 생성/확정/CSV |
| `/extracts` | `viewster-admin-frontend/src/app/extracts/` | 출금 신청 승인/거절 |
| `/assets` | `viewster-admin-frontend/src/app/assets/` | 자산 관리 (이력, 잔액 조정) |
| `/reward-tables` | `viewster-admin-frontend/src/app/reward-tables/` | 리워드 테이블 (CSV, 배정) |
| `/rewards/defaults` | `viewster-admin-frontend/src/app/rewards/defaults/` | 리워드 기본값 |
| `/system-settings` | `viewster-admin-frontend/src/app/system-settings/` | 랜덤박스/황금박스/보상타이머 설정 |
| `/site-management` | `viewster-admin-frontend/src/app/site-management/` | 공지사항/FAQ/배너 (탭 구조) |
| `/banners` | `viewster-admin-frontend/src/app/banners/` | 배너 관리 |
| `/notices` | `viewster-admin-frontend/src/app/notices/` | 공지사항 CRUD |
| `/events` | `viewster-admin-frontend/src/app/events/` | 이벤트 관리 |
| `/logs` | `viewster-admin-frontend/src/app/logs/` | 관리자 활동 로그 |
| `/admin-accounts` | `viewster-admin-frontend/src/app/admin-accounts/` | 관리자 계정 CRUD, 권한 |
| `/external-services` | `viewster-admin-frontend/src/app/external-services/` | 외부 서비스 모니터링 |
| `/advertiser-payments` | `viewster-admin-frontend/src/app/advertiser-payments/` | 광고주 결제 내역 |
| `/advertiser-wallets` | `viewster-admin-frontend/src/app/advertiser-wallets/` | 광고주 지갑 관리 |
| `/change-password` | `viewster-admin-frontend/src/app/change-password/` | 비밀번호 변경 |
| `/login` | `viewster-admin-frontend/src/app/login/` | 관리자 로그인 |

### API 클라이언트 (23개)
| 파일 | 도메인 |
|------|--------|
| `lib/api/client.ts` | Axios 인스턴스 (30초 timeout, 3회 retry) |
| `lib/api/auth.ts` | 인증 |
| `lib/api/dashboard.ts` | 대시보드 통계 |
| `lib/api/users.ts` | 사용자 관리 |
| `lib/api/posts.ts` | 콘텐츠 관리 |
| `lib/api/ads.ts` | 광고 관리 |
| `lib/api/settlements.ts` | 정산 |
| `lib/api/extracts.ts` | 출금 |
| `lib/api/reward-tables.ts` | 리워드 테이블 |
| `lib/api/rewards.ts` | 리워드 설정 |
| `lib/api/gold-box.ts` | 골드박스 설정 |
| `lib/api/admin-accounts.ts` | 관리자 계정 |
| `lib/api/advertiser-payments.ts` | 광고주 결제 |
| `lib/api/advertiser-wallets.ts` | 광고주 지갑 |
| `lib/api/assets.ts` | 자산 |
| `lib/api/banners.ts` | 배너 |
| `lib/api/events.ts` | 이벤트 |
| `lib/api/external-services.ts` | 외부 서비스 모니터링 |
| `lib/api/help.ts` | FAQ |
| `lib/api/logs.ts` | 활동 로그 |
| `lib/api/menu-permissions.ts` | RBAC 권한 |
| `lib/api/notices.ts` | 공지사항 |
| `lib/api/blocks.ts` | 사용자 차단 |

### Backend Admin API (20개 라우터)
| 파일 | 기능 |
|------|------|
| `app/routers/admin.py` | 관리자 CRUD |
| `app/routers/user_admin.py` | 사용자 관리 |
| `app/routers/content_admin.py` | 콘텐츠 삭제/복구 |
| `app/routers/ad_admin.py` | 광고 승인/거절 |
| `app/routers/settlement_admin.py` | 정산 생성/확정 |
| `app/routers/reward_admin.py` | 리워드 설정 |
| `app/routers/reward_table_admin.py` | 리워드 테이블 (CSV) |
| `app/routers/gold_box_admin.py` | 골드박스 설정 |
| `app/routers/system_admin.py` | 시스템 설정 |
| `app/routers/external_services_admin.py` | AWS/YouTube/SMTP/RDS 모니터링 |
| `app/routers/help.py` | FAQ 관리 |
| `app/routers/tag_admin.py` | 태그 관리 |
| `app/routers/advertiser_payment_admin.py` | 광고주 결제 |
| `app/routers/nice.py` | Nice 본인인증 |

---

## UI 컴포넌트 구조

### 공통 UI 컴포넌트
```
viewster-admin-frontend/src/components/ui/
├── Table.tsx          - DataTable (정렬, 필터, 페이지네이션, 가상화)
├── Pagination.tsx     - 페이지 네비게이션
├── FilterBar.tsx      - 필터 바
├── Chart.tsx          - Chart.js 래퍼
├── StatCard.tsx       - 통계 카드
├── StatusBadge.tsx    - 상태 배지
├── AlertModal.tsx     - 확인 다이얼로그
├── LoadingButton.tsx  - 로딩 상태 버튼
├── QuillEditor.tsx    - 리치 텍스트 에디터
├── EmptyState.tsx     - 빈 상태 표시
├── Loading.tsx        - 로딩 스피너
├── Skeleton.tsx       - 스켈레톤 로더
└── YouTubePlayer.tsx  - YouTube 재생기
```

### PageTabBar 패턴
```typescript
// 관리 페이지 탭 네비게이션 통합 컴포넌트
// 사이트 관리: 공지사항 | FAQ | 배너
// 시스템 설정: 랜덤박스 | 황금박스 | 보상타이머
```

### 레이아웃
- **사이드바**: 260px, 3개 메뉴 그룹, 권한 기반 필터링
- **14개 커스텀 SVG 아이콘**
- **테마**: Toonation Blue (기존 파란색)

---

## 상태 관리 패턴

### Redux + SWR 하이브리드
```
Redux:   인증 상태 (auth slice), 대시보드 (dashboard slice)
SWR:     서버 데이터 페칭 (config: revalidateOnFocus=false, 5초 에러 retry)
Axios:   API 클라이언트 (30초 timeout, 3회 retry, exponential backoff)
```

### SWR 커스텀 훅
```
hooks/useDashboard.ts    → SWR fetcher로 대시보드 데이터
hooks/useUsers.ts        → 사용자 목록 + 페이지네이션
hooks/usePosts.ts        → 콘텐츠 목록
hooks/useAdminAccounts.ts → 관리자 계정 목록
```

---

## 정산 플로우

```
1. 정산 생성 (POST /admin/settlements)
   → 기간 지정, 대상 사용자 자동 선택
2. 정산 목록 조회 (GET /admin/settlements)
   → 월별 요약 가능 (func.case 주의)
3. 정산 확정 (POST /admin/settlements/{id}/confirm)
   → 확정 후 수정 불가
4. CSV 내보내기
```

---

## 외부 서비스 모니터링

### OverviewCard + 탭 구조
```
외부 서비스 관리 페이지:
├── 개요 카드 (OverviewCard)
├── AWS 탭 (AWSTab) - EC2, RDS, S3 상태
├── YouTube 탭 (YouTubeTab) - API 키 상태, 할당량
├── SMTP 탭 (SMTPTab) - 이메일 서비스 상태
└── RDS 탭 (RDSTab) - 다중 인스턴스 지원
```

---

## 최근 변경사항 (2026-02)
- PageTabBar 컴포넌트로 탭 네비게이션 통합
- 시스템 설정에 랜덤박스/황금박스/보상타이머 탭 추가
- 용어 변경: 골드박스→황금박스, 코인→리워드
- 프리롤 광고 영상 길이 편집 기능
- 다중 RDS 인스턴스 모니터링 지원
- QuillEditor 툴바 이중 렌더링 수정
- 공지/배너 저장 후 리다이렉트 `/site-management`로 통일

---

## 디버깅 체크리스트

1. **대시보드 차트 미표시**: Chart.js 데이터 형식 확인, 기간 선택 API 파라미터
2. **SWR 데이터 갱신 안 됨**: mutate() 호출 확인, revalidation 설정
3. **정산 월별 요약 에러**: func.case → case 수정 확인 (SQLAlchemy)
4. **QuillEditor 이중 렌더링**: React Strict Mode 영향 확인
5. **권한 메뉴 미표시**: RBAC admin_menu_permission 확인
6. **토스트 안 사라짐**: react-toastify autoClose 설정 확인

---

## 관련 스킬
- `reward-system`: 리워드 테이블, 시스템 설정
- `ad-system`: 광고 승인/거절
- `auth-oauth`: 관리자 인증, RBAC
- `content-youtube`: 콘텐츠 CRUD
- `database-ops`: SQL 쿼리 실행
