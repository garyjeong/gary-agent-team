# Viewster 배포 & 인프라 운영

Terraform IaC, AWS 리소스 관리, GitHub Actions CI/CD, 모니터링을 다루는 skill.
사용 시기: (1) Terraform 인프라 변경, (2) AWS 리소스 확인/수정, (3) 배포 프로세스, (4) CloudWatch 모니터링, (5) Blue/Green 배포 이슈, (6) SSL/도메인 설정, (7) 환경변수(SSM) 관리

---

## 프로젝트 경로
`/Users/gary/Documents/workspace/viewster/viewster-terraform`

## 인프라 스택
- **Provider**: AWS (ap-northeast-2, 서울)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **배포 방식**: Blue/Green (EC2 롤링)
- **모니터링**: CloudWatch + Telegram 알림

---

## 환경별 구성

| 환경 | B2C | Admin | API | 인프라 |
|------|-----|-------|-----|--------|
| **Local** | localhost:3000 | localhost:3001 | localhost:8080 | Docker Compose |
| **Staging** | staging.viewster.io | staging-admin.viewster.io | staging-api.viewster.io | EC2 x3 |
| **Production** | viewster.io | admin.viewster.io | api.viewster.io | EC2 x3 |

---

## Terraform 디렉토리 구조

```
viewster-terraform/
├── common-key-pair.tf       # 공유 SSH 키
├── ip-whitelist.yaml        # 보안 그룹 IP 화이트리스트
├── staging/                 # 스테이징 환경 (16 TF 파일)
│   ├── main.tf              # Provider, backend 설정
│   ├── variables.tf         # 입력 변수
│   ├── outputs.tf           # 출력 값 (20+)
│   ├── vpc.tf               # VPC, 서브넷, 게이트웨이
│   ├── security-groups.tf   # 5+ 보안 그룹
│   ├── ec2.tf               # Backend (Blue/Green), Redis, RabbitMQ
│   ├── rds.tf               # PostgreSQL 15 RDS
│   ├── s3.tf                # S3 버킷 (앱, 로그, 정적)
│   ├── ecr.tf               # Docker 이미지 레지스트리
│   ├── route53.tf           # DNS 레코드
│   ├── ssm.tf               # Parameter Store (환경변수)
│   ├── cloudwatch.tf        # 로그, 알람, 대시보드
│   ├── sns.tf               # 알림 토픽
│   ├── lambda.tf            # telegram_notifier
│   ├── dkim.tf              # DKIM 이메일 서명
│   └── key-pair.tf          # EC2 SSH 키
├── production/              # 프로덕션 환경 (동일 구조, 더 큰 리소스)
└── development/             # 개발 환경 (최소 구성)
```

---

## AWS 리소스 맵

### EC2 인스턴스 (환경당 3대)
| 역할 | 서비스 | 포트 |
|------|--------|------|
| Backend (Blue/Green) | FastAPI + Uvicorn, Next.js (B2C + Admin) | 8080, 3000, 3001 |
| Redis | Redis 7.0 | 6379 |
| RabbitMQ | RabbitMQ + Celery Worker/Beat | 5672, 15672 |

### RDS
- **엔진**: PostgreSQL 15
- **인스턴스**: db.t3.micro (Staging), 더 큰 인스턴스 (Production)
- **연결 제한**: 100 (pool_size=35 + max_overflow=65)

### S3 버킷
- 앱 저장소 (이미지, 파일)
- 정적 자산
- 로그

### ECR
- `viewster-backend` 이미지
- `viewster-frontend` 이미지
- `viewster-admin-frontend` 이미지

### Route53
- `viewster.io` → EC2 (Production)
- `staging.viewster.io` → EC2 (Staging)
- 서브도메인: api, admin, staging-api, staging-admin

### CloudWatch
- 로그 그룹: `/viewster/backend`, `/viewster/frontend`
- 알람: CPU, 메모리, 디스크, RDS 연결
- 대시보드: 서비스 전체 현황

### Lambda
- `telegram_notifier`: CloudWatch 알람 → Telegram 메시지

### SSM Parameter Store
- 모든 환경변수 관리 (DB URL, JWT Secret, API 키 등)
- 경로: `/viewster/{env}/{service}/{key}`

---

## 배포 프로세스

### GitHub Actions CI/CD
```
git push → GitHub Actions 자동 배포
  ├── develop → staging 자동 배포
  ├── staging → staging 환경 배포
  └── main → production 환경 배포
```

### Blue/Green 배포 단계
```
1. Docker 이미지 빌드 (ECR)
2. Blue 인스턴스 → 새 이미지 배포
3. 헬스체크 통과 확인
4. ALB 트래픽 전환 (Blue → Green)
5. 이전 Green 인스턴스 정리
```

### 배포 시 주의사항
- **수동 배포 금지** → Git push 통해서만 배포
- **컨테이너 포트 충돌 방지** (Blue/Green 전환 시)
- **WebSocket 이벤트 변경 시 프론트/백 동시 배포 필요**
- **환경변수 변경**: SSM → EC2 재시작 필요

---

## 보안 그룹 구성

```
ALB SG:      80, 443 (공개)
Backend SG:  8080 (ALB에서만), 3000, 3001
Redis SG:    6379 (Backend SG에서만)
RabbitMQ SG: 5672, 15672 (Backend SG에서만)
RDS SG:      5432 (Backend SG에서만)
```

---

## 모니터링 & 알림

### CloudWatch 알람
| 알람 | 임계값 | 대상 |
|------|--------|------|
| CPU 사용률 | > 80% (5분) | EC2 |
| 디스크 사용률 | > 85% | EC2 |
| RDS 연결 수 | > 80 | RDS |
| 5xx 에러율 | > 1% | ALB |
| 응답 시간 | > 3초 (p95) | ALB |

### Telegram 알림
```
CloudWatch 알람 → SNS → Lambda (telegram_notifier) → Telegram Bot
```
- 프로덕션 500 에러 즉시 알림
- 배포 성공/실패 알림

---

## 최근 변경사항 (2026-02)
- EC2 IAM 외부 서비스 모니터링 권한 추가
- EC2 Auto Recovery 설정
- User Data 개선 (안정성)

---

## 자주 쓰는 명령어

```bash
# Terraform
terraform plan              # 변경 사항 미리보기
terraform apply             # 변경 적용
terraform state list        # 리소스 목록

# AWS CLI (aws-mcp 또는 직접)
aws ec2 describe-instances --region ap-northeast-2
aws rds describe-db-instances --region ap-northeast-2
aws s3 ls s3://viewster-*
aws ssm get-parameters-by-path --path /viewster/staging/
aws logs tail /viewster/backend --since 1h
```

---

## 재해 복구

1. **서비스 다운**: EC2 Auto Recovery 자동 재시작
2. **DB 장애**: RDS 자동 백업 (7일), 스냅샷 복원
3. **배포 실패**: 이전 ECS 태스크로 롤백
4. **트래픽 폭주**: EC2 스케일 아웃 (수동)

---

## 디버깅 체크리스트

1. **배포 실패**: GitHub Actions 로그 확인, ECR 이미지 확인
2. **헬스체크 실패**: `/health` 엔드포인트 확인, 포트 충돌 확인
3. **CORS 에러**: Security Group + ALB 리스너 규칙 확인
4. **SSL 인증서**: Route53 + ACM 인증서 확인
5. **환경변수 누락**: SSM Parameter Store 확인

---

## 관련 스킬
- `aws-resource-checker`: AWS 리소스 상태 확인 (기존 스킬)
- `database-ops`: RDS 운영 (기존 스킬)
- `backend-api`: 백엔드 서비스 구조
