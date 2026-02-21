# Viewster 리워드 시스템

리워드 타이머, 랜덤박스, 골드박스, 리워드 테이블 관리를 다루는 skill.
사용 시기: (1) 리워드 타이머 버그, (2) 랜덤박스/골드박스 지급 로직, (3) 리워드 테이블 CSV 관리, (4) 보상 정책 변경, (5) 시청 완료 후 보상 플로우

---

## 핵심 파일 맵

### Frontend (B2C)
| 파일 | 역할 |
|------|------|
| `viewster-frontend/src/components/molecules/ViewingStatusPanel/` | 시청 현황 패널 (타이머, 랜덤박스 상태, 골드박스 잔액) |
| `viewster-frontend/src/components/common/CountdownTimer/` | 카운트다운 타이머 컴포넌트 (1~600초) |
| `viewster-frontend/src/components/organisms/VideoDetailView/VideoDetailView.tsx` | 리워드 타이머 tick 핸들링, sessionStorage 백업 |
| `viewster-frontend/src/hooks/useCountDown.ts` | 카운트다운 훅 (0~600초) |
| `viewster-frontend/src/store/request/requestTimerSession.ts` | GET /timer-session API 호출 |
| `viewster-frontend/src/store/request/requestRandomboxStatus.ts` | GET /randombox/status API 호출 |
| `viewster-frontend/src/store/request/requestGoldboxBalance.ts` | GET /gold-box/balance API 호출 |
| `viewster-frontend/src/components/popup/RandomBoxModal/` | 랜덤박스 오픈 모달 |
| `viewster-frontend/src/components/popup/GoldBoxModal/` | 골드박스 오픈 모달 |
| `viewster-frontend/src/components/common/BoxOpenAnimation/` | Canvas/Framer Motion 박스 오픈 애니메이션 |

### Backend
| 파일 | 역할 |
|------|------|
| `viewster-backend/app/api/routers/randombox.py` | 랜덤박스 API (status, earn, open) |
| `viewster-backend/app/api/routers/gold_box.py` | 골드박스 API (balance, history) |
| `viewster-backend/app/api/routers/box_open.py` | 박스 열기 API (random, gold) |
| `viewster-backend/app/api/routers/reward.py` | 리워드 포스트 목록 |
| `viewster-backend/app/api/routers/session.py` | timer-session (remaining_seconds 조회) |
| `viewster-backend/app/services/reward/` | 리워드 서비스 디렉토리 |
| `viewster-backend/app/services/reward/reward_service.py` | 리워드 Facade 서비스 |
| `viewster-backend/app/services/reward/completion_service.py` | 시청 완료 처리 |
| `viewster-backend/app/services/reward/session_service.py` | 세션 타이머 관리 |
| `viewster-backend/app/services/gold_box_service.py` | 골드박스 비즈니스 로직 |
| `viewster-backend/app/services/csv_parser_service.py` | 리워드 테이블 CSV 파싱 |
| `viewster-backend/app/models/reward.py` | Reward 모델 (SQLAlchemy) |
| `viewster-backend/app/models/reward_history.py` | UserRewardHistory 모델 |
| `viewster-backend/app/models/reward_table.py` | RewardTable 모델 (CSV 배정) |
| `viewster-backend/app/models/gold_box.py` | UserGoldBox 모델 |
| `viewster-backend/app/schemas/reward.py` | 리워드 Pydantic 스키마 |
| `viewster-backend/app/schemas/reward_table.py` | 리워드 테이블 스키마 |

### Admin Frontend
| 파일 | 역할 |
|------|------|
| `viewster-admin-frontend/src/app/reward-tables/` | 리워드 테이블 관리 (CSV 업로드, 배정, 재배정) |
| `viewster-admin-frontend/src/app/rewards/defaults/` | 리워드 기본값 설정 |
| `viewster-admin-frontend/src/app/system-settings/` | 시스템 설정 (랜덤박스/황금박스/보상타이머 탭) |
| `viewster-admin-frontend/src/lib/api/reward-tables.ts` | 리워드 테이블 API 클라이언트 |
| `viewster-admin-frontend/src/lib/api/rewards.ts` | 리워드 설정 API 클라이언트 |
| `viewster-admin-frontend/src/lib/api/gold-box.ts` | 골드박스 설정 API 클라이언트 |
| `viewster-admin-frontend/src/components/reward-tables/` | 리워드 테이블 다이얼로그 (Edit, Upload, Detail, Delete, Reassign) |

---

## 리워드 플로우

### 1. 시청 → 타이머 카운트다운 → 랜덤박스 적립
```
시청 시작 → WebSocket IN
  ↓
Heartbeat 2초마다 → remaining_seconds 감소
  ↓ (600초 → 0초)
시청 완료 → POST /randombox/earn
  ↓
랜덤박스 1개 적립 → 타이머 리셋 (600초)
```

### 2. 랜덤박스 열기 → 리워드 확정
```
랜덤박스 보유 → POST /randombox/open (또는 /box-open/random)
  ↓
리워드 테이블에서 랜덤 선택 → 금액 확정
  ↓
'G' 타입이면 → 골드박스 지급
'P' 타입이면 → 포인트 지급
```

### 3. 골드박스 → 출금
```
골드박스 잔액 → GET /gold-box/balance
  ↓
출금 신청 → POST /extract
  ↓ (관리자 승인)
계좌 이체 → 출금 완료
```

---

## 리워드 타이머 상태 관리

### 서버 (Redis)
```
watch_key_{user_id}:{content_id}   → elapsed_ms (누적 시청 시간)
timer:remaining:{user_id}:{content_id} → remaining_seconds (남은 시간)
```

### 클라이언트 (sessionStorage)
```
timer_remaining:{contentId}           → 남은 시간 (초)
timer_remaining:{contentId}:timestamp → 저장 시점 (24시간 유효)
```

### 동기화 규칙
1. Heartbeat마다 서버 Redis에 remaining_seconds 저장
2. `handleRewardTimerTick`: 매 tick마다 sessionStorage에 백업
3. 탭 복원 시: `Math.min(서버값, 클라이언트값)` 사용 (Race Condition 방지)
4. 서버값 > 클라이언트값 → Race Condition으로 간주, 클라이언트값 채택

---

## 리워드 테이블 관리 (Admin)

### CSV 형식
```csv
리워드금액,타입
100,P
500,P
1000,G
```
- **P**: 포인트 (일반 리워드)
- **G**: 골드 (골드박스 지급)
- 2컬럼 지원 (금액, 타입)

### 배정 플로우
1. CSV 업로드 → 리워드 테이블 생성
2. 사용자 배정 → 특정 사용자에게 테이블 할당
3. 재배정 → 기존 배정 변경 가능

### 관련 API
- `POST /admin/reward-tables/upload` - CSV 업로드
- `POST /admin/reward-tables/assign` - 사용자 배정
- `POST /admin/reward-tables/reassign` - 재배정
- `GET /admin/reward-tables` - 목록 조회

---

## 용어 매핑 (최신)

| 코드 내부 | UI 표시 (한국어) |
|-----------|-----------------|
| randombox | 랜덤박스 |
| gold_box | 황금박스 |
| coin | 리워드 |
| fixed_reward | 랜덤박스 |
| reward_timer | 보상타이머 |

---

## 중복 지급 방지
- `randombox/earn` 호출 시 서버에서 `remaining_seconds > 0` 검증
- 동일 콘텐츠에 대해 이미 적립된 경우 중복 방지
- 프론트엔드: `timerOverCallback`에서 한 번만 호출 보장

---

## 디버깅 체크리스트

1. **타이머가 600초로 리셋됨**: sessionStorage 백업 확인, Heartbeat로 Redis 갱신 확인
2. **랜덤박스 미적립**: `POST /randombox/earn` 응답 확인, remaining_seconds=0 검증
3. **박스 오픈 500 에러**: 리워드 테이블 배정 확인, 빈 테이블 검증
4. **골드박스 잔액 불일치**: gold_box 모델 vs API 응답 비교
5. **시청 완료 콘텐츠 재시청**: timer-session remaining 불일치 (이미 0인데 600 반환)

---

## 관련 스킬
- `watching-session`: WebSocket Heartbeat, remaining_seconds 전송
- `admin-panel`: 리워드 테이블 관리 UI, 시스템 설정
- `database-ops`: 리워드 관련 SQL 쿼리
