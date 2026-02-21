# Viewster 백엔드 API 아키텍처

FastAPI 기반 백엔드 아키텍처, 라우터/서비스/리포지토리 패턴, 미들웨어, Celery를 다루는 skill.
사용 시기: (1) 새 API 엔드포인트 개발, (2) 서비스/리포지토리 패턴, (3) 미들웨어 수정, (4) Celery 백그라운드 작업, (5) 에러 처리/로깅, (6) Redis 키 관리, (7) DB 모델/마이그레이션, (8) 외부 서비스 연동

---

## 프로젝트 경로
`/Users/gary/Documents/workspace/viewster/viewster-backend`

## 기술 스택
- **FastAPI 0.115.6** + **Uvicorn** + **Python 3.12**
- **SQLAlchemy 2.0.36** (async) + **Alembic** + **asyncpg**
- **Pydantic 2.10.3** + pydantic-settings
- **Redis 5.2** (100 max connections)
- **Celery 5.4** + RabbitMQ (aio-pika)
- **python-jose 3.3** (JWT HS256)
- **structlog** (개발: text, 프로덕션: JSON)
- **boto3** (S3), **httpx/aiohttp** (HTTP), **google-api-python-client** (YouTube)

---

## 3-Tier 아키텍처

```
Router (API 엔드포인트)
  → Service (비즈니스 로직)
    → Repository (데이터 접근)
      → Model (SQLAlchemy ORM)
        → Database (PostgreSQL)
```

---

## 디렉토리 구조

```
app/
├── api/                     # B2C API
│   ├── routers/             # 14개 B2C 라우터
│   ├── websocket/           # WebSocket (router.py 1,450 LOC + connection_manager.py 379 LOC)
│   ├── dependencies/        # JWT 인증 의존성
│   ├── middleware/           # HTTP 로깅
│   └── utils/               # step_timer
├── routers/                 # 20개 Admin 라우터
├── services/                # 60+ 서비스
│   ├── reward/              # 리워드 서비스 (Facade 패턴)
│   ├── oauth/               # OAuth 프로바이더 (Google, Naver, Kakao)
│   ├── youtube/             # YouTube 서비스
│   └── recommendation/     # 추천 시스템 (collaborative, content_based, hybrid)
├── repositories/            # 40+ 리포지토리
├── models/                  # 21개 SQLAlchemy 모델
├── schemas/                 # 26개 Pydantic 스키마
├── core/                    # 설정, DB, Redis, 보안, 로깅 (18 파일)
├── middleware/              # HTTP 미들웨어 (5 파일)
├── tasks/                   # Celery 태스크 (2 파일)
├── utils/                   # 유틸리티
└── dependencies/            # DI
```

---

## B2C API 라우터 (14개)

| 라우터 | 경로 | 핵심 기능 |
|--------|------|----------|
| `ad.py` | `/api/ads` | 광고 조회, 임프레션/클릭 기록 |
| `advertiser.py` | `/api/advertiser` | 광고주 지갑 충전/출금 |
| `box_open.py` | `/api/box-open` | 랜덤박스/골드박스 열기 |
| `coin_transaction.py` | `/api/coin-transactions` | 코인 거래 내역 |
| `gold_box.py` | `/api/gold-box` | 골드박스 잔액/이력 |
| `help.py` | `/api/help` | FAQ/카테고리 |
| `randombox.py` | `/api/randombox` | 랜덤박스 상태/적립/열기 |
| `reward.py` | `/api/rewards` | 리워드 포스트 목록 |
| `search.py` | `/api/search` | 콘텐츠 검색 |
| `session.py` | `/api/service` | timer-session, out-event (HTTP fallback) |
| `social_oauth.py` | `/api/social-oauth` | OAuth 엔드포인트 |
| `task_participation.py` | `/api/tasks` | 태스크 참여 |
| `youtube.py` | `/api/youtube` | YouTube 검색/메타데이터/댓글 |

---

## Admin API 라우터 (20개)

| 라우터 | 주요 기능 |
|--------|----------|
| `admin.py` | 관리자 CRUD |
| `user_admin.py` | 사용자 관리 (목록, 차단, IP 차단) |
| `content_admin.py` | 콘텐츠 삭제/복구 |
| `ad_admin.py` | 광고 승인/거절 |
| `settlement_admin.py` | 정산 생성/확정 |
| `reward_admin.py` | 리워드 설정 |
| `reward_table_admin.py` | 리워드 테이블 CSV 관리 |
| `gold_box_admin.py` | 골드박스 설정 |
| `system_admin.py` | 시스템 설정 (Rate Limit, IP 차단, 시청 시간) |
| `external_services_admin.py` | 외부 서비스 모니터링 (AWS, YouTube, SMTP, RDS) |
| `tag_admin.py` | 태그 관리 |
| `help.py` | FAQ 관리 |
| `advertiser_payment_admin.py` | 광고주 결제 조회 |
| `nice.py` | Nice 본인인증 |

---

## 미들웨어 스택 (실행 순서)

```
CORS → RequestID → RateLimit → Concurrency → Logging
```

| 미들웨어 | 파일 | 설정 |
|---------|------|------|
| CORS | FastAPI 내장 | allow_origins, allow_credentials |
| RequestID | `middleware/rqid.py` | X-Request-ID 헤더 |
| RateLimit | `middleware/rate_limit_redis.py` | 100/min (일반), 60/min (관리자) |
| Concurrency | `middleware/concurrency.py` | 전역 1,000 동시 요청 |
| Logging | `middleware/logging.py` | 요청/응답 structlog |

---

## 서비스 패턴

### Facade 패턴 (RewardService)
```python
class RewardService:
    def __init__(self):
        self.completion = CompletionService()
        self.session = SessionService()
        self.default = DefaultService()
        self.history = RewardHistoryService()
```

### BaseRepository 패턴
```python
class BaseRepository(Generic[T]):
    async def find_by_id(self, id: int) -> T | None
    async def find_all(self, **kwargs) -> List[T]
    async def create(self, **kwargs) -> T
    async def update(self, id: int, **kwargs) -> T
    async def delete(self, id: int) -> bool
```

---

## 에러 처리

### 도메인 예외 계층
```python
# core/exceptions.py
DomainException (base)
├── UserNotFoundError (404)
├── AuthenticationError (401)
├── AuthorizationError (403)
├── BusinessRuleViolationError (422)
├── ResourceNotFoundError (404)
└── ExternalServiceError (502)
```

### KST DateTime 직렬화
```python
# schemas/common.py
class KSTDateTimeResponseMixin:
    # API 응답의 모든 datetime을 KST ISO 8601로 직렬화
    # naive datetime → aware datetime 변환 포함
```

---

## Celery 백그라운드 태스크

| 태스크 | 주기 | 기능 |
|--------|------|------|
| `expired_posts` | 매 시간 | 만료 콘텐츠 정리 |
| `viewer_count_reconciliation` | 60초 | Redis → DB 시청자 수 동기화 |

```python
# core/celery_app.py
app = Celery('viewster', broker='amqp://...')
app.conf.beat_schedule = {...}
```

---

## Redis 키 전체 레퍼런스

### 시청 세션
```
active_session:{user_id}:{content_id}  → JSON {tab_id, device_id} (TTL 30초)
watch_key_{user_id}:{content_id}       → elapsed_ms
activeUsers:{content_id}               → Set (시청자 목록)
global_active                          → Hash {user_id → content_id}
ws_user:{user_id}                      → connection_id
```

### Rate Limiting
```
rate_limit:{ip}:{endpoint}             → 요청 카운트 (TTL 60초)
```

### 기타
```
timer:remaining:{user_id}:{content_id} → remaining_seconds
```

---

## DB 연결 설정

```python
# core/database.py
pool_size = 35
max_overflow = 65
# 최대 100 연결 (RDS db.t3.micro 제한에 맞춤)
pool_pre_ping = True
pool_recycle = 3600
```

---

## 외부 서비스 연동

| 서비스 | 파일 | 용도 |
|--------|------|------|
| YouTube API v3 | `services/youtube/` | 검색, 메타데이터, 댓글, 라이브 |
| Google OAuth | `services/oauth/google_provider.py` | 소셜 로그인 |
| Naver OAuth | `services/oauth/naver_provider.py` | 소셜 로그인 |
| Kakao OAuth | `services/oauth/kakao_provider.py` | 소셜 로그인 |
| Nice | `services/nice_service.py` | 본인인증/계좌인증 |
| PayLetter | `services/pg_service.py` | PG 결제 |
| S3 | `services/s3_service.py` | 파일 저장 |
| SMTP | `services/email_service.py` | 이메일 (DKIM 서명) |
| Telegram | 에러 핸들러 | 프로덕션 에러 알림 |

---

## 최근 주요 변경 (2026-02)

- Redis 키 중앙화 및 dead code 정리
- 미들웨어 중복 통합 및 bare except 제거
- 랜덤박스 오픈 엔드포인트 추가 + CSV 파서 2컬럼 지원
- 프리롤 노출시간 수정 지원 + 조회수순 정렬
- YouTube 라이브 감지 로직 강화 (VOD 오분류 수정)
- FAQ CRUD db.commit() 누락 수정
- asyncpg IN 절 문법: `IN :param` → `= ANY(:param)`
- naive/aware datetime 비교 에러 수정
- 보상 타이머 기본값 60초로 변경

---

## 개발 명령어

```bash
# 로컬 실행
make run          # uvicorn app.main:app --reload --port 8080

# 마이그레이션
make migrate msg="description"   # alembic revision --autogenerate
make upgrade                     # alembic upgrade head

# 테스트
make test         # pytest
make coverage     # pytest --cov
```

---

## 디버깅 체크리스트

1. **500 에러**: structlog에서 traceback 확인, Telegram 알림 확인
2. **401 에러**: JWT 만료, refreshToken 확인
3. **429 에러**: Rate Limit Redis 키 확인 (100/min)
4. **DB 연결 풀 소진**: pool_size=35 + max_overflow=65 = 100 확인
5. **asyncpg 문법 에러**: `IN :param` → `= ANY(:param)` 패턴
6. **naive datetime 비교**: KSTDateTimeResponseMixin 적용 확인

---

## 관련 스킬
- `watching-session`: WebSocket 이벤트 핸들러
- `reward-system`: 리워드 서비스 레이어
- `ad-system`: 광고 API, 과금 로직
- `auth-oauth`: JWT, OAuth 프로바이더
- `database-ops`: SQL, 마이그레이션 (기존 스킬)
- `deploy-infra`: AWS 배포
