---
name: countdown
description: |
  Viewster 카운트다운 타이머 & 리워드 시스템 검증 skill. 리워드 타이머, 랜덤박스 지급, WebSocket Heartbeat를 테스트하고 디버깅한다.
  사용 시기: (1) 카운트다운 타이머 버그 수정, (2) 랜덤박스 지급 검증, (3) 동시시청 제어 이슈, (4) Redis 세션 동기화
---

# Countdown Timer & Reward System Skill

카운트다운 타이머와 리워드 지급 로직을 검증하고 테스트한다.

## 문서 참조

**프로젝트 문서**: `/Users/gary/Documents/workspace/viewster/COUNTDOWN.md`

이 스킬을 사용할 때 반드시 위 문서를 먼저 읽어 최신 구현 상태를 확인한다.

---

## 핵심 개념

### 1. 카운트다운 타이머 (공통)
- **목적**: 콘텐츠 시청 시 리워드 지급 (600초 기본)
- **컴포넌트**: `CountdownTimer.tsx`
- **타입 정의**: `CountdownTimer.types.ts`
- **세션 관리**: Redis + sessionStorage
- **특징**: 영상당 1회만 지급 (타이머 재시작 로직 제거됨)

### 2. 리워드 지급 정책
- **VOD/Live**: 600초 시청 완료 → 기본 리워드 + 랜덤박스 지급
- **Shorts**: 600초 시청 완료 → 기본 리워드만 지급 (랜덤박스 없음)
- **컴포넌트**: `ViewingStatusPanel.tsx` (자산 보유 현황 표시)
- **API**: `POST /service/randombox/earn` (타이머 완료 시 1회 호출, VOD/Live만)

### 3. WebSocket Heartbeat
- **목적**: 시청 상태 서버 동기화
- **주기**: 2초 (`HEARTBEAT_INTERVAL`)
- **서비스**: `webSocketService.ts`
- **Fallback**: HTTP Heartbeat (WebSocket 실패 시)

### 4. 멀티 디바이스 제어 (2026-02 신규)
- **Device ID**: `deviceUtils.ts` - 브라우저 핑거프린트 기반
- **이벤트**: `viewing_terminated` - 다른 디바이스 시청 감지
- **처리**: 강제 OUT 전송, 타이머 종료, `terminated: true`

---

## 핵심 파일

### 프론트엔드 - 컴포넌트
| 파일 | 설명 |
|------|------|
| `src/components/common/CountdownTimer/CountdownTimer.tsx` | 카운트다운 타이머 |
| `src/components/common/CountdownTimer/CountdownTimer.types.ts` | 타이머 타입 정의 |
| `src/components/molecules/RewardTimerSection/RewardTimerSection.tsx` | 타이머 UI 래퍼 |
| `src/components/molecules/ViewingStatusPanel/ViewingStatusPanel.tsx` | 자산 보유 현황 패널 |
| `src/components/organisms/VideoDetailView/VideoDetailView.tsx` | 메인 시청 로직 |
| `src/components/organisms/VideoDetailView/VideoDetailView.types.ts` | 시청 뷰 타입 정의 |
| `src/components/organisms/VideoDetailView/RewardInfoHUD.tsx` | 리워드 정보 HUD |
| `src/components/organisms/VideoDetailView/SharedVideoPlayer.tsx` | 공용 비디오 플레이어 |
| `src/components/organisms/VideoDetailView/VideoContentWrap.tsx` | 비디오 콘텐츠 래퍼 |
| `src/components/organisms/VideoDetailView/VideoDetailHeader.tsx` | 비디오 상세 헤더 |
| `src/components/organisms/VideoDetailView/LandscapeCommentsPanel.tsx` | 가로 모드 댓글 패널 |
| `src/components/organisms/VideoDetailView/WrapHeader.tsx` | 래퍼 헤더 |
| `src/components/organisms/VideoDetailView/WrapSideColumn.tsx` | 래퍼 사이드 컬럼 |

### 프론트엔드 - 서비스/유틸
| 파일 | 설명 |
|------|------|
| `src/services/webSocketService.ts` | WebSocket & Heartbeat |
| `src/utils/deviceUtils.ts` | Device ID 생성 (77줄) |
| `src/store/request/requestTimerSession.ts` | Redis 타이머 세션 |
| `src/store/request/requestRandomboxStatus.ts` | 랜덤박스 API |

### 백엔드 - 리워드 서비스
| 파일 | 설명 |
|------|------|
| `app/services/reward/session_service.py` | Redis 타이머 세션 관리 |
| `app/services/reward/completion_service.py` | 리워드 완료 처리 |
| `app/services/reward/default_service.py` | 기본 리워드 서비스 |
| `app/services/reward/post_service.py` | 리워드 POST 처리 |
| `app/services/reward/query_service.py` | 리워드 조회 서비스 |
| `app/services/reward/admin_service.py` | 관리자 리워드 서비스 |

### 백엔드 - API/유틸
| 파일 | 설명 |
|------|------|
| `app/api/routers/reward.py` | 리워드 API 라우터 |
| `app/api/utils/step_timer.py` | 스텝 타이머 유틸리티 |

---

## Race Condition 수정 (2026-02)

### 문제 1: YouTube 플레이어 상태 추적
**이전**: `isPlaying` 상태에 의존 → 클로저로 인한 stale value
**수정**: `isYouTubePlayingRef` ref 추가하여 독립적 상태 추적

```typescript
// VideoDetailView.tsx
const isYouTubePlayingRef = useRef(false);

const onYouTubeStateChange = (event) => {
  const isPlaying = event.data === YT.PlayerState.PLAYING;
  isYouTubePlayingRef.current = isPlaying;
};
```

### 문제 2: 리워드 지급 플래그 클로저
**이전**: `isRewardGiven` 상태 직접 참조 → stale closure
**수정**: `isRewardGivenRef.current` 사용

```typescript
// 타이머 완료 콜백에서
if (isRewardGivenRef.current) return;
isRewardGivenRef.current = true;
```

### 문제 3: API 응답 vs YouTube 시작 타이밍
**이전**: `hasVideoStarted` 조건 사용 → 타이밍 불일치
**수정**: `isYouTubePlayingRef.current` 단독 체크

---

## 테스트 시나리오

### TC-CD-001: 타이머 시작/정지
```gherkin
Scenario: 타이머 시작 조건 검증
  Given 사용자가 로그인 상태
  And 숏츠 영상 페이지 진입
  When 영상 재생 시작
  Then 카운트다운 타이머가 시작됨
  And 타이머 UI에 남은 시간 표시

Scenario: 타이머 일시정지
  Given 타이머가 동작 중
  When 영상 일시정지
  Then 타이머 일시정지됨
  And pausedRemainRef에 남은 시간 저장
```

### TC-CD-002: 페이지 visibility 변경
```gherkin
Scenario: 탭 전환 시 타이머 일시정지
  Given 타이머가 동작 중 (남은 시간: 15초)
  When 다른 탭으로 전환
  Then 타이머 일시정지
  And Heartbeat 일시정지

Scenario: 탭 복귀 시 타이머 재개
  Given 탭 전환으로 타이머 일시정지 상태
  When 원래 탭으로 복귀
  Then 저장된 남은 시간으로 타이머 재개
  And Heartbeat 재개
```

### TC-CD-003: Redis 세션 복원
```gherkin
Scenario: 페이지 새로고침 시 타이머 복원
  Given 타이머가 동작 중 (남은 시간: 20초)
  When 페이지 새로고침
  Then requestTimerSession API 호출
  And Redis의 remaining_seconds로 타이머 초기화
```

### TC-CD-004: 랜덤박스 지급 (VOD/Live)
```gherkin
Scenario: VOD/Live 타이머 완료 시 랜덤박스 지급
  Given 로그인 사용자가 VOD 또는 Live 시청 중
  And 리워드 타이머 동작 중 (600초)
  When 타이머가 0에 도달
  Then 기본 리워드 코인 지급
  And earnRandombox API 호출
  And 랜덤박스 1개 지급

Scenario: Shorts 타이머 완료 시 랜덤박스 미지급
  Given 로그인 사용자가 숏폼(shorts) 시청 중
  When 타이머가 0에 도달
  Then 기본 리워드 코인만 지급
  And earnRandombox API 미호출
  And 랜덤박스 지급 안 함
```

### TC-CD-005: 동시시청 제어
```gherkin
Scenario: 다른 디바이스에서 시청 감지
  Given 디바이스 A에서 영상 시청 중
  When 디바이스 B에서 같은 영상 시청 시도
  Then 디바이스 A에 viewing_terminated 이벤트
  And 타이머 강제 종료
  And terminated: true 플래그 설정

Scenario: Device ID 생성
  Given 새 브라우저 세션
  When deviceUtils.getDeviceId() 호출
  Then 브라우저 핑거프린트 기반 고유 ID 반환
  And localStorage에 저장
```

---

## Playwright E2E 테스트

### 테스트 설정
```typescript
// tests/countdown.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Countdown Timer', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 상태 설정
    await page.goto('http://localhost:3000');
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'test_token');
    });
  });

  test('타이머 시작 및 카운트다운', async ({ page }) => {
    await page.goto('http://localhost:3000/watch/shorts-video-uuid');

    // 타이머 엘리먼트 대기
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toBeVisible();

    // 초기 값 확인
    const initialValue = await timer.textContent();
    expect(parseInt(initialValue || '0')).toBeGreaterThan(0);

    // 3초 대기 후 감소 확인
    await page.waitForTimeout(3000);
    const afterValue = await timer.textContent();
    expect(parseInt(afterValue || '0')).toBeLessThan(parseInt(initialValue || '0'));
  });

  test('탭 전환 시 타이머 일시정지', async ({ page, context }) => {
    await page.goto('http://localhost:3000/watch/shorts-video-uuid');

    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toBeVisible();

    // 새 탭 열어 visibility 변경 시뮬레이션
    const newPage = await context.newPage();
    await newPage.goto('https://example.com');

    const valueBeforeSwitch = await timer.textContent();
    await newPage.waitForTimeout(2000);
    await page.bringToFront();

    // 타이머가 일시정지 상태였는지 확인
    const valueAfterSwitch = await timer.textContent();
    const diff = parseInt(valueBeforeSwitch || '0') - parseInt(valueAfterSwitch || '0');
    expect(diff).toBeLessThanOrEqual(1);
  });
});
```

### 랜덤박스 지급 테스트
```typescript
test.describe('RandomBox Reward', () => {
  test('VOD/Live 타이머 완료 시 랜덤박스 지급', async ({ page }) => {
    // Mock API 응답
    await page.route('**/api/randombox/earn**', route => {
      route.fulfill({
        status: 200,
        json: { earned: true, total_boxes: 1 },
      });
    });

    await page.goto('http://localhost:3000/watch/vod-video-uuid');

    // 타이머 완료 대기 (600초 + 버퍼)
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toContainText('00:00', { timeout: 610000 });

    // 랜덤박스 모달 확인
    await expect(page.locator('[data-testid="randombox-modal"]')).toBeVisible();
  });

  test('Shorts 타이머 완료 시 랜덤박스 미지급', async ({ page }) => {
    let apiCalled = false;
    await page.route('**/api/randombox/earn**', route => {
      apiCalled = true;
      route.fulfill({ status: 200, json: { earned: true } });
    });

    await page.goto('http://localhost:3000/watch/shorts-video-uuid');

    // 타이머 완료 대기
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toContainText('00:00', { timeout: 610000 });

    // 랜덤박스 API 미호출 확인
    expect(apiCalled).toBe(false);
  });
});
```

---

## 브라우저 콘솔 디버깅

### 타이머 상태 확인
```javascript
// sessionStorage 타이머 상태 (키 패턴: timer_remaining:{contentId}, timer_remaining:{contentId}:timestamp)
Object.keys(sessionStorage)
  .filter(k => k.startsWith('timer_remaining:'))
  .forEach(k => console.log(k, sessionStorage.getItem(k)));

// Device ID 확인
localStorage.getItem('viewster_device_id');

// 탭 ID 확인
window.__viewsterTabUniqueId;

// React DevTools에서 확인할 상태
// - isUseTimer
// - rewardCountdownSeconds
// - isShortsContent (true면 랜덤박스 미지급)
// - isPageHidden
// - isYouTubePlayingRef.current
```

### WebSocket 상태 확인
```javascript
// WebSocket 연결 상태 (Redux)
__REDUX_DEVTOOLS_EXTENSION__.getState().websocket;

// Heartbeat 상태 로그 활성화
localStorage.setItem('debug:heartbeat', 'true');
```

---

## 디버깅 체크리스트

### 타이머가 시작되지 않을 때
- [ ] 로그인 상태 확인 (`user !== null`)
- [ ] `isUseTimer` 상태 확인
- [ ] `requestTimerSession` API 응답 확인
- [ ] `terminated` 플래그 확인 (동시 시청 차단)
- [ ] YouTube 플레이어 상태 확인 (`playerState === 1`)
- [ ] `isYouTubePlayingRef.current` 값 확인

### 랜덤박스가 지급되지 않을 때
- [ ] 콘텐츠 타입 확인 (VOD/Live여야 함, Shorts 제외)
- [ ] `isShortsContent` 상태 확인 (true면 랜덤박스 미지급)
- [ ] `timerOverCallback` 호출 여부 확인
- [ ] `earnRandombox` API 호출 및 응답 확인
- [ ] 이미 지급 완료 상태인지 확인 (`isRewardGivenRef.current`)

### 타이머가 리셋될 때
- [ ] `persistKey` 설정 확인
- [ ] sessionStorage 값 확인 (`timer_remaining:{contentId}`)
- [ ] `prevSecondsRef` vs `seconds` 비교
- [ ] 컴포넌트 리마운트 여부 확인

### Heartbeat 문제
- [ ] WebSocket 연결 상태 확인
- [ ] `heartbeatContext` 값 확인
- [ ] HTTP fallback 동작 확인
- [ ] 네트워크 탭에서 요청 주기 확인 (2초)

### 동시 시청 제어 문제
- [ ] Device ID 생성 확인 (`deviceUtils.getDeviceId()`)
- [ ] WebSocket `device_id` 헤더 전송 확인
- [ ] `viewing_terminated` 이벤트 수신 확인
- [ ] `isOtherDevice` 필드 확인

---

## 참조 문서

- [테스트 가이드](references/testing-guide.md)
- [코드 위치](references/code-locations.md)
- [디버그 체크리스트](references/debug-checklist.md)
