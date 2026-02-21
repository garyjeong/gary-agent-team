# AWS Resource Checker Reference

## AWS MCP 사용법

### 리소스 목록 조회
```typescript
// EC2 인스턴스 목록
mcp_aws-mcp_aws_list_resources({ service: "ec2", resource_type: "instance" })

// RDS 인스턴스 목록
mcp_aws-mcp_aws_list_resources({ service: "rds" })

// S3 버킷 목록
mcp_aws-mcp_aws_list_resources({ service: "s3" })
```

### AWS CLI 명령 실행
```typescript
// EC2 인스턴스 상태 확인
mcp_aws-mcp_aws_cli_execute({
  service: "ec2",
  operation: "describe-instances",
  additional_args: ["--profile", "jongmun"]
})
```

### 계정 정보 조회
```typescript
mcp_aws-mcp_aws_get_account_info()
```

## 리소스 확인 절차
1. 계정 정보 확인
2. 리소스 목록 조회
3. 상태 확인 (CLI 명령)
4. 문제 발견 시 최적화 제안

