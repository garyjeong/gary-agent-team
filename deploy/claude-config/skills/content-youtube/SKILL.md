# Viewster 콘텐츠 & YouTube 연동

YouTube API 연동, 콘텐츠 CRUD, 검색/필터링, 댓글, 라이브채팅, SEO를 다루는 skill.
사용 시기: (1) YouTube 영상 등록/검색, (2) 콘텐츠 분류 (VOD/Live/Shorts), (3) 검색 기능, (4) 댓글/라이브채팅, (5) SEO 최적화, (6) 썸네일 품질 개선, (7) 콘텐츠 만료 처리

---

## 핵심 파일 맵

### Frontend (B2C)
| 파일 | 역할 |
|------|------|
| `viewster-frontend/src/app/home/` | 홈 페이지 (전체/라이브/VOD/Shorts 탭) |
| `viewster-frontend/src/components/molecules/VideoCard/` | 영상 카드 (썸네일, 제목 2줄 제한, 채널 프로필) |
| `viewster-frontend/src/components/molecules/ShortCard/` | 숏츠 카드 |
| `viewster-frontend/src/components/organisms/GridView/` | 반응형 그리드 (react-window 가상화, 3~5열) |
| `viewster-frontend/src/hooks/useYouTubeVideoInfo.ts` | YouTube 영상 메타데이터 |
| `viewster-frontend/src/hooks/useVideoComments.ts` | YouTube 댓글 조회 |
| `viewster-frontend/src/hooks/useLiveChat.ts` | YouTube 라이브 채팅 |
| `viewster-frontend/src/services/liveChatBroadcast.ts` | 라이브 채팅 브로드캐스트 (350 LOC) |
| `viewster-frontend/src/store/request/requestHomeContents.ts` | 홈 콘텐츠 조회 |
| `viewster-frontend/src/store/request/requestHomeLive.ts` | 라이브 콘텐츠 |
| `viewster-frontend/src/store/request/requestHomeVod.ts` | VOD 콘텐츠 |
| `viewster-frontend/src/store/request/requestHomeShorts.ts` | 숏츠 콘텐츠 |
| `viewster-frontend/src/store/request/requestYoutubeSync.ts` | YouTube 데이터 동기화 |
| `viewster-frontend/src/store/request/requestYoutubeVideoInfo.ts` | YouTube 영상 정보 |
| `viewster-frontend/src/store/request/requestVideoComments.ts` | 댓글 요청 |
| `viewster-frontend/src/store/slices/searchSlice.ts` | 검색 상태 |
| `viewster-frontend/src/store/slices/homeSlice.ts` | 홈 상태 |
| `viewster-frontend/src/store/slices/homeTabSlice.ts` | 홈 탭 상태 |
| `viewster-frontend/src/store/slices/shortsSlice.ts` | 숏츠 상태 |
| `viewster-frontend/src/components/molecules/SearchBar/` | 검색바 |

### Backend
| 파일 | 역할 |
|------|------|
| `viewster-backend/app/api/routers/youtube.py` | YouTube API (검색, 메타데이터, 영상 정보) |
| `viewster-backend/app/api/routers/search.py` | 콘텐츠 검색 API |
| `viewster-backend/app/services/youtube/youtube_service.py` | YouTube API v3 통합 |
| `viewster-backend/app/services/youtube/search_service.py` | YouTube 검색 서비스 |
| `viewster-backend/app/services/youtube/sync_service.py` | YouTube 데이터 동기화 |
| `viewster-backend/app/services/search_service.py` | 콘텐츠 검색 비즈니스 로직 |
| `viewster-backend/app/services/content_service.py` | 콘텐츠 CRUD |
| `viewster-backend/app/services/recommendation/` | 추천 시스템 (collaborative, content_based, hybrid) |
| `viewster-backend/app/models/content.py` | RewardPost 모델 |
| `viewster-backend/app/models/youtube.py` | YouTube 메타데이터 캐시 |
| `viewster-backend/app/repositories/content_repository.py` | 콘텐츠 데이터 접근 |
| `viewster-backend/app/repositories/youtube_repository.py` | YouTube 데이터 접근 |
| `viewster-backend/app/schemas/content.py` | 콘텐츠 스키마 |
| `viewster-backend/app/schemas/youtube.py` | YouTube 스키마 |
| `viewster-backend/app/tasks/expired_posts.py` | 만료 콘텐츠 정리 (Celery, 매 시간) |

### Admin Frontend
| 파일 | 역할 |
|------|------|
| `viewster-admin-frontend/src/app/posts/` | 콘텐츠 관리 (목록, 상세, 활동 사용자) |
| `viewster-admin-frontend/src/lib/api/posts.ts` | 콘텐츠 API 클라이언트 |
| `viewster-admin-frontend/src/components/posts/PostDetailModal.tsx` | 콘텐츠 상세 모달 |

### SEO
| 파일 | 역할 |
|------|------|
| `viewster-frontend/src/app/feed.xml/` | RSS 피드 |
| `viewster-frontend/src/app/sitemap*/` | 사이트맵 |
| `viewster-frontend/src/middleware.ts` | feed.xml 미들웨어 바이패스 |

---

## 콘텐츠 분류

| 타입 | 설명 | 리워드 | 프리롤 |
|------|------|--------|--------|
| **VOD** | 일반 YouTube 영상 | O (600초 타이머) | O |
| **Live** | YouTube 라이브 방송 | O (600초 타이머) | O |
| **Shorts** | YouTube Shorts (60초 이하) | X | X |

### 라이브 감지 로직 (최근 수정)
```python
# youtube_service.py
# liveBroadcastContent 필드 + snippet 분석
# VOD가 라이브로 오분류되는 버그 수정 (2026-02-10)
```

---

## 검색 & 필터링

### 프론트엔드 검색
- 검색바: 키워드 입력 → `searchSlice` 업데이트 → API 호출
- 정렬: 최신순, 인기순, **조회수순** (최근 추가)
- 필터: 리워드 제외 기능 (비로그인 시 비활성화)
- 무한 스크롤: Intersection Observer + react-window 가상화

### 백엔드 검색 API
```
GET /api/search?q={query}&sort={latest|popular|viewCount}&type={vod|live|shorts}
```

---

## 썸네일 최적화 (2026-02 개선)

### 품질 우선순위
```
maxresdefault (1280x720) → sddefault (640x480) → hqdefault (480x360)
```

### 최적화 기법
- LQIP (Low Quality Image Placeholder): 블러 처리된 저화질 이미지 → 고화질 로드
- `<img loading="lazy">`: 뷰포트 밖 이미지 지연 로드
- YouTube CDN 직접 로드: `i.ytimg.com` URL 사용
- `VideoCardWrapper` memo 적용으로 불필요한 리렌더링 방지

---

## 댓글 시스템

### YouTube 댓글 API
```
GET /api/youtube/comments?video_id={id}&order={relevance|time}
```
- 비로그인 사용자도 조회 가능
- 정렬: 관련성순(relevance) / 최신순(time)
- 프론트엔드: 알약형(pill) 정렬 버튼

### 라이브 채팅
- `liveChatBroadcast.ts`: YouTube Live Chat API 폴링
- `useLiveChat.ts` 훅으로 컴포넌트에서 사용
- `LiveChat` 컴포넌트: 실시간 메시지 표시

---

## SEO (네이버 전용 최적화 포함)

### Phase 1~3 (2026-02-10)
- 네이버 서치 어드바이저 사이트맵 최적화
- RSS 피드 (`/feed.xml`)
- meta 태그 최적화 (네이버 검색 기준)
- 미들웨어에서 feed.xml 바이패스 추가

---

## 디버깅 체크리스트

1. **검색 결과 없음**: API 응답 확인, 검색 파라미터 누락 확인
2. **라이브 탭 에러**: CORS 확인, YouTube API 키 확인
3. **썸네일 깨짐**: maxresdefault 404 fallback → sddefault 확인
4. **무한 스크롤 미동작**: 리워드 필터 상태 확인, 초기 진입 시 이벤트 바인딩 확인
5. **VOD가 라이브로 분류**: YouTube liveBroadcastContent 필드 검증 로직 확인
6. **만료 콘텐츠 잔존**: Celery expired_posts 태스크 실행 확인

---

## 관련 스킬
- `watching-session`: YouTube Player 통합, 시청 세션
- `reward-system`: 시청 완료 보상 (VOD/Live만)
- `admin-panel`: 콘텐츠 CRUD 관리
- `b2c-frontend`: GridView, VideoCard 컴포넌트
