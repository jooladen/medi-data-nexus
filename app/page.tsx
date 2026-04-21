"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import FileUploader from "@/components/FileUploader"
import type { ParseResult } from "@/lib/types"

export default function Home() {
  const router = useRouter()
  const [error, setError] = useState("")

  const handleResult = (result: ParseResult) => {
    sessionStorage.setItem("parseResult", JSON.stringify(result))
    router.push("/result")
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            보험 청구 데이터 자동 추출
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
            기본진료정보 + 세부진료정보 PDF를 업로드하면
            내원일수·투약일수·처치 분류를 자동으로 정리합니다.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <FileUploader onResult={handleResult} onError={setError} />

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm whitespace-pre-line">
              ⚠️ {error}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          파일은 서버에 저장되지 않습니다. 처리 후 즉시 삭제됩니다.
        </p>
      </div>
    </main>
  )
}
