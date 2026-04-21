# Plan: medical-pdf-parser

> 작성일: 2026-04-20  
> 최종 수정: 2026-04-21  
> Feature: medical-pdf-parser  
> Phase: Plan

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | medical-pdf-parser |
| 시작일 | 2026-04-20 |
| 대상 사용자 | 보험설계사 |
| 배포 환경 | Vercel (Next.js + Python Serverless) |

### Value Delivered (4 Perspectives)

| 관점 | 내용 |
|------|------|
| Problem | 보험설계사가 고객의 진료 PDF를 수작업으로 분석하여 내원일수/투약일수/처치 분류를 정리하는 데 막대한 시간 소비 |
| Solution | PDF 업로드 → 자동 파싱 → 보험 청구용 요약 테이블 즉시 생성, 엑셀 다운로드 |
| Function & UX Effect | 드래그&드롭으로 2개 PDF 업로드, 처리 버튼 클릭, 결과 화면+엑셀 다운로드 |
| Core Value | 설계사의 반복 수작업 제거 → 고객 유치 시간 확보 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 설계사 수작업 제거. 1인 기업 목표의 자동화 도구. |
| WHO | 보험설계사 (비개발자, 브라우저만 사용) |
| RISK | PDF 구조 변경 시 파서 깨짐, 4.5MB 초과 파일 처리 불가 (Phase 1 허용 범위) |
| SUCCESS | PDF 2개 업로드 → 정확한 요약 테이블 생성 → 엑셀 다운로드 작동 |
| SCOPE | Phase 1: 4.5MB 이하 PDF, 기본/세부 진료정보 2종, Vercel 배포 |

---

## 1. 요구사항

### 1.1 입력

| 항목 | 내용 |
|------|------|
| 파일 타입 | PDF (기본진료정보, 세부진료정보) |
| 파일 수 | 2개 이상 (유동적), Phase 1은 주로 2개 |
| 파일 크기 | Phase 1: 4.5MB 이하 (Vercel 제약) |
| 파일 감지 | 파일명 또는 내부 제목("기본진료정보" / "세부진료정보")으로 자동 분류 |

### 1.2 비즈니스 로직

#### 내원일수 계산
- **기준**: 기본진료정보의 진료시작일
- **중복 제거 규칙**: 같은 날짜에 병원+약국 방문이 모두 있으면 → **1일**로 카운트
- **병원/약국 구분**: `병·의원&약국` 컬럼 텍스트에 `"약국"` 포함 여부
  - `"한나약국"`, `"원당약국"` → 약국
  - `"서울공감치과의원"`, `"일산만족정형외과의원"`, `"국립암센터"` 등 → 병원

#### 투약일수 계산
- **대상**: 세부진료정보에서 코드명이 아래 패턴인 Row만 필터
  ```
  처방조제-내복약 {N}일분
  처방조제-외용약 {N}일분
  ```
- **추출 방식**: 코드명에서 숫자 `N` 파싱 (총 투약일수 컬럼은 항상 1 → 무시)
- **합산**: 필터된 Row의 N 값 Sum
- **제외**: 행정/관리 항목 (약국관리료, 조제기본료, 복약지도료, 의약품관리료 등)

#### 처치 분류 (수술/처치/검사)
- **두 컬럼 조합**: `진료내역` + `코드명`

| 분류 | 판단 기준 |
|------|----------|
| 수술 (Surgery) | 진료내역에 "처치 및 수술" 포함 **AND** (코드명에 "수술" 포함 OR 코드명 ends "술") |
| 처치 (Treatment) | 진료내역에 "처치 및 수술" 포함 **AND** 수술 아닌 경우, **OR** 진료내역에 "이학요법" 포함 |
| 검사 (Exam) | 진료내역에 "영상진단" OR "검사료" 포함, **OR** 코드명에 "검사" 포함 |

#### Exception 처리
- 기본진료정보에 날짜가 있는데 세부진료정보에 매칭 데이터가 없는 경우 → Exception List

### 1.3 출력

#### 메인 요약 테이블

| 컬럼 | 소스 | 설명 |
|------|------|------|
| 주상병명 | 기본진료정보 주상병명 | 병원 기록 기준 (약국 행 제외) |
| Date Range | 기본진료정보 진료시작일 | 해당 상병의 최초~최종 진료일 |
| Total Visits | 기본진료정보 내원일수 | 중복 제거 후 고유 방문일 수 |
| Method | 세부진료정보 진료내역+코드명 | Surgery / Treatment / Exam (복수 가능) |
| Total Medication Days | 세부진료정보 코드명 파싱 | 처방조제 N일분 합산 |

#### Exception List
- 기본진료정보 날짜 기준으로 세부진료정보 매칭 실패한 Row 목록
- 하단 별도 테이블로 표시

#### 다운로드
- **엑셀(.xlsx)**: 메인 테이블 + Exception List (시트 2개)
- **화면 테이블**: 브라우저에서 바로 확인

---

## 2. 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| 프론트엔드 | Next.js (App Router, TypeScript) | 15.x |
| UI | Tailwind CSS + shadcn/ui | 최신 |
| PDF 파싱 | Python `pdfplumber` (테이블 추출 기반) | >=0.11.0 |
| API | Vercel Python Serverless (`api/parse.py`) | - |
| 엑셀 생성 | Python `openpyxl` | 3.x |
| 배포 | Vercel Hobby (Phase 1) | - |

---

## 3. 파일 구조

```
medi-data-nexus/
├── app/
│   ├── page.tsx                   # 업로드 UI (메인)
│   ├── result/
│   │   └── page.tsx               # 결과 테이블 표시
│   └── layout.tsx
├── components/
│   ├── FileUploader.tsx            # 드래그&드롭 다중 파일 업로드
│   ├── ResultTable.tsx             # 메인 요약 테이블
│   └── ExceptionList.tsx          # 예외 목록
├── lib/
│   └── types.ts                   # TypeScript 타입 정의
├── api/
│   ├── parse.py                   # PDF 파싱 메인 (Vercel Python Serverless handler)
│   ├── parse_cli.py               # CLI 엔트리포인트 (로컬 테스트용 subprocess 실행)
│   ├── export-excel.py            # 엑셀 생성 Serverless handler (openpyxl)
│   └── export_excel_cli.py        # 엑셀 CLI 엔트리포인트
├── requirements.txt
└── vercel.json
```

---

## 4. API 설계

### POST `/api/parse`

```
Request: multipart/form-data
  files[]: PDF 파일들 (N개)

Response: JSON
{
  "summary": [
    {
      "diagnosis": "만성 복합치주염",
      "diagnosisCode": "K052",
      "dateRange": { "start": "2025-09-18", "end": "2026-01-12" },
      "totalVisits": 3,
      "methods": ["Treatment"],
      "totalMedicationDays": 0
    }
  ],
  "exceptions": [
    {
      "date": "2025-10-23",
      "hospital": "국립암센터",
      "diagnosis": "특발성 골다공증, 기타 부분",
      "reason": "세부진료정보 매칭 없음"
    }
  ]
}
```

### POST `/api/export-excel`

```
Request: JSON (위 Response와 동일 구조)
Response: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (Blob)
```

---

## 5. Python 파서 핵심 로직

### 5.1 파일 타입 자동 감지

```python
def detect_pdf_type(pdf_path: str) -> str:
    # pdfplumber로 첫 페이지 텍스트 읽기
    # "기본진료정보" 텍스트 포함 → "basic"
    # "세부진료정보" 텍스트 포함 → "detail"
    # 판별 불가 → "unknown" (Exception)
```

### 5.2 기본진료정보 파싱

```python
def parse_basic_info(pdf_path: str) -> list[dict]:
    # 컬럼: 순번, 진료시작일, 병·의원&약국, 진단과, 입원/외래,
    #        주상병코드, 주상병명, 내원일수, ...
    # 전 페이지 스캔 (15페이지)
    # 약국 판별: "약국" in 병·의원&약국
```

### 5.3 중복 제거 로직

```python
def calculate_unique_visits(records: list[dict]) -> dict[str, int]:
    # 날짜별 그룹화
    # 같은 날짜에 병원+약국 모두 있으면 → 1
    # 같은 날짜에 병원만 → 1
    # 같은 날짜에 약국만 → 1
    # 날짜별 unique 방문 수 반환
```

### 5.4 세부진료정보 파싱

```python
def parse_detail_info(pdf_path: str) -> list[dict]:
    # 전 페이지 스캔 (80페이지 → Phase 2 고려)
    # 투약 Row 필터: 코드명 matches r"처방조제-(내복약|외용약)\s*(\d+)일분"
    # N 추출: re.search(r"(\d+)일분", code_name).group(1)
```

### 5.5 처치 분류

```python
def classify_treatment(treatment_detail: str, code_name: str) -> str:
    # 검사: "영상진단" in treatment_detail OR "검사료" in treatment_detail OR "검사" in code_name  (최우선)
    # 수술: "처치 및 수술" in treatment_detail AND ("수술" in code_name OR code_name.endswith("술"))
    # 처치: "처치 및 수술" in treatment_detail (수술 아닌 경우) OR "이학요법" in treatment_detail
    # 기타: 진찰료, 마취료, 조제료 등 → None 반환 (분류에서 제외)
```

### 5.6 데이터 Join (날짜 기준)

```python
def join_by_date(basic: list[dict], detail: list[dict]) -> tuple[list, list]:
    # 날짜 기준으로 기본+세부 병합
    # 매칭 안 된 기본진료정보 날짜 → exceptions 리스트
    # 주상병명별로 그룹화
    # Date Range, Total Visits, Methods, Total Medication Days 집계
```

---

## 6. 주요 엣지 케이스

| 케이스 | 처리 방법 |
|--------|----------|
| 같은 날짜 병원+약국 (중복) | 병원 기록의 주상병명 사용, 방문 1회로 카운트 |
| 같은 날 동일 상병 여러 병원 방문 | 각각 별도 Row (기본진료정보 기준) |
| 코드명 "처방조제-내복약 N일분" 파싱 실패 | Exception List에 추가, 로그 기록 |
| 세부진료정보 날짜와 기본진료정보 날짜 불일치 | Exception List |
| 같은 날 수술+처치 모두 발생 | Method 컬럼에 복수 표기 "Surgery, Treatment" |
| PDF 타입 자동 감지 실패 | 사용자에게 에러 메시지 + 수동 선택 UI 제공 |
| 4.5MB 초과 파일 | 업로드 전 클라이언트 검증 → 에러 메시지 표시 |

---

## 7. 성공 기준 (Success Criteria)

- [x] 기본진료정보 PDF + 세부진료정보 PDF 업로드 → 파싱 성공
- [x] 동일 날짜 병원+약국 중복 제거 정확 작동
- [x] `처방조제-내복약 N일분` 패턴에서 N 추출 정확
- [x] 수술/처치/검사 분류 샘플 데이터 기준 정확
- [x] Exception List에 매칭 실패 Row 표시
- [x] 엑셀(.xlsx) 다운로드 — 메인 테이블 + Exception 시트 2개
- [ ] Vercel 배포 후 실환경 정상 작동

---

## 8. Phase 2 예약 사항 (현재 구현 제외)

- 80페이지 이상 PDF 처리 (Vercel Pro + Blob)
- PDF 리포트 출력
- 처방조제정보 PDF (3번째 파일 타입) 처리
- 복수 고객 처리 (여러 세트 동시 업로드)
- 모바일 반응형

---

## 10. 변경 이력

| 날짜 | 항목 | 변경 전 (A) | 변경 후 (B) | 변경 이유 |
|------|------|------------|------------|----------|
| 2026-04-21 | PDF 파싱 라이브러리 | `pdfplumber 0.11.4` | `PyMuPDF (fitz) >=1.24.0` | 실제 PDF 테스트 결과 한글 병명이 깨짐. pdfplumber가 Korean CIDFont의 ToUnicode 맵을 잘못 디코딩하는 인코딩 문제. PyMuPDF는 자체 폰트 매핑으로 동일 PDF에서 정상 한글 출력 확인. |
| 2026-04-21 | 이미지 기반 PDF 지원 | Phase 1 포함 예정 | Phase 1 제외 (별도 논의 후 진행) | 건강보험공단 PDF 중 이미지 렌더링 방식(전체 표가 단일 이미지)이 존재하나, 현재 사용자 요건은 텍스트 PDF만 해당. 이미지 PDF는 별도 Phase에서 논의. |
| 2026-04-21 | PDF 파싱 라이브러리 (재변경) | `PyMuPDF (fitz)` + `pdftotext CLI` | `pdfplumber` (테이블 파싱) | pdf24로 비밀번호 해제한 PDF에서 pdfplumber가 테이블 구조를 셀 단위로 정확히 추출하고 한글도 정상 처리됨을 확인. pdftotext는 컬럼 레이아웃 뒤섞임으로 주상병명 파싱 오류 발생. pdfplumber `extract_table()`이 셀 경계를 직접 파악하므로 컬럼 혼용 문제 없음. |
| 2026-04-21 | subprocess 인코딩 | PYTHONIOENCODING 미설정 | `PYTHONIOENCODING=utf-8` 설정 | Windows에서 Node.js subprocess가 Python stdout을 CP949로 읽어 한글 깨짐 발생. route.ts에 환경변수 추가 + parse_cli.py에 `sys.stdout.reconfigure(encoding='utf-8')` 추가로 해결. |

---

## 9. 검증 방법

1. 샘플 PDF 2개로 로컬 Python 파서 단독 테스트 (`python api/parse_cli.py "data/개인진료정보내역(기본진료정보)_20260413.pdf" "data/개인진료정보내역(세부진료정보)_20260413.pdf"`)
2. Next.js dev 서버 실행 → 브라우저에서 업로드 테스트
3. 결과 테이블을 수작업 계산 결과와 대조
4. 엑셀 다운로드 → Excel에서 열어서 한글/서식 확인
5. Vercel 배포 후 실환경 재테스트
