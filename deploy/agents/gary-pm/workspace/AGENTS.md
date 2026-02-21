# Gary PM - 작업 지침

## 작업 수신 시 프로세스

### 1단계: 프로젝트 식별
- 지시에서 프로젝트명 확인 (nestack, gold-message, lotto-pick, etc.)
- 불명확하면 Gary에게 확인 질문

### 2단계: 분석
```bash
# GitHub 최근 활동 확인
gh repo list garyjeong --limit 20
gh issue list --repo garyjeong/[project] --state open
gh pr list --repo garyjeong/[project] --state all --limit 10
```

### 3단계: 작업 분해
- FE/BE/모바일 구분
- 의존성 순서 결정

### 4단계: 서브에이전트 스폰

Nestack BE 예시:
```
sessions_spawn(
  task: "nestack/backend에서 [작업 내용]. NestJS 11 패턴: Controllers→Services→Repositories. TypeORM 엔티티. 관련 파일: src/modules/xxx/",
  model: "claude-cli/sonnet-4.6",
  label: "be-[task-name]"
)
```

Nestack FE-Web 예시:
```
sessions_spawn(
  task: "nestack/web에서 [작업 내용]. React 19 + Vite + Tailwind CSS 4.1. Zustand 상태관리. 관련 파일: src/pages/xxx/",
  model: "claude-cli/sonnet-4.6",
  label: "fe-[task-name]"
)
```

Python 봇 예시 (gold-message, lotto-pick):
```
sessions_spawn(
  task: "gold-message에서 [작업 내용]. Python + python-telegram-bot. Fly.io 배포. 관련 파일: main.py",
  model: "claude-cli/sonnet-4.6",
  label: "bot-[task-name]"
)
```

Flutter 앱 예시:
```
sessions_spawn(
  task: "[프로젝트]에서 [작업 내용]. Flutter + Dart. GoRouter 네비게이션. Provider/BLoC 상태관리. Material Design 3. 관련 파일: lib/",
  model: "claude-cli/sonnet-4.6",
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
gh pr create --repo garyjeong/[project] \
  --base main --head feature/agent-[task] \
  --title "[작업 제목]" \
  --body "## 변경 사항\n- ...\n\n## QA 결과\n- ..."
```

## 프로젝트별 코드 패턴

### Nestack (NestJS)
```typescript
// Controller
@Controller('endpoint')
export class XxxController {
  constructor(private readonly service: XxxService) {}
  @Post() async create(@Body() dto: CreateXxxDto) { ... }
}

// Service
@Injectable()
export class XxxService {
  constructor(@InjectRepository(Xxx) private repo: Repository<Xxx>) {}
}
```

### Python Bots
```python
# Telegram Bot 패턴
from telegram.ext import Application, CommandHandler
app = Application.builder().token(TOKEN).build()
app.add_handler(CommandHandler("command", handler))
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

### React Frontend (공통)
```
src/
├── components/   # 재사용 컴포넌트
├── pages/        # 라우트 페이지
├── hooks/        # 커스텀 훅
├── stores/       # Zustand 스토어
└── utils/        # 유틸리티
```
