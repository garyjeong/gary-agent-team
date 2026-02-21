# Countdown Timer & Reward System - Debug Checklist

## 1. 타이머가 시작되지 않음

### 증상
- 숏츠 영상 페이지 진입 시 타이머 UI가 표시되지 않음
- 타이머 값이 0 또는 빈 값으로 표시됨

### 체크리스트

#### 1.1 인증 상태 확인
```javascript
// 콘솔에서 실행
const user = JSON.parse(localStorage.getItem('user') || 'null');
console.log('User:', user);
console.log('Is authenticated:', !!user);
```

#### 1.2 Redux 상태 확인
```javascript
// Redux DevTools 또는 콘솔
// isUseTimer 상태 확인
// React DevTools에서 VideoDetailView 컴포넌트 선택 후 Hooks 탭 확인
```

#### 1.3 API 응답 확인
```javascript
// 네트워크 탭에서 timer-session API 확인
// 필터: timer-session

// 정상 응답 예시
{
  "remaining_seconds": 30,
  "session_id": "...",
  "terminated": false
}
```

#### 1.4 동시시청 차단 확인
```javascript
// API 응답에서 terminated 필드 확인
{
  "terminated": true,
  "terminated_reason": "other_device_watching"
}
// → 다른 디바이스에서 시청 중이므로 타이머 비활성화됨
```

#### 1.5 YouTube 플레이어 상태 확인
```javascript
// 플레이어 상태 코드
// -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
// playerState가 1이어야 타이머 시작
```

---

## 2. 타이머가 예기치 않게 리셋됨

### 증상
- 타이머가 진행 중 갑자기 초기값으로 돌아감
- 페이지 이동 없이 타이머가 재시작됨

### 체크리스트

#### 2.1 persistKey 확인
```javascript
// sessionStorage에 저장된 타이머 상태 확인
Object.keys(sessionStorage)
  .filter(k => k.includes('viewster-reward-timer'))
  .forEach(k => {
    console.log(k, sessionStorage.getItem(k));
  });

// 예상 키:
// viewster-reward-timer-{uuid}:startAt
// viewster-reward-timer-{uuid}:endAt
```

#### 2.2 seconds prop 변경 확인
```javascript
// CountdownTimer의 seconds prop이 변경되면 타이머 리셋됨
// VideoDetailView에서 initialTimerSeconds 변경 원인 확인
```

#### 2.3 컴포넌트 리마운트 확인
```javascript
// React DevTools에서 Profiler 사용
// CountdownTimer 컴포넌트가 unmount → mount 되는지 확인
```

#### 2.4 영상 전환 확인
```javascript
// uuid가 변경되면 타이머 리셋됨
// VideoDetailView의 resetStateOnVideoChange effect 확인
```

---

## 3. 랜덤박스가 지급되지 않음

### 증상
- VOD/Live 영상 타이머 완료 후 랜덤박스가 지급되지 않음
- 랜덤박스 모달이 표시되지 않음

### 체크리스트

#### 3.1 콘텐츠 타입 확인
```javascript
// Shorts는 랜덤박스 미지급
// isShortsContent 값 확인 (true면 랜덤박스 지급 안 함)
console.log('Is shorts content:', isShortsContent);
```

#### 3.2 타이머 완료 콜백 확인
```javascript
// timerOverCallback 호출 여부 확인
// 콘솔 로그: "[VideoDetailView] Timer completed, processing reward"
```

#### 3.3 earnRandombox API 확인
```javascript
// 네트워크 탭에서 randombox/earn API 확인
// 타이머 완료 시 1회 호출되어야 함 (10초 주기 아님)
// 응답 확인: { earned: true/false, total_boxes: N }
```

#### 3.4 중복 지급 방지 확인
```javascript
// 이미 지급된 상태인지 확인
console.log('isRewardGivenRef.current:', isRewardGivenRef.current);
// true면 이미 지급 완료된 상태
```

---

## 4. 탭 전환 시 타이머 동작 문제

### 증상
- 탭 전환 후 복귀 시 타이머가 크게 줄어있음
- 탭 전환 시 타이머가 일시정지되지 않음

### 체크리스트

#### 4.1 visibility 이벤트 확인
```javascript
// visibilitychange 이벤트 리스너 확인
document.addEventListener('visibilitychange', () => {
  console.log('Visibility changed:', document.hidden);
});
```

#### 4.2 pausedRemainRef 확인
```javascript
// CountdownTimer 내부에서 일시정지 시 남은 시간 저장 여부
// 콘솔 로그: "[CountdownTimer] PAUSED - saving remaining time: X"
```

#### 4.3 Heartbeat 일시정지 확인
```javascript
// webSocketService.pauseHeartbeat() 호출 여부
// 네트워크 탭에서 heartbeat 요청이 멈추는지 확인
```

---

## 5. Heartbeat 문제

### 증상
- 서버에서 시청 상태가 동기화되지 않음
- Redis의 remaining_seconds가 업데이트되지 않음

### 체크리스트

#### 5.1 WebSocket 연결 상태
```javascript
// Redux 상태 확인
__REDUX_DEVTOOLS_EXTENSION__?.getState()?.websocket?.isConnected
```

#### 5.2 Heartbeat 컨텍스트
```javascript
// webSocketService의 heartbeatContext 확인
// contentId, sessionId, ip가 올바른지
```

#### 5.3 네트워크 요청
```javascript
// 네트워크 탭에서 heartbeat 요청 확인
// 2초 간격으로 요청이 발생해야 함
// WebSocket 실패 시 HTTP fallback 확인
```

#### 5.4 remaining_seconds 전송
```javascript
// Heartbeat 페이로드에 remaining_seconds 포함 여부
// getRemainingSeconds 콜백이 올바른 값 반환하는지
```

---

## 6. 동시시청 감지 문제

### 증상
- 다른 디바이스에서 시청 시 타이머가 종료되지 않음
- viewing_terminated 이벤트가 수신되지 않음

### 체크리스트

#### 6.1 device_id 확인
```javascript
// 탭별 고유 ID
window.__viewsterTabUniqueId
```

#### 6.2 WebSocket 이벤트 수신
```javascript
// viewing_terminated 이벤트 리스너 확인
// VideoDetailView의 WebSocket 이벤트 핸들러 확인
```

#### 6.3 서버 로그 확인
```bash
# 백엔드 로그에서 동시시청 감지 로그 확인
# "Concurrent viewing detected" 메시지
```

---

## 7. 디버그 도구 설정

### 콘솔 로그 활성화
```javascript
// Heartbeat 로그
localStorage.setItem('debug:heartbeat', 'true');

// 타이머 로그
localStorage.setItem('debug:timer', 'true');

// WebSocket 로그
localStorage.setItem('debug:websocket', 'true');
```

### React DevTools 활용
1. Components 탭에서 VideoDetailView 선택
2. Hooks 탭에서 상태 확인:
   - `isUseTimer`
   - `rewardCountdownSeconds`
   - `viewingProgressSeconds`
   - `isPageHidden`

### Network 탭 필터
```
# API 요청 필터링
timer-session
earn-randombox
heartbeat
reward/complete
```

---

## 8. 빠른 문제 해결 스크립트

### 전체 상태 덤프
```javascript
(function debugCountdown() {
  console.group('=== Countdown Timer Debug ===');

  // 1. Auth
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  console.log('User:', user ? `ID: ${user.id}` : 'Not logged in');

  // 2. Timer state
  const timerKeys = Object.keys(sessionStorage).filter(k =>
    k.includes('viewster-reward-timer')
  );
  console.log('Timer keys:', timerKeys);
  timerKeys.forEach(k => console.log(`  ${k}:`, sessionStorage.getItem(k)));

  // 3. Tab ID
  console.log('Tab ID:', window.__viewsterTabUniqueId);

  // 4. Visibility
  console.log('Page hidden:', document.hidden);

  // 5. WebSocket (if Redux DevTools available)
  try {
    const wsState = __REDUX_DEVTOOLS_EXTENSION__?.getState()?.websocket;
    console.log('WebSocket connected:', wsState?.isConnected);
  } catch (e) {
    console.log('WebSocket state: (Redux DevTools not available)');
  }

  console.groupEnd();
})();
```

### 타이머 강제 리셋
```javascript
// 주의: 개발/디버깅 용도로만 사용
Object.keys(sessionStorage)
  .filter(k => k.includes('viewster-reward-timer'))
  .forEach(k => sessionStorage.removeItem(k));
console.log('Timer state cleared');
```
