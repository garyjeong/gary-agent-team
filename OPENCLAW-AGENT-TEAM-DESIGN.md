# OpenClaw AI Agent Team 설계 문서

> 작성일: 2026-02-19
> 작성자: Gary Jeong (대표)
> 버전: 1.1 (CLI 백엔드 적용)

---

## 목차

1. [개요](#1-개요)
2. [OpenClaw 플랫폼 분석](#2-openclaw-플랫폼-분석)
3. [프로젝트 현황](#3-프로젝트-현황)
4. [아키텍처 설계](#4-아키텍처-설계)
5. [에이전트 구성](#5-에이전트-구성)
6. [워크플로우](#6-워크플로우)
7. [모델 배분 및 비용](#7-모델-배분-및-비용)
8. [멀티 모델 통합](#8-멀티-모델-통합)
9. [보안 설계](#9-보안-설계)
10. [리스크 및 대응](#10-리스크-및-대응)
11. [구축 로드맵](#11-구축-로드맵)

---

## 1. 개요

### 1.1 목적

OpenClaw 플랫폼을 활용하여 2개의 AI 에이전트 개발팀을 구성하고, 텔레그램 채널을 통해 Gary 대표가 지시하는 작업을 자율적으로 수행하는 시스템을 구축한다.

### 1.2 팀 구성

| 팀 | 텔레그램 채널 | GitHub | 역할 |
|---|---|---|---|
| **Team Viewster** | viewster-office | github.com/Viewstream2025 | Viewster 프로젝트 전담 (외주형) |
| **Team Gary** | gary-office | github.com/garyjeong | Gary 개인 프로젝트 전담 (내부팀) |

### 1.3 운영 방식

```
작업 지시 → PM 분석(히스토리 포함) → 작업 하달 → 개발/디자인 → QA 완료 → PR 생성
```

### 1.4 AI 모델

- **Claude**: Opus, Sonnet (CLI 형태, Max 요금제)
- **Gemini**: 2.5 Pro (CLI 형태, 유료 요금제)

### 1.5 인프라

- **Gateway**: Fly.io 단일 인스턴스
- **커뮤니케이션**: 텔레그램 (팀별 채널 분리)

---

## 2. OpenClaw 플랫폼 분석

### 2.1 OpenClaw이란

OpenClaw은 로컬/서버에서 실행되는 오픈소스 개인 AI 에이전트 프레임워크이다. PSPDFKit 창립자 Peter Steinberger가 만들었으며, MIT 라이선스로 공개되어 있다.

| 항목 | 수치 |
|---|---|
| GitHub Stars | 209,000+ |
| Discord 커뮤니티 | 1.4M+ 멤버 |
| 라이선스 | MIT |
| 생성일 | 2025-11-24 |

### 2.2 핵심 기능

- **멀티 에이전트 라우팅**: 채널/계정별로 에이전트를 분리하여 라우팅
- **서브에이전트 시스템**: PM이 작업 특성에 맞는 모델로 서브에이전트를 동적 스폰
- **멀티 모델 지원**: Claude, Gemini, GPT, 로컬 모델 네이티브 지원
- **CLI 백엔드**: Claude Code CLI를 백엔드로 사용하여 Max 구독 인증 활용 가능 (API 키 불필요)
- **텔레그램 통합**: 봇 토큰 기반 채널 연동
- **영속 메모리**: 로컬 Markdown 파일 기반 컨텍스트 저장
- **Cron 작업**: 주기적 감시 및 자동 실행
- **GitHub 연동**: gh CLI를 통한 Issue/PR/브랜치 관리

### 2.3 서브에이전트 스펙

| 항목 | 값 |
|---|---|
| 최대 스폰 깊이 (maxSpawnDepth) | 기본 1, 오케스트레이터 패턴 시 2 |
| 에이전트당 동시 자식 수 (maxChildrenPerAgent) | 5 |
| Gateway 전체 동시 실행 (maxConcurrent) | 8 |
| 서브에이전트별 모델 지정 | 가능 (스폰 시 model 파라미터) |
| 완료 후 자동 아카이브 | 60분 (기본값) |
| 결과 보고 | announce 메커니즘으로 부모 에이전트에 보고 |

### 2.4 관련 도구

| 도구 | 용도 | URL |
|---|---|---|
| Antfarm | YAML 기반 멀티 에이전트 팀 프로비저닝 | github.com/snarktank/antfarm |
| Mission Control | 중앙화된 에이전트 대시보드/거버넌스 | github.com/abhi1693/openclaw-mission-control |

### 2.5 보안 주의사항

CrowdStrike가 별도 보안 분석을 발표할 정도로 주의가 필요하다:

- 프롬프트 인젝션 (직접/간접) 취약점 존재
- 넓은 시스템 권한 → 샌드박스 필수
- 에이전트 폭발 반경 (하나 뚫리면 연동 전체에 영향)
- 인터넷 노출 시 HTTPS 필수

### 2.6 프로젝트 불확실성

- 2026-02-14: 창립자 Peter Steinberger OpenAI 합류 발표
- 프로젝트는 오픈소스 재단으로 이관 예정
- MIT 라이선스이므로 포크 가능

---

## 3. 프로젝트 현황

### 3.1 Team Viewster 담당 프로젝트

경로: `/Users/gary/Documents/workspace/viewster/`

#### 프로젝트 구성

| 프로젝트 | 기술 스택 | 규모 |
|---|---|---|
| **viewster-frontend** | Next.js 16, React 19, MUI, Redux Toolkit | 1,337 TS 파일, 115+ 컴포넌트 |
| **viewster-admin-frontend** | Next.js 16, React 19, MUI, SWR, Chart.js | 32 관리 페이지 |
| **viewster-backend** | Python 3.12, FastAPI, SQLAlchemy, Celery, Redis | 3,893 PY 파일, 63 모델, 58 서비스 |
| **viewster-terraform** | Terraform, AWS (EC2, RDS, ECR, Route53, SES) | 9+ .tf 파일/환경 |
| **viewster-table** | CSV 데이터 파일 (보상 테이블, 골드박스) | - |

#### 도메인 개요

Viewster는 YouTube 기반 보상형 영상 시청 플랫폼이다:
- 사용자가 YouTube 영상을 10분 시청하면 랜덤 박스(보상) 지급
- WebSocket 2초 하트비트 기반 실시간 동기화
- 광고주 시스템 (배너 + 프리롤 페어 매칭)
- 관리자 대시보드 (유저/콘텐츠/광고/정산 관리)

#### Git 브랜치 전략

```
develop → staging (GitHub Actions 자동배포) → main (프로덕션 자동배포)
```

#### 기존 문서 자산

| 문서 | 내용 | 분량 |
|---|---|---|
| CLAUDE.md | 프로젝트 기술 가이드 | 191줄 |
| AGENTS.md | 개발 워크플로우 가이드 | 311줄 |
| PRD.md | 제품 요구사항 명세 | 1,072줄 |
| FLOW.md | 기능 흐름도 | 1,693줄 |
| QA.md | QA 가이드라인 | 38KB |
| RULE.md | 개발 규칙 | 19KB |
| DEPLOY.md | 배포 절차 | 269줄 |

> 이 문서들은 에이전트의 SOUL.md/AGENTS.md로 직접 활용 가능하다.

### 3.2 Team Gary 담당 프로젝트

경로: `/Users/gary/Documents/workspace/gary/`

#### 주요 활성 프로젝트

| 프로젝트 | 기술 스택 | 상태 |
|---|---|---|
| **Nestack** (주력) | NestJS 11 + React Native + React Web + PostgreSQL 16 | 활발한 개발중 |
| **gary-agent-dashboard** | FastAPI + Next.js 16 + Gemini AI + Telegram | 활발한 개발중 |
| **service-status** | React 19 + Vite + React Query | 배포됨 |
| **gold-message** | Python + Telegram Bot | Fly.io 배포됨 |
| **lotto-pick** | Python + Playwright + Telegram Bot | Fly.io 배포됨 |
| **stylesketch** | Node.js + Firebase + Gemini | 개발중 |
| 기타 10+ 프로젝트 | 다양 | 유지보수 |

#### Nestack 상세

커플/가족 금융 미션 SaaS 플랫폼:
- 백엔드: NestJS 11 + TypeScript 5.7 + PostgreSQL 16
- 모바일: React Native 0.83 + React 19 + Tamagui
- 웹: React 19 + Vite 7.3 + Tailwind CSS 4.1
- 17 TypeORM 엔티티, OpenBanking API 연동

#### 배포 환경

- 메인 배포: **Fly.io**
- 기존 MCP 서버: 8개 Docker 기반 (sequential-thinking, chrome-devtools, aws, github, db, flyio, pdf, official-docs)

---

## 4. 아키텍처 설계

### 4.1 단일 Gateway 구조

```
                         [Gary 대표]
                    ┌────────┴────────┐
                    ▼                 ▼
          viewster-office        gary-office
          (텔레그램 채널)         (텔레그램 채널)
                    └────────┬────────┘
                             ▼
              ┌──────────────────────────────┐
              │   Fly.io: openclaw-gateway    │
              │   Region: nrt (도쿄)          │
              │   shared-cpu-1x / 512MB       │
              │   Volume: 2GB                 │
              │                              │
              │   Claude: CLI 백엔드 방식      │
              │   ├ Claude Code CLI 내장      │
              │   │  (Max 구독 인증 사용)      │
              │   ├ GEMINI_API_KEY (유료)     │
              │   ├ TELEGRAM_BOT_TOKEN       │
              │   │  (viewster/gary 봇)      │
              │   └ GITHUB_TOKEN             │
              │      (garyjeong PAT, 공용)    │
              │                              │
              │   상주 에이전트 (2개):          │
              │   ├ viewster-pm (Opus)        │
              │   └ gary-pm (Sonnet)          │
              │                              │
              │   동적 서브에이전트:            │
              │   ├ BE/FE 개발 (Sonnet)       │
              │   ├ 디자인 (Gemini)           │
              │   └ QA 리뷰/테스트 (Gemini)   │
              │                              │
              │   maxConcurrent: 8           │
              └──────────────────────────────┘
                      │              │
                      ▼              ▼
          GitHub: Viewstream2025   GitHub: garyjeong
          (private repos)          (public/private repos)
```

### 4.2 단일 Gateway 선택 근거

비용 차이가 월 ~$4로 무시 가능하며, 관리 포인트를 최소화하기 위해 단일 Gateway를 채택한다.

| 항목 | 단일 Gateway | 분리 Gateway |
|---|---|---|
| Fly.io 월 비용 | ~$4.5 | ~$8.5 |
| 관리 포인트 | 1개 | 2개 |
| 에이전트 간 교차 통신 | 가능 (필요시) | 불가 |
| API 키 격리 | 에이전트별 auth-profile로 분리 | 물리적 분리 |
| 장애 영향 | 전체 | 팀별 독립 |

### 4.3 Fly.io 설정

#### fly.toml

> 실제 파일은 `deploy/fly.toml`에 위치한다.

```toml
app = "openclaw-gateway"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[mounts]
  source = "openclaw_data"
  destination = "/data"

[env]
  NODE_ENV = "production"
  OPENCLAW_DATA_DIR = "/data"

[http_service]
  internal_port = 18789
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

#### Claude Code CLI 백엔드

API 키 대신 Claude Code CLI를 백엔드로 사용한다. Dockerfile에 Claude Code CLI를 설치하고, Max 구독 인증으로 실행한다.

```
모델 지정 형식: "claude-cli/opus-4.6", "claude-cli/sonnet-4.6"
인증: Claude Code CLI 로그인 (Max 구독)
도구: Claude Code 자체 도구 (Read/Edit/Bash/Git) 사용 가능
제한: OpenClaw 전용 도구(브라우저 제어 등)는 비활성
```

#### Secrets 설정

```bash
fly secrets set -a openclaw-gateway \
  GATEWAY_AUTH_TOKEN="$(openssl rand -hex 32)" \
  GEMINI_API_KEY="<GEMINI_API_KEY>" \
  TELEGRAM_BOT_TOKEN="<TELEGRAM_BOT_TOKEN>" \
  GITHUB_TOKEN="<GITHUB_PAT>" \
  CLAUDE_CODE_AUTH_TOKEN="<Claude Code 인증 토큰>"
```

---

## 5. 에이전트 구성

### 5.1 설계 원칙: PM 상주 + 서브에이전트 동적 스폰

기존 "역할별 상주 에이전트 6개/팀" 방식 대신, **PM만 상주하고 나머지는 서브에이전트로 동적 스폰**하는 방식을 채택한다.

| 비교 항목 | 고정 에이전트 (6개/팀) | PM 서브에이전트 (채택) |
|---|---|---|
| 상주 에이전트 수 | 12개 (양팀 합계) | **2개** |
| Claude 한도 소비 | 높음 (상시 컨텍스트 누적) | **~35-40% 절감** |
| Gateway 메모리 | ~300-600MB (부담) | **~60-100MB (여유)** |
| 관리 복잡도 | 12개 SOUL.md 관리 | 2개 + 서브에이전트 AGENTS.md |
| 작업 품질 | 컨텍스트 축적으로 양호 | SOUL.md + task 컨텍스트 주입으로 보완 |

### 5.2 상주 에이전트

#### viewster-pm

| 항목 | 설정 |
|---|---|
| 모델 | Claude Opus (Max 20x) |
| 역할 | 분석, 작업 분해, 서브에이전트 오케스트레이션, Cron 감시 |
| 참조 문서 | PRD.md, FLOW.md, CLAUDE.md, AGENTS.md, QA.md |
| GitHub | Viewstream2025 전체 레포 모니터링 |
| 서브에이전트 기본 모델 | Claude Sonnet (개발), Gemini (디자인/QA) |

#### gary-pm

| 항목 | 설정 |
|---|---|
| 모델 | Claude Sonnet (Max 5x, 예산 절약) |
| 역할 | 분석, 작업 분해, 서브에이전트 오케스트레이션, Cron 감시 |
| 참조 문서 | 각 프로젝트별 AGENTS.md |
| GitHub | garyjeong 전체 레포 모니터링 |
| 서브에이전트 기본 모델 | Claude Sonnet (개발), Gemini (디자인/QA) |

### 5.3 동적 서브에이전트 (PM이 작업별 스폰)

| 역할 | 모델 | 스폰 조건 | 완료 후 |
|---|---|---|---|
| **BE 개발** | Claude Sonnet | BE 작업 발생 시 | 결과 announce → 아카이브 |
| **FE 개발** | Claude Sonnet | FE 작업 발생 시 | 결과 announce → 아카이브 |
| **디자이너** | Gemini | UI/UX 작업 발생 시 | 결과 announce → 아카이브 |
| **QA 리뷰** | Gemini | develop 커밋 감지 시 | 결과 announce → 아카이브 |
| **QA 테스트** | Gemini | develop 커밋 감지 시 | 결과 announce → 아카이브 |

### 5.4 config.json5

```json5
{
  agents: {
    default: "viewster-pm",

    defaults: {
      subagents: {
        thinking: "medium",
        maxSpawnDepth: 2,
        maxChildrenPerAgent: 5,
        maxConcurrent: 8
      }
    },

    list: [
      // ─── Team Viewster ───
      {
        id: "viewster-pm",
        name: "Viewster PM",
        workspace: "/data/agents/viewster-pm/workspace",
        model: "claude-cli/opus-4.6",       // Max 20x 구독
        subagents: {
          model: "claude-cli/sonnet-4.6"    // Max 20x 구독
        }
      },

      // ─── Team Gary ───
      {
        id: "gary-pm",
        name: "Gary PM",
        workspace: "/data/agents/gary-pm/workspace",
        model: "claude-cli/sonnet-4.6",      // Max 5x 구독
        subagents: {
          model: "claude-cli/sonnet-4.6"     // Max 5x 구독
        }
      }
    ]
  },

  channels: {
    telegram: {
      accounts: {
        viewster: {},   // @viewster_office_bot
        gary: {}        // @gary_office_bot
      }
    }
  },

  bindings: [
    {
      agentId: "viewster-pm",
      match: { channel: "telegram", accountId: "viewster" }
    },
    {
      agentId: "gary-pm",
      match: { channel: "telegram", accountId: "gary" }
    }
  ],

  tools: {
    agentToAgent: {
      enabled: true,
      allow: ["viewster-pm", "gary-pm"]
    },
    shell: { sandboxed: true }
  }
}
```

### 5.5 텔레그램 채널 구조

텔레그램 봇 2개를 BotFather에서 생성한다:

| 봇 | 텔레그램 채널 | 바인딩 에이전트 |
|---|---|---|
| @viewster_office_bot | viewster-office | viewster-pm |
| @gary_office_bot | gary-office | gary-pm |

---

## 6. 워크플로우

### 6.1 Team Viewster 작업 흐름

```
[Gary] ── viewster-office 텔레그램 ──► [viewster-pm] (상주, Opus)
                                             │
                                        ① 분석
                                        ├ GitHub Issues/PRs 히스토리 조회
                                        ├ PRD.md, FLOW.md 참조
                                        ├ 영향받는 컴포넌트/서비스 파악
                                        └ 작업 분해 (FE/BE/디자인 구분)
                                             │
                                        ② 서브에이전트 스폰
                              ┌──────────────┼──────────────┐
                              ▼              ▼              ▼
                         서브에이전트     서브에이전트     서브에이전트
                         BE (Sonnet)    FE (Sonnet)    디자인 (Gemini)
                              │              │              │
                              └──────┬───────┘──────────────┘
                                     ▼
                                ③ PM이 결과 취합
                                develop 브랜치에 커밋
                                     │
                                ④ Cron 감지 (viewster-pm)
                                     │
                              ┌──────┴──────┐
                              ▼             ▼
                         서브에이전트     서브에이전트
                         리뷰 (Gemini)  테스트 (Gemini)
                              │             │
                              └──────┬──────┘
                                     ▼
                                ⑤ QA 통과 시 PR 생성
                                (develop → staging)
                                     │
                                     ▼
                         텔레그램 알림 → [Gary] 최종 승인
```

### 6.2 Team Gary 작업 흐름

```
[Gary] ── gary-office 텔레그램 ──► [gary-pm] (상주, Sonnet)
                                        │
                                   ① 분석
                                   ├ GitHub 히스토리, 코드 구조 파악
                                   ├ 프로젝트별 AGENTS.md 참조
                                   └ 작업 분해 + 모델 결정
                                        │
                                   ② 서브에이전트 스폰
                             ┌──────────┼──────────┐
                             ▼          ▼          ▼
                        서브에이전트  서브에이전트  서브에이전트
                        BE (Sonnet) FE (Sonnet) 디자인 (Gemini)
                             │          │          │
                             └─────┬────┘──────────┘
                                   ▼
                              ③ PM이 결과 취합
                              develop 브랜치에 커밋
                                   │
                              ④ Cron 감지 (gary-pm)
                                   │
                              ┌────┴────┐
                              ▼         ▼
                         서브에이전트  서브에이전트
                         리뷰(Gemini) 테스트(Gemini)
                              │         │
                              └────┬────┘
                                   ▼
                              ⑤ PR 생성 → 텔레그램 알림 → [Gary] 승인
```

### 6.3 한 문장 요약

> Gary가 텔레그램으로 지시 → PM이 히스토리 분석 후 작업 분해 → 작업 특성에 맞는 모델로 서브에이전트 스폰(FE/BE/디자인 병렬) → develop 커밋 → PM Cron이 감지하여 QA 서브에이전트 스폰(리뷰+테스트) → 통과 시 PR 생성 → Gary 텔레그램 알림 → 최종 승인

---

## 7. 모델 배분 및 비용

### 7.1 Claude Max 요금제 한도

| 요금제 | 월 비용 | 메시지 한도 | 리셋 주기 |
|---|---|---|---|
| Max 5x (Gary) | $100/월 | ~225 메시지 / 5시간 | 롤링 윈도우 |
| Max 20x (Viewster) | $200/월 | ~900 메시지 / 5시간 | 롤링 윈도우 |

메시지 토큰 가중치 참고:
- 짧은 대화: ~500 토큰 = 1 메시지
- 중간 대화 (10턴): ~5,000 토큰 = 2-3 메시지
- 긴 대화 (30턴): ~20,000 토큰 = 5-8 메시지
- 파일 포함 긴 대화: ~50,000+ 토큰 = 10-15 메시지

### 7.2 모델별 에이전트 배정

#### Team Viewster (Max 20x)

| 에이전트/서브에이전트 | 모델 | 이유 |
|---|---|---|
| viewster-pm (상주) | **Claude Opus** | PRD 38KB + 복잡한 도메인 분석 |
| BE 개발 (서브에이전트) | Claude Sonnet | 코드 생성 밸런스 |
| FE 개발 (서브에이전트) | Claude Sonnet | 컴포넌트 구현 |
| 디자인 (서브에이전트) | **Gemini** | 멀티모달 강점 |
| QA 리뷰 (서브에이전트) | **Gemini** | 패턴 매칭 기반 리뷰 |
| QA 테스트 (서브에이전트) | **Gemini** | 반복적 테스트 생성/실행 |

#### Team Gary (Max 5x)

| 에이전트/서브에이전트 | 모델 | 이유 |
|---|---|---|
| gary-pm (상주) | **Claude Sonnet** | 5x 예산 내 최적 |
| BE 개발 (서브에이전트) | Claude Sonnet | NestJS/FastAPI 구현 |
| FE 개발 (서브에이전트) | Claude Sonnet | React/Next.js 구현 |
| 디자인 (서브에이전트) | **Gemini** | 멀티모달 강점 |
| QA 리뷰 (서브에이전트) | **Gemini** | 비용 효율 |
| QA 테스트 (서브에이전트) | **Gemini** | 비용 효율 |

### 7.3 한도 소비 시뮬레이션

**시나리오: 중간 규모 기능 추가 (예: 알림 기능)**

| 단계 | Viewster (Opus/Sonnet) | Gary (Sonnet) |
|---|---|---|
| PM 분석 | ~3-5 메시지 | ~3-5 메시지 |
| BE 서브에이전트 | ~5-8 메시지 | ~5-8 메시지 |
| FE 서브에이전트 | ~5-8 메시지 | ~5-8 메시지 |
| QA (Gemini) | 0 (한도 무관) | 0 (한도 무관) |
| **합계** | **~13-21 메시지** | **~13-21 메시지** |
| **5시간 한도 대비** | 900 중 ~2% | 225 중 ~9% |

서브에이전트 방식은 매번 fresh 세션이므로 컨텍스트 누적이 없어 토큰 효율이 높다.

### 7.4 월간 비용 요약

| 항목 | 비용 | 비고 |
|---|---|---|
| Claude Max 20x (Viewster) | $200/월 | 기존 구독, CLI 백엔드로 사용 (API 종량제 없음) |
| Claude Max 5x (Gary) | $100/월 | 기존 구독, CLI 백엔드로 사용 (API 종량제 없음) |
| Gemini 유료 | 기존 구독 | API 키 방식 (디자인/QA 서브에이전트) |
| **Fly.io Gateway** | **~$4.5/월** | 유일한 추가 비용 |
| **추가 비용 합계** | **~$4.5/월** | |

---

## 8. 멀티 모델 통합

### 8.1 Claude Code CLI 백엔드

OpenClaw에 내장된 CLI 백엔드를 사용하여 Claude Code를 실행한다.

```
모델 지정: "claude-cli/opus-4.6", "claude-cli/sonnet-4.6"
인증: Claude Code CLI의 Max 구독 인증 사용 (API 키 불필요)
실행: claude -p "작업내용" --output-format json --session-id xxx
도구: Claude Code 자체 도구 (Read/Edit/Bash/Git) 동작
제한: OpenClaw 전용 도구 비활성, 스트리밍 없음
```

### 8.2 OpenClaw에서의 Gemini 지원

OpenClaw은 Gemini를 **네이티브로 지원**한다. 서브에이전트 스폰 시 `model` 파라미터에 직접 지정 가능.

```
sessions_spawn(task: "UI 목업 작성", model: "google/gemini-2.5-pro")
```

인증: `GEMINI_API_KEY` 환경변수. 키 로테이션 지원 (`GEMINI_API_KEYS`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`).

### 8.3 Claude Code에서의 Gemini 지원

Claude Code는 서브에이전트 모델로 **Claude만 네이티브 지원**한다:

```yaml
# Claude Code 서브에이전트 지원 모델
model: sonnet   # Claude Sonnet
model: opus     # Claude Opus
model: haiku    # Claude Haiku
model: inherit  # 부모 세션 모델 상속
```

Gemini 사용을 위한 우회 방법:

| 방법 | 설명 | 난이도 |
|---|---|---|
| **Sidecar** | npm 패키지, Claude Code에 스킬로 자동 등록 | 쉬움 |
| **Gemini CLI Bash 호출** | 커스텀 서브에이전트가 Bash로 Gemini CLI 실행 | 보통 |
| **MCP 서버** | Gemini를 MCP 도구로 감싸서 호출 | 보통 |

### 8.4 플랫폼 비교 (멀티 모델 관점)

| | OpenClaw (채택) | Claude Code |
|---|---|---|
| Gemini 네이티브 서브에이전트 | 가능 | 불가 |
| 서브에이전트 모델 범위 | Claude, Gemini, GPT, 로컬 모델 | Claude 전용 |
| 멀티 모델 설정 | config.json5 한 줄 | 추가 도구 설치 필요 |

> **결론: OpenClaw을 메인 플랫폼으로 사용하므로 Gemini 서브에이전트 호출에 문제없음.**

---

## 9. 보안 설계

### 9.1 에이전트 권한 격리

```
openclaw-gateway
├── viewster-pm
│   ├ GitHub Token: Viewstream2025 PAT만 접근
│   ├ Claude Key: Max 20x 전용
│   ├ 코드 접근: viewster-* 레포만
│   └ 셸: sandboxed
│
└── gary-pm
    ├ GitHub Token: garyjeong PAT만 접근
    ├ Claude Key: Max 5x 전용
    ├ 코드 접근: gary 프로젝트만
    └ 셸: sandboxed
```

### 9.2 보안 체크리스트

- [ ] Gateway에 HTTPS 강제 적용 (fly.toml force_https: true)
- [ ] 공개 IP 비활성화 또는 Fly.io private 네트워크 사용
- [ ] GATEWAY_AUTH_TOKEN 설정 (무단 접근 방지)
- [ ] GitHub Token은 Fine-grained PAT 사용 (최소 권한)
- [ ] 에이전트별 셸 샌드박스 활성화
- [ ] 서브에이전트 도구 제한 (deny: ["gateway", "cron"])
- [ ] 주기적 보안 점검 (인스턴스 노출 여부)

---

## 10. 리스크 및 대응

| 리스크 | 심각도 | 대응 방안 |
|---|---|---|
| **에이전트 코드 충돌** | 높음 | 에이전트별 `feature/agent-{name}-{task}` 브랜치 강제 |
| **Max 한도 소진** | 중간 | Opus는 PM만, 나머지 Sonnet/Gemini로 분산 |
| **프롬프트 인젝션** | 중간 | 에이전트별 샌드박스, GitHub Token scope 제한 |
| **Viewstream private repo 접근** | 낮음 | Fine-grained PAT 발급 (repo 읽기/쓰기) |
| **에이전트 품질 편차** | 중간 | QA 교차 검증 + Gary 최종 PR 승인 필수 |
| **OpenClaw 프로젝트 불확실성** | 중간 | MIT 라이선스 포크 가능, 재단 이관 후 동향 관찰 |
| **Gateway 단일 장애점** | 중간 | Fly.io auto_start_machines: true, 모니터링 설정 |
| **서브에이전트 SOUL.md 부족** | 낮음 | 기존 3,500줄+ 문서 자산 활용, PM이 task에 컨텍스트 주입 |

---

## 11. 구축 로드맵

| 단계 | 내용 | 예상 기간 |
|---|---|---|
| **Phase 1** | 텔레그램 봇 2개 생성 (BotFather) | 0.5일 |
| **Phase 2** | Fly.io에 OpenClaw Gateway 배포 + 텔레그램 연동 테스트 | 1일 |
| **Phase 3** | viewster-pm 세팅 + GitHub 모니터링 + 단일 작업 E2E 테스트 | 1-2일 |
| **Phase 4** | gary-pm 세팅 + 단일 작업 E2E 테스트 | 1일 |
| **Phase 5** | 서브에이전트 스폰 워크플로우 검증 (BE/FE/디자인/QA) | 2-3일 |
| **Phase 6** | SOUL.md/AGENTS.md 튜닝 + 품질 검증 | 지속적 |
| **Phase 7** | Antfarm/Mission Control 도입 검토 (선택) | 필요시 |

---

## 참고 자료

- [OpenClaw 공식 사이트](https://openclaw.ai/)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [OpenClaw 공식 문서 - Multi-Agent Routing](https://docs.openclaw.ai/concepts/multi-agent)
- [OpenClaw 공식 문서 - Sub-Agents](https://docs.openclaw.ai/tools/subagents)
- [OpenClaw 공식 문서 - Model Providers](https://docs.openclaw.ai/concepts/model-providers)
- [OpenClaw Fly.io 배포 가이드](https://docs.openclaw.ai/install/fly)
- [Antfarm - Multi-Agent Team Builder](https://github.com/snarktank/antfarm)
- [Mission Control - Agent Orchestration Dashboard](https://github.com/abhi1693/openclaw-mission-control)
- [CrowdStrike 보안 분석](https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/)
- [Claude Max Plan 한도 분석](https://intuitionlabs.ai/articles/claude-max-plan-pricing-usage-limits)
- [Claude Code 서브에이전트 공식 문서](https://code.claude.com/docs/en/sub-agents)
- [Sidecar - Multi-model subagent tool](https://github.com/jrenaldi79/sidecar)
- [Fly.io 가격 정책](https://fly.io/docs/about/pricing/)
