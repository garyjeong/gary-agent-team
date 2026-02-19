# OpenClaw Gateway 배포 가이드

## 사전 준비

### 필수 도구
- `fly` CLI (Fly.io)
- `gh` CLI (GitHub)
- Node.js 18+ (대시보드 빌드용)

### 필수 계정/토큰
- Telegram 봇 토큰 (@gary_office_bot)
- GitHub PAT (garyjeong, Viewstream2025 접근 가능)
- Claude Code Max 구독 (VM 내부에서 로그인 필요)

## Step 1: Fly.io 앱 생성

```bash
cd deploy

# 앱 생성
fly apps create gary-openclaw-gateway --org personal

# Volume 생성 (nrt 리전)
fly volumes create openclaw_data --size 2 --region nrt -a gary-openclaw-gateway
```

## Step 2: Secrets 설정

```bash
# Telegram 봇 토큰
fly secrets set -a gary-openclaw-gateway \
  TELEGRAM_BOT_TOKEN="<YOUR_TELEGRAM_BOT_TOKEN>"

# GitHub PAT
fly secrets set -a gary-openclaw-gateway \
  GITHUB_TOKEN="<YOUR_GITHUB_PAT>"
```

## Step 3: 배포

```bash
cd deploy

# 대시보드 프론트엔드 빌드 (../../../agent-dashboard 필요)
bash build-dashboard.sh

# Fly.io 배포
fly deploy --remote-only -a gary-openclaw-gateway
```

배포 시 포함되는 항목:
- OpenClaw Gateway (포트 18789) - 텔레그램 봇 + 에이전트 관리
- 모니터 API + 대시보드 (포트 3001) - 에이전트 상태 모니터링

## Step 4: Claude Code CLI 인증

Fly.io VM 내부에서 Claude Code CLI에 Max 구독 계정으로 로그인해야 합니다.

```bash
# VM에 SSH 접속
fly ssh console -a gary-openclaw-gateway

# claude-viewster 백엔드 인증 (Max 20x)
CLAUDE_CONFIG_DIR=/data/.claude-viewster claude login

# claude-gary 백엔드 인증 (Max 5x)
CLAUDE_CONFIG_DIR=/data/.claude-gary claude login
```

브라우저 인증 URL이 표시되면 로컬 브라우저에서 열어 로그인합니다.

## Step 5: 동작 확인

```bash
# 로그 확인
fly logs -a gary-openclaw-gateway

# 상태 확인
fly status -a gary-openclaw-gateway

# 대시보드 접속
open https://gary-openclaw-gateway.fly.dev:3001

# 모니터 API 테스트
curl https://gary-openclaw-gateway.fly.dev:3001/api/health

# 텔레그램 테스트
# @gary_office_bot 에게 DM 전송
```

## 트러블슈팅

### Gateway가 시작되지 않을 때
```bash
fly logs -a gary-openclaw-gateway --no-tail
fly ssh console -a gary-openclaw-gateway
```

### 세션 꼬임 (에이전트 응답 실패)
```bash
fly ssh console -a gary-openclaw-gateway

# OpenClaw 세션 파일 초기화
rm -f /home/node/.openclaw/agents/pm/sessions/sessions.json
rm -f /home/node/.openclaw/agents/pm/sessions/*.jsonl
```

### Claude Code CLI 인증 실패
```bash
fly ssh console -a gary-openclaw-gateway
CLAUDE_CONFIG_DIR=/data/.claude-gary claude auth status
CLAUDE_CONFIG_DIR=/data/.claude-gary claude login
```

## 파일 구조

```
deploy/
├── Dockerfile                      ← OpenClaw + Claude Code + Monitor
├── fly.toml                        ← Fly.io 설정 (포트 18789 + 3001)
├── config.json5                    ← OpenClaw Gateway 설정
├── setup-secrets.sh                ← Secrets 설정 도우미
├── build-dashboard.sh              ← 대시보드 빌드 스크립트
├── .gitignore
├── agents/
│   ├── pm/workspace/               ← 시윤 (통합 PM)
│   │   ├── CLAUDE.md
│   │   ├── SOUL.md
│   │   ├── AGENTS.md
│   │   └── TOOLS.md
│   ├── viewster-pm/workspace/      ← Viewster PM
│   │   ├── SOUL.md
│   │   ├── AGENTS.md
│   │   └── TOOLS.md
│   └── gary-pm/workspace/          ← Gary PM
│       ├── SOUL.md
│       ├── AGENTS.md
│       └── TOOLS.md
└── monitor/                        ← 모니터링 API 서버
    ├── server.js
    ├── package.json
    └── lib/
        ├── config.js
        ├── sessions.js
        ├── status.js
        ├── logs.js
        └── watcher.js
```
