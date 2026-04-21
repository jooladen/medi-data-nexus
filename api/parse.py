"""
PDF 파서 — pdfplumber 기반.
pdf24로 변환된 PDF에서 pdfplumber가 테이블 구조와 한글을 정확히 추출함.
"""

import json
import re
import tempfile
import os
import pdfplumber
from http.server import BaseHTTPRequestHandler
from collections import defaultdict


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def _normalize_korean(text: str) -> str:
    return re.sub(r"(?<=[\uAC00-\uD7A3])\s+(?=[\uAC00-\uD7A3])", "", text)


def _extract_rows(path: str) -> list[list]:
    rows = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            table = page.extract_table()
            if table:
                for row in table:
                    if row and row[0] != "순번":
                        rows.append(row)
    return rows


# ── PDF 타입 감지 ──────────────────────────────────────────────────────────────

def detect_pdf_type(path: str) -> str:
    with pdfplumber.open(path) as pdf:
        text = pdf.pages[0].extract_text() or ""
    if "기본진료정보" in text:
        return "basic"
    if "세부진료정보" in text:
        return "detail"
    return "unknown"


# ── 기본진료정보 파싱 ──────────────────────────────────────────────────────────

def parse_basic_info(path: str) -> list[dict]:
    rows = _extract_rows(path)
    records = []

    for row in rows:
        if len(row) < 8:
            continue
        try:
            date = (row[1] or "").strip()
            if not re.match(r"\d{4}-\d{1,2}-\d{1,2}", date):
                continue

            institution = (row[2] or "").replace("\n", "")
            diag_code = (row[5] or "").strip()
            if not diag_code:
                continue

            diag_name_raw = (row[6] or "").replace("\n", "")
            diag_name = re.sub(r"^\(양방\)", "", diag_name_raw).strip()

            is_pharmacy = "약국" in institution

            records.append({
                "date": date,
                "institution": institution,
                "is_pharmacy": is_pharmacy,
                "diag_code": diag_code,
                "diag_name": diag_name,
            })
        except Exception:
            continue

    return records


# ── 세부진료정보 파싱 ──────────────────────────────────────────────────────────

def parse_detail_info(path: str) -> list[dict]:
    rows = _extract_rows(path)
    records = []

    for row in rows:
        if len(row) < 5:
            continue
        try:
            date = (row[1] or "").strip()
            if not re.match(r"\d{4}-\d{1,2}-\d{1,2}", date):
                continue

            institution = (row[2] or "").replace("\n", "")
            treatment_detail = (row[3] or "").replace("\n", " ")
            code_name = (row[4] or "").replace("\n", "")

            records.append({
                "date": date,
                "institution": institution,
                "treatment_detail": treatment_detail,
                "code_name": code_name,
            })
        except Exception:
            continue

    return records


# ── 투약일수 추출 ──────────────────────────────────────────────────────────────

_MED_PATTERN = re.compile(
    r"처방조제[-\s]?(내복약|외용약)\s*(\d+)일분", re.UNICODE
)


def extract_medication_days(detail_records: list[dict]) -> dict[str, int]:
    days_by_date: dict[str, int] = defaultdict(int)
    for rec in detail_records:
        m = _MED_PATTERN.search(rec["code_name"])
        if m:
            days_by_date[rec["date"]] += int(m.group(2))
    return dict(days_by_date)


# ── 처치 분류 ──────────────────────────────────────────────────────────────────

def classify_treatment(treatment_detail: str, code_name: str) -> str | None:
    # pdftotext 라인랩으로 인해 한글 사이 공백이 생길 수 있어 정규식 사용
    td = _normalize_korean(treatment_detail)
    cn = _normalize_korean(code_name)

    if re.search(r"영상진단|검사료", td) or "검사" in cn:
        return "Exam"

    if re.search(r"처치\s*및\s*수술|처치및수술", td):
        if re.search(r"수술", cn) or re.search(r"술$", cn):
            return "Surgery"
        return "Treatment"

    if "이학요법" in td:
        return "Treatment"

    return None


def collect_methods_by_date(detail_records: list[dict]) -> dict[str, set]:
    methods: dict[str, set] = defaultdict(set)
    for rec in detail_records:
        method = classify_treatment(rec["treatment_detail"], rec["code_name"])
        if method:
            methods[rec["date"]].add(method)
    return dict(methods)


# ── 내원일수 중복 제거 ─────────────────────────────────────────────────────────

def calculate_unique_visits(basic_records: list[dict]) -> dict[str, int]:
    date_flags: dict[str, dict] = defaultdict(
        lambda: {"hospital": False, "pharmacy": False}
    )
    for rec in basic_records:
        if rec["is_pharmacy"]:
            date_flags[rec["date"]]["pharmacy"] = True
        else:
            date_flags[rec["date"]]["hospital"] = True
    return {date: 1 for date in date_flags}


# ── 주상병명 대표값 결정 ───────────────────────────────────────────────────────

def get_representative_diagnosis(basic_records: list[dict]) -> dict[str, tuple]:
    result: dict[str, tuple] = {}
    for rec in basic_records:
        date = rec["date"]
        if date not in result:
            result[date] = (rec["diag_code"], rec["diag_name"])
        elif not rec["is_pharmacy"]:
            result[date] = (rec["diag_code"], rec["diag_name"])
    return result


# ── Join 및 집계 ──────────────────────────────────────────────────────────────

def join_and_aggregate(
    basic_records: list[dict],
    detail_records: list[dict],
) -> dict:
    unique_visits = calculate_unique_visits(basic_records)
    diag_by_date = get_representative_diagnosis(basic_records)
    med_days_by_date = extract_medication_days(detail_records)
    methods_by_date = collect_methods_by_date(detail_records)

    detail_dates = {rec["date"] for rec in detail_records}

    exceptions = []
    matched_dates = set()

    for date, (diag_code, diag_name) in diag_by_date.items():
        if date not in detail_dates:
            institution = next(
                (
                    r["institution"]
                    for r in basic_records
                    if r["date"] == date and not r["is_pharmacy"]
                ),
                "알 수 없음",
            )
            exceptions.append(
                {
                    "date": date,
                    "hospital": institution,
                    "diagnosis": diag_name,
                    "reason": "세부진료정보 매칭 없음",
                }
            )
        else:
            matched_dates.add(date)

    diag_groups: dict[str, list] = defaultdict(list)
    for date in matched_dates:
        diag_code, diag_name = diag_by_date[date]
        diag_groups[diag_code].append(
            {
                "date": date,
                "diag_name": diag_name,
                "visits": unique_visits.get(date, 1),
                "med_days": med_days_by_date.get(date, 0),
                "methods": list(methods_by_date.get(date, set())),
            }
        )

    summary = []
    for diag_code, entries in diag_groups.items():
        dates = sorted(e["date"] for e in entries)
        all_methods: set = set()
        total_visits = 0
        total_med_days = 0
        diag_name = entries[0]["diag_name"]

        for e in entries:
            all_methods.update(e["methods"])
            total_visits += e["visits"]
            total_med_days += e["med_days"]
            if e["diag_name"]:
                diag_name = e["diag_name"]

        summary.append(
            {
                "diagnosis": diag_name,
                "diagnosisCode": diag_code,
                "dateRange": {"start": dates[0], "end": dates[-1]},
                "totalVisits": total_visits,
                "methods": sorted(all_methods),
                "totalMedicationDays": total_med_days,
            }
        )

    summary.sort(key=lambda x: x["dateRange"]["end"], reverse=True)
    exceptions.sort(key=lambda x: x["date"], reverse=True)

    return {"summary": summary, "exceptions": exceptions}


# ── Vercel Serverless Handler ─────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._json_response(400, {"error": "multipart/form-data required"})
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            result = _process_multipart(body, content_type)
            self._json_response(200, result)
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _json_response(self, status: int, data: dict):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


def _process_multipart(body: bytes, content_type: str) -> dict:
    import email

    boundary_match = re.search(r"boundary=([^\s;]+)", content_type)
    if not boundary_match:
        raise ValueError("boundary not found in Content-Type")

    msg_text = f"Content-Type: {content_type}\r\n\r\n".encode() + body
    msg = email.message_from_bytes(msg_text)

    basic_records = []
    detail_records = []
    tmp_files = []

    try:
        for part in msg.walk():
            if part.get_content_maintype() == "multipart":
                continue
            filename = part.get_filename()
            if not filename or not filename.lower().endswith(".pdf"):
                continue

            pdf_bytes = part.get_payload(decode=True)
            if not pdf_bytes:
                continue

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(pdf_bytes)
                tmp_path = f.name
            tmp_files.append(tmp_path)

            pdf_type = detect_pdf_type(tmp_path)
            if pdf_type == "basic":
                basic_records.extend(parse_basic_info(tmp_path))
            elif pdf_type == "detail":
                detail_records.extend(parse_detail_info(tmp_path))
            else:
                raise ValueError(f"PDF 타입 감지 실패: {filename}")

        if not basic_records:
            raise ValueError("기본진료정보 PDF를 찾을 수 없습니다.")
        if not detail_records:
            raise ValueError("세부진료정보 PDF를 찾을 수 없습니다.")

        return join_and_aggregate(basic_records, detail_records)

    finally:
        for f in tmp_files:
            try:
                os.unlink(f)
            except OSError:
                pass
