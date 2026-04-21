"""CLI 모드 - Next.js Route Handler가 subprocess로 호출하는 엔트리포인트.
Usage: python api/parse_cli.py <pdf_path1> <pdf_path2> ...
Output: JSON to stdout
"""
import sys
import json
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from parse import detect_pdf_type, parse_basic_info, parse_detail_info, join_and_aggregate


def main():
    paths = sys.argv[1:]
    if not paths:
        print(json.dumps({"error": "파일 경로를 전달해주세요."}), flush=True)
        sys.exit(1)

    basic_records = []
    detail_records = []
    errors = []

    for path in paths:
        try:
            pdf_type = detect_pdf_type(path)
            if pdf_type == "basic":
                basic_records.extend(parse_basic_info(path))
            elif pdf_type == "detail":
                detail_records.extend(parse_detail_info(path))
            else:
                errors.append(f"PDF 타입 감지 실패: {os.path.basename(path)}")
        except Exception as e:
            errors.append(f"{os.path.basename(path)}: {str(e)}")

    if errors:
        print(json.dumps({"error": "\n".join(errors)}, ensure_ascii=False), flush=True)
        sys.exit(1)

    if not basic_records:
        print(json.dumps({"error": "기본진료정보 PDF를 찾을 수 없습니다."}, ensure_ascii=False), flush=True)
        sys.exit(1)

    if not detail_records:
        print(json.dumps({"error": "세부진료정보 PDF를 찾을 수 없습니다."}, ensure_ascii=False), flush=True)
        sys.exit(1)

    result = join_and_aggregate(basic_records, detail_records)
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
