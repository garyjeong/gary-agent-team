# PM - 작업 지침

## 작업 수신 시 프로세스

### 1단계: 프로젝트 식별
- 지시에서 프로젝트명 확인
- Viewster 관련 → Viewstream2025 GitHub org
- Gary 프로젝트 → garyjeong GitHub
- 불명확하면 Gary에게 확인 질문

### 2단계: 분석
```bash
# Viewster 프로젝트
gh issue list --repo Viewstream2025/viewster-frontend --state open
gh pr list --repo Viewstream2025/viewster-backend --state all --limit 10
gh api repos/Viewstream2025/viewster-backend/commits --jq '.[0:5] | .[] | .commit.message'

# Gary 프로젝트
gh repo list garyjeong --limit 20
gh issue list --repo garyjeong/[project] --state open
gh pr list --repo garyjeong/[project] --state all --limit 10
```

### 3단계: 작업 분해
- FE/BE/모바일 구분
- 디자인 필요 여부 판단
- 의존성 순서 결정 (BE 우선 → FE)

### 4단계: 서브에이전트 스폰

**Viewster BE 예시:**
```
sessions_spawn(
  task: "viewster-backend에서 [구체적 작업 내용]. 패턴: Router→Service→Repository. 관련 파일: app/routers/xxx.py, app/services/xxx.py",
  model: "claude-viewster/claude-sonnet-4-6",
  label: "be-[task-name]"
)
```

**Viewster FE 예시:**
```
sessions_spawn(
  task: "viewster-frontend에서 [구체적 작업 내용]. 패턴: Atomic Design + Redux Toolkit. 관련 컴포넌트: src/components/xxx/",
  model: "claude-viewster/claude-sonnet-4-6",
  label: "fe-[task-name]"
)
```

**Nestack BE 예시:**
```
sessions_spawn(
  task: "nestack/backend에서 [작업 내용]. NestJS 11 패턴: Controllers→Services→Repositories. TypeORM 엔티티. 관련 파일: src/modules/xxx/",
  model: "claude-gary/claude-sonnet-4-6",
  label: "be-[task-name]"
)
```

**Nestack FE-Web 예시:**
```
sessions_spawn(
  task: "nestack/web에서 [작업 내용]. React 19 + Vite + Tailwind CSS 4.1. Zustand 상태관리. 관련 파일: src/pages/xxx/",
  model: "claude-gary/claude-sonnet-4-6",
  label: "fe-[task-name]"
)
```

**Python 봇 예시 (gold-message, lotto-pick):**
```
sessions_spawn(
  task: "gold-message에서 [작업 내용]. Python + python-telegram-bot. Fly.io 배포. 관련 파일: main.py",
  model: "claude-gary/claude-sonnet-4-6",
  label: "bot-[task-name]"
)
```

**Flutter 앱 예시:**
```
sessions_spawn(
  task: "[프로젝트]에서 [작업 내용]. Flutter + Dart. GoRouter 네비게이션. Provider/BLoC 상태관리. Material Design 3. 관련 파일: lib/",
  model: "claude-gary/claude-sonnet-4-6",
  label: "flutter-[task-name]"
)
```

### 5단계: 결과 취합 및 QA 스폰
```
sessions_spawn(
  task: "[프로젝트]의 최신 커밋을 리뷰하고 테스트. lint + type-check + 단위 테스트 실행",
  model: "google/gemini-2.5-pro",
  label: "qa-review"
)
```

### 6단계: PR 생성
```bash
# Viewster
gh pr create --repo Viewstream2025/viewster-backend \
  --base develop --head feature/agent-[task] \
  --title "[작업 제목]" \
  --body "## 변경 사항\n- ...\n\n## QA 결과\n- ..."

# Gary 프로젝트
gh pr create --repo garyjeong/[project] \
  --base main --head feature/agent-[task] \
  --title "[작업 제목]" \
  --body "## 변경 사항\n- ...\n\n## QA 결과\n- ..."
```

## 코드 패턴 참조

### Viewster Backend (FastAPI)
```python
# Router (app/routers/)
@router.post("/endpoint")
async def handler(request: Schema, service: Service = Depends()):
    return await service.method(request)

# Service (app/services/)
class XxxService(BaseService):
    async def method(self, data):
        return await self.repository.create(data)
```

### Viewster Frontend
```
src/components/     # Atomic Design (atoms → molecules → organisms → templates)
src/store/          # Redux Toolkit (21 slices)
src/hooks/          # Custom hooks (23개)
src/services/       # API 클라이언트
```

### Nestack Backend (NestJS)
```typescript
@Controller('endpoint')
export class XxxController {
  constructor(private readonly service: XxxService) {}
  @Post() async create(@Body() dto: CreateXxxDto) { ... }
}

@Injectable()
export class XxxService {
  constructor(@InjectRepository(Xxx) private repo: Repository<Xxx>) {}
}
```

### React Frontend (공통)
```
src/
├── components/   # 재사용 컴포넌트
├── pages/        # 라우트 페이지
├── hooks/        # 커스텀 훅
├── stores/       # Zustand 스토어
└── utils/        # 유틸리티
```

### Flutter App
```dart
// GoRouter 네비게이션 + Provider 상태관리 + Material Design 3
// pubspec.yaml: provider ^6.0.0, http ^1.1.0, go_router ^12.0.0
lib/
├── main.dart          # MaterialApp.router + GoRouter
├── models/            # 데이터 모델 (fromJson/toJson)
├── providers/         # ChangeNotifier 기반 상태관리
├── screens/           # 화면 위젯 (Consumer 패턴)
├── widgets/           # 재사용 위젯 (const 생성자)
└── services/          # API 클라이언트
```
