# Countdown Timer & Reward System - Testing Guide

## 테스트 환경 설정

### Playwright 설정
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000, // 타이머 테스트는 시간이 오래 걸림
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
});
```

### 테스트 헬퍼 함수
```typescript
// tests/helpers/countdown.ts

/**
 * 로그인 상태 설정
 */
export async function setupAuthState(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'test_token');
    sessionStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'test@example.com',
      reward: 1000,
    }));
  });
}

/**
 * 타이머 상태 가져오기
 */
export async function getTimerState(page: Page) {
  return page.evaluate(() => {
    const keys = Object.keys(sessionStorage).filter(k =>
      k.includes('viewster-reward-timer')
    );
    return keys.reduce((acc, k) => {
      acc[k] = sessionStorage.getItem(k);
      return acc;
    }, {} as Record<string, string | null>);
  });
}

/**
 * 시청 진행률 가져오기
 */
export async function getViewingProgress(page: Page): Promise<number> {
  const text = await page.locator('[data-testid="progress-current"]').textContent();
  return parseInt(text || '0');
}

/**
 * visibility 변경 시뮬레이션
 */
export async function simulateVisibilityChange(page: Page, hidden: boolean) {
  await page.evaluate((isHidden) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => isHidden,
    });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => isHidden ? 'hidden' : 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/**
 * 네트워크 요청 대기
 */
export async function waitForApiCall(page: Page, urlPattern: RegExp) {
  return page.waitForResponse(response =>
    urlPattern.test(response.url()) && response.status() === 200
  );
}
```

---

## Unit Tests (Jest + RTL)

### CountdownTimer.test.tsx
```typescript
import { render, screen, act } from '@testing-library/react';
import CountdownTimer from '@/components/common/CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('초기 값 렌더링', () => {
    render(<CountdownTimer seconds={30} delayMs={0} />);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  test('카운트다운 진행', () => {
    render(<CountdownTimer seconds={30} delayMs={0} />);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByText('25')).toBeInTheDocument();
  });

  test('일시정지 시 카운트다운 중지', () => {
    const { rerender } = render(
      <CountdownTimer seconds={30} delayMs={0} paused={false} />
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.getByText('25')).toBeInTheDocument();

    // 일시정지
    rerender(<CountdownTimer seconds={30} delayMs={0} paused={true} />);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // 여전히 25초 (변화 없음)
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  test('완료 시 onComplete 호출', () => {
    const onComplete = jest.fn();
    render(
      <CountdownTimer seconds={5} delayMs={0} onComplete={onComplete} />
    );

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test('onTick 콜백 호출', () => {
    const onTick = jest.fn();
    render(
      <CountdownTimer seconds={10} delayMs={0} onTick={onTick} />
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // 여러 번 호출됨 (250ms 간격)
    expect(onTick).toHaveBeenCalled();
    expect(onTick).toHaveBeenLastCalledWith(7); // 10 - 3 = 7
  });
});
```

### ViewingStatusPanel.test.tsx
```typescript
import { render, screen } from '@testing-library/react';
import { ViewingStatusPanel } from '@/components/molecules/ViewingStatusPanel';

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, reward: 1000 },
  }),
}));

describe('ViewingStatusPanel', () => {
  test('자산 보유 현황 렌더링', () => {
    render(
      <ViewingStatusPanel
        coinBalance={1000}
        randomBoxCount={5}
        goldBoxCount={2}
      />
    );

    expect(screen.getByText('1,000')).toBeInTheDocument(); // 코인
    expect(screen.getByText('5')).toBeInTheDocument();     // 랜덤박스
    expect(screen.getByText('2')).toBeInTheDocument();     // 골드박스
  });

  test('아이콘 표시', () => {
    render(
      <ViewingStatusPanel
        coinBalance={500}
        randomBoxCount={3}
        goldBoxCount={1}
      />
    );

    expect(screen.getByTestId('reward-coin-icon')).toBeInTheDocument();
    expect(screen.getByTestId('random-box-icon')).toBeInTheDocument();
    expect(screen.getByTestId('gold-box-icon')).toBeInTheDocument();
  });
});
```

---

## E2E Tests (Playwright)

### countdown-timer.spec.ts
```typescript
import { test, expect } from '@playwright/test';
import { setupAuthState, getTimerState, simulateVisibilityChange } from './helpers/countdown';

test.describe('Countdown Timer E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupAuthState(page);
  });

  test('숏츠 영상에서 타이머 시작', async ({ page }) => {
    // Mock API 응답
    await page.route('**/api/timer-session/**', route => {
      route.fulfill({
        status: 200,
        json: {
          remaining_seconds: 30,
          session_id: 'test-session',
          terminated: false,
        },
      });
    });

    await page.goto('/watch/test-shorts-uuid');

    // 타이머 표시 대기
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toBeVisible({ timeout: 10000 });

    // 카운트다운 진행 확인
    const initialValue = parseInt(await timer.textContent() || '0');
    await page.waitForTimeout(3000);
    const afterValue = parseInt(await timer.textContent() || '0');

    expect(afterValue).toBeLessThan(initialValue);
  });

  test('탭 전환 시 타이머 일시정지', async ({ page }) => {
    await page.goto('/watch/test-shorts-uuid');

    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toBeVisible();

    // 초기 값 기록
    const beforeValue = parseInt(await timer.textContent() || '0');

    // visibility hidden 시뮬레이션
    await simulateVisibilityChange(page, true);
    await page.waitForTimeout(3000);

    // visibility visible 복구
    await simulateVisibilityChange(page, false);

    // 타이머가 크게 줄지 않았어야 함
    const afterValue = parseInt(await timer.textContent() || '0');
    expect(beforeValue - afterValue).toBeLessThanOrEqual(2);
  });

  test('페이지 새로고침 시 Redis에서 복원', async ({ page }) => {
    // 초기 세션 응답
    await page.route('**/api/timer-session/**', route => {
      route.fulfill({
        status: 200,
        json: {
          remaining_seconds: 20,
          session_id: 'test-session',
        },
      });
    });

    await page.goto('/watch/test-shorts-uuid');

    // 타이머 확인
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toContainText('20');

    // 새로고침
    await page.reload();

    // 복원된 타이머 확인
    await expect(timer).toBeVisible();
    const value = parseInt(await timer.textContent() || '0');
    expect(value).toBeLessThanOrEqual(20);
  });

  test('동시시청 감지 시 타이머 종료', async ({ page }) => {
    // terminated 응답 시뮬레이션
    await page.route('**/api/timer-session/**', route => {
      route.fulfill({
        status: 200,
        json: {
          remaining_seconds: null,
          terminated: true,
          terminated_reason: 'other_device_watching',
        },
      });
    });

    await page.goto('/watch/test-shorts-uuid');

    // 타이머가 표시되지 않거나 비활성화됨
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).not.toBeVisible({ timeout: 5000 });
  });
});
```

### randombox-reward.spec.ts
```typescript
import { test, expect } from '@playwright/test';
import { setupAuthState } from './helpers/countdown';

test.describe('RandomBox Reward E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupAuthState(page);
  });

  test('VOD/Live 타이머 완료 시 랜덤박스 API 호출', async ({ page }) => {
    let apiCalled = false;

    await page.route('**/api/randombox/earn**', route => {
      apiCalled = true;
      route.fulfill({
        status: 200,
        json: { earned: true, total_boxes: 1 },
      });
    });

    await page.goto('/watch/test-vod-uuid');

    // 타이머 완료 대기 (600초 테스트 환경에서는 mock으로 단축)
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toContainText('00:00', { timeout: 610000 });

    // API가 1회 호출됨
    expect(apiCalled).toBe(true);
  });

  test('Shorts 타이머 완료 시 랜덤박스 API 미호출', async ({ page }) => {
    let apiCalled = false;

    await page.route('**/api/randombox/earn**', route => {
      apiCalled = true;
      route.fulfill({ status: 200, json: { earned: true } });
    });

    await page.goto('/watch/test-shorts-uuid');

    // 타이머 완료 대기
    const timer = page.locator('[data-testid="countdown-timer"]');
    await expect(timer).toContainText('00:00', { timeout: 610000 });

    // API 미호출 확인 (Shorts는 랜덤박스 미지급)
    expect(apiCalled).toBe(false);
  });

  test('타이머 완료 시 기본 리워드 + 랜덤박스 모달 표시', async ({ page }) => {
    await page.route('**/api/randombox/earn**', route => {
      route.fulfill({
        status: 200,
        json: { earned: true, total_boxes: 1 },
      });
    });

    await page.goto('/watch/test-vod-uuid');

    // 타이머 완료 후 랜덤박스 모달 확인
    await expect(page.locator('[data-testid="randombox-modal"]')).toBeVisible({ timeout: 610000 });
  });
});
```

---

## API Mocking

### MSW 설정
```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // 타이머 세션 조회
  rest.get('/api/timer-session/:postId', (req, res, ctx) => {
    return res(
      ctx.json({
        remaining_seconds: 30,
        session_id: 'mock-session-123',
        reward_threshold: 30,
        terminated: false,
      })
    );
  }),

  // 랜덤박스 지급 (타이머 완료 시, VOD/Live만)
  rest.post('/api/earn-randombox', (req, res, ctx) => {
    return res(
      ctx.json({
        earned: true,
        total_boxes: 1,
      })
    );
  }),

  // Heartbeat
  rest.post('/api/heartbeat', (req, res, ctx) => {
    return res(ctx.status(200));
  }),
];
```

---

## 테스트 실행 명령어

```bash
# Unit Tests
npm run test -- --testPathPattern=countdown

# E2E Tests
npx playwright test countdown

# 특정 테스트만 실행
npx playwright test countdown-timer.spec.ts

# 디버그 모드
npx playwright test --debug

# UI 모드
npx playwright test --ui

# 비디오 녹화
npx playwright test --video=on
```
