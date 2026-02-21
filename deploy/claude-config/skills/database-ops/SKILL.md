---
name: database-ops
description: |
  Viewster 데이터베이스 운영 & 스키마 관리 skill. PostgreSQL 스키마, Alembic 마이그레이션, 환경별 연결, Redis 키 패턴, 정합성 검증을 다룬다.
  사용 시기: (1) DB 스키마 확인/변경, (2) Alembic 마이그레이션 생성/실행, (3) 환경별 DB 버전 확인, (4) SQL 쿼리 실행, (5) Redis 키 패턴 확인, (6) 데이터 정합성 검증, (7) 백업/복구, (8) 테이블 구조 분석
---

# Viewster Database Operations

PostgreSQL 15.14, Alembic 마이그레이션, Redis 세션 관리를 포함한 DB 운영 skill.

---

## 환경별 연결 정보

| 환경 | 호스트 | 포트 | 접속 방법 |
|:-----|:------|:-----|:---------|
| **Local** | localhost (Docker) | 10000 | `docker exec viewster-postgresql-local psql -U viewster -d viewster` |
| **Staging** | viewster-staging-database.cjqk22y80d83.ap-northeast-2.rds.amazonaws.com | 5432 | SSH → Docker exec |
| **Production** | viewster-production-database.cjqk22y80d83.ap-northeast-2.rds.amazonaws.com | 5432 | SSH → Docker exec |

### 접속 명령어

```bash
# 로컬 (Docker)
docker exec viewster-postgresql-local psql -U viewster -d viewster -c "SQL"

# 스테이징 (SSH → alembic)
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue alembic current"

# 프로덕션 (SSH → alembic)
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker exec backend-blue alembic current"

# 스테이징/프로덕션 (SSH → Python asyncpg)
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue python3 -c 'import asyncio,asyncpg,os
async def c():
 u=os.environ.get(\"DATABASE_URL\",\"\").replace(\"postgresql+asyncpg://\",\"postgresql://\")
 cn=await asyncpg.connect(u)
 rs=await cn.fetch(\"SELECT version()\")
 print(rs)
 await cn.close()
asyncio.run(c())'"
```

### 환경 설정 파일
- Local: `viewster-backend/envs/.env.local` (ENV=local)
- Staging: `viewster-backend/envs/.env.staging` (ENV=staging)
- Production: `viewster-backend/envs/.env.production` (ENV=production, DB URL은 SSM에서 런타임 주입)

### AWS CLI (프로필: jongmun)
```bash
aws rds describe-db-instances --region ap-northeast-2 --profile jongmun
```

---

## 테이블 카탈로그 (68 테이블)

### 사용자 & 인증 (13 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `users` | 11 | 사용자 계정 (account_type: user/advertiser) |
| `user_details` | 20 | 프로필 상세 (제한: login_restricted, post_creation_restricted) |
| `user_emails` | 9 | 이메일 매핑 |
| `user_wallets` | 6 | 리워드 코인 잔액 |
| `user_providers` | 7 | OAuth 소셜 매핑 (Google/Naver/Kakao) |
| `user_bank_accounts` | 9 | 은행 계좌 |
| `user_daily_limits` | 9 | 결제 일일 한도 |
| `roles` | 6 | 역할 정의 |
| `permissions` | 8 | 권한 정의 |
| `role_permissions` | 6 | 역할-권한 M:N |
| `user_roles` | 6 | 사용자-역할 M:N |
| `user_vips` | 7 | VIP 등급 |
| `user_platform_commissions` | 10 | 플랫폼 수수료 |

### 관리자 시스템 (8 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `admin_accounts` | 10 | 관리자 계정 (is_first_login, password_changed_at) |
| `admin_menus` | 12 | 계층 메뉴 (parent_id) |
| `admin_menu_items` | 10 | 사이드바 메뉴 정의 (menu_key, is_active) |
| `admin_menu_permissions` | 6 | 관리자-메뉴 권한 M:N (has_access) |
| `admin_permissions` | 6 | 관리자 권한 |
| `admin_action_types` | 9 | 활동 로그 유형 |
| `admin_action_details` | 9 | 활동 로그 상세 |
| `admin_action_logs` | 9 | 관리자 활동 로그 (감사) |

### 콘텐츠 & 공지 (10 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `reward_posts` | 24 | 리워드 포스트 (content_type: vod/live/shorts, uuid) |
| `reward_post_defaults` | 10 | 콘텐츠 유형별 기본값 (min_watch_time_seconds) |
| `announcements` | 22 | 공지사항 (notice_type, 배너 통합) |
| `announcement_contents` | 7 | 공지 내용 |
| `announcement_impressions` | 8 | 공지 노출 |
| `announcement_clicks` | 8 | 공지 클릭 |
| `announcement_dismissals` | 9 | 공지 닫기 |
| `banners` | 12 | 배너 관리 (is_active, sort_order) |
| `faqs` | 8 | FAQ (sort_order) |
| `tags` | 7 | 태그 마스터 |

### 리워드 시스템 (8 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `user_coin_transaction_actions` | 7 | 거래 유형 (action_name: reward, etc.) |
| `user_reward_history` | 16 | 리워드 지급 이력 |
| `reward_tables` | 9 | CSV 리워드 테이블 메타 (is_active, total_rows) |
| `reward_table_rows` | 5 | 테이블 행 (idx, reward value) |
| `user_reward_table_assignments` | 10 | 사용자-테이블 배정 (current_row_index, available_boxes, total_opened) |
| `user_gold_boxes` | 7 | 골드박스 보유 |
| `gold_box_history` | 9 | 골드박스 획득/사용 이력 |
| `user_watching_logs` | 10 | 시청 로그 |

### 광고 시스템 (4 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `ads` | 32 | 광고 (ad_type: banner/video/preroll, pair_id, priority 1-3) |
| `ad_daily_stats` | 9 | 일별 광고 통계 (가중치 선택용) |
| `ad_tags` | 4 | 광고-태그 M:N |
| `reward_post_tags` | 4 | 콘텐츠-태그 M:N |

### 광고주 시스템 (7 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `advertiser_wallets` | 8 | 광고주 지갑 (balance >= 0 CHECK) |
| `advertiser_orders` | 9 | 충전 주문 |
| `advertiser_payments` | 14 | PG 결제 정보 |
| `advertiser_transactions` | 12 | 거래 이력 (stat_type, impression_seconds, click_count) |
| `advertiser_cash_receipts` | 13 | 현금영수증 |
| `advertiser_settlements` | 12 | 월별 정산 |
| `ad_charging_configs` | 6 | 과금 설정 (config_key: impression_rate, click_rate) |

### 출금 (2 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `extracts` | 14 | 출금 요청 |
| `extract_account_snapshots` | 9 | 출금 시점 계좌 스냅샷 |

### 소셜 & 사용자 활동 (3 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `user_relationships` | 6 | 팔로우 관계 |
| `user_favorites` | 7 | 즐겨찾기 |
| `user_blockings` | 9 | 사용자 차단 |

### YouTube 연동 (3 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `user_youtube_tokens` | 10 | YouTube OAuth 토큰 |
| `user_youtube_data` | 20 | YouTube 데이터 |
| `user_preferences` | 16 | 사용자 선호도 (추천용) |

### 추천 시스템 (2 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `user_recommendation_mappings` | 10 | 사용자-콘텐츠 추천 |
| `user_video_mapping` | 9 | YouTube-콘텐츠 매핑 |

### 시스템 관리 (5 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `items` | 10 | 상품 카탈로그 |
| `ip_blockings` | 8 | IP 차단 규칙 |
| `min_view_time_settings` | 6 | 최소 시청 시간 설정 |
| `live_streams` | 11 | 라이브 스트림 메타 |
| `email_logs` | 6 | SMTP 발송 기록 (email_type, to_email, status) |

### 캠페인 & 기타 (3 테이블)
| 테이블 | 컬럼 수 | 설명 |
|:-------|:--------|:-----|
| `user_watch_log` | 12 | 시청 캠페인 로그 |
| `menu_permissions` | 6 | 메뉴-권한 M:N |
| `alembic_version` | 1 | 마이그레이션 버전 추적 |

---

## Alembic 마이그레이션

### 현재 버전: 49.0 (2026-02-11)

### 마이그레이션 체인 요약 (49개)

| 범위 | 주제 | 주요 변경 |
|:-----|:-----|:---------|
| **1.0-5.0** | 초기 스키마 | 코어 테이블, YouTube 연동, P-Coin 제거 |
| **6.0-10.0** | 리워드 기본값 | reward_post_defaults, 성능 인덱스 |
| **11.0-15.0** | 관리자 시스템 | admin_menu, 사용자 제한, 콘텐츠 차단, 공지/배너 통합 |
| **16.0-21.0** | 추천 & 광고 | 추천 테이블, 태그, 광고 시스템 기초 |
| **22.0-25.0** | 광고주 시스템 | 지갑, 주문, 결제, 거래, CHECK 제약 |
| **26.0-35.0** | 정리 & 감사 | 중복 인덱스/FK 제거, 관리자 활동 로그 |
| **36.0-41.0** | 광고 확장 | video/preroll 타입, 리워드 테이블, 골드박스 |
| **42.0-46.0** | 이메일 & 광고쌍 | email_logs, pair_id, deleted_by, nullable banner |
| **47.0-49.0** | 최신 | min_watch_time 60초, total_opened, 환경별 threshold |

### 비가역 마이그레이션
- **9.0**: 쿠폰 시스템 7개 테이블 DROP (downgrade 불가)
- **18.0**: 결제/주문 4개 테이블 DROP
- **32.0-34.0**: 중복 인덱스/FK/orphan 테이블 정리

### 마이그레이션 명령어

```bash
# 로컬
cd /Users/gary/Documents/workspace/viewster/viewster-backend
ENV=local uv run alembic current              # 현재 버전
ENV=local uv run alembic upgrade head         # 최신 적용
ENV=local REWARD_THRESHOLD_SECONDS=60 uv run alembic upgrade head  # 환경변수 포함
ENV=local uv run alembic history              # 전체 히스토리
ENV=local uv run alembic revision --autogenerate -m "설명" --rev-id=50.0  # 새 마이그레이션

# 스테이징
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue alembic current"
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue alembic upgrade head"

# 프로덕션
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker exec backend-blue alembic current"
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker exec backend-blue alembic upgrade head"
```

### 마이그레이션 주의사항
- **새 마이그레이션 생성 시**: 로컬에서 먼저 테스트 → staging → production 순서
- **환경변수 참조 마이그레이션**: 49.0처럼 `os.getenv()` 사용 시 각 환경별 값 확인 필요
- **데이터 시딩 마이그레이션**: ON CONFLICT DO NOTHING 패턴 사용 (멱등성)
- **rev-id 규칙**: 순차 정수 (다음: 50.0)

---

## Redis 키 패턴

### 시청 세션
| 키 | 값 | TTL | 설명 |
|:---|:---|:----|:-----|
| `active_session:{user_id}:{content_id}` | JSON {tab_id, device_id} | 30초 | 동시 시청 락 |
| `active_tab:{user_id}:{content_id}` | tab_id | 30초 | 활성 탭 |
| `watch_key_{user_id}:{content_id}` | elapsed_ms | - | 누적 시청 시간 |
| `activeUsers:{content_id}` | Set | - | 실시간 시청자 목록 |
| `viewer_session:{content_id}:{tab_id}` | 1 | 30초 | 시청 세션 |
| `global_active` | Hash {user_id → content_id} | - | 전역 활성 세션 |
| `ws_user:{user_id}` | connection_id | - | WebSocket 연결 |

### 보상 타이머
| 키 | 값 | 설명 |
|:---|:---|:-----|
| `timer:remaining:{user_id}:{content_id}` | remaining_seconds | 서버 측 타이머 잔여 시간 |

### Rate Limiting
| 키 | 값 | TTL |
|:---|:---|:----|
| `rate_limit:{ip}:{endpoint}` | 요청 카운트 | 60초 |

### 인증
| 키 | 값 | TTL |
|:---|:---|:----|
| `verification_code:{email}` | 인증 코드 | 5분 |

### 클라이언트 측 (sessionStorage)
| 키 | 값 | 설명 |
|:---|:---|:-----|
| `timer_remaining:{contentId}` | 남은 초 | Race condition 방지 백업 |
| `timer_remaining:{contentId}:timestamp` | 저장 시점 | 24시간 유효성 |

---

## DB 연결 풀 설정

```python
# core/database.py
pool_size = 25        # 기본 유휴 연결
max_overflow = 50     # 피크 시 추가 연결
# 최대 75 연결 (RDS db.t3.micro 한도 100 중)
pool_pre_ping = True  # 연결 유효성 사전 검사
pool_recycle = 1800   # 30분마다 연결 재생성
```

---

## 환경별 차이점

### reward_post_defaults.min_watch_time_seconds
| 환경 | vod/live | shorts | 설정 방법 |
|:-----|:--------|:-------|:---------|
| Local | 60초 | 60초 | REWARD_THRESHOLD_SECONDS=60 |
| Staging | 60초 | 60초 | REWARD_THRESHOLD_SECONDS=60 |
| Production | 600초 | 60초 | REWARD_THRESHOLD_SECONDS=600 (기본값) |

### RDS 인스턴스
| 환경 | 인스턴스 | 스토리지 | 자동 확장 |
|:-----|:--------|:--------|:---------|
| Staging | db.t3.micro | 20GB gp3 | 최대 40GB |
| Production | db.t3.micro | 30GB gp3 | 최대 60GB |

---

## 자주 사용하는 쿼리

### 사용자
```sql
-- 활성 사용자 수
SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;

-- 특정 사용자 조회
SELECT u.id, u.email, ud.nickname, uw.balance
FROM users u
LEFT JOIN user_details ud ON u.id = ud.user_id
LEFT JOIN user_wallets uw ON u.id = uw.user_id
WHERE u.email = 'test@example.com';

-- 사용자 제한 상태
SELECT u.email, ud.login_restricted, ud.post_creation_restricted, ud.restriction_reason
FROM users u JOIN user_details ud ON u.id = ud.user_id
WHERE ud.login_restricted = true OR ud.post_creation_restricted = true;
```

### 리워드 & 랜덤박스
```sql
-- 리워드 테이블 현황
SELECT id, name, total_rows, is_active, created_at FROM reward_tables ORDER BY id DESC;

-- 사용자별 랜덤박스 현황
SELECT u.email, a.table_id, a.current_row_index, a.available_boxes, a.total_opened
FROM user_reward_table_assignments a JOIN users u ON u.id = a.user_id;

-- 골드박스 잔액
SELECT u.email, g.quantity FROM user_gold_boxes g JOIN users u ON u.id = g.user_id
WHERE g.quantity > 0 ORDER BY g.quantity DESC;
```

### 광고
```sql
-- 활성 광고 조회
SELECT id, title, ad_type, ad_status, approval_status, budget, total_charge_amount
FROM ads WHERE ad_status = 'ON' AND deleted_at IS NULL ORDER BY priority;

-- 프리롤 광고
SELECT id, title, video_url, video_duration_seconds
FROM ads WHERE ad_type = 'preroll' AND ad_status = 'ON';

-- 일별 광고 통계
SELECT ad_id, stat_date, impression_count, click_count, charge_amount
FROM ad_daily_stats WHERE stat_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY stat_date DESC;
```

### 광고주
```sql
-- 광고주 지갑 잔액
SELECT u.email, aw.balance FROM advertiser_wallets aw
JOIN users u ON u.id = aw.user_id ORDER BY aw.balance DESC;
```

### 정산 & 출금
```sql
-- 미처리 출금
SELECT e.id, u.email, e.amount, e.status, e.created_at
FROM extracts e JOIN users u ON u.id = e.user_id
WHERE e.status = 'pending' ORDER BY e.created_at;
```

### 시스템 설정
```sql
-- 과금 설정
SELECT config_key, config_value, description FROM ad_charging_configs;

-- 최소 시청 시간
SELECT content_type, min_watch_time_seconds FROM reward_post_defaults WHERE deleted_at IS NULL;

-- IP 차단 목록
SELECT ip_address, reason, created_at FROM ip_blockings WHERE deleted_at IS NULL;
```

### 환경별 DB 버전 확인
```sql
-- Alembic 버전
SELECT version_num FROM alembic_version;
```

---

## 스키마 정합성 검증

### 환경 간 비교 명령어
```bash
# 각 환경 Alembic 버전 확인
docker exec viewster-postgresql-local psql -U viewster -d viewster -t -c "SELECT version_num FROM alembic_version;"
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue alembic current"
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker exec backend-blue alembic current"

# 각 환경 테이블 수 확인
docker exec viewster-postgresql-local psql -U viewster -d viewster -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
```

### 주요 검증 항목
1. **Alembic 버전**: 로컬 >= 스테이징 >= 프로덕션 (로컬이 항상 최신)
2. **테이블 수**: 모든 환경 동일 (현재 68개)
3. **컬럼 구조**: 테이블별 컬럼명, 타입, nullable 일치
4. **인덱스/제약조건**: CHECK, UNIQUE, FK 일치

---

## 백업/복구

### 로컬 pg_dump
```bash
docker exec viewster-postgresql-local pg_dump -U viewster -d viewster > backup.sql
docker exec -i viewster-postgresql-local psql -U viewster -d viewster < backup.sql
```

### RDS 스냅샷
```bash
# 스냅샷 생성
aws rds create-db-snapshot \
  --db-instance-identifier viewster-production-database \
  --db-snapshot-identifier viewster-backup-$(date +%Y%m%d) \
  --profile jongmun --region ap-northeast-2

# 스냅샷 목록
aws rds describe-db-snapshots \
  --db-instance-identifier viewster-production-database \
  --profile jongmun --region ap-northeast-2 \
  --query 'DBSnapshots[*].[DBSnapshotIdentifier,SnapshotCreateTime,Status]' --output table
```

---

## SQLAlchemy 모델 규칙

- **Soft Delete**: 모든 모델에 `deleted_at` 컬럼 (DateTime with timezone)
- **Timestamps**: `created_at`, `updated_at` (server_default=CURRENT_TIMESTAMP)
- **타입 힌트**: `Mapped[T]` + `mapped_column()` (SQLAlchemy 2.0 스타일)
- **관계**: `TYPE_CHECKING` import로 순환 참조 방지
- **M:N**: `Table()` 객체 (ad_tags, reward_post_tags, role_permissions, user_roles, menu_permissions)
- **CHECK 제약**: `advertiser_wallets.balance >= 0`, `ads.total_charge_amount <= budget`, `total_opened >= 0`

---

## 디버깅 체크리스트

1. **DB 연결 풀 소진**: pool_size=25 + max_overflow=50 = 최대 75 (RDS 한도 100)
2. **asyncpg IN 절 에러**: `IN :param` → `= ANY(:param)` 패턴
3. **naive datetime 비교**: `KSTDateTimeResponseMixin` 적용 확인
4. **마이그레이션 스킵**: `alembic stamp` 후 실제 테이블 미생성 여부 확인 (email_logs 사례)
5. **환경 간 스키마 불일치**: 수동 DDL 실행 시 마이그레이션과 동기화 확인
6. **RDS 스토리지 부족**: 자동 확장 한도 확인 (Staging 40GB, Production 60GB)

---

## 관련 스킬
- `backend-api`: 3-Tier 아키텍처, 서비스/리포지토리 패턴
- `watching-session`: WebSocket 이벤트, Redis 세션 관리
- `reward-system`: 리워드 타이머, 랜덤박스, 골드박스
- `deploy-infra`: Terraform RDS, SSM, 배포
