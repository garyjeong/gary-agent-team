# Viewster B2C 프론트엔드 아키텍처

Next.js 16 + React 19 + MUI 7.3 기반 B2C 프론트엔드 아키텍처, 컴포넌트 구조, 상태 관리를 다루는 skill.
사용 시기: (1) 프론트엔드 아키텍처 파악, (2) 새 컴포넌트 개발, (3) 레이아웃/반응형 이슈, (4) Redux 상태 관리, (5) API 서비스 레이어, (6) 커스텀 훅 개발, (7) 성능 최적화, (8) 사이드바/네비게이션

---

## 프로젝트 경로
`/Users/gary/Documents/workspace/viewster/viewster-frontend`

## 기술 스택
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5.9**
- **MUI 7.3** + **Tailwind 4.1** + **Emotion**
- **Redux Toolkit 2.9** + react-redux 9.2
- **react-window 2.2** (가상화 리스트) + **keen-slider 6.8** (배너)
- **framer-motion 12.33** (애니메이션)
- **react-youtube 10.1** (YouTube Player)
- **react-toastify 11.0** (토스트 알림)

---

## 디렉토리 구조

```
src/
├── app/                   # Next.js App Router 페이지 (10 라우트)
│   ├── home/              # 메인 (전체/라이브/VOD/Shorts)
│   ├── watch/             # 시청 페이지 (?id=UUID)
│   ├── my/                # 마이페이지 (asset, info)
│   ├── advertiser/        # 광고주 대시보드
│   ├── notices/           # 공지사항
│   ├── help/              # FAQ
│   ├── policy/            # 약관
│   └── reset-password/    # 비밀번호 재설정
├── components/            # Atomic Design (150+ 컴포넌트)
│   ├── atoms/             # Button, Text, TextField, Avatar, Loading, Skeleton 등 (16)
│   ├── molecules/         # VideoCard, Modal, SearchBar, ViewingStatusPanel 등 (50+)
│   ├── organisms/         # AuthModal, Header, GridView, VideoDetailView, AdPreroll 등 (30+)
│   ├── templates/         # HomePageMasterLayout, WatchPageMasterLayout 등 (6)
│   ├── common/            # CountdownTimer, OptimizedImage, WebVitals
│   ├── layout/            # gridLayout 유틸
│   ├── login/             # Google/Naver/Kakao 소셜 버튼
│   └── popup/             # Modal 유틸, RandomBoxModal, GoldBoxModal
├── store/                 # Redux Toolkit
│   ├── slices/            # 20개 slice (auth, user, home, video, reward, search 등)
│   ├── request/           # API 요청 함수 (40+ 파일)
│   └── customCache/       # 페이지네이션 캐시
├── services/              # 서비스 레이어 (2,558 LOC)
│   ├── apiService.ts      # HTTP 래퍼 (946 LOC, 429 retry, preemptive refresh)
│   ├── webSocketService.ts # WebSocket 싱글톤 (632 LOC)
│   ├── liveChatBroadcast.ts # 라이브 채팅 (350 LOC)
│   ├── StorageService.ts  # localStorage/sessionStorage (407 LOC)
│   ├── TokenService.ts    # JWT 메모리 저장 (181 LOC)
│   └── emitService.ts     # 이벤트 에미터 (42 LOC)
├── hooks/                 # 커스텀 훅 (26개)
├── contexts/              # AuthContext, WindowSizeContext, MobileHeaderContext
├── models/                # TypeScript 인터페이스 (30+ 파일)
├── enums/                 # ApiRequestType (95+ 엔드포인트)
├── config/                # appConfig, apiConfig (496 LOC)
├── utils/                 # 유틸 함수 (19+ 파일)
├── styles/                # breakpoints, colors, theme, spacing, typography
├── providers/             # Redux, Auth, Theme 프로바이더
└── middleware.ts           # JWT 검증, 보호 라우트, 404
```

---

## Atomic Design 패턴

### Atoms (기본 요소)
`Avatar`, `Button`, `Divider`, `Icon` (11종), `Loading`, `Skeleton`, `Spacer`, `SvgWrapper`, `Text`, `TextField`, `Tooltip`

### Molecules (조합 요소)
`VideoCard`, `ShortCard`, `SearchBar`, `ViewingStatusPanel`, `Modal` (6종), `DatePicker`, `Drawer`, `LiveChat`, `FilterSortModal`, `FormField`, `PaginationButton`

### Organisms (독립 기능)
`Header`, `SearchHeader`, `Footer`, `AuthModal`, `GridView` (가상화), `VideoDetailView`, `AdPreroll`, `AdBanner`, `ErrorBoundary`

### Templates (페이지 레이아웃)
`HomePageMasterLayout`, `WatchPageMasterLayout`, `VideoDetailLayout`, `VodShortsTemplate`

---

## Redux 슬라이스 (20개)

| 슬라이스 | 상태 |
|---------|------|
| `authSlice` | 사용자 인증 (user, tokens) |
| `userSlice` | 프로필 정보 |
| `homeSlice` | 홈 콘텐츠 목록 |
| `videoSlice` | 영상 상세/시청 |
| `searchSlice` | 검색 쿼리/결과 |
| `rewardPostSlice` | 리워드 포스트 |
| `shortsSlice` | 숏츠 콘텐츠 |
| `bannerSlice` | 배너 데이터 |
| `announcementSlice` | 공지사항 |
| `homeTabSlice` | 홈 활성 탭 |
| `assetTabSlice` | 자산 탭 |
| `bankSlice` | 은행 계좌 |
| `layoutSlice` | 레이아웃 |
| `drawerSlice` | 드로어 열기/닫기 |
| `leftMenuSlice` | 사이드 메뉴 |
| `scrollSlice` | 스크롤 위치 |
| `sessionMemorySlice` | 세션 정보 |
| `viewerCountSlice` | 실시간 시청자 수 |
| `customerTabSlice` | 고객 지원 탭 |
| `createContentStatsSlice` | 업로드 통계 |

---

## 커스텀 훅 (26개)

### 코어
- `WindowSizeHook`: 반응형 감지 (Context 기반, 150ms 디바운스)
- `useYouTubePlayer`: YouTube iframe 상태
- `useLandscapeMode`: 가로모드/풀스크린

### UI
- `useCardLayout`: 반응형 그리드 열 수
- `useResponsivePageSize`: 페이지 크기 계산
- `useContainerWidth`: 컨테이너 너비
- `useBodyScrollLock`: 바디 스크롤 잠금
- `useBrowserFullscreen`: 전체화면 API
- `useScrollDirection`: 스크롤 방향 감지
- `useMobileAddressBarHide`: 모바일 주소바 숨기기

### 데이터
- `useViewerCountSubscription`: 실시간 시청자 수
- `useAdImpression`: 광고 임프레션 추적
- `useYouTubeVideoInfo`: YouTube 메타데이터
- `useAdsLoader`: 광고 로딩
- `useBannerDataLoader`: 배너 데이터

---

## 반응형 브레이크포인트

```typescript
MOBILE_SIDEBAR_BREAKPOINT = 1025  // px
// < 1025: 모바일 레이아웃
// >= 1025: 데스크톱 레이아웃
```

### 사이드바 모드
- **데스크톱 /watch**: overlay 모드 (콘텐츠 위에 겹침)
- **데스크톱 기타**: push 모드 (콘텐츠를 밀어냄)
- **모바일**: overlay + 햄버거 메뉴

---

## API 서비스 패턴

### apiService.ts (946 LOC)
```typescript
// 핵심 기능:
// 1. 429 Rate Limit → Exponential Backoff (3회 retry)
// 2. 401 Unauthorized → Preemptive Token Refresh
// 3. X-RateLimit-* 헤더 추적
// 4. Request/Response 인터셉터
```

### webSocketService.ts (632 LOC)
```typescript
// 싱글톤 패턴
// connect(url) → setUserId(id) → sendEvent(type, payload)
// 중요: sendEvent()는 userId <= 0이면 silent return
```

---

## 성능 최적화 (2026-02 적용)

1. **LQIP 썸네일**: 저화질 블러 → 고화질 전환
2. **Lazy Loading**: `<img loading="lazy">`
3. **YouTube CDN 직접 로드**: `i.ytimg.com` URL
4. **VideoCardWrapper memo**: React.memo로 리렌더링 방지
5. **react-window 가상화**: GridView에서 뷰포트 밖 요소 미렌더링
6. **Core Web Vitals**: WebVitals 컴포넌트로 LCP/FID/CLS 측정

---

## 최근 주요 변경 (2026-02)

- 사이드바: watch만 overlay, 나머지 push 모드
- 배너: 화살표 제거 → 원형 점 인디케이터
- VideoCard: 제목 2줄 제한, 채널 프로필 확대
- 데스크톱 시청: 사이드바 420px, 영상-사이드바 구분선
- 모바일 가로모드: Safe Area 대응, 댓글 사이드 패널
- 로고: SVG → PNG (iPhone Safari 호환)
- 조회수순 정렬 옵션 추가
- 네이버 SEO Phase 1~3

---

## 디버깅 체크리스트

1. **무한 스크롤 미동작**: Intersection Observer + rewardFilter 상태 확인
2. **모바일 레이아웃 깨짐**: MOBILE_SIDEBAR_BREAKPOINT (1025px) 확인
3. **토스트 안 사라짐**: react-toastify autoClose 설정
4. **iPhone 가로모드 빈 영역**: safe-area-inset 대응 확인
5. **사이드바 토글 시 배너 깨짐**: keen-slider 리사이즈 이벤트
6. **SSR 파라미터 불일치**: useSearchParams Suspense 경계 확인

---

## 관련 스킬
- `watching-session`: VideoDetailView, WebSocket
- `reward-system`: ViewingStatusPanel, CountdownTimer
- `ad-system`: AdPreroll, AdBanner
- `auth-oauth`: AuthModal, AuthContext
- `content-youtube`: VideoCard, GridView, 검색
