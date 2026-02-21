# Viewster 광고 시스템

프리롤 광고, 배너 광고, 광고주 관리, 노출/클릭 추적을 다루는 skill.
사용 시기: (1) 프리롤 광고 버그, (2) 배너 광고 노출 이슈, (3) 광고주 지갑/결제, (4) 광고 노출/클릭 추적, (5) 광고 승인/거절 관리, (6) 가중치 기반 광고 선택

---

## 핵심 파일 맵

### Frontend (B2C)
| 파일 | 역할 |
|------|------|
| `viewster-frontend/src/components/organisms/AdPreroll/` | 프리롤 광고 플레이어 (MP4, 스킵 불가, 기본 음소거) |
| `viewster-frontend/src/components/organisms/AdBanner/` | 배너 광고 컴포넌트 |
| `viewster-frontend/src/hooks/useAdsLoader.ts` | 광고 로드 & 표시 로직 |
| `viewster-frontend/src/hooks/useAdImpression.ts` | 광고 임프레션 추적 |
| `viewster-frontend/src/store/request/requestAds.ts` | GET /ads API 호출 |
| `viewster-frontend/src/store/request/requestAdvertiser.ts` | 광고주 API 호출 |
| `viewster-frontend/src/app/advertiser/` | 광고주 대시보드 (지갑, 충전, 광고 등록) |

### Backend
| 파일 | 역할 |
|------|------|
| `viewster-backend/app/api/routers/ad.py` | 광고 API (GET /ads, POST /ads/{id}/impression, /click) |
| `viewster-backend/app/api/routers/advertiser.py` | 광고주 API (지갑 충전, 출금) |
| `viewster-backend/app/services/ad_service.py` | 광고 비즈니스 로직 (가중치 선택, 과금) |
| `viewster-backend/app/services/advertiser_service.py` | 광고주 서비스 |
| `viewster-backend/app/services/pg_service.py` | PayLetter PG 결제 연동 |
| `viewster-backend/app/services/payment_method_strategy.py` | 결제 수단 전략 패턴 |
| `viewster-backend/app/models/ad.py` | Ad, AdImpression, AdClick 모델 |
| `viewster-backend/app/models/advertiser.py` | AdvertiserWallet, AdvertiserOrder 모델 |
| `viewster-backend/app/schemas/ad.py` | 광고 Pydantic 스키마 |
| `viewster-backend/app/schemas/advertiser.py` | 광고주 스키마 |

### Admin Frontend
| 파일 | 역할 |
|------|------|
| `viewster-admin-frontend/src/app/ads/` | 광고 관리 (목록, 상세, 승인/거절) |
| `viewster-admin-frontend/src/app/ads/settings/` | 광고 글로벌 설정 |
| `viewster-admin-frontend/src/app/advertiser-payments/` | 광고주 결제 내역 |
| `viewster-admin-frontend/src/app/advertiser-wallets/` | 광고주 지갑 관리 |
| `viewster-admin-frontend/src/lib/api/ads.ts` | 광고 API 클라이언트 |
| `viewster-admin-frontend/src/lib/api/advertiser-payments.ts` | 결제 API 클라이언트 |
| `viewster-admin-frontend/src/lib/api/advertiser-wallets.ts` | 지갑 API 클라이언트 |
| `viewster-admin-frontend/src/components/ads/` | AdDetailModal, AdTableRow, AdSettingsTab |

### Admin Backend
| 파일 | 역할 |
|------|------|
| `viewster-backend/app/routers/ad_admin.py` | 광고 관리 API (승인, 거절, CRUD) |
| `viewster-backend/app/routers/advertiser_payment_admin.py` | 광고주 결제 조회 |

---

## 광고 유형

### 1. 프리롤 광고 (Pre-roll)
- **형식**: MP4 동영상
- **재생**: 영상 시작 전 재생, 스킵 불가
- **음소거**: 기본 음소거, 토글 버튼 제공 (좌측 하단)
- **대상**: VOD/Live만 (Shorts 제외)
- **등록**: 배너 + 프리롤 쌍으로 등록 (pair_id)
- **노출시간**: 관리자가 설정 가능

### 2. 배너 광고
- **위치**: 시청 페이지 사이드바
- **형식**: 이미지 (banner_image_url nullable)
- **클릭**: 광고주 URL로 이동

### 3. 영상 광고
- **형식**: YouTube 영상 URL
- **노출**: 콘텐츠 목록 사이에 삽입

---

## 광고 선택 알고리즘

### 가중치 기반 선택
```python
# ad_service.py
# 1. 활성 광고 조회 (status=approved, budget > 0)
# 2. 가중치 계산 (우선순위, 잔여 예산, 노출 빈도)
# 3. 가중치 기반 랜덤 선택
# 4. 노출 기록 + 과금
```

### 과금 구조
- **CPM**: 1,000회 노출 당 과금
- **CPC**: 클릭 당 과금
- 광고주 지갑에서 자동 차감
- 예산 소진 시 노출 중단

---

## 광고 플로우

### 프리롤 재생 플로우
```
시청 페이지 진입
  → GET /ads?type=preroll&content_id={id}
  → 광고 있으면 → AdPreroll 컴포넌트 렌더링
    → MP4 재생 (음소거, 스킵 불가)
    → 재생 완료 → POST /ads/{id}/impression
    → YouTube 영상 자동재생 시작
  → 광고 없으면 → YouTube 바로 재생
```

### 광고주 충전 플로우
```
광고주 대시보드 → 지갑 충전
  → PayLetter PG (카드/모바일/네이버페이)
  → 결제 완료 콜백 → 지갑 잔액 증가
  → 광고 등록 가능
```

---

## 최근 변경사항 (2026-02)
- 프리롤 노출시간 수정 지원
- 배너+프리롤 쌍 등록 시스템 (pair_id)
- 프리롤 광고 영상 길이 편집
- banner_image_url nullable 처리
- 광고 임프레션 405 에러 수정 필요 (INFO-PROD)

---

## 디버깅 체크리스트

1. **프리롤 안 나옴**: GET /ads 응답 확인, 광고 status=approved 확인, 예산 잔액 확인
2. **iOS 프리롤 후 자동재생 실패**: autoplay 정책 확인, muted 속성 확인
3. **임프레션 기록 실패**: POST /ads/{id}/impression 405 에러 → HTTP 메서드 확인
4. **광고주 충전 실패**: PayLetter 콜백 URL 확인, PG 서비스 에러 로그 확인
5. **배너 광고 박스 오픈 애니메이션에 가려짐**: z-index 계층 확인

---

## 관련 스킬
- `watching-session`: 프리롤 재생 후 YouTube 전환
- `auth-oauth`: 광고주 로그인 & 권한
- `admin-panel`: 광고 승인/거절 관리
