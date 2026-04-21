"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import type { ParseResult } from "@/lib/types"

const MAX_FILE_SIZE = 4.5 * 1024 * 1024 // 4.5 MB

type Props = {
  onResult: (result: ParseResult) => void
  onError: (msg: string) => void
}

export default function FileUploader({ onResult, onError }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const valid: File[] = []
    const errors: string[] = []

    Array.from(incoming).forEach((f) => {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        errors.push(`${f.name}: PDF 파일만 업로드 가능합니다.`)
        return
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: 파일 크기가 4.5 MB를 초과합니다. (${(f.size / 1024 / 1024).toFixed(1)} MB)`)
        return
      }
      valid.push(f)
    })

    if (errors.length) onError(errors.join("\n"))
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name))
      return [...prev, ...valid.filter((f) => !names.has(f.name))]
    })
  }, [onError])

  const removeFile = (index: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async () => {
    if (files.length < 2) {
      onError("기본진료정보 + 세부진료정보 PDF를 모두 업로드해 주세요.")
      return
    }
    setLoading(true)
    onError("")
    try {
      const form = new FormData()
      files.forEach((f) => form.append("files", f))

      const res = await fetch("/api/parse", { method: "POST", body: form })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "파싱 실패")
      onResult(data as ParseResult)
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 드래그&드롭 영역 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addFiles(e.dataTransfer.files)
        }}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-gray-600 hover:border-blue-400"}
        `}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          PDF 파일을 여기에 끌어다 놓거나 클릭하여 선택하세요
        </p>
        <p className="text-sm text-gray-400 mt-1">
          기본진료정보 + 세부진료정보 (최대 4.5 MB / 파일)
        </p>
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* 파일 목록 */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={f.name}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 text-sm"
            >
              <span className="truncate max-w-xs text-gray-700 dark:text-gray-300">
                📎 {f.name}{" "}
                <span className="text-gray-400">
                  ({(f.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </span>
              <button
                onClick={() => removeFile(i)}
                className="ml-4 text-red-400 hover:text-red-600 font-bold flex-shrink-0"
                aria-label="파일 제거"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 처리 버튼 */}
      <Button
        onClick={handleSubmit}
        disabled={loading || files.length < 2}
        className="w-full h-12 text-base font-semibold"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            분석 중...
          </span>
        ) : (
          "📊 보험 청구 데이터 추출"
        )}
      </Button>
    </div>
  )
}
