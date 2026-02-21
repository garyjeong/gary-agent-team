# Countdown Timer & Reward System - Code Locations

## 카운트다운 타이머 (공통)

### 핵심 컴포넌트

#### CountdownTimer.tsx
```
viewster-frontend/src/components/common/CountdownTimer/CountdownTimer.tsx
```
- **Props**: `seconds`, `delayMs`, `paused`, `persistKey`, `onComplete`, `onTick`
- **주요 로직**: 절대 타임스탬프 기반 카운트다운, 일시정지/재개

#### RewardTimerSection.tsx
```
viewster-frontend/src/components/molecules/RewardTimerSection/RewardTimerSection.tsx
```
- **Props**: `seconds`, `paused`, `persistKey`, `variant`, `displayOnly`
- **역할**: 타이머 UI 래퍼 (portrait/landscape 지원)

#### VideoDetailView.tsx - 타이머 관련
```
viewster-frontend/src/components/organisms/VideoDetailView/VideoDetailView.tsx
```
- **Line ~192**: `isUseTimer` 상태
- **Line ~199**: `rewardCountdownSeconds` 상태
- **Line ~1667**: `handleRewardTimerTick` 콜백
- **Line ~1700**: `timerOverCallback` (리워드 완료)

### API/서비스

#### requestTimerSession.ts
```
viewster-frontend/src/store/request/requestTimerSession.ts
```
- **함수**: `requestTimerSession(postId: number)`
- **응답**: `TimerSessionResponse` (remaining_seconds, terminated, etc.)

#### webSocketService.ts - Heartbeat
```
viewster-frontend/src/services/webSocketService.ts
```
- **상수**: `HEARTBEAT_INTERVAL = 2_000`
- **메서드**: `startHeartbeat()`, `pauseHeartbeat()`, `resumeHeartbeat()`
- **컨텍스트**: `heartbeatContext` (contentId, sessionId, getRemainingSeconds)

---

## 랜덤박스 지급 (VOD/Live)

### 지급 정책
- **VOD/Live**: 600초 시청 완료 → 기본 리워드 + 랜덤박스 지급
- **Shorts**: 600초 시청 완료 → 기본 리워드만 지급 (랜덤박스 없음)

### 핵심 컴포넌트

#### ViewingStatusPanel.tsx
```
viewster-frontend/src/components/molecules/ViewingStatusPanel/ViewingStatusPanel.tsx
```
- **역할**: 자산 보유 현황 표시 (코인, 랜덤박스, 골드박스)

#### VideoDetailView.tsx - 랜덤박스 지급 관련
```
viewster-frontend/src/components/organisms/VideoDetailView/VideoDetailView.tsx
```
- **Line ~1700**: `timerOverCallback` - 타이머 완료 시 랜덤박스 지급 호출
- **조건**: `!isShortsContent` 일 때만 랜덤박스 지급

### API

#### requestRandomboxStatus.ts
```
viewster-frontend/src/store/request/requestRandomboxStatus.ts
```
- **함수**: `fetchRandomboxStatus()` - 랜덤박스 상태 조회
- **함수**: `earnRandombox(videoId: string)` - 랜덤박스 지급 (타이머 완료 시 1회 호출)

---

## 상태 관리

### Redux Slices

#### authSlice.ts
```
viewster-frontend/src/store/slices/authSlice.ts
```
- **상태**: `user`, `isAuthenticated`
- **역할**: 로그인 상태 (타이머 활성화 조건)

#### websocketSlice.ts
```
viewster-frontend/src/store/slices/websocketSlice.ts
```
- **상태**: `isConnected`, `messages`
- **역할**: WebSocket 연결 상태

### Hooks

#### TimerHook.ts
```
viewster-frontend/src/hooks/TimerHook.ts
```
- **훅**: `useNowTimer(intervalMs)`
- **역할**: 주기적 타임스탬프 업데이트

---

## 백엔드

### API 라우터

#### reward.py
```
viewster-backend/app/api/routers/reward.py
```
- **엔드포인트**: `/api/reward/complete` - 리워드 완료
- **엔드포인트**: `/api/reward/timer-session` - 타이머 세션 조회

### 서비스

#### completion_service.py
```
viewster-backend/app/services/reward/completion_service.py
```
- **함수**: `complete_reward()` - 리워드 지급 처리

#### timer_session_service.py
```
viewster-backend/app/services/session/timer_session_service.py
```
- **함수**: `get_timer_session()` - Redis 세션 조회
- **함수**: `update_remaining_seconds()` - 남은 시간 업데이트

---

## 상수 참조

### 프론트엔드 상수
```typescript
// VideoDetailView.tsx
const POLL_MS = 2_000;                    // Heartbeat 주기
const LOCAL_TIME_INCREMENT_MS = 1_000;    // 로컬 시간 증가 주기
const TIMER_PERSIST_KEY_PREFIX = 'viewster-reward-timer';
// 랜덤박스: 타이머 완료 시 1회 지급 (VOD/Live만)

// CountdownTimer.tsx
tickMs = 250;     // UI 업데이트 주기
delayMs = 3000;   // 시작 지연

// webSocketService.ts
const HEARTBEAT_INTERVAL = 2_000;         // Heartbeat 전송 주기
```

### 인터페이스

#### TimerSessionResponse
```typescript
interface TimerSessionResponse {
  started_at: number;
  reward_threshold: number;
  session_id: string;
  remaining_seconds: number | null;
  accumulated_seconds: number;
  expires_at: string | null;
  terminated?: boolean;
  terminated_reason?: string | null;
  terminated_at?: number | null;
}
```

#### SessionEvent (Heartbeat)
```typescript
interface SessionEvent {
  uuid: string;
  user_id: number;
  content_id: number;
  tab_id: string;
  device_id: string;
  event_type: "in" | "out" | "heartbeat";
  timestamp: number;
  session_id: string;
  ip: string;
  remaining_seconds?: number;
}
```
