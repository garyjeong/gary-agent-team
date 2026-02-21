---
name: aws-resource-checker
description: |
  AWS 리소스 상태 확인 및 최적화 제안 skill. Viewster 프로젝트의 EC2, RDS, S3, ECR, CloudWatch 리소스를 점검하고 문제를 진단한다.
  사용 시기: (1) 인프라 문제 진단, (2) AWS 리소스 상태 확인, (3) 성능 최적화 분석, (4) 비용 최적화 검토, (5) 배포 상태 확인, (6) CloudWatch 알람/메트릭 조회
---

# AWS Resource Checker Skill

AWS 리소스 상태를 확인하고 최적화 방안을 제시한다. Viewster 프로젝트의 인프라 전반을 점검한다.

---

## Viewster AWS 인프라 개요

### 기본 설정
- **AWS Region**: `ap-northeast-2` (서울)
- **AWS Profile**: `jongmun` (모든 CLI 명령에 `--profile jongmun` 필수)
- **프로젝트명**: `viewster`
- **환경**: staging, production

### 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  Route53 (viewster.io)                                   │
│  ├── staging.viewster.io      → Frontend EC2 EIP         │
│  ├── staging-admin.viewster.io → Frontend EC2 EIP        │
│  ├── staging-api.viewster.io  → Backend EC2 EIP          │
│  ├── viewster.io              → Production Frontend EIP   │
│  ├── admin.viewster.io        → Production Frontend EIP   │
│  └── api.viewster.io          → Production Backend EIP    │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  EC2 Instances (Docker-based, blue/green deployment)     │
│                                                          │
│  [Frontend EC2] t2.small                                 │
│    ├── Nginx (SSL termination, reverse proxy)            │
│    ├── frontend-blue (port 3000)                         │
│    └── admin-frontend-blue (port 3001)                   │
│                                                          │
│  [Backend EC2] t2.small                                  │
│    ├── Nginx (SSL termination, reverse proxy, WebSocket) │
│    └── backend-blue (port 8080) - FastAPI + Uvicorn      │
│                                                          │
│  [Thirdparty EC2] t2.small                               │
│    ├── Redis 7 Alpine (port 6379) - 세션, 타이머          │
│    └── RabbitMQ 3 (port 5672, 15672) - 메시지 큐         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  RDS PostgreSQL 15 (db.t3.micro, 20GB gp3)               │
│  ├── Staging:  viewster-staging-database                  │
│  └── Production: viewster-production-database             │
└─────────────────────────────────────────────────────────┘
```

### 네트워크

| 환경 | VPC CIDR | Public Subnet | AZ |
|------|----------|---------------|----|
| Staging | 10.2.0.0/16 | 10.2.1.0/24 | ap-northeast-2b |
| Production | 10.1.0.0/16 | 10.1.1.0/24 | ap-northeast-2a |

### EC2 인스턴스 (환경별 3대)

| 역할 | 인스턴스 타입 | 스토리지 | Docker 컨테이너 |
|------|-------------|---------|----------------|
| Frontend | t2.small | 20GB gp3 | frontend-blue, admin-frontend-blue, nginx |
| Backend | t2.small | 20GB gp3 | backend-blue, nginx |
| Thirdparty | t2.small | 20GB gp3 | redis, rabbitmq |

### ECR 리포지토리

| 리포지토리 | 이미지 태그 | 스캔 |
|-----------|-----------|------|
| viewster-{env}-frontend | latest, SHA | push 시 자동 스캔 |
| viewster-{env}-admin-frontend | latest, SHA | push 시 자동 스캔 |
| viewster-{env}-backend | latest, SHA | push 시 자동 스캔 |

### S3 버킷
- `viewster-assets-staging` / `viewster-assets-production`
- 버전 관리 활성화, AES256 서버 측 암호화
- 수명 주기: 30일 -> STANDARD_IA, 90일 -> GLACIER, 365일 이전 버전 삭제

### 배포 방식
- **GitHub Actions** 자동 배포 (수동 배포 금지)
- **Blue/Green**: Docker 컨테이너 이름에 `-blue` 접미사
- staging 브랜치 push -> staging 자동 배포
- main 브랜치 push -> production 자동 배포

---

## MCP 도구

### 리소스 목록 조회
```typescript
// EC2 인스턴스 목록
mcp__aws-mcp__aws_list_resources({ service: "ec2", resource_type: "instance" })

// RDS 인스턴스 목록
mcp__aws-mcp__aws_list_resources({ service: "rds" })

// S3 버킷 목록
mcp__aws-mcp__aws_list_resources({ service: "s3" })
```

### AWS CLI 실행 (항상 --profile jongmun 포함)
```typescript
// EC2 인스턴스 상태 확인
mcp__aws-mcp__aws_cli_execute({
  service: "ec2",
  operation: "describe-instances",
  additional_args: ["--profile", "jongmun", "--region", "ap-northeast-2"]
})

// 특정 환경의 인스턴스만 조회
mcp__aws-mcp__aws_cli_execute({
  service: "ec2",
  operation: "describe-instances",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--filters", "Name=tag:Environment,Values=staging"
  ]
})
```

### 계정 정보 조회
```typescript
mcp__aws-mcp__aws_get_account_info()
```

---

## 점검 절차

### 1. 계정 확인
```typescript
mcp__aws-mcp__aws_get_account_info()
```
- 프로필 `jongmun`, 리전 `ap-northeast-2` 확인

### 2. EC2 인스턴스 점검

```typescript
// 전체 인스턴스 상태
mcp__aws-mcp__aws_cli_execute({
  service: "ec2",
  operation: "describe-instances",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--query", "Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,Name:Tags[?Key=='Name']|[0].Value,Env:Tags[?Key=='Environment']|[0].Value}",
    "--output", "table"
  ]
})

// 인스턴스 상태 체크 (시스템/인스턴스)
mcp__aws-mcp__aws_cli_execute({
  service: "ec2",
  operation: "describe-instance-status",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--output", "table"
  ]
})
```

**확인 항목**:
- 인스턴스 상태: running 여부
- StatusCheckFailed_System / StatusCheckFailed_Instance
- CPU 크레딧 (t2.small은 버스트 가능 인스턴스)

### 3. Docker 컨테이너 상태 확인 (SSH 경유)

Backend EC2에 SSH 접속하여 Docker 컨테이너 상태를 확인한다.

```bash
# Staging
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Production
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"
```

**예상 컨테이너**:
- `backend-blue`: 0.0.0.0:8080->8080/tcp (FastAPI)
- Nginx: 호스트 서비스로 실행 (포트 80, 443)

### 4. RDS 점검

```typescript
// RDS 인스턴스 상태
mcp__aws-mcp__aws_cli_execute({
  service: "rds",
  operation: "describe-db-instances",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--query", "DBInstances[].{Id:DBInstanceIdentifier,Status:DBInstanceStatus,Class:DBInstanceClass,Engine:Engine,Version:EngineVersion,Storage:AllocatedStorage,MaxStorage:MaxAllocatedStorage}",
    "--output", "table"
  ]
})
```

**확인 항목**:
- DB 상태: available
- 엔진: postgres 15.14
- 스토리지: 20GB (최대 40GB 자동 확장)
- 연결 수 정상 범위 여부
- CPU 사용률 70% 이하

### 5. S3 점검

```typescript
// 버킷 목록 및 크기
mcp__aws-mcp__aws_cli_execute({
  service: "s3",
  operation: "ls",
  additional_args: ["--profile", "jongmun", "--region", "ap-northeast-2"]
})

// 특정 버킷 크기 확인
mcp__aws-mcp__aws_cli_execute({
  service: "s3",
  operation: "ls",
  additional_args: [
    "s3://viewster-assets-staging",
    "--summarize", "--human-readable", "--recursive",
    "--profile", "jongmun", "--region", "ap-northeast-2"
  ]
})
```

**확인 항목**:
- 버킷 암호화 활성화 (AES256)
- 버전 관리 활성화
- 수명 주기 정책 적용 여부
- 퍼블릭 액세스 설정

### 6. ECR 점검

```typescript
// ECR 리포지토리 목록
mcp__aws-mcp__aws_cli_execute({
  service: "ecr",
  operation: "describe-repositories",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--query", "repositories[].{Name:repositoryName,URI:repositoryUri,ScanOnPush:imageScanningConfiguration.scanOnPush}",
    "--output", "table"
  ]
})

// 특정 리포지토리 이미지 목록 (최근 5개)
mcp__aws-mcp__aws_cli_execute({
  service: "ecr",
  operation: "describe-images",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--repository-name", "viewster-staging-backend",
    "--query", "sort_by(imageDetails, &imagePushedAt)[-5:].{Tags:imageTags[0],Size:imageSizeInBytes,Pushed:imagePushedAt,Scan:imageScanStatus.status}",
    "--output", "table"
  ]
})
```

**확인 항목**:
- push 시 자동 스캔 활성화
- 최근 이미지 취약점 스캔 결과
- 오래된 이미지 정리 필요 여부

---

## CloudWatch 모니터링

### 대시보드
- `viewster-staging-cost-monitoring`: EC2, RDS, S3 메트릭 통합 대시보드
- `viewster-production-cost-monitoring`: 프로덕션 동일 구성

### 알람 목록

| 알람 | 네임스페이스 | 메트릭 | 임계값 | 평가 기간 |
|------|------------|--------|--------|----------|
| frontend-ec2-cpu-high | AWS/EC2 | CPUUtilization | > 70% | 2 x 5분 |
| backend-ec2-cpu-high | AWS/EC2 | CPUUtilization | > 70% | 2 x 5분 |
| thirdparty-ec2-cpu-high | AWS/EC2 | CPUUtilization | > 70% | 2 x 5분 |
| rds-cpu-high | AWS/RDS | CPUUtilization | > 70% | 2 x 5분 |
| rds-storage-low | AWS/RDS | FreeStorageSpace | < 5GB | 1 x 5분 |
| frontend-auto-recovery | AWS/EC2 | StatusCheckFailed_System | > 0 | 2 x 1분 |
| backend-auto-recovery | AWS/EC2 | StatusCheckFailed_System | > 0 | 2 x 1분 |
| thirdparty-auto-recovery | AWS/EC2 | StatusCheckFailed_System | > 0 | 2 x 1분 |

### 알람 알림 경로
- SNS Topic -> Lambda -> Telegram Bot (실시간 알림)

### CloudWatch 메트릭 조회

```typescript
// EC2 CPU 사용률 (최근 1시간)
mcp__aws-mcp__aws_cli_execute({
  service: "cloudwatch",
  operation: "get-metric-statistics",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--namespace", "AWS/EC2",
    "--metric-name", "CPUUtilization",
    "--dimensions", "Name=InstanceId,Value=<INSTANCE_ID>",
    "--start-time", "<ISO8601_1H_AGO>",
    "--end-time", "<ISO8601_NOW>",
    "--period", "300",
    "--statistics", "Average",
    "--output", "table"
  ]
})

// RDS 연결 수 (최근 1시간)
mcp__aws-mcp__aws_cli_execute({
  service: "cloudwatch",
  operation: "get-metric-statistics",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--namespace", "AWS/RDS",
    "--metric-name", "DatabaseConnections",
    "--dimensions", "Name=DBInstanceIdentifier,Value=viewster-staging-database",
    "--start-time", "<ISO8601_1H_AGO>",
    "--end-time", "<ISO8601_NOW>",
    "--period", "300",
    "--statistics", "Average",
    "--output", "table"
  ]
})

// RDS 여유 스토리지
mcp__aws-mcp__aws_cli_execute({
  service: "cloudwatch",
  operation: "get-metric-statistics",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--namespace", "AWS/RDS",
    "--metric-name", "FreeStorageSpace",
    "--dimensions", "Name=DBInstanceIdentifier,Value=viewster-staging-database",
    "--start-time", "<ISO8601_1H_AGO>",
    "--end-time", "<ISO8601_NOW>",
    "--period", "300",
    "--statistics", "Average",
    "--output", "table"
  ]
})

// 현재 알람 상태 조회
mcp__aws-mcp__aws_cli_execute({
  service: "cloudwatch",
  operation: "describe-alarms",
  additional_args: [
    "--profile", "jongmun",
    "--region", "ap-northeast-2",
    "--alarm-name-prefix", "viewster-staging",
    "--query", "MetricAlarms[].{Name:AlarmName,State:StateValue,Reason:StateReason}",
    "--output", "table"
  ]
})
```

---

## Backend 서비스 확인 (Docker on EC2)

Viewster 백엔드는 EC2 위에서 Docker 컨테이너로 실행된다. ECS가 아닌 EC2 + Docker + Nginx 구성이다.

### 컨테이너 상태 확인

```bash
# Staging Backend 컨테이너 상태
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'"

# Production Backend 컨테이너 상태
/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'"
```

### 컨테이너 로그 확인

```bash
# Backend 최근 로그 (100줄)
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker logs --tail 100 backend-blue"

# Backend 에러 로그만
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker logs --tail 500 backend-blue 2>&1 | grep -i error"

# Nginx 로그
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "sudo tail -100 /var/log/nginx/error.log"
```

### 컨테이너 리소스 사용량

```bash
# Docker 리소스 사용량 (CPU, Memory)
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}'"
```

### Nginx 상태 확인

```bash
# Nginx 서비스 상태
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "sudo systemctl status nginx"

# Nginx 설정 검증
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "sudo nginx -t"
```

---

## 헬스 체크 패턴

### API 헬스 체크 (HTTP)

```bash
# Staging API 헬스 체크
curl -s -o /dev/null -w "%{http_code}" https://staging-api.viewster.io/health

# Production API 헬스 체크
curl -s -o /dev/null -w "%{http_code}" https://api.viewster.io/health
```

### Nginx Reverse Proxy 헬스 체크 체인

```
Client -> Nginx (443/80) -> backend-blue (8080)
```

Nginx는 `proxy_pass http://127.0.0.1:8080`으로 Backend 컨테이너에 프록시한다.
WebSocket은 `proxy_read_timeout 86400` (24시간) 설정으로 장시간 연결을 유지한다.

### Redis 연결 확인

```bash
# Staging Redis 접속 테스트
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec -it redis redis-cli ping"

# Redis 메모리 사용량
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker exec redis redis-cli info memory | grep used_memory_human"
```

참고: Redis는 Thirdparty EC2에서 실행되므로 해당 서버 SSH 스크립트 사용:
```bash
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-thirdparty.sh "docker exec redis redis-cli info memory"
```

---

## SSH 접속 스크립트

| 환경 | 대상 | 스크립트 경로 |
|------|------|-------------|
| Staging | Backend | `/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh` |
| Staging | Frontend | `/Users/gary/Documents/workspace/viewster/ssh/connect-staging-frontend.sh` |
| Staging | Thirdparty (Redis, RabbitMQ) | `/Users/gary/Documents/workspace/viewster/ssh/connect-staging-thirdparty.sh` |
| Staging | Admin | `/Users/gary/Documents/workspace/viewster/ssh/connect-staging-admin.sh` |
| Production | Backend | `/Users/gary/Documents/workspace/viewster/ssh/connect-production-backend.sh` |
| Production | Frontend | `/Users/gary/Documents/workspace/viewster/ssh/connect-production-frontend.sh` |
| Production | Thirdparty | `/Users/gary/Documents/workspace/viewster/ssh/connect-production-thirdparty.sh` |
| - | Redis flush | `/Users/gary/Documents/workspace/viewster/ssh/flush-redis.sh` |

### 사용법

```bash
# 대화형 세션
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh

# 원격 명령 실행
/Users/gary/Documents/workspace/viewster/ssh/connect-staging-backend.sh "docker ps"
```

### SSH 키
- 경로: `/Users/gary/Documents/workspace/viewster/ssh/viewster-key.pem`
- SSM에서 다운로드: `/viewster/common/keypair/private_key`

---

## 비용 최적화 팁

### EC2

| 항목 | 현재 | 권장 | 절감 효과 |
|------|------|------|----------|
| 인스턴스 타입 | t2.small (3대 x 2환경) | Staging은 t3.micro 또는 사용량에 따라 축소 검토 | t3.micro가 t2.small 대비 ~30% 저렴 |
| Reserved Instance | 온디맨드 | Production은 1년 RI 또는 Savings Plan 검토 | 최대 40% 절감 |
| Spot Instance | 미사용 | Staging 환경에 Spot 검토 (중단 허용 시) | 최대 60-70% 절감 |
| 스케줄링 | 24/7 | Staging은 업무시간만 운영 (Lambda 스케줄러) | ~60% 절감 |

### RDS

| 항목 | 현재 | 권장 |
|------|------|------|
| 인스턴스 | db.t3.micro | 현재 적절 (프리티어 해당) |
| 백업 | Staging: 보류(0일) | Staging도 최소 1일 설정 권장 |
| 스토리지 | 20GB gp3 | 사용량 모니터링 후 필요 시 확장 |

### S3

| 항목 | 현재 | 비고 |
|------|------|------|
| 수명 주기 | 30일 IA, 90일 Glacier | 이미 최적화됨 |
| 이전 버전 | 365일 후 삭제 | 적절 |

### ECR

| 항목 | 권장 |
|------|------|
| 이미지 정리 | 수명 주기 정책 설정 - 최근 10개 이미지만 유지 |
| untagged 이미지 | 7일 후 자동 삭제 정책 추가 |

### 비용 조회

```typescript
// 최근 30일 비용 (서비스별)
mcp__aws-mcp__aws_cli_execute({
  service: "ce",
  operation: "get-cost-and-usage",
  additional_args: [
    "--profile", "jongmun",
    "--region", "us-east-1",
    "--time-period", "Start=2026-01-01,End=2026-02-01",
    "--granularity", "MONTHLY",
    "--metrics", "UnblendedCost",
    "--group-by", "Type=DIMENSION,Key=SERVICE",
    "--output", "table"
  ]
})
```

참고: Cost Explorer API는 `us-east-1` 리전에서만 동작한다.

---

## Terraform 참조

인프라 변경은 반드시 Terraform을 통해 수행한다. AWS Console 직접 수정 금지.

- **Terraform 루트**: `/Users/gary/Documents/workspace/viewster/viewster-terraform/`
- **Staging**: `/Users/gary/Documents/workspace/viewster/viewster-terraform/staging/`
- **Production**: `/Users/gary/Documents/workspace/viewster/viewster-terraform/production/`

### 주요 Terraform 파일

| 파일 | 내용 |
|------|------|
| `ec2.tf` | EC2 인스턴스, IAM Role, EIP, User Data |
| `rds.tf` | RDS PostgreSQL, Subnet Group, Parameter Group |
| `s3.tf` | S3 버킷, 버전 관리, 암호화, CORS, 수명 주기 |
| `ecr.tf` | ECR 리포지토리 (frontend, admin-frontend, backend) |
| `cloudwatch.tf` | 대시보드, CPU/스토리지 알람, Auto Recovery |
| `vpc.tf` | VPC, Subnet, Internet Gateway, Route Table |
| `security-groups.tf` | EC2/RDS Security Group 규칙 |
| `route53.tf` | DNS A 레코드 |
| `ssm.tf` | SSM Parameter Store (환경변수) |
| `sns.tf` | SNS Topic (알람 알림) |
| `lambda.tf` | Lambda 함수 (Telegram 알림 등) |
| `variables.tf` | 변수 정의 |
| `terraform.tfvars` | 변수 값 (민감 정보 포함, 커밋 주의) |

### Terraform 명령어

```bash
# 환경 디렉토리에서 실행
cd /Users/gary/Documents/workspace/viewster/viewster-terraform/staging

# 실행 계획 확인
terraform plan

# 인프라 적용
terraform apply

# 리소스 목록
terraform state list

# 특정 리소스 상태
terraform state show aws_instance.backend_staging
```

---

## 문제 진단 체크리스트

### API 응답 없음
1. EC2 인스턴스 상태 확인 (running?)
2. Docker 컨테이너 상태 확인 (`docker ps`)
3. Nginx 상태 확인 (`systemctl status nginx`)
4. Backend 컨테이너 로그 확인 (`docker logs backend-blue`)
5. Security Group 인바운드 규칙 확인 (80, 443, 8080)
6. Elastic IP 연결 확인

### WebSocket 연결 실패
1. Nginx `proxy_read_timeout 86400` 설정 확인
2. Nginx `proxy_http_version 1.1`, `Upgrade`, `Connection` 헤더 확인
3. Backend 컨테이너 WebSocket 핸들러 로그 확인
4. Security Group에서 443 포트 허용 확인

### DB 연결 실패
1. RDS 인스턴스 상태 확인 (available?)
2. Security Group에서 5432 포트 허용 확인 (Backend EC2 -> RDS)
3. RDS 연결 수 확인 (CloudWatch DatabaseConnections)
4. SSM Parameter `/viewster/{env}/database_url` 확인

### Redis 연결 실패
1. Thirdparty EC2 인스턴스 상태 확인
2. Redis 컨테이너 상태 확인 (`docker ps` on thirdparty)
3. Security Group에서 6379 포트 허용 확인 (Backend EC2 -> Thirdparty EC2)
4. Redis 메모리 사용량 확인

### 높은 CPU 사용률
1. CloudWatch 알람 상태 확인 (ALARM?)
2. `docker stats`로 컨테이너별 CPU 확인
3. Backend: 동시 WebSocket 연결 수 확인
4. RDS: slow query 확인

---

## 프로필 설정 (필수)

- **프로필**: `jongmun` (모든 AWS CLI 명령에 필수)
- **리전**: `ap-northeast-2` (서울)

상세 MCP 사용법: [references/mcp-usage.md](references/mcp-usage.md)
