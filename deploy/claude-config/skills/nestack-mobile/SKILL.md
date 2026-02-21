---
name: nestack-mobile
description: |
  Nestack 모바일(React Native) 개발 skill. 화면 구현, 네비게이션, 상태관리, API 연동, UI 컴포넌트 개발을 수행한다.
  사용 시기: (1) 화면/컴포넌트 개발, (2) 네비게이션 수정, (3) API 연동, (4) 상태관리(Zustand/React Query), (5) 테마/스타일링, (6) 폼 처리, (7) 테스트
---

# Nestack Mobile Development

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 경로 | `/Users/gary/Documents/workspace/gary/nestack/nestack-mobile` |
| 프레임워크 | React Native 0.83 (React 19, New Architecture) |
| UI 라이브러리 | Tamagui 1.144 |
| 네비게이션 | React Navigation 7 (Native Stack) |
| 상태관리 | Zustand 5 (로컬) + React Query 5 (서버) |
| 폼 | React Hook Form 7 + Zod 4 |
| 차트 | react-native-gifted-charts |
| 애니메이션 | Reanimated 4, Lottie 7 |
| 저장소 | MMKV (react-native-mmkv) |
| 아이콘 | Lucide React Native |
| 언어 | TypeScript 5.8 |

## API 연결

| 환경 | Base URL |
|------|----------|
| 개발 (Android) | `http://10.0.2.2:7002/api` |
| 프로덕션 | `https://api.nestack.kr/api` |

---

## 프로젝트 구조

```
src/
  api/
    client.ts              # API 클라이언트 (fetch + 토큰 자동 갱신)
    endpoints.ts           # API 엔드포인트 상수
  app/
    App.tsx                # 앱 루트
    providers.tsx          # Provider 래퍼 (QueryClient, Tamagui 등)
    navigation/
      RootNavigator.tsx    # 루트 네비게이터 (Auth/Onboarding/Main 분기)
      AuthNavigator.tsx    # 인증 스택
      MainNavigator.tsx    # 메인 탭 네비게이터
      HomeStack.tsx        # 홈 스택
      MissionStack.tsx     # 미션 스택
      FinanceStack.tsx     # 자산 스택
      MyPageStack.tsx      # 마이페이지 스택
      types.ts             # 네비게이션 타입 정의
      linking.ts           # 딥링크 설정
  features/                # 도메인별 기능 모듈
    auth/                  # 인증
    badge/                 # 뱃지
    family/                # 가족(Duo-Sync)
    finance/               # 금융
    mission/               # 미션
    realtime/              # SSE 실시간 동기화
    user/                  # 사용자
  screens/                 # 화면 컴포넌트
    auth/                  # LoginScreen
    family/                # (예정)
    finance/               # FinanceScreen, AccountDetailScreen, TransactionListScreen
    home/                  # HomeScreen
    missions/              # MissionsScreen, MissionDetailScreen, MissionCreateScreen, MissionEditScreen
    mypage/                # MyPageScreen, ProfileEditScreen, SettingsScreen, BadgesScreen, FamilySettingsScreen
    onboarding/            # WelcomeScreen, InviteCodeScreen
  shared/                  # 공유 모듈
    components/
      feedback/            # EmptyState, Skeleton
      icons/               # GoogleIcon
      layout/              # CustomTabBar, Header, Screen
      ui/                  # Avatar, Badge, Button, Card, CircularProgress, Input, ProgressBar
    hooks/
      useTheme.ts          # 테마 훅
    theme/
      colors.ts            # 컬러 팔레트 (5가지 테마)
      tamagui.config.ts    # Tamagui 설정
      tokens.ts            # 디자인 토큰
    utils/
      format.ts            # 포맷 유틸
      storage.ts           # MMKV 스토리지 유틸
  store/
    authStore.ts           # 인증 + UI 상태 (Zustand + MMKV persist)
    uiStore.ts             # UI 상태
```

---

## 네비게이션 구조

```
RootNavigator
  ├── Auth (미인증)
  │   └── AuthNavigator
  │       └── Login
  ├── Onboarding (인증 O, 가족 X)
  │   └── OnboardingNavigator
  │       ├── Welcome
  │       └── InviteCode
  └── Main (인증 O, 가족 O)
      └── MainNavigator (Bottom Tabs)
          ├── HomeStack
          ├── MissionStack
          │   ├── Missions (목록)
          │   ├── MissionDetail
          │   ├── MissionCreate
          │   └── MissionEdit
          ├── FinanceStack
          │   ├── Finance (계좌 목록)
          │   ├── AccountDetail
          │   └── TransactionList
          └── MyPageStack
              ├── MyPage
              ├── ProfileEdit
              ├── Settings
              ├── Badges
              └── FamilySettings
```

### 네비게이션 분기 로직 (RootNavigator)
```typescript
isAuthenticated === false  -> Auth
isAuthenticated && !hasFamily -> Onboarding
isAuthenticated && hasFamily  -> Main
```

---

## Feature 모듈 패턴

각 feature는 다음 구조를 따름:

```
features/{feature}/
  api/             # API 호출 함수
    {feature}Api.ts
  hooks/           # React Query 훅 + 커스텀 훅
    index.ts
    use{Feature}.ts
  components/      # feature 전용 컴포넌트
  types/           # 타입 정의
    index.ts
  schemas/         # Zod 스키마 (폼 검증)
```

### API 호출 패턴
```typescript
// features/mission/api/missionApi.ts
import { apiClient, extractData } from '../../../api/client'
import { API_ENDPOINTS } from '../../../api/endpoints'

export const missionApi = {
  getAll: (params) => apiClient.get(API_ENDPOINTS.MISSIONS.BASE, { params }),
  getById: (id) => apiClient.get(API_ENDPOINTS.MISSIONS.DETAIL(id)),
  create: (data) => apiClient.post(API_ENDPOINTS.MISSIONS.BASE, data),
}
```

### React Query 훅 패턴
```typescript
// features/mission/hooks/useMissions.ts
import { useQuery } from '@tanstack/react-query'
import { missionApi } from '../api/missionApi'

export function useMissions(filters) {
  return useQuery({
    queryKey: ['missions', filters],
    queryFn: () => missionApi.getAll(filters).then(extractData),
  })
}
```

---

## 상태관리

### Zustand (authStore.ts)
- **Auth State**: accessToken, refreshToken, user, partner, isAuthenticated
- **UI State**: isSSEConnected, theme, biometricEnabled
- MMKV persist로 앱 재시작 시 상태 복원
- `useAuthStore` 싱글 스토어

### React Query
- 서버 데이터 캐싱 (missions, accounts, badges 등)
- `queryKey` 기반 캐시 무효화
- `useMutation`으로 서버 변경 처리

---

## API 클라이언트 (client.ts)

### 주요 기능
- `apiClient.get/post/put/patch/delete` 메서드
- JWT 토큰 자동 첨부 (Authorization 헤더)
- 401 응답 시 자동 토큰 갱신 + 요청 재시도
- 동시 401 처리를 위한 queue 패턴
- AbortController 기반 타임아웃 (기본 10초)

### 응답 타입
```typescript
interface ApiResponse<T> {
  success: boolean
  data: T
  meta?: { timestamp, pagination? }
}
```

---

## 테마 시스템

### 5가지 테마 팔레트
| 이름 | Primary | Secondary |
|------|---------|-----------|
| **forest** (기본) | #228B22 | #86EFAC |
| ocean | #0066FF | #00D4AA |
| sunset | #F97316 | #FBBF24 |
| berry | #8B5CF6 | #EC4899 |
| night | #6366F1 | #818CF8 |

### 공통 컬러
- **Stone** 계열: 중립 UI (50~900)
- **Dark mode**: background #121212, card #1E1E1E
- **Semantic**: success(emerald), warning(amber), error(red), info(blue)
- **Category colors**: food, transport, shopping 등 10가지

### 사용법
```typescript
import { themePalettes, DEFAULT_THEME, colors } from '../shared/theme/colors'
import { useTheme } from '../shared/hooks/useTheme'
```

---

## 공유 UI 컴포넌트

| 컴포넌트 | 경로 | 용도 |
|----------|------|------|
| Button | shared/components/ui/Button | 기본 버튼 |
| Card | shared/components/ui/Card | 카드 컨테이너 |
| Input | shared/components/ui/Input | 텍스트 입력 |
| Avatar | shared/components/ui/Avatar | 프로필 아바타 |
| Badge | shared/components/ui/Badge | 뱃지 표시 |
| ProgressBar | shared/components/ui/ProgressBar | 진행률 바 |
| CircularProgress | shared/components/ui/CircularProgress | 원형 진행률 |
| EmptyState | shared/components/feedback/EmptyState | 빈 상태 표시 |
| Skeleton | shared/components/feedback/Skeleton | 로딩 스켈레톤 |
| Screen | shared/components/layout/Screen | 화면 래퍼 |
| Header | shared/components/layout/Header | 상단 헤더 |
| CustomTabBar | shared/components/layout/CustomTabBar | 하단 탭바 |

---

## 주요 명령어

```bash
# Metro bundler 시작
npm start

# 앱 실행
npm run android
npm run ios

# 타입 체크
npm run typecheck

# 테스트
npm run test

# 린트
npm run lint
```

---

## 코딩 컨벤션

### 컴포넌트
- 함수 컴포넌트 + TypeScript
- export default (screen) / named export (shared 컴포넌트)
- Props 타입은 컴포넌트 파일 내 정의

### 스타일링
- Tamagui 컴포넌트 사용 우선
- theme token 기반 색상 적용
- 인라인 스타일 허용 (Tamagui 스타일)

### 파일명
- Screen: `{Name}Screen.tsx`
- Hook: `use{Name}.ts`
- API: `{feature}Api.ts`
- Store: `{name}Store.ts`

### 경로 별칭 (babel module-resolver)
```javascript
// babel.config.js 참조
```

---

## 상세 레퍼런스

- **화면 설계서**: 프로젝트 루트 `2_SCREEN_DESIGN.md`
- **API 엔드포인트**: `src/api/endpoints.ts`
- **테마 설정**: `src/shared/theme/`
