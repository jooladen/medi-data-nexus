# 로컬 개발환경 설정

## 결론부터

| 작업 | 방법 |
|------|------|
| UI/화면 개발 | `pnpm dev` → localhost:3000 |
| Python 파서 테스트 | `python api/parse_cli.py` 직접 실행 |
| 전체 통합 테스트 | `git push` → Vercel 배포 URL |

---

## 왜 로컬에서 Python API가 안 되는가

`pnpm dev`는 Next.js dev 서버만 실행한다. `api/*.py`는 Vercel 전용 Python serverless handler라 로컬에서 무시된다.

```
pnpm dev 실행 시:
  브라우저 → fetch("/api/parse") → 404
```

### vercel dev를 시도했지만 안 됐다

`vercel dev`는 Next.js 프레임워크 프로젝트를 감지하면 `next dev`만 실행하고 Python 함수를 무시한다.

```
vercel dev 실행 결과:
  Resolved builders: ""  ← Python 런타임 감지 안 됨
  → /api/parse 여전히 404
```

### Flask + rewrites 방식도 있지만

터미널 2개 + Flask 래핑 + next.config.ts 수정이 필요하다.
Python 파서가 이미 완성돼 있고 자주 바꾸지 않는다면 불필요한 복잡도다.

---

## 실제 개발 흐름

### UI 개발
```bash
pnpm dev
# → localhost:3000에서 화면 확인
# 파일 저장하면 핫리로드 자동 반영
```

### Python 파서 단독 테스트
```bash
python api/parse_cli.py "data/개인진료정보내역(기본진료정보)_20260413-1-1p.pdf" "data/개인진료정보내역(세부진료정보)_20260413-1-5p.pdf"

python api/parse_cli.py "data/개인진료정보내역(기본진료정보)_20260413.pdf" "data/개인진료정보내역(세부진료정보)_20260413.pdf"

```

터미널에 JSON 출력 → 파싱 결과 즉시 확인 가능:
```json
{
  "summary": [...],
  "exceptions": [...]
}
```

확인 가능한 것: 파싱 정확도, 내원일수, 투약일수, 처치분류, Exception List
확인 불가능한 것: 화면 테이블, 엑셀 다운로드 (통합 테스트 필요)

### 전체 통합 테스트
```bash
git push
# → Vercel 자동 배포
# → 배포 URL에서 PDF 업로드 → 결과 테이블 → 엑셀 다운로드 확인
```

---

## Vercel 공식 제한 (Hobby 무료 플랜)

context7 공식 문서 확인 기준:

| 제한 | 값 | 비고 |
|------|-----|------|
| 요청 body 크기 | **4.5MB** | 플랜 무관 고정. 초과 시 413 에러 |
| 함수 타임아웃 | **300초** | 구버전 "10초 제한"은 구버전 정보 |

현재 프로젝트:
- `FileUploader.tsx`: `MAX_FILE_SIZE = 4.5 * 1024 * 1024` ✅
- `vercel.json`: `maxDuration: 60` ✅

---

## 참고: api/parse.py + app/api/parse/route.ts 공존 불가

같은 경로 `/api/parse`에 두 파일이 생기면 Vercel 배포 시 라우팅 충돌.
Vercel 공식 미지원. **공존시키지 말 것.**
