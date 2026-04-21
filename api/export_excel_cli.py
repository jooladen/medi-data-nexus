"""CLI 모드 - JSON을 stdin으로 받아 xlsx를 stdout으로 출력.
Usage: echo '<json>' | python api/export_excel_cli.py
"""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(__file__))

from export_excel import build_excel


def main():
    raw = sys.stdin.buffer.read()
    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception as e:
        sys.stderr.write(f"JSON 파싱 실패: {e}\n")
        sys.exit(1)

    try:
        xlsx_bytes = build_excel(data)
        sys.stdout.buffer.write(xlsx_bytes)
    except Exception as e:
        sys.stderr.write(f"엑셀 생성 실패: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
