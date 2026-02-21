# Viewster 영상 시청 & WebSocket 세션 관리

영상 시청 플로우, WebSocket 실시간 통신, 동시 시청 제어를 다루는 skill.
사용 시기: (1) 시청 페이지 버그 수정, (2) WebSocket 이벤트 수정, (3) 동시 시청 제어 이슈, (4) YouTube Player 통합, (5) 가로모드/풀스크린 이슈, (6) 시청 세션 동기화 문제

---

## 핵심 파일 맵

### Frontend (B2C)
| 파일 | 역할 |
|------|------|
| `viewster-frontend/src/app/watch/page.tsx` | 시청 페이지 라우트 |
| `viewster-frontend/src/components/organisms/VideoDetailView/VideoDetailView.tsx` | **핵심** - 시청 로직 전체 (IN/OUT 이벤트, 타이머, visibility 핸들링) |
| `viewster-frontend/src/components/templates/WatchPageMasterLayout.tsx` | 시청 페이지 레이아웃 (데스크톱/모바일) |
| `viewster-frontend/src/components/templates/VideoDetailLayout.tsx` | 영상 + 사이드바 배치 |
| `viewster-frontend/src/services/webSocketService.ts` | **핵심** - WebSocket 싱글톤 (632 LOC), IN/HEARTBEAT/OUT/viewing_terminated |
| `viewster-frontend/src/hooks/useYouTubePlayer.ts` | YouTube iframe 상태 관리 |
| `viewster-frontend/src/hooks/useLandscapeMode.ts` | 가로모드/풀스크린 감지 |
| `viewster-frontend/src/hooks/useVideoComments.ts` | 댓글 로드 |
| `viewster-frontend/src/hooks/useLiveChat.ts` | YouTube 라이브 채팅 |
| `viewster-frontend/src/hooks/useViewerCountSubscription.ts` | 실시간 시청자 수 |
| `viewster-frontend/src/contexts/AuthContext.tsx` | WebSocket 연결 관리 (force_logout) |

### Backend
| 파일 | 역할 |
|------|------|
| `viewster-backend/app/api/websocket/router.py` | **핵심** (1,450 LOC) - WebSocket 엔드포인트, 이벤트 핸들러 전체 |
| `viewster-backend/app/api/websocket/connection_manager.py` | WebSocket 연결 풀 관리 (379 LOC) |
| `viewster-backend/app/api/routers/session.py` | HTTP fallback (timer-session, out-event) |
| `viewster-backend/app/core/redis.py` | Redis 연결 (세션 상태 저장) |

---

## WebSocket 프로토콜

### 연결
```
ws://{host}/ws/watching/{user_id}/{content_id}/{tab_id}
```
- `tab_id`: UUID v4 (브라우저 탭 식별)
- 연결 시 JWT 쿠키로 인증

### 이벤트 흐름
```
Client → Server:
  IN        → canEnterRoom 검증 → 동시 시청 체크
  HEARTBEAT → 2초 간격, remaining_seconds 동기화
  OUT       → 탭 hidden/beforeunload 시 전송

Server → Client:
  HEARTBEAT        → {remaining_seconds, viewer_count}
  viewing_terminated → 다른 탭/기기에서 시청 시작됨
  force_logout      → 인증 실패 (토큰 만료/중복 로그인)
```

### Redis 키 패턴
```
active_session:{user_id}:{content_id}   → JSON {tab_id, device_id} (TTL 30초)
watch_key_{user_id}:{content_id}        → elapsed_ms (시청 경과 시간)
activeUsers:{content_id}                → Set (현재 시청자)
global_active                           → Hash {user_id: content_id}
ws_user:{user_id}                       → WebSocket connection_id
```

---

## 동시 시청 제어 메커니즘

### canEnterRoom 로직 (router.py)
1. Redis에서 `active_session:{user_id}:{content_id}` 조회
2. `active_tab_id`가 현재 `tab_id`와 다르면 → 이전 탭에 `viewing_terminated` 전송
3. `global_active` Hash에서 다른 콘텐츠 시청 중인지 확인
4. 새 세션 등록 (TTL 30초, Heartbeat로 갱신)

### 주의사항 (P0 버그 히스토리)
- OUT 이벤트에서 Redis 키를 **삭제하면 안 됨** → 30초 TTL 자연 만료에 의존
- `viewing_terminated` 수신 후 route.push('/home') 전에 DOM 이벤트(mousemove)가 끼어들 수 있음
  → `isConcurrentWatchingBlockedRef` 가드로 IN 이벤트 재전송 방지
- `active_session` TTL은 반드시 `ACTIVE_SESSION_TTL_SECONDS`(30초) 사용

---

## 시청 페이지 레이아웃

### 데스크톱 (≥1025px)
```
┌──────────────────────────────────────────────┐
│ Header                                        │
├──────────────────────┬───────────────────────┤
│ YouTube Player       │ 사이드바 (420px)       │
│ (16:9 비율 유지)     │ ├── 시청 현황 패널     │
│                      │ ├── 광고 배너          │
│ 영상 정보            │ ├── 관련 영상          │
│ (제목, 채널, 조회수) │ └── 댓글              │
└──────────────────────┴───────────────────────┘
```

### 모바일 (<1025px)
- 세로: YouTube Player 상단 고정, 하단 스크롤
- 가로: 전체화면 + 우측 사이드 패널 (댓글/채팅)
- 바텀시트: 댓글 표시 (50vh 고정)

### 가로모드 관련 파일
- `useLandscapeMode.ts`: orientation + fullscreen API 감지
- `VideoDetailView.tsx`: 가로모드 시 사이드 패널 렌더링
- iPhone Safe Area 대응: `env(safe-area-inset-right)` 사용

---

## sessionStorage 백업 (Race Condition 방지)

```typescript
// 키 패턴
`timer_remaining:{contentId}`           // 남은 시간 (초)
`timer_remaining:{contentId}:timestamp` // 저장 시점

// 복원 로직 (VideoDetailView.tsx)
const serverValue = response.remaining_seconds;
const clientValue = sessionStorage.getItem(`timer_remaining:${contentId}`);
// 더 작은 값(더 많이 진행된 값) 사용
const restored = Math.min(serverValue, clientValue);
```

---

## 디버깅 체크리스트

1. **WebSocket 연결 안 됨**: `AuthContext.tsx`에서 `setUserId()` 호출 확인
2. **Heartbeat 안 옴**: Redis `active_session` 키 TTL 확인, WebSocket 연결 상태 확인
3. **동시 시청 통과**: `handle_out_event`에서 Redis 키 삭제하고 있는지 확인 (삭제하면 안 됨)
4. **viewing_terminated 미수신**: `webSocketService.userId > 0` 확인, IN 이벤트 전송 확인
5. **가로모드 레이아웃 깨짐**: Safe Area 대응, z-index 계층 (모달 > 오버레이 > 플레이어)
6. **시청자 수 불일치**: Celery `viewer_count_reconciliation` 태스크 확인 (60초 동기화)

---

## 관련 스킬
- `reward-system`: 시청 중 리워드 타이머, 랜덤박스 지급
- `ad-system`: 프리롤 광고, 배너 광고 노출
- `auth-oauth`: WebSocket 인증, force_logout 처리
