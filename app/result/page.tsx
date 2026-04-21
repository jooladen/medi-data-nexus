"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import ResultTable from "@/components/ResultTable"
import ExceptionList from "@/components/ExceptionList"
import type { ParseResult } from "@/lib/types"

export default function ResultPage() {
  const router = useRouter()
  const [result, setResult] = useState<ParseResult | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem("parseResult")
    if (!raw) {
      router.replace("/")
      return
    }
    setResult(JSON.parse(raw) as ParseResult)
  }, [router])

  const handleDownload = async () => {
    if (!result) return
    setDownloading(true)
    try {
      const res = await fetch("/api/export-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      })
      if (!res.ok) throw new Error("엑셀 생성 실패")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "보험청구요약.xlsx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "다운로드 실패")
    } finally {
      setDownloading(false)
    }
  }

  if (!result) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-400">로딩 중...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              📊 보험 청구 요약
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              총 {result.summary.length}개 상병 ·{" "}
              {result.exceptions.length > 0
                ? `미매칭 ${result.exceptions.length}건`
                : "미매칭 없음"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/")}>
              ← 다시 업로드
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? "생성 중..." : "⬇️ 엑셀 다운로드"}
            </Button>
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
          <ResultTable summary={result.summary} />
          <ExceptionList exceptions={result.exceptions} />
        </div>
      </div>
    </main>
  )
}
