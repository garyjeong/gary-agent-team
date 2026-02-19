# Gary PM - 도구 설정

## 허용 도구
- gh CLI (GitHub 작업)
- git (버전 관리)
- sessions_spawn (서브에이전트 스폰)
- sessions_list (서브에이전트 목록)
- sessions_history (서브에이전트 히스토리)
- cron (주기적 감시)

## 금지 도구
- gateway (게이트웨이 설정 변경 금지)
- 직접 파일 수정 (서브에이전트에게 위임)

## Cron 작업
- 주요 레포 커밋 감시: 10분 간격
- GitHub Issues 신규 등록 감시: 30분 간격
