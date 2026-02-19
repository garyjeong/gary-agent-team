# OpenClaw Gateway 배포 가이드

---

## 사전 준비

### 필수 도구
- `fly` CLI (Fly.io)
- `gh` CLI (GitHub)

### 필수 계정/토큰
- [x] Telegram 봇 토큰 (1개, 양쪽 채널 공용)
- [x] GitHub PAT (garyjeong, Viewstream2025 접근 가능)
- [x] Gemini API Key (유료)
- [ ] Claude Code 인증 (Max 구독, VM 내부에서 로그인 필요)

---

## Step 1: Fly.io 앱 생성

```bash
cd /Users/gary/Documents/workspace/gary/gary-agent-team/deploy

# 앱 생성
fly apps create gary-openclaw-gateway --org personal

# Volume 생성 (nrt 리전)
fly volumes create openclaw_data --size 2 --region nrt -a gary-openclaw-gateway
```

## Step 2: Secrets 설정

```bash
# Gateway 인증 토큰 (자동 생성)
fly secrets set -a gary-openclaw-gateway \
  GATEWAY_AUTH_TOKEN="$(openssl rand -hex 32)"

# Telegram 봇 토큰
fly secrets set -a gary-openclaw-gateway \
  TELEGRAM_BOT_TOKEN="<YOUR_TELEGRAM_BOT_TOKEN>"

# GitHub PAT
fly secrets set -a gary-openclaw-gateway \
  GITHUB_TOKEN="<YOUR_GITHUB_PAT>"

# Gemini API Key
fly secrets set -a gary-openclaw-gateway \
  GEMINI_API_KEY="<YOUR_GEMINI_API_KEY>"
```

## Step 3: 배포

```bash
cd /Users/gary/Documents/workspace/gary/gary-agent-team/deploy

fly deploy -a gary-openclaw-gateway
```

첫 배포는 Docker 이미지 빌드로 인해 2-3분 소요.

## Step 4: Claude Code CLI 인증 (Gary 도움 필요)

이 단계는 Fly.io VM 내부에서 Claude Code CLI에 Max 구독 계정으로 로그인해야 합니다.

### 방법 A: SSH 접속 후 인터랙티브 로그인

```bash
# Fly.io VM에 SSH 접속
fly ssh console -a gary-openclaw-gateway

# VM 내부에서 Claude Code 로그인
claude login

# 브라우저 인증 URL이 표시됨
# → 해당 URL을 로컬 브라우저에서 열어 Max 구독 계정으로 로그인
# → 인증 완료 후 VM에서 확인
```

### 방법 B: 인증 토큰 직접 주입

로컬에서 Claude Code 인증 토큰을 추출하여 Fly.io secrets로 주입:

```bash
# 로컬에서 토큰 확인 (이미 로그인된 상태)
cat ~/.claude/.credentials.json

# 해당 토큰을 Fly.io에 주입
fly secrets set -a gary-openclaw-gateway \
  CLAUDE_CODE_AUTH_TOKEN="<토큰값>"
```

> **참고**: 정확한 인증 방식은 Claude Code CLI 버전에 따라 다를 수 있습니다.
> `claude --help` 또는 `claude auth status`로 현재 인증 상태를 확인하세요.

### 두 Max 계정 분리 (20x / 5x)

viewster-pm은 Max 20x, gary-pm은 Max 5x를 사용해야 하므로,
에이전트별로 다른 auth-profile을 설정해야 합니다:

```bash
# VM 내부에서
# Max 20x 계정 프로필
claude auth login --profile viewster
# Max 5x 계정 프로필
claude auth login --profile gary
```

config.json5에서 에이전트별 auth-profile 지정:
```json5
{
  agents: {
    list: [
      {
        id: "viewster-pm",
        model: "claude-cli/opus-4.6",
        // auth-profile: "viewster" (Max 20x)
      },
      {
        id: "gary-pm",
        model: "claude-cli/sonnet-4.6",
        // auth-profile: "gary" (Max 5x)
      }
    ]
  }
}
```

## Step 5: 동작 확인

```bash
# 로그 확인
fly logs -a gary-openclaw-gateway

# 상태 확인
fly status -a gary-openclaw-gateway

# Telegram 테스트
# viewster-office 채널에서 봇에게 "hi" 전송
# gary-office 채널에서 봇에게 "hi" 전송
```

## Step 6: 텔레그램 그룹 라우팅 설정

봇 1개로 양쪽 그룹을 라우팅합니다. 그룹 생성 후 chatId를 config.json5에 입력해야 합니다:

1. Telegram에서 viewster-office, gary-office 그룹 생성
2. 봇을 두 그룹에 추가
3. 각 그룹에서 메시지 전송 후 `fly logs -a gary-openclaw-gateway`로 chatId 확인
4. `config.json5`의 `VIEWSTER_OFFICE_CHAT_ID`, `GARY_OFFICE_CHAT_ID`를 실제 값으로 교체
5. `fly deploy -a gary-openclaw-gateway`로 재배포

---

## 트러블슈팅

### Gateway가 시작되지 않을 때
```bash
fly logs -a gary-openclaw-gateway --no-tail
fly ssh console -a gary-openclaw-gateway
# VM 내부에서 수동 실행
openclaw gateway --bind 0.0.0.0 --verbose
```

### Claude Code CLI 인증 실패
```bash
fly ssh console -a gary-openclaw-gateway
claude auth status
claude auth login  # 재로그인
```

### 메모리 부족
```bash
# VM 사이즈 업그레이드
fly scale memory 1024 -a gary-openclaw-gateway
```

---

## 파일 구조

```
deploy/
├── Dockerfile                      # OpenClaw + Claude Code CLI
├── fly.toml                        # Fly.io 설정
├── config.json5                    # OpenClaw Gateway 설정
├── setup-secrets.sh                # Secrets 설정 도우미
├── .gitignore
└── agents/
    ├── viewster-pm/
    │   └── workspace/
    │       ├── SOUL.md             # PM 정체성 + 도메인 지식
    │       ├── AGENTS.md           # 작업 프로세스 지침
    │       └── TOOLS.md            # 도구 허용/금지 목록
    └── gary-pm/
        └── workspace/
            ├── SOUL.md
            ├── AGENTS.md
            └── TOOLS.md
```
