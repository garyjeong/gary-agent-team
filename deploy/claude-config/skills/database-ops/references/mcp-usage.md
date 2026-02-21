# Database MCP & CLI 사용법

## DB MCP 도구

> **주의**: db-mcp는 현재 `psycopg2` 미설치로 connection_string 직접 전달이 안 됨.
> 로컬 DB는 Docker exec, 원격 DB는 SSH + asyncpg 방식 사용.

```typescript
// DB 목록 조회
mcp__db-mcp__list_databases({ use_dotenv: true })

// 테이블 스키마 조회
mcp__db-mcp__describe_tables({ db_name: "viewster", use_dotenv: true })

// SQL 쿼리 실행 (기본 read-only)
mcp__db-mcp__run_query({
  query: "SELECT * FROM users LIMIT 10",
  db_name: "viewster",
  use_dotenv: true,
  mode: "read_only"  // 또는 "read_write"
})
```

---

## 실제 사용 가능한 접속 방법

### 1. 로컬 (Docker exec - 권장)

```bash
# 단일 쿼리
docker exec viewster-postgresql-local psql -U viewster -d viewster -t -c "SELECT version_num FROM alembic_version;"

# 대화형
docker exec -it viewster-postgresql-local psql -U viewster -d viewster

# Redis
docker exec viewster-redis-local redis-cli
docker exec viewster-redis-local redis-cli KEYS "active_session:*"
```

### 2. 스테이징/프로덕션 (SSH + asyncpg)

psql이 Docker 컨테이너 안에 없으므로 Python asyncpg 사용:

```bash
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue python3 -c 'import asyncio,asyncpg,os
async def c():
 u=os.environ.get(\"DATABASE_URL\",\"\").replace(\"postgresql+asyncpg://\",\"postgresql://\")
 cn=await asyncpg.connect(u)
 rs=await cn.fetch(\"YOUR_QUERY_HERE\")
 for r in rs: print(dict(r))
 await cn.close()
asyncio.run(c())'"
```

**주의사항**:
- 쿼리 안의 작은따옴표(')는 `$$` 달러 인용으로 대체: `WHERE table_name=$$email_logs$$`
- 멀티라인 쿼리는 `\"\"\"triple quotes\"\"\"` 사용
- 결과 출력은 `dict(r)` 또는 `r[0], r[1]` 인덱스 접근

### 3. AWS CLI (프로필: jongmun)

```bash
# RDS 인스턴스 상태
aws rds describe-db-instances --region ap-northeast-2 --profile jongmun \
  --query 'DBInstances[*].[DBInstanceIdentifier,EngineVersion,DBInstanceClass,DBInstanceStatus]' --output table

# RDS 스냅샷
aws rds describe-db-snapshots --profile jongmun --region ap-northeast-2 --output table

# SSM 파라미터 (DB 관련)
aws ssm get-parameters-by-path --path /viewster/staging/ --profile jongmun --region ap-northeast-2 --with-decryption
```

---

## Alembic 마이그레이션 CLI

```bash
# 현재 버전 확인
ENV=local uv run alembic current

# 최신으로 업그레이드
ENV=local uv run alembic upgrade head

# 특정 버전으로 업그레이드
ENV=local uv run alembic upgrade 48.0

# 한 단계 롤백
ENV=local uv run alembic downgrade -1

# 히스토리
ENV=local uv run alembic history

# 새 마이그레이션 생성 (autogenerate)
ENV=local uv run alembic revision --autogenerate -m "설명" --rev-id=50.0

# 버전 스탬프 (DDL 실행 없이 버전만 기록)
ENV=local uv run alembic stamp 49.0
```

---

## 환경별 DB 정합성 검증 스크립트

```bash
# 1. 각 환경 Alembic 버전
echo "=== Local ==="
docker exec viewster-postgresql-local psql -U viewster -d viewster -t -c "SELECT version_num FROM alembic_version;"

echo "=== Staging ==="
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec backend-blue alembic current" 2>/dev/null | grep -v "^INFO"

echo "=== Production ==="
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker exec backend-blue alembic current" 2>/dev/null | grep -v "^INFO"

# 2. 각 환경 테이블 수
echo "=== Local Tables ==="
docker exec viewster-postgresql-local psql -U viewster -d viewster -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
```

---

## 과거 발견된 이슈 (2026-02-11)

1. **email_logs 테이블 불일치**: Staging은 수동 생성(11컬럼), Production은 migration 42.0(6컬럼) → Staging DROP/재생성으로 해결
2. **admin_menu_items.is_active**: Production에서 NULLABLE → NOT NULL로 수정
3. **로컬 email_logs 누락**: Migration 42.0이 스킵됨 (stamp 후 미적용) → 수동 CREATE TABLE로 해결
4. **로컬 마이그레이션 지연**: 47.0 → 49.0 (2개 미적용) → `alembic upgrade head`로 해결
