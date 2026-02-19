# Viewster PM - 작업 지침

## 작업 수신 시 프로세스

### 1단계: 분석
```bash
# GitHub 최근 활동 확인
gh issue list --repo Viewstream2025/viewster-frontend --state open
gh pr list --repo Viewstream2025/viewster-backend --state all --limit 10
gh api repos/Viewstream2025/viewster-backend/commits --jq '.[0:5] | .[] | .commit.message'
```

### 2단계: 작업 분해
- FE 작업인지, BE 작업인지, 양쪽 모두인지 판단
- 디자인이 필요한지 판단
- 의존성 순서 결정 (BE 우선 → FE)

### 3단계: 서브에이전트 스폰
BE 작업 예시:
```
sessions_spawn(
  task: "viewster-backend에서 [구체적 작업 내용]. 패턴: Router→Service→Repository. 관련 파일: app/routers/xxx.py, app/services/xxx.py",
  model: "claude-cli/sonnet-4.6",
  label: "be-[task-name]"
)
```

FE 작업 예시:
```
sessions_spawn(
  task: "viewster-frontend에서 [구체적 작업 내용]. 패턴: Atomic Design + Redux Toolkit. 관련 컴포넌트: src/components/xxx/",
  model: "claude-cli/sonnet-4.6",
  label: "fe-[task-name]"
)
```

### 4단계: 결과 취합 및 커밋
- 서브에이전트 결과 확인
- develop 브랜치에 커밋

### 5단계: QA 스폰
```
sessions_spawn(
  task: "viewster의 develop 브랜치 최신 커밋을 리뷰하고 테스트. QA.md 기준 준수. lint + type-check + 단위 테스트 실행",
  model: "google/gemini-2.5-pro",
  label: "qa-review"
)
```

### 6단계: PR 생성
```bash
gh pr create --repo Viewstream2025/viewster-backend \
  --base develop --head feature/agent-[task] \
  --title "[작업 제목]" \
  --body "## 변경 사항\n- ...\n\n## QA 결과\n- ..."
```

## Backend 코드 패턴 참조

```python
# Router (app/routers/)
@router.post("/endpoint")
async def handler(request: Schema, service: Service = Depends()):
    return await service.method(request)

# Service (app/services/)
class XxxService(BaseService):
    async def method(self, data):
        return await self.repository.create(data)

# Repository (app/repositories/)
class XxxRepository(BaseRepository[XxxModel]):
    pass
```

## Frontend 코드 패턴 참조

```
src/components/     # Atomic Design (atoms → molecules → organisms → templates)
src/store/          # Redux Toolkit (21 slices)
src/hooks/          # Custom hooks (23개)
src/services/       # API 클라이언트
```

## 환경별 도메인

| 환경 | B2C | Admin | API |
|---|---|---|---|
| Staging | staging.viewster.io | staging-admin.viewster.io | staging-api.viewster.io |
| Production | viewster.io | admin.viewster.io | api.viewster.io |
