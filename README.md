# Gary Agent Team

OpenClaw 기반 AI 에이전트 팀 운영 시스템.
텔레그램을 통해 지시하면 AI PM이 프로젝트를 분석하고, 서브에이전트를 스폰하여 자율적으로 개발 작업을 수행한다.

## 구조

```
Gary (텔레그램)
  └─ 시윤 (통합 PM, 상주)          Claude Sonnet 4.6 / claude-gary
       ├─ Viewster PM (비상주)      claude-viewster 백엔드 (Max 20x)
       │    ├─ BE 서브에이전트       Claude Sonnet 4.6
       │    ├─ FE 서브에이전트       Claude Sonnet 4.6
       │    ├─ 디자인 서브에이전트    Gemini 2.5 Pro
       │    └─ QA 서브에이전트       Gemini 2.5 Pro
       │
       └─ Gary PM (비상주)          claude-gary 백엔드 (Max 5x)
            ├─ BE 서브에이전트       Claude Sonnet 4.6
            ├─ FE/모바일 서브에이전트  Claude Sonnet 4.6
            ├─ 디자인 서브에이전트    Gemini 2.5 Pro
            └─ QA 서브에이전트       Gemini 2.5 Pro
```

## 에이전트 소개

### 시윤 (통합 PM)
- 상주 에이전트. 텔레그램 @gary_office_bot 으로 항상 대기
- 밝고 호기심 많은 성격. 놓칠 수 있는 부분을 먼저 질문하는 꼼꼼함
- Gary와 오래된 파트너처럼 편한 반말로 소통
- 프로젝트를 식별하고 하위 PM에게 위임

### Viewster PM
- 비상주. 시윤이 Viewster 작업 시 스폰
- 분석적이고 철저한 성격. 테스트 통과 없이 PR을 올리지 않는 실행정신
- Viewstream2025 org 전담 (viewster-frontend, viewster-backend 등)

### Gary PM
- 비상주. 시윤이 Gary 프로젝트 작업 시 스폰
- 도전정신이 뚜렷. 시윤과 Gary에게 적극적으로 소통
- garyjeong 계정 전담 (Nestack, gold-message 등)

## 담당 프로젝트

### Viewster (Viewstream2025)
YouTube 기반 리워드 영상 시청 플랫폼
- Frontend: Next.js 16 + React 19 + MUI + Redux Toolkit
- Backend: FastAPI + SQLAlchemy + Pydantic
- DB: PostgreSQL 15 + Redis 7.0
- Infra: AWS (EC2, RDS, ECR) + Terraform
- Git: develop → staging → main

### Gary 프로젝트 (garyjeong)
- Nestack: NestJS 11 + React Native + React Web + PostgreSQL 16
- gold-message: Python Telegram Bot (금시세)
- lotto-pick: Python + Playwright (로또 추천)
- service-status: React 19 + Vite (서비스 모니터링)

## 인프라

| 항목 | 값 |
|---|---|
| 플랫폼 | OpenClaw Gateway |
| 배포 | Fly.io (nrt 리전, 도쿄) |
| VM | shared-cpu-1x, 2048MB |
| 스토리지 | 2GB Persistent Volume (/data) |
| 텔레그램 | @gary_office_bot |
| CLI 백엔드 | claude-viewster (Max 20x), claude-gary (Max 5x) |
| 대시보드 | https://gary-openclaw-gateway.fly.dev:3001 |

## 디렉토리 구조

```
gary-agent-team/
├── README.md                           ← 이 파일
├── DEPLOY-GUIDE.md                     ← 배포 가이드
│
├── deploy/                             ← OpenClaw Gateway 배포
│   ├── Dockerfile
│   ├── fly.toml
│   ├── config.json5                    ← 에이전트/채널/바인딩 설정
│   ├── setup-secrets.sh
│   ├── build-dashboard.sh              ← 대시보드 프론트엔드 빌드 스크립트
│   │
│   ├── agents/
│   │   ├── pm/workspace/               ← 시윤 (통합 PM, 상주)
│   │   │   ├── CLAUDE.md               ← 응답 규칙, 행동 제약 (자동 로드)
│   │   │   ├── SOUL.md                 ← 정체성, 성격, 프로젝트 지식
│   │   │   ├── AGENTS.md               ← 작업 프로세스, 코드 패턴
│   │   │   └── TOOLS.md                ← 허용/금지 도구, Cron
│   │   ├── viewster-pm/workspace/      ← Viewster PM (비상주)
│   │   │   ├── SOUL.md
│   │   │   ├── AGENTS.md
│   │   │   └── TOOLS.md
│   │   └── gary-pm/workspace/          ← Gary PM (비상주)
│   │       ├── SOUL.md
│   │       ├── AGENTS.md
│   │       └── TOOLS.md
│   │
│   └── monitor/                        ← 에이전트 모니터링 API (사이드카)
│       ├── server.js                   ← Express + WebSocket 서버
│       ├── package.json
│       └── lib/
│           ├── config.js               ← OpenClaw 설정 파일 읽기
│           ├── sessions.js             ← 세션 파일 탐색/파싱
│           ├── status.js               ← 에이전트 상태 판단
│           ├── logs.js                 ← 로그 파일 읽기
│           └── watcher.js              ← 파일 변경 감지
│
└── (dashboard-build/)                  ← 빌드 산출물 (gitignore)
```

프론트엔드 소스: [garyjeong/agent-dashboard](https://github.com/garyjeong/agent-dashboard)

## 대시보드

OpenClaw 내부의 에이전트 상태를 실시간으로 모니터링하는 모바일 퍼스트 대시보드.

**접속**: https://gary-openclaw-gateway.fly.dev:3001

### 기능

- 에이전트 조직도 (시윤 → Viewster PM / Gary PM → 서브에이전트)
- 실시간 상태 표시 (활성 / 대기 / 오프라인)
- 세션 정보 (모델, 토큰 사용량, 마지막 활동 시간)
- API 호출 카운트 및 활성 세션 수
- 최근 활동 타임라인
- WebSocket 기반 실시간 이벤트

### 기술 스택

- Frontend: Next.js 16 + React 19 + Tailwind CSS (정적 빌드)
- Backend: Express.js (OpenClaw 컨테이너 사이드카, 포트 3001)
- 실시간: WebSocket + fs.watch 파일 변경 감지
- 배포: OpenClaw 컨테이너 내 사이드카 (동일 Fly.io 인스턴스)

### API 엔드포인트

| 엔드포인트 | 설명 |
|---|---|
| GET /api/agents | 에이전트 목록 + 상태 + 토큰 사용량 |
| GET /api/sessions | 전체 세션 데이터 |
| GET /api/sessions/:agentId | 특정 에이전트 세션 |
| GET /api/stats | 집계 통계 (에이전트 수, 세션, 토큰) |
| GET /api/logs | 최근 OpenClaw 로그 |
| GET /api/health | 서버 + OpenClaw 프로세스 상태 |
| WS /ws | 실시간 이벤트 스트림 |

## 배포

```bash
cd deploy

# 대시보드 프론트엔드 빌드 (agent-dashboard 리포 필요)
bash build-dashboard.sh

# Fly.io 배포
fly deploy --remote-only -a gary-openclaw-gateway
```

상세 배포 절차는 [DEPLOY-GUIDE.md](./DEPLOY-GUIDE.md) 참조.
