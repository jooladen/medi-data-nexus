# medi-data-nexus 동작 설명

---

## 🟢 초딩용 설명

### 이 프로그램이 뭐 하는 거야?

보험 청구할 때 병원에서 받은 **PDF 파일 2개**를 넣으면,
숫자 계산을 자동으로 해줘서 **표로 정리**해주는 프로그램이야.

---

### 어떻게 돌아가냐면...

```
[나]
 PDF 2개를 화면에 끌어다 놓는다
       ↓
[화면 (Next.js)]
 "파일 받았어! 파이썬한테 분석 맡길게"
       ↓  (인터넷으로 전달)
[분석기 (Python)]
 PDF 열어서 표 읽고
 날짜 세고, 약 먹은 날 세고, 수술인지 처치인지 분류함
 → 결과를 JSON(메모장 같은 것)으로 돌려줌
       ↓  (인터넷으로 전달)
[화면 (Next.js)]
 결과를 예쁜 표로 보여줌
       ↓
[나]
 "엑셀 다운로드" 버튼 누름
       ↓  (인터넷으로 전달)
[엑셀 만들기 (Python)]
 .xlsx 파일 만들어서 내려줌
       ↓
[내 컴퓨터]
 보험청구요약.xlsx 저장 완료!
```

---

### 핵심 비유

| 비유 | 실제 |
|------|------|
| 스캔된 영수증 | PDF 파일 |
| 계산기 아저씨 | Python (분석기) |
| 결과 화면 | Next.js (웹 화면) |
| 완성된 보고서 | 엑셀(.xlsx) 파일 |

---

### 세 가지만 기억해

1. **Python이 머리** — PDF 읽고 계산하는 건 파이썬이 다 함
2. **Next.js가 얼굴** — 화면 보여주고 버튼 클릭 받는 건 Next.js
3. **둘이 인터넷으로 대화** — HTTP로 주고받음 (Vercel이 연결해줌)

---
---

## 🔵 개발자용 설명

### 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel 플랫폼                         │
│                                                         │
│  ┌─────────────────────┐   ┌─────────────────────────┐  │
│  │  Next.js (Frontend) │   │  Python Serverless Fn   │  │
│  │                     │   │                         │  │
│  │  app/page.tsx       │   │  api/parse.py           │  │
│  │  app/result/        │   │  api/export-excel.py    │  │
│  │  components/        │   │                         │  │
│  │  lib/types.ts       │   │  BaseHTTPRequestHandler │  │
│  └──────────┬──────────┘   └────────────┬────────────┘  │
│             │  HTTP fetch()             │               │
│             └───────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

### Python ↔ Next.js 연동 핵심

**둘은 직접 연결이 아니라 HTTP로 통신한다.**

```typescript
// FileUploader.tsx — Next.js가 Python을 호출하는 방식
const res = await fetch("/api/parse", {
  method: "POST",
  body: formData,
})
```

```python
# parse.py — Python이 HTTP 요청을 받는 방식
class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        result = _process_multipart(body, content_type)
        self._json_response(200, result)
```

**Vercel이 하는 역할**: `api/*.py` 파일을 자동으로 serverless function으로 배포.
별도 Vercel SDK 없이 **표준 Python `http.server`** 만으로 동작.

**로컬에서는**: `pnpm dev`가 Python을 실행하지 않아 `/api/parse` 404 발생.
`vercel dev`도 Next.js 프레임워크 프로젝트에서는 Python 함수를 감지하지 못함.
→ **로컬 통합 테스트는 git push 후 Vercel 배포 URL에서 진행.**

---

### 전체 데이터 흐름

```
1. 업로드
   FileUploader.tsx
   └─ File[] 검증 (PDF, 4.5MB 이하)
   └─ FormData 구성
   └─ POST /api/parse

2. PDF 파싱 (api/parse.py)
   handler.do_POST()
   └─ _process_multipart()
       ├─ detect_pdf_type()             → "basic" | "detail"
       ├─ parse_basic_info()            → list[{date, institution, diag_code, diag_name, is_pharmacy}]
       ├─ parse_detail_info()           → list[{date, institution, treatment_detail, code_name}]
       └─ join_and_aggregate()
           ├─ calculate_unique_visits() → 내원일수 중복 제거
           ├─ extract_medication_days() → 투약일수 합산
           ├─ collect_methods_by_date() → Surgery/Treatment/Exam 분류
           └─ diag_code 기준 그룹화 + 집계

3. 결과 전달
   app/page.tsx
   └─ sessionStorage.setItem("parseResult", JSON)
   └─ router.push("/result")

4. 결과 표시
   app/result/page.tsx
   └─ sessionStorage.getItem("parseResult")
   └─ <ResultTable summary={...} />
   └─ <ExceptionList exceptions={...} />

5. 엑셀 다운로드
   result/page.tsx → POST /api/export-excel (JSON body)
   api/export-excel.py
   └─ build_excel()
       ├─ Sheet "보험청구요약"  → _write_summary_sheet()
       └─ Sheet "미매칭항목"   → _write_exception_sheet()
   └─ binary .xlsx 응답
```

---

### API 엔드포인트 스펙

#### POST `/api/parse`

| 항목 | 내용 |
|------|------|
| Content-Type | multipart/form-data |
| 입력 | `files`: PDF 파일 N개 |
| 출력 | `{ summary: ParsedSummary[], exceptions: ParseException[] }` |
| 타임아웃 | 60초 설정 (Hobby 플랜 최대 300초) |
| 에러 | 400/500 + `{ error: string }` |
| 크기 제한 | 4.5MB (Vercel 플랜 무관 고정) |

#### POST `/api/export-excel`

| 항목 | 내용 |
|------|------|
| Content-Type | application/json |
| 입력 | `ParseResult` JSON body |
| 출력 | binary `.xlsx` |
| Content-Disposition | `attachment; filename="insurance_summary.xlsx"` |

---

### TypeScript 타입 (lib/types.ts)

```typescript
type ParsedSummary = {
  diagnosis: string
  diagnosisCode: string
  dateRange: { start: string; end: string }   // YYYY-MM-DD
  totalVisits: number                          // 중복 제거 내원일수
  methods: ('Surgery' | 'Treatment' | 'Exam')[]
  totalMedicationDays: number
}

type ParseException = {
  date: string
  hospital: string
  diagnosis: string
  reason: string   // 고정값: "세부진료정보 매칭 없음"
}

type ParseResult = {
  summary: ParsedSummary[]
  exceptions: ParseException[]
}
```

---

### 핵심 비즈니스 로직 함수

| 함수 | 파일 | 역할 |
|------|------|------|
| `detect_pdf_type()` | parse.py | 첫 페이지 텍스트로 basic/detail 판별 |
| `parse_basic_info()` | parse.py | 기본진료정보 PDF → row 파싱 |
| `parse_detail_info()` | parse.py | 세부진료정보 PDF → row 파싱 |
| `calculate_unique_visits()` | parse.py | 날짜별 병원+약국 중복 → 1일 카운트 |
| `extract_medication_days()` | parse.py | regex `처방조제[-\s]?(내복약\|외용약)\s*(\d+)일분` |
| `classify_treatment()` | parse.py | Exam 우선 → Surgery → Treatment 순서 분류 |
| `join_and_aggregate()` | parse.py | 날짜 기준 조인, diag_code 기준 집계 |
| `build_excel()` | export-excel.py | openpyxl로 시트 2개짜리 xlsx 생성 |

---

### sessionStorage를 쓰는 이유

`/api/parse` 응답 JSON을 `/result` 페이지로 넘기는 방법:
- URL 쿼리스트링 → 데이터가 너무 커서 불가
- 서버 세션/DB → Vercel Hobby 플랜, 불필요한 복잡도
- **sessionStorage** → 탭 닫으면 자동 소멸, 서버리스 환경에 적합

`/result` 직접 접근 시 sessionStorage 없으면 `/`로 리다이렉트.

---

### 개발 환경별 테스트 방법

```bash
# UI 개발
pnpm dev  →  localhost:3000

# Python 파서 단독 테스트 (로컬, 브라우저 불필요)
python api/parse_cli.py \
  "data/개인진료정보내역(기본진료정보)_20260413.pdf" \
  "data/개인진료정보내역(세부진료정보)_20260413.pdf"

# 전체 통합 테스트
git push  →  Vercel 자동 배포  →  배포 URL에서 확인
```
